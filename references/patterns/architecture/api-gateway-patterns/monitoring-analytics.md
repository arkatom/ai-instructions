# Monitoring & Analytics

> 🎯 **目的**: API Gatewayの包括的監視とパフォーマンス分析システムの実装
> 
> 📊 **対象**: Prometheus、分散トレーシング、ログ集約、リアルタイム監視
> 
> ⚡ **特徴**: メトリクス収集、アラート、ダッシュボード、SLA監視

## Core Metrics Collection

```typescript
// src/gateway/monitoring/MetricsCollector.ts
import { Request, Response, NextFunction } from 'express';
import * as promClient from 'prom-client';

export class MetricsCollector {
  private register: promClient.Registry;
  private httpDuration: promClient.Histogram;
  private httpRequests: promClient.Counter;
  private httpErrors: promClient.Counter;
  private activeConnections: promClient.Gauge;
  private serviceLatency: promClient.Histogram;
  private cacheHits: promClient.Counter;
  private cacheMisses: promClient.Counter;

  constructor(config: MonitoringConfig) {
    this.register = new promClient.Registry();
    
    // Default metrics
    promClient.collectDefaultMetrics({ 
      register: this.register,
      prefix: 'gateway_'
    });

    // HTTP metrics
    this.httpDuration = new promClient.Histogram({
      name: 'gateway_http_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });
    this.register.registerMetric(this.httpDuration);

    this.httpRequests = new promClient.Counter({
      name: 'gateway_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    this.register.registerMetric(this.httpRequests);

    this.httpErrors = new promClient.Counter({
      name: 'gateway_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'error_type']
    });
    this.register.registerMetric(this.httpErrors);

    this.activeConnections = new promClient.Gauge({
      name: 'gateway_active_connections',
      help: 'Number of active connections'
    });
    this.register.registerMetric(this.activeConnections);

    // Service metrics
    this.serviceLatency = new promClient.Histogram({
      name: 'gateway_service_latency_seconds',
      help: 'Latency of service calls',
      labelNames: ['service', 'method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });
    this.register.registerMetric(this.serviceLatency);

    // Cache metrics
    this.cacheHits = new promClient.Counter({
      name: 'gateway_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheHits);

    this.cacheMisses = new promClient.Counter({
      name: 'gateway_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_name']
    });
    this.register.registerMetric(this.cacheMisses);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      // Increment active connections
      this.activeConnections.inc();

      // Capture response
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        
        // Record metrics
        this.httpDuration.observe(
          { 
            method: req.method, 
            route, 
            status_code: res.statusCode 
          },
          duration
        );
        
        this.httpRequests.inc({
          method: req.method,
          route,
          status_code: res.statusCode
        });

        // Decrement active connections
        this.activeConnections.dec();
      });

      next();
    };
  }

  recordServiceCall(
    service: string,
    method: string,
    status: number,
    duration: number
  ): void {
    this.serviceLatency.observe(
      { service, method, status: status.toString() },
      duration / 1000
    );
  }

  recordError(service: string, error: string): void {
    this.httpErrors.inc({
      method: 'PROXY',
      route: service,
      error_type: error
    });
  }

  recordCacheHit(cacheName: string): void {
    this.cacheHits.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName: string): void {
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  getMetrics(): string {
    return this.register.metrics();
  }

  async getMetricsAsJSON(): Promise<any> {
    return this.register.getMetricsAsJSON();
  }
}
```

## Distributed Tracing Implementation

```typescript
// src/gateway/monitoring/TracingManager.ts
import { Tracer, Span, SpanContext } from 'opentracing';
import { JaegerTracer } from 'jaeger-client';

export class TracingManager {
  private tracer: Tracer;

  constructor(config: TracingConfig) {
    this.tracer = new JaegerTracer({
      serviceName: config.serviceName || 'api-gateway',
      sampler: {
        type: config.samplerType || 'const',
        param: config.samplerParam || 1
      },
      reporter: {
        agentHost: config.jaegerHost || 'localhost',
        agentPort: config.jaegerPort || 6832,
        logSpans: config.logSpans || false
      }
    });
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Extract span context from headers
      const spanContext = this.tracer.extract(
        'http_headers',
        req.headers
      );

      // Start new span
      const span = this.tracer.startSpan(
        `${req.method} ${req.path}`,
        { childOf: spanContext }
      );

      // Add tags
      span.setTag('http.method', req.method);
      span.setTag('http.url', req.url);
      span.setTag('user.id', req.user?.id);
      span.setTag('correlation.id', req.correlationId);

      // Attach span to request
      req.span = span;

      // Inject span context into headers for downstream services
      const headers: any = {};
      this.tracer.inject(span, 'http_headers', headers);
      req.traceHeaders = headers;

      res.on('finish', () => {
        span.setTag('http.status_code', res.statusCode);
        if (res.statusCode >= 400) {
          span.setTag('error', true);
          span.setTag('error.kind', res.statusCode >= 500 ? 'server' : 'client');
        }
        span.finish();
      });

      next();
    };
  }

  createChildSpan(parentSpan: Span, operationName: string): Span {
    return this.tracer.startSpan(operationName, { childOf: parentSpan });
  }

  finishSpan(span: Span, error?: Error): void {
    if (error) {
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      span.setTag('error.stack', error.stack);
    }
    span.finish();
  }
}
```

## Advanced Logging System

```typescript
// src/gateway/monitoring/Logger.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export class AdvancedLogger {
  private logger: winston.Logger;

  constructor(config: LoggingConfig) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
          })
        )
      })
    ];

    // Add Elasticsearch transport if configured
    if (config.elasticsearch) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: config.elasticsearch.node,
            auth: config.elasticsearch.auth
          },
          index: config.elasticsearch.index || 'gateway-logs'
        })
      );
    }

    // Add file transport for production
    if (config.file) {
      transports.push(
        new winston.transports.File({
          filename: config.file.path,
          level: config.file.level || 'error',
          format: winston.format.json()
        })
      );
    }

    this.logger = winston.createLogger({
      level: config.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      defaultMeta: {
        service: 'api-gateway',
        version: process.env.APP_VERSION || '1.0.0'
      }
    });
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      // Log request
      this.logger.info('Request received', {
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.user?.id
      });

      res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';

        this.logger.log(logLevel, 'Request completed', {
          correlationId: req.correlationId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('content-length'),
          userId: req.user?.id
        });
      });

      next();
    };
  }

  logServiceCall(service: string, method: string, duration: number, status: number, error?: Error): void {
    const logData = {
      service,
      method,
      duration,
      status,
      timestamp: new Date().toISOString()
    };

    if (error) {
      this.logger.error('Service call failed', {
        ...logData,
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    } else {
      this.logger.info('Service call completed', logData);
    }
  }

  logCircuitBreakerEvent(service: string, state: string, reason?: string): void {
    this.logger.warn('Circuit breaker state change', {
      service,
      state,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  logRateLimitEvent(key: string, limit: number, current: number): void {
    this.logger.warn('Rate limit exceeded', {
      key,
      limit,
      current,
      timestamp: new Date().toISOString()
    });
  }

  logSecurityEvent(type: string, details: any): void {
    this.logger.error('Security event', {
      type,
      details,
      timestamp: new Date().toISOString()
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }
}
```

## Performance Analytics

```typescript
// src/gateway/monitoring/PerformanceAnalytics.ts
export class PerformanceAnalytics {
  private redis: Redis;
  private metricsBuffer: Map<string, any[]> = new Map();
  private flushInterval: NodeJS.Timeout;

  constructor(config: AnalyticsConfig) {
    this.redis = new Redis({
      host: config.redis.host || 'localhost',
      port: config.redis.port || 6379
    });

    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  recordRequestMetrics(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    const timestamp = Date.now();
    const metric = {
      method,
      path,
      statusCode,
      duration,
      userId,
      timestamp
    };

    // Buffer metrics
    const key = `${method}:${path}`;
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }
    this.metricsBuffer.get(key)!.push(metric);
  }

  recordServiceMetrics(
    service: string,
    operation: string,
    duration: number,
    success: boolean
  ): void {
    const timestamp = Date.now();
    const metric = {
      service,
      operation,
      duration,
      success,
      timestamp
    };

    const key = `service:${service}`;
    if (!this.metricsBuffer.has(key)) {
      this.metricsBuffer.set(key, []);
    }
    this.metricsBuffer.get(key)!.push(metric);
  }

  private async flushMetrics(): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [key, metrics] of this.metricsBuffer.entries()) {
      if (metrics.length === 0) continue;

      // Calculate aggregates
      const aggregate = this.calculateAggregates(metrics);
      
      // Store time-series data
      const timeKey = `metrics:${key}:${Math.floor(Date.now() / 60000)}`;
      pipeline.hset(timeKey, aggregate);
      pipeline.expire(timeKey, 86400); // 24 hours

      // Store raw data for detailed analysis
      const rawKey = `raw:${key}:${Date.now()}`;
      pipeline.lpush(rawKey, ...metrics.map(m => JSON.stringify(m)));
      pipeline.expire(rawKey, 3600); // 1 hour

      // Clear buffer
      metrics.length = 0;
    }

    try {
      await pipeline.exec();
    } catch (error) {
      console.error('Failed to flush metrics:', error);
    }
  }

  private calculateAggregates(metrics: any[]): any {
    const durations = metrics.map(m => m.duration);
    const statusCodes = metrics.map(m => m.statusCode);
    
    return {
      count: metrics.length,
      avg_duration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min_duration: Math.min(...durations),
      max_duration: Math.max(...durations),
      p95_duration: this.percentile(durations, 0.95),
      p99_duration: this.percentile(durations, 0.99),
      error_rate: statusCodes.filter(sc => sc >= 400).length / statusCodes.length,
      timestamp: Date.now()
    };
  }

  private percentile(values: number[], p: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  async getAnalytics(
    timeRange: string,
    granularity: string = 'minute'
  ): Promise<any> {
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const range = ranges[timeRange as keyof typeof ranges] || ranges['1h'];
    const startTime = now - range;

    const granularityMs = {
      'minute': 60 * 1000,
      'hour': 60 * 60 * 1000,
      'day': 24 * 60 * 60 * 1000
    }[granularity] || 60 * 1000;

    const keys = [];
    for (let time = startTime; time <= now; time += granularityMs) {
      const keyTime = Math.floor(time / granularityMs) * granularityMs;
      keys.push(`metrics:*:${Math.floor(keyTime / 60000)}`);
    }

    try {
      const results = await this.redis.mget(...keys);
      return this.processAnalyticsResults(results, keys);
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return null;
    }
  }

  private processAnalyticsResults(results: any[], keys: string[]): any {
    const processed = results.map((result, index) => {
      if (!result) return null;
      
      try {
        return {
          timestamp: this.extractTimestampFromKey(keys[index]),
          ...JSON.parse(result)
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return {
      timeSeries: processed,
      summary: this.calculateSummaryStats(processed)
    };
  }

  private extractTimestampFromKey(key: string): number {
    const parts = key.split(':');
    return parseInt(parts[parts.length - 1]) * 60000;
  }

  private calculateSummaryStats(data: any[]): any {
    if (data.length === 0) return {};

    const totalRequests = data.reduce((sum, d) => sum + d.count, 0);
    const avgDuration = data.reduce((sum, d) => sum + (d.avg_duration * d.count), 0) / totalRequests;
    const avgErrorRate = data.reduce((sum, d) => sum + (d.error_rate * d.count), 0) / totalRequests;

    return {
      totalRequests,
      avgDuration,
      avgErrorRate,
      peakDuration: Math.max(...data.map(d => d.max_duration)),
      timeRange: {
        start: Math.min(...data.map(d => d.timestamp)),
        end: Math.max(...data.map(d => d.timestamp))
      }
    };
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushMetrics(); // Final flush
  }
}
```

## Alerting System

```typescript
// src/gateway/monitoring/AlertManager.ts
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  enabled: boolean;
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private alertState: Map<string, any> = new Map();
  private checkInterval: NodeJS.Timeout;

  constructor(private config: AlertConfig) {
    this.loadRules(config.rules || []);
    
    // Check alerts every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 30000);
  }

  private loadRules(rules: AlertRule[]): void {
    rules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  private async checkAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(rule);
        await this.handleAlertState(ruleId, rule, shouldAlert);
      } catch (error) {
        console.error(`Error checking alert rule ${ruleId}:`, error);
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    // This would integrate with your metrics system
    // For example, query Prometheus or your analytics system
    const metrics = await this.getMetricsForRule(rule);
    
    switch (rule.condition) {
      case 'response_time_high':
        return metrics.avgResponseTime > rule.threshold;
        
      case 'error_rate_high':
        return metrics.errorRate > rule.threshold;
        
      case 'throughput_low':
        return metrics.throughput < rule.threshold;
        
      case 'cpu_usage_high':
        return metrics.cpuUsage > rule.threshold;
        
      case 'memory_usage_high':
        return metrics.memoryUsage > rule.threshold;
        
      default:
        return false;
    }
  }

  private async getMetricsForRule(rule: AlertRule): Promise<any> {
    // Mock implementation - replace with actual metrics queries
    return {
      avgResponseTime: Math.random() * 1000,
      errorRate: Math.random() * 0.1,
      throughput: Math.random() * 1000,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100
    };
  }

  private async handleAlertState(
    ruleId: string,
    rule: AlertRule,
    shouldAlert: boolean
  ): Promise<void> {
    const currentState = this.alertState.get(ruleId) || {
      alerting: false,
      since: null,
      notificationsSent: 0
    };

    if (shouldAlert && !currentState.alerting) {
      // Start alerting
      currentState.alerting = true;
      currentState.since = Date.now();
      currentState.notificationsSent = 0;
      this.alertState.set(ruleId, currentState);
      
      await this.sendAlert(rule, 'started');
    } else if (shouldAlert && currentState.alerting) {
      // Continue alerting
      const alertDuration = Date.now() - currentState.since;
      if (alertDuration >= rule.duration) {
        await this.sendAlert(rule, 'continuing');
        currentState.notificationsSent++;
        this.alertState.set(ruleId, currentState);
      }
    } else if (!shouldAlert && currentState.alerting) {
      // Stop alerting
      currentState.alerting = false;
      currentState.since = null;
      this.alertState.set(ruleId, currentState);
      
      await this.sendAlert(rule, 'resolved');
    }
  }

  private async sendAlert(rule: AlertRule, status: string): Promise<void> {
    const alert = {
      rule: rule.name,
      severity: rule.severity,
      status,
      timestamp: new Date().toISOString(),
      threshold: rule.threshold,
      condition: rule.condition
    };

    for (const channel of rule.channels) {
      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        console.error(`Failed to send alert to ${channel}:`, error);
      }
    }
  }

  private async sendToChannel(channel: string, alert: any): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendSlackAlert(alert);
        break;
      case 'email':
        await this.sendEmailAlert(alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert);
        break;
    }
  }

  private async sendSlackAlert(alert: any): Promise<void> {
    // Slack webhook implementation
    const webhook = this.config.channels?.slack?.webhook;
    if (!webhook) return;

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Alert: ${alert.rule}`,
        attachments: [{
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Status', value: alert.status, short: true },
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Condition', value: alert.condition, short: true },
            { title: 'Threshold', value: alert.threshold.toString(), short: true }
          ],
          timestamp: Math.floor(Date.now() / 1000)
        }]
      })
    });
  }

  private async sendEmailAlert(alert: any): Promise<void> {
    // Email implementation using nodemailer or similar
    console.log('Sending email alert:', alert);
  }

  private async sendPagerDutyAlert(alert: any): Promise<void> {
    // PagerDuty integration
    console.log('Sending PagerDuty alert:', alert);
  }

  private async sendWebhookAlert(alert: any): Promise<void> {
    const webhook = this.config.channels?.webhook?.url;
    if (!webhook) return;

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    });
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff4500',
      critical: '#ff0000'
    };
    return colors[severity as keyof typeof colors] || '#808080';
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.alertState.delete(ruleId);
  }

  getActiveAlerts(): any[] {
    const activeAlerts = [];
    for (const [ruleId, state] of this.alertState.entries()) {
      if (state.alerting) {
        const rule = this.rules.get(ruleId);
        activeAlerts.push({
          ruleId,
          rule: rule?.name,
          severity: rule?.severity,
          since: state.since,
          duration: Date.now() - state.since
        });
      }
    }
    return activeAlerts;
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
```

## Configuration Examples

```yaml
# Monitoring configuration
monitoring:
  metrics:
    enabled: true
    prometheus:
      port: 9090
      path: /metrics
    
  tracing:
    enabled: true
    jaeger:
      host: jaeger.monitoring.svc.cluster.local
      port: 6832
      sampler_type: probabilistic
      sampler_param: 0.1
    
  logging:
    level: info
    elasticsearch:
      node: https://elasticsearch.monitoring.svc.cluster.local:9200
      index: gateway-logs
      auth:
        username: elastic
        password: secret
    file:
      path: /logs/gateway.log
      level: error

# Analytics configuration
analytics:
  enabled: true
  buffer_size: 1000
  flush_interval: 30
  retention:
    raw_data: 1h
    aggregates: 24h
    summaries: 30d

# Alerting rules
alerts:
  rules:
    - id: high_response_time
      name: High Response Time
      condition: response_time_high
      threshold: 1000  # milliseconds
      duration: 300    # 5 minutes
      severity: high
      channels: [slack, email]
      enabled: true
      
    - id: high_error_rate
      name: High Error Rate
      condition: error_rate_high
      threshold: 0.05  # 5%
      duration: 180    # 3 minutes
      severity: critical
      channels: [slack, pagerduty]
      enabled: true
      
    - id: low_throughput
      name: Low Throughput
      condition: throughput_low
      threshold: 100   # requests per minute
      duration: 600    # 10 minutes
      severity: medium
      channels: [slack]
      enabled: true

  channels:
    slack:
      webhook: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
    email:
      smtp_host: smtp.company.com
      smtp_port: 587
      username: alerts@company.com
      password: secret
    pagerduty:
      integration_key: your-pagerduty-key
    webhook:
      url: https://internal.monitoring.system/alerts
```

## Usage Examples

```typescript
// Monitoring setup
const metricsCollector = new MetricsCollector({
  prometheus: { port: 9090 }
});

const tracingManager = new TracingManager({
  serviceName: 'api-gateway',
  jaegerHost: 'jaeger',
  jaegerPort: 6832
});

const logger = new AdvancedLogger({
  level: 'info',
  elasticsearch: {
    node: 'https://elasticsearch:9200',
    index: 'gateway-logs'
  }
});

const analytics = new PerformanceAnalytics({
  redis: { host: 'redis', port: 6379 }
});

const alertManager = new AlertManager({
  rules: alertRules,
  channels: {
    slack: { webhook: process.env.SLACK_WEBHOOK },
    email: { smtp: emailConfig }
  }
});

// Apply middleware
app.use(metricsCollector.middleware());
app.use(tracingManager.middleware());
app.use(logger.middleware());

// Analytics endpoint
app.get('/analytics', async (req, res) => {
  const { timeRange, granularity } = req.query;
  const data = await analytics.getAnalytics(
    timeRange as string,
    granularity as string
  );
  res.json(data);
});

// Alerts endpoint
app.get('/alerts', (req, res) => {
  res.json(alertManager.getActiveAlerts());
});

// Health endpoint with detailed metrics
app.get('/health/detailed', async (req, res) => {
  const metrics = await metricsCollector.getMetricsAsJSON();
  const activeAlerts = alertManager.getActiveAlerts();
  
  res.json({
    status: activeAlerts.length === 0 ? 'healthy' : 'degraded',
    metrics,
    alerts: activeAlerts,
    timestamp: new Date().toISOString()
  });
});
```