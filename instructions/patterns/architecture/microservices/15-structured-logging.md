# Microservices - 構造化ログ

> 統一ログ形式、構造化ログ実装、ビジネスイベントロギング

## 概要

マイクロサービス環境での効果的なログ管理の基盤となる構造化ログの実装方法を詳しく説明します。統一されたログ形式、機密情報の保護、ビジネスイベントの記録について学習します。

## 関連ファイル
- [観測可能性基礎](./12-observability-basics.md) - 基本概念とトレーシング
- [ログ集約](./16-log-aggregation.md) - ログ収集とアラートシステム
- [ログ分析](./17-log-analytics.md) - ダッシュボードと異常検知

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

これらの構造化ログ実装により、マイクロサービス環境での一貫したログ管理の基盤を構築できます。統一されたログ形式とビジネスイベントの記録により、システムの状態を効果的に把握できます。次は[ログ集約](./16-log-aggregation.md)について学習しましょう。