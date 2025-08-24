# Microservices - API Gateway コア実装

> 基本構造、認証・認可、サーキットブレーカー、ロギング

## 概要

API Gatewayのコア実装は、マイクロサービスアーキテクチャの統一エントリーポイントとして、基本的なルーティング、認証・認可処理、障害処理、ロギング機能を提供します。

## API Gateway基本実装

### 基本構造

```typescript
// api-gateway/src/gateway.ts
import express from 'express';
import httpProxy from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { authenticate, authorize } from './middleware/auth';
import { requestLogging } from './middleware/logging';
import { circuitBreaker } from './middleware/circuit-breaker';

export class APIGateway {
  private app: express.Application;
  private serviceRegistry: ServiceRegistry;

  constructor(serviceRegistry: ServiceRegistry) {
    this.app = express();
    this.serviceRegistry = serviceRegistry;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // セキュリティヘッダー
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS設定
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // レート制限
    this.app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 1000, // リクエスト数制限
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    }));

    // リクエストログ
    this.app.use(requestLogging);

    // 認証
    this.app.use('/api', authenticate);
  }

  private setupRoutes(): void {
    // ユーザーサービス
    this.app.use('/api/users', 
      authorize(['user:read', 'user:write']),
      circuitBreaker('user-service'),
      this.createProxy('user-service')
    );

    // 注文サービス
    this.app.use('/api/orders',
      authorize(['order:read', 'order:write']),
      circuitBreaker('order-service'),
      this.createProxy('order-service')
    );

    // 在庫サービス
    this.app.use('/api/inventory',
      authorize(['inventory:read']),
      circuitBreaker('inventory-service'),
      this.createProxy('inventory-service')
    );

    // 決済サービス
    this.app.use('/api/payments',
      authorize(['payment:write']),
      circuitBreaker('payment-service'),
      this.createProxy('payment-service')
    );

    // GraphQL Federation
    this.app.use('/graphql', this.createGraphQLGateway());

    // ヘルスチェックエンドポイント
    this.app.get('/health', this.healthCheck.bind(this));
  }

  private createProxy(serviceName: string): express.RequestHandler {
    return httpProxy({
      target: () => this.serviceRegistry.getServiceUrl(serviceName),
      changeOrigin: true,
      pathRewrite: {
        [`^/api/${serviceName}`]: ''
      },
      onProxyReq: (proxyReq, req, res) => {
        // リクエストヘッダーに追加情報を設定
        proxyReq.setHeader('X-User-ID', req.user?.id || '');
        proxyReq.setHeader('X-Request-ID', req.requestId || '');
        proxyReq.setHeader('X-Correlation-ID', req.correlationId || '');
        proxyReq.setHeader('X-Client-IP', req.ip || '');
        proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
      },
      onError: (err, req, res) => {
        console.error(`Proxy error for ${serviceName}:`, err);
        res.status(503).json({
          error: 'Service temporarily unavailable',
          service: serviceName,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private createGraphQLGateway(): express.RequestHandler {
    const { ApolloGateway } = require('@apollo/gateway');
    const { ApolloServer } = require('apollo-server-express');

    const gateway = new ApolloGateway({
      serviceList: [
        { name: 'users', url: 'http://user-service:4000/graphql' },
        { name: 'orders', url: 'http://order-service:4000/graphql' },
        { name: 'inventory', url: 'http://inventory-service:4000/graphql' },
      ],
      buildService({ url }) {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest({ request, context }) {
            request.http.headers.set('user-id', context.userId);
            request.http.headers.set('authorization', context.authToken);
          }
        });
      }
    });

    const server = new ApolloServer({
      gateway,
      subscriptions: false,
      context: ({ req }) => ({
        userId: req.user?.id,
        authToken: req.headers.authorization
      })
    });

    return server.getMiddleware({ path: '/graphql' });
  }

  private async healthCheck(req: express.Request, res: express.Response): Promise<void> {
    const services = await this.checkServicesHealth();
    const overallHealth = services.every(s => s.healthy) ? 'healthy' : 'unhealthy';
    
    res.status(overallHealth === 'healthy' ? 200 : 503).json({
      status: overallHealth,
      services,
      timestamp: new Date().toISOString()
    });
  }

  private async checkServicesHealth(): Promise<ServiceHealth[]> {
    const serviceNames = ['user-service', 'order-service', 'inventory-service'];
    const healthChecks = serviceNames.map(async (serviceName) => {
      try {
        const serviceUrl = await this.serviceRegistry.getServiceUrl(serviceName);
        const response = await fetch(`${serviceUrl}/health`, { timeout: 5000 });
        return {
          name: serviceName,
          healthy: response.status === 200,
          url: serviceUrl
        };
      } catch (error) {
        return {
          name: serviceName,
          healthy: false,
          error: error.message
        };
      }
    });

    return Promise.all(healthChecks);
  }
}

interface ServiceHealth {
  name: string;
  healthy: boolean;
  url?: string;
  error?: string;
}
```

## 認証・認可ミドルウェア

### JWT認証システム

```typescript
// api-gateway/src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

export async function authenticate(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        code: 'AUTH_MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // ユーザー情報を取得
    const user = await getUserFromToken(decoded);
    
    if (!user || !user.isActive) {
      res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID_TOKEN'
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions
    };

    next();
  } catch (error) {
    res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
}

export function authorize(requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const hasRequiredPermission = requiredPermissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'AUTH_FORBIDDEN',
        required: requiredPermissions,
        current: req.user.permissions
      });
      return;
    }

    next();
  };
}

async function getUserFromToken(decoded: any): Promise<UserInfo | null> {
  // トークンからユーザー情報を取得
  // キャッシュを活用して高速化
  const cacheKey = `user:${decoded.userId}`;
  let user = await cache.get(cacheKey);
  
  if (!user) {
    user = await userService.findById(decoded.userId);
    if (user) {
      await cache.set(cacheKey, user, 300); // 5分キャッシュ
    }
  }
  
  return user;
}

interface UserInfo {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}
```

## サーキットブレーカーミドルウェア

### 障害処理機能

```typescript
// api-gateway/src/middleware/circuit-breaker.ts
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
}

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const defaultOptions: CircuitBreakerOptions = {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10
      };

      const breaker = new CircuitBreaker(() => Promise.resolve(), {
        ...defaultOptions,
        ...options
      });

      // イベントリスナー
      breaker.on('open', () => {
        console.log(`Circuit breaker opened for ${serviceName}`);
        // アラート送信
        this.sendAlert('circuit_breaker_opened', { service: serviceName });
      });

      breaker.on('halfOpen', () => {
        console.log(`Circuit breaker half-opened for ${serviceName}`);
      });

      breaker.on('close', () => {
        console.log(`Circuit breaker closed for ${serviceName}`);
        this.sendAlert('circuit_breaker_closed', { service: serviceName });
      });

      // メトリクス収集
      breaker.on('success', (result) => {
        this.recordMetric('circuit_breaker_success', { service: serviceName });
      });

      breaker.on('failure', (error) => {
        this.recordMetric('circuit_breaker_failure', { 
          service: serviceName,
          error: error.message
        });
      });

      this.breakers.set(serviceName, breaker);
    }

    return this.breakers.get(serviceName)!;
  }

  private sendAlert(type: string, data: any): void {
    // アラート送信の実装
    console.log(`Alert: ${type}`, data);
  }

  private recordMetric(metric: string, data: any): void {
    // メトリクス記録の実装
    console.log(`Metric: ${metric}`, data);
  }
}

const circuitBreakerRegistry = new CircuitBreakerRegistry();

export function circuitBreaker(serviceName: string) {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName);

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (breaker.opened) {
      res.status(503).json({
        error: 'Service circuit breaker is open',
        service: serviceName,
        message: 'Service is temporarily unavailable due to repeated failures'
      });
      return;
    }
    next();
  };
}
```

## リクエストロギング

### 包括的ログシステム

```typescript
// api-gateway/src/middleware/logging.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  // リクエストIDとコリレーションIDの生成
  req.requestId = uuidv4();
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  const startTime = Date.now();
  
  // レスポンスヘッダーの設定
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Correlation-ID', req.correlationId);

  // リクエスト開始ログ
  console.log({
    type: 'request_start',
    requestId: req.requestId,
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    url: req.url,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // レスポンス終了時のログ
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    
    console.log({
      type: 'request_end',
      requestId: req.requestId,
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      responseSize: Buffer.byteLength(data || ''),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // メトリクス記録
    recordRequestMetrics(req, res, duration);

    return originalSend.call(this, data);
  };

  next();
}

function recordRequestMetrics(req: Request, res: Response, duration: number): void {
  // Prometheusメトリクスの例
  const labels = {
    method: req.method,
    path: getPathPattern(req.path),
    status_code: res.statusCode.toString()
  };

  // リクエスト数カウンター
  requestCounter.inc(labels);

  // レスポンス時間ヒストグラム
  responseTimeHistogram.observe(labels, duration);

  // エラー率カウンター
  if (res.statusCode >= 400) {
    errorCounter.inc(labels);
  }
}

function getPathPattern(path: string): string {
  // パスパラメーターを正規化
  // /api/users/123 -> /api/users/:id
  return path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
}

// Express Requestインターフェースの拡張
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      correlationId?: string;
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}
```

## 関連ファイル

- **[API Gateway高度な機能](./03b-api-gateway-advanced.md)** - バージョニング、キャッシュ、ロードバランシング
- **[API Gateway運用・セキュリティ](./03c-api-gateway-operations.md)** - モニタリング、メトリクス、セキュリティ強化

API Gatewayのコア実装により、マイクロサービスアーキテクチャの統一エントリーポイントとして、基本的な機能とセキュリティを提供できます。