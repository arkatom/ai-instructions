# Circuit Breaker Pattern

> 🎯 **目的**: API Gatewayでのサーキットブレーカー実装によるシステム耐障害性向上
> 
> 📊 **対象**: サーキットブレーカー設計、状態管理、フォールバック戦略
> 
> ⚡ **特徴**: 高可用性システム、障害検知と回復、パフォーマンス保護

## Circuit Breaker Core Implementation

```typescript
// src/gateway/middleware/CircuitBreaker.ts
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedResponseTime: number;
  volumeThreshold: number;
}

export interface CircuitBreakerMetrics {
  requests: number;
  failures: number;
  successes: number;
  timeouts: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private metrics: CircuitBreakerMetrics;
  private lastStateChange: number = Date.now();
  private redis: Redis;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig
  ) {
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      averageResponseTime: 0
    };

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    // Load state from Redis for distributed systems
    this.loadState();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (await this.shouldReject()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is ${this.state} for service ${this.serviceName}`
      );
    }

    const startTime = Date.now();
    this.metrics.requests++;

    try {
      const result = await this.executeWithTimeout(operation);
      await this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      await this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error('Operation timeout'));
      }, this.config.expectedResponseTime);

      operation()
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

  private async shouldReject(): Promise<boolean> {
    await this.updateState();

    if (this.state === CircuitBreakerState.OPEN) {
      return true;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Allow limited requests in half-open state
      const recentRequests = await this.getRecentRequestCount();
      return recentRequests >= 3; // Limit to 3 test requests
    }

    return false;
  }

  private async onSuccess(responseTime: number): Promise<void> {
    this.metrics.successes++;
    this.metrics.lastSuccessTime = Date.now();
    this.updateAverageResponseTime(responseTime);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      const successRate = this.metrics.successes / 
        (this.metrics.successes + this.metrics.failures);
      
      if (successRate >= 0.8) { // 80% success rate required
        await this.setState(CircuitBreakerState.CLOSED);
        this.resetMetrics();
      }
    }

    await this.saveState();
  }

  private async onFailure(error: Error, responseTime: number): Promise<void> {
    this.metrics.failures++;
    this.metrics.lastFailureTime = Date.now();
    this.updateAverageResponseTime(responseTime);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      await this.setState(CircuitBreakerState.OPEN);
    } else if (this.state === CircuitBreakerState.CLOSED) {
      const failureRate = this.metrics.failures / this.metrics.requests;
      
      if (this.metrics.requests >= this.config.volumeThreshold &&
          failureRate >= this.config.failureThreshold) {
        await this.setState(CircuitBreakerState.OPEN);
      }
    }

    await this.saveState();
  }

  private async updateState(): Promise<void> {
    const now = Date.now();
    
    if (this.state === CircuitBreakerState.OPEN &&
        now - this.lastStateChange >= this.config.recoveryTimeout) {
      await this.setState(CircuitBreakerState.HALF_OPEN);
      this.resetMetrics();
    }
  }

  private async setState(newState: CircuitBreakerState): Promise<void> {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    console.log(
      `Circuit breaker for ${this.serviceName} changed from ${oldState} to ${newState}`
    );

    await this.saveState();
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.requests;
    this.metrics.averageResponseTime = 
      ((this.metrics.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  private resetMetrics(): void {
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      averageResponseTime: 0
    };
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = await this.redis.get(`circuit-breaker:${this.serviceName}`);
      if (stateData) {
        const parsed = JSON.parse(stateData);
        this.state = parsed.state;
        this.metrics = parsed.metrics;
        this.lastStateChange = parsed.lastStateChange;
      }
    } catch (error) {
      console.warn(`Failed to load circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateData = {
        state: this.state,
        metrics: this.metrics,
        lastStateChange: this.lastStateChange
      };
      
      await this.redis.setex(
        `circuit-breaker:${this.serviceName}`,
        3600, // 1 hour TTL
        JSON.stringify(stateData)
      );
    } catch (error) {
      console.warn(`Failed to save circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  private async getRecentRequestCount(): Promise<number> {
    try {
      const count = await this.redis.get(`circuit-breaker:requests:${this.serviceName}`);
      return parseInt(count || '0');
    } catch (error) {
      return 0;
    }
  }

  // Middleware for Express.js integration
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await this.execute(async () => {
          return new Promise<void>((resolve, reject) => {
            const originalEnd = res.end;
            res.end = function(chunk?: any) {
              if (res.statusCode >= 500) {
                reject(new Error(`Server error: ${res.statusCode}`));
              } else {
                resolve();
              }
              originalEnd.call(this, chunk);
            };
            next();
          });
        });
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: `Service ${this.serviceName} is temporarily unavailable`,
            circuitBreakerState: this.state,
            retryAfter: Math.ceil(
              (this.config.recoveryTimeout - (Date.now() - this.lastStateChange)) / 1000
            )
          });
        }
        
        next(error);
      }
    };
  }

  // Health check endpoint data
  getHealthStatus() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      metrics: this.metrics,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
      config: this.config
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

## Advanced Circuit Breaker Patterns

### Fallback Strategy Implementation

```typescript
// Advanced circuit breaker with fallback strategies
export interface FallbackConfig {
  enabled: boolean;
  strategy: 'cache' | 'default' | 'alternative_service' | 'custom';
  cacheKey?: string;
  defaultResponse?: any;
  alternativeService?: string;
  customHandler?: (error: Error) => Promise<any>;
}

export class FallbackCircuitBreaker extends CircuitBreaker {
  constructor(
    serviceName: string,
    config: CircuitBreakerConfig,
    private fallbackConfig: FallbackConfig
  ) {
    super(serviceName, config);
  }

  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackContext?: any
  ): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if (this.fallbackConfig.enabled && error instanceof CircuitBreakerOpenError) {
        return await this.executeFallback<T>(fallbackContext);
      }
      throw error;
    }
  }

  private async executeFallback<T>(context?: any): Promise<T> {
    switch (this.fallbackConfig.strategy) {
      case 'cache':
        return await this.getCachedResponse<T>();
        
      case 'default':
        return this.fallbackConfig.defaultResponse;
        
      case 'alternative_service':
        return await this.callAlternativeService<T>(context);
        
      case 'custom':
        if (this.fallbackConfig.customHandler) {
          return await this.fallbackConfig.customHandler(
            new CircuitBreakerOpenError(`Service ${this.serviceName} unavailable`)
          );
        }
        break;
    }
    
    throw new Error('No fallback strategy available');
  }

  private async getCachedResponse<T>(): Promise<T> {
    if (!this.fallbackConfig.cacheKey) {
      throw new Error('Cache key not configured for fallback');
    }

    const cached = await this.redis.get(this.fallbackConfig.cacheKey);
    if (!cached) {
      throw new Error('No cached response available');
    }

    return JSON.parse(cached);
  }

  private async callAlternativeService<T>(context: any): Promise<T> {
    if (!this.fallbackConfig.alternativeService) {
      throw new Error('Alternative service not configured');
    }

    // Implementation would call alternative service
    // This is a placeholder for service-specific logic
    console.log(`Calling alternative service: ${this.fallbackConfig.alternativeService}`);
    throw new Error('Alternative service implementation required');
  }
}
```

### Hierarchical Circuit Breakers

```typescript
// Multi-level circuit breaker system
export class HierarchicalCircuitBreaker {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private serviceGroups: Map<string, string[]> = new Map();

  constructor() {
    this.setupServiceGroups();
  }

  private setupServiceGroups(): void {
    // Define service groups for hierarchical breaking
    this.serviceGroups.set('payment', ['payment-service', 'fraud-detection', 'bank-api']);
    this.serviceGroups.set('user', ['user-service', 'profile-service', 'auth-service']);
    this.serviceGroups.set('inventory', ['inventory-service', 'warehouse-api']);
  }

  addCircuitBreaker(serviceName: string, config: CircuitBreakerConfig): void {
    this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, config));
  }

  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check service-specific circuit breaker
    const serviceBreaker = this.circuitBreakers.get(serviceName);
    if (!serviceBreaker) {
      throw new Error(`No circuit breaker configured for service: ${serviceName}`);
    }

    // Check group-level circuit breaker
    const groupName = this.getServiceGroup(serviceName);
    if (groupName) {
      const groupBreaker = this.circuitBreakers.get(`group:${groupName}`);
      if (groupBreaker && groupBreaker.getHealthStatus().state === CircuitBreakerState.OPEN) {
        throw new CircuitBreakerOpenError(`Service group ${groupName} is unavailable`);
      }
    }

    try {
      return await serviceBreaker.execute(operation);
    } catch (error) {
      // If service fails, check if we should break the entire group
      if (groupName) {
        await this.evaluateGroupBreaker(groupName);
      }
      throw error;
    }
  }

  private getServiceGroup(serviceName: string): string | undefined {
    for (const [groupName, services] of this.serviceGroups.entries()) {
      if (services.includes(serviceName)) {
        return groupName;
      }
    }
    return undefined;
  }

  private async evaluateGroupBreaker(groupName: string): Promise<void> {
    const services = this.serviceGroups.get(groupName) || [];
    const openServices = services.filter(serviceName => {
      const breaker = this.circuitBreakers.get(serviceName);
      return breaker?.getHealthStatus().state === CircuitBreakerState.OPEN;
    });

    // If more than 50% of services in group are open, open group breaker
    if (openServices.length > services.length * 0.5) {
      let groupBreaker = this.circuitBreakers.get(`group:${groupName}`);
      if (!groupBreaker) {
        groupBreaker = new CircuitBreaker(`group:${groupName}`, {
          failureThreshold: 0.3,
          recoveryTimeout: 60000,
          monitoringPeriod: 10000,
          expectedResponseTime: 5000,
          volumeThreshold: 5
        });
        this.circuitBreakers.set(`group:${groupName}`, groupBreaker);
      }
    }
  }

  getSystemHealth(): Record<string, any> {
    const health: Record<string, any> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      health[name] = breaker.getHealthStatus();
    }
    
    return health;
  }
}
```

## Configuration Management

```yaml
# Circuit breaker configuration
circuit_breakers:
  default:
    failure_threshold: 0.5      # 50% failure rate
    recovery_timeout: 30000     # 30 seconds
    monitoring_period: 10000    # 10 seconds
    expected_response_time: 5000 # 5 seconds
    volume_threshold: 10        # Minimum 10 requests
    
  services:
    payment-service:
      failure_threshold: 0.3    # More sensitive
      recovery_timeout: 60000   # Longer recovery
      expected_response_time: 3000
      fallback:
        enabled: true
        strategy: cache
        cache_key: "payment:fallback"
        
    user-service:
      failure_threshold: 0.6    # Less sensitive
      recovery_timeout: 15000   # Faster recovery
      expected_response_time: 2000
      fallback:
        enabled: true
        strategy: default
        default_response:
          user: { id: "anonymous", name: "Guest User" }
          
    external-api:
      failure_threshold: 0.4
      recovery_timeout: 120000  # Very long recovery for external services
      expected_response_time: 10000
      fallback:
        enabled: true
        strategy: alternative_service
        alternative_service: "backup-api"

  hierarchical:
    enabled: true
    groups:
      payment:
        services: [payment-service, fraud-detection, bank-api]
        group_threshold: 0.5
      user:
        services: [user-service, profile-service, auth-service]
        group_threshold: 0.6
```

## Usage Examples

```typescript
// Basic usage in gateway
import { CircuitBreaker, CircuitBreakerConfig } from '../middleware/CircuitBreaker';

const circuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 0.5,
  recoveryTimeout: 30000,
  monitoringPeriod: 10000,
  expectedResponseTime: 5000,
  volumeThreshold: 10
};

const paymentServiceBreaker = new CircuitBreaker('payment-service', circuitBreakerConfig);

// Usage in route handler
app.post('/api/payments', async (req, res) => {
  try {
    const result = await paymentServiceBreaker.execute(async () => {
      return await fetch('http://payment-service:8080/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }).then(response => response.json());
    });
    
    res.json(result);
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      res.status(503).json({
        error: 'Payment service temporarily unavailable',
        message: 'Please try again later'
      });
    } else {
      res.status(500).json({ error: 'Payment processing failed' });
    }
  }
});

// Usage with fallback
const fallbackBreaker = new FallbackCircuitBreaker('user-service', circuitBreakerConfig, {
  enabled: true,
  strategy: 'cache',
  cacheKey: 'user:profile:fallback'
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await fallbackBreaker.executeWithFallback(async () => {
      return await getUserFromService(req.params.id);
    });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'User service unavailable' });
  }
});
```