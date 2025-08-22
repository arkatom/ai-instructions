# API Gateway Patterns

## Core Concepts

### API Gateway Architecture
```yaml
api_gateway_fundamentals:
  definition: "Single entry point for all client requests"
  
  core_responsibilities:
    - Request Routing
    - Protocol Translation
    - Authentication & Authorization
    - Rate Limiting
    - Request/Response Transformation
    - Circuit Breaking
    - Monitoring & Analytics
    
  benefits:
    - Simplified client interface
    - Centralized cross-cutting concerns
    - Service decoupling
    - Enhanced security
    - Better observability
    
  patterns:
    - Backend for Frontend (BFF)
    - API Composition
    - Request Aggregation
    - Service Mesh Integration
```

## Gateway Implementation

### Core Gateway Service
```typescript
// src/gateway/core/ApiGateway.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { RateLimiter } from '../middleware/RateLimiter';
import { Authenticator } from '../middleware/Authenticator';
import { CircuitBreaker } from '../middleware/CircuitBreaker';
import { RequestTransformer } from '../middleware/RequestTransformer';
import { ResponseCache } from '../middleware/ResponseCache';
import { MetricsCollector } from '../middleware/MetricsCollector';
import { ServiceRegistry } from '../registry/ServiceRegistry';

export interface GatewayConfig {
  port: number;
  services: ServiceConfig[];
  middleware: MiddlewareConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

export interface ServiceConfig {
  name: string;
  path: string;
  target: string;
  methods: string[];
  timeout?: number;
  retries?: number;
  circuitBreaker?: CircuitBreakerConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  transform?: TransformConfig;
}

export class ApiGateway {
  private app: Application;
  private serviceRegistry: ServiceRegistry;
  private rateLimiter: RateLimiter;
  private authenticator: Authenticator;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private responseCache: ResponseCache;
  private metricsCollector: MetricsCollector;

  constructor(
    private config: GatewayConfig,
    serviceRegistry: ServiceRegistry
  ) {
    this.app = express();
    this.serviceRegistry = serviceRegistry;
    this.initializeMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS configuration
    this.app.use(this.configureCors());
    
    // Request ID generation
    this.app.use(this.generateRequestId());
    
    // Request logging
    this.app.use(this.logRequest());
    
    // Metrics collection
    this.metricsCollector = new MetricsCollector(this.config.monitoring);
    this.app.use(this.metricsCollector.middleware());
    
    // Rate limiting
    this.rateLimiter = new RateLimiter(this.config.middleware.rateLimit);
    
    // Authentication
    this.authenticator = new Authenticator(this.config.security);
    
    // Response caching
    this.responseCache = new ResponseCache(this.config.middleware.cache);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.serviceRegistry.getHealthStatus()
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      res.set('Content-Type', 'text/plain');
      res.send(this.metricsCollector.getMetrics());
    });

    // Setup service routes
    this.config.services.forEach(service => {
      this.setupServiceRoute(service);
    });

    // API documentation
    this.app.use('/docs', express.static('public/docs'));
  }

  private setupServiceRoute(service: ServiceConfig): void {
    const router = express.Router();

    // Service-specific middleware
    const middlewares: any[] = [];

    // Authentication (if required)
    if (service.auth !== false) {
      middlewares.push(
        this.authenticator.authenticate(service.authConfig)
      );
    }

    // Rate limiting
    if (service.rateLimit) {
      middlewares.push(
        this.rateLimiter.limit(service.rateLimit)
      );
    }

    // Circuit breaker
    if (service.circuitBreaker) {
      const breaker = new CircuitBreaker(service.circuitBreaker);
      this.circuitBreakers.set(service.name, breaker);
      middlewares.push(breaker.middleware());
    }

    // Response caching
    if (service.cache) {
      middlewares.push(
        this.responseCache.cache(service.cache)
      );
    }

    // Request transformation
    if (service.transform) {
      const transformer = new RequestTransformer(service.transform);
      middlewares.push(transformer.transform());
    }

    // Proxy configuration
    const proxyOptions: Options = {
      target: service.target,
      changeOrigin: true,
      pathRewrite: {
        [`^${service.path}`]: ''
      },
      timeout: service.timeout || 30000,
      proxyTimeout: service.timeout || 30000,
      onProxyReq: this.onProxyRequest(service),
      onProxyRes: this.onProxyResponse(service),
      onError: this.onProxyError(service)
    };

    // Apply middleware and proxy
    router.use(
      service.path,
      ...middlewares,
      createProxyMiddleware(proxyOptions)
    );

    this.app.use(router);
  }

  private onProxyRequest(service: ServiceConfig) {
    return (proxyReq: any, req: Request, res: Response) => {
      // Add correlation ID
      proxyReq.setHeader('X-Correlation-ID', req.correlationId);
      
      // Add service headers
      proxyReq.setHeader('X-Gateway-Service', service.name);
      proxyReq.setHeader('X-Gateway-Request-Time', Date.now());
      
      // Forward user context
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
      }

      // Log outgoing request
      console.log(`[${req.correlationId}] Proxying to ${service.name}: ${req.method} ${req.path}`);
    };
  }

  private onProxyResponse(service: ServiceConfig) {
    return (proxyRes: any, req: Request, res: Response) => {
      // Add response headers
      proxyRes.headers['X-Gateway-Response-Time'] = Date.now() - req.startTime;
      proxyRes.headers['X-Gateway-Service'] = service.name;
      
      // Collect metrics
      this.metricsCollector.recordServiceCall(
        service.name,
        req.method,
        proxyRes.statusCode,
        Date.now() - req.startTime
      );

      // Log response
      console.log(`[${req.correlationId}] Response from ${service.name}: ${proxyRes.statusCode}`);
    };
  }

  private onProxyError(service: ServiceConfig) {
    return (err: Error, req: Request, res: Response) => {
      console.error(`[${req.correlationId}] Proxy error for ${service.name}:`, err);
      
      // Record error metric
      this.metricsCollector.recordError(service.name, err.message);
      
      // Check if circuit breaker should trip
      const breaker = this.circuitBreakers.get(service.name);
      if (breaker) {
        breaker.recordFailure();
      }

      // Return error response
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Service ${service.name} is unavailable`,
          correlationId: req.correlationId
        });
      }
    };
  }

  private configureCors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      
      if (this.config.security.cors.allowedOrigins.includes(origin || '*')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        );
        res.header(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        );
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
      } else {
        next();
      }
    };
  }

  private generateRequestId() {
    return (req: Request, res: Response, next: NextFunction) => {
      req.correlationId = req.headers['x-correlation-id'] as string ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = Date.now();
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
    };
  }

  private logRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      console.log(`[${req.correlationId}] ${req.method} ${req.path}`);
      
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        console.log(
          `[${req.correlationId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
        );
      });
      
      next();
    };
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource does not exist',
        path: req.path,
        correlationId: req.correlationId
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`[${req.correlationId}] Error:`, err);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred processing your request'
          : err.message,
        correlationId: req.correlationId
      });
    });
  }

  public start(): void {
    this.app.listen(this.config.port, () => {
      console.log(`API Gateway running on port ${this.config.port}`);
      console.log(`Registered services: ${this.config.services.map(s => s.name).join(', ')}`);
    });
  }
}
```

## Authentication & Authorization

### JWT Authentication Middleware
```typescript
// src/gateway/middleware/Authenticator.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { Redis } from 'ioredis';

export interface AuthConfig {
  provider: 'jwt' | 'oauth2' | 'apikey';
  jwksUri?: string;
  issuer?: string;
  audience?: string;
  algorithms?: string[];
  publicKey?: string;
  secretKey?: string;
}

export interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

export class Authenticator {
  private jwksClient?: jwksRsa.JwksClient;
  private redis: Redis;
  private tokenBlacklist: Set<string> = new Set();

  constructor(private config: AuthConfig) {
    if (config.provider === 'jwt' && config.jwksUri) {
      this.jwksClient = jwksRsa({
        jwksUri: config.jwksUri,
        cache: true,
        cacheMaxAge: 600000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10
      });
    }
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }

  authenticate(options?: AuthOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authentication token provided'
          });
        }

        // Check token blacklist
        if (await this.isTokenBlacklisted(token)) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has been revoked'
          });
        }

        // Verify token based on provider
        let user: User;
        
        switch (this.config.provider) {
          case 'jwt':
            user = await this.verifyJWT(token);
            break;
          case 'oauth2':
            user = await this.verifyOAuth2(token);
            break;
          case 'apikey':
            user = await this.verifyAPIKey(token);
            break;
          default:
            throw new Error('Unsupported authentication provider');
        }

        // Check permissions if required
        if (options?.requiredPermissions) {
          const hasPermission = options.requiredPermissions.some(
            perm => user.permissions.includes(perm)
          );
          
          if (!hasPermission) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Insufficient permissions'
            });
          }
        }

        // Check roles if required
        if (options?.requiredRoles) {
          const hasRole = options.requiredRoles.some(
            role => user.roles.includes(role)
          );
          
          if (!hasRole) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Insufficient role privileges'
            });
          }
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        
        next();
      } catch (error: any) {
        console.error('Authentication error:', error);
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has expired'
          });
        }
        
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
          });
        }
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed'
        });
      }
    };
  }

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    // Check cookie
    if (req.cookies?.token) {
      return req.cookies.token;
    }

    // Check query parameter (for WebSocket connections)
    if (req.query.token) {
      return req.query.token as string;
    }

    return null;
  }

  private async verifyJWT(token: string): Promise<User> {
    return new Promise((resolve, reject) => {
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: this.config.algorithms as jwt.Algorithm[]
      };

      const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
        if (this.jwksClient) {
          this.jwksClient.getSigningKey(header.kid!, (err, key) => {
            if (err) {
              return callback(err);
            }
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
          });
        } else if (this.config.publicKey) {
          callback(null, this.config.publicKey);
        } else if (this.config.secretKey) {
          callback(null, this.config.secretKey);
        } else {
          callback(new Error('No key configuration found'));
        }
      };

      jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
        if (err) {
          return reject(err);
        }

        const payload = decoded as any;
        const user: User = {
          id: payload.sub || payload.user_id,
          email: payload.email,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
          tenantId: payload.tenant_id
        };

        resolve(user);
      });
    });
  }

  private async verifyOAuth2(token: string): Promise<User> {
    // Validate token with OAuth2 provider
    const response = await fetch(`${this.config.oauth2Provider}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Invalid OAuth2 token');
    }

    const userInfo = await response.json();
    
    return {
      id: userInfo.sub,
      email: userInfo.email,
      roles: userInfo.roles || [],
      permissions: userInfo.permissions || [],
      tenantId: userInfo.tenant_id
    };
  }

  private async verifyAPIKey(apiKey: string): Promise<User> {
    // Look up API key in database or cache
    const keyData = await this.redis.get(`apikey:${apiKey}`);
    
    if (!keyData) {
      throw new Error('Invalid API key');
    }

    return JSON.parse(keyData);
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await this.redis.get(`blacklist:${token}`);
    return blacklisted !== null;
  }

  public async revokeToken(token: string, ttl: number = 3600): Promise<void> {
    await this.redis.setex(`blacklist:${token}`, ttl, '1');
    this.tokenBlacklist.add(token);
  }
}

interface AuthOptions {
  requiredPermissions?: string[];
  requiredRoles?: string[];
}
```

## Rate Limiting

### Token Bucket Rate Limiter
```typescript
// src/gateway/middleware/RateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export class RateLimiter {
  private redis: Redis;
  private limits: Map<string, RateLimitConfig> = new Map();

  constructor(defaultConfig?: RateLimitConfig) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    if (defaultConfig) {
      this.limits.set('default', defaultConfig);
    }
  }

  limit(config?: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const limitConfig = config || this.limits.get('default') || {
        windowMs: 60000, // 1 minute
        maxRequests: 100
      };

      const key = this.generateKey(req, limitConfig);
      const now = Date.now();
      const window = Math.floor(now / limitConfig.windowMs);
      const redisKey = `ratelimit:${key}:${window}`;

      try {
        // Increment counter
        const count = await this.redis.incr(redisKey);
        
        // Set expiry on first request
        if (count === 1) {
          await this.redis.expire(redisKey, Math.ceil(limitConfig.windowMs / 1000));
        }

        // Add headers
        res.setHeader('X-RateLimit-Limit', limitConfig.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', 
          Math.max(0, limitConfig.maxRequests - count).toString()
        );
        res.setHeader('X-RateLimit-Reset', 
          new Date((window + 1) * limitConfig.windowMs).toISOString()
        );

        // Check if limit exceeded
        if (count > limitConfig.maxRequests) {
          res.setHeader('Retry-After', 
            Math.ceil(limitConfig.windowMs / 1000).toString()
          );
          
          return res.status(429).json({
            error: 'Too Many Requests',
            message: limitConfig.message || 'Rate limit exceeded',
            retryAfter: Math.ceil(limitConfig.windowMs / 1000)
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Fail open - allow request if rate limiting fails
        next();
      }
    };
  }

  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default key generation
    if (req.user) {
      return `user:${req.user.id}`;
    }

    return `ip:${req.ip}`;
  }

  // Sliding window rate limiter for more accurate limiting
  async slidingWindowLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `sliding:${key}`;

    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
    
    // Count current entries
    pipeline.zcard(redisKey);
    
    // Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    const count = results![1][1] as number;
    
    return count < limit;
  }
}

// Distributed rate limiter using Redis Lua script
export class DistributedRateLimiter {
  private redis: Redis;
  private script: string;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    // Lua script for atomic rate limiting
    this.script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local current = redis.call('incr', key)
      
      if current == 1 then
        redis.call('expire', key, window)
      end
      
      if current > limit then
        return {0, current, redis.call('ttl', key)}
      else
        return {1, current, redis.call('ttl', key)}
      end
    `;
  }

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; current: number; ttl: number }> {
    const result = await this.redis.eval(
      this.script,
      1,
      key,
      limit,
      windowSeconds
    ) as [number, number, number];

    return {
      allowed: result[0] === 1,
      current: result[1],
      ttl: result[2]
    };
  }
}
```

## Circuit Breaker

### Circuit Breaker Implementation
```typescript
// src/gateway/middleware/CircuitBreaker.ts
import { Request, Response, NextFunction } from 'express';

export interface CircuitBreakerConfig {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  minimumRequests: number;
  halfOpenRequests: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private nextAttempt: number = Date.now();
  private halfOpenRequests: number = 0;
  
  constructor(private config: CircuitBreakerConfig) {}

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.canRequest()) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Circuit breaker is open',
          retryAfter: Math.ceil((this.nextAttempt - Date.now()) / 1000)
        });
      }

      const startTime = Date.now();
      const originalSend = res.send;
      const originalJson = res.json;
      
      // Track response
      const trackResponse = () => {
        const duration = Date.now() - startTime;
        
        if (res.statusCode >= 500 || duration > this.config.timeout) {
          this.recordFailure();
        } else {
          this.recordSuccess();
        }
      };

      res.send = function(body: any) {
        trackResponse();
        return originalSend.call(this, body);
      };

      res.json = function(body: any) {
        trackResponse();
        return originalJson.call(this, body);
      };

      next();
    };
  }

  private canRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequests = 0;
        return true;
      }
      return false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests < this.config.halfOpenRequests) {
        this.halfOpenRequests++;
        return true;
      }
      return false;
    }

    return false;
  }

  recordSuccess(): void {
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.halfOpenRequests) {
        this.reset();
      }
    }
  }

  recordFailure(): void {
    this.failures++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
      return;
    }

    const totalRequests = this.failures + this.successes;
    
    if (totalRequests >= this.config.minimumRequests) {
      const errorPercentage = (this.failures / totalRequests) * 100;
      
      if (errorPercentage >= this.config.errorThresholdPercentage) {
        this.trip();
      }
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    console.log('Circuit breaker tripped');
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    console.log('Circuit breaker reset');
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    errorPercentage: number;
  } {
    const total = this.failures + this.successes;
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      errorPercentage: total > 0 ? (this.failures / total) * 100 : 0
    };
  }
}
```

## Request/Response Transformation

### Transform Middleware
```typescript
// src/gateway/middleware/RequestTransformer.ts
import { Request, Response, NextFunction } from 'express';
import { JSONPath } from 'jsonpath-plus';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export interface TransformConfig {
  request?: TransformRules;
  response?: TransformRules;
}

export interface TransformRules {
  headers?: Record<string, string | ((req: Request) => string)>;
  body?: {
    add?: Record<string, any>;
    remove?: string[];
    rename?: Record<string, string>;
    transform?: Array<{
      path: string;
      transformer: (value: any) => any;
    }>;
  };
  format?: {
    from?: 'json' | 'xml' | 'form';
    to?: 'json' | 'xml' | 'form';
  };
}

export class RequestTransformer {
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor(private config: TransformConfig) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  transform() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Transform request
        if (this.config.request) {
          await this.transformRequest(req);
        }

        // Transform response
        if (this.config.response) {
          this.interceptResponse(res);
        }

        next();
      } catch (error) {
        console.error('Transformation error:', error);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request transformation failed'
        });
      }
    };
  }

  private async transformRequest(req: Request): Promise<void> {
    const rules = this.config.request!;

    // Transform headers
    if (rules.headers) {
      for (const [key, value] of Object.entries(rules.headers)) {
        if (typeof value === 'function') {
          req.headers[key.toLowerCase()] = value(req);
        } else {
          req.headers[key.toLowerCase()] = value;
        }
      }
    }

    // Transform body format
    if (rules.format && req.body) {
      req.body = await this.convertFormat(
        req.body,
        rules.format.from!,
        rules.format.to!
      );
    }

    // Transform body content
    if (rules.body && req.body) {
      req.body = this.transformBody(req.body, rules.body);
    }
  }

  private transformBody(body: any, rules: any): any {
    let transformed = { ...body };

    // Add fields
    if (rules.add) {
      transformed = { ...transformed, ...rules.add };
    }

    // Remove fields
    if (rules.remove) {
      for (const path of rules.remove) {
        JSONPath({ path, json: transformed, callback: (value, type, payload) => {
          delete payload.parent[payload.parentProperty];
        }});
      }
    }

    // Rename fields
    if (rules.rename) {
      for (const [oldName, newName] of Object.entries(rules.rename)) {
        if (oldName in transformed) {
          transformed[newName as string] = transformed[oldName];
          delete transformed[oldName];
        }
      }
    }

    // Apply custom transformers
    if (rules.transform) {
      for (const { path, transformer } of rules.transform) {
        JSONPath({
          path,
          json: transformed,
          callback: (value, type, payload) => {
            payload.parent[payload.parentProperty] = transformer(value);
          }
        });
      }
    }

    return transformed;
  }

  private async convertFormat(
    data: any,
    from: string,
    to: string
  ): Promise<any> {
    if (from === to) return data;

    // Convert to intermediate JSON format
    let jsonData = data;
    
    if (from === 'xml') {
      jsonData = this.xmlParser.parse(data);
    } else if (from === 'form') {
      jsonData = this.parseFormData(data);
    }

    // Convert from JSON to target format
    if (to === 'xml') {
      return this.xmlBuilder.build(jsonData);
    } else if (to === 'form') {
      return this.buildFormData(jsonData);
    }

    return jsonData;
  }

  private parseFormData(data: string): any {
    const params = new URLSearchParams(data);
    const result: any = {};
    
    for (const [key, value] of params) {
      result[key] = value;
    }
    
    return result;
  }

  private buildFormData(data: any): string {
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(data)) {
      params.append(key, String(value));
    }
    
    return params.toString();
  }

  private interceptResponse(res: Response): void {
    const originalSend = res.send;
    const originalJson = res.json;
    const transformer = this;

    res.send = function(body: any) {
      if (transformer.config.response) {
        body = transformer.transformResponseBody(body);
      }
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      if (transformer.config.response?.body) {
        body = transformer.transformBody(body, transformer.config.response.body);
      }
      return originalJson.call(this, body);
    };
  }

  private transformResponseBody(body: any): any {
    if (!this.config.response?.body) return body;

    try {
      const parsed = JSON.parse(body);
      const transformed = this.transformBody(parsed, this.config.response.body);
      return JSON.stringify(transformed);
    } catch {
      // If not JSON, return as-is
      return body;
    }
  }
}
```

## Service Discovery

### Service Registry
```typescript
// src/gateway/registry/ServiceRegistry.ts
import { EventEmitter } from 'events';
import Consul from 'consul';
import { Etcd3 } from 'etcd3';

export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  address: string;
  port: number;
  tags: string[];
  metadata: Record<string, string>;
  health: 'healthy' | 'unhealthy' | 'critical';
  lastHeartbeat: Date;
}

export interface ServiceRegistryConfig {
  provider: 'consul' | 'etcd' | 'kubernetes' | 'static';
  consulConfig?: any;
  etcdConfig?: any;
  staticServices?: ServiceInstance[];
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private consul?: Consul;
  private etcd?: Etcd3;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private config: ServiceRegistryConfig) {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    switch (this.config.provider) {
      case 'consul':
        this.initializeConsul();
        break;
      case 'etcd':
        this.initializeEtcd();
        break;
      case 'kubernetes':
        this.initializeKubernetes();
        break;
      case 'static':
        this.initializeStatic();
        break;
    }

    // Start health checking
    this.startHealthChecking();
  }

  private initializeConsul(): void {
    this.consul = new Consul(this.config.consulConfig);
    
    // Watch for service changes
    const watcher = this.consul.watch({
      method: this.consul.catalog.service.list
    });

    watcher.on('change', async () => {
      await this.refreshServices();
    });

    watcher.on('error', (err) => {
      console.error('Consul watch error:', err);
    });

    // Initial load
    this.refreshServices();
  }

  private initializeEtcd(): void {
    this.etcd = new Etcd3(this.config.etcdConfig);
    
    // Watch for service changes
    const watcher = this.etcd.watch()
      .prefix('/services/')
      .create();

    watcher.on('put', async (res) => {
      const service = JSON.parse(res.value.toString());
      this.registerService(service);
    });

    watcher.on('delete', async (res) => {
      const serviceId = res.key.toString().split('/').pop();
      this.deregisterService(serviceId!);
    });

    // Initial load
    this.loadServicesFromEtcd();
  }

  private initializeKubernetes(): void {
    // Kubernetes service discovery using DNS or API
    // Implementation would use @kubernetes/client-node
    console.log('Kubernetes service discovery initialized');
  }

  private initializeStatic(): void {
    if (this.config.staticServices) {
      for (const service of this.config.staticServices) {
        this.registerService(service);
      }
    }
  }

  private async refreshServices(): Promise<void> {
    if (!this.consul) return;

    try {
      const services = await this.consul.catalog.service.list();
      
      for (const serviceName of Object.keys(services)) {
        const instances = await this.consul.health.service(serviceName);
        
        const healthyInstances = instances
          .filter((instance: any) => {
            const checks = instance.Checks || [];
            return checks.every((check: any) => 
              check.Status === 'passing'
            );
          })
          .map((instance: any) => ({
            id: instance.Service.ID,
            name: instance.Service.Service,
            version: instance.Service.Tags.find((t: string) => 
              t.startsWith('version=')
            )?.split('=')[1] || '1.0.0',
            address: instance.Service.Address,
            port: instance.Service.Port,
            tags: instance.Service.Tags,
            metadata: instance.Service.Meta || {},
            health: 'healthy' as const,
            lastHeartbeat: new Date()
          }));

        this.services.set(serviceName, healthyInstances);
      }

      this.emit('servicesUpdated', this.services);
    } catch (error) {
      console.error('Error refreshing services:', error);
    }
  }

  private async loadServicesFromEtcd(): Promise<void> {
    if (!this.etcd) return;

    try {
      const services = await this.etcd.getAll().prefix('/services/');
      
      for (const [key, value] of Object.entries(services)) {
        const service = JSON.parse(value as string);
        this.registerService(service);
      }
    } catch (error) {
      console.error('Error loading services from etcd:', error);
    }
  }

  public registerService(service: ServiceInstance): void {
    const instances = this.services.get(service.name) || [];
    const existingIndex = instances.findIndex(i => i.id === service.id);
    
    if (existingIndex >= 0) {
      instances[existingIndex] = service;
    } else {
      instances.push(service);
    }
    
    this.services.set(service.name, instances);
    this.emit('serviceRegistered', service);
  }

  public deregisterService(serviceId: string): void {
    for (const [name, instances] of this.services.entries()) {
      const filtered = instances.filter(i => i.id !== serviceId);
      if (filtered.length < instances.length) {
        this.services.set(name, filtered);
        this.emit('serviceDeregistered', serviceId);
        break;
      }
    }
  }

  public getService(name: string, version?: string): ServiceInstance | null {
    const instances = this.services.get(name);
    if (!instances || instances.length === 0) {
      return null;
    }

    // Filter by version if specified
    let filtered = instances;
    if (version) {
      filtered = instances.filter(i => i.version === version);
    }

    // Filter healthy instances only
    filtered = filtered.filter(i => i.health === 'healthy');

    if (filtered.length === 0) {
      return null;
    }

    // Simple round-robin load balancing
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  public getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  public getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, instances] of this.services.entries()) {
      const healthy = instances.filter(i => i.health === 'healthy').length;
      const unhealthy = instances.filter(i => i.health === 'unhealthy').length;
      const critical = instances.filter(i => i.health === 'critical').length;
      
      status[name] = {
        total: instances.length,
        healthy,
        unhealthy,
        critical
      };
    }
    
    return status;
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Check every 10 seconds
  }

  private async performHealthChecks(): Promise<void> {
    for (const [name, instances] of this.services.entries()) {
      for (const instance of instances) {
        try {
          const response = await fetch(
            `http://${instance.address}:${instance.port}/health`,
            { 
              method: 'GET',
              timeout: 5000 
            }
          );
          
          instance.health = response.ok ? 'healthy' : 'unhealthy';
          instance.lastHeartbeat = new Date();
        } catch (error) {
          instance.health = 'critical';
          console.error(`Health check failed for ${instance.id}:`, error);
        }
      }
    }
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}
```

## Backend for Frontend (BFF)

### BFF Implementation
```typescript
// src/gateway/bff/BFFGateway.ts
import { Request, Response, Router } from 'express';
import { GraphQLSchema, buildSchema } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
import DataLoader from 'dataloader';

export interface BFFConfig {
  client: 'web' | 'mobile' | 'desktop';
  services: Map<string, ServiceClient>;
  caching?: CacheConfig;
  batching?: boolean;
}

export class BFFGateway {
  private router: Router;
  private dataLoaders: Map<string, DataLoader<any, any>> = new Map();
  
  constructor(private config: BFFConfig) {
    this.router = Router();
    this.setupRoutes();
    this.setupDataLoaders();
  }

  private setupRoutes(): void {
    // Client-specific endpoints
    switch (this.config.client) {
      case 'web':
        this.setupWebRoutes();
        break;
      case 'mobile':
        this.setupMobileRoutes();
        break;
      case 'desktop':
        this.setupDesktopRoutes();
        break;
    }
  }

  private setupWebRoutes(): void {
    // Aggregate data for web dashboard
    this.router.get('/dashboard', async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Parallel calls to multiple services
        const [profile, stats, notifications, activities] = await Promise.all([
          this.config.services.get('user')!.getProfile(userId),
          this.config.services.get('analytics')!.getUserStats(userId),
          this.config.services.get('notification')!.getUnread(userId),
          this.config.services.get('activity')!.getRecent(userId, 10)
        ]);

        // Transform and combine data for web client
        const dashboard = {
          user: {
            ...profile,
            stats: this.transformStatsForWeb(stats)
          },
          notifications: {
            unread: notifications.count,
            items: notifications.items.slice(0, 5)
          },
          recentActivity: activities.map(this.transformActivityForWeb)
        };

        res.json(dashboard);
      } catch (error) {
        console.error('Dashboard aggregation error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
      }
    });

    // GraphQL endpoint for flexible queries
    this.router.use('/graphql', graphqlHTTP((req) => ({
      schema: this.buildWebSchema(),
      context: {
        user: req.user,
        loaders: this.dataLoaders
      },
      graphiql: process.env.NODE_ENV === 'development'
    })));
  }

  private setupMobileRoutes(): void {
    // Optimized endpoints for mobile
    this.router.get('/feed', async (req: Request, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const size = 20; // Smaller page size for mobile
      
      try {
        const feed = await this.config.services.get('content')!.getFeed(
          req.user!.id,
          page,
          size
        );

        // Optimize for mobile bandwidth
        const optimized = feed.items.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          summary: item.summary.substring(0, 100),
          thumbnail: this.getOptimizedImageUrl(item.image, 'mobile'),
          timestamp: item.timestamp
        }));

        res.json({
          items: optimized,
          hasMore: feed.hasMore,
          nextPage: feed.hasMore ? page + 1 : null
        });
      } catch (error) {
        console.error('Mobile feed error:', error);
        res.status(500).json({ error: 'Failed to load feed' });
      }
    });

    // Offline sync endpoint
    this.router.post('/sync', async (req: Request, res: Response) => {
      const { lastSync, changes } = req.body;
      
      try {
        // Process offline changes
        const results = await this.processOfflineChanges(changes);
        
        // Get updates since last sync
        const updates = await this.getUpdatesSince(lastSync, req.user!.id);
        
        res.json({
          processed: results,
          updates,
          serverTime: new Date().toISOString()
        });
      } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed' });
      }
    });
  }

  private setupDesktopRoutes(): void {
    // Rich data endpoints for desktop
    this.router.get('/workspace', async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        
        // Load comprehensive data for desktop app
        const [
          profile,
          projects,
          teams,
          documents,
          calendar,
          tasks
        ] = await Promise.all([
          this.config.services.get('user')!.getFullProfile(userId),
          this.config.services.get('project')!.getUserProjects(userId),
          this.config.services.get('team')!.getUserTeams(userId),
          this.config.services.get('document')!.getRecent(userId, 50),
          this.config.services.get('calendar')!.getEvents(userId),
          this.config.services.get('task')!.getAssigned(userId)
        ]);

        res.json({
          profile,
          workspace: {
            projects: projects.map(this.enrichProject),
            teams: teams.map(this.enrichTeam),
            documents,
            calendar,
            tasks: this.organizeTasks(tasks)
          }
        });
      } catch (error) {
        console.error('Workspace load error:', error);
        res.status(500).json({ error: 'Failed to load workspace' });
      }
    });
  }

  private setupDataLoaders(): void {
    // User loader with batching
    this.dataLoaders.set('user', new DataLoader(async (userIds: string[]) => {
      const users = await this.config.services.get('user')!.getUsers(userIds);
      return userIds.map(id => users.find(u => u.id === id));
    }));

    // Project loader with caching
    this.dataLoaders.set('project', new DataLoader(
      async (projectIds: string[]) => {
        const projects = await this.config.services.get('project')!
          .getProjects(projectIds);
        return projectIds.map(id => projects.find(p => p.id === id));
      },
      {
        cache: true,
        cacheKeyFn: (key) => `project:${key}`
      }
    ));
  }

  private buildWebSchema(): GraphQLSchema {
    return buildSchema(`
      type User {
        id: ID!
        name: String!
        email: String!
        avatar: String
        role: String!
        teams: [Team!]!
        projects: [Project!]!
      }

      type Team {
        id: ID!
        name: String!
        description: String
        members: [User!]!
        projects: [Project!]!
      }

      type Project {
        id: ID!
        name: String!
        description: String
        status: ProjectStatus!
        team: Team!
        tasks: [Task!]!
        documents: [Document!]!
      }

      type Task {
        id: ID!
        title: String!
        description: String
        status: TaskStatus!
        assignee: User
        project: Project!
        dueDate: String
        priority: Priority!
      }

      type Document {
        id: ID!
        title: String!
        content: String!
        author: User!
        project: Project
        createdAt: String!
        updatedAt: String!
      }

      enum ProjectStatus {
        PLANNING
        IN_PROGRESS
        REVIEW
        COMPLETED
        ARCHIVED
      }

      enum TaskStatus {
        TODO
        IN_PROGRESS
        BLOCKED
        REVIEW
        DONE
      }

      enum Priority {
        LOW
        MEDIUM
        HIGH
        CRITICAL
      }

      type Query {
        me: User!
        user(id: ID!): User
        team(id: ID!): Team
        project(id: ID!): Project
        task(id: ID!): Task
        document(id: ID!): Document
        
        myTeams: [Team!]!
        myProjects: [Project!]!
        myTasks(status: TaskStatus): [Task!]!
        
        searchDocuments(query: String!): [Document!]!
        searchUsers(query: String!): [User!]!
      }

      type Mutation {
        updateProfile(input: UpdateProfileInput!): User!
        createProject(input: CreateProjectInput!): Project!
        updateTask(id: ID!, input: UpdateTaskInput!): Task!
        createDocument(input: CreateDocumentInput!): Document!
      }

      input UpdateProfileInput {
        name: String
        avatar: String
      }

      input CreateProjectInput {
        name: String!
        description: String
        teamId: ID!
      }

      input UpdateTaskInput {
        title: String
        description: String
        status: TaskStatus
        assigneeId: ID
        dueDate: String
        priority: Priority
      }

      input CreateDocumentInput {
        title: String!
        content: String!
        projectId: ID
      }
    `);
  }

  private transformStatsForWeb(stats: any): any {
    // Transform service data for web presentation
    return {
      totalProjects: stats.projects.total,
      activeProjects: stats.projects.active,
      completedTasks: stats.tasks.completed,
      pendingTasks: stats.tasks.pending,
      teamSize: stats.team.size,
      lastActivity: stats.activity.last
    };
  }

  private transformActivityForWeb(activity: any): any {
    // Format activity for web display
    return {
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: new Date(activity.timestamp).toLocaleString(),
      user: {
        id: activity.userId,
        name: activity.userName,
        avatar: activity.userAvatar
      }
    };
  }

  private getOptimizedImageUrl(url: string, client: string): string {
    // Return CDN URL with client-specific optimization
    const params = {
      web: 'w=800&q=85',
      mobile: 'w=400&q=70',
      desktop: 'w=1200&q=90'
    };
    
    return `${process.env.CDN_URL}/${url}?${params[client]}`;
  }

  private async processOfflineChanges(changes: any[]): Promise<any[]> {
    const results = [];
    
    for (const change of changes) {
      try {
        const result = await this.applyChange(change);
        results.push({ id: change.id, success: true, result });
      } catch (error: any) {
        results.push({ 
          id: change.id, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  private async applyChange(change: any): Promise<any> {
    const service = this.config.services.get(change.service);
    if (!service) {
      throw new Error(`Unknown service: ${change.service}`);
    }
    
    return await service[change.method](...change.args);
  }

  private async getUpdatesSince(
    timestamp: string,
    userId: string
  ): Promise<any> {
    // Get all updates since the given timestamp
    const updates = await Promise.all([
      this.config.services.get('notification')!
        .getNotificationsSince(userId, timestamp),
      this.config.services.get('activity')!
        .getActivitiesSince(userId, timestamp),
      this.config.services.get('message')!
        .getMessagesSince(userId, timestamp)
    ]);
    
    return {
      notifications: updates[0],
      activities: updates[1],
      messages: updates[2]
    };
  }

  private enrichProject(project: any): any {
    return {
      ...project,
      progress: this.calculateProjectProgress(project),
      health: this.assessProjectHealth(project),
      nextMilestone: this.getNextMilestone(project)
    };
  }

  private enrichTeam(team: any): any {
    return {
      ...team,
      availability: this.calculateTeamAvailability(team),
      workload: this.calculateTeamWorkload(team),
      performance: this.calculateTeamPerformance(team)
    };
  }

  private organizeTasks(tasks: any[]): any {
    return {
      today: tasks.filter(t => this.isDueToday(t)),
      thisWeek: tasks.filter(t => this.isDueThisWeek(t)),
      overdue: tasks.filter(t => this.isOverdue(t)),
      upcoming: tasks.filter(t => this.isUpcoming(t)),
      byPriority: this.groupByPriority(tasks),
      byProject: this.groupByProject(tasks)
    };
  }

  private calculateProjectProgress(project: any): number {
    const total = project.tasks.length;
    const completed = project.tasks.filter(
      (t: any) => t.status === 'DONE'
    ).length;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private assessProjectHealth(project: any): string {
    // Assess project health based on various metrics
    const overdueTasksRatio = project.tasks.filter(
      (t: any) => this.isOverdue(t)
    ).length / project.tasks.length;
    
    if (overdueTasksRatio > 0.3) return 'critical';
    if (overdueTasksRatio > 0.1) return 'warning';
    return 'healthy';
  }

  private getNextMilestone(project: any): any {
    return project.milestones
      .filter((m: any) => !m.completed)
      .sort((a: any, b: any) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )[0];
  }

  private calculateTeamAvailability(team: any): number {
    // Calculate team availability percentage
    const totalCapacity = team.members.length * 40; // 40 hours per week
    const allocatedHours = team.members.reduce(
      (sum: number, member: any) => sum + member.allocatedHours,
      0
    );
    return ((totalCapacity - allocatedHours) / totalCapacity) * 100;
  }

  private calculateTeamWorkload(team: any): any {
    return team.members.map((member: any) => ({
      userId: member.id,
      name: member.name,
      tasks: member.assignedTasks,
      hours: member.allocatedHours,
      capacity: member.capacity
    }));
  }

  private calculateTeamPerformance(team: any): any {
    return {
      velocity: team.metrics.velocity,
      efficiency: team.metrics.efficiency,
      quality: team.metrics.quality
    };
  }

  private isDueToday(task: any): boolean {
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    return dueDate.toDateString() === today.toDateString();
  }

  private isDueThisWeek(task: any): boolean {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dueDate = new Date(task.dueDate);
    return dueDate >= now && dueDate <= weekEnd;
  }

  private isOverdue(task: any): boolean {
    return new Date(task.dueDate) < new Date() && 
           task.status !== 'DONE';
  }

  private isUpcoming(task: any): boolean {
    const dueDate = new Date(task.dueDate);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate > weekFromNow;
  }

  private groupByPriority(tasks: any[]): any {
    return {
      critical: tasks.filter(t => t.priority === 'CRITICAL'),
      high: tasks.filter(t => t.priority === 'HIGH'),
      medium: tasks.filter(t => t.priority === 'MEDIUM'),
      low: tasks.filter(t => t.priority === 'LOW')
    };
  }

  private groupByProject(tasks: any[]): any {
    return tasks.reduce((groups, task) => {
      const projectId = task.projectId;
      if (!groups[projectId]) {
        groups[projectId] = [];
      }
      groups[projectId].push(task);
      return groups;
    }, {});
  }

  public getRouter(): Router {
    return this.router;
  }
}
```

## Monitoring and Analytics

### Metrics Collection
```typescript
// src/gateway/monitoring/MetricsCollector.ts
import { Request, Response, NextFunction } from 'express';
import * as promClient from 'prom-client';

export class MetricsCollector {
  private register: promClient.Registry;
  private httpDuration: promClient.Histogram;
  private httpRequests: promClient.Counter;
  private httpErrors: promClient.Counter;
  private activeConnections: promClient.Gauge;
  private serviceLatency: promClient.Histogram;
  private cacheHits: promClient.Counter;
  private cacheMisses: promClient.Counter;

  constructor(config: MonitoringConfig) {
    this.register = new promClient.Registry();
    
    // Default metrics
    promClient.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'gateway_'
    });

    // HTTP metrics
    this.httpDuration = new promClient.Histogram({
      name: 'gateway_http_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });
    this.register.registerMetric(this.httpDuration);

    this.httpRequests = new promClient.Counter({
      name: 'gateway_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    this.register.registerMetric(this.httpRequests);

    this.httpErrors = new promClient.Counter({
      name: 'gateway_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'error_type']
    });
    this.register.registerMetric(this.httpErrors);

    this.activeConnections = new promClient.Gauge({
      name: 'gateway_active_connections',
      help: 'Number of active connections'
    });
    this.register.registerMetric(this.activeConnections);

    // Service metrics
    this.serviceLatency = new promClient.Histogram({
      name: 'gateway_service_latency_seconds',
      help: 'Latency of service calls',
      labelNames: ['service', 'method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });
    this.register.registerMetric(this.serviceLatency);

    // Cache metrics
    this.cacheHits = new promClient.Counter({
      name: 'gateway_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheHits);

    this.cacheMisses = new promClient.Counter({
      name: 'gateway_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheMisses);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      // Increment active connections
      this.activeConnections.inc();

      // Capture response
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        
        // Record metrics
        this.httpDuration.observe(
          { 
            method: req.method, 
            route, 
            status_code: res.statusCode 
          },
          duration
        );
        
        this.httpRequests.inc({
          method: req.method,
          route,
          status_code: res.statusCode
        });

        // Decrement active connections
        this.activeConnections.dec();
      });

      next();
    };
  }

  recordServiceCall(
    service: string,
    method: string,
    status: number,
    duration: number
  ): void {
    this.serviceLatency.observe(
      { service, method, status: status.toString() },
      duration / 1000
    );
  }

  recordError(service: string, error: string): void {
    this.httpErrors.inc({
      method: 'PROXY',
      route: service,
      error_type: error
    });
  }

  recordCacheHit(cacheName: string): void {
    this.cacheHits.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName: string): void {
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  getMetrics(): string {
    return this.register.metrics();
  }

  async getMetricsAsJSON(): Promise<any> {
    return this.register.getMetricsAsJSON();
  }
}
```

## Production Deployment

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY config ./config

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: gateway
        image: api-gateway:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: production
        - name: REDIS_HOST
          value: redis-service
        - name: CONSUL_HOST
          value: consul-service
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: gateway
spec:
  selector:
    app: api-gateway
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Best Practices

### 1. Security Guidelines
```typescript
// Always validate and sanitize inputs
// Implement proper authentication and authorization
// Use HTTPS for all communications
// Implement rate limiting and DDoS protection
// Regular security audits and updates
```

### 2. Performance Optimization
```typescript
// Use caching strategically
// Implement circuit breakers for fault tolerance
// Optimize payload sizes
// Use compression for responses
// Implement request/response streaming for large data
```

### 3. Monitoring and Observability
```typescript
// Comprehensive logging with correlation IDs
// Distributed tracing for request flow
// Real-time metrics and alerting
// Health checks and readiness probes
// Performance profiling and optimization
```

This comprehensive API Gateway Patterns document provides:
- Complete gateway implementation with Express
- Authentication and authorization mechanisms
- Rate limiting and circuit breaker patterns
- Request/response transformation
- Service discovery and registry
- Backend for Frontend (BFF) implementation
- Monitoring and analytics
- Production deployment configurations
- Security and performance best practices

The implementation demonstrates enterprise-grade API gateway patterns with proper error handling, scalability, and observability.