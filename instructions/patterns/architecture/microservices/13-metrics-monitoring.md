# Microservices - メトリクス監視

> メトリクス収集、Prometheus、ヘルスチェックの実装

## 概要

マイクロサービスのメトリクス監視は、システムのパフォーマンス、健全性、ビジネス指標をリアルタイムで把握するために不可欠です。Prometheus、ヘルスチェック、アラートの実装方法を詳しく説明します。

## 関連ファイル
- [観測可能性基礎](./12-observability-basics.md) - 基本概念とトレーシング
- [分散トレーシング](./14-distributed-tracing.md) - トレーシングシステムの実装
- [ログ集約](./15-logging-aggregation.md) - ログ管理と分析

## メトリクス収集と監視

### 1. Prometheusメトリクス

```typescript
// shared/monitoring/metrics.ts
import { metrics } from '@opentelemetry/api-metrics';
import { MeterProvider } from '@opentelemetry/sdk-metrics-base';
import { PrometheusRegistry } from 'prom-client';

export class MetricsService {
  private meter = metrics.getMeter('microservices-app', '1.0.0');
  private registry = new PrometheusRegistry();
  
  // HTTPメトリクス
  private requestCounter = this.meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests'
  });

  private requestDuration = this.meter.createHistogram('http_request_duration_seconds', {
    description: 'HTTP request duration in seconds'
  });

  private activeConnections = this.meter.createUpDownCounter('http_active_connections', {
    description: 'Number of active HTTP connections'
  });

  // ビジネスメトリクス
  private businessOperations = this.meter.createCounter('business_operations_total', {
    description: 'Total number of business operations'
  });

  private businessOperationDuration = this.meter.createHistogram('business_operation_duration_seconds', {
    description: 'Business operation duration in seconds'
  });

  recordHttpRequest(
    method: string, 
    path: string, 
    statusCode: number, 
    duration: number
  ): void {
    const labels = { 
      method, 
      path: this.normalizeHttpPath(path),
      status_code: statusCode.toString() 
    };
    
    this.requestCounter.add(1, labels);
    this.requestDuration.record(duration / 1000, labels);
  }

  recordBusinessOperation(
    operationType: string,
    entityType: string,
    duration: number,
    success: boolean
  ): void {
    const labels = {
      operation: operationType,
      entity: entityType,
      status: success ? 'success' : 'failure'
    };

    this.businessOperations.add(1, labels);
    this.businessOperationDuration.record(duration / 1000, labels);
  }

  incrementActiveConnections(): void {
    this.activeConnections.add(1);
  }

  decrementActiveConnections(): void {
    this.activeConnections.add(-1);
  }

  recordCustomMetric(
    metricName: string,
    value: number,
    labels: Record<string, string>,
    type: 'counter' | 'gauge' | 'histogram' = 'counter'
  ): void {
    switch (type) {
      case 'counter':
        const counter = this.meter.createCounter(metricName);
        counter.add(value, labels);
        break;
      case 'gauge':
        const gauge = this.meter.createUpDownCounter(metricName);
        gauge.add(value, labels);
        break;
      case 'histogram':
        const histogram = this.meter.createHistogram(metricName);
        histogram.record(value, labels);
        break;
    }
  }

  private normalizeHttpPath(path: string): string {
    // パスパラメーターを正規化
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectid');
  }

  getMetricsEndpoint(): string {
    return this.registry.metrics();
  }
}

// サービス固有のメトリクス
export class ServiceMetrics extends MetricsService {
  constructor(private serviceName: string) {
    super();
  }

  recordServiceSpecificMetric(
    operation: string,
    duration: number,
    success: boolean,
    additionalLabels?: Record<string, string>
  ): void {
    const labels = {
      service: this.serviceName,
      operation,
      status: success ? 'success' : 'failure',
      ...additionalLabels
    };

    this.recordCustomMetric('service_operation_total', 1, labels, 'counter');
    this.recordCustomMetric('service_operation_duration_seconds', duration / 1000, labels, 'histogram');
  }

  recordResourceUsage(resourceType: string, usage: number): void {
    this.recordCustomMetric('resource_usage', usage, {
      service: this.serviceName,
      resource: resourceType
    }, 'gauge');
  }

  recordQueueSize(queueName: string, size: number): void {
    this.recordCustomMetric('queue_size', size, {
      service: this.serviceName,
      queue: queueName
    }, 'gauge');
  }
}
```

### 2. ヘルスチェック実装

```typescript
// shared/monitoring/health-check.ts
export interface HealthCheck {
  name: string;
  check(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  details?: Record<string, any>;
  duration?: number;
}

export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';

  constructor(private database: Database) {}

  async check(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.database.query('SELECT 1');
      const duration = Date.now() - startTime;
      
      return { 
        status: 'UP',
        duration,
        details: {
          connectionPool: {
            active: await this.database.getActiveConnections(),
            idle: await this.database.getIdleConnections()
          }
        }
      };
    } catch (error) {
      return {
        status: 'DOWN',
        duration: Date.now() - startTime,
        details: { 
          error: error.message,
          lastSuccessful: await this.database.getLastSuccessfulConnection()
        }
      };
    }
  }
}

export class ExternalServiceHealthCheck implements HealthCheck {
  constructor(
    public name: string,
    private serviceClient: ServiceClient,
    private serviceName: string,
    private timeout: number = 5000
  ) {}

  async check(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      await this.serviceClient.get(this.serviceName, '/health', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      return { 
        status: 'UP',
        duration,
        details: { url: await this.serviceClient.getServiceUrl(this.serviceName) }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        return {
          status: 'DOWN',
          duration,
          details: { error: 'Timeout', timeout: this.timeout }
        };
      }
      
      return {
        status: 'DOWN',
        duration,
        details: { error: error.message }
      };
    }
  }
}

export class CacheHealthCheck implements HealthCheck {
  name = 'cache';

  constructor(private cache: CacheService) {}

  async check(): Promise<HealthStatus> {
    const startTime = Date.now();
    const testKey = `health-check-${Date.now()}`;
    const testValue = 'test';
    
    try {
      // 書き込み・読み取りテスト
      await this.cache.set(testKey, testValue, 60);
      const retrieved = await this.cache.get(testKey);
      await this.cache.delete(testKey);
      
      const duration = Date.now() - startTime;
      
      if (retrieved === testValue) {
        return { 
          status: 'UP',
          duration,
          details: { 
            operations: ['set', 'get', 'delete'],
            memoryUsage: await this.cache.getMemoryUsage?.()
          }
        };
      } else {
        return {
          status: 'DEGRADED',
          duration,
          details: { error: 'Data integrity issue' }
        };
      }
    } catch (error) {
      return {
        status: 'DOWN',
        duration: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }
}

export class HealthService {
  private healthChecks: HealthCheck[] = [];

  addHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.push(healthCheck);
  }

  async getHealth(): Promise<{
    status: string;
    checks: Record<string, HealthStatus>;
    metadata: HealthMetadata;
  }> {
    const checks: Record<string, HealthStatus> = {};
    let overallStatus = 'UP';
    const startTime = Date.now();

    // 並列実行でパフォーマンス向上
    const healthPromises = this.healthChecks.map(async (healthCheck) => {
      try {
        const status = await healthCheck.check();
        checks[healthCheck.name] = status;
        
        if (status.status === 'DOWN') {
          overallStatus = 'DOWN';
        } else if (status.status === 'DEGRADED' && overallStatus !== 'DOWN') {
          overallStatus = 'DEGRADED';
        }
      } catch (error) {
        checks[healthCheck.name] = {
          status: 'DOWN',
          details: { error: error.message }
        };
        overallStatus = 'DOWN';
      }
    });

    await Promise.all(healthPromises);

    const totalDuration = Date.now() - startTime;

    return { 
      status: overallStatus, 
      checks,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        service: process.env.SERVICE_NAME || 'unknown',
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }
}

interface HealthMetadata {
  timestamp: string;
  duration: number;
  service: string;
  version: string;
  environment: string;
}
```

### 3. 高度なメトリクス機能

```typescript
// shared/monitoring/advanced-metrics.ts
export class AdvancedMetricsCollector {
  private metricsBuffer = new Map<string, MetricBuffer>();
  private aggregationInterval = 60000; // 1分

  constructor(private metricsService: MetricsService) {
    this.startAggregation();
  }

  recordMetric(name: string, value: number, labels: Record<string, string>): void {
    const key = `${name}_${JSON.stringify(labels)}`;
    
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, {
        name,
        labels,
        values: [],
        sum: 0,
        count: 0,
        min: value,
        max: value
      });
    }
    
    const buffer = this.metricsBuffer.get(key)!;
    buffer.values.push(value);
    buffer.sum += value;
    buffer.count++;
    buffer.min = Math.min(buffer.min, value);
    buffer.max = Math.max(buffer.max, value);
  }

  private startAggregation(): void {
    setInterval(() => {
      this.aggregateAndFlush();
    }, this.aggregationInterval);
  }

  private aggregateAndFlush(): void {
    for (const [key, buffer] of this.metricsBuffer) {
      const avg = buffer.sum / buffer.count;
      const p95 = this.calculatePercentile(buffer.values, 0.95);
      const p99 = this.calculatePercentile(buffer.values, 0.99);
      
      // 集計されたメトリクスを送信
      this.metricsService.recordCustomMetric(
        `${buffer.name}_avg`,
        avg,
        buffer.labels,
        'gauge'
      );
      
      this.metricsService.recordCustomMetric(
        `${buffer.name}_p95`,
        p95,
        buffer.labels,
        'gauge'
      );
      
      this.metricsService.recordCustomMetric(
        `${buffer.name}_p99`,
        p99,
        buffer.labels,
        'gauge'
      );
      
      this.metricsService.recordCustomMetric(
        `${buffer.name}_min`,
        buffer.min,
        buffer.labels,
        'gauge'
      );
      
      this.metricsService.recordCustomMetric(
        `${buffer.name}_max`,
        buffer.max,
        buffer.labels,
        'gauge'
      );
    }
    
    this.metricsBuffer.clear();
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }
}

interface MetricBuffer {
  name: string;
  labels: Record<string, string>;
  values: number[];
  sum: number;
  count: number;
  min: number;
  max: number;
}

// ビジネスメトリクスコレクター
export class BusinessMetricsCollector {
  constructor(
    private metricsService: MetricsService,
    private advancedMetrics: AdvancedMetricsCollector
  ) {}

  recordOrderCreated(order: Order): void {
    this.metricsService.recordCustomMetric(
      'orders_created_total',
      1,
      {
        customer_type: order.customerType,
        product_category: order.items[0]?.category || 'unknown'
      },
      'counter'
    );
    
    this.advancedMetrics.recordMetric(
      'order_value',
      order.totalAmount,
      {
        customer_type: order.customerType,
        region: order.shippingAddress.region
      }
    );
  }

  recordPaymentProcessed(payment: Payment): void {
    this.metricsService.recordCustomMetric(
      'payments_processed_total',
      1,
      {
        payment_method: payment.method,
        status: payment.status
      },
      'counter'
    );
    
    if (payment.status === 'completed') {
      this.advancedMetrics.recordMetric(
        'payment_amount',
        payment.amount,
        {
          payment_method: payment.method,
          currency: payment.currency
        }
      );
    }
  }

  recordInventoryChange(item: InventoryItem, change: number): void {
    this.metricsService.recordCustomMetric(
      'inventory_changes_total',
      Math.abs(change),
      {
        product_id: item.productId,
        change_type: change > 0 ? 'increase' : 'decrease'
      },
      'counter'
    );
    
    this.metricsService.recordCustomMetric(
      'inventory_level',
      item.currentQuantity,
      {
        product_id: item.productId,
        warehouse: item.warehouse
      },
      'gauge'
    );
  }
}
```

これらのメトリクス監視システムにより、マイクロサービスのパフォーマンス、健全性、ビジネス指標をリアルタイムで監視し、必要に応じて迅速に対応できます。次は[分散トレーシング](./14-distributed-tracing.md)について学習しましょう。