# Microservices - ログ集約

> Fluent Bit、ELK Stack、アラートシステムの実装

## 概要

マイクロサービス環境でのログ収集、集約、アラートシステムの実装方法を詳しく説明します。Fluent Bit、Elasticsearch、アラート管理システムの設定について学習します。

## 関連ファイル
- [構造化ログ](./15-structured-logging.md) - 統一ログ形式とビジネスイベント記録
- [ログ分析](./17-log-analytics.md) - ダッシュボードと異常検知
- [観測可能性基礎](./12-observability-basics.md) - 基本概念とトレーシング

## ログ集約システム

### 1. Fluent Bit設定

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

### 2. Elasticsearchインデックス設定

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index": {
      "lifecycle": {
        "name": "microservices-logs-policy",
        "rollover_alias": "microservices-logs"
      },
      "refresh_interval": "5s"
    }
  },
  "mappings": {
    "properties": {
      "timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "standard"
      },
      "service": {
        "type": "keyword"
      },
      "traceId": {
        "type": "keyword"
      },
      "spanId": {
        "type": "keyword"
      },
      "userId": {
        "type": "keyword"
      },
      "operationId": {
        "type": "keyword"
      },
      "metadata": {
        "type": "object",
        "dynamic": true
      },
      "kubernetes": {
        "properties": {
          "namespace_name": {
            "type": "keyword"
          },
          "pod_name": {
            "type": "keyword"
          },
          "container_name": {
            "type": "keyword"
          }
        }
      }
    }
  }
}
```

### 3. アラート管理システム

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

### 4. 通知サービス実装

```typescript
// shared/services/notification-service.ts
export interface NotificationChannel {
  name: string;
  send(message: NotificationMessage): Promise<void>;
}

export interface NotificationMessage {
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export class SlackNotificationChannel implements NotificationChannel {
  name = 'slack';

  constructor(private webhookUrl: string) {}

  async send(message: NotificationMessage): Promise<void> {
    const payload = {
      text: message.title,
      attachments: [
        {
          color: this.getColorFromSeverity(message.metadata?.severity),
          fields: [
            {
              title: "Message",
              value: message.message,
              short: false
            },
            {
              title: "Service",
              value: message.metadata?.service || 'Unknown',
              short: true
            },
            {
              title: "Timestamp",
              value: new Date().toISOString(),
              short: true
            }
          ]
        }
      ]
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to send Slack notification: ${response.statusText}`);
    }
  }

  private getColorFromSeverity(severity?: string): string {
    switch (severity) {
      case 'critical':
      case 'fatal':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'good';
      default:
        return '#439FE0';
    }
  }
}

export class EmailNotificationChannel implements NotificationChannel {
  name = 'email';

  constructor(
    private smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    },
    private recipients: string[]
  ) {}

  async send(message: NotificationMessage): Promise<void> {
    // SMTPクライアントを使用してメール送信
    // 実装は使用するメールライブラリに依存
    console.log(`Sending email notification: ${message.title}`);
  }
}

export class NotificationService {
  private channels = new Map<string, NotificationChannel>();

  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
  }

  async send(channelName: string, message: NotificationMessage): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      console.warn(`Notification channel not found: ${channelName}`);
      return;
    }

    try {
      await channel.send(message);
    } catch (error) {
      console.error(`Failed to send notification via ${channelName}:`, error);
    }
  }
}
```

これらのログ集約システムにより、マイクロサービス環境でのログを効率的に収集し、適切なアラート機能を提供できます。次は[ログ分析](./17-log-analytics.md)について学習しましょう。