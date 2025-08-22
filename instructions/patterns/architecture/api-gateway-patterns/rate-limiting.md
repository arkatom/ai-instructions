# Rate Limiting

> 🎯 **目的**: API Gatewayでのレート制限実装と分散型制限システム
> 
> 📊 **対象**: Token Bucket、Sliding Window、分散レート制限
> 
> ⚡ **特徴**: Redis実装、Lua スクリプト、高精度制限アルゴリズム

## Token Bucket Rate Limiter

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
```

## Distributed Rate Limiter

```typescript
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

## Advanced Rate Limiting Strategies

### Hierarchical Rate Limiting

```typescript
// Multi-tier rate limiting system
export class HierarchicalRateLimiter {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }
  
  async checkMultipleLimits(
    userId: string,
    apiKey: string,
    endpoint: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const checks = [
      // Global rate limit
      this.checkGlobalLimit(),
      
      // Per-user rate limit
      this.checkUserLimit(userId),
      
      // Per-API key rate limit
      this.checkApiKeyLimit(apiKey),
      
      // Per-endpoint rate limit
      this.checkEndpointLimit(endpoint),
      
      // Combined user+endpoint limit
      this.checkUserEndpointLimit(userId, endpoint)
    ];
    
    const results = await Promise.all(checks);
    
    for (let i = 0; i < results.length; i++) {
      if (!results[i].allowed) {
        return {
          allowed: false,
          reason: this.getLimitReason(i, results[i])
        };
      }
    }
    
    return { allowed: true };
  }
  
  private async checkGlobalLimit(): Promise<{ allowed: boolean; current: number }> {
    const result = await this.checkLimit('global', 10000, 60); // 10k/min globally
    return result;
  }
  
  private async checkUserLimit(userId: string): Promise<{ allowed: boolean; current: number }> {
    const result = await this.checkLimit(`user:${userId}`, 100, 60); // 100/min per user
    return result;
  }
  
  private async checkApiKeyLimit(apiKey: string): Promise<{ allowed: boolean; current: number }> {
    const result = await this.checkLimit(`apikey:${apiKey}`, 1000, 60); // 1k/min per API key
    return result;
  }
  
  private async checkEndpointLimit(endpoint: string): Promise<{ allowed: boolean; current: number }> {
    const result = await this.checkLimit(`endpoint:${endpoint}`, 500, 60); // 500/min per endpoint
    return result;
  }
  
  private async checkUserEndpointLimit(userId: string, endpoint: string): Promise<{ allowed: boolean; current: number }> {
    const result = await this.checkLimit(`user:${userId}:endpoint:${endpoint}`, 50, 60); // 50/min per user per endpoint
    return result;
  }
  
  private async checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; current: number }> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds);
    const redisKey = `ratelimit:${key}:${window}`;
    
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    
    return {
      allowed: count <= limit,
      current: count
    };
  }
  
  private getLimitReason(index: number, result: any): string {
    const reasons = [
      'Global rate limit exceeded',
      'Per-user rate limit exceeded',
      'API key rate limit exceeded',
      'Endpoint rate limit exceeded',
      'User-endpoint rate limit exceeded'
    ];
    
    return `${reasons[index]} (${result.current} requests)`;
  }
}
```

### Adaptive Rate Limiting

```typescript
// Dynamic rate limiting based on system load
export class AdaptiveRateLimiter {
  private redis: Redis;
  private baseLimit: number;
  private currentLimit: number;
  private loadMetrics: LoadMetrics;
  
  constructor(baseLimit: number) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
    
    this.baseLimit = baseLimit;
    this.currentLimit = baseLimit;
    this.loadMetrics = new LoadMetrics();
    
    // Adjust limits every 30 seconds
    setInterval(() => this.adjustLimits(), 30000);
  }
  
  private async adjustLimits(): Promise<void> {
    const systemLoad = await this.loadMetrics.getCurrentLoad();
    
    // Adjust based on CPU usage
    let cpuMultiplier = 1.0;
    if (systemLoad.cpu > 80) {
      cpuMultiplier = 0.5; // Reduce by 50% if CPU > 80%
    } else if (systemLoad.cpu > 60) {
      cpuMultiplier = 0.7; // Reduce by 30% if CPU > 60%
    } else if (systemLoad.cpu < 30) {
      cpuMultiplier = 1.2; // Increase by 20% if CPU < 30%
    }
    
    // Adjust based on memory usage
    let memoryMultiplier = 1.0;
    if (systemLoad.memory > 85) {
      memoryMultiplier = 0.6;
    } else if (systemLoad.memory > 70) {
      memoryMultiplier = 0.8;
    }
    
    // Adjust based on response time
    let responseTimeMultiplier = 1.0;
    if (systemLoad.avgResponseTime > 2000) {
      responseTimeMultiplier = 0.7;
    } else if (systemLoad.avgResponseTime > 1000) {
      responseTimeMultiplier = 0.9;
    }
    
    // Calculate new limit
    const multiplier = Math.min(cpuMultiplier, memoryMultiplier, responseTimeMultiplier);
    this.currentLimit = Math.floor(this.baseLimit * multiplier);
    
    // Ensure minimum limit
    this.currentLimit = Math.max(this.currentLimit, Math.floor(this.baseLimit * 0.1));
    
    console.log(`Adjusted rate limit: ${this.currentLimit} (base: ${this.baseLimit}, multiplier: ${multiplier.toFixed(2)})`);
  }
  
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.generateKey(req);
      const allowed = await this.checkLimit(key, this.currentLimit, 60);
      
      res.setHeader('X-RateLimit-Limit', this.currentLimit.toString());
      res.setHeader('X-RateLimit-Adaptive', 'true');
      
      if (!allowed.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Adaptive rate limit exceeded',
          currentLimit: this.currentLimit,
          baseLimit: this.baseLimit
        });
      }
      
      next();
    };
  }
  
  private generateKey(req: Request): string {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
  
  private async checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; current: number }> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds);
    const redisKey = `adaptive:${key}:${window}`;
    
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    
    return {
      allowed: count <= limit,
      current: count
    };
  }
}

class LoadMetrics {
  async getCurrentLoad(): Promise<{
    cpu: number;
    memory: number;
    avgResponseTime: number;
  }> {
    // Implementation would gather actual system metrics
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      avgResponseTime: Math.random() * 3000
    };
  }
}
```

## Rate Limiting Configuration

```yaml
# Rate limiting configuration
rate_limiting:
  default:
    window_ms: 60000      # 1 minute
    max_requests: 100     # 100 requests per minute
    
  tiers:
    free:
      window_ms: 60000
      max_requests: 100
      
    premium:
      window_ms: 60000
      max_requests: 1000
      
    enterprise:
      window_ms: 60000
      max_requests: 10000
      
  endpoints:
    "/api/auth/login":
      window_ms: 300000   # 5 minutes
      max_requests: 5     # 5 login attempts per 5 minutes
      
    "/api/upload":
      window_ms: 60000
      max_requests: 10    # 10 uploads per minute
      
    "/api/search":
      window_ms: 60000
      max_requests: 200   # 200 searches per minute

  adaptive:
    enabled: true
    base_limit: 1000
    adjustment_interval: 30000  # 30 seconds
    
    thresholds:
      cpu:
        high: 80
        medium: 60
        low: 30
      memory:
        high: 85
        medium: 70
      response_time:
        high: 2000
        medium: 1000
```

## Usage Examples

```typescript
// Usage in gateway setup
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  keyGenerator: (req) => {
    // Custom key generation based on user tier
    if (req.user?.tier === 'premium') {
      return `premium:${req.user.id}`;
    }
    return `free:${req.user?.id || req.ip}`;
  }
});

// Apply different limits based on user tier
app.use('/api', (req, res, next) => {
  const config = getRateLimitConfig(req.user?.tier || 'free');
  return rateLimiter.limit(config)(req, res, next);
});

// Hierarchical limiting for sensitive endpoints
const hierarchicalLimiter = new HierarchicalRateLimiter();

app.use('/api/admin', async (req, res, next) => {
  const result = await hierarchicalLimiter.checkMultipleLimits(
    req.user.id,
    req.headers['x-api-key'],
    req.path
  );
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      reason: result.reason
    });
  }
  
  next();
});

function getRateLimitConfig(tier: string): RateLimitConfig {
  const configs = {
    free: { windowMs: 60000, maxRequests: 100 },
    premium: { windowMs: 60000, maxRequests: 1000 },
    enterprise: { windowMs: 60000, maxRequests: 10000 }
  };
  
  return configs[tier] || configs.free;
}
```