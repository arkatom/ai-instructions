# Microservices - Service Discovery 障害処理とフェイルオーバー

> 障害に強いService Client、リトライ機能、フォールバック戦略

## 概要

Service Discoveryにおいて、ネットワーク障害やサービス停止は避けられない現実です。障害処理とフェイルオーバー機能により、システムの可用性と耐障害性を大幅に向上させることができます。リトライ、サーキットブレーカー、フォールバック戦略を組み合わせた包括的な障害対策を実装します。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryモニタリング](./04c-service-discovery-monitoring.md) - モニタリング・運用概要
- [Service Discovery監視システム](./04c2-service-discovery-monitoring-system.md) - 監視とアラート
- [Service Discovery運用](./04c3-service-discovery-operations.md) - 運用ベストプラクティス

## Resilient Service Client

### 1. 障害耐性を持つService Client実装

```typescript
// shared/infrastructure/resilient-service-client.ts
export class ResilientServiceClient extends ServiceClient {
  constructor(
    serviceRegistry: ServiceRegistry,
    private fallbackStrategies: Map<string, FallbackStrategy>,
    private retryPolicy: RetryPolicy,
    private logger: Logger
  ) {
    super(
      serviceRegistry,
      new WeightedRoundRobinLoadBalancer(),
      axios.create(),
      new CircuitBreaker(),
      new Cache()
    );
  }

  protected async makeRequest<T>(
    serviceName: string,
    method: string,
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt++) {
      try {
        return await super.makeRequest(serviceName, method, path, data, config);
      } catch (error) {
        lastError = error;
        this.logger.warn('Request failed', { 
          serviceName, 
          attempt, 
          error: error.message,
          path,
          method
        });

        // 最大試行回数に達した場合
        if (attempt === this.retryPolicy.maxAttempts) {
          break;
        }

        // 再試行不可能なエラーの場合はすぐに終了
        if (!this.isRetryableError(error)) {
          this.logger.info('Non-retryable error detected', {
            serviceName,
            error: error.message,
            statusCode: error.response?.status
          });
          break;
        }

        // 指数バックオフで待機
        const delay = this.calculateBackoffDelay(attempt);
        this.logger.debug('Waiting before retry', { serviceName, attempt, delay });
        await this.sleep(delay);
      }
    }

    // フォールバック戦略の実行
    const fallbackStrategy = this.fallbackStrategies.get(serviceName);
    if (fallbackStrategy) {
      this.logger.warn('Executing fallback strategy', { 
        serviceName, 
        error: lastError?.message 
      });
      return await fallbackStrategy.execute(method, path, data, config);
    }
    
    throw lastError || new Error('Request failed after all retries');
  }

  private isRetryableError(error: any): boolean {
    // HTTP 5xxエラー、ネットワークエラーは再試行可能
    if (error.response) {
      const status = error.response.status;
      // 5xxエラー、408 Request Timeout、429 Too Many Requestsは再試行可能
      return status >= 500 || status === 408 || status === 429;
    }
    
    // ネットワークエラー（ECONNREFUSED, ETIMEOUTなど）
    if (error.code) {
      const retryableCodes = [
        'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
        'ENETDOWN', 'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH',
        'EPIPE', 'ECONNRESET'
      ];
      return retryableCodes.includes(error.code);
    }

    return false;
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.retryPolicy.baseDelayMs;
    const maxDelay = this.retryPolicy.maxDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // ジッター追加（ランダムな変動）で雷の群れ効果を回避
    const jitter = exponentialDelay * 0.1 * Math.random();
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 障害統計の取得
  getFailureStats(serviceName: string): FailureStats {
    const circuitBreaker = this.getCircuitBreakerForService(serviceName);
    
    return {
      serviceName,
      circuitBreakerState: circuitBreaker.getState(),
      failureCount: circuitBreaker.getFailures(),
      lastFailure: new Date(), // 実装では実際の最終失敗時刻を記録
      totalRequests: 0, // 実装では実際の統計を記録
      failedRequests: 0
    };
  }

  private getCircuitBreakerForService(serviceName: string): CircuitBreaker {
    // 実装では各サービス用のCircuitBreakerを管理
    return new CircuitBreaker({
      failureThreshold: 5,
      timeout: 60000
    }, this.logger);
  }
}

interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface FailureStats {
  serviceName: string;
  circuitBreakerState: string;
  failureCount: number;
  lastFailure: Date;
  totalRequests: number;
  failedRequests: number;
}
```

### 2. 高度なリトライ戦略

```typescript
// shared/infrastructure/advanced-retry.ts
export class AdaptiveRetryPolicy implements RetryPolicy {
  constructor(
    private config: AdaptiveRetryConfig
  ) {}

  get maxAttempts(): number {
    return this.config.maxAttempts;
  }

  get baseDelayMs(): number {
    return this.config.baseDelayMs;
  }

  get maxDelayMs(): number {
    return this.config.maxDelayMs;
  }

  calculateDelay(attempt: number, error: any): number {
    // エラーの種類に応じて遅延を調整
    const baseDelay = this.getDelayForError(error);
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    
    // 適応的ジッター（サーバー負荷に基づく）
    const jitter = this.calculateAdaptiveJitter(exponentialDelay, error);
    
    return Math.min(exponentialDelay + jitter, this.maxDelayMs);
  }

  private getDelayForError(error: any): number {
    if (error.response) {
      const status = error.response.status;
      if (status === 429) { // Rate Limited
        // Retry-After headerがある場合はそれを使用
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          return parseInt(retryAfter) * 1000; // 秒をミリ秒に変換
        }
        return this.config.rateLimitDelayMs || 5000;
      }
      if (status >= 500) { // Server Error
        return this.config.serverErrorDelayMs || this.baseDelayMs;
      }
    }
    
    // ネットワークエラー
    if (error.code) {
      if (error.code === 'ETIMEDOUT') {
        return this.config.timeoutDelayMs || this.baseDelayMs * 2;
      }
      if (error.code === 'ECONNREFUSED') {
        return this.config.connectionDelayMs || this.baseDelayMs * 3;
      }
    }
    
    return this.baseDelayMs;
  }

  private calculateAdaptiveJitter(delay: number, error: any): number {
    // サーバーの負荷状況に応じてジッターを調整
    const baseJitter = delay * 0.1;
    
    if (error.response) {
      const serverLoad = this.extractServerLoad(error.response.headers);
      if (serverLoad > 0.8) {
        // 高負荷時はジッターを増加
        return baseJitter * (1 + serverLoad);
      }
    }
    
    return baseJitter * Math.random();
  }

  private extractServerLoad(headers: any): number {
    // X-Server-Load headerから負荷情報を取得（存在する場合）
    const loadHeader = headers['x-server-load'];
    if (loadHeader) {
      return parseFloat(loadHeader);
    }
    return 0;
  }
}

interface AdaptiveRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  rateLimitDelayMs?: number;
  serverErrorDelayMs?: number;
  timeoutDelayMs?: number;
  connectionDelayMs?: number;
}
```

## Fallback Strategy実装

### 1. 基本フォールバック戦略

```typescript
// shared/infrastructure/fallback-strategies.ts
export interface FallbackStrategy {
  execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any>;
}

export class CachedResponseFallback implements FallbackStrategy {
  constructor(
    private cache: Cache, 
    private cacheTtl: number,
    private logger: Logger
  ) {}

  async execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    if (method === 'GET') {
      const cacheKey = this.generateCacheKey(path, config?.params);
      const cachedResponse = await this.cache.get(cacheKey);
      
      if (cachedResponse) {
        this.logger.info('Using cached response for fallback', { 
          path, 
          cacheKey,
          cacheAge: this.getCacheAge(cachedResponse)
        });
        return cachedResponse.data;
      }
    }
    
    throw new Error('No fallback available for non-GET requests or no cached data');
  }

  private generateCacheKey(path: string, params?: any): string {
    const paramsString = params ? JSON.stringify(params) : '';
    return `fallback:${path}:${paramsString}`;
  }

  private getCacheAge(cachedResponse: any): number {
    if (cachedResponse.timestamp) {
      return Date.now() - cachedResponse.timestamp;
    }
    return 0;
  }
}

export class DefaultResponseFallback implements FallbackStrategy {
  constructor(
    private defaultResponses: Map<string, any>,
    private logger: Logger
  ) {}

  async execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    const route = this.extractRoute(path);
    const defaultResponse = this.defaultResponses.get(route);
    
    if (defaultResponse) {
      this.logger.info('Using default response for fallback', { 
        path, 
        route,
        responseType: typeof defaultResponse
      });
      
      // 動的なデフォルト値の生成
      if (typeof defaultResponse === 'function') {
        return defaultResponse(path, data, config);
      }
      
      return defaultResponse;
    }
    
    throw new Error(`No default response available for ${route}`);
  }

  private extractRoute(path: string): string {
    // パスパラメータを汎用化 (例: /users/123 -> /users/:id)
    return path.replace(/\/\d+/g, '/:id')
              .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // UUID対応
              .replace(/\/[a-zA-Z0-9_-]{10,}/g, '/:token'); // トークン対応
  }
}

export class AlternativeServiceFallback implements FallbackStrategy {
  constructor(
    private alternativeServices: Map<string, ServiceAlternative>,
    private serviceClient: ServiceClient,
    private logger: Logger
  ) {}

  async execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    const originalService = this.extractServiceFromPath(path);
    const alternative = this.alternativeServices.get(originalService);
    
    if (!alternative) {
      throw new Error(`No alternative service configured for ${originalService}`);
    }

    this.logger.info('Using alternative service for fallback', {
      original: originalService,
      alternative: alternative.serviceName,
      path,
      dataTransform: !!alternative.dataTransform
    });

    try {
      // パス変換
      const transformedPath = alternative.pathTransform ? 
        alternative.pathTransform(path) : path;

      // データ変換
      const transformedData = alternative.dataTransform ? 
        alternative.dataTransform(data) : data;

      // 代替サービスへのリクエスト
      const response = await this.serviceClient[method.toLowerCase()](
        alternative.serviceName,
        transformedPath,
        transformedData,
        config
      );

      // レスポンス変換
      return alternative.responseTransform ? 
        alternative.responseTransform(response) : response;

    } catch (error) {
      this.logger.warn('Alternative service also failed', {
        alternativeService: alternative.serviceName,
        error: error.message
      });
      throw error;
    }
  }

  private extractServiceFromPath(path: string): string {
    // パスから元のサービス名を推測
    // 例: /api/users/* -> user-service
    const pathSegments = path.split('/').filter(s => s.length > 0);
    if (pathSegments.length >= 2 && pathSegments[0] === 'api') {
      return `${pathSegments[1]}-service`;
    }
    return 'default-service';
  }
}

export class GradualDegradationFallback implements FallbackStrategy {
  private degradationLevels: DegradationLevel[];

  constructor(
    degradationLevels: DegradationLevel[],
    private logger: Logger
  ) {
    this.degradationLevels = degradationLevels.sort((a, b) => a.priority - b.priority);
  }

  async execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    for (const level of this.degradationLevels) {
      try {
        this.logger.info('Trying degradation level', {
          level: level.name,
          priority: level.priority,
          path
        });

        return await level.strategy.execute(method, path, data, config);
      } catch (error) {
        this.logger.warn('Degradation level failed', {
          level: level.name,
          error: error.message
        });
      }
    }

    throw new Error('All degradation levels failed');
  }
}

interface ServiceAlternative {
  serviceName: string;
  pathTransform?: (path: string) => string;
  dataTransform?: (data: any) => any;
  responseTransform?: (response: any) => any;
}

interface DegradationLevel {
  name: string;
  priority: number;
  strategy: FallbackStrategy;
}
```

### 2. フォールバック戦略の設定例

```typescript
// shared/config/fallback-config.ts
export class FallbackStrategyConfig {
  static createFallbackStrategies(
    cache: Cache,
    serviceClient: ServiceClient
  ): Map<string, FallbackStrategy> {
    const strategies = new Map<string, FallbackStrategy>();

    // ユーザーサービス用フォールバック
    strategies.set('user-service', new GradualDegradationFallback([
      {
        name: 'cached-response',
        priority: 1,
        strategy: new CachedResponseFallback(cache, 300000, logger)
      },
      {
        name: 'alternative-service',
        priority: 2,
        strategy: new AlternativeServiceFallback(
          new Map([
            ['user-service', {
              serviceName: 'user-backup-service',
              pathTransform: (path) => path.replace('/api/users', '/backup/users')
            }]
          ]),
          serviceClient,
          logger
        )
      },
      {
        name: 'default-response',
        priority: 3,
        strategy: new DefaultResponseFallback(
          new Map([
            ['/users/:id', (path: string) => ({
              id: path.split('/').pop(),
              name: 'Unknown User',
              email: 'unknown@example.com',
              isActive: false,
              fallback: true
            })]
          ]),
          logger
        )
      }
    ], logger));

    // 注文サービス用フォールバック
    strategies.set('order-service', new CachedResponseFallback(cache, 180000, logger));

    return strategies;
  }
}
```

障害処理とフェイルオーバー機能により、Service Discoveryシステムの可用性と耐障害性を大幅に向上させ、ユーザー体験の継続性を確保できます。