# Microservices - ログ集約

> ELK Stack、構造化ログ、アラートシステムの実装

## 概要

マイクロサービス環境でのログ管理は、各サービスからのログを一元的に集約し、検索可能な形で保存し、リアルタイムで分析できるシステムの構築が重要です。ELK Stack、Fluent Bit、アラートシステムの実装方法を詳しく説明します。

## 関連ファイル
- [観測可能性基礎](./12-observability-basics.md) - 基本概念とトレーシング
- [メトリクス監視](./13-metrics-monitoring.md) - メトリクス収集と監視システム
- [分散トレーシング](./14-distributed-tracing.md) - トレーシングシステムの実装

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

### 2. ログ集約システム

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

### 3. アラート管理

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

### 4. ログ分析とダッシュボード

```json
{
  "dashboard": {
    "title": "Microservices Logs Dashboard",
    "tags": ["microservices", "logs"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Log Volume by Service",
        "type": "graph",
        "targets": [
          {
            "query": "service:* | stats count by service",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "query": "level:error | stats count",
            "legendFormat": "Errors"
          }
        ]
      },
      {
        "title": "Recent Errors",
        "type": "logs",
        "targets": [
          {
            "query": "level:error | sort @timestamp desc | limit 100"
          }
        ]
      },
      {
        "title": "Response Time Distribution",
        "type": "heatmap",
        "targets": [
          {
            "query": "performance:true | stats avg(duration) by bin(@timestamp, 1m)"
          }
        ]
      }
    ]
  }
}
```

### 5. 高度なログ分析

```typescript
// shared/analytics/log-analyzer.ts
export class LogAnalyzer {
  constructor(
    private elasticsearchClient: ElasticsearchClient,
    private alertManager: AlertManager
  ) {}

  async detectAnomalies(timeRange: { start: Date; end: Date }): Promise<LogAnomaly[]> {
    const anomalies: LogAnomaly[] = [];

    // エラー率の異常検出
    const errorRateAnomalies = await this.detectErrorRateAnomalies(timeRange);
    anomalies.push(...errorRateAnomalies);

    // レスポンスタイムの異常検出
    const responseTimeAnomalies = await this.detectResponseTimeAnomalies(timeRange);
    anomalies.push(...responseTimeAnomalies);

    // 異常なログパターンの検出
    const patternAnomalies = await this.detectLogPatternAnomalies(timeRange);
    anomalies.push(...patternAnomalies);

    return anomalies;
  }

  private async detectErrorRateAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
    const query = {
      query: {
        bool: {
          must: [
            {
              range: {
                timestamp: {
                  gte: timeRange.start.toISOString(),
                  lte: timeRange.end.toISOString()
                }
              }
            }
          ]
        }
      },
      aggs: {
        services: {
          terms: {
            field: 'service.keyword',
            size: 50
          },
          aggs: {
            error_rate: {
              filter: {
                term: { level: 'error' }
              }
            },
            total_logs: {
              value_count: {
                field: 'timestamp'
              }
            }
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const anomalies: LogAnomaly[] = [];
    const servicesBuckets = response.body.aggregations.services.buckets;

    for (const bucket of servicesBuckets) {
      const errorCount = bucket.error_rate.doc_count;
      const totalCount = bucket.total_logs.value;
      const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

      // エラー率が5%を超えた場合は異常とみなす
      if (errorRate > 0.05) {
        anomalies.push({
          type: 'error_rate',
          service: bucket.key,
          severity: errorRate > 0.1 ? 'critical' : 'warning',
          description: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          value: errorRate,
          threshold: 0.05,
          timeRange
        });
      }
    }

    return anomalies;
  }

  private async detectResponseTimeAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
    // レスポンスタイムの異常検出ロジック
    // 統計的な手法で異常値を検出
    return [];
  }

  private async detectLogPatternAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
    // ログメッセージのパターン分析
    // 機械学習を使った異常検出
    return [];
  }

  async generateLogReport(
    timeRange: { start: Date; end: Date }
  ): Promise<LogReport> {
    const [volumeStats, errorStats, performanceStats, anomalies] = await Promise.all([
      this.getLogVolumeStats(timeRange),
      this.getErrorStats(timeRange),
      this.getPerformanceStats(timeRange),
      this.detectAnomalies(timeRange)
    ]);

    return {
      timeRange,
      volumeStats,
      errorStats,
      performanceStats,
      anomalies,
      summary: {
        totalLogs: volumeStats.totalLogs,
        errorRate: errorStats.overallErrorRate,
        avgResponseTime: performanceStats.avgResponseTime,
        anomalyCount: anomalies.length
      }
    };
  }

  private async getLogVolumeStats(timeRange: { start: Date; end: Date }): Promise<LogVolumeStats> {
    // ログボリューム統計の取得
    return {
      totalLogs: 0,
      logsByService: {},
      logsByLevel: {}
    };
  }

  private async getErrorStats(timeRange: { start: Date; end: Date }): Promise<ErrorStats> {
    // エラー統計の取得
    return {
      overallErrorRate: 0,
      errorsByService: {},
      commonErrors: []
    };
  }

  private async getPerformanceStats(timeRange: { start: Date; end: Date }): Promise<PerformanceStats> {
    // パフォーマンス統計の取得
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowestOperations: []
    };
  }
}

interface LogAnomaly {
  type: string;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  value: number;
  threshold: number;
  timeRange: { start: Date; end: Date };
}

interface LogReport {
  timeRange: { start: Date; end: Date };
  volumeStats: LogVolumeStats;
  errorStats: ErrorStats;
  performanceStats: PerformanceStats;
  anomalies: LogAnomaly[];
  summary: {
    totalLogs: number;
    errorRate: number;
    avgResponseTime: number;
    anomalyCount: number;
  };
}

interface LogVolumeStats {
  totalLogs: number;
  logsByService: Record<string, number>;
  logsByLevel: Record<string, number>;
}

interface ErrorStats {
  overallErrorRate: number;
  errorsByService: Record<string, number>;
  commonErrors: Array<{
    message: string;
    count: number;
    services: string[];
  }>;
}

interface PerformanceStats {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowestOperations: Array<{
    operation: string;
    service: string;
    avgDuration: number;
  }>;
}
```

これらのログ集約と分析機能により、マイクロサービス環境での問題の迅速な特定、パフォーマンスの最適化、システムの健全性維持を実現できます。適切なログ管理戦略により、包括的な観測可能性を構築しましょう。