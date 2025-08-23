# Gateway Implementation

> 🎯 **目的**: API Gatewayの核となるサービス実装
> 
> 📊 **対象**: Express.js ベースのゲートウェイ実装、プロキシ設定、ミドルウェア統合
> 
> ⚡ **特徴**: 実用的なコード例、エラーハンドリング、パフォーマンス考慮

## Core Gateway Service

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
  auth?: AuthConfig;
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

## Gateway Bootstrap

```typescript
// src/gateway/bootstrap.ts
import { ApiGateway, GatewayConfig } from './core/ApiGateway';
import { ServiceRegistry } from './registry/ServiceRegistry';
import { ConfigLoader } from './config/ConfigLoader';
import { Logger } from './utils/Logger';

export class GatewayBootstrap {
  private logger = new Logger('GatewayBootstrap');
  
  async start(): Promise<void> {
    try {
      // Load configuration
      const config = await this.loadConfiguration();
      
      // Initialize service registry
      const serviceRegistry = new ServiceRegistry(config.serviceRegistry);
      await serviceRegistry.initialize();
      
      // Create and start gateway
      const gateway = new ApiGateway(config, serviceRegistry);
      gateway.start();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown(gateway, serviceRegistry);
      
      this.logger.info('API Gateway started successfully');
    } catch (error) {
      this.logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }
  
  private async loadConfiguration(): Promise<GatewayConfig> {
    const configLoader = new ConfigLoader();
    
    // Load from multiple sources
    const config = await configLoader
      .loadFromFile('./config/gateway.yaml')
      .loadFromEnvironment()
      .loadFromConsul() // Optional: Service mesh integration
      .validate()
      .build();
    
    this.logger.info('Configuration loaded successfully');
    return config;
  }
  
  private setupGracefulShutdown(
    gateway: ApiGateway, 
    serviceRegistry: ServiceRegistry
  ): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        // Stop accepting new requests
        await gateway.stop();
        
        // Cleanup service registry
        await serviceRegistry.cleanup();
        
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// src/index.ts
import { GatewayBootstrap } from './gateway/bootstrap';

const bootstrap = new GatewayBootstrap();
bootstrap.start();
```

## Configuration Management

```typescript
// src/gateway/config/ConfigLoader.ts
import yaml from 'js-yaml';
import fs from 'fs-extra';
import Joi from 'joi';

export class ConfigLoader {
  private config: Partial<GatewayConfig> = {};
  
  loadFromFile(filePath: string): ConfigLoader {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileConfig = yaml.load(fileContent) as Partial<GatewayConfig>;
      
      this.config = {
        ...this.config,
        ...fileConfig
      };
    } catch (error) {
      console.warn(`Could not load config from ${filePath}:`, error.message);
    }
    
    return this;
  }
  
  loadFromEnvironment(): ConfigLoader {
    const envConfig: Partial<GatewayConfig> = {
      port: parseInt(process.env.GATEWAY_PORT || '8080'),
      monitoring: {
        ...this.config.monitoring,
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090')
      },
      security: {
        ...this.config.security,
        jwt: {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    };
    
    this.config = {
      ...this.config,
      ...envConfig
    };
    
    return this;
  }
  
  async loadFromConsul(): Promise<ConfigLoader> {
    try {
      const consul = require('consul')();
      const result = await consul.kv.get('gateway/config');
      
      if (result) {
        const consulConfig = JSON.parse(result.Value);
        this.config = {
          ...this.config,
          ...consulConfig
        };
      }
    } catch (error) {
      console.warn('Could not load config from Consul:', error.message);
    }
    
    return this;
  }
  
  validate(): ConfigLoader {
    const schema = Joi.object({
      port: Joi.number().port().required(),
      services: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        path: Joi.string().required(),
        target: Joi.string().uri().required(),
        methods: Joi.array().items(Joi.string()).required()
      })).required(),
      middleware: Joi.object().required(),
      security: Joi.object().required(),
      monitoring: Joi.object().required()
    });
    
    const { error } = schema.validate(this.config);
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    
    return this;
  }
  
  build(): GatewayConfig {
    return this.config as GatewayConfig;
  }
}
```

## Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gateway -u 1001

# Change ownership
RUN chown -R gateway:nodejs /app
USER gateway

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  api-gateway:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      - NODE_ENV=production
      - GATEWAY_PORT=8080
      - METRICS_PORT=9090
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=${REDIS_URL}
      - CONSUL_HOST=${CONSUL_HOST}
    volumes:
      - ./config:/app/config:ro
    depends_on:
      - redis
      - consul
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  consul:
    image: consul:1.15
    ports:
      - "8500:8500"
    environment:
      - CONSUL_BIND_INTERFACE=eth0
    restart: unless-stopped

volumes:
  redis_data:
```