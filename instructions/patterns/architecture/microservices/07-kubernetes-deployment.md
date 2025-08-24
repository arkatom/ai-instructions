# Microservices - Kubernetes運用

> 本番環境でのデプロイとスケーリング、運用自動化

## 概要

Kubernetesは、マイクロサービスの本番運用に必要な機能（デプロイメント、スケーリング、サービスディスカバリー、ロードバランシング、ヘルスチェック）を提供します。適切な設定により、高可用性でスケーラブルなマイクロサービス環境を構築できます。

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

## ネットワークとセキュリティ

### 1. Network Policy

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-service-network-policy
  namespace: microservices-app
spec:
  podSelector:
    matchLabels:
      app: user-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    - podSelector:
        matchLabels:
          app: order-service
    ports:
    - protocol: TCP
      port: 3000
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
  egress:
  # データベースへのアクセス
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  # Redis への接続
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  # DNS解決
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  # HTTPS外部API呼び出し
  - to: []
    ports:
    - protocol: TCP
      port: 443

---
# API Gatewayのネットワークポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-network-policy
  namespace: microservices-app
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # インターネットからのアクセス許可
  - from: []
    ports:
    - protocol: TCP
      port: 3000
  egress:
  # すべてのマイクロサービスへのアクセス
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 3000
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

### 2. Ingress設定

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: microservices-app
  annotations:
    # NGINX Ingress Controller
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/rate-limit-burst-multiplier: "5"
    
    # SSL/TLS設定
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    cert-manager.io/acme-challenge-type: http01
    
    # セキュリティヘッダー
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Frame-Options SAMEORIGIN always;
      add_header X-Content-Type-Options nosniff always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CORS設定
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"
    
    # Prometheus監視
    nginx.ingress.kubernetes.io/server-snippet: |
      location /metrics {
        deny all;
        return 403;
      }
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-cert
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80

---
# Internal Ingress for monitoring/admin
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: internal-ingress
  namespace: microservices-app
  annotations:
    nginx.ingress.kubernetes.io/whitelist-source-range: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
spec:
  ingressClassName: nginx-internal
  rules:
  - host: internal.example.com
    http:
      paths:
      - path: /metrics
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /health
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
```

## モニタリングと監視

### 1. ServiceMonitor（Prometheus Operator）

```yaml
# k8s/monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: microservices-monitor
  namespace: microservices-app
  labels:
    app: microservices
    release: prometheus
spec:
  selector:
    matchLabels:
      monitoring: enabled
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
    honorLabels: true
    metricRelabelings:
    - sourceLabels: [__name__]
      regex: 'go_.*'
      action: drop

---
apiVersion: v1
kind: Service
metadata:
  name: user-service-metrics
  namespace: microservices-app
  labels:
    app: user-service
    monitoring: enabled
spec:
  selector:
    app: user-service
  ports:
  - port: 3000
    name: http

---
# PrometheusRule for alerting
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: microservices-alerts
  namespace: microservices-app
  labels:
    app: microservices
    release: prometheus
spec:
  groups:
  - name: microservices.rules
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        (
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)
        ) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
        description: "{{ $labels.service }} has an error rate of {{ $value | humanizePercentage }}"
    
    - alert: HighLatency
      expr: |
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
        ) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High latency detected"
        description: "{{ $labels.service }} 95th percentile latency is {{ $value }}s"
    
    - alert: PodCrashLooping
      expr: |
        rate(kube_pod_container_status_restarts_total[5m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod is crash looping"
        description: "Pod {{ $labels.pod }} in {{ $labels.namespace }} is crash looping"
    
    - alert: DeploymentReplicasMismatch
      expr: |
        kube_deployment_spec_replicas != kube_deployment_status_available_replicas
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Deployment replicas mismatch"
        description: "{{ $labels.deployment }} has {{ $value }} available replicas, expected {{ $labels.spec_replicas }}"
```

### 2. ログ管理

```yaml
# k8s/logging.yaml
apiVersion: logging.coreos.com/v1
kind: ClusterLogForwarder
metadata:
  name: microservices-logs
  namespace: openshift-logging
spec:
  outputs:
  - name: elasticsearch-microservices
    type: elasticsearch
    url: https://elasticsearch.logging.svc.cluster.local:9200
    elasticsearch:
      index: microservices-{.log_type}-write
  pipelines:
  - name: microservices-pipeline
    inputRefs:
    - application
    filterRefs:
    - microservices-filter
    outputRefs:
    - elasticsearch-microservices

---
apiVersion: logging.coreos.com/v1
kind: ClusterLogFilter
metadata:
  name: microservices-filter
spec:
  type: json
  json:
    javascript: |
      const log = record.log;
      if (log && log.service && log.service.startsWith('microservices-')) {
        record.parsed_log = JSON.parse(log.message);
        record.service_name = log.service;
        record.trace_id = log.trace_id;
        record.span_id = log.span_id;
      }
      return record;

---
# Fluent Bit DaemonSet for custom log processing
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit-microservices
  namespace: microservices-app
spec:
  selector:
    matchLabels:
      name: fluent-bit-microservices
  template:
    metadata:
      labels:
        name: fluent-bit-microservices
    spec:
      serviceAccountName: fluent-bit
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:2.1.4
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
        volumeMounts:
        - name: config
          mountPath: /fluent-bit/etc/
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: fluent-bit-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

## CI/CDパイプライン

### 1. GitHub Actions ワークフロー

```yaml
# .github/workflows/deploy.yml
name: Deploy Microservices

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME_PREFIX: microservices

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run security scan
      run: npm audit --audit-level moderate

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service: [user-service, order-service, inventory-service, payment-service]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ github.repository_owner }}/${{ env.IMAGE_NAME_PREFIX }}-${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./services/${{ matrix.service }}
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kube config
      run: aws eks update-kubeconfig --name production-cluster --region us-west-2
    
    - name: Deploy to Kubernetes
      run: |
        # Update image tags in manifests
        export IMAGE_TAG=${GITHUB_SHA}
        envsubst < k8s/user-service.yaml | kubectl apply -f -
        envsubst < k8s/order-service.yaml | kubectl apply -f -
        envsubst < k8s/inventory-service.yaml | kubectl apply -f -
        envsubst < k8s/payment-service.yaml | kubectl apply -f -
    
    - name: Wait for rollout
      run: |
        kubectl rollout status deployment/user-service -n microservices-app --timeout=300s
        kubectl rollout status deployment/order-service -n microservices-app --timeout=300s
        kubectl rollout status deployment/inventory-service -n microservices-app --timeout=300s
        kubectl rollout status deployment/payment-service -n microservices-app --timeout=300s
    
    - name: Run smoke tests
      run: |
        kubectl run smoke-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
        curl -f http://api-gateway.microservices-app.svc.cluster.local/health
```

### 2. Helm Charts

```yaml
# helm/microservices/Chart.yaml
apiVersion: v2
name: microservices
description: A Helm chart for microservices application
type: application
version: 0.1.0
appVersion: "1.0.0"
dependencies:
- name: postgresql
  version: "12.1.2"
  repository: "https://charts.bitnami.com/bitnami"
  condition: postgresql.enabled
- name: redis
  version: "17.4.3"
  repository: "https://charts.bitnami.com/bitnami"
  condition: redis.enabled

---
# helm/microservices/values.yaml
global:
  imageRegistry: ghcr.io
  imageRepository: mycompany/microservices
  imageTag: "latest"
  imagePullPolicy: IfNotPresent

services:
  userService:
    enabled: true
    replicas: 3
    image:
      repository: user-service
      tag: ""
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
    autoscaling:
      enabled: true
      minReplicas: 3
      maxReplicas: 20
      targetCPUUtilizationPercentage: 70

  orderService:
    enabled: true
    replicas: 3
    image:
      repository: order-service
      tag: ""
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
  - host: api.example.com
    paths:
    - path: /
      pathType: Prefix
  tls:
  - secretName: api-tls-cert
    hosts:
    - api.example.com

postgresql:
  enabled: true
  auth:
    username: microservices
    database: microservices
  primary:
    persistence:
      enabled: true
      size: 20Gi

redis:
  enabled: true
  auth:
    enabled: true
  master:
    persistence:
      enabled: true
      size: 8Gi

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
```

## 災害復旧とバックアップ

### 1. データベースバックアップ

```yaml
# k8s/backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgresql-backup
  namespace: microservices-app
spec:
  schedule: "0 2 * * *"  # 毎日2:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:14-alpine
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: password
            command:
            - /bin/bash
            - -c
            - |
              BACKUP_FILE="/backup/postgresql-$(date +%Y%m%d_%H%M%S).sql"
              pg_dump -h postgresql -U microservices -d microservices > $BACKUP_FILE
              
              # S3へのアップロード
              aws s3 cp $BACKUP_FILE s3://microservices-backups/postgresql/
              
              # 古いバックアップの削除（7日以上古い）
              find /backup -name "postgresql-*.sql" -mtime +7 -delete
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
  namespace: microservices-app
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: gp2
```

### 2. 災害復旧手順書

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

# 災害復旧スクリプト
set -e

NAMESPACE="microservices-app"
BACKUP_BUCKET="microservices-backups"
RESTORE_DATE=${1:-$(date +%Y%m%d)}

echo "Starting disaster recovery for date: $RESTORE_DATE"

# 1. データベース復旧
echo "Restoring database..."
BACKUP_FILE="postgresql-${RESTORE_DATE}_*.sql"
aws s3 cp s3://$BACKUP_BUCKET/postgresql/$BACKUP_FILE /tmp/restore.sql

kubectl exec -n $NAMESPACE deployment/postgresql -- \
  psql -U microservices -d microservices -f /tmp/restore.sql

# 2. アプリケーション復旧
echo "Redeploying applications..."
kubectl rollout restart deployment/user-service -n $NAMESPACE
kubectl rollout restart deployment/order-service -n $NAMESPACE
kubectl rollout restart deployment/inventory-service -n $NAMESPACE
kubectl rollout restart deployment/payment-service -n $NAMESPACE

# 3. ヘルスチェック
echo "Performing health checks..."
kubectl wait --for=condition=available --timeout=300s \
  deployment/user-service -n $NAMESPACE

kubectl wait --for=condition=available --timeout=300s \
  deployment/order-service -n $NAMESPACE

# 4. 動作確認
echo "Running smoke tests..."
kubectl run smoke-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -f http://api-gateway.$NAMESPACE.svc.cluster.local/health

echo "Disaster recovery completed successfully"
```

Kubernetesを適切に設定・運用することで、マイクロサービスアーキテクチャの高可用性、拡張性、運用性を実現できます。段階的な導入と継続的な改善により、安定した本番環境を構築しましょう。