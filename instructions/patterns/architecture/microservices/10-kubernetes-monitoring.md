# Microservices - Kubernetesモニタリング

> 監視、ログ管理、バックアップの実装

## 概要

本番環境のマイクロサービスでは、包括的なモニタリング、ログ集約、バックアップ戦略、災害復旧計画が不可欠です。

## 関連ファイル
- [Kubernetes基本リソース](./07-kubernetes-basics.md) - 基本的なリソース設定
- [Kubernetesセキュリティ](./09-kubernetes-security.md) - ネットワークとセキュリティ
- [Kubernetes CI/CD](./11-kubernetes-cicd.md) - デプロイメントパイプライン

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

### 3. モニタリングダッシュボード設定

```typescript
// shared/monitoring/dashboard-config.ts
export const dashboardConfig = {
  title: "Microservices Health Dashboard",
  panels: [
    {
      title: "Service Health Status",
      type: "stat",
      targets: [
        {
          expr: 'up{job="microservices"} == 1',
          legendFormat: "{{service}}"
        }
      ]
    },
    {
      title: "Request Rate",
      type: "graph",
      targets: [
        {
          expr: 'sum(rate(http_requests_total[5m])) by (service)',
          legendFormat: "{{service}}"
        }
      ]
    },
    {
      title: "Error Rate",
      type: "graph",
      targets: [
        {
          expr: 'sum(rate(http_requests_total{status_code=~"4..|5.."}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)',
          legendFormat: "{{service}}"
        }
      ]
    },
    {
      title: "Response Time (95th percentile)",
      type: "graph",
      targets: [
        {
          expr: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))',
          legendFormat: "{{service}}"
        }
      ]
    }
  ]
};
```

これらのモニタリングとバックアップ設定により、マイクロサービスの安定的な運用と迅速な問題対応を実現できます。最後に[CI/CDパイプライン](./11-kubernetes-cicd.md)について学習しましょう。