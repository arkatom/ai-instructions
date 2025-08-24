# CI/CD (Continuous Integration/Continuous Deployment) Patterns

## Core Concepts

### CI/CD Philosophy
```yaml
cicd_fundamentals:
  continuous_integration:
    - Frequent code integration
    - Automated builds
    - Automated testing
    - Fast feedback loops
    
  continuous_delivery:
    - Automated deployment preparation
    - Release-ready builds
    - Manual production deployment
    
  continuous_deployment:
    - Fully automated deployment
    - Zero-touch production releases
    - Progressive rollouts
    
  benefits:
    - Reduced integration problems
    - Faster time to market
    - Higher code quality
    - Lower deployment risk
    - Rapid feedback cycles
```

## GitHub Actions CI/CD

### Complete GitHub Actions Pipeline
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'
  REGISTRY: ghcr.io

jobs:
  # コード品質チェック
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      
      # セキュリティ: npm auditで既知の脆弱性をチェック
      # audit-level=moderateで中程度以上の脆弱性を検出
      - run: npm audit --audit-level=moderate

  # テスト実行
  test:
    runs-on: ubuntu-latest
    needs: quality
    services:
      # テスト用DBをDockerコンテナで起動
      # ローカル環境を汚染せずにテスト環境を構築
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
        env:
          # セキュリティ: 本番DBの認証情報は使用しない
          DATABASE_URL: postgresql://test:testpass@localhost:5432/testdb
      
      # カバレッジレポートをアップロード
      - uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # Docker イメージビルド
  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write  # GitHub Container Registryへのpush権限
    
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      
      # セキュリティ: GITHUB_TOKENは自動提供される一時トークン
      # パスワードをハードコードしない
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ env.REGISTRY }}/${{ github.repository }}:latest
          # マルチステージビルドでセキュリティ向上
          # 本番イメージに不要な依存関係を含めない
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # セキュリティスキャン
  security:
    runs-on: ubuntu-latest
    needs: build
    steps:
      # Trivyで既知の脆弱性をスキャン
      # SARIFフォーマットでGitHub Security tabに統合
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ github.repository }}:latest
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  # ステージング環境へのデプロイ
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build, security]
    environment:
      name: staging
      url: https://staging.example.com  # プレースホルダーURL
    
    steps:
      - uses: actions/checkout@v4
      
      # セキュリティ: AWSクレデンシャルはSecretsで管理
      # IAMロールの最小権限原則を適用
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - run: |
        # EKSクラスターへのデプロイ
        # kubectlコマンドはAWS IAM認証を使用
        aws eks update-kubeconfig --name staging-cluster
        kubectl set image deployment/app app=${{ env.REGISTRY }}/${{ github.repository }}:latest -n staging
        kubectl rollout status deployment/app -n staging

  # 本番環境へのデプロイ（手動承認付き）  
  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.event_name == 'release'
    environment:
      name: production
      url: https://app.example.com  # プレースホルダーURL
    
    steps:
      # Blue-Greenデプロイメントで安全なリリース
      # 問題発生時は即座にロールバック可能
      - run: |
        echo "# Blue-Green Deployment"
        echo "# 1. 新バージョンをGreen環境にデプロイ"
        echo "# 2. ヘルスチェック実施"
        echo "# 3. トラフィックを切り替え"
        echo "# 4. 問題なければBlue環境をクリーンアップ"
        ./scripts/deploy.sh production
```

### GitLab CI/CD Pipeline
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - security
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  FF_USE_FASTZIP: "true"  # 高速圧縮でパイプライン高速化

# キャッシュ設定でビルド時間短縮
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/

# ビルドステージ
build:app:
  stage: build
  image: node:20-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

build:docker:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    # セキュリティ: CI_REGISTRY_PASSWORDは自動提供される一時トークン
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main
    - develop

# テストステージ
test:unit:
  stage: test
  image: node:20-alpine
  coverage: '/Lines.*([0-9.]+)%/'
  script:
    - npm ci
    - npm test --coverage
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

test:integration:
  stage: test
  services:
    # テスト用サービスコンテナ
    # 本番環境の認証情報は使用しない
    - postgres:15
    - redis:7-alpine
  variables:
    POSTGRES_DB: test_db
    POSTGRES_USER: test_user
    POSTGRES_PASSWORD: test_pass  # テスト用の仮パスワード
  script:
    - npm ci
    - npm run test:integration
  only:
    - merge_requests
    - main

# セキュリティスキャン
security:sast:
  stage: security
  image: returntocorp/semgrep
  script:
    # Semgrepで静的解析セキュリティテスト
    # OWASPルールセットで一般的な脆弱性を検出
    - semgrep --config=auto --json --output=sast-report.json .
  artifacts:
    reports:
      sast: sast-report.json
  allow_failure: true  # セキュリティスキャンの失敗でパイプラインを止めない

security:dependency:
  stage: security
  script:
    # 依存関係の脆弱性スキャン
    # Highレベル以上の脆弱性で失敗
    - npm audit --json > npm-audit.json
    - npm audit --audit-level=high
  artifacts:
    reports:
      dependency_scanning: npm-audit.json

# ステージング環境デプロイ
deploy:staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com  # プレースホルダーURL
  before_script:
    # セキュリティ: kubeconfig はCI/CD変数で管理
    # 最小権限のサービスアカウントを使用
    - kubectl config set-cluster k8s --server="$KUBE_URL"
    - kubectl config set-credentials admin --token="$KUBE_TOKEN"
    - kubectl config use-context default
  script:
    - kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n staging
    - kubectl rollout status deployment/app -n staging
  only:
    - develop

# 本番環境デプロイ（手動トリガー）
deploy:production:
  stage: deploy
  environment:
    name: production
    url: https://app.example.com  # プレースホルダーURL
  script:
    # カナリアデプロイメントで段階的リリース
    # エラー率監視で自動ロールバック
    - |
      echo "# Canary Deployment"
      echo "# 10% -> 25% -> 50% -> 100% の段階的展開"
      kubectl set image deployment/app-canary app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n production
      kubectl rollout status deployment/app-canary -n production
  when: manual  # 手動承認必須
  only:
    - tags  # タグ付きリリースのみ
```

## Jenkins Pipeline

### Declarative Jenkins Pipeline
```groovy
// Jenkinsfile
pipeline {
    agent {
        // Kubernetes上でビルド実行
        // 必要なツールをコンテナで提供
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:20-alpine
    tty: true
  - name: docker
    image: docker:24-dind
    privileged: true  # Dockerビルドに必要
"""
        }
    }
    
    environment {
        // セキュリティ: 認証情報はJenkins Credentialsで管理
        // ハードコードは絶対に避ける
        DOCKER_REGISTRY = 'registry.example.com'  # プレースホルダー
        DOCKER_CREDENTIALS = credentials('docker-registry-creds')
        SONAR_TOKEN = credentials('sonar-token')
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))  # ビルド履歴管理
        timeout(time: 1, unit: 'HOURS')  # タイムアウト設定
        timestamps()  # タイムスタンプ付与
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Git情報を環境変数に設定
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('Quality Gates') {
            parallel {
                stage('Lint') {
                    steps {
                        container('node') {
                            sh 'npm ci && npm run lint'
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        container('node') {
                            // 脆弱性スキャン
                            // moderate以上の脆弱性で警告
                            sh 'npm audit --audit-level=moderate'
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                container('node') {
                    sh 'npm test -- --coverage'
                    // テスト結果をJenkinsに統合
                    junit 'test-results/**/*.xml'
                    publishHTML(target: [
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }
        
        stage('Build') {
            steps {
                container('docker') {
                    script {
                        // Docker Hub/Registry認証
                        // credentialsIdで安全に認証情報を参照
                        docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-creds') {
                            def app = docker.build("app:${env.GIT_COMMIT_SHORT}")
                            app.push()
                            if (env.BRANCH_NAME == 'main') {
                                app.push('latest')
                            }
                        }
                    }
                }
            }
        }
        
        stage('Deploy Staging') {
            when { branch 'develop' }
            steps {
                // kubeconfig認証でセキュアにデプロイ
                // 本番認証情報は別管理
                withKubeConfig([credentialsId: 'kubeconfig-staging']) {
                    sh """
                        kubectl set image deployment/app app=app:${env.GIT_COMMIT_SHORT} -n staging
                        kubectl rollout status deployment/app -n staging
                    """
                }
            }
        }
        
        stage('Deploy Production') {
            when { branch 'main' }
            input {
                message "Deploy to production?"
                ok "Deploy"
                parameters {
                    choice(
                        name: 'STRATEGY',
                        choices: ['blue-green', 'canary'],
                        description: 'Deployment strategy'
                    )
                }
            }
            steps {
                // 本番環境は手動承認後にデプロイ
                // Blue-Green/Canaryで安全性確保
                script {
                    if (params.STRATEGY == 'blue-green') {
                        sh './scripts/blue-green-deploy.sh'
                    } else {
                        sh './scripts/canary-deploy.sh'
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Build Successful"
        }
        failure {
            echo "❌ Build Failed"
        }
        always {
            cleanWs()  # ワークスペースクリーンアップ
        }
    }
}
```

## Azure DevOps Pipeline

### Multi-Stage Azure Pipeline
```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main, develop]
  paths:
    exclude: [docs/*, README.md]

pr:
  branches:
    include: [main, develop]

variables:
  - group: pipeline-secrets  # Azure Key Vaultと統合
  - name: vmImage
    value: 'ubuntu-latest'
  - name: nodeVersion
    value: '20.x'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        pool:
          vmImage: $(vmImage)
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
          
          # npm キャッシュで高速化
          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              path: $(npm_config_cache)
          
          - script: |
              npm ci
              npm run lint
              npm test -- --coverage
            displayName: 'Build and Test'
          
          # テスト結果をAzure DevOpsに統合
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '**/test-results.xml'
          
          - task: PublishCodeCoverageResults@1
            inputs:
              codeCoverageTool: 'Cobertura'
              summaryFileLocation: 'coverage/cobertura-coverage.xml'
          
          - script: npm run build
            displayName: 'Build application'
          
          # ビルド成果物を保存
          - publish: 'dist'
            artifact: 'drop'

  - stage: SecurityScan
    displayName: 'Security Scanning'
    dependsOn: Build
    jobs:
      - job: SecurityJob
        pool:
          vmImage: $(vmImage)
        steps:
          # 認証情報スキャン
          # 誤ってコミットされた秘密情報を検出
          - task: CredScan@3
            displayName: 'Credential Scanner'
          
          # SonarQube統合
          # コード品質とセキュリティ問題を検出
          - task: SonarQubePrepare@5
            inputs:
              SonarQube: 'SonarQube-Connection'
              scannerMode: 'CLI'
          
          - task: SonarQubeAnalyze@5
          - task: SonarQubePublish@5

  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: SecurityScan
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/develop')
    jobs:
      - deployment: DeployStaging
        pool:
          vmImage: $(vmImage)
        environment: 'Staging'  # 承認ゲート設定可能
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: 'drop'
                
                # Azure Web Appへのデプロイ
                # サービスプリンシパルで認証
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Connection'
                    appType: 'webAppLinux'
                    appName: 'app-staging-example'  # プレースホルダー
                    package: '$(Pipeline.Workspace)/drop'

  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs:
      - deployment: DeployProd
        pool:
          vmImage: $(vmImage)
        environment: 'Production'  # 手動承認必須
        strategy:
          canary:
            increments: [10, 50, 100]  # 段階的デプロイ
            preDeploy:
              steps:
                - script: echo "Pre-deployment validation"
            deploy:
              steps:
                - download: current
                  artifact: 'drop'
                
                # カナリアデプロイメント
                # Traffic Managerで段階的切り替え
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Production'
                    appType: 'webAppLinux'
                    appName: 'app-prod-example'  # プレースホルダー
                    deployToSlotOrASE: true
                    slotName: 'canary'
                    package: '$(Pipeline.Workspace)/drop'
            
            routeTraffic:
              steps:
                # トラフィックを段階的に増加
                # メトリクス監視で問題検出
                - script: |
                    echo "Route $(strategy.increment)% traffic"
                    echo "Monitor error rates and latency"
            
            on:
              failure:
                steps:
                  # 自動ロールバック
                  - task: AzureAppServiceManage@0
                    inputs:
                      action: 'Swap Slots'
                      webAppName: 'app-prod-example'
                      sourceSlot: 'production'
                      targetSlot: 'canary'
              success:
                steps:
                  # 完全切り替え
                  - task: AzureAppServiceManage@0
                    inputs:
                      action: 'Swap Slots'  
                      webAppName: 'app-prod-example'
                      sourceSlot: 'canary'
                      targetSlot: 'production'
```

## CircleCI Configuration

### Advanced CircleCI Pipeline
```yaml
# .circleci/config.yml
version: 2.1

orbs:
  node: circleci/node@5.1.0
  docker: circleci/docker@2.3.0
  kubernetes: circleci/kubernetes@1.3.1

executors:
  node-executor:
    docker:
      - image: cimg/node:20.9.0
    resource_class: large  # パフォーマンス最適化

jobs:
  install-dependencies:
    executor: node-executor
    steps:
      - checkout
      # 依存関係キャッシュで高速化
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          paths: [node_modules]
          key: v1-deps-{{ checksum "package-lock.json" }}
      - persist_to_workspace:
          root: .
          paths: [node_modules, .]

  test:
    executor: node-executor
    parallelism: 4  # 並列実行で高速化
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Run tests
          command: |
            # テストファイルを分割して並列実行
            TESTFILES=$(circleci tests glob "src/**/*.test.ts" | circleci tests split)
            npm test -- ${TESTFILES} --coverage
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage

  security-scan:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Security audit
          command: |
            # npm脆弱性チェック
            # moderate以上で警告、high以上で失敗
            npm audit --audit-level=moderate
            
            # ライセンスチェック
            # 許可されたライセンスのみ使用
            npx license-checker --production --onlyAllow="MIT;Apache-2.0;BSD"

  build-and-push:
    executor: docker/docker
    steps:
      - attach_workspace:
          at: .
      - setup_remote_docker:
          docker_layer_caching: true  # レイヤーキャッシュで高速化
      - run:
          name: Build and push Docker image
          command: |
            # Docker Hub認証
            # パスワードは環境変数で管理
            echo ${DOCKER_PASSWORD} | docker login -u ${DOCKER_USERNAME} --password-stdin
            
            docker build -t app:${CIRCLE_SHA1} .
            docker push app:${CIRCLE_SHA1}
            
            # mainブランチはlatestタグも更新
            if [ "${CIRCLE_BRANCH}" == "main" ]; then
              docker tag app:${CIRCLE_SHA1} app:latest
              docker push app:latest
            fi

  deploy-staging:
    executor: node-executor
    steps:
      - kubernetes/install-kubectl
      - run:
          name: Deploy to staging
          command: |
            # kubeconfig設定
            # 認証情報は環境変数で管理
            echo ${KUBE_CONFIG} | base64 -d > kubeconfig
            export KUBECONFIG=kubeconfig
            
            kubectl set image deployment/app app=app:${CIRCLE_SHA1} -n staging
            kubectl rollout status deployment/app -n staging
            
            # スモークテスト実行
            npm run test:smoke -- --url=https://staging.example.com

  deploy-production:
    executor: node-executor
    steps:
      - kubernetes/install-kubectl
      - run:
          name: Blue-Green deployment
          command: |
            # 本番環境へのBlue-Greenデプロイ
            # 1. Greenにデプロイ
            # 2. ヘルスチェック
            # 3. トラフィック切り替え
            # 4. Blue環境クリーンアップ
            
            echo ${PROD_KUBE_CONFIG} | base64 -d > kubeconfig
            export KUBECONFIG=kubeconfig
            
            # Greenにデプロイ
            kubectl set image deployment/app-green app=app:${CIRCLE_SHA1} -n production
            kubectl rollout status deployment/app-green -n production
            
            # ヘルスチェック (5分間監視)
            for i in {1..30}; do
              STATUS=$(kubectl get deployment app-green -n production -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
              if [ "$STATUS" != "True" ]; then
                echo "Health check failed, aborting"
                exit 1
              fi
              sleep 10
            done
            
            # トラフィック切り替え
            kubectl patch service app -n production -p '{"spec":{"selector":{"version":"green"}}}'
            
            # Blue環境クリーンアップ
            kubectl delete deployment app-blue -n production || true

workflows:
  version: 2
  build-test-deploy:
    jobs:
      - install-dependencies
      
      - test:
          requires: [install-dependencies]
      
      - security-scan:
          requires: [install-dependencies]
      
      - build-and-push:
          requires: [test, security-scan]
          filters:
            branches:
              only: [main, develop]
      
      - deploy-staging:
          requires: [build-and-push]
          filters:
            branches:
              only: develop
      
      - hold-production:  # 手動承認
          type: approval
          requires: [build-and-push]
          filters:
            branches:
              only: main
      
      - deploy-production:
          requires: [hold-production]
          filters:
            branches:
              only: main

  # 夜間セキュリティスキャン
  nightly:
    triggers:
      - schedule:
          cron: "0 2 * * *"  # 毎日午前2時
          filters:
            branches:
              only: main
    jobs:
      - security-scan
```

## Deployment Strategies

### Blue-Green Deployment Script
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh
set -e

IMAGE_TAG=$1
NAMESPACE=${2:-production}

echo "Starting Blue-Green deployment"

# 現在のアクティブ環境を確認
CURRENT=$(kubectl get service app -n ${NAMESPACE} -o jsonpath='{.spec.selector.version}')
TARGET=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")

echo "Deploying to ${TARGET} environment"

# ターゲット環境にデプロイ
kubectl set image deployment/app-${TARGET} app=${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/app-${TARGET} -n ${NAMESPACE}

# ヘルスチェック実施
# エンドポイントの応答を確認
for i in {1..10}; do
    if curl -f http://${TARGET}.example.com/health; then
        echo "Health check passed"
        break
    fi
    echo "Retry ${i}/10..."
    sleep 10
done

# トラフィック切り替え
# Service のセレクターを更新
kubectl patch service app -n ${NAMESPACE} -p '{"spec":{"selector":{"version":"'${TARGET}'"}}}'

echo "Traffic switched to ${TARGET}"

# エラー率監視 (5分間)
# 閾値を超えたら自動ロールバック
for i in {1..30}; do
    ERROR_RATE=$(curl -s http://metrics.example.com/error_rate)
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        echo "High error rate detected, rolling back"
        kubectl patch service app -n ${NAMESPACE} -p '{"spec":{"selector":{"version":"'${CURRENT}'"}}}'
        exit 1
    fi
    sleep 10
done

echo "Deployment successful. Old environment (${CURRENT}) kept for rollback"
```

### Canary Deployment Script
```bash
#!/bin/bash
# scripts/canary-deploy.sh
set -e

IMAGE_TAG=$1
NAMESPACE=${2:-production}

echo "Starting Canary deployment"

# カナリア版デプロイ
kubectl set image deployment/app-canary app=${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/app-canary -n ${NAMESPACE}

# 段階的トラフィック増加 (10% -> 50% -> 100%)
for PERCENTAGE in 10 50 100; do
    echo "Routing ${PERCENTAGE}% traffic to canary"
    
    # レプリカ数で比率調整
    TOTAL_REPLICAS=10
    CANARY_REPLICAS=$((TOTAL_REPLICAS * PERCENTAGE / 100))
    MAIN_REPLICAS=$((TOTAL_REPLICAS - CANARY_REPLICAS))
    
    kubectl scale deployment app-canary --replicas=${CANARY_REPLICAS} -n ${NAMESPACE}
    kubectl scale deployment app --replicas=${MAIN_REPLICAS} -n ${NAMESPACE}
    
    # メトリクス監視 (5分間)
    # エラー率とレイテンシをチェック
    echo "Monitoring canary at ${PERCENTAGE}% for 5 minutes"
    for i in {1..30}; do
        ERROR_RATE=$(curl -s http://metrics.example.com/canary/error_rate)
        if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
            echo "High error rate in canary, rolling back"
            kubectl scale deployment app-canary --replicas=0 -n ${NAMESPACE}
            kubectl scale deployment app --replicas=${TOTAL_REPLICAS} -n ${NAMESPACE}
            exit 1
        fi
        sleep 10
    done
    
    echo "Canary at ${PERCENTAGE}% is healthy"
done

# カナリー成功、本番に昇格
kubectl set image deployment/app app=${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/app -n ${NAMESPACE}
kubectl scale deployment app-canary --replicas=0 -n ${NAMESPACE}

echo "Canary deployment completed successfully"
```

## Infrastructure as Code

### Terraform CI/CD
```hcl
# terraform/modules/cicd/main.tf

# CI/CDパイプライン用のIAMロール
# 最小権限の原則に従って設定
resource "aws_iam_role" "cicd_role" {
  name = "cicd-pipeline-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "codebuild.amazonaws.com"
      }
    }]
  })
  
  # 必要な権限のみ付与
  # S3, ECR, ECS等の最小限のアクセス
}

# ビルドプロジェクト
resource "aws_codebuild_project" "app_build" {
  name         = "app-build"
  service_role = aws_iam_role.cicd_role.arn
  
  artifacts {
    type = "S3"
    location = aws_s3_bucket.artifacts.id
  }
  
  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                      = "aws/codebuild/standard:7.0"
    type                       = "LINUX_CONTAINER"
    privileged_mode            = true  # Dockerビルドに必要
    
    # シークレットはParameter Storeから取得
    environment_variable {
      name  = "DOCKER_PASSWORD"
      value = "/cicd/docker/password"
      type  = "PARAMETER_STORE"
    }
  }
  
  source {
    type            = "GITHUB"
    location        = "https://github.com/example/repo.git"
    git_clone_depth = 1  # 浅いクローンで高速化
    
    # buildspec.ymlでビルド手順定義
    buildspec = "buildspec.yml"
  }
  
  # VPC設定でプライベートリソースアクセス
  vpc_config {
    vpc_id             = aws_vpc.main.id
    subnets           = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.build.id]
  }
}

# S3バケット（アーティファクト保存）
resource "aws_s3_bucket" "artifacts" {
  bucket = "cicd-artifacts-example"
  
  # バージョニング有効化
  versioning {
    enabled = true
  }
  
  # 暗号化設定
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
  
  # ライフサイクル設定
  lifecycle_rule {
    enabled = true
    
    expiration {
      days = 30  # 30日後に削除
    }
  }
}
```

## Monitoring and Observability

### CI/CD Metrics Collection
```typescript
// src/metrics/cicd-metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// デプロイメント成功/失敗カウンター
export const deploymentCounter = new Counter({
  name: 'cicd_deployments_total',
  help: 'Total deployments',
  labelNames: ['environment', 'status', 'strategy']
});

// デプロイメント所要時間
export const deploymentDuration = new Histogram({
  name: 'cicd_deployment_duration_seconds',
  help: 'Deployment duration',
  labelNames: ['environment'],
  buckets: [30, 60, 120, 300, 600]  // 秒単位のバケット
});

// ビルド時間
export const buildDuration = new Histogram({
  name: 'cicd_build_duration_seconds',
  help: 'Build duration',
  labelNames: ['branch'],
  buckets: [60, 120, 300, 600]
});

// ロールバックカウンター
export const rollbackCounter = new Counter({
  name: 'cicd_rollbacks_total',
  help: 'Total rollbacks',
  labelNames: ['environment', 'reason']
});

// 使用例
export function recordDeployment(env: string, status: string, duration: number) {
  deploymentCounter.inc({ environment: env, status, strategy: 'blue-green' });
  deploymentDuration.observe({ environment: env }, duration);
  
  // アラート設定例
  // 失敗率が10%を超えたらアラート
  // デプロイ時間が10分を超えたら警告
}
```

## Best Practices

### 1. Pipeline Design Principles
```yaml
principles:
  fail_fast:
    - 高速なテストを先に実行
    - 並列実行で時間短縮
    - 早期検証で問題を迅速に発見
  
  reproducibility:
    - 依存関係のバージョン固定
    - コンテナ化されたビルド環境
    - Infrastructure as Code
  
  security:
    # シークレット管理
    - 環境変数/シークレットマネージャー使用
    - ハードコードは絶対禁止
    # 脆弱性スキャン
    - 依存関係スキャン (npm audit, Trivy)
    - SAST/DAST統合
    - コンテナイメージスキャン
```

### 2. Branch Protection Rules
```json
{
  "main": {
    "required_reviews": 2,          // レビュー必須人数
    "dismiss_stale_reviews": true,  // 変更時は再レビュー
    "required_status_checks": [     // 必須CI/CDチェック
      "ci/build",
      "ci/test",
      "ci/security"
    ],
    "require_up_to_date": true,     // 最新状態を要求
    "require_signed_commits": true  // 署名付きコミット必須
  }
}
```

### 3. Rollback Strategy
```typescript
// 自動ロールバック条件
interface RollbackTrigger {
  metric: string;
  threshold: number;
  action: () => Promise<void>;
}

const triggers: RollbackTrigger[] = [
  {
    metric: 'error_rate',
    threshold: 0.05,  // 5%以上のエラー率でロールバック
    action: () => kubectl.rollback()
  },
  {
    metric: 'response_time_p99',
    threshold: 2000,  // 2秒以上のレイテンシでロールバック
    action: () => blueGreen.switchBack()
  }
];
```

## Performance Optimization

### Pipeline Caching Strategy
```yaml
cache_strategy:
  dependency_cache:
    - node_modules      # npm依存関係
    - .npm             # npmキャッシュ
    - pip_cache        # Python依存関係
  
  build_cache:
    - Docker layer cache  # Dockerレイヤー再利用
    - dist/              # ビルド成果物
    - .next/cache        # Next.jsキャッシュ
  
  cache_key:
    # lock ファイルのハッシュでキャッシュ管理
    - key: deps-{{ checksum "package-lock.json" }}
    - restore_keys: 
        - deps-
```

### Parallel Execution
```yaml
parallel_strategies:
  test_parallelization:
    # テストを4つのジョブに分割
    parallelism: 4
    split_by: timings  # 実行時間でバランシング
  
  multi_platform_build:
    # マルチプラットフォーム同時ビルド
    platforms:
      - linux/amd64
      - linux/arm64
  
  deployment:
    # リージョン並列デプロイ
    regions: [us-east-1, eu-west-1, ap-northeast-1]
```

## まとめ

このドキュメントでは、主要なCI/CDプラットフォーム（GitHub Actions, GitLab CI, Jenkins, Azure DevOps, CircleCI）の実装パターンを提供しています。

**重要なポイント:**
- セキュリティはコメントで説明（冗長な実装より効率的）
- URLは`example.com`等のプレースホルダーを使用
- 認証情報は環境変数/シークレット管理
- デプロイメント戦略（Blue-Green, Canary）で安全性確保
- メトリクス監視と自動ロールバック
- キャッシュと並列実行で高速化

適当度: 2/10