# Microservices - Kubernetes基本リソース

> 基本的なKubernetesリソースの設定と管理

## 概要

Kubernetesは、マイクロサービスの本番運用に必要な機能（デプロイメント、スケーリング、サービスディスカバリー、ロードバランシング、ヘルスチェック）を提供します。ここでは基本的なリソース設定について説明します。

## 関連ファイル
- [Kubernetesスケーリング](./08-kubernetes-scaling.md) - 高可用性とスケーリング設定
- [Kubernetesセキュリティ](./09-kubernetes-security.md) - ネットワークとセキュリティ
- [Kubernetesモニタリング](./10-kubernetes-monitoring.md) - 監視とログ管理
- [Kubernetes CI/CD](./11-kubernetes-cicd.md) - デプロイメントパイプライン

## 基本的なKubernetesリソース

### 1. Namespace設定

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: microservices-app
  labels:
    name: microservices-app
    environment: production
    project: ecommerce-platform

---
# リソースクォータ
apiVersion: v1
kind: ResourceQuota
metadata:
  name: microservices-quota
  namespace: microservices-app
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "10"
    persistentvolumeclaims: "10"

---
# ネットワークポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: microservices-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

### 2. ConfigMapとSecret管理

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: microservices-app
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  TRACING_ENABLED: "true"
  METRICS_ENABLED: "true"
  API_GATEWAY_URL: "http://api-gateway:3000"
  RATE_LIMIT_WINDOW: "900000" # 15分
  RATE_LIMIT_MAX: "1000"
  CACHE_TTL: "3600" # 1時間
  DATABASE_MAX_CONNECTIONS: "20"
  DATABASE_IDLE_TIMEOUT: "30000"

---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: microservices-app
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  redis-url: <base64-encoded-redis-url>
  jwt-secret: <base64-encoded-jwt-secret>
  rabbitmq-url: <base64-encoded-rabbitmq-url>
  sendgrid-api-key: <base64-encoded-sendgrid-key>

---
# External Secrets Operator使用例
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: microservices-app
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "microservices-role"

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets-external
  namespace: microservices-app
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets-vault
    creationPolicy: Owner
  data:
  - secretKey: database-url
    remoteRef:
      key: microservices/database
      property: url
  - secretKey: jwt-secret
    remoteRef:
      key: microservices/auth
      property: jwt-secret
```

### 3. サービス定義

```yaml
# k8s/user-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: microservices-app
  labels:
    app: user-service
    version: v1
    component: microservice
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: user-service
      version: v1
  template:
    metadata:
      labels:
        app: user-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
        co.elastic.logs/enabled: "true"
    spec:
      serviceAccountName: user-service-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: user-service
        image: user-service:v1.2.3
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        - containerPort: 9090
          name: grpc
          protocol: TCP
        env:
        - name: PORT
          value: "3000"
        - name: GRPC_PORT
          value: "9090"
        - name: SERVICE_NAME
          value: "user-service"
        - name: SERVICE_VERSION
          value: "v1.2.3"
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
            ephemeral-storage: "1Gi"
          limits:
            memory: "512Mi"
            cpu: "500m"
            ephemeral-storage: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /startup
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: config-volume
          mountPath: /app/config
          readOnly: true
        - name: logs-volume
          mountPath: /app/logs
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: config-volume
        configMap:
          name: app-config
      - name: logs-volume
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - user-service
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: microservices-app
  labels:
    app: user-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
  - port: 9090
    targetPort: grpc
    protocol: TCP
    name: grpc
  type: ClusterIP
  sessionAffinity: None

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: user-service-sa
  namespace: microservices-app
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/UserServiceRole
```

これらの基本的なKubernetesリソースの設定により、マイクロサービスの基盤となるインフラストラクチャを構築できます。次のステップでは[高可用性とスケーリング](./08-kubernetes-scaling.md)について学習しましょう。