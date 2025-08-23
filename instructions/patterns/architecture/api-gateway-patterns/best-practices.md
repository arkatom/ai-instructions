# Best Practices & Guidelines

> 🎯 **目的**: API Gateway開発・運用における実証済みベストプラクティスと設計指針
> 
> 📊 **対象**: セキュリティ、パフォーマンス、運用、アーキテクチャ設計
> 
> ⚡ **特徴**: 実戦で培われた知見、アンチパターン回避、品質保証

## Security Best Practices

### 1. Authentication & Authorization

```typescript
// ✅ Secure Implementation
class SecureAuthMiddleware {
  private readonly tokenBlacklist = new Set<string>();
  private readonly rateLimiter = new Map<string, { count: number; lastReset: number }>();

  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract and validate token
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Check token blacklist
        if (this.tokenBlacklist.has(token)) {
          return res.status(401).json({ error: 'Token revoked' });
        }

        // Rate limiting per user
        const userId = this.extractUserId(token);
        if (!this.checkRateLimit(userId)) {
          return res.status(429).json({ error: 'Rate limit exceeded' });
        }

        // Verify token signature and expiration
        const user = await this.verifyToken(token);
        
        // Additional security checks
        if (!this.isUserActive(user)) {
          return res.status(403).json({ error: 'Account inactive' });
        }

        // Audit logging
        this.logAccess(user, req);

        req.user = user;
        next();
      } catch (error) {
        this.logSecurityEvent('auth_failure', { error: error.message, ip: req.ip });
        res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }

  private extractToken(req: Request): string | null {
    // Multiple token sources with priority
    return req.headers.authorization?.replace('Bearer ', '') ||
           req.cookies?.access_token ||
           req.query.token as string ||
           null;
  }

  private checkRateLimit(userId: string): boolean {
    const limit = this.rateLimiter.get(userId);
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    if (!limit || now - limit.lastReset > windowMs) {
      this.rateLimiter.set(userId, { count: 1, lastReset: now });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }
}

// ❌ Insecure Anti-patterns
class InsecureAuth {
  // Never do this
  authenticate() {
    return (req: Request, res: Response, next: NextFunction) => {
      const token = req.headers.authorization;
      if (token) {
        // Missing validation, rate limiting, logging
        req.user = { id: 'user' }; // Trusting without verification
        next();
      } else {
        res.status(401).send('Unauthorized');
      }
    };
  }
}
```

### 2. Input Validation & Sanitization

```typescript
// ✅ Comprehensive Validation
import Joi from 'joi';
import xss from 'xss';
import validator from 'validator';

class InputValidator {
  validateRequest(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate body structure
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Sanitize input
      req.body = this.sanitizeObject(value);
      
      // Size limits
      if (JSON.stringify(req.body).length > 1048576) { // 1MB
        return res.status(413).json({ error: 'Payload too large' });
      }

      next();
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Validate key names
        if (validator.isAlphanumeric(key.replace(/[_-]/g, ''))) {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  private sanitizeString(str: string): string {
    return xss(validator.escape(str.trim()));
  }

  // SQL Injection Prevention
  static sanitizeForSQL(value: string): string {
    return value.replace(/['";\\]/g, '\\$&');
  }

  // Path Traversal Prevention
  static sanitizePath(path: string): string {
    return path.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
  }
}

// Usage schemas
const userCreateSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  age: Joi.number().min(13).max(120).optional(),
  tags: Joi.array().items(Joi.string().max(20)).max(10).optional()
});

const paymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).max(10000).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP').required(),
  description: Joi.string().max(255).optional()
});
```

### 3. HTTPS & Security Headers

```typescript
// ✅ Security Headers Implementation
class SecurityMiddleware {
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // HTTPS enforcement
      if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(301, `https://${req.header('host')}${req.url}`);
      }

      // Security headers
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Content Security Policy
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'"
      ].join('; '));

      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }
}
```

## Performance Best Practices

### 1. Caching Strategies

```typescript
// ✅ Multi-layer Caching
class PerformantCacheManager {
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    // Memory cache cleanup
    setInterval(() => this.cleanupMemoryCache(), 60000);
  }

  async get(key: string): Promise<any> {
    // L1: Memory cache (fastest)
    const memResult = this.getFromMemory(key);
    if (memResult !== null) {
      return memResult;
    }

    // L2: Redis cache
    try {
      const redisResult = await this.redis.get(key);
      if (redisResult) {
        const data = JSON.parse(redisResult);
        
        // Backfill memory cache with shorter TTL
        this.setInMemory(key, data, 300); // 5 minutes
        
        return data;
      }
    } catch (error) {
      console.warn('Redis cache miss:', error.message);
    }

    return null;
  }

  async set(key: string, data: any, ttl: number = 3600): Promise<void> {
    // Set in memory cache
    this.setInMemory(key, data, Math.min(ttl, 1800)); // Max 30 minutes in memory

    // Set in Redis
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  private getFromMemory(key: string): any {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.memoryCache.delete(key);
    return null;
  }

  private setInMemory(key: string, data: any, ttl: number): void {
    // Memory usage protection
    if (this.memoryCache.size > 10000) {
      this.cleanupMemoryCache();
    }

    this.memoryCache.set(key, {
      data,
      expires: Date.now() + (ttl * 1000)
    });
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Cache middleware with smart invalidation
  middleware(options: CacheOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, options);
      const cached = await this.get(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${options.ttl}`);
        return res.json(cached);
      }

      // Intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache successful responses
        if (res.statusCode === 200) {
          this.set(cacheKey, data, options.ttl).catch(console.error);
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  private generateCacheKey(req: Request, options: CacheOptions): string {
    const parts = [
      options.prefix || 'api',
      req.path,
      req.user?.id || 'anonymous',
      JSON.stringify(req.query)
    ];
    
    return crypto.createHash('md5').update(parts.join(':')).digest('hex');
  }
}

interface CacheOptions {
  ttl: number;
  prefix?: string;
  varyBy?: string[];
}
```

### 2. Connection Pooling & Resource Management

```typescript
// ✅ Efficient Resource Management
class ConnectionManager {
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;
  private redis: Redis;

  constructor() {
    // HTTP connection pooling
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 100,
      maxFreeSockets: 10,
      timeout: 60000
    });

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 100,
      maxFreeSockets: 10,
      timeout: 60000
    });

    // Redis connection pooling
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      keepAlive: 30000,
      family: 4,
      // Connection pool settings
      maxLoadingTimeout: 5000,
      maxMemoryPolicy: 'allkeys-lru'
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  async makeHttpRequest(url: string, options: any = {}): Promise<any> {
    const agent = url.startsWith('https:') ? this.httpsAgent : this.httpAgent;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, options.timeout || 30000);

      const req = (url.startsWith('https:') ? https : http).request(url, {
        ...options,
        agent
      }, (res) => {
        clearTimeout(timeout);
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  private async cleanup(): Promise<void> {
    console.log('Starting graceful shutdown...');
    
    // Close HTTP agents
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    
    // Close Redis connections
    await this.redis.quit();
    
    console.log('Cleanup completed');
    process.exit(0);
  }
}
```

### 3. Request/Response Optimization

```typescript
// ✅ Response Optimization
class ResponseOptimizer {
  static compression() {
    return compression({
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Compress everything else
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
      windowBits: 15,
      memLevel: 8,
      strategy: zlib.constants.Z_DEFAULT_STRATEGY
    });
  }

  static payloadSizeLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      const limit = this.getRouteSizeLimit(req.path);
      
      express.json({ 
        limit,
        verify: (req: any, res, buf) => {
          req.rawBody = buf;
        }
      })(req, res, next);
    };
  }

  private static getRouteSizeLimit(path: string): string {
    if (path.includes('/upload')) return '50mb';
    if (path.includes('/bulk')) return '10mb';
    return '1mb';
  }

  static responseTransform() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(data: any) {
        // Add response metadata
        const response = {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.correlationId,
            version: process.env.API_VERSION || '1.0.0'
          }
        };

        // Remove sensitive fields
        const cleaned = this.removeSensitiveData(response);
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Response-Time', Date.now() - req.startTime);
        
        return originalJson.call(this, cleaned);
      }.bind(this);

      next();
    };
  }

  private static removeSensitiveData(obj: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeSensitiveData(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          cleaned[key] = this.removeSensitiveData(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
}
```

## Reliability Best Practices

### 1. Error Handling & Recovery

```typescript
// ✅ Comprehensive Error Handling
class ErrorHandler {
  static globalErrorHandler() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      // Log error details
      console.error('Global error:', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // Determine error type and response
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.details
        });
      }

      if (error instanceof AuthenticationError) {
        return res.status(401).json({
          error: 'Authentication Error',
          message: 'Invalid credentials'
        });
      }

      if (error instanceof AuthorizationError) {
        return res.status(403).json({
          error: 'Authorization Error',
          message: 'Insufficient permissions'
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }

      if (error instanceof RateLimitError) {
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many requests',
          retryAfter: error.retryAfter
        });
      }

      // Default to 500 for unknown errors
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred'
          : error.message,
        correlationId: req.correlationId
      });
    };
  }

  static asyncWrapper(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static timeoutHandler(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({
            error: 'Gateway Timeout',
            message: 'Request timeout',
            timeout: timeoutMs
          });
        }
      }, timeoutMs);

      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    };
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public details: any[] = []) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### 2. Health Checks & Monitoring

```typescript
// ✅ Comprehensive Health Checks
class HealthCheckManager {
  private checks: Map<string, HealthCheck> = new Map();

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Database connectivity
    this.registerCheck('database', {
      check: async () => {
        try {
          await this.queryDatabase('SELECT 1');
          return { status: 'healthy', latency: 5 };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      },
      timeout: 5000,
      critical: true
    });

    // Redis connectivity
    this.registerCheck('redis', {
      check: async () => {
        try {
          const start = Date.now();
          await this.redis.ping();
          return { 
            status: 'healthy', 
            latency: Date.now() - start 
          };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      },
      timeout: 3000,
      critical: true
    });

    // External service dependencies
    this.registerCheck('user-service', {
      check: async () => {
        try {
          const response = await fetch('http://user-service/health', {
            timeout: 3000
          });
          return { 
            status: response.ok ? 'healthy' : 'unhealthy',
            statusCode: response.status
          };
        } catch (error) {
          return { status: 'unhealthy', error: error.message };
        }
      },
      timeout: 5000,
      critical: false
    });

    // Memory usage
    this.registerCheck('memory', {
      check: async () => {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        
        const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        
        return {
          status: heapUsagePercent > 90 ? 'unhealthy' : 'healthy',
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          usagePercent: `${heapUsagePercent.toFixed(1)}%`
        };
      },
      timeout: 1000,
      critical: false
    });

    // Disk space
    this.registerCheck('disk', {
      check: async () => {
        try {
          const stats = await fs.promises.statfs('/');
          const total = stats.bavail * stats.bsize;
          const free = stats.bfree * stats.bsize;
          const usedPercent = ((total - free) / total) * 100;
          
          return {
            status: usedPercent > 90 ? 'unhealthy' : 'healthy',
            usedPercent: `${usedPercent.toFixed(1)}%`,
            free: `${Math.round(free / 1024 / 1024 / 1024)}GB`
          };
        } catch (error) {
          return { status: 'unknown', error: error.message };
        }
      },
      timeout: 2000,
      critical: false
    });
  }

  registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  async getHealth(): Promise<HealthReport> {
    const results: Record<string, any> = {};
    const checks = Array.from(this.checks.entries());
    
    // Run all checks in parallel
    const checkPromises = checks.map(async ([name, check]) => {
      try {
        const promise = check.check();
        const result = await (check.timeout 
          ? this.withTimeout(promise, check.timeout)
          : promise
        );
        
        results[name] = {
          ...result,
          critical: check.critical,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          critical: check.critical,
          timestamp: new Date().toISOString()
        };
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    const criticalFailures = Object.values(results).filter(
      r => r.critical && r.status === 'unhealthy'
    );
    
    const overallStatus = criticalFailures.length > 0 ? 'unhealthy' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      checks: results
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  middleware() {
    return async (req: Request, res: Response) => {
      try {
        const health = await this.getHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          error: error.message
        });
      }
    };
  }
}

interface HealthCheck {
  check: () => Promise<any>;
  timeout?: number;
  critical: boolean;
}

interface HealthReport {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, any>;
}
```

## Operational Best Practices

### 1. Graceful Shutdown

```typescript
// ✅ Graceful Shutdown Implementation
class GracefulShutdown {
  private server: http.Server;
  private connections = new Set<net.Socket>();
  private isShuttingDown = false;

  constructor(app: Express) {
    this.server = http.createServer(app);
    this.setupConnectionTracking();
    this.setupSignalHandlers();
  }

  private setupConnectionTracking(): void {
    this.server.on('connection', (connection) => {
      this.connections.add(connection);
      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGUSR2', () => this.shutdown('SIGUSR2')); // nodemon restart
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.shutdown('UNHANDLED_REJECTION');
    });
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`Received ${signal}, starting graceful shutdown...`);

    const shutdownTimeout = setTimeout(() => {
      console.error('Shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout

    try {
      // 1. Stop accepting new requests
      console.log('Stopping server...');
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('Server closed');
          resolve();
        });
      });

      // 2. Close existing connections gracefully
      console.log('Closing existing connections...');
      for (const connection of this.connections) {
        connection.destroy();
      }

      // 3. Close database connections
      console.log('Closing database connections...');
      await this.closeDatabaseConnections();

      // 4. Close Redis connections
      console.log('Closing Redis connections...');
      await this.closeRedisConnections();

      // 5. Complete in-flight operations
      console.log('Waiting for in-flight operations...');
      await this.waitForInflightOperations();

      clearTimeout(shutdownTimeout);
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  private async closeDatabaseConnections(): Promise<void> {
    // Implementation depends on your database client
    // Example for PostgreSQL with pg-pool:
    // await pool.end();
  }

  private async closeRedisConnections(): Promise<void> {
    // await redis.quit();
  }

  private async waitForInflightOperations(): Promise<void> {
    // Wait for any background jobs, pending requests, etc.
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  listen(port: number): void {
    this.server.listen(port, () => {
      console.log(`API Gateway listening on port ${port}`);
    });
  }
}
```

### 2. Configuration Management

```typescript
// ✅ Environment-based Configuration
class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): Config {
    return {
      server: {
        port: parseInt(process.env.PORT || '8080'),
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development'
      },
      
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'gateway',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
      },

      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      },

      auth: {
        jwtSecret: process.env.JWT_SECRET || '',
        jwtExpiry: process.env.JWT_EXPIRY || '1h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
      },

      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
      },

      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
        jaegerEndpoint: process.env.JAEGER_ENDPOINT,
        logLevel: process.env.LOG_LEVEL || 'info'
      },

      external: {
        userServiceUrl: process.env.USER_SERVICE_URL || 'http://user-service:8080',
        paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8080',
        notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8080'
      }
    };
  }

  private validateConfig(): void {
    const requiredFields = [
      'JWT_SECRET',
      'DB_PASSWORD'
    ];

    const missing = requiredFields.filter(field => !process.env[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate data types and ranges
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      throw new Error('PORT must be between 1 and 65535');
    }

    if (this.config.auth.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (this.config.auth.bcryptRounds < 10 || this.config.auth.bcryptRounds > 15) {
      throw new Error('BCRYPT_ROUNDS must be between 10 and 15');
    }
  }

  get(): Config {
    return this.config;
  }

  isDevelopment(): boolean {
    return this.config.server.env === 'development';
  }

  isProduction(): boolean {
    return this.config.server.env === 'production';
  }

  isTest(): boolean {
    return this.config.server.env === 'test';
  }
}

interface Config {
  server: {
    port: number;
    host: string;
    env: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolSize: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiry: string;
    bcryptRounds: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsPort: number;
    jaegerEndpoint?: string;
    logLevel: string;
  };
  external: {
    userServiceUrl: string;
    paymentServiceUrl: string;
    notificationServiceUrl: string;
  };
}
```

## Architecture Guidelines

### 1. Single Responsibility Principle

```typescript
// ✅ Well-separated concerns
class UserService {
  // Only handles user-related operations
  async getUser(id: string): Promise<User> { /* ... */ }
  async updateUser(id: string, data: Partial<User>): Promise<User> { /* ... */ }
  async deleteUser(id: string): Promise<void> { /* ... */ }
}

class AuthenticationService {
  // Only handles authentication
  async login(credentials: LoginCredentials): Promise<AuthResult> { /* ... */ }
  async logout(token: string): Promise<void> { /* ... */ }
  async refreshToken(token: string): Promise<AuthResult> { /* ... */ }
}

class AuthorizationService {
  // Only handles authorization
  async hasPermission(user: User, resource: string, action: string): Promise<boolean> { /* ... */ }
  async getRoles(user: User): Promise<Role[]> { /* ... */ }
}

// ❌ Mixed responsibilities (anti-pattern)
class UserController {
  async getUser(req: Request, res: Response) {
    // Authentication logic (should be middleware)
    const token = req.headers.authorization;
    if (!token) return res.status(401).send('Unauthorized');
    
    // Authorization logic (should be separate service)
    const user = this.decodeToken(token);
    if (user.role !== 'admin') return res.status(403).send('Forbidden');
    
    // Business logic (should be in service)
    const userData = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    
    // Transformation logic (should be separate)
    const transformed = this.transformUser(userData);
    
    // Logging (should be middleware)
    console.log(`User ${user.id} accessed user ${req.params.id}`);
    
    res.json(transformed);
  }
}
```

### 2. Fail-Safe Defaults

```typescript
// ✅ Secure and safe defaults
class GatewayDefaults {
  static readonly RATE_LIMITS = {
    DEFAULT: { requests: 100, window: 60000 }, // Conservative default
    AUTHENTICATION: { requests: 5, window: 300000 }, // Strict for auth
    ANONYMOUS: { requests: 10, window: 60000 } // Very limited for anonymous
  };

  static readonly TIMEOUTS = {
    REQUEST: 30000, // 30 seconds
    DATABASE: 10000, // 10 seconds
    EXTERNAL_SERVICE: 15000, // 15 seconds
    HEALTH_CHECK: 5000 // 5 seconds
  };

  static readonly SECURITY = {
    JWT_EXPIRY: '15m', // Short-lived tokens
    REFRESH_TOKEN_EXPIRY: '7d',
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes
  };

  static readonly CACHE = {
    DEFAULT_TTL: 300, // 5 minutes
    MAX_TTL: 3600, // 1 hour
    MAX_SIZE: 1000 // items
  };
}

// Default to deny access
class PermissionChecker {
  checkPermission(user: User, resource: string, action: string): boolean {
    try {
      // Explicit permission checks
      return this.hasExplicitPermission(user, resource, action);
    } catch (error) {
      // Default to deny on any error
      console.error('Permission check failed:', error);
      return false;
    }
  }
}
```

### 3. Circuit Breaker Pattern

```typescript
// ✅ Implement circuit breakers for external dependencies
class ServiceClient {
  private circuitBreaker: CircuitBreaker;

  constructor(serviceName: string, baseUrl: string) {
    this.circuitBreaker = new CircuitBreaker(async (path: string, options: any) => {
      const response = await fetch(`${baseUrl}${path}`, {
        timeout: 10000,
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }, {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 10000
    });

    this.circuitBreaker.fallback(() => this.getFallbackResponse());
    this.circuitBreaker.on('open', () => console.warn(`Circuit breaker opened for ${serviceName}`));
    this.circuitBreaker.on('halfOpen', () => console.info(`Circuit breaker half-open for ${serviceName}`));
    this.circuitBreaker.on('close', () => console.info(`Circuit breaker closed for ${serviceName}`));
  }

  async get(path: string): Promise<any> {
    return this.circuitBreaker.fire(path, { method: 'GET' });
  }

  async post(path: string, data: any): Promise<any> {
    return this.circuitBreaker.fire(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  private getFallbackResponse(): any {
    return {
      error: 'Service temporarily unavailable',
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }
}
```

## Common Anti-Patterns to Avoid

### ❌ 1. God Object Gateway

```typescript
// Don't create a monolithic gateway that does everything
class MonolithicGateway {
  // Handles authentication, routing, transformation, logging, caching, etc.
  // This violates SRP and becomes unmaintainable
}
```

### ❌ 2. Synchronous Blocking Operations

```typescript
// Don't block the event loop
app.get('/users', (req, res) => {
  const data = fs.readFileSync('large-file.json'); // BLOCKING!
  res.json(JSON.parse(data));
});
```

### ❌ 3. Missing Error Boundaries

```typescript
// Don't let errors crash the entire gateway
app.get('/api/users', async (req, res) => {
  const users = await userService.getUsers(); // Could throw
  res.json(users); // App crashes if above throws
});
```

### ❌ 4. Hardcoded Configuration

```typescript
// Don't hardcode values
const config = {
  port: 8080, // Should be configurable
  database: 'localhost:5432', // Should be from env
  jwtSecret: 'secret123' // NEVER hardcode secrets!
};
```

### ❌ 5. No Request Correlation

```typescript
// Don't lose request context across services
app.use((req, res, next) => {
  // No correlation ID, making debugging impossible
  next();
});
```

## Quality Assurance Checklist

### Security Checklist
- [ ] All inputs validated and sanitized
- [ ] Authentication implemented on all protected routes
- [ ] Authorization checks for resource access
- [ ] Rate limiting configured appropriately
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] Secrets managed securely
- [ ] Regular security audits performed

### Performance Checklist
- [ ] Response caching implemented
- [ ] Connection pooling configured
- [ ] Request/response compression enabled
- [ ] Database queries optimized
- [ ] Memory usage monitored
- [ ] Load testing performed
- [ ] CDN integration for static assets

### Reliability Checklist
- [ ] Health checks implemented
- [ ] Circuit breakers for external services
- [ ] Graceful error handling
- [ ] Timeout configurations set
- [ ] Retry mechanisms implemented
- [ ] Graceful shutdown handling
- [ ] Monitoring and alerting configured

### Operational Checklist
- [ ] Comprehensive logging implemented
- [ ] Metrics collection enabled
- [ ] Distributed tracing configured
- [ ] Infrastructure as Code used
- [ ] Automated deployment pipeline
- [ ] Backup and recovery procedures
- [ ] Documentation maintained

This comprehensive guide provides battle-tested patterns and practices for building production-ready API Gateways that are secure, performant, and maintainable.