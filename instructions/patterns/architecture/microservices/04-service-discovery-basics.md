# Microservices - Service Discovery基礎

> サービスレジストリとクライアントサイドディスカバリー

## 概要

Service Discoveryは、マイクロサービスアーキテクチャにおいて、サービス間の動的な発見と通信を可能にする重要なパターンです。サービスインスタンスの自動登録・発見、ヘルスチェック、ロードバランシングを提供し、システムの柔軟性とスケーラビリティを実現します。

## サービスレジストリの実装

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

## クライアントサイドディスカバリー

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