# Microservices - Service Discovery API Gateway統合

> API Gateway統合パターン、リクエストルーティング、ミドルウェア実装

## 概要

API GatewayとService Discoveryの統合により、クライアントはサービスの場所を知ることなく、Gateway経由で透明性の高い通信を実現できます。動的なルーティング、ヘルスチェック、負荷分散を自動化し、マイクロサービス環境での運用効率を大幅に向上させます。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryサーバーサイド](./04b-service-discovery-server.md) - サーバーサイド実装概要
- [Service Discovery Kubernetes](./04b2-service-discovery-k8s.md) - Kubernetes統合パターン
- [Service Discovery DNS](./04b3-service-discovery-dns.md) - DNS-based Discovery

## API Gateway Service Registry

### 1. Gateway Service Registry実装

```typescript
// api-gateway/src/service-discovery/gateway-service-registry.ts
export class GatewayServiceRegistry {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private loadBalancer: LoadBalancer,
    private healthChecker: HealthChecker,
    private logger: Logger
  ) {
    this.startPeriodicHealthChecks();
  }

  async routeRequest(serviceName: string, req: express.Request, res: express.Response): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const healthyInstances = await this.filterHealthyInstances(instances);
      
      if (healthyInstances.length === 0) {
        this.logger.warn('No healthy instances available', { serviceName });
        res.status(503).json({
          error: 'Service Unavailable',
          message: `No healthy instances available for ${serviceName}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const selectedInstance = this.loadBalancer.selectInstance(healthyInstances);
      await this.forwardRequest(selectedInstance, req, res);

    } catch (error) {
      this.logger.error('Request routing failed', { serviceName, error: error.message });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to route request',
        timestamp: new Date().toISOString()
      });
    }
  }

  private async filterHealthyInstances(instances: ServiceInstance[]): Promise<ServiceInstance[]> {
    const healthResults = await this.healthChecker.checkAllInstances(instances);
    
    return instances.filter(instance => 
      healthResults.get(instance.id) === true
    );
  }

  private async forwardRequest(
    instance: ServiceInstance, 
    req: express.Request, 
    res: express.Response
  ): Promise<void> {
    const targetUrl = `http://${instance.host}:${instance.port}${req.path}`;
    
    const startTime = Date.now();
    
    try {
      const response = await axios({
        method: req.method as Method,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers: {
          ...req.headers,
          'X-Forwarded-For': req.ip,
          'X-Gateway-Instance': process.env.INSTANCE_ID,
          'X-Request-ID': req.headers['x-request-id'] || crypto.randomUUID(),
          'X-Forwarded-Proto': req.protocol,
          'X-Forwarded-Host': req.get('Host')
        },
        timeout: 30000,
        validateStatus: (status) => status < 600 // すべてのHTTPステータスを転送
      });

      // レスポンス時間をログに記録
      const duration = Date.now() - startTime;
      this.logger.info('Request forwarded successfully', {
        targetUrl,
        method: req.method,
        statusCode: response.status,
        duration
      });

      // レスポンスヘッダーを転送
      Object.entries(response.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.set(key, value);
        }
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.response) {
        this.logger.warn('Target service returned error', {
          targetUrl,
          statusCode: error.response.status,
          duration
        });
        
        res.status(error.response.status).json(error.response.data);
      } else {
        this.logger.error('Target service unavailable', {
          targetUrl,
          error: error.message,
          duration
        });
        
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Target service did not respond',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  private startPeriodicHealthChecks(): void {
    setInterval(async () => {
      try {
        const serviceNames = await this.getAllServiceNames();
        
        for (const serviceName of serviceNames) {
          const instances = await this.serviceRegistry.discover(serviceName);
          const healthResults = await this.healthChecker.checkAllInstances(instances);
          
          // 不健全なインスタンスをログに記録
          instances.forEach(instance => {
            const healthy = healthResults.get(instance.id);
            if (!healthy) {
              this.logger.warn('Unhealthy instance detected', {
                serviceName,
                instanceId: instance.id,
                host: instance.host,
                port: instance.port
              });
            }
          });
        }
      } catch (error) {
        this.logger.error('Periodic health check failed', { error: error.message });
      }
    }, 30000); // 30秒間隔
  }

  private async getAllServiceNames(): Promise<string[]> {
    // 実装は使用するサービスレジストリによって異なる
    // 通常は設定ファイルまたはレジストリから取得
    return process.env.MONITORED_SERVICES?.split(',') || 
           ['user-service', 'order-service', 'inventory-service'];
  }
}
```

### 2. Request Routing Middleware

```typescript
// api-gateway/src/middleware/service-routing.ts
export class ServiceRoutingMiddleware {
  constructor(
    private gatewayRegistry: GatewayServiceRegistry,
    private routeConfig: RouteConfig,
    private logger: Logger
  ) {}

  handler(): express.RequestHandler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const route = this.matchRoute(req.path, req.method);
        if (!route) {
          return next(); // 他のミドルウェアに処理を委譲
        }

        // リクエストの前処理
        await this.preprocessRequest(req, route);

        // メトリクス記録
        const startTime = Date.now();
        
        // サービスルーティング
        await this.gatewayRegistry.routeRequest(route.serviceName, req, res);

        // リクエスト完了後のメトリクス記録
        const duration = Date.now() - startTime;
        this.recordRequestMetrics(route.serviceName, req.method, res.statusCode, duration);

      } catch (error) {
        this.logger.error('Routing middleware error', {
          path: req.path,
          method: req.method,
          error: error.message
        });
        next(error);
      }
    };
  }

  private matchRoute(path: string, method: string): RouteMatch | null {
    for (const route of this.routeConfig.routes) {
      const pathMatch = path.match(new RegExp(route.pathPattern));
      const methodMatch = !route.methods || route.methods.includes(method);
      
      if (pathMatch && methodMatch) {
        return {
          serviceName: route.serviceName,
          rewritePath: route.rewritePath,
          metadata: route.metadata,
          pathParams: this.extractPathParams(pathMatch, route.pathParamNames || [])
        };
      }
    }
    return null;
  }

  private extractPathParams(match: RegExpMatchArray, paramNames: string[]): Record<string, string> {
    const params: Record<string, string> = {};
    
    for (let i = 1; i < match.length && i <= paramNames.length; i++) {
      params[paramNames[i - 1]] = match[i];
    }
    
    return params;
  }

  private async preprocessRequest(req: express.Request, route: RouteMatch): Promise<void> {
    // パスの書き換え
    if (route.rewritePath) {
      const originalPath = req.path;
      req.url = req.url.replace(
        new RegExp(route.rewritePath.pattern), 
        route.rewritePath.replacement
      );
      
      this.logger.debug('Path rewritten', {
        original: originalPath,
        rewritten: req.path
      });
    }

    // 認証・認可のチェック
    if (route.metadata.requiresAuth) {
      await this.checkAuthentication(req);
    }

    // レート制限のチェック
    if (route.metadata.rateLimit) {
      await this.checkRateLimit(req, route.metadata.rateLimit);
    }

    // リクエスト変換
    if (route.metadata.requestTransform) {
      await this.transformRequest(req, route.metadata.requestTransform);
    }

    // パスパラメータをヘッダーに追加
    if (Object.keys(route.pathParams).length > 0) {
      Object.entries(route.pathParams).forEach(([key, value]) => {
        req.headers[`x-path-${key}`] = value;
      });
    }
  }

  private async checkAuthentication(req: express.Request): Promise<void> {
    const authToken = req.headers.authorization;
    if (!authToken) {
      throw new UnauthorizedError('Authentication required');
    }

    // JWTトークンの検証（実装例）
    try {
      const token = authToken.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  private async checkRateLimit(req: express.Request, limit: RateLimit): Promise<void> {
    const clientId = this.getClientIdentifier(req);
    const key = `rate_limit:${clientId}`;
    
    // Redis等を使った実装（簡略化）
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, limit.windowSeconds);
    }

    if (current > limit.requests) {
      throw new RateLimitError(`Rate limit exceeded: ${current}/${limit.requests} requests`);
    }

    // レスポンスヘッダーに制限情報を追加
    res.set('X-RateLimit-Limit', limit.requests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, limit.requests - current).toString());
  }

  private async transformRequest(req: express.Request, transform: RequestTransform): Promise<void> {
    // リクエストボディの変換
    if (transform.bodyTransform) {
      req.body = this.applyTransformation(req.body, transform.bodyTransform);
    }

    // ヘッダーの追加/削除
    if (transform.addHeaders) {
      Object.entries(transform.addHeaders).forEach(([key, value]) => {
        req.headers[key.toLowerCase()] = value;
      });
    }

    if (transform.removeHeaders) {
      transform.removeHeaders.forEach(header => {
        delete req.headers[header.toLowerCase()];
      });
    }
  }

  private getClientIdentifier(req: express.Request): string {
    // API Key、User ID、IPアドレスなどからクライアントを識別
    return req.headers['x-api-key'] as string || 
           req.user?.id || 
           req.ip;
  }

  private applyTransformation(data: any, transform: any): any {
    // JSONデータ変換のロジック（実装依存）
    return data;
  }

  private recordRequestMetrics(
    serviceName: string, 
    method: string, 
    statusCode: number, 
    duration: number
  ): void {
    // メトリクス収集システムに記録（Prometheus、DataDog等）
    metrics.histogram('gateway_request_duration_ms').observe(
      { service: serviceName, method, status: statusCode.toString() },
      duration
    );
    
    metrics.counter('gateway_requests_total').inc({
      service: serviceName,
      method,
      status: statusCode.toString()
    });
  }
}

// 型定義
interface RouteMatch {
  serviceName: string;
  rewritePath?: PathRewrite;
  metadata: RouteMetadata;
  pathParams: Record<string, string>;
}

interface PathRewrite {
  pattern: string;
  replacement: string;
}

interface RouteMetadata {
  requiresAuth: boolean;
  rateLimit?: RateLimit;
  requestTransform?: RequestTransform;
}

interface RateLimit {
  requests: number;
  windowSeconds: number;
}

interface RequestTransform {
  bodyTransform?: any;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
}

interface RouteConfig {
  routes: RouteDefinition[];
}

interface RouteDefinition {
  pathPattern: string;
  pathParamNames?: string[];
  methods?: string[];
  serviceName: string;
  rewritePath?: PathRewrite;
  metadata: RouteMetadata;
}

// カスタムエラークラス
class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class RateLimitError extends Error {
  statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### 3. Gateway設定例

```yaml
# config/gateway-routes.yaml
routes:
  - pathPattern: "^/api/users/(.+)"
    pathParamNames: ["userId"]
    methods: ["GET", "PUT", "DELETE"]
    serviceName: "user-service"
    rewritePath:
      pattern: "^/api/users"
      replacement: "/users"
    metadata:
      requiresAuth: true
      rateLimit:
        requests: 100
        windowSeconds: 60

  - pathPattern: "^/api/orders"
    methods: ["GET", "POST"]
    serviceName: "order-service"
    metadata:
      requiresAuth: true
      rateLimit:
        requests: 50
        windowSeconds: 60
      requestTransform:
        addHeaders:
          X-Service-Version: "v2"

  - pathPattern: "^/api/inventory"
    serviceName: "inventory-service"
    metadata:
      requiresAuth: false
      rateLimit:
        requests: 200
        windowSeconds: 60

  - pathPattern: "^/health"
    serviceName: "gateway-health"
    metadata:
      requiresAuth: false
```

API GatewayとService Discoveryの統合により、マイクロサービス環境での透明性の高い通信とインフラ管理の自動化を実現できます。