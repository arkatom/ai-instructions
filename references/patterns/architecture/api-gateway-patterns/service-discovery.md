# Service Discovery & Registry

> 🎯 **目的**: 動的サービス発見とロードバランシングによる分散システム管理
> 
> 📊 **対象**: Consul、etcd、Kubernetes、静的設定によるサービス登録・発見
> 
> ⚡ **特徴**: 自動スケーリング対応、ヘルスチェック、動的ルーティング

## Core Service Registry Implementation

```typescript
// src/gateway/registry/ServiceRegistry.ts
import { EventEmitter } from 'events';
import Consul from 'consul';
import { Etcd3 } from 'etcd3';

export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  address: string;
  port: number;
  tags: string[];
  metadata: Record<string, string>;
  health: 'healthy' | 'unhealthy' | 'critical';
  lastHeartbeat: Date;
}

export interface ServiceRegistryConfig {
  provider: 'consul' | 'etcd' | 'kubernetes' | 'static';
  consulConfig?: any;
  etcdConfig?: any;
  staticServices?: ServiceInstance[];
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private consul?: Consul;
  private etcd?: Etcd3;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private config: ServiceRegistryConfig) {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    switch (this.config.provider) {
      case 'consul':
        this.initializeConsul();
        break;
      case 'etcd':
        this.initializeEtcd();
        break;
      case 'kubernetes':
        this.initializeKubernetes();
        break;
      case 'static':
        this.initializeStatic();
        break;
    }

    // Start health checking
    this.startHealthChecking();
  }

  private initializeConsul(): void {
    this.consul = new Consul(this.config.consulConfig);
    
    // Watch for service changes
    const watcher = this.consul.watch({
      method: this.consul.catalog.service.list
    });

    watcher.on('change', async () => {
      await this.refreshServices();
    });

    watcher.on('error', (err) => {
      console.error('Consul watch error:', err);
    });

    // Initial load
    this.refreshServices();
  }

  private initializeEtcd(): void {
    this.etcd = new Etcd3(this.config.etcdConfig);
    
    // Watch for service changes
    const watcher = this.etcd.watch()
      .prefix('/services/')
      .create();

    watcher.on('put', async (res) => {
      const service = JSON.parse(res.value.toString());
      this.registerService(service);
    });

    watcher.on('delete', async (res) => {
      const serviceId = res.key.toString().split('/').pop();
      this.deregisterService(serviceId!);
    });

    // Initial load
    this.loadServicesFromEtcd();
  }

  private initializeKubernetes(): void {
    // Kubernetes service discovery using DNS or API
    // Implementation would use @kubernetes/client-node
    console.log('Kubernetes service discovery initialized');
  }

  private initializeStatic(): void {
    if (this.config.staticServices) {
      for (const service of this.config.staticServices) {
        this.registerService(service);
      }
    }
  }

  private async refreshServices(): Promise<void> {
    if (!this.consul) return;

    try {
      const services = await this.consul.catalog.service.list();
      
      for (const serviceName of Object.keys(services)) {
        const instances = await this.consul.health.service(serviceName);
        
        const healthyInstances = instances
          .filter((instance: any) => {
            const checks = instance.Checks || [];
            return checks.every((check: any) => 
              check.Status === 'passing'
            );
          })
          .map((instance: any) => ({
            id: instance.Service.ID,
            name: instance.Service.Service,
            version: instance.Service.Tags.find((t: string) => 
              t.startsWith('version=')
            )?.split('=')[1] || '1.0.0',
            address: instance.Service.Address,
            port: instance.Service.Port,
            tags: instance.Service.Tags,
            metadata: instance.Service.Meta || {},
            health: 'healthy' as const,
            lastHeartbeat: new Date()
          }));

        this.services.set(serviceName, healthyInstances);
      }

      this.emit('servicesUpdated', this.services);
    } catch (error) {
      console.error('Error refreshing services:', error);
    }
  }

  private async loadServicesFromEtcd(): Promise<void> {
    if (!this.etcd) return;

    try {
      const services = await this.etcd.getAll().prefix('/services/');
      
      for (const [key, value] of Object.entries(services)) {
        const service = JSON.parse(value as string);
        this.registerService(service);
      }
    } catch (error) {
      console.error('Error loading services from etcd:', error);
    }
  }

  public registerService(service: ServiceInstance): void {
    const instances = this.services.get(service.name) || [];
    const existingIndex = instances.findIndex(i => i.id === service.id);
    
    if (existingIndex >= 0) {
      instances[existingIndex] = service;
    } else {
      instances.push(service);
    }
    
    this.services.set(service.name, instances);
    this.emit('serviceRegistered', service);
  }

  public deregisterService(serviceId: string): void {
    for (const [name, instances] of this.services.entries()) {
      const filtered = instances.filter(i => i.id !== serviceId);
      if (filtered.length < instances.length) {
        this.services.set(name, filtered);
        this.emit('serviceDeregistered', serviceId);
        break;
      }
    }
  }

  public getService(name: string, version?: string): ServiceInstance | null {
    const instances = this.services.get(name);
    if (!instances || instances.length === 0) {
      return null;
    }

    // Filter by version if specified
    let filtered = instances;
    if (version) {
      filtered = instances.filter(i => i.version === version);
    }

    // Filter healthy instances only
    filtered = filtered.filter(i => i.health === 'healthy');

    if (filtered.length === 0) {
      return null;
    }

    // Simple round-robin load balancing
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  public getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  public getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, instances] of this.services.entries()) {
      const healthy = instances.filter(i => i.health === 'healthy').length;
      const unhealthy = instances.filter(i => i.health === 'unhealthy').length;
      const critical = instances.filter(i => i.health === 'critical').length;
      
      status[name] = {
        total: instances.length,
        healthy,
        unhealthy,
        critical
      };
    }
    
    return status;
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Check every 10 seconds
  }

  private async performHealthChecks(): Promise<void> {
    for (const [name, instances] of this.services.entries()) {
      for (const instance of instances) {
        try {
          const response = await fetch(
            `http://${instance.address}:${instance.port}/health`,
            { 
              method: 'GET',
              timeout: 5000 
            }
          );
          
          instance.health = response.ok ? 'healthy' : 'unhealthy';
          instance.lastHeartbeat = new Date();
        } catch (error) {
          instance.health = 'critical';
          console.error(`Health check failed for ${instance.id}:`, error);
        }
      }
    }
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}
```

## Advanced Load Balancing Strategies

```typescript
// src/gateway/loadbalancing/LoadBalancer.ts
export interface LoadBalancerConfig {
  algorithm: 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash' | 'geo_location';
  healthCheckEnabled: boolean;
  stickySession?: boolean;
  sessionKey?: string;
}

export class LoadBalancer {
  private roundRobinCounters: Map<string, number> = new Map();
  private connectionCounts: Map<string, number> = new Map();
  private sessionMap: Map<string, string> = new Map();

  constructor(private config: LoadBalancerConfig) {}

  selectInstance(
    serviceName: string,
    instances: ServiceInstance[],
    request?: any
  ): ServiceInstance | null {
    if (instances.length === 0) {
      return null;
    }

    // Filter healthy instances
    const healthyInstances = this.config.healthCheckEnabled
      ? instances.filter(i => i.health === 'healthy')
      : instances;

    if (healthyInstances.length === 0) {
      return null;
    }

    // Handle sticky sessions
    if (this.config.stickySession && request) {
      const sessionInstance = this.getSessionInstance(
        request,
        healthyInstances
      );
      if (sessionInstance) {
        return sessionInstance;
      }
    }

    // Apply load balancing algorithm
    let selectedInstance: ServiceInstance;

    switch (this.config.algorithm) {
      case 'round_robin':
        selectedInstance = this.roundRobin(serviceName, healthyInstances);
        break;
      case 'least_connections':
        selectedInstance = this.leastConnections(healthyInstances);
        break;
      case 'weighted':
        selectedInstance = this.weighted(healthyInstances);
        break;
      case 'ip_hash':
        selectedInstance = this.ipHash(request?.ip, healthyInstances);
        break;
      case 'geo_location':
        selectedInstance = this.geoLocation(request, healthyInstances);
        break;
      default:
        selectedInstance = healthyInstances[0];
    }

    // Record session mapping if sticky sessions enabled
    if (this.config.stickySession && request) {
      this.recordSession(request, selectedInstance);
    }

    return selectedInstance;
  }

  private roundRobin(
    serviceName: string,
    instances: ServiceInstance[]
  ): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const nextCounter = (counter + 1) % instances.length;
    this.roundRobinCounters.set(serviceName, nextCounter);
    return instances[counter];
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((least, current) => {
      const leastConnections = this.connectionCounts.get(least.id) || 0;
      const currentConnections = this.connectionCounts.get(current.id) || 0;
      return currentConnections < leastConnections ? current : least;
    });
  }

  private weighted(instances: ServiceInstance[]): ServiceInstance {
    // Calculate weights based on instance metadata
    const weights = instances.map(instance => {
      const weight = parseInt(instance.metadata.weight || '1');
      const capacity = parseInt(instance.metadata.capacity || '100');
      const currentLoad = parseInt(instance.metadata.currentLoad || '0');
      
      // Adjust weight based on current load
      return Math.max(1, weight * (1 - currentLoad / capacity));
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (let i = 0; i < instances.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return instances[i];
      }
    }

    return instances[0];
  }

  private ipHash(ip: string, instances: ServiceInstance[]): ServiceInstance {
    if (!ip) return instances[0];
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      hash = ((hash << 5) - hash + ip.charCodeAt(i)) & 0xffffffff;
    }
    
    const index = Math.abs(hash) % instances.length;
    return instances[index];
  }

  private geoLocation(request: any, instances: ServiceInstance[]): ServiceInstance {
    const clientLocation = this.getClientLocation(request);
    
    if (!clientLocation) {
      return this.roundRobin('geo-fallback', instances);
    }

    // Find closest instance based on location
    let closestInstance = instances[0];
    let minDistance = Number.MAX_VALUE;

    for (const instance of instances) {
      const instanceLocation = this.getInstanceLocation(instance);
      if (instanceLocation) {
        const distance = this.calculateDistance(clientLocation, instanceLocation);
        if (distance < minDistance) {
          minDistance = distance;
          closestInstance = instance;
        }
      }
    }

    return closestInstance;
  }

  private getSessionInstance(
    request: any,
    instances: ServiceInstance[]
  ): ServiceInstance | null {
    const sessionKey = this.getSessionKey(request);
    if (!sessionKey) return null;

    const instanceId = this.sessionMap.get(sessionKey);
    if (!instanceId) return null;

    return instances.find(i => i.id === instanceId) || null;
  }

  private recordSession(request: any, instance: ServiceInstance): void {
    const sessionKey = this.getSessionKey(request);
    if (sessionKey) {
      this.sessionMap.set(sessionKey, instance.id);
    }
  }

  private getSessionKey(request: any): string | null {
    if (!this.config.sessionKey) return null;
    
    // Extract session key from cookie, header, or query param
    return request.cookies?.[this.config.sessionKey] ||
           request.headers?.[this.config.sessionKey] ||
           request.query?.[this.config.sessionKey] ||
           null;
  }

  private getClientLocation(request: any): { lat: number; lng: number } | null {
    // Extract from CloudFlare, AWS, or other CDN headers
    const lat = parseFloat(request.headers['cf-iplatitude'] || 
                          request.headers['x-real-ip-latitude'] || '0');
    const lng = parseFloat(request.headers['cf-iplongitude'] || 
                          request.headers['x-real-ip-longitude'] || '0');
    
    return (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  }

  private getInstanceLocation(instance: ServiceInstance): { lat: number; lng: number } | null {
    const lat = parseFloat(instance.metadata.latitude || '0');
    const lng = parseFloat(instance.metadata.longitude || '0');
    
    return (lat !== 0 || lng !== 0) ? { lat, lng } : null;
  }

  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public recordConnection(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) || 0;
    this.connectionCounts.set(instanceId, current + 1);
  }

  public releaseConnection(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) || 0;
    this.connectionCounts.set(instanceId, Math.max(0, current - 1));
  }
}
```

## Kubernetes Service Discovery

```typescript
// src/gateway/registry/KubernetesDiscovery.ts
import * as k8s from '@kubernetes/client-node';

export class KubernetesServiceDiscovery extends EventEmitter {
  private k8sApi: k8s.CoreV1Api;
  private namespace: string;
  private services: Map<string, ServiceInstance[]> = new Map();

  constructor(namespace: string = 'default') {
    super();
    this.namespace = namespace;
    
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    
    this.startWatching();
  }

  private startWatching(): void {
    // Watch services
    const serviceWatch = new k8s.Watch(new k8s.KubeConfig());
    serviceWatch.watch(
      `/api/v1/namespaces/${this.namespace}/services`,
      {},
      (type, obj) => {
        this.handleServiceEvent(type, obj);
      },
      (err) => {
        console.error('Service watch error:', err);
      }
    );

    // Watch endpoints
    const endpointWatch = new k8s.Watch(new k8s.KubeConfig());
    endpointWatch.watch(
      `/api/v1/namespaces/${this.namespace}/endpoints`,
      {},
      (type, obj) => {
        this.handleEndpointEvent(type, obj);
      },
      (err) => {
        console.error('Endpoint watch error:', err);
      }
    );

    // Initial load
    this.loadServices();
  }

  private async loadServices(): Promise<void> {
    try {
      const servicesResponse = await this.k8sApi.listNamespacedService(this.namespace);
      const endpointsResponse = await this.k8sApi.listNamespacedEndpoints(this.namespace);

      for (const service of servicesResponse.body.items) {
        const endpoints = endpointsResponse.body.items.find(
          ep => ep.metadata?.name === service.metadata?.name
        );
        
        if (endpoints) {
          this.processServiceEndpoints(service, endpoints);
        }
      }
    } catch (error) {
      console.error('Error loading Kubernetes services:', error);
    }
  }

  private handleServiceEvent(type: string, service: any): void {
    console.log(`Service ${type}:`, service.metadata?.name);
    
    if (type === 'DELETED') {
      this.services.delete(service.metadata?.name || '');
      this.emit('serviceDeregistered', service.metadata?.name);
    } else {
      // Service updated, reload endpoints
      this.loadEndpoints(service.metadata?.name);
    }
  }

  private handleEndpointEvent(type: string, endpoints: any): void {
    const serviceName = endpoints.metadata?.name;
    if (!serviceName) return;

    if (type === 'DELETED') {
      this.services.delete(serviceName);
      this.emit('serviceDeregistered', serviceName);
    } else {
      this.processEndpoints(serviceName, endpoints);
    }
  }

  private async loadEndpoints(serviceName: string): Promise<void> {
    try {
      const endpointsResponse = await this.k8sApi.readNamespacedEndpoints(
        serviceName,
        this.namespace
      );
      
      this.processEndpoints(serviceName, endpointsResponse.body);
    } catch (error) {
      console.error(`Error loading endpoints for ${serviceName}:`, error);
    }
  }

  private processServiceEndpoints(service: any, endpoints: any): void {
    this.processEndpoints(service.metadata?.name, endpoints);
  }

  private processEndpoints(serviceName: string, endpoints: any): void {
    const instances: ServiceInstance[] = [];

    if (endpoints.subsets) {
      for (const subset of endpoints.subsets) {
        const ports = subset.ports || [];
        const addresses = subset.addresses || [];

        for (const address of addresses) {
          for (const port of ports) {
            const instance: ServiceInstance = {
              id: `${serviceName}-${address.ip}-${port.port}`,
              name: serviceName,
              version: this.extractVersion(endpoints),
              address: address.ip,
              port: port.port,
              tags: this.extractTags(endpoints),
              metadata: this.extractMetadata(endpoints),
              health: 'healthy',
              lastHeartbeat: new Date()
            };
            
            instances.push(instance);
          }
        }
      }
    }

    this.services.set(serviceName, instances);
    this.emit('serviceRegistered', { serviceName, instances });
  }

  private extractVersion(endpoints: any): string {
    return endpoints.metadata?.annotations?.['version'] || '1.0.0';
  }

  private extractTags(endpoints: any): string[] {
    const tags = endpoints.metadata?.annotations?.['tags'];
    return tags ? tags.split(',') : [];
  }

  private extractMetadata(endpoints: any): Record<string, string> {
    const annotations = endpoints.metadata?.annotations || {};
    const metadata: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(annotations)) {
      if (key.startsWith('gateway.')) {
        metadata[key.replace('gateway.', '')] = value as string;
      }
    }
    
    return metadata;
  }

  public getService(name: string, version?: string): ServiceInstance | null {
    const instances = this.services.get(name);
    if (!instances || instances.length === 0) {
      return null;
    }

    let filtered = instances;
    if (version) {
      filtered = instances.filter(i => i.version === version);
    }

    if (filtered.length === 0) {
      return null;
    }

    // Round-robin selection
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  public getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }
}
```

## Configuration Examples

```yaml
# Consul configuration
service_discovery:
  provider: consul
  consul:
    host: consul.service.consul
    port: 8500
    datacenter: dc1
    scheme: http
    
  health_check:
    interval: 10s
    timeout: 5s
    
  load_balancer:
    algorithm: least_connections
    health_check_enabled: true
    sticky_session: true
    session_key: JSESSIONID

# Kubernetes configuration
service_discovery:
  provider: kubernetes
  namespace: production
  
  annotations:
    version: app.version
    weight: gateway.weight
    region: gateway.region
    
  load_balancer:
    algorithm: geo_location
    health_check_enabled: true

# Static configuration
service_discovery:
  provider: static
  static_services:
    - id: user-service-1
      name: user-service
      version: "1.2.0"
      address: 10.0.1.10
      port: 8080
      tags: [production, primary]
      metadata:
        weight: "10"
        region: us-east-1
        
    - id: user-service-2
      name: user-service
      version: "1.2.0"
      address: 10.0.1.11
      port: 8080
      tags: [production, secondary]
      metadata:
        weight: "5"
        region: us-east-1

# Load balancing strategies
load_balancing:
  strategies:
    user-service:
      algorithm: weighted
      sticky_session: true
      session_key: user_session
      
    payment-service:
      algorithm: least_connections
      health_check_enabled: true
      
    cdn-service:
      algorithm: geo_location
      fallback: round_robin
      
    analytics-service:
      algorithm: ip_hash
      health_check_enabled: true
```

## Usage Examples

```typescript
// Basic service discovery setup
const serviceRegistry = new ServiceRegistry({
  provider: 'consul',
  consulConfig: {
    host: 'consul.service.consul',
    port: 8500
  }
});

const loadBalancer = new LoadBalancer({
  algorithm: 'least_connections',
  healthCheckEnabled: true,
  stickySession: true,
  sessionKey: 'JSESSIONID'
});

// Service routing middleware
app.use('/api/:service/*', async (req, res, next) => {
  const serviceName = req.params.service;
  const instances = serviceRegistry.getAllServices().get(serviceName);
  
  if (!instances || instances.length === 0) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: `Service ${serviceName} not found`
    });
  }
  
  const selectedInstance = loadBalancer.selectInstance(
    serviceName,
    instances,
    req
  );
  
  if (!selectedInstance) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: `No healthy instances available for ${serviceName}`
    });
  }
  
  // Store selected instance for proxy
  req.selectedInstance = selectedInstance;
  loadBalancer.recordConnection(selectedInstance.id);
  
  res.on('finish', () => {
    loadBalancer.releaseConnection(selectedInstance.id);
  });
  
  next();
});

// Health check endpoint
app.get('/health/services', (req, res) => {
  res.json(serviceRegistry.getHealthStatus());
});

// Service management endpoints
app.post('/admin/services/register', async (req, res) => {
  try {
    serviceRegistry.registerService(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/admin/services/:id', async (req, res) => {
  try {
    serviceRegistry.deregisterService(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Kubernetes service discovery
const k8sDiscovery = new KubernetesServiceDiscovery('production');

k8sDiscovery.on('serviceRegistered', (event) => {
  console.log('New service registered:', event.serviceName);
});

k8sDiscovery.on('serviceDeregistered', (serviceName) => {
  console.log('Service deregistered:', serviceName);
});
```