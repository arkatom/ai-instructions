# Microservices - Kubernetesセキュリティ

> ネットワークセキュリティとアクセス制御の実装

## 概要

Kubernetes環境でのマイクロサービスは、適切なネットワークセキュリティ、アクセス制御、暗号化により、悪意ある攻撃から保護される必要があります。

## 関連ファイル
- [Kubernetes基本リソース](./07-kubernetes-basics.md) - 基本的なリソース設定
- [Kubernetesスケーリング](./08-kubernetes-scaling.md) - 高可用性とスケーリング設定
- [Kubernetesモニタリング](./10-kubernetes-monitoring.md) - 監視とログ管理

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

### 3. セキュリティコンテキスト設定

```yaml
# k8s/security-context.yaml
apiVersion: v1
kind: SecurityContext
metadata:
  name: restricted-security-context
  namespace: microservices-app
spec:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop:
    - ALL
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true

---
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
  - ALL
  volumes:
  - 'configMap'
  - 'emptyDir'
  - 'projected'
  - 'secret'
  - 'downwardAPI'
  - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
    - min: 1
      max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
    - min: 1
      max: 65535
  readOnlyRootFilesystem: true
```

### 4. RBAC設定

```yaml
# k8s/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: user-service-sa
  namespace: microservices-app

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: microservices-app
  name: user-service-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: user-service-binding
  namespace: microservices-app
subjects:
- kind: ServiceAccount
  name: user-service-sa
  namespace: microservices-app
roleRef:
  kind: Role
  name: user-service-role
  apiGroup: rbac.authorization.k8s.io
```

### 5. mTLSと証明書管理

```yaml
# k8s/mtls.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: user-service-tls
  namespace: microservices-app
spec:
  secretName: user-service-tls-secret
  dnsNames:
  - user-service.microservices-app.svc.cluster.local
  - user-service
  issuerRef:
    name: ca-issuer
    kind: ClusterIssuer

---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: ca-issuer
spec:
  ca:
    secretName: ca-key-pair

---
# Service MeshでのmTLS設定
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: microservices-app
spec:
  mtls:
    mode: STRICT

---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: user-service-authz
  namespace: microservices-app
spec:
  selector:
    matchLabels:
      app: user-service
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/microservices-app/sa/api-gateway-sa"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/users/*", "/health"]
```

これらのセキュリティ設定により、マイクロサービス環境を悪意ある攻撃から保護し、適切なアクセス制御を実現できます。次は[監視とログ管理](./10-kubernetes-monitoring.md)について学習しましょう。