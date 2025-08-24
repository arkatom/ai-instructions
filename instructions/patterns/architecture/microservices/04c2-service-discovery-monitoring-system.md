# Microservices - Service Discovery 監視とアラート

> リアルタイム監視、パフォーマンス分析、サーキットブレーカー、アラート管理

## 概要

Service Discoveryシステムの継続的な監視とアラート機能は、問題の早期発見と迅速な対応を可能にします。サービス可用性、パフォーマンス、レジストリ健全性を包括的に監視し、適切なアラートによって運用チームに通知します。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryモニタリング](./04c-service-discovery-monitoring.md) - モニタリング・運用概要
- [Service Discovery障害処理](./04c1-service-discovery-resilience.md) - 障害処理とフェイルオーバー
- [Service Discovery運用](./04c3-service-discovery-operations.md) - 運用ベストプラクティス

## Service Discovery Monitor

### 1. 包括的監視システム

```typescript
// shared/monitoring/service-discovery-monitor.ts
export class ServiceDiscoveryMonitor {
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private performanceCache = new Map<string, PerformanceMetrics[]>();

  constructor(
    private serviceRegistry: ServiceRegistry,
    private alertManager: AlertManager,
    private metricsCollector: MetricsCollector,
    private logger: Logger,
    private config: MonitoringConfig
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // 定期的なモニタリング実行
    const mainInterval = setInterval(async () => {
      await Promise.all([
        this.monitorServiceAvailability(),
        this.monitorServicePerformance(),
        this.monitorServiceRegistryHealth()
      ]);
    }, this.config.monitoringIntervalMs);

    this.monitoringIntervals.set('main', mainInterval);

    // 高頻度のリアルタイム監視
    const realtimeInterval = setInterval(async () => {
      await this.monitorRealtimeMetrics();
    }, this.config.realtimeMonitoringIntervalMs);

    this.monitoringIntervals.set('realtime', realtimeInterval);

    // リアルタイム障害検知
    this.setupRealtimeMonitoring();
  }

  private async monitorServiceAvailability(): Promise<void> {
    const serviceNames = await this.getMonitoredServiceNames();
    const availabilityPromises = serviceNames.map(serviceName => 
      this.monitorSingleServiceAvailability(serviceName)
    );

    await Promise.allSettled(availabilityPromises);
  }

  private async monitorSingleServiceAvailability(serviceName: string): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const totalCount = instances.length;
      const healthyCount = instances.filter(i => i.status === ServiceStatus.UP).length;
      const unhealthyCount = totalCount - healthyCount;

      // メトリクス記録
      this.recordAvailabilityMetrics(serviceName, totalCount, healthyCount, unhealthyCount);
      
      // 可用性アラート判定
      await this.evaluateAvailabilityAlerts(serviceName, healthyCount, totalCount);

      // 詳細インスタンス監視
      await this.monitorInstanceHealth(serviceName, instances);

    } catch (error) {
      this.logger.error('Service availability monitoring failed', {
        serviceName,
        error: error.message
      });

      await this.alertManager.send({
        severity: 'critical',
        summary: `Service discovery failed: ${serviceName}`,
        description: `Failed to discover instances: ${error.message}`,
        metadata: { 
          service: serviceName,
          errorType: 'discovery_failure',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  private recordAvailabilityMetrics(
    serviceName: string, 
    total: number, 
    healthy: number, 
    unhealthy: number
  ): void {
    const timestamp = Date.now();

    this.metricsCollector.recordGauge('service_instances_total', total, {
      service: serviceName,
      timestamp: timestamp.toString()
    });

    this.metricsCollector.recordGauge('service_instances_healthy', healthy, {
      service: serviceName,
      timestamp: timestamp.toString()
    });

    this.metricsCollector.recordGauge('service_instances_unhealthy', unhealthy, {
      service: serviceName,
      timestamp: timestamp.toString()
    });

    // 可用性率の計算
    const availabilityRatio = total > 0 ? healthy / total : 0;
    this.metricsCollector.recordGauge('service_availability_ratio', availabilityRatio, {
      service: serviceName,
      timestamp: timestamp.toString()
    });
  }

  private async evaluateAvailabilityAlerts(
    serviceName: string, 
    healthyCount: number, 
    totalCount: number
  ): Promise<void> {
    if (totalCount === 0) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `No instances registered: ${serviceName}`,
        description: 'Service has no registered instances. This could indicate deployment issues or service registry problems.',
        metadata: { 
          service: serviceName,
          alertType: 'no_instances',
          expectedMinInstances: this.config.serviceConfigs[serviceName]?.minInstances || 1
        }
      });
      return;
    }

    const healthyRatio = healthyCount / totalCount;
    const thresholds = this.config.serviceConfigs[serviceName]?.availabilityThresholds || 
                      this.config.defaultAvailabilityThresholds;

    if (healthyRatio < thresholds.critical) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `Critical service availability: ${serviceName}`,
        description: `Only ${healthyCount}/${totalCount} instances are healthy (${(healthyRatio * 100).toFixed(1)}%). This is below the critical threshold of ${(thresholds.critical * 100).toFixed(1)}%.`,
        metadata: { 
          service: serviceName, 
          healthyRatio,
          healthyCount,
          totalCount,
          threshold: thresholds.critical,
          alertType: 'critical_availability'
        }
      });
    } else if (healthyRatio < thresholds.warning) {
      await this.alertManager.send({
        severity: 'warning',
        summary: `Low service availability: ${serviceName}`,
        description: `${healthyCount}/${totalCount} instances are healthy (${(healthyRatio * 100).toFixed(1)}%). This is below the warning threshold of ${(thresholds.warning * 100).toFixed(1)}%.`,
        metadata: { 
          service: serviceName, 
          healthyRatio,
          healthyCount,
          totalCount,
          threshold: thresholds.warning,
          alertType: 'low_availability'
        }
      });
    }
  }

  private async monitorInstanceHealth(serviceName: string, instances: ServiceInstance[]): Promise<void> {
    const healthPromises = instances.map(async instance => {
      try {
        const healthCheck = await this.performInstanceHealthCheck(instance);
        
        this.metricsCollector.recordGauge('instance_health_check_duration', healthCheck.duration, {
          service: serviceName,
          instanceId: instance.id,
          healthy: healthCheck.healthy.toString()
        });

        if (!healthCheck.healthy) {
          this.logger.warn('Unhealthy instance detected', {
            serviceName,
            instanceId: instance.id,
            host: instance.host,
            port: instance.port,
            reason: healthCheck.reason
          });
        }
      } catch (error) {
        this.logger.error('Instance health check failed', {
          serviceName,
          instanceId: instance.id,
          error: error.message
        });
      }
    });

    await Promise.allSettled(healthPromises);
  }

  private async performInstanceHealthCheck(instance: ServiceInstance): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(instance.healthCheckUrl, {
        timeout: this.config.healthCheckTimeoutMs,
        validateStatus: (status) => status === 200
      });

      const duration = Date.now() - startTime;
      const healthData = response.data;

      // 詳細ヘルスチェック分析
      if (this.isDetailedHealthCheck(healthData)) {
        const detailedResult = this.evaluateDetailedHealth(healthData);
        return {
          healthy: detailedResult.healthy,
          duration,
          reason: detailedResult.reason,
          details: detailedResult.details
        };
      }

      return {
        healthy: true,
        duration,
        reason: 'Basic health check passed'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        healthy: false,
        duration,
        reason: `Health check failed: ${error.message}`
      };
    }
  }

  private async monitorServicePerformance(): Promise<void> {
    const performanceMetrics = await this.collectPerformanceMetrics();
    
    for (const [serviceName, metrics] of performanceMetrics.entries()) {
      // パフォーマンス履歴の更新
      this.updatePerformanceHistory(serviceName, metrics);

      // パフォーマンスアラートの評価
      await this.evaluatePerformanceAlerts(serviceName, metrics);

      // メトリクス記録
      this.recordPerformanceMetrics(serviceName, metrics);
    }
  }

  private updatePerformanceHistory(serviceName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceCache.has(serviceName)) {
      this.performanceCache.set(serviceName, []);
    }

    const history = this.performanceCache.get(serviceName)!;
    history.push({
      ...metrics,
      timestamp: Date.now()
    });

    // 過去1時間のデータのみ保持
    const oneHourAgo = Date.now() - 3600000;
    this.performanceCache.set(
      serviceName,
      history.filter(m => m.timestamp > oneHourAgo)
    );
  }

  private async evaluatePerformanceAlerts(serviceName: string, metrics: PerformanceMetrics): Promise<void> {
    const thresholds = this.config.serviceConfigs[serviceName]?.performanceThresholds ||
                      this.config.defaultPerformanceThresholds;

    // レスポンス時間監視
    if (metrics.averageResponseTime > thresholds.responseTime.critical) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `Critical response time: ${serviceName}`,
        description: `Average response time: ${metrics.averageResponseTime}ms (threshold: ${thresholds.responseTime.critical}ms)`,
        metadata: { 
          service: serviceName, 
          responseTime: metrics.averageResponseTime,
          threshold: thresholds.responseTime.critical,
          alertType: 'critical_response_time'
        }
      });
    } else if (metrics.averageResponseTime > thresholds.responseTime.warning) {
      await this.alertManager.send({
        severity: 'warning',
        summary: `High response time: ${serviceName}`,
        description: `Average response time: ${metrics.averageResponseTime}ms (threshold: ${thresholds.responseTime.warning}ms)`,
        metadata: { 
          service: serviceName, 
          responseTime: metrics.averageResponseTime,
          threshold: thresholds.responseTime.warning,
          alertType: 'high_response_time'
        }
      });
    }

    // エラー率監視
    if (metrics.errorRate > thresholds.errorRate.critical) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `Critical error rate: ${serviceName}`,
        description: `Error rate: ${(metrics.errorRate * 100).toFixed(2)}% (threshold: ${(thresholds.errorRate.critical * 100).toFixed(2)}%)`,
        metadata: { 
          service: serviceName, 
          errorRate: metrics.errorRate,
          threshold: thresholds.errorRate.critical,
          alertType: 'critical_error_rate'
        }
      });
    } else if (metrics.errorRate > thresholds.errorRate.warning) {
      await this.alertManager.send({
        severity: 'warning',
        summary: `High error rate: ${serviceName}`,
        description: `Error rate: ${(metrics.errorRate * 100).toFixed(2)}% (threshold: ${(thresholds.errorRate.warning * 100).toFixed(2)}%)`,
        metadata: { 
          service: serviceName, 
          errorRate: metrics.errorRate,
          threshold: thresholds.errorRate.warning,
          alertType: 'high_error_rate'
        }
      });
    }

    // スループット監視
    if (metrics.requestsPerSecond < thresholds.throughput.minimum) {
      await this.alertManager.send({
        severity: 'warning',
        summary: `Low throughput: ${serviceName}`,
        description: `Current RPS: ${metrics.requestsPerSecond}, Expected min: ${thresholds.throughput.minimum}`,
        metadata: { 
          service: serviceName, 
          rps: metrics.requestsPerSecond,
          minimumRps: thresholds.throughput.minimum,
          alertType: 'low_throughput'
        }
      });
    }
  }

  private async monitorRealtimeMetrics(): Promise<void> {
    // CPU、メモリ、ネットワーク使用率などのリアルタイムメトリクス監視
    const systemMetrics = await this.collectSystemMetrics();
    
    Object.entries(systemMetrics).forEach(([metricName, value]) => {
      this.metricsCollector.recordGauge(`service_discovery_${metricName}`, value, {
        timestamp: Date.now().toString()
      });
    });
  }

  private async monitorServiceRegistryHealth(): Promise<void> {
    try {
      // サービスレジストリ自体のヘルスチェック
      const registryHealth = await this.checkServiceRegistryHealth();
      
      if (!registryHealth.healthy) {
        await this.alertManager.send({
          severity: 'critical',
          summary: 'Service registry unhealthy',
          description: `Service registry health check failed: ${registryHealth.error}`,
          metadata: { 
            registryType: registryHealth.type,
            error: registryHealth.error,
            alertType: 'registry_unhealthy'
          }
        });
      }

      this.metricsCollector.recordGauge('service_registry_healthy', registryHealth.healthy ? 1 : 0, {
        registryType: registryHealth.type
      });

      this.metricsCollector.recordGauge('service_registry_response_time', registryHealth.responseTime, {
        registryType: registryHealth.type
      });

    } catch (error) {
      this.logger.error('Service registry health monitoring failed', { error });
    }
  }

  private setupRealtimeMonitoring(): void {
    // サービスインスタンスの登録/削除イベント監視
    this.serviceRegistry.on?.('instance_registered', (instance: ServiceInstance) => {
      this.logger.info('Service instance registered', { 
        service: instance.serviceName, 
        instanceId: instance.id,
        host: instance.host,
        port: instance.port
      });
      
      this.metricsCollector.recordCounter('service_instance_registrations_total', 1, {
        service: instance.serviceName
      });
    });

    this.serviceRegistry.on?.('instance_deregistered', (instanceId: string, serviceName: string) => {
      this.logger.info('Service instance deregistered', { serviceName, instanceId });
      
      this.metricsCollector.recordCounter('service_instance_deregistrations_total', 1, {
        service: serviceName
      });
    });

    // サービス発見失敗のリアルタイム監視
    this.serviceRegistry.on?.('discovery_failed', (serviceName: string, error: Error) => {
      this.logger.error('Service discovery failed', { serviceName, error: error.message });
      
      this.metricsCollector.recordCounter('service_discovery_failures_total', 1, {
        service: serviceName,
        error: error.name
      });
    });
  }

  // その他のプライベートメソッド...
  private isDetailedHealthCheck(healthData: any): boolean {
    return healthData && typeof healthData === 'object' && 'checks' in healthData;
  }

  private evaluateDetailedHealth(healthData: any): DetailedHealthResult {
    const { status, checks } = healthData;
    const details: Record<string, any> = {};

    if (status !== 'UP') {
      return {
        healthy: false,
        reason: `Overall status is ${status}`,
        details
      };
    }

    if (checks && typeof checks === 'object') {
      for (const [checkName, checkResult] of Object.entries(checks)) {
        details[checkName] = checkResult;
        
        if (this.isCriticalCheck(checkName) && !this.isCheckHealthy(checkResult)) {
          return {
            healthy: false,
            reason: `Critical health check failed: ${checkName}`,
            details
          };
        }
      }
    }

    return {
      healthy: true,
      reason: 'All health checks passed',
      details
    };
  }

  private isCriticalCheck(checkName: string): boolean {
    const criticalChecks = ['database', 'redis', 'essential-service', 'queue'];
    return criticalChecks.includes(checkName.toLowerCase());
  }

  private isCheckHealthy(checkResult: any): boolean {
    if (typeof checkResult === 'boolean') {
      return checkResult;
    }

    if (typeof checkResult === 'object' && checkResult.status) {
      return ['UP', 'HEALTHY', 'OK'].includes(checkResult.status.toUpperCase());
    }

    return false;
  }

  async stop(): Promise<void> {
    this.monitoringIntervals.forEach((interval, name) => {
      clearInterval(interval);
      this.logger.info(`Stopped monitoring interval: ${name}`);
    });
    this.monitoringIntervals.clear();
  }

  getMonitoringStats(): MonitoringStats {
    return {
      activeIntervals: this.monitoringIntervals.size,
      performanceCacheSize: this.performanceCache.size,
      totalServicesMonitored: this.performanceCache.size
    };
  }
}
```

## Circuit Breaker Pattern

### 2. 高度なCircuit Breaker実装

```typescript
// shared/infrastructure/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private nextAttempt = Date.now();
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private stateChangeListeners: Array<(state: CircuitBreakerState) => void> = [];

  constructor(
    private config: CircuitBreakerConfig,
    private logger: Logger
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const currentTime = Date.now();

    if (this.state === CircuitBreakerState.OPEN) {
      if (currentTime < this.nextAttempt) {
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN');
      } else {
        // ハーフオープン状態に移行
        this.changeState(CircuitBreakerState.HALF_OPEN);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      
      // 成功時の処理
      await this.onSuccess();
      
      return result;
    } catch (error) {
      await this.onFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Circuit breaker timeout'));
      }, this.config.timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async onSuccess(): Promise<void> {
    this.failures = 0;
    this.successes++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // ハーフオープン状態で成功回数が閾値に達したらクローズ
      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  private async onFailure(error: any): Promise<void> {
    this.failures++;
    this.successes = 0;

    this.logger.warn('Circuit breaker recorded failure', {
      failures: this.failures,
      threshold: this.config.failureThreshold,
      error: error.message
    });

    if (this.failures >= this.config.failureThreshold) {
      this.open();
    }
  }

  private changeState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    this.logger.info('Circuit breaker state changed', {
      from: oldState,
      to: newState,
      failures: this.failures,
      successes: this.successes
    });

    // リスナーに状態変更を通知
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        this.logger.error('Circuit breaker state change listener failed', { error });
      }
    });
  }

  private open(): void {
    this.changeState(CircuitBreakerState.OPEN);
    this.nextAttempt = Date.now() + this.config.cooldownMs;
    
    this.logger.warn('Circuit breaker opened', {
      failures: this.failures,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      cooldownMs: this.config.cooldownMs
    });
  }

  private close(): void {
    this.changeState(CircuitBreakerState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    
    this.logger.info('Circuit breaker closed');
  }

  onStateChange(listener: (state: CircuitBreakerState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  getSuccesses(): number {
    return this.successes;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttemptTime: this.nextAttempt,
      isOpenUntil: this.state === CircuitBreakerState.OPEN ? new Date(this.nextAttempt) : null
    };
  }

  // 手動でのリセット機能
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.changeState(CircuitBreakerState.CLOSED);
    this.logger.info('Circuit breaker manually reset');
  }
}

enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
  cooldownMs: number;
}

interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  nextAttemptTime: number;
  isOpenUntil: Date | null;
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

Service Discoveryの監視システムにより、システムの健全性を継続的に把握し、問題の早期発見と迅速な対応を実現できます。