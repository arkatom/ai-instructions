# Microservices - 観測可能性基礎

> ログ、メトリクス、トレーシングの核心概念と基本実装

## 概要

マイクロサービスアーキテクチャの観測可能性は、分散システムの健全性、パフォーマンス、問題の特定に不可欠です。Three Pillars（ログ、メトリクス、トレーシング）の基本概念と実装方法を理解します。

## 関連ファイル
- [メトリクス監視](./13-metrics-monitoring.md) - メトリクス収集と監視システム
- [分散トレーシング](./14-distributed-tracing.md) - トレーシングシステムの実装
- [ログ集約](./15-logging-aggregation.md) - ログ管理と分析

## 分散トレーシング実装

### 1. OpenTelemetryトレーシング

```typescript
// shared/monitoring/tracing.ts
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export class TracingService {
  private tracer = trace.getTracer('microservices-app', '1.0.0');

  createSpan(name: string, parentContext?: any) {
    return this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL
    }, parentContext);
  }

  async traceAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName);
    
    if (attributes) {
      span.setAttributes(attributes);
    }

    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  traceHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number
  ): void {
    const span = this.tracer.startSpan(`HTTP ${method}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.status_code': statusCode,
        'http.duration_ms': duration
      }
    });

    if (statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${statusCode}`
      });
    }

    span.end();
  }

  propagateContext(headers: Record<string, string>): Record<string, string> {
    const activeContext = context.active();
    const propagatedHeaders: Record<string, string> = {};
    
    // コンテキストをHTTPヘッダーに注入
    trace.setSpanContext(activeContext, trace.getActiveSpan()?.spanContext());
    
    return { ...headers, ...propagatedHeaders };
  }

  extractContext(headers: Record<string, string>): any {
    // HTTPヘッダーからコンテキストを抽出
    return context.active();
  }
}

// サービス固有のトレーシング実装
export class ServiceTracer {
  constructor(
    private tracingService: TracingService,
    private serviceName: string
  ) {}

  async traceServiceCall<T>(
    targetService: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.tracingService.traceAsyncOperation(
      `${this.serviceName} -> ${targetService}::${operation}`,
      fn,
      {
        'service.name': this.serviceName,
        'service.target': targetService,
        'service.operation': operation
      }
    );
  }

  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.tracingService.traceAsyncOperation(
      `db.${operation}`,
      fn,
      {
        'db.operation': operation,
        'db.table': table,
        'component': 'database'
      }
    );
  }

  async traceBusinessLogic<T>(
    operationName: string,
    entityId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.tracingService.traceAsyncOperation(
      operationName,
      fn,
      {
        'business.operation': operationName,
        'business.entity.id': entityId,
        'service.name': this.serviceName
      }
    );
  }
}
```

### 2. 分散トレーシング統合

```typescript
// shared/middleware/tracing-middleware.ts
export class TracingMiddleware {
  constructor(private tracingService: TracingService) {}

  express(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const traceId = req.headers['x-trace-id'] || crypto.randomUUID();
      const spanId = crypto.randomUUID();
      
      req.traceId = traceId;
      req.spanId = spanId;

      const span = this.tracingService.createSpan(`${req.method} ${req.path}`);
      
      span.setAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.user_agent': req.get('user-agent') || '',
        'trace.id': traceId,
        'span.id': spanId
      });

      // レスポンスヘッダーに設定
      res.setHeader('X-Trace-ID', traceId);

      const originalSend = res.send;
      res.send = function(data: any) {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_size': Buffer.byteLength(data || '')
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        }

        span.end();
        return originalSend.call(this, data);
      };

      next();
    };
  }

  grpc(): any {
    return (call: any, callback: any, next: any) => {
      const span = this.tracingService.createSpan(`gRPC ${call.handler.path}`);
      
      span.setAttributes({
        'grpc.method': call.handler.path,
        'grpc.service': call.handler.service,
        'component': 'grpc'
      });

      const wrappedCallback = (error: any, response: any) => {
        if (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          span.recordException(error);
        }
        
        span.end();
        callback(error, response);
      };

      next(call, wrappedCallback);
    };
  }
}
```

### 3. 観測可能性の核心概念

```typescript
// shared/monitoring/observability-core.ts
export interface ObservabilityService {
  trace: TracingService;
  metrics: MetricsService;
  logs: LoggingService;
}

export class ObservabilityContext {
  private static instance: ObservabilityContext;
  private traceId: string;
  private spanId: string;
  private userId?: string;
  private operationId?: string;

  private constructor() {
    this.traceId = crypto.randomUUID();
    this.spanId = crypto.randomUUID();
  }

  static getInstance(): ObservabilityContext {
    if (!ObservabilityContext.instance) {
      ObservabilityContext.instance = new ObservabilityContext();
    }
    return ObservabilityContext.instance;
  }

  static create(traceId?: string, spanId?: string): ObservabilityContext {
    const context = new ObservabilityContext();
    if (traceId) context.traceId = traceId;
    if (spanId) context.spanId = spanId;
    return context;
  }

  getTraceId(): string {
    return this.traceId;
  }

  getSpanId(): string {
    return this.spanId;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  setOperationId(operationId: string): void {
    this.operationId = operationId;
  }

  getOperationId(): string | undefined {
    return this.operationId;
  }

  createChildSpan(): ObservabilityContext {
    const child = new ObservabilityContext();
    child.traceId = this.traceId; // 同じトレースID
    child.userId = this.userId;
    child.operationId = this.operationId;
    return child;
  }

  toHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Trace-ID': this.traceId,
      'X-Span-ID': this.spanId
    };
    
    if (this.userId) {
      headers['X-User-ID'] = this.userId;
    }
    
    if (this.operationId) {
      headers['X-Operation-ID'] = this.operationId;
    }
    
    return headers;
  }

  fromHeaders(headers: Record<string, string>): void {
    if (headers['X-Trace-ID']) {
      this.traceId = headers['X-Trace-ID'];
    }
    if (headers['X-Span-ID']) {
      this.spanId = headers['X-Span-ID'];
    }
    if (headers['X-User-ID']) {
      this.userId = headers['X-User-ID'];
    }
    if (headers['X-Operation-ID']) {
      this.operationId = headers['X-Operation-ID'];
    }
  }
}

// 監視された操作の基底クラス
export abstract class MonitoredOperation<T> {
  protected context: ObservabilityContext;
  protected tracer: ServiceTracer;
  protected logger: BusinessLogger;
  protected metrics: ServiceMetrics;

  constructor(
    protected observability: ObservabilityService,
    protected operationName: string
  ) {
    this.context = ObservabilityContext.getInstance();
    this.tracer = new ServiceTracer(observability.trace, this.getServiceName());
    this.logger = new BusinessLogger(this.getServiceName());
    this.metrics = new ServiceMetrics(this.getServiceName());
  }

  async execute(): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      this.logger.info(`Starting operation: ${this.operationName}`, {
        operationId: this.context.getOperationId(),
        traceId: this.context.getTraceId()
      });
      
      const result = await this.tracer.traceBusinessLogic(
        this.operationName,
        this.context.getOperationId() || 'unknown',
        () => this.performOperation()
      );
      
      success = true;
      return result;
    } catch (error) {
      this.logger.error(`Operation failed: ${this.operationName}`, error, {
        operationId: this.context.getOperationId(),
        traceId: this.context.getTraceId()
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      this.metrics.recordServiceSpecificMetric(
        this.operationName,
        duration,
        success
      );
      
      this.logger.logPerformanceMetric(
        this.operationName,
        duration,
        success
      );
    }
  }

  protected abstract performOperation(): Promise<T>;
  protected abstract getServiceName(): string;
}
```

### 4. 基本メトリクス定義

```typescript
// shared/monitoring/basic-metrics.ts
export interface BasicMetrics {
  // HTTPメトリクス
  httpRequestsTotal: Counter;
  httpRequestDuration: Histogram;
  httpActiveConnections: Gauge;
  
  // ビジネスメトリクス
  businessOperationsTotal: Counter;
  businessOperationDuration: Histogram;
  
  // システムメトリクス
  systemResourceUsage: Gauge;
  errorRate: Gauge;
}

export class MetricsDefinitions {
  static createBasicMetrics(): BasicMetrics {
    return {
      httpRequestsTotal: new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'path', 'status_code']
      }),
      
      httpRequestDuration: new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'path', 'status_code'],
        buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30]
      }),
      
      httpActiveConnections: new Gauge({
        name: 'http_active_connections',
        help: 'Number of active HTTP connections'
      }),
      
      businessOperationsTotal: new Counter({
        name: 'business_operations_total',
        help: 'Total number of business operations',
        labelNames: ['operation', 'entity', 'status']
      }),
      
      businessOperationDuration: new Histogram({
        name: 'business_operation_duration_seconds',
        help: 'Business operation duration in seconds',
        labelNames: ['operation', 'entity', 'status'],
        buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60]
      }),
      
      systemResourceUsage: new Gauge({
        name: 'system_resource_usage',
        help: 'System resource usage',
        labelNames: ['resource_type']
      }),
      
      errorRate: new Gauge({
        name: 'error_rate',
        help: 'Error rate percentage',
        labelNames: ['service', 'operation']
      })
    };
  }
}
```

これらの基本概念を理解することで、マイクロサービス環境での包括的な観測可能性を実現する土台が整います。次は[メトリクス監視](./13-metrics-monitoring.md)について詳しく学習しましょう。