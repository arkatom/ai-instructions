# Microservices - Kubernetesスケーリング

> 高可用性と動的スケーリングの実装

## 概要

マイクロサービスの本番運用では、トラフィックの変動に応じて自動的にスケールし、障害発生時でもサービス継続できる高可用性の確保が重要です。

## 関連ファイル
- [Kubernetes基本リソース](./07-kubernetes-basics.md) - 基本的なリソース設定
- [Kubernetesセキュリティ](./09-kubernetes-security.md) - ネットワークとセキュリティ
- [Kubernetesモニタリング](./10-kubernetes-monitoring.md) - 監視とログ管理

## 高可用性とスケーリング

### 1. Horizontal Pod Autoscaler (HPA)

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: microservices-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min

---
# Vertical Pod Autoscaler (VPA)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: user-service-vpa
  namespace: microservices-app
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  updatePolicy:
    updateMode: "Auto"
    minReplicas: 3
  resourcePolicy:
    containerPolicies:
    - containerName: user-service
      maxAllowed:
        cpu: 1000m
        memory: 1Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
      controlledResources: ["cpu", "memory"]
```

### 2. Pod Disruption Budget

```yaml
# k8s/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: user-service-pdb
  namespace: microservices-app
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: user-service

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: order-service-pdb
  namespace: microservices-app
spec:
  maxUnavailable: 25%
  selector:
    matchLabels:
      app: order-service
```

### 3. クラスターオートスケーラー

```yaml
# k8s/cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/microservices-cluster
        env:
        - name: AWS_REGION
          value: us-west-2
        volumeMounts:
        - name: ssl-certs
          mountPath: /etc/ssl/certs/ca-certificates.crt
          readOnly: true
      volumes:
      - name: ssl-certs
        hostPath:
          path: "/etc/ssl/certs/ca-bundle.crt"
```

### 4. ロードバランシング設定

```yaml
# k8s/load-balancing.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service-lb
  namespace: microservices-app
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "http"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-path: "/health"
    service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval: "30"
spec:
  type: LoadBalancer
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  sessionAffinity: None
  loadBalancerSourceRanges:
  - 10.0.0.0/8
  - 172.16.0.0/12
  - 192.168.0.0/16
```

### 5. スケーリングポリシー

```typescript
// shared/scaling/scaling-policy.ts
export interface ScalingPolicy {
  name: string;
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetric[];
  behavior?: ScalingBehavior;
}

export interface ScalingMetric {
  type: 'cpu' | 'memory' | 'custom';
  targetValue: number;
  metricName?: string;
}

export interface ScalingBehavior {
  scaleUp: {
    stabilizationWindowSeconds: number;
    policies: ScalingPolicy[];
  };
  scaleDown: {
    stabilizationWindowSeconds: number;
    policies: ScalingPolicy[];
  };
}

export class ScalingManager {
  private kubeClient: k8s.CoreV1Api;
  private autoscalingClient: k8s.AutoscalingV2Api;

  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.kubeClient = kc.makeApiClient(k8s.CoreV1Api);
    this.autoscalingClient = kc.makeApiClient(k8s.AutoscalingV2Api);
  }

  async createHPA(
    name: string,
    namespace: string,
    policy: ScalingPolicy
  ): Promise<void> {
    const hpa: k8s.V2HorizontalPodAutoscaler = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name,
        namespace
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: name.replace('-hpa', '')
        },
        minReplicas: policy.minReplicas,
        maxReplicas: policy.maxReplicas,
        metrics: policy.metrics.map(metric => ({
          type: metric.type === 'custom' ? 'Pods' : 'Resource',
          resource: metric.type !== 'custom' ? {
            name: metric.type,
            target: {
              type: 'Utilization',
              averageUtilization: metric.targetValue
            }
          } : undefined,
          pods: metric.type === 'custom' ? {
            metric: { name: metric.metricName },
            target: {
              type: 'AverageValue',
              averageValue: metric.targetValue.toString()
            }
          } : undefined
        }))
      }
    };

    await this.autoscalingClient.createNamespacedHorizontalPodAutoscaler(
      namespace,
      hpa
    );
  }

  async getScalingStatus(
    name: string,
    namespace: string
  ): Promise<ScalingStatus> {
    const hpa = await this.autoscalingClient.readNamespacedHorizontalPodAutoscaler(
      name,
      namespace
    );

    return {
      currentReplicas: hpa.body.status?.currentReplicas || 0,
      desiredReplicas: hpa.body.status?.desiredReplicas || 0,
      conditions: hpa.body.status?.conditions || []
    };
  }
}

interface ScalingStatus {
  currentReplicas: number;
  desiredReplicas: number;
  conditions: any[];
}
```

これらのスケーリング設定により、マイクロサービスの高可用性と効率的なリソース利用を実現できます。次は[ネットワークとセキュリティ](./09-kubernetes-security.md)について学習しましょう。