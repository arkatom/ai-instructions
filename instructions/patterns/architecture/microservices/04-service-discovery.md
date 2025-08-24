# Microservices - Service Discovery

> サービス発見とロードバランシング、動的サービス管理

## 概要

Service Discoveryは、マイクロサービスアーキテクチャにおいて、サービス間の動的な発見と通信を可能にする重要なパターンです。サービスインスタンスの自動登録・発見、ヘルスチェック、ロードバランシングを提供し、システムの柔軟性とスケーラビリティを実現します。

## Service Discovery実装

### 1. サービスレジストリの実装

```typescript
// shared/infrastructure/service-discovery.ts
export interface ServiceInstance {
  id: string;
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl: string;
  metadata: Record<string, string>;
  weight?: number;
  status: ServiceStatus;
  lastHeartbeat: Date;
}

export enum ServiceStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  STARTING = 'STARTING',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}

export interface ServiceRegistry {
  register(instance: ServiceInstance): Promise<void>;
  deregister(instanceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  getServiceUrl(serviceName: string): Promise<string>;
  heartbeat(instanceId: string): Promise<void>;
}

export class ConsulServiceRegistry implements ServiceRegistry {
  constructor(
    private consul: consul.Consul,
    private logger: Logger
  ) {}

  async register(instance: ServiceInstance): Promise<void> {
    const check = {
      http: instance.healthCheckUrl,
      interval: '10s',
      timeout: '5s',
      deregistercriticalserviceafter: '30s'
    };

    await this.consul.agent.service.register({
      id: instance.id,
      name: instance.serviceName,
      address: instance.host,
      port: instance.port,
      check,
      tags: this.metadataToTags(instance.metadata),
      meta: {
        weight: instance.weight?.toString() || '1',
        version: instance.metadata.version || '1.0.0',
        environment: instance.metadata.environment || 'production'
      }
    });

    this.logger.info('Service registered', {
      instanceId: instance.id,
      serviceName: instance.serviceName,
      address: `${instance.host}:${instance.port}`
    });
  }

  async deregister(instanceId: string): Promise<void> {
    await this.consul.agent.service.deregister(instanceId);
    this.logger.info('Service deregistered', { instanceId });
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    try {
      const { services } = await this.consul.health.service({
        service: serviceName,
        passing: true
      });

      return services.map(service => ({
        id: service.Service.ID,
        serviceName: service.Service.Service,
        host: service.Service.Address || service.Node.Address,
        port: service.Service.Port,
        healthCheckUrl: `http://${service.Service.Address}:${service.Service.Port}/health`,
        metadata: this.tagsToMetadata(service.Service.Tags),
        weight: parseInt(service.Service.Meta?.weight || '1'),
        status: ServiceStatus.UP,
        lastHeartbeat: new Date()
      }));
    } catch (error) {
      this.logger.error('Service discovery failed', { serviceName, error });
      return [];
    }
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.discover(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances found for service: ${serviceName}`);
    }

    // ロードバランサーによるインスタンス選択
    const selectedInstance = this.selectInstance(instances);
    return `http://${selectedInstance.host}:${selectedInstance.port}`;
  }

  async heartbeat(instanceId: string): Promise<void> {
    // Consulの場合、ヘルスチェックで自動的にハートビートが管理される
    // 他の実装では明示的なハートビートが必要
  }

  private selectInstance(instances: ServiceInstance[]): ServiceInstance {
    // 重み付きランダム選択
    const totalWeight = instances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const instance of instances) {
      currentWeight += instance.weight || 1;
      if (random <= currentWeight) {
        return instance;
      }
    }
    
    return instances[0]; // フォールバック
  }

  private metadataToTags(metadata: Record<string, string>): string[] {
    return Object.entries(metadata).map(([key, value]) => `${key}=${value}`);
  }

  private tagsToMetadata(tags: string[]): Record<string, string> {
    const metadata: Record<string, string> = {};
    
    for (const tag of tags) {
      const [key, value] = tag.split('=');
      if (key && value) {
        metadata[key] = value;
      }
    }
    
    return metadata;
  }
}
```

### 2. クライアントサイドディスカバリー

```typescript
// shared/infrastructure/service-client.ts
export class ServiceClient {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private loadBalancer: LoadBalancer,
    private httpClient: AxiosInstance,
    private circuitBreaker: CircuitBreaker,
    private cache: Cache
  ) {}

  async get<T>(serviceName: string, path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest(serviceName, 'GET', path, undefined, config);
  }

  async post<T>(
    serviceName: string, 
    path: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.makeRequest(serviceName, 'POST', path, data, config);
  }

  async put<T>(
    serviceName: string, 
    path: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.makeRequest(serviceName, 'PUT', path, data, config);
  }

  async delete<T>(serviceName: string, path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest(serviceName, 'DELETE', path, undefined, config);
  }

  private async makeRequest<T>(
    serviceName: string,
    method: string,
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      // インスタンス発見とロードバランシング
      const instances = await this.getServiceInstances(serviceName);
      const selectedInstance = this.loadBalancer.selectInstance(instances);
      
      const url = `http://${selectedInstance.host}:${selectedInstance.port}${path}`;
      
      const response = await this.httpClient.request({
        method,
        url,
        data,
        ...config,
        timeout: config?.timeout || 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': serviceName,
          'X-Request-ID': crypto.randomUUID(),
          'X-Client-Version': '1.0.0',
          ...config?.headers
        }
      });

      return response.data;
    });
  }

  private async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    const cacheKey = `service_instances:${serviceName}`;
    
    // キャッシュから取得
    let instances = await this.cache.get<ServiceInstance[]>(cacheKey);
    
    if (!instances || instances.length === 0) {
      // サービスレジストリから取得
      instances = await this.serviceRegistry.discover(serviceName);
      
      if (instances.length > 0) {
        // 短時間キャッシュ（30秒）
        await this.cache.set(cacheKey, instances, 30);
      }
    }

    if (instances.length === 0) {
      throw new Error(`No instances available for service: ${serviceName}`);
    }

    return instances;
  }
}
```

### 3. 高度なロードバランシング

```typescript
// shared/infrastructure/load-balancer.ts
export interface LoadBalancer {
  selectInstance(instances: ServiceInstance[]): ServiceInstance;
}

export class RoundRobinLoadBalancer implements LoadBalancer {
  private counters = new Map<string, number>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available');
    }

    const serviceName = instances[0].serviceName;
    const counter = this.counters.get(serviceName) || 0;
    const selectedInstance = instances[counter % instances.length];
    
    this.counters.set(serviceName, counter + 1);
    
    return selectedInstance;
  }
}

export class WeightedRoundRobinLoadBalancer implements LoadBalancer {
  private weightedInstances = new Map<string, WeightedInstance[]>();
  private currentWeights = new Map<string, number[]>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    const serviceName = instances[0].serviceName;
    
    if (!this.weightedInstances.has(serviceName)) {
      this.initializeWeights(serviceName, instances);
    }

    const weightedInstances = this.weightedInstances.get(serviceName)!;
    const currentWeights = this.currentWeights.get(serviceName)!;

    // 重み付きラウンドロビンアルゴリズム
    let maxWeightIndex = 0;
    for (let i = 1; i < currentWeights.length; i++) {
      if (currentWeights[i] > currentWeights[maxWeightIndex]) {
        maxWeightIndex = i;
      }
    }

    // 選択されたインスタンスの現在重みを減算
    const totalWeight = weightedInstances.reduce((sum, wi) => sum + wi.weight, 0);
    currentWeights[maxWeightIndex] -= totalWeight;

    // すべてのインスタンスの現在重みを元の重みだけ加算
    for (let i = 0; i < currentWeights.length; i++) {
      currentWeights[i] += weightedInstances[i].weight;
    }

    return weightedInstances[maxWeightIndex].instance;
  }

  private initializeWeights(serviceName: string, instances: ServiceInstance[]): void {
    const weightedInstances = instances.map(instance => ({
      instance,
      weight: instance.weight || 1
    }));

    const currentWeights = weightedInstances.map(wi => wi.weight);

    this.weightedInstances.set(serviceName, weightedInstances);
    this.currentWeights.set(serviceName, currentWeights);
  }
}

export class LeastConnectionsLoadBalancer implements LoadBalancer {
  private connections = new Map<string, number>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const instanceKey = `${instance.host}:${instance.port}`;
      const connections = this.connections.get(instanceKey) || 0;
      
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    // 接続数を増加
    const instanceKey = `${selectedInstance.host}:${selectedInstance.port}`;
    this.connections.set(instanceKey, (this.connections.get(instanceKey) || 0) + 1);

    // 一定時間後に接続数を減少
    setTimeout(() => {
      const currentConnections = this.connections.get(instanceKey) || 0;
      this.connections.set(instanceKey, Math.max(0, currentConnections - 1));
    }, 30000); // 30秒後

    return selectedInstance;
  }
}

interface WeightedInstance {
  instance: ServiceInstance;
  weight: number;
}
```

### 4. ヘルスチェック機能

```typescript
// shared/infrastructure/health-checker.ts
export class HealthChecker {
  constructor(
    private httpClient: AxiosInstance,
    private logger: Logger
  ) {}

  async checkInstance(instance: ServiceInstance): Promise<boolean> {
    try {
      const response = await this.httpClient.get(instance.healthCheckUrl, {
        timeout: 5000,
        validateStatus: (status) => status === 200
      });

      const healthData = response.data;
      
      // 詳細ヘルスチェック
      if (this.isDetailedHealthCheck(healthData)) {
        return this.evaluateDetailedHealth(healthData);
      }

      return true;
    } catch (error) {
      this.logger.warn('Health check failed', {
        instanceId: instance.id,
        healthCheckUrl: instance.healthCheckUrl,
        error: error.message
      });
      return false;
    }
  }

  async checkAllInstances(instances: ServiceInstance[]): Promise<Map<string, boolean>> {
    const healthChecks = instances.map(async (instance) => ({
      instanceId: instance.id,
      healthy: await this.checkInstance(instance)
    }));

    const results = await Promise.all(healthChecks);
    const healthMap = new Map<string, boolean>();

    results.forEach(result => {
      healthMap.set(result.instanceId, result.healthy);
    });

    return healthMap;
  }

  private isDetailedHealthCheck(healthData: any): boolean {
    return healthData && 
           typeof healthData === 'object' && 
           'checks' in healthData;
  }

  private evaluateDetailedHealth(healthData: any): boolean {
    const { status, checks } = healthData;

    // 全体ステータスが UP でない場合は不健全
    if (status !== 'UP') {
      return false;
    }

    // 個別チェックの評価
    if (checks && typeof checks === 'object') {
      for (const [checkName, checkResult] of Object.entries(checks)) {
        if (this.isCriticalCheck(checkName) && !this.isCheckHealthy(checkResult)) {
          this.logger.warn('Critical health check failed', { 
            checkName, 
            checkResult 
          });
          return false;
        }
      }
    }

    return true;
  }

  private isCriticalCheck(checkName: string): boolean {
    const criticalChecks = ['database', 'redis', 'essential-service'];
    return criticalChecks.includes(checkName.toLowerCase());
  }

  private isCheckHealthy(checkResult: any): boolean {
    if (typeof checkResult === 'boolean') {
      return checkResult;
    }

    if (typeof checkResult === 'object' && checkResult.status) {
      return checkResult.status === 'UP' || checkResult.status === 'HEALTHY';
    }

    return false;
  }
}
```

## サーバーサイドService Discovery

### 1. API Gateway統合

```typescript
// api-gateway/src/service-discovery/gateway-service-registry.ts
export class GatewayServiceRegistry {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private loadBalancer: LoadBalancer,
    private healthChecker: HealthChecker
  ) {
    this.startPeriodicHealthChecks();
  }

  async routeRequest(serviceName: string, req: express.Request, res: express.Response): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const healthyInstances = await this.filterHealthyInstances(instances);
      
      if (healthyInstances.length === 0) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: `No healthy instances available for ${serviceName}`
        });
        return;
      }

      const selectedInstance = this.loadBalancer.selectInstance(healthyInstances);
      await this.forwardRequest(selectedInstance, req, res);

    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to route request'
      });
    }
  }

  private async filterHealthyInstances(instances: ServiceInstance[]): Promise<ServiceInstance[]> {
    const healthResults = await this.healthChecker.checkAllInstances(instances);
    
    return instances.filter(instance => 
      healthResults.get(instance.id) === true
    );
  }

  private async forwardRequest(
    instance: ServiceInstance, 
    req: express.Request, 
    res: express.Response
  ): Promise<void> {
    const targetUrl = `http://${instance.host}:${instance.port}${req.path}`;
    
    try {
      const response = await axios({
        method: req.method as Method,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers: {
          ...req.headers,
          'X-Forwarded-For': req.ip,
          'X-Gateway-Instance': process.env.INSTANCE_ID
        },
        timeout: 30000
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Target service did not respond'
        });
      }
    }
  }

  private startPeriodicHealthChecks(): void {
    setInterval(async () => {
      // すべてのサービスのヘルスチェックを実行
      const serviceNames = await this.getAllServiceNames();
      
      for (const serviceName of serviceNames) {
        const instances = await this.serviceRegistry.discover(serviceName);
        await this.healthChecker.checkAllInstances(instances);
      }
    }, 30000); // 30秒間隔
  }

  private async getAllServiceNames(): Promise<string[]> {
    // 実装は使用するサービスレジストリによって異なる
    return ['user-service', 'order-service', 'inventory-service'];
  }
}
```

### 2. Kubernetes統合

```yaml
# k8s/service-discovery.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: ClusterIP

---
apiVersion: v1
kind: Endpoints
metadata:
  name: user-service
subsets:
- addresses:
  - ip: 10.1.1.1
  - ip: 10.1.1.2
  - ip: 10.1.1.3
  ports:
  - port: 3000
    name: http

---
# サービスメッシュ統合の例（Istio）
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
spec:
  host: user-service
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpHeaderName: "x-user-id"  # スティッキーセッション
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    circuitBreaker:
      consecutiveGatewayErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

### 3. DNS-based Discovery

```typescript
// shared/infrastructure/dns-service-discovery.ts
export class DNSServiceDiscovery implements ServiceRegistry {
  constructor(
    private dnsConfig: DNSConfig,
    private logger: Logger
  ) {}

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    try {
      // SRVレコードからサービス情報を取得
      const srvRecords = await this.resolveSRVRecords(serviceName);
      
      const instances: ServiceInstance[] = [];
      
      for (const record of srvRecords) {
        const instance: ServiceInstance = {
          id: `${serviceName}-${record.name}-${record.port}`,
          serviceName,
          host: record.name,
          port: record.port,
          healthCheckUrl: `http://${record.name}:${record.port}/health`,
          metadata: {
            priority: record.priority.toString(),
            weight: record.weight.toString()
          },
          weight: record.weight,
          status: ServiceStatus.UP,
          lastHeartbeat: new Date()
        };

        instances.push(instance);
      }

      return instances;
    } catch (error) {
      this.logger.error('DNS service discovery failed', { serviceName, error });
      return [];
    }
  }

  private async resolveSRVRecords(serviceName: string): Promise<SRVRecord[]> {
    return new Promise((resolve, reject) => {
      dns.resolveSrv(`_${serviceName}._tcp.${this.dnsConfig.domain}`, (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      });
    });
  }

  // その他のメソッドは従来のサービスレジストリでは不要
  async register(instance: ServiceInstance): Promise<void> {
    // DNS-basedでは通常、外部DNSサービスが管理
    throw new Error('Registration not supported in DNS-based discovery');
  }

  async deregister(instanceId: string): Promise<void> {
    throw new Error('Deregistration not supported in DNS-based discovery');
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.discover(serviceName);
    if (instances.length === 0) {
      throw new Error(`No instances found for service: ${serviceName}`);
    }

    // 重みに基づく選択
    const instance = this.selectByWeight(instances);
    return `http://${instance.host}:${instance.port}`;
  }

  async heartbeat(instanceId: string): Promise<void> {
    // DNS-basedでは通常不要
  }

  private selectByWeight(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const instance of instances) {
      currentWeight += instance.weight || 1;
      if (random <= currentWeight) {
        return instance;
      }
    }
    
    return instances[0];
  }
}

interface SRVRecord {
  priority: number;
  weight: number;
  port: number;
  name: string;
}

interface DNSConfig {
  domain: string;
  ttl: number;
}
```

## Service Discovery運用のベストプラクティス

### 1. 障害処理とフェイルオーバー

```typescript
// shared/infrastructure/resilient-service-client.ts
export class ResilientServiceClient extends ServiceClient {
  constructor(
    serviceRegistry: ServiceRegistry,
    private fallbackStrategies: Map<string, FallbackStrategy>
  ) {
    super(serviceRegistry, new WeightedRoundRobinLoadBalancer(), axios.create(), new CircuitBreaker(), new Cache());
  }

  protected async makeRequest<T>(
    serviceName: string,
    method: string,
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      return await super.makeRequest(serviceName, method, path, data, config);
    } catch (error) {
      // フォールバック戦略の実行
      const fallbackStrategy = this.fallbackStrategies.get(serviceName);
      if (fallbackStrategy) {
        this.logger.warn('Executing fallback strategy', { serviceName, error: error.message });
        return await fallbackStrategy.execute(method, path, data, config);
      }
      
      throw error;
    }
  }
}

interface FallbackStrategy {
  execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any>;
}

class CachedResponseFallback implements FallbackStrategy {
  constructor(private cache: Cache, private logger: Logger) {}

  async execute(method: string, path: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    if (method === 'GET') {
      const cacheKey = `fallback:${path}:${JSON.stringify(config?.params)}`;
      const cachedResponse = await this.cache.get(cacheKey);
      
      if (cachedResponse) {
        this.logger.info('Using cached response for fallback', { path });
        return cachedResponse;
      }
    }
    
    throw new Error('No fallback available');
  }
}
```

### 2. モニタリングとアラート

```typescript
// shared/monitoring/service-discovery-monitor.ts
export class ServiceDiscoveryMonitor {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private alertManager: AlertManager,
    private metricsCollector: MetricsCollector
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.monitorServiceAvailability();
      await this.monitorServicePerformance();
    }, 30000); // 30秒間隔
  }

  private async monitorServiceAvailability(): Promise<void> {
    const serviceNames = ['user-service', 'order-service', 'inventory-service'];
    
    for (const serviceName of serviceNames) {
      const instances = await this.serviceRegistry.discover(serviceName);
      const healthyCount = instances.filter(i => i.status === ServiceStatus.UP).length;
      const totalCount = instances.length;
      
      // メトリクス記録
      this.metricsCollector.recordGauge('service_instances_total', totalCount, { service: serviceName });
      this.metricsCollector.recordGauge('service_instances_healthy', healthyCount, { service: serviceName });
      
      // アラート判定
      const healthyRatio = totalCount > 0 ? healthyCount / totalCount : 0;
      
      if (healthyRatio < 0.5) {
        await this.alertManager.send({
          severity: 'critical',
          summary: `Low service availability: ${serviceName}`,
          description: `Only ${healthyCount}/${totalCount} instances are healthy`
        });
      } else if (healthyRatio < 0.8) {
        await this.alertManager.send({
          severity: 'warning',
          summary: `Reduced service availability: ${serviceName}`,
          description: `${healthyCount}/${totalCount} instances are healthy`
        });
      }
    }
  }

  private async monitorServicePerformance(): Promise<void> {
    // サービス応答時間とエラー率の監視
    const performanceMetrics = await this.collectPerformanceMetrics();
    
    for (const [serviceName, metrics] of performanceMetrics.entries()) {
      if (metrics.averageResponseTime > 5000) {
        await this.alertManager.send({
          severity: 'warning',
          summary: `High response time: ${serviceName}`,
          description: `Average response time: ${metrics.averageResponseTime}ms`
        });
      }
      
      if (metrics.errorRate > 0.1) {
        await this.alertManager.send({
          severity: 'critical',
          summary: `High error rate: ${serviceName}`,
          description: `Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`
        });
      }
    }
  }

  private async collectPerformanceMetrics(): Promise<Map<string, PerformanceMetrics>> {
    // パフォーマンスメトリクスの収集実装
    return new Map();
  }
}

interface PerformanceMetrics {
  averageResponseTime: number;
  errorRate: number;
  requestCount: number;
}
```

Service Discoveryは、マイクロサービスアーキテクチャの動的な性質を支える重要な仕組みです。適切な実装により、システムの柔軟性、可用性、拡張性を大幅に向上させることができます。