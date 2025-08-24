# Microservices - 分散トレーシング

> Jaeger、Zipkin、OpenTelemetryを使ったトレーシングシステム

## 概要

分散トレーシングは、複数のサービスをまたがるリクエストの流れを追跡し、パフォーマンスのボトルネックやエラーの原因を特定するための重要な技術です。OpenTelemetry、Jaeger、Zipkinの統合と高度な活用方法を学習します。

## 関連ファイル
- [観測可能性基礎](./12-observability-basics.md) - 基本概念とトレーシング
- [メトリクス監視](./13-metrics-monitoring.md) - メトリクス収集と監視システム
- [ログ集約](./15-logging-aggregation.md) - ログ管理と分析

## OpenTelemetry高度な実装

### 1. トレーシング初期化と設定

```typescript
// shared/tracing/tracing-setup.ts
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

export class TracingInitializer {
  private sdk?: NodeSDK;
  private tracerProvider?: NodeTracerProvider;

  async initialize(): Promise<void> {
    // リソース情報の設定
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'unknown-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.SERVICE_NAMESPACE || 'microservices',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
    });

    // Jaegerエクスポーターの設定
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
    });

    // トレーサープロバイダーの作成
    this.tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(jaegerExporter, {
          maxExportBatchSize: 100,
          scheduledDelayMillis: 1000,
          exportTimeoutMillis: 30000,
          maxQueueSize: 2048
        })
      ]
    });

    // SDKの初期化
    this.sdk = new NodeSDK({
      resource,
      traceExporter: jaegerExporter,
      instrumentations: [
        // 自動計装化の有効化
      ]
    });

    this.tracerProvider.register();
    await this.sdk.start();

    console.log('OpenTelemetry tracing initialized successfully');
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('OpenTelemetry tracing shutdown completed');
    }
  }
}

// グローバル初期化
export const tracingInitializer = new TracingInitializer();

// アプリケーション起動時に初期化
process.on('SIGTERM', async () => {
  await tracingInitializer.shutdown();
});
```

### 2. 高度なスパン管理

```typescript
// shared/tracing/span-manager.ts
import { trace, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export class SpanManager {
  private tracer = trace.getTracer('microservices-span-manager', '1.0.0');

  async executeWithSpan<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    options?: SpanOptions
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {}
    });

    try {
      // 操作の実行
      const result = await operation(span);
      
      // 成功時のステータス設定
      span.setStatus({ code: SpanStatusCode.OK });
      
      // 結果のメタデータを追加
      if (options?.includeResult && result) {
        span.setAttributes({
          'operation.result.type': typeof result,
          'operation.result.size': JSON.stringify(result).length
        });
      }
      
      return result;
    } catch (error) {
      // エラー時の処理
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      
      // エラー情報をスパンに追加
      span.setAttributes({
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack?.substring(0, 1000) // スタックトレースの切り詰め
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  createDatabaseSpan(
    operation: string,
    table: string,
    query?: string
  ): Span {
    const span = this.tracer.startSpan(`db.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.DB_SYSTEM]: 'postgresql',
        [SemanticAttributes.DB_OPERATION]: operation,
        [SemanticAttributes.DB_SQL_TABLE]: table,
        [SemanticAttributes.DB_STATEMENT]: query?.substring(0, 500) // SQLの切り詰め
      }
    });
    return span;
  }

  createHttpClientSpan(
    method: string,
    url: string,
    headers?: Record<string, string>
  ): Span {
    const parsedUrl = new URL(url);
    
    const span = this.tracer.startSpan(`HTTP ${method}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.HTTP_METHOD]: method,
        [SemanticAttributes.HTTP_URL]: url,
        [SemanticAttributes.HTTP_HOST]: parsedUrl.host,
        [SemanticAttributes.HTTP_SCHEME]: parsedUrl.protocol.replace(':', ''),
        [SemanticAttributes.HTTP_TARGET]: parsedUrl.pathname + parsedUrl.search
      }
    });
    
    // ヘッダー情報を必要に応じて追加
    if (headers) {
      const allowedHeaders = ['user-agent', 'content-type', 'authorization'];
      for (const [key, value] of Object.entries(headers)) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          span.setAttribute(`http.request.header.${key}`, 
            key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
          );
        }
      }
    }
    
    return span;
  }

  createMessageSpan(
    operation: 'send' | 'receive',
    destination: string,
    messageId?: string
  ): Span {
    const span = this.tracer.startSpan(`message.${operation}`, {
      kind: operation === 'send' ? SpanKind.PRODUCER : SpanKind.CONSUMER,
      attributes: {
        [SemanticAttributes.MESSAGING_SYSTEM]: 'rabbitmq',
        [SemanticAttributes.MESSAGING_DESTINATION]: destination,
        [SemanticAttributes.MESSAGING_OPERATION]: operation,
        [SemanticAttributes.MESSAGING_MESSAGE_ID]: messageId
      }
    });
    return span;
  }

  addBusinessContext(
    span: Span,
    context: {
      userId?: string;
      orderId?: string;
      sessionId?: string;
      correlationId?: string;
      [key: string]: any;
    }
  ): void {
    const businessAttributes: Record<string, string> = {};
    
    if (context.userId) businessAttributes['user.id'] = context.userId;
    if (context.orderId) businessAttributes['order.id'] = context.orderId;
    if (context.sessionId) businessAttributes['session.id'] = context.sessionId;
    if (context.correlationId) businessAttributes['correlation.id'] = context.correlationId;
    
    // その他のビジネスコンテキスト
    for (const [key, value] of Object.entries(context)) {
      if (!['userId', 'orderId', 'sessionId', 'correlationId'].includes(key)) {
        businessAttributes[`business.${key}`] = String(value);
      }
    }
    
    span.setAttributes(businessAttributes);
  }
}

interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
  includeResult?: boolean;
}

// グローバルスパンマネージャー
export const spanManager = new SpanManager();
```

### 3. サービス間トレーシング

```typescript
// shared/tracing/service-tracing.ts
export class ServiceTracingClient {
  constructor(
    private httpClient: HttpClient,
    private spanManager: SpanManager
  ) {}

  async callService<T>(
    serviceName: string,
    endpoint: string,
    options: ServiceCallOptions = {}
  ): Promise<T> {
    const url = `http://${serviceName}${endpoint}`;
    
    return this.spanManager.executeWithSpan(
      `call ${serviceName}`,
      async (span) => {
        // HTTPクライアントスパンの作成
        const httpSpan = this.spanManager.createHttpClientSpan(
          options.method || 'GET',
          url,
          options.headers
        );
        
        // ビジネスコンテキストの追加
        if (options.businessContext) {
          this.spanManager.addBusinessContext(httpSpan, options.businessContext);
        }
        
        try {
          const startTime = Date.now();
          
          // トレーシングヘッダーの注入
          const tracingHeaders = this.injectTracingHeaders(options.headers || {});
          
          const response = await this.httpClient.request<T>({
            method: options.method || 'GET',
            url,
            data: options.data,
            headers: tracingHeaders,
            timeout: options.timeout || 30000
          });
          
          const duration = Date.now() - startTime;
          
          // レスポンス情報の記録
          httpSpan.setAttributes({
            [SemanticAttributes.HTTP_STATUS_CODE]: response.status,
            [SemanticAttributes.HTTP_RESPONSE_SIZE]: response.data ? 
              JSON.stringify(response.data).length : 0,
            'http.request.duration_ms': duration
          });
          
          // レスポンスヘッダーの記録
          if (response.headers) {
            Object.entries(response.headers).forEach(([key, value]) => {
              if (['content-type', 'content-length'].includes(key.toLowerCase())) {
                httpSpan.setAttribute(`http.response.header.${key}`, String(value));
              }
            });
          }
          
          if (response.status >= 400) {
            httpSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.status}`
            });
          }
          
          return response.data;
        } catch (error) {
          httpSpan.recordException(error);
          httpSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          throw error;
        } finally {
          httpSpan.end();
        }
      },
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'service.target': serviceName,
          'service.endpoint': endpoint
        }
      }
    );
  }

  private injectTracingHeaders(headers: Record<string, string>): Record<string, string> {
    const activeContext = trace.setSpanContext(context.active(), trace.getActiveSpan()?.spanContext());
    const propagationHeaders: Record<string, string> = {};
    
    // W3C Trace Contextの注入
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      propagationHeaders['traceparent'] = 
        `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`;
    }
    
    return { ...headers, ...propagationHeaders };
  }
}

interface ServiceCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  businessContext?: {
    userId?: string;
    orderId?: string;
    sessionId?: string;
    correlationId?: string;
    [key: string]: any;
  };
}
```

### 4. トレーシングダッシュボードと分析

```typescript
// shared/tracing/tracing-analytics.ts
export class TracingAnalytics {
  constructor(
    private jaegerClient: JaegerQueryClient,
    private metricsService: MetricsService
  ) {}

  async analyzeServicePerformance(
    serviceName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ServicePerformanceAnalysis> {
    // Jaegerからトレースを取得
    const traces = await this.jaegerClient.findTraces({
      service: serviceName,
      start: timeRange.start.getTime() * 1000, // microseconds
      end: timeRange.end.getTime() * 1000,
      limit: 1000
    });

    const analysis: ServicePerformanceAnalysis = {
      serviceName,
      timeRange,
      totalTraces: traces.length,
      avgDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      errorRate: 0,
      slowestOperations: [],
      errorPatterns: [],
      dependencyAnalysis: {}
    };

    if (traces.length === 0) {
      return analysis;
    }

    // Duration分析
    const durations = traces.map(trace => trace.duration / 1000); // ms
    durations.sort((a, b) => a - b);
    
    analysis.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    analysis.p95Duration = durations[Math.floor(durations.length * 0.95)];
    analysis.p99Duration = durations[Math.floor(durations.length * 0.99)];

    // エラー率分析
    const errorTraces = traces.filter(trace => 
      trace.spans.some(span => span.tags.find(tag => tag.key === 'error' && tag.value === 'true'))
    );
    analysis.errorRate = errorTraces.length / traces.length;

    // 遅い操作の分析
    const operationDurations = new Map<string, number[]>();
    traces.forEach(trace => {
      trace.spans.forEach(span => {
        if (span.process.serviceName === serviceName) {
          const operation = span.operationName;
          if (!operationDurations.has(operation)) {
            operationDurations.set(operation, []);
          }
          operationDurations.get(operation)!.push(span.duration / 1000);
        }
      });
    });

    analysis.slowestOperations = Array.from(operationDurations.entries())
      .map(([operation, durations]) => ({
        operation,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        maxDuration: Math.max(...durations),
        count: durations.length
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    // エラーパターン分析
    const errorMessages = new Map<string, number>();
    errorTraces.forEach(trace => {
      trace.spans.forEach(span => {
        const errorTag = span.tags.find(tag => tag.key === 'error.message');
        if (errorTag) {
          const message = errorTag.value.toString();
          errorMessages.set(message, (errorMessages.get(message) || 0) + 1);
        }
      });
    });

    analysis.errorPatterns = Array.from(errorMessages.entries())
      .map(([message, count]) => ({ message, count, percentage: count / errorTraces.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return analysis;
  }

  async generatePerformanceReport(
    services: string[],
    timeRange: { start: Date; end: Date }
  ): Promise<PerformanceReport> {
    const serviceAnalyses = await Promise.all(
      services.map(service => this.analyzeServicePerformance(service, timeRange))
    );

    return {
      timeRange,
      services: serviceAnalyses,
      summary: {
        totalTraces: serviceAnalyses.reduce((sum, analysis) => sum + analysis.totalTraces, 0),
        avgErrorRate: serviceAnalyses.reduce((sum, analysis) => sum + analysis.errorRate, 0) / services.length,
        slowestService: serviceAnalyses.reduce((slowest, current) => 
          current.p95Duration > slowest.p95Duration ? current : slowest
        ),
        mostErrorProneService: serviceAnalyses.reduce((mostErrors, current) => 
          current.errorRate > mostErrors.errorRate ? current : mostErrors
        )
      }
    };
  }
}

interface ServicePerformanceAnalysis {
  serviceName: string;
  timeRange: { start: Date; end: Date };
  totalTraces: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  slowestOperations: Array<{
    operation: string;
    avgDuration: number;
    maxDuration: number;
    count: number;
  }>;
  errorPatterns: Array<{
    message: string;
    count: number;
    percentage: number;
  }>;
  dependencyAnalysis: Record<string, any>;
}

interface PerformanceReport {
  timeRange: { start: Date; end: Date };
  services: ServicePerformanceAnalysis[];
  summary: {
    totalTraces: number;
    avgErrorRate: number;
    slowestService: ServicePerformanceAnalysis;
    mostErrorProneService: ServicePerformanceAnalysis;
  };
}
```

これらの分散トレーシング機能により、マイクロサービス環境での複雑なリクエストフローを可視化し、パフォーマンスの最適化と問題の迅速な解決を実現できます。次は[ログ集約](./15-logging-aggregation.md)について学習しましょう。