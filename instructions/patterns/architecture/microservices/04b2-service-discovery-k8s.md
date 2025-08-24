# Microservices - Service Discovery Kubernetes統合

> Kubernetes Native Service Discovery、Istio Service Mesh統合

## 概要

KubernetesにおけるService Discoveryは、プラットフォーム固有のService、Endpoints、DNS機能を活用して実現されます。Istio Service Meshと組み合わせることで、より高度なトラフィック管理、セキュリティ、可観測性を提供できます。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryサーバーサイド](./04b-service-discovery-server.md) - サーバーサイド実装概要
- [Service Discovery API Gateway](./04b1-service-discovery-gateway.md) - API Gateway統合パターン
- [Service Discovery DNS](./04b3-service-discovery-dns.md) - DNS-based Discovery

## Kubernetes Service定義

### 1. 基本Service設定

```yaml
# k8s/service-discovery/user-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: microservices
  labels:
    app: user-service
    version: v1
    component: microservice
  annotations:
    service.alpha.kubernetes.io/tolerate-unready-endpoints: "true"
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: user-service
    version: v1
  ports:
  - port: 80
    targetPort: 3000
    name: http
    protocol: TCP
  - port: 8080
    targetPort: 8080
    name: management
    protocol: TCP
  - port: 9090
    targetPort: 9090
    name: metrics
    protocol: TCP
  type: ClusterIP
  sessionAffinity: None

---
apiVersion: v1
kind: Endpoints
metadata:
  name: user-service
  namespace: microservices
  labels:
    app: user-service
subsets:
- addresses:
  - ip: 10.1.1.1
    targetRef:
      kind: Pod
      name: user-service-7d4b8f6c8-abc12
      namespace: microservices
  - ip: 10.1.1.2
    targetRef:
      kind: Pod
      name: user-service-7d4b8f6c8-def34
      namespace: microservices
  - ip: 10.1.1.3
    targetRef:
      kind: Pod
      name: user-service-7d4b8f6c8-ghi56
      namespace: microservices
  ports:
  - port: 3000
    name: http
  - port: 8080
    name: management
  - port: 9090
    name: metrics
- notReadyAddresses:
  - ip: 10.1.1.4
    targetRef:
      kind: Pod
      name: user-service-7d4b8f6c8-jkl78
      namespace: microservices
  ports:
  - port: 3000
    name: http
```

### 2. HeadlessService設定

```yaml
# k8s/service-discovery/user-service-headless.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service-headless
  namespace: microservices
  labels:
    app: user-service
    service-type: headless
spec:
  clusterIP: None  # HeadlessServiceの設定
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 3000
    name: http
  - port: 8080
    targetPort: 8080
    name: management

---
# StatefulSetとの組み合わせ例
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: user-service
  namespace: microservices
spec:
  serviceName: user-service-headless
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 8080
          name: management
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
```

## Istio Service Mesh統合

### 1. DestinationRule設定

```yaml
# k8s/istio/destination-rules.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
  namespace: microservices
spec:
  host: user-service.microservices.svc.cluster.local
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpHeaderName: "x-user-id"  # スティッキーセッション
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 30s
        keepAlive:
          time: 7200s
          interval: 75s
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
        maxRetries: 3
        consecutiveGatewayErrors: 5
        interval: 30s
        baseEjectionTime: 30s
        maxEjectionPercent: 50
        minHealthPercent: 50
    circuitBreaker:
      consecutiveGatewayErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50
    outlierDetection:
      consecutiveGatewayErrors: 5
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50
      splitExternalLocalOriginErrors: false
  subsets:
  - name: v1
    labels:
      version: v1
    trafficPolicy:
      loadBalancer:
        simple: LEAST_CONN
      portLevelSettings:
      - port:
          number: 80
        loadBalancer:
          simple: ROUND_ROBIN
  - name: v2
    labels:
      version: v2
    trafficPolicy:
      loadBalancer:
        simple: ROUND_ROBIN
      connectionPool:
        tcp:
          maxConnections: 50
        http:
          http1MaxPendingRequests: 25
  - name: canary
    labels:
      version: v2
      canary: "true"
    trafficPolicy:
      loadBalancer:
        simple: LEAST_CONN
```

### 2. VirtualService設定

```yaml
# k8s/istio/virtual-services.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-service
  namespace: microservices
spec:
  hosts:
  - user-service.microservices.svc.cluster.local
  http:
  # カナリアリリース用ルーティング
  - match:
    - headers:
        x-canary-version:
          exact: v2
    route:
    - destination:
        host: user-service.microservices.svc.cluster.local
        subset: canary
      weight: 100
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: gateway-error,connect-failure,refused-stream
  
  # A/Bテスト用ルーティング
  - match:
    - headers:
        x-user-group:
          exact: beta
    route:
    - destination:
        host: user-service.microservices.svc.cluster.local
        subset: v2
      weight: 100
    timeout: 30s
  
  # 通常のトラフィック分散
  - route:
    - destination:
        host: user-service.microservices.svc.cluster.local
        subset: v1
      weight: 90
    - destination:
        host: user-service.microservices.svc.cluster.local
        subset: v2
      weight: 10
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
      abort:
        percentage:
          value: 0.01
        httpStatus: 503
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: gateway-error,connect-failure,refused-stream
    mirror:
      host: user-service-shadow.microservices.svc.cluster.local
    mirrorPercentage:
      value: 1.0  # 1%のトラフィックをミラーリング

---
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: microservices-gateway
  namespace: microservices
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - api.microservices.local
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: microservices-tls
    hosts:
    - api.microservices.local
```

## Kubernetes Native Service Discovery

### 1. Kubernetes Service Discovery実装

```typescript
// shared/infrastructure/k8s-service-discovery.ts
import * as k8s from '@kubernetes/client-node';

export class KubernetesServiceDiscovery implements ServiceRegistry {
  private k8sApi: k8s.CoreV1Api;
  private namespace: string;
  private logger: Logger;
  private watchController: AbortController | null = null;

  constructor(namespace: string = 'default', logger: Logger) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.namespace = namespace;
    this.logger = logger;
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    try {
      // Serviceリソースの取得
      const serviceResponse = await this.k8sApi.readNamespacedService(serviceName, this.namespace);
      const service = serviceResponse.body;

      // Endpointsの取得
      const endpointsResponse = await this.k8sApi.readNamespacedEndpoints(serviceName, this.namespace);
      const endpoints = endpointsResponse.body;

      const instances: ServiceInstance[] = [];

      if (endpoints.subsets) {
        for (const subset of endpoints.subsets) {
          // Ready状態のアドレス
          if (subset.addresses) {
            for (const address of subset.addresses) {
              const ports = subset.ports || [];
              for (const port of ports) {
                const instance = this.createServiceInstance(
                  serviceName,
                  address,
                  port,
                  ServiceStatus.UP
                );
                instances.push(instance);
              }
            }
          }

          // NotReady状態のアドレス（オプション）
          if (subset.notReadyAddresses) {
            for (const address of subset.notReadyAddresses) {
              const ports = subset.ports || [];
              for (const port of ports) {
                const instance = this.createServiceInstance(
                  serviceName,
                  address,
                  port,
                  ServiceStatus.STARTING
                );
                instances.push(instance);
              }
            }
          }
        }
      }

      this.logger.info('Service instances discovered', {
        serviceName,
        instanceCount: instances.length,
        readyCount: instances.filter(i => i.status === ServiceStatus.UP).length
      });

      return instances;
    } catch (error) {
      this.logger.error(`Failed to discover service ${serviceName}`, { error });
      return [];
    }
  }

  private createServiceInstance(
    serviceName: string,
    address: k8s.V1EndpointAddress,
    port: k8s.V1EndpointPort,
    status: ServiceStatus
  ): ServiceInstance {
    return {
      id: `${serviceName}-${address.ip}-${port.port}`,
      serviceName,
      host: address.ip || '',
      port: port.port || 80,
      healthCheckUrl: `http://${address.ip}:${port.port}/health`,
      metadata: {
        namespace: this.namespace,
        podName: address.targetRef?.name || '',
        podUID: address.targetRef?.uid || '',
        portName: port.name || 'http',
        portProtocol: port.protocol || 'TCP',
        nodeName: address.nodeName || '',
        ready: status === ServiceStatus.UP
      },
      status,
      lastHeartbeat: new Date()
    };
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    // KubernetesのService DNSを使用
    return `http://${serviceName}.${this.namespace}.svc.cluster.local`;
  }

  async watchServiceChanges(
    serviceName: string,
    callback: (instances: ServiceInstance[]) => void
  ): Promise<void> {
    this.watchController = new AbortController();

    try {
      const watch = new k8s.Watch(this.k8sApi.basePath);
      
      // Endpointsリソースの変更を監視
      await watch.watch(
        `/api/v1/namespaces/${this.namespace}/endpoints`,
        {
          fieldSelector: `metadata.name=${serviceName}`
        },
        async (type: string, apiObj: any, watchObj: any) => {
          if (type === 'ADDED' || type === 'MODIFIED' || type === 'DELETED') {
            const instances = await this.discover(serviceName);
            callback(instances);
          }
        },
        (err: any) => {
          if (err && !this.watchController?.signal.aborted) {
            this.logger.error('Service watch error', { serviceName, error: err });
          }
        },
        this.watchController.signal
      );
    } catch (error) {
      this.logger.error('Failed to watch service changes', { serviceName, error });
    }
  }

  stopWatching(): void {
    if (this.watchController) {
      this.watchController.abort();
      this.watchController = null;
    }
  }

  // Kubernetesでは自動管理されるため、以下は実装不要
  async register(instance: ServiceInstance): Promise<void> {
    throw new Error('Service registration is handled by Kubernetes');
  }

  async deregister(instanceId: string): Promise<void> {
    throw new Error('Service deregistration is handled by Kubernetes');
  }

  async heartbeat(instanceId: string): Promise<void> {
    // Kubernetesのliveness probeで管理
  }

  async getServiceMetadata(serviceName: string): Promise<ServiceMetadata | null> {
    try {
      const serviceResponse = await this.k8sApi.readNamespacedService(serviceName, this.namespace);
      const service = serviceResponse.body;

      return {
        name: service.metadata?.name || serviceName,
        namespace: service.metadata?.namespace || this.namespace,
        labels: service.metadata?.labels || {},
        annotations: service.metadata?.annotations || {},
        ports: service.spec?.ports?.map(port => ({
          name: port.name || '',
          port: port.port,
          targetPort: port.targetPort,
          protocol: port.protocol || 'TCP'
        })) || [],
        type: service.spec?.type || 'ClusterIP'
      };
    } catch (error) {
      this.logger.error('Failed to get service metadata', { serviceName, error });
      return null;
    }
  }
}

interface ServiceMetadata {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  ports: ServicePort[];
  type: string;
}

interface ServicePort {
  name: string;
  port: number;
  targetPort: number | string;
  protocol: string;
}
```

### 2. Kubernetes統合の設定例

```typescript
// shared/config/k8s-discovery-config.ts
export class KubernetesDiscoveryConfig {
  static createDiscovery(namespace: string = 'microservices'): KubernetesServiceDiscovery {
    const logger = new Logger('k8s-discovery');
    return new KubernetesServiceDiscovery(namespace, logger);
  }

  static async setupServiceWatching(
    discovery: KubernetesServiceDiscovery,
    services: string[],
    onServiceChange: (serviceName: string, instances: ServiceInstance[]) => void
  ): Promise<void> {
    for (const serviceName of services) {
      await discovery.watchServiceChanges(serviceName, (instances) => {
        onServiceChange(serviceName, instances);
      });
    }
  }
}

// 使用例
const discovery = KubernetesDiscoveryConfig.createDiscovery('microservices');

const serviceNames = ['user-service', 'order-service', 'inventory-service'];
await KubernetesDiscoveryConfig.setupServiceWatching(
  discovery,
  serviceNames,
  (serviceName, instances) => {
    console.log(`Service ${serviceName} instances updated:`, instances.length);
    // サービスインスタンス変更時の処理
  }
);
```

Kubernetes NativeのService Discoveryにより、プラットフォーム固有の機能を活用した堅牢で効率的なサービス発見機能を実現できます。