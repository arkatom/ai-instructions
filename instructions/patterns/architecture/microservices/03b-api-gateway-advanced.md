# Microservices - API Gateway 高度な機能

> バージョニング、キャッシュ、ロードバランシング、フェイルオーバー

## 概要

API Gatewayの高度な機能実装では、APIバージョニング、レスポンスキャッシュ、インテリジェントなロードバランシング機能を提供し、システムのスケーラビリティとパフォーマンスを向上させます。

## APIバージョニング

### バージョン管理システム

```typescript
// api-gateway/src/versioning/version-router.ts
export class APIVersionRouter {
  private routes = new Map<string, Map<string, express.Router>>();

  addRoute(path: string, version: string, router: express.Router): void {
    if (!this.routes.has(path)) {
      this.routes.set(path, new Map());
    }
    this.routes.get(path)!.set(version, router);
  }

  createVersioningMiddleware(): express.RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = this.extractVersion(req);
      const path = this.extractBasePath(req.path);
      
      req.apiVersion = version;
      req.basePath = path;

      const versionRoutes = this.routes.get(path);
      if (!versionRoutes) {
        return next();
      }

      const router = versionRoutes.get(version) || versionRoutes.get('default');
      if (router) {
        router(req, res, next);
      } else {
        res.status(400).json({
          error: 'Unsupported API version',
          supportedVersions: Array.from(versionRoutes.keys())
        });
      }
    };
  }

  private extractVersion(req: Request): string {
    // ヘッダーからバージョン取得
    if (req.headers['api-version']) {
      return req.headers['api-version'] as string;
    }
    
    // URLパスからバージョン取得 (/v1/users, /v2/users)
    const pathMatch = req.path.match(/^\/v(\d+)/);
    if (pathMatch) {
      return `v${pathMatch[1]}`;
    }

    // Accept ヘッダーからバージョン取得
    const acceptHeader = req.headers.accept;
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/application\/vnd\.api\+json;version=(\d+)/);
      if (versionMatch) {
        return `v${versionMatch[1]}`;
      }
    }

    return 'v1'; // デフォルトバージョン
  }

  private extractBasePath(fullPath: string): string {
    // /v1/users/123 -> /users
    return fullPath.replace(/^\/v\d+/, '');
  }
}

// バージョン管理の実装例
export class VersionManager {
  constructor(private versionRouter: APIVersionRouter) {}

  setupVersionedRoutes(): void {
    // Users API - v1
    const usersV1 = express.Router();
    usersV1.get('/', this.getUsersV1.bind(this));
    usersV1.post('/', this.createUserV1.bind(this));
    
    // Users API - v2 (拡張フィールド対応)
    const usersV2 = express.Router();
    usersV2.get('/', this.getUsersV2.bind(this));
    usersV2.post('/', this.createUserV2.bind(this));

    // Orders API - v1
    const ordersV1 = express.Router();
    ordersV1.get('/', this.getOrdersV1.bind(this));
    
    // Orders API - v2 (新しいステータス対応)
    const ordersV2 = express.Router();
    ordersV2.get('/', this.getOrdersV2.bind(this));

    // ルート登録
    this.versionRouter.addRoute('/users', 'v1', usersV1);
    this.versionRouter.addRoute('/users', 'v2', usersV2);
    this.versionRouter.addRoute('/orders', 'v1', ordersV1);
    this.versionRouter.addRoute('/orders', 'v2', ordersV2);
  }

  private async getUsersV1(req: Request, res: Response): Promise<void> {
    // v1の実装 - 基本フィールドのみ
    const users = await this.userService.getUsers();
    const v1Users = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    }));
    
    res.json(v1Users);
  }

  private async getUsersV2(req: Request, res: Response): Promise<void> {
    // v2の実装 - 拡張フィールド対応
    const users = await this.userService.getUsers();
    const v2Users = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile,
      preferences: user.preferences,
      metadata: user.metadata,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    res.json(v2Users);
  }
}
```

### バージョン廃止管理

```typescript
// api-gateway/src/versioning/deprecation-manager.ts
export class DeprecationManager {
  private deprecatedVersions = new Map<string, DeprecationInfo>();

  addDeprecation(path: string, version: string, deprecationInfo: DeprecationInfo): void {
    const key = `${path}:${version}`;
    this.deprecatedVersions.set(key, deprecationInfo);
  }

  createDeprecationMiddleware(): express.RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = `${req.basePath}:${req.apiVersion}`;
      const deprecationInfo = this.deprecatedVersions.get(key);
      
      if (deprecationInfo) {
        // 廃止警告ヘッダーを追加
        res.setHeader('Deprecation', deprecationInfo.sunsetDate);
        res.setHeader('Link', `<${deprecationInfo.migrationGuide}>; rel="successor-version"`);
        res.setHeader('Sunset', deprecationInfo.sunsetDate);
        
        // 廃止日を過ぎている場合はエラー
        if (new Date() > new Date(deprecationInfo.sunsetDate)) {
          return res.status(410).json({
            error: 'API version has been sunset',
            version: req.apiVersion,
            sunsetDate: deprecationInfo.sunsetDate,
            migrationGuide: deprecationInfo.migrationGuide
          });
        }
      }
      
      next();
    };
  }
}

interface DeprecationInfo {
  sunsetDate: string;
  migrationGuide: string;
  reason: string;
}
```

## レスポンスキャッシュ

### インテリジェントキャッシュシステム

```typescript
// api-gateway/src/caching/response-cache.ts
export class ResponseCacheMiddleware {
  constructor(
    private cacheStore: CacheStore,
    private defaultTTL: number = 300 // 5分
  ) {}

  create(options?: CacheOptions): express.RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.shouldCache(req, options)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);
      
      try {
        const cached = await this.cacheStore.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Key', cacheKey);
          res.setHeader('X-Cache-TTL', cached.ttl.toString());
          return res.json(cached.data);
        }
      } catch (error) {
        console.warn('Cache retrieval failed', { error, cacheKey });
      }

      // レスポンスをインターセプト
      const originalSend = res.send;
      res.send = function(data: any) {
        if (res.statusCode === 200 && data) {
          // 成功レスポンスをキャッシュ
          const ttl = options?.ttl || this.defaultTTL;
          this.cacheStore.set(cacheKey, { 
            data: JSON.parse(data),
            ttl: ttl,
            cachedAt: new Date().toISOString()
          }, ttl)
            .catch(error => console.warn('Cache storage failed', { error, cacheKey }));
          
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-TTL', ttl.toString());
        }

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  private shouldCache(req: Request, options?: CacheOptions): boolean {
    // GET リクエストのみキャッシュ
    if (req.method !== 'GET') {
      return false;
    }

    // 認証が必要なリクエストは基本的にキャッシュしない
    if (req.user && !options?.cacheAuthenticated) {
      return false;
    }

    // 除外パスの確認
    if (options?.excludePaths?.some(path => req.path.includes(path))) {
      return false;
    }

    return true;
  }

  private generateCacheKey(req: Request): string {
    const parts = [
      req.method,
      req.path,
      JSON.stringify(req.query),
      req.user?.id || 'anonymous',
      req.apiVersion || 'v1'
    ];
    
    return crypto.createHash('sha256')
      .update(parts.join(':'))
      .digest('hex');
  }
}

interface CacheOptions {
  ttl?: number;
  cacheAuthenticated?: boolean;
  excludePaths?: string[];
}

// 階層キャッシュシステム
export class HierarchicalCache implements CacheStore {
  constructor(
    private l1Cache: MemoryCache, // メモリキャッシュ
    private l2Cache: RedisCache   // Redisキャッシュ
  ) {}

  async get(key: string): Promise<any> {
    // L1キャッシュから取得を試行
    let result = await this.l1Cache.get(key);
    if (result) {
      return result;
    }

    // L2キャッシュから取得を試行
    result = await this.l2Cache.get(key);
    if (result) {
      // L1キャッシュにも保存
      await this.l1Cache.set(key, result, 60); // 1分間のメモリキャッシュ
      return result;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // 両方のキャッシュに保存
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, 300)), // メモリは最大5分
      this.l2Cache.set(key, value, ttl)
    ]);
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      this.l1Cache.delete(key),
      this.l2Cache.delete(key)
    ]);
  }
}
```

## ロードバランシング・フェイルオーバー

### インテリジェントロードバランサー

```typescript
// api-gateway/src/load-balancing/load-balancer.ts
export class LoadBalancer {
  private serviceInstances = new Map<string, ServiceInstance[]>();
  private failedInstances = new Map<string, Set<string>>();
  private instanceMetrics = new Map<string, InstanceMetrics>();

  constructor(
    private serviceRegistry: ServiceRegistry,
    private healthChecker: HealthChecker
  ) {
    this.startHealthMonitoring();
  }

  async selectInstance(serviceName: string, strategy: LoadBalancingStrategy = 'weighted-round-robin'): Promise<ServiceInstance> {
    const instances = await this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances available for service: ${serviceName}`);
    }

    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(instances);
      case 'weighted-round-robin':
        return this.weightedRoundRobin(instances);
      case 'least-connections':
        return this.leastConnections(instances);
      case 'least-response-time':
        return this.leastResponseTime(instances);
      default:
        return this.weightedRoundRobin(instances);
    }
  }

  private async getHealthyInstances(serviceName: string): Promise<ServiceInstance[]> {
    const allInstances = await this.serviceRegistry.getInstances(serviceName);
    const failedSet = this.failedInstances.get(serviceName) || new Set();
    
    return allInstances.filter(instance => !failedSet.has(instance.id));
  }

  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    // シンプルなラウンドロビン
    const timestamp = Date.now();
    const index = Math.floor(timestamp / 1000) % instances.length;
    return instances[index];
  }

  private weightedRoundRobin(instances: ServiceInstance[]): ServiceInstance {
    // 重み付きラウンドロビン
    const totalWeight = instances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const instance of instances) {
      currentWeight += instance.weight || 1;
      if (random <= currentWeight) {
        return instance;
      }
    }
    
    return instances[0]; // フォールバック
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const metrics = this.instanceMetrics.get(instance.id);
      const connections = metrics?.activeConnections || 0;
      
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    // 接続数を記録
    this.recordConnection(selectedInstance.id);
    
    return selectedInstance;
  }

  private leastResponseTime(instances: ServiceInstance[]): ServiceInstance {
    let minResponseTime = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const metrics = this.instanceMetrics.get(instance.id);
      const avgResponseTime = metrics?.averageResponseTime || 1000;
      
      if (avgResponseTime < minResponseTime) {
        minResponseTime = avgResponseTime;
        selectedInstance = instance;
      }
    }

    return selectedInstance;
  }

  private recordConnection(instanceId: string): void {
    const metrics = this.instanceMetrics.get(instanceId) || {
      activeConnections: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0
    };

    metrics.activeConnections++;
    metrics.totalRequests++;
    this.instanceMetrics.set(instanceId, metrics);

    // 一定時間後に接続数を減少
    setTimeout(() => {
      const currentMetrics = this.instanceMetrics.get(instanceId);
      if (currentMetrics) {
        currentMetrics.activeConnections = Math.max(0, currentMetrics.activeConnections - 1);
      }
    }, 30000); // 30秒後
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const [serviceName, instances] of this.serviceInstances) {
        const failedSet = this.failedInstances.get(serviceName) || new Set();
        
        for (const instance of instances) {
          const isHealthy = await this.healthChecker.check(instance);
          
          if (isHealthy) {
            failedSet.delete(instance.id);
          } else {
            failedSet.add(instance.id);
            console.warn(`Instance marked as unhealthy: ${instance.id}`);
          }
        }
        
        this.failedInstances.set(serviceName, failedSet);
      }
    }, 30000); // 30秒間隔
  }

  // レスポンス時間を記録
  recordResponseTime(instanceId: string, responseTime: number): void {
    const metrics = this.instanceMetrics.get(instanceId);
    if (metrics) {
      // 移動平均を計算
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * 0.8) + (responseTime * 0.2);
    }
  }

  // エラー率を記録
  recordError(instanceId: string): void {
    const metrics = this.instanceMetrics.get(instanceId);
    if (metrics) {
      const totalRequests = metrics.totalRequests;
      const errors = Math.floor(totalRequests * metrics.errorRate) + 1;
      metrics.errorRate = errors / totalRequests;
    }
  }
}

interface InstanceMetrics {
  activeConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
}

type LoadBalancingStrategy = 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'least-response-time';
```

### フェイルオーバー機構

```typescript
// api-gateway/src/failover/failover-manager.ts
export class FailoverManager {
  private failoverStrategies = new Map<string, FailoverStrategy>();
  
  constructor(private loadBalancer: LoadBalancer) {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies(): void {
    // 自動フェイルオーバー戦略
    this.failoverStrategies.set('auto', new AutoFailoverStrategy(this.loadBalancer));
    
    // マニュアルフェイルオーバー戦略
    this.failoverStrategies.set('manual', new ManualFailoverStrategy());
    
    // 段階的フェイルオーバー戦略
    this.failoverStrategies.set('gradual', new GradualFailoverStrategy(this.loadBalancer));
  }

  async handleFailover(serviceName: string, failedInstanceId: string, strategy: string = 'auto'): Promise<ServiceInstance | null> {
    const failoverStrategy = this.failoverStrategies.get(strategy);
    if (!failoverStrategy) {
      throw new Error(`Unknown failover strategy: ${strategy}`);
    }

    return await failoverStrategy.execute(serviceName, failedInstanceId);
  }
}

interface FailoverStrategy {
  execute(serviceName: string, failedInstanceId: string): Promise<ServiceInstance | null>;
}

class AutoFailoverStrategy implements FailoverStrategy {
  constructor(private loadBalancer: LoadBalancer) {}

  async execute(serviceName: string, failedInstanceId: string): Promise<ServiceInstance | null> {
    console.log(`Auto failover triggered for ${serviceName}, failed instance: ${failedInstanceId}`);
    
    try {
      // 別のヘルシーなインスタンスを選択
      const fallbackInstance = await this.loadBalancer.selectInstance(serviceName);
      
      console.log(`Failover successful: ${failedInstanceId} -> ${fallbackInstance.id}`);
      return fallbackInstance;
    } catch (error) {
      console.error(`Failover failed for ${serviceName}:`, error);
      return null;
    }
  }
}

class ManualFailoverStrategy implements FailoverStrategy {
  async execute(serviceName: string, failedInstanceId: string): Promise<ServiceInstance | null> {
    // マニュアル確認待ち
    console.warn(`Manual failover required for ${serviceName}, instance: ${failedInstanceId}`);
    
    // 実装では管理者への通知とマニュアル操作待ちロジック
    return null;
  }
}

class GradualFailoverStrategy implements FailoverStrategy {
  constructor(private loadBalancer: LoadBalancer) {}

  async execute(serviceName: string, failedInstanceId: string): Promise<ServiceInstance | null> {
    console.log(`Gradual failover started for ${serviceName}`);
    
    // 段階的にトラフィックを移行
    // 実装では複数のステップでトラフィックを徐々に移行
    
    return await this.loadBalancer.selectInstance(serviceName);
  }
}
```

## 関連ファイル

- **[API Gateway コア実装](./03a-api-gateway-core.md)** - 基本構造、認証・認可、サーキットブレーカー、ロギング
- **[API Gateway運用・セキュリティ](./03c-api-gateway-operations.md)** - モニタリング、メトリクス、セキュリティ強化

API Gatewayの高度な機能により、スケーラブルで信頼性の高いマイクロサービスアーキテクチャを実現できます。