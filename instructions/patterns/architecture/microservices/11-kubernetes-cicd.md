# Microservices - Kubernetes CI/CD

> デプロイメントパイプライン、Helmチャート、自動化の実装

## 概要

マイクロサービスの継続的インテグレーション・継続的デプロイメント（CI/CD）は、開発効率の向上と品質保証、運用自動化の実現に不可欠です。GitHubActions、Helmチャート、自動テストにより完全に自動化されたデプロイメントを構築します。

## 関連ファイル
- [Kubernetes基本リソース](./07-kubernetes-basics.md) - 基本的なリソース設定
- [Kubernetesスケーリング](./08-kubernetes-scaling.md) - 高可用性とスケーリング設定
- [Kubernetesモニタリング](./10-kubernetes-monitoring.md) - 監視とログ管理

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

### 3. デプロイメント自動化スクリプト

```typescript
// scripts/deploy.ts
import * as k8s from '@kubernetes/client-node';
import { Helm3 } from 'helm3-js';
import { execSync } from 'child_process';

interface DeploymentConfig {
  environment: string;
  namespace: string;
  imageTag: string;
  helmValues: Record<string, any>;
}

class DeploymentManager {
  private kubeConfig: k8s.KubeConfig;
  private helm: Helm3;

  constructor() {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();
    this.helm = new Helm3();
  }

  async deploy(config: DeploymentConfig): Promise<void> {
    console.log(`Starting deployment to ${config.environment}...`);

    try {
      // 1. 名前空間の作成・更新
      await this.ensureNamespace(config.namespace);
      
      // 2. Secretsの更新
      await this.updateSecrets(config.namespace);
      
      // 3. Helmチャートのデプロイ
      await this.deployHelmChart(config);
      
      // 4. デプロイメントの検証
      await this.verifyDeployment(config.namespace);
      
      // 5. スモークテストの実行
      await this.runSmokeTests(config.namespace);
      
      console.log('Deployment completed successfully!');
    } catch (error) {
      console.error('Deployment failed:', error);
      await this.rollback(config);
      throw error;
    }
  }

  private async ensureNamespace(namespace: string): Promise<void> {
    const client = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    
    try {
      await client.readNamespace(namespace);
    } catch (error) {
      if (error.response?.statusCode === 404) {
        await client.createNamespace({
          metadata: { name: namespace }
        });
        console.log(`Created namespace: ${namespace}`);
      } else {
        throw error;
      }
    }
  }

  private async updateSecrets(namespace: string): Promise<void> {
    // External Secrets Operatorによる自動更新を待機
    console.log('Waiting for secrets to be updated...');
    
    const maxWaitTime = 60000; // 60秒
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const client = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
        const secrets = await client.listNamespacedSecret(namespace);
        
        const requiredSecrets = ['app-secrets', 'database-secrets'];
        const existingSecrets = secrets.body.items.map(s => s.metadata?.name);
        
        if (requiredSecrets.every(secret => existingSecrets.includes(secret))) {
          console.log('All required secrets are available');
          return;
        }
      } catch (error) {
        console.warn('Error checking secrets:', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Required secrets are not available after waiting');
  }

  private async deployHelmChart(config: DeploymentConfig): Promise<void> {
    const helmArgs = [
      'upgrade', '--install',
      'microservices',
      './helm/microservices',
      `--namespace=${config.namespace}`,
      '--create-namespace',
      `--set=global.imageTag=${config.imageTag}`,
      '--wait', '--timeout=10m'
    ];

    // values.yamlからのカスタムvaluesを追加
    for (const [key, value] of Object.entries(config.helmValues)) {
      helmArgs.push(`--set=${key}=${value}`);
    }

    console.log('Deploying Helm chart...');
    execSync(`helm ${helmArgs.join(' ')}`, { stdio: 'inherit' });
  }

  private async verifyDeployment(namespace: string): Promise<void> {
    console.log('Verifying deployment...');
    
    const client = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
    const deployments = ['user-service', 'order-service', 'inventory-service', 'payment-service'];
    
    for (const deployment of deployments) {
      const maxWaitTime = 300000; // 5分
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const dep = await client.readNamespacedDeployment(deployment, namespace);
          const status = dep.body.status;
          
          if (status?.readyReplicas === status?.replicas && status?.replicas > 0) {
            console.log(`✅ ${deployment} is ready`);
            break;
          }
        } catch (error) {
          console.warn(`Waiting for ${deployment}:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  private async runSmokeTests(namespace: string): Promise<void> {
    console.log('Running smoke tests...');
    
    const testCommands = [
      `kubectl run smoke-test-health --image=curlimages/curl:latest --rm -i --restart=Never --namespace=${namespace} -- curl -f http://api-gateway/health`,
      `kubectl run smoke-test-users --image=curlimages/curl:latest --rm -i --restart=Never --namespace=${namespace} -- curl -f http://user-service/health`,
      `kubectl run smoke-test-orders --image=curlimages/curl:latest --rm -i --restart=Never --namespace=${namespace} -- curl -f http://order-service/health`
    ];
    
    for (const command of testCommands) {
      try {
        execSync(command, { stdio: 'inherit' });
        console.log('✅ Smoke test passed');
      } catch (error) {
        console.error('❌ Smoke test failed:', error.message);
        throw new Error('Smoke tests failed');
      }
    }
  }

  private async rollback(config: DeploymentConfig): Promise<void> {
    console.log('Rolling back deployment...');
    
    try {
      execSync(`helm rollback microservices --namespace=${config.namespace}`, { stdio: 'inherit' });
      console.log('Rollback completed');
    } catch (error) {
      console.error('Rollback failed:', error.message);
    }
  }
}

// 実行例
const deploymentConfig: DeploymentConfig = {
  environment: 'production',
  namespace: 'microservices-app',
  imageTag: process.env.IMAGE_TAG || 'latest',
  helmValues: {
    'services.userService.replicas': 5,
    'services.orderService.replicas': 3,
    'ingress.enabled': true,
    'monitoring.enabled': true
  }
};

const manager = new DeploymentManager();
manager.deploy(deploymentConfig).catch(console.error);
```

### 4. ブルーグリーンデプロイメント

```yaml
# k8s/blue-green-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: user-service-rollout
  namespace: microservices-app
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: user-service-active
      previewService: user-service-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: user-service-preview
      postPromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: user-service-active
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
        image: user-service:latest
        ports:
        - containerPort: 3000

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: microservices-app
spec:
  args:
  - name: service-name
  metrics:
  - name: success-rate
    interval: 10s
    count: 3
    successCondition: result[0] >= 0.95
    provider:
      prometheus:
        address: http://prometheus.monitoring.svc.cluster.local:9090
        query: |
          sum(rate(http_requests_total{service="{{args.service-name}}",status_code!~"5.."}[5m]))
          /
          sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```

これらのCI/CD設定により、マイクロサービスの安全で効率的な継続的デプロイメントを実現し、開発チームの生産性向上と品質保証を同時に達成できます。適切な設定により、高可用性でスケーラブルなマイクロサービス環境を構築しましょう。