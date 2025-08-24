# Microservices - 観測可能性（Observability）

> ログ、メトリクス、トレーシング、ヘルスチェックによる分散システムの可視化

## 概要

マイクロサービスアーキテクチャの観測可能性は、分散システムの健全性、パフォーマンス、問題の特定に不可欠です。Three Pillars（ログ、メトリクス、トレーシング）とヘルスチェックにより、システムの完全な可視化を実現します。

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

## 構造化ログ実装

### 1. 統一ログ形式

```typescript
// shared/logging/structured-logger.ts
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  operationId?: string;
  metadata?: Record<string, any>;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export class StructuredLogger {
  constructor(
    private serviceName: string,
    private logLevel: LogLevel = LogLevel.INFO
  ) {}

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : {};

    this.log(LogLevel.ERROR, message, { ...metadata, ...errorMetadata });
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : {};

    this.log(LogLevel.FATAL, message, { ...metadata, ...errorMetadata });
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      traceId: this.getCurrentTraceId(),
      spanId: this.getCurrentSpanId(),
      userId: this.getCurrentUserId(),
      operationId: this.getCurrentOperationId(),
      metadata: this.sanitizeMetadata(metadata)
    };

    // 構造化されたJSONとして出力
    console.log(JSON.stringify(logEntry));
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }

  private getCurrentTraceId(): string | undefined {
    // OpenTelemetryから現在のトレースIDを取得
    const activeSpan = trace.getActiveSpan();
    return activeSpan?.spanContext()?.traceId;
  }

  private getCurrentSpanId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    return activeSpan?.spanContext()?.spanId;
  }

  private getCurrentUserId(): string | undefined {
    // 現在のリクエストコンテキストからユーザーIDを取得
    // 実装は使用するフレームワークに依存
    return undefined;
  }

  private getCurrentOperationId(): string | undefined {
    // 現在の操作IDを取得（リクエストIDなど）
    return undefined;
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    
    // 機密情報をマスク
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'creditCard'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// ビジネス操作用のロガー
export class BusinessLogger extends StructuredLogger {
  logBusinessEvent(
    eventType: string,
    entityId: string,
    entityType: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`Business event: ${eventType}`, {
      eventType,
      entity: {
        id: entityId,
        type: entityType
      },
      action,
      ...metadata
    });
  }

  logPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      success,
      performance: true,
      ...metadata
    });
  }

  logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): void {
    const logMethod = severity === 'critical' ? this.error : 
                     severity === 'high' ? this.warn : this.info;

    logMethod.call(this, `Security event: ${eventType}`, {
      security: true,
      eventType,
      severity,
      ...metadata
    });
  }
}
```

### 2. ログアグリゲーション設定

```yaml
# logging/fluent-bit.conf
[SERVICE]
    Flush         1
    Log_Level     info
    Daemon        off
    Parsers_File  parsers.conf
    HTTP_Server   On
    HTTP_Listen   0.0.0.0
    HTTP_Port     2020

[INPUT]
    Name              tail
    Path              /var/log/containers/*.log
    Parser            docker
    Tag               kube.*
    Refresh_Interval  5
    Mem_Buf_Limit     50MB
    Skip_Long_Lines   On

[FILTER]
    Name                kubernetes
    Match               kube.*
    Kube_URL            https://kubernetes.default.svc:443
    Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
    Kube_Tag_Prefix     kube.var.log.containers.
    Merge_Log           On
    Keep_Log            Off

[FILTER]
    Name                parser
    Match               kube.*
    Key_Name            log
    Parser              json
    Reserve_Data        On
    Preserve_Key        On

[OUTPUT]
    Name   es
    Match  kube.*
    Host   elasticsearch
    Port   9200
    Index  microservices-logs
    Type   _doc
```

## アラートとダッシュボード

### 1. アラート管理

```typescript
// shared/monitoring/alert-manager.ts
export interface Alert {
  id: string;
  severity: AlertSeverity;
  summary: string;
  description: string;
  service: string;
  timestamp: Date;
  resolved?: Date;
  metadata?: Record<string, any>;
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  FATAL = 'fatal'
}

export class AlertManager {
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];

  constructor(
    private notificationService: NotificationService,
    private metricsService: MetricsService
  ) {}

  async sendAlert(
    severity: AlertSeverity,
    summary: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alert: Alert = {
      id: crypto.randomUUID(),
      severity,
      summary,
      description,
      service: process.env.SERVICE_NAME || 'unknown',
      timestamp: new Date(),
      metadata
    };

    // 重複アラート検査
    const existingAlert = this.findSimilarAlert(alert);
    if (existingAlert && !this.shouldSendDuplicateAlert(existingAlert, alert)) {
      return;
    }

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // メトリクス記録
    this.metricsService.recordCustomMetric('alerts_sent_total', 1, {
      severity: severity.toString(),
      service: alert.service
    });

    // 通知送信
    await this.sendNotification(alert);
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    alert.resolved = new Date();
    this.activeAlerts.delete(alertId);

    // 解決通知
    await this.sendResolutionNotification(alert);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  private findSimilarAlert(newAlert: Alert): Alert | undefined {
    for (const alert of this.activeAlerts.values()) {
      if (alert.summary === newAlert.summary && 
          alert.service === newAlert.service &&
          alert.severity === newAlert.severity) {
        return alert;
      }
    }
    return undefined;
  }

  private shouldSendDuplicateAlert(existingAlert: Alert, newAlert: Alert): boolean {
    const timeDiff = newAlert.timestamp.getTime() - existingAlert.timestamp.getTime();
    const suppressionTime = this.getSuppressionTime(newAlert.severity);
    
    return timeDiff > suppressionTime;
  }

  private getSuppressionTime(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 5 * 60 * 1000; // 5分
      case AlertSeverity.WARNING:
        return 15 * 60 * 1000; // 15分
      case AlertSeverity.INFO:
        return 60 * 60 * 1000; // 1時間
      default:
        return 30 * 60 * 1000; // 30分
    }
  }

  private async sendNotification(alert: Alert): Promise<void> {
    const channels = this.getNotificationChannels(alert.severity);
    
    for (const channel of channels) {
      await this.notificationService.send(channel, {
        title: `${alert.severity.toUpperCase()}: ${alert.summary}`,
        message: alert.description,
        metadata: alert.metadata
      });
    }
  }

  private async sendResolutionNotification(alert: Alert): Promise<void> {
    const channels = this.getNotificationChannels(alert.severity);
    
    for (const channel of channels) {
      await this.notificationService.send(channel, {
        title: `RESOLVED: ${alert.summary}`,
        message: `Alert has been resolved after ${this.formatDuration(alert)}`,
        metadata: alert.metadata
      });
    }
  }

  private getNotificationChannels(severity: AlertSeverity): string[] {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.FATAL:
        return ['slack', 'email', 'pagerduty'];
      case AlertSeverity.WARNING:
        return ['slack', 'email'];
      case AlertSeverity.INFO:
        return ['slack'];
      default:
        return ['slack'];
    }
  }

  private formatDuration(alert: Alert): string {
    if (!alert.resolved) return 'unknown';
    
    const duration = alert.resolved.getTime() - alert.timestamp.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }
}
```

### 2. Grafanaダッシュボード設定

```json
{
  "dashboard": {
    "title": "Microservices Overview",
    "tags": ["microservices", "overview"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"4..|5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Error Rate (%)",
            "max": 1,
            "min": 0
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))",
            "legendFormat": "{{service}} 95th percentile"
          }
        ]
      },
      {
        "title": "Service Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"microservices\"} == 1",
            "legendFormat": "{{service}}"
          }
        ]
      }
    ]
  }
}
```

観測可能性の実装により、マイクロサービス環境での問題の迅速な特定と解決、パフォーマンスの最適化、システムの健全性維持が可能になります。