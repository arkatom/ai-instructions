# Microservices - API Gateway 運用・セキュリティ

> モニタリング、メトリクス、セキュリティ強化、運用ベストプラクティス

## 概要

API Gateway運用・セキュリティでは、本格運用に必要なモニタリング機能、包括的なセキュリティ対策、パフォーマンス分析、運用ベストプラクティスを提供します。

## モニタリング・メトリクス

### 包括的メトリクス収集

```typescript
// api-gateway/src/monitoring/metrics-collector.ts
export class MetricsCollector {
  private metrics = new Map<string, Metric>();
  private prometheusRegistry: prometheus.Registry;

  constructor() {
    this.prometheusRegistry = new prometheus.Registry();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // HTTPリクエスト数カウンター
    this.requestCounter = new prometheus.Counter({
      name: 'gateway_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['service', 'method', 'status', 'path']
    });

    // レスポンス時間ヒストグラム
    this.responseTimeHistogram = new prometheus.Histogram({
      name: 'gateway_request_duration_seconds',
      help: 'HTTP request latencies',
      labelNames: ['service', 'method', 'status', 'path'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    // エラー率カウンター
    this.errorCounter = new prometheus.Counter({
      name: 'gateway_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['service', 'method', 'status', 'error_type']
    });

    // アクティブ接続数ゲージ
    this.activeConnectionsGauge = new prometheus.Gauge({
      name: 'gateway_active_connections',
      help: 'Number of active connections',
      labelNames: ['service']
    });

    // スループットゲージ
    this.throughputGauge = new prometheus.Gauge({
      name: 'gateway_throughput_requests_per_second',
      help: 'Requests per second',
      labelNames: ['service']
    });

    // レジストリに登録
    this.prometheusRegistry.registerMetric(this.requestCounter);
    this.prometheusRegistry.registerMetric(this.responseTimeHistogram);
    this.prometheusRegistry.registerMetric(this.errorCounter);
    this.prometheusRegistry.registerMetric(this.activeConnectionsGauge);
    this.prometheusRegistry.registerMetric(this.throughputGauge);
  }

  collectRequestMetrics(req: Request, res: Response, duration: number): void {
    const labels = {
      service: this.extractServiceName(req.path),
      method: req.method,
      status: res.statusCode.toString(),
      path: this.getPathPattern(req.path)
    };

    // レスポンス時間
    this.responseTimeHistogram.observe(labels, duration / 1000); // 秒単位

    // リクエスト数
    this.requestCounter.inc(labels);

    // エラー率
    if (res.statusCode >= 400) {
      this.errorCounter.inc({
        ...labels,
        error_type: this.getErrorType(res.statusCode)
      });
    }

    // スループット計算（移動平均）
    this.updateThroughput(labels.service);

    // カスタムメトリクス
    this.recordCustomMetrics(req, res, duration);
  }

  private extractServiceName(path: string): string {
    const match = path.match(/^\/api\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  private getPathPattern(path: string): string {
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  }

  private getErrorType(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    } else if (statusCode >= 500) {
      return 'server_error';
    }
    return 'unknown';
  }

  private updateThroughput(serviceName: string): void {
    const now = Date.now();
    const key = `throughput:${serviceName}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        windowStart: now
      });
    }

    const metric = this.metrics.get(key)!;
    metric.count++;

    // 1分間のウィンドウで計算
    if (now - metric.windowStart >= 60000) {
      const rps = metric.count / 60;
      this.throughputGauge.set({ service: serviceName }, rps);
      
      // リセット
      metric.count = 0;
      metric.windowStart = now;
    }
  }

  private recordCustomMetrics(req: Request, res: Response, duration: number): void {
    // ユーザー別メトリクス
    if (req.user) {
      this.userRequestCounter.inc({
        user_tier: req.user.tier || 'free',
        service: this.extractServiceName(req.path)
      });
    }

    // API バージョン別メトリクス
    this.versionRequestCounter.inc({
      version: req.apiVersion || 'v1',
      service: this.extractServiceName(req.path)
    });

    // レスポンスサイズ
    const responseSize = parseInt(res.getHeader('content-length') as string) || 0;
    this.responseSizeHistogram.observe({
      service: this.extractServiceName(req.path)
    }, responseSize);
  }

  // Prometheusメトリクスエンドポイント
  getMetrics(): string {
    return this.prometheusRegistry.metrics();
  }
}

interface Metric {
  count: number;
  windowStart: number;
  [key: string]: any;
}
```

### アラート・通知システム

```typescript
// api-gateway/src/monitoring/alert-manager.ts
export class AlertManager {
  private alertRules: AlertRule[] = [];
  private notificationChannels: NotificationChannel[] = [];
  private alertHistory = new Map<string, AlertHistory>();

  constructor() {
    this.setupDefaultAlertRules();
    this.startAlertEvaluation();
  }

  private setupDefaultAlertRules(): void {
    // 高エラー率アラート
    this.alertRules.push({
      name: 'high_error_rate',
      condition: (metrics) => metrics.errorRate > 0.05, // 5%
      severity: 'critical',
      message: 'Error rate is above 5%',
      cooldown: 300000 // 5分間のクールダウン
    });

    // 高レスポンス時間アラート
    this.alertRules.push({
      name: 'high_response_time',
      condition: (metrics) => metrics.avgResponseTime > 5000, // 5秒
      severity: 'warning',
      message: 'Average response time is above 5 seconds'
    });

    // サービス停止アラート
    this.alertRules.push({
      name: 'service_down',
      condition: (metrics) => metrics.healthyInstances === 0,
      severity: 'critical',
      message: 'Service has no healthy instances'
    });

    // スループット低下アラート
    this.alertRules.push({
      name: 'low_throughput',
      condition: (metrics) => metrics.throughput < metrics.expectedMinThroughput,
      severity: 'warning',
      message: 'Throughput is below expected minimum'
    });
  }

  private startAlertEvaluation(): void {
    setInterval(async () => {
      const metrics = await this.collectCurrentMetrics();
      
      for (const rule of this.alertRules) {
        await this.evaluateRule(rule, metrics);
      }
    }, 30000); // 30秒間隔
  }

  private async evaluateRule(rule: AlertRule, metrics: any): Promise<void> {
    const isTriggered = rule.condition(metrics);
    const historyKey = rule.name;
    const history = this.alertHistory.get(historyKey);

    if (isTriggered) {
      // クールダウン期間中かチェック
      if (history && Date.now() - history.lastFired < (rule.cooldown || 600000)) {
        return;
      }

      // アラート送信
      await this.sendAlert({
        name: rule.name,
        severity: rule.severity,
        message: rule.message,
        timestamp: new Date().toISOString(),
        metrics
      });

      // 履歴更新
      this.alertHistory.set(historyKey, {
        lastFired: Date.now(),
        count: (history?.count || 0) + 1
      });
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.notificationChannels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.name}:`, error);
      }
    }
  }

  addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.push(channel);
  }

  private async collectCurrentMetrics(): Promise<any> {
    // 実際の実装では各種メトリクスを収集
    return {
      errorRate: 0.03,
      avgResponseTime: 2500,
      healthyInstances: 3,
      throughput: 150,
      expectedMinThroughput: 100
    };
  }
}

interface AlertRule {
  name: string;
  condition: (metrics: any) => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cooldown?: number;
}

interface Alert {
  name: string;
  severity: string;
  message: string;
  timestamp: string;
  metrics: any;
}

interface NotificationChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

interface AlertHistory {
  lastFired: number;
  count: number;
}

// Slack通知チャンネルの実装例
export class SlackNotificationChannel implements NotificationChannel {
  name = 'slack';

  constructor(private webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    const message = {
      text: `🚨 API Gateway Alert: ${alert.name}`,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Timestamp', value: alert.timestamp, short: true }
        ]
      }]
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return '#439FE0';
    }
  }
}
```

## セキュリティ強化

### 包括的セキュリティミドルウェア

```typescript
// api-gateway/src/security/security-middleware.ts
export class SecurityMiddleware {
  // 動的レート制限
  static dynamicRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: (req: Request) => {
      // ユーザーレベルでの制限
      if (req.user?.tier === 'premium') {
        return 10000;
      } else if (req.user?.tier === 'standard') {
        return 5000;
      }
      return 1000;
    },
    keyGenerator: (req: Request) => {
      // 認証済みユーザーはユーザーID、未認証はIPアドレス
      return req.user?.id || req.ip;
    },
    onLimitReached: (req: Request, res: Response) => {
      console.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.path
      });
    }
  });

  // SQLインジェクション対策
  static sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
    const sqlPatterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
      /union.*select/gi,
      /select.*from/gi,
      /insert.*into/gi,
      /delete.*from/gi,
      /update.*set/gi,
      /drop.*table/gi,
      /create.*table/gi
    ];

    const checkForSqlInjection = (value: string) => {
      return sqlPatterns.some(pattern => pattern.test(value));
    };

    // クエリパラメーター検査
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && checkForSqlInjection(value)) {
        console.warn('SQL injection attempt detected', {
          ip: req.ip,
          path: req.path,
          parameter: key,
          value
        });
        
        return res.status(400).json({ 
          error: 'Invalid request',
          code: 'SECURITY_VIOLATION'
        });
      }
    }

    // ボディ検査
    if (req.body && typeof req.body === 'object') {
      const checkObjectRecursively = (obj: any, path: string = ''): boolean => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string' && checkForSqlInjection(value)) {
            console.warn('SQL injection attempt in body', {
              ip: req.ip,
              path: req.path,
              bodyPath: currentPath,
              value
            });
            return true;
          }
          
          if (typeof value === 'object' && value !== null) {
            if (checkObjectRecursively(value, currentPath)) {
              return true;
            }
          }
        }
        return false;
      };

      if (checkObjectRecursively(req.body)) {
        return res.status(400).json({ 
          error: 'Invalid request',
          code: 'SECURITY_VIOLATION'
        });
      }
    }

    next();
  };

  // XSS対策
  static xssProtection = (req: Request, res: Response, next: NextFunction) => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /expression\(/gi
    ];

    const checkForXSS = (obj: any, path: string = ''): boolean => {
      if (typeof obj === 'string') {
        const hasXSS = xssPatterns.some(pattern => pattern.test(obj));
        if (hasXSS) {
          console.warn('XSS attempt detected', {
            ip: req.ip,
            path: req.path,
            dataPath: path,
            value: obj
          });
        }
        return hasXSS;
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (checkForXSS(value, currentPath)) {
            return true;
          }
        }
      }
      
      return false;
    };

    if (checkForXSS(req.body, 'body') || checkForXSS(req.query, 'query')) {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'XSS_DETECTED'
      });
    }

    next();
  };

  // CSRF対策
  static csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // 状態変更を伴うメソッドのみCSRFトークンを要求
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionToken = req.session?.csrfToken;

      if (!token || !sessionToken || token !== sessionToken) {
        console.warn('CSRF token validation failed', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          hasToken: !!token,
          hasSessionToken: !!sessionToken
        });

        return res.status(403).json({
          error: 'CSRF token validation failed',
          code: 'CSRF_TOKEN_INVALID'
        });
      }
    }

    next();
  };

  // IPホワイトリスト/ブラックリスト
  static ipFiltering = (whitelist: string[] = [], blacklist: string[] = []) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip;

      // ブラックリストチェック
      if (blacklist.length > 0 && blacklist.includes(clientIP)) {
        console.warn('Blacklisted IP blocked', { ip: clientIP, path: req.path });
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLOCKED'
        });
      }

      // ホワイトリストチェック
      if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
        console.warn('Non-whitelisted IP blocked', { ip: clientIP, path: req.path });
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_NOT_WHITELISTED'
        });
      }

      next();
    };
  };

  // APIキー検証
  static apiKeyValidation = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'API_KEY_MISSING'
      });
    }

    try {
      // APIキーの検証とレート制限情報取得
      const keyInfo = await validateApiKey(apiKey);
      
      if (!keyInfo.isValid) {
        return res.status(401).json({
          error: 'Invalid API key',
          code: 'API_KEY_INVALID'
        });
      }

      if (!keyInfo.isActive) {
        return res.status(403).json({
          error: 'API key is suspended',
          code: 'API_KEY_SUSPENDED'
        });
      }

      // APIキー情報をリクエストに追加
      req.apiKey = keyInfo;
      next();
    } catch (error) {
      console.error('API key validation error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        code: 'API_KEY_VALIDATION_ERROR'
      });
    }
  };
}

// ヘルパー関数
async function validateApiKey(apiKey: string): Promise<ApiKeyInfo> {
  // データベースまたはキャッシュからAPIキー情報を取得
  // 実装例
  return {
    isValid: true,
    isActive: true,
    tier: 'standard',
    rateLimit: 1000,
    allowedServices: ['users', 'orders']
  };
}

interface ApiKeyInfo {
  isValid: boolean;
  isActive: boolean;
  tier: string;
  rateLimit: number;
  allowedServices: string[];
}

// Express Requestインターフェースの拡張
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyInfo;
      session?: {
        csrfToken?: string;
      };
    }
  }
}
```

## 運用ベストプラクティス

### ヘルスチェック・診断

```typescript
// api-gateway/src/operations/health-diagnostics.ts
export class HealthDiagnostics {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private loadBalancer: LoadBalancer
  ) {}

  async getDetailedHealthStatus(): Promise<HealthReport> {
    const report: HealthReport = {
      gateway: await this.getGatewayHealth(),
      services: await this.getServicesHealth(),
      infrastructure: await this.getInfrastructureHealth(),
      timestamp: new Date().toISOString()
    };

    report.overall = this.calculateOverallHealth(report);
    return report;
  }

  private async getGatewayHealth(): Promise<ComponentHealth> {
    const checks: HealthCheck[] = [];

    // メモリ使用量チェック
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.push({
      name: 'memory_usage',
      status: memUsagePercent < 80 ? 'healthy' : 'unhealthy',
      message: `Memory usage: ${memUsagePercent.toFixed(2)}%`,
      value: memUsagePercent
    });

    // CPU使用量チェック（簡易版）
    const cpuUsage = process.cpuUsage();
    checks.push({
      name: 'cpu_usage',
      status: 'healthy', // 実際の実装では適切な計算
      message: 'CPU usage is normal',
      value: 0
    });

    // アクティブ接続数チェック
    const activeConnections = await this.getActiveConnectionCount();
    checks.push({
      name: 'active_connections',
      status: activeConnections < 1000 ? 'healthy' : 'warning',
      message: `Active connections: ${activeConnections}`,
      value: activeConnections
    });

    return {
      name: 'api_gateway',
      status: checks.every(c => c.status === 'healthy') ? 'healthy' : 'unhealthy',
      checks
    };
  }

  private async getServicesHealth(): Promise<ComponentHealth[]> {
    const serviceNames = ['user-service', 'order-service', 'inventory-service', 'payment-service'];
    const serviceHealths: ComponentHealth[] = [];

    for (const serviceName of serviceNames) {
      const checks: HealthCheck[] = [];

      try {
        // サービスインスタンス数チェック
        const instances = await this.serviceRegistry.discover(serviceName);
        const healthyInstances = instances.filter(i => i.status === 'UP').length;
        
        checks.push({
          name: 'instance_count',
          status: healthyInstances > 0 ? 'healthy' : 'unhealthy',
          message: `${healthyInstances}/${instances.length} instances healthy`,
          value: healthyInstances
        });

        // サービス応答性チェック
        const responseTime = await this.measureServiceResponseTime(serviceName);
        checks.push({
          name: 'response_time',
          status: responseTime < 5000 ? 'healthy' : 'unhealthy',
          message: `Response time: ${responseTime}ms`,
          value: responseTime
        });

        // エラー率チェック
        const errorRate = await this.getServiceErrorRate(serviceName);
        checks.push({
          name: 'error_rate',
          status: errorRate < 0.05 ? 'healthy' : 'unhealthy',
          message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
          value: errorRate
        });

      } catch (error) {
        checks.push({
          name: 'service_discovery',
          status: 'unhealthy',
          message: `Service discovery failed: ${error.message}`,
          value: 0
        });
      }

      serviceHealths.push({
        name: serviceName,
        status: checks.every(c => c.status === 'healthy') ? 'healthy' : 'unhealthy',
        checks
      });
    }

    return serviceHealths;
  }

  private async getInfrastructureHealth(): Promise<ComponentHealth> {
    const checks: HealthCheck[] = [];

    // データベース接続チェック
    try {
      await this.checkDatabaseConnection();
      checks.push({
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        value: 1
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        value: 0
      });
    }

    // Redis接続チェック
    try {
      await this.checkRedisConnection();
      checks.push({
        name: 'redis',
        status: 'healthy',
        message: 'Redis connection is healthy',
        value: 1
      });
    } catch (error) {
      checks.push({
        name: 'redis',
        status: 'unhealthy',
        message: `Redis connection failed: ${error.message}`,
        value: 0
      });
    }

    return {
      name: 'infrastructure',
      status: checks.every(c => c.status === 'healthy') ? 'healthy' : 'unhealthy',
      checks
    };
  }

  private calculateOverallHealth(report: HealthReport): 'healthy' | 'degraded' | 'unhealthy' {
    const allComponents = [report.gateway, ...report.services, report.infrastructure];
    const healthyCount = allComponents.filter(c => c.status === 'healthy').length;
    const healthyRatio = healthyCount / allComponents.length;

    if (healthyRatio === 1) {
      return 'healthy';
    } else if (healthyRatio >= 0.7) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private async getActiveConnectionCount(): Promise<number> {
    // 実装では実際のアクティブ接続数を取得
    return 150;
  }

  private async measureServiceResponseTime(serviceName: string): Promise<number> {
    const startTime = Date.now();
    try {
      const serviceUrl = await this.serviceRegistry.getServiceUrl(serviceName);
      await fetch(`${serviceUrl}/health`, { timeout: 5000 });
      return Date.now() - startTime;
    } catch (error) {
      return 9999; // エラーの場合は高いレスポンス時間を返す
    }
  }

  private async getServiceErrorRate(serviceName: string): Promise<number> {
    // 実装では実際のエラー率を計算
    return 0.02; // 2%
  }

  private async checkDatabaseConnection(): Promise<void> {
    // データベース接続テスト
    // 実装例：SELECT 1 クエリの実行
  }

  private async checkRedisConnection(): Promise<void> {
    // Redis接続テスト  
    // 実装例：PING コマンドの実行
  }
}

interface HealthReport {
  gateway: ComponentHealth;
  services: ComponentHealth[];
  infrastructure: ComponentHealth;
  overall?: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  value: number;
}
```

## 関連ファイル

- **[API Gateway コア実装](./03a-api-gateway-core.md)** - 基本構造、認証・認可、サーキットブレーカー、ロギング
- **[API Gateway 高度な機能](./03b-api-gateway-advanced.md)** - バージョニング、キャッシュ、ロードバランシング

API Gatewayの包括的な運用・セキュリティ機能により、本格的なマイクロサービスアーキテクチャの統一エントリーポイントとして、安全で信頼性の高いシステムを実現できます。