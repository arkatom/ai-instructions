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
  release:
    types: [created]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
          - development
          - staging
          - production

env:
  NODE_VERSION: '20.x'
  PYTHON_VERSION: '3.11'
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Job 1: Code Quality Checks
  quality-checks:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Check code formatting
        run: npm run format:check

      - name: Security audit
        run: npm audit --audit-level=moderate

      - name: License check
        run: npx license-checker --production --onlyAllow="MIT;Apache-2.0;BSD-3-Clause;BSD-2-Clause;ISC"

  # Job 2: Test Suite
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    needs: quality-checks
    strategy:
      matrix:
        test-type: [unit, integration, e2e]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ${{ matrix.test-type }} tests
        run: npm run test:${{ matrix.test-type }}
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379
          CI: true

      - name: Upload coverage
        if: matrix.test-type == 'unit'
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  # Job 3: Build and Push Docker Image
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_VERSION=${{ env.NODE_VERSION }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}
            VERSION=${{ steps.meta.outputs.version }}

  # Job 4: Security Scanning
  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ needs.build.outputs.image-tag }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: SAST with Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten

  # Job 5: Deploy to Staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, security]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.28.0'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name staging-cluster --region us-east-1

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/app app=${{ needs.build.outputs.image-tag }} -n staging
          kubectl rollout status deployment/app -n staging
          kubectl get services -n staging

      - name: Run smoke tests
        run: |
          npm run test:smoke -- --url=https://staging.example.com
        env:
          STAGING_API_KEY: ${{ secrets.STAGING_API_KEY }}

  # Job 6: Deploy to Production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, security, deploy-staging]
    if: github.event_name == 'release' || github.event.inputs.environment == 'production'
    environment:
      name: production
      url: https://app.example.com
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.PROD_AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.PROD_AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Blue-Green Deployment
        run: |
          # Deploy to green environment
          ./scripts/deploy.sh green ${{ needs.build.outputs.image-tag }}
          
          # Run health checks
          ./scripts/health-check.sh green
          
          # Switch traffic to green
          ./scripts/switch-traffic.sh green
          
          # Wait and monitor
          sleep 60
          ./scripts/monitor-deployment.sh
          
          # Cleanup old blue environment
          ./scripts/cleanup.sh blue

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed for version ${{ needs.build.outputs.image-tag }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### GitLab CI/CD Pipeline
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - security
  - deploy
  - monitor

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  FF_USE_FASTZIP: "true"
  ARTIFACT_COMPRESSION_LEVEL: "fast"
  CACHE_COMPRESSION_LEVEL: "fast"

# Global cache configuration
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/
    - .cache/

# Build Stage
build:app:
  stage: build
  image: node:20-alpine
  before_script:
    - npm ci --cache .npm --prefer-offline
  script:
    - npm run build
    - npm run bundle-analyze
  artifacts:
    paths:
      - dist/
      - build-stats.json
    reports:
      webpack: build-stats.json
    expire_in: 1 week
  only:
    - branches
    - tags

build:docker:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build --cache-from $CI_REGISTRY_IMAGE:latest -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
    - develop

# Test Stage
test:unit:
  stage: test
  image: node:20-alpine
  coverage: '/Lines\s*:\s*([0-9.]+)%/'
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run test:unit -- --coverage
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
  only:
    - merge_requests
    - main
    - develop

test:integration:
  stage: test
  image: node:20
  services:
    - postgres:15
    - redis:7-alpine
  variables:
    POSTGRES_DB: test_db
    POSTGRES_USER: test_user
    POSTGRES_PASSWORD: test_pass
    DATABASE_URL: "postgresql://test_user:test_pass@postgres:5432/test_db"
    REDIS_URL: "redis://redis:6379"
  script:
    - npm ci
    - npm run test:integration
  only:
    - merge_requests
    - main

test:e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  script:
    - npm ci
    - npx playwright install
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    expire_in: 1 week
  only:
    - main
    - develop

# Security Stage
security:sast:
  stage: security
  image: returntocorp/semgrep
  script:
    - semgrep --config=auto --json --output=semgrep-report.json .
  artifacts:
    reports:
      sast: semgrep-report.json
  allow_failure: true

security:dependency:
  stage: security
  image: node:20-alpine
  script:
    - npm audit --json > npm-audit-report.json
    - npm audit --audit-level=high
  artifacts:
    reports:
      dependency_scanning: npm-audit-report.json
  allow_failure: true

security:container:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity HIGH,CRITICAL $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  dependencies:
    - build:docker
  only:
    - main
    - develop

# Deploy Stage
deploy:staging:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging.example.com
    on_stop: stop:staging
  before_script:
    - kubectl config set-cluster k8s --server="$KUBE_URL" --insecure-skip-tls-verify=true
    - kubectl config set-credentials admin --token="$KUBE_TOKEN"
    - kubectl config set-context default --cluster=k8s --user=admin
    - kubectl config use-context default
  script:
    - kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n staging
    - kubectl rollout status deployment/app -n staging
  only:
    - develop

deploy:production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://app.example.com
  before_script:
    - kubectl config set-cluster k8s --server="$PROD_KUBE_URL" --insecure-skip-tls-verify=true
    - kubectl config set-credentials admin --token="$PROD_KUBE_TOKEN"
    - kubectl config set-context default --cluster=k8s --user=admin
    - kubectl config use-context default
  script:
    - |
      # Canary deployment
      kubectl set image deployment/app-canary app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n production
      kubectl rollout status deployment/app-canary -n production
      
      # Monitor canary metrics
      sleep 300  # 5 minutes
      
      # Full deployment if canary is healthy
      kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n production
      kubectl rollout status deployment/app -n production
      
      # Scale down canary
      kubectl scale deployment app-canary --replicas=0 -n production
  when: manual
  only:
    - tags

# Rollback job
rollback:production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    action: rollback
  script:
    - kubectl rollout undo deployment/app -n production
    - kubectl rollout status deployment/app -n production
  when: manual
  only:
    - tags
```

## Jenkins Pipeline

### Declarative Jenkins Pipeline
```groovy
// Jenkinsfile
pipeline {
    agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:20-alpine
    command: ['cat']
    tty: true
  - name: docker
    image: docker:24-dind
    privileged: true
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ['cat']
    tty: true
"""
        }
    }
    
    environment {
        DOCKER_REGISTRY = 'registry.example.com'
        DOCKER_CREDENTIALS = credentials('docker-registry-creds')
        SONAR_TOKEN = credentials('sonar-token')
        SLACK_WEBHOOK = credentials('slack-webhook')
        NODE_ENV = 'ci'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 1, unit: 'HOURS')
        parallelsAlwaysFailFast()
        timestamps()
        ansiColor('xterm')
    }
    
    triggers {
        pollSCM('H */4 * * 1-5')
        githubPush()
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH = sh(
                        script: "git rev-parse --abbrev-ref HEAD",
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
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
                
                stage('Type Check') {
                    steps {
                        container('node') {
                            sh 'npm ci'
                            sh 'npm run type-check'
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        container('node') {
                            sh 'npm audit --audit-level=moderate'
                            sh 'npx snyk test'
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        container('node') {
                            sh 'npm run test:unit -- --coverage'
                            publishHTML(target: [
                                reportDir: 'coverage',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        }
                    }
                }
                
                stage('Integration Tests') {
                    steps {
                        container('node') {
                            sh """
                                docker-compose -f docker-compose.test.yml up -d
                                npm run test:integration
                                docker-compose -f docker-compose.test.yml down
                            """
                        }
                    }
                }
                
                stage('E2E Tests') {
                    when {
                        branch 'main'
                    }
                    steps {
                        container('node') {
                            sh 'npm run test:e2e'
                        }
                    }
                }
            }
            post {
                always {
                    junit 'test-results/**/*.xml'
                    recordCoverage(
                        tools: [[parser: 'COBERTURA', pattern: 'coverage/cobertura-coverage.xml']],
                        id: 'coverage',
                        name: 'Coverage Report'
                    )
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                container('node') {
                    withSonarQubeEnv('SonarQube') {
                        sh """
                            npx sonar-scanner \
                                -Dsonar.projectKey=${env.JOB_NAME} \
                                -Dsonar.sources=src \
                                -Dsonar.tests=tests \
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                        """
                    }
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                timeout(time: 1, unit: 'HOURS') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Build') {
            steps {
                container('docker') {
                    script {
                        docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-creds') {
                            def app = docker.build("${DOCKER_REGISTRY}/app:${env.GIT_COMMIT_SHORT}")
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
            when {
                branch 'develop'
            }
            steps {
                container('kubectl') {
                    withKubeConfig([credentialsId: 'kubeconfig-staging']) {
                        sh """
                            kubectl set image deployment/app app=${DOCKER_REGISTRY}/app:${env.GIT_COMMIT_SHORT} -n staging
                            kubectl rollout status deployment/app -n staging
                        """
                    }
                }
            }
        }
        
        stage('Deploy Production') {
            when {
                branch 'main'
            }
            input {
                message "Deploy to production?"
                ok "Deploy"
                parameters {
                    choice(
                        name: 'DEPLOYMENT_TYPE',
                        choices: ['blue-green', 'canary', 'rolling'],
                        description: 'Select deployment strategy'
                    )
                }
            }
            steps {
                container('kubectl') {
                    withKubeConfig([credentialsId: 'kubeconfig-production']) {
                        script {
                            switch(params.DEPLOYMENT_TYPE) {
                                case 'blue-green':
                                    sh './scripts/blue-green-deploy.sh ${env.GIT_COMMIT_SHORT}'
                                    break
                                case 'canary':
                                    sh './scripts/canary-deploy.sh ${env.GIT_COMMIT_SHORT}'
                                    break
                                case 'rolling':
                                    sh """
                                        kubectl set image deployment/app app=${DOCKER_REGISTRY}/app:${env.GIT_COMMIT_SHORT} -n production
                                        kubectl rollout status deployment/app -n production
                                    """
                                    break
                            }
                        }
                    }
                }
            }
        }
    }
    
    post {
        success {
            slackSend(
                color: 'good',
                message: "✅ Build Successful: ${env.JOB_NAME} - ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "❌ Build Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER} (<${env.BUILD_URL}|Open>)"
            )
        }
        always {
            cleanWs()
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
    include:
      - main
      - develop
      - release/*
  paths:
    exclude:
      - docs/*
      - README.md

pr:
  branches:
    include:
      - main
      - develop

variables:
  - group: pipeline-secrets
  - name: vmImage
    value: 'ubuntu-latest'
  - name: nodeVersion
    value: '20.x'
  - name: buildConfiguration
    value: 'Release'
  - name: azureSubscription
    value: 'Azure-Production'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build Application'
        pool:
          vmImage: $(vmImage)
        steps:
          - task: NodeTool@0
            displayName: 'Install Node.js'
            inputs:
              versionSpec: $(nodeVersion)

          - task: Cache@2
            displayName: 'Cache npm packages'
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              restoreKeys: |
                npm | "$(Agent.OS)"
              path: $(npm_config_cache)

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npm run lint
            displayName: 'Run linting'

          - script: npm run test:unit -- --coverage
            displayName: 'Run unit tests'

          - task: PublishTestResults@2
            displayName: 'Publish test results'
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '**/test-results.xml'
              mergeTestResults: true

          - task: PublishCodeCoverageResults@1
            displayName: 'Publish code coverage'
            inputs:
              codeCoverageTool: 'Cobertura'
              summaryFileLocation: '$(System.DefaultWorkingDirectory)/coverage/cobertura-coverage.xml'

          - script: npm run build
            displayName: 'Build application'

          - task: ArchiveFiles@2
            displayName: 'Archive build artifacts'
            inputs:
              rootFolderOrFile: 'dist'
              includeRootFolder: false
              archiveType: 'zip'
              archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'

          - publish: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
            displayName: 'Publish artifacts'
            artifact: 'drop'

  - stage: SecurityScan
    displayName: 'Security Scanning'
    dependsOn: Build
    jobs:
      - job: SecurityJob
        displayName: 'Run Security Scans'
        pool:
          vmImage: $(vmImage)
        steps:
          - task: WhiteSource@21
            displayName: 'WhiteSource scan'
            inputs:
              cwd: '$(System.DefaultWorkingDirectory)'
              projectName: '$(Build.Repository.Name)'

          - task: CredScan@3
            displayName: 'Credential Scanner'

          - task: SonarQubePrepare@5
            displayName: 'Prepare SonarQube analysis'
            inputs:
              SonarQube: 'SonarQube-Connection'
              scannerMode: 'CLI'
              configMode: 'file'

          - task: SonarQubeAnalyze@5
            displayName: 'Run SonarQube analysis'

          - task: SonarQubePublish@5
            displayName: 'Publish SonarQube results'
            inputs:
              pollingTimeoutSec: '300'

  - stage: DeployDev
    displayName: 'Deploy to Development'
    dependsOn: SecurityScan
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
    jobs:
      - deployment: DeployDevJob
        displayName: 'Deploy to Dev Environment'
        pool:
          vmImage: $(vmImage)
        environment: 'Development'
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: 'drop'

                - task: AzureWebApp@1
                  displayName: 'Deploy to Azure Web App'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    appType: 'webAppLinux'
                    appName: 'app-dev-$(Build.Repository.Name)'
                    package: '$(Pipeline.Workspace)/drop/*.zip'
                    runtimeStack: 'NODE|20-lts'

                - task: AzureAppServiceManage@0
                  displayName: 'Start Azure App Service'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    action: 'Start Azure App Service'
                    webAppName: 'app-dev-$(Build.Repository.Name)'

  - stage: DeployStaging
    displayName: 'Deploy to Staging'
    dependsOn: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployStagingJob
        displayName: 'Deploy to Staging Environment'
        pool:
          vmImage: $(vmImage)
        environment: 'Staging'
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: 'drop'

                - task: AzureResourceManagerTemplateDeployment@3
                  displayName: 'Deploy ARM Template'
                  inputs:
                    deploymentScope: 'Resource Group'
                    azureResourceManagerConnection: $(azureSubscription)
                    subscriptionId: '$(subscriptionId)'
                    action: 'Create Or Update Resource Group'
                    resourceGroupName: 'rg-staging-$(Build.Repository.Name)'
                    location: 'East US'
                    templateLocation: 'Linked artifact'
                    csmFile: '$(System.DefaultWorkingDirectory)/infrastructure/azuredeploy.json'
                    csmParametersFile: '$(System.DefaultWorkingDirectory)/infrastructure/azuredeploy.parameters.staging.json'

                - task: AzureWebApp@1
                  displayName: 'Deploy to Staging'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    appType: 'webAppLinux'
                    appName: 'app-staging-$(Build.Repository.Name)'
                    package: '$(Pipeline.Workspace)/drop/*.zip'
                    deploymentMethod: 'runFromPackage'

  - stage: DeployProduction
    displayName: 'Deploy to Production'
    dependsOn: DeployStaging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployProdJob
        displayName: 'Deploy to Production Environment'
        pool:
          vmImage: $(vmImage)
        environment: 'Production'
        strategy:
          canary:
            increments: [10, 25, 50, 100]
            preDeploy:
              steps:
                - script: echo "Pre-deployment validation"
            deploy:
              steps:
                - download: current
                  artifact: 'drop'

                - task: AzureTrafficManager@0
                  displayName: 'Configure Traffic Manager'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    resourceGroupName: 'rg-prod-$(Build.Repository.Name)'
                    trafficManagerProfile: 'tm-$(Build.Repository.Name)'
                    endpointStatus: 'Enabled'

                - task: AzureWebApp@1
                  displayName: 'Deploy to Production Slot'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    appType: 'webAppLinux'
                    appName: 'app-prod-$(Build.Repository.Name)'
                    deployToSlotOrASE: true
                    resourceGroupName: 'rg-prod-$(Build.Repository.Name)'
                    slotName: 'canary'
                    package: '$(Pipeline.Workspace)/drop/*.zip'

            routeTraffic:
              steps:
                - task: AzureAppServiceManage@0
                  displayName: 'Route traffic to canary'
                  inputs:
                    azureSubscription: $(azureSubscription)
                    action: 'Manage traffic routing'
                    webAppName: 'app-prod-$(Build.Repository.Name)'
                    resourceGroupName: 'rg-prod-$(Build.Repository.Name)'
                    trafficPercentage: '$(strategy.increment)'

            postRouteTraffic:
              steps:
                - script: |
                    echo "Monitor metrics for $(strategy.increment)% traffic"
                    sleep 300
                  displayName: 'Monitor canary deployment'

            on:
              failure:
                steps:
                  - task: AzureAppServiceManage@0
                    displayName: 'Rollback deployment'
                    inputs:
                      azureSubscription: $(azureSubscription)
                      action: 'Swap Slots'
                      webAppName: 'app-prod-$(Build.Repository.Name)'
                      resourceGroupName: 'rg-prod-$(Build.Repository.Name)'
                      sourceSlot: 'production'
                      targetSlot: 'canary'

              success:
                steps:
                  - task: AzureAppServiceManage@0
                    displayName: 'Complete deployment'
                    inputs:
                      azureSubscription: $(azureSubscription)
                      action: 'Swap Slots'
                      webAppName: 'app-prod-$(Build.Repository.Name)'
                      resourceGroupName: 'rg-prod-$(Build.Repository.Name)'
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
  aws-cli: circleci/aws-cli@4.0
  slack: circleci/slack@4.12.5

executors:
  node-executor:
    docker:
      - image: cimg/node:20.9.0
    working_directory: ~/repo
    resource_class: large

  docker-executor:
    docker:
      - image: cimg/base:stable
    working_directory: ~/repo

commands:
  restore-cache:
    steps:
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
            - v1-dependencies-

  save-cache:
    steps:
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package-lock.json" }}

  setup-test-environment:
    steps:
      - run:
          name: Setup test environment
          command: |
            docker-compose -f docker-compose.test.yml up -d
            dockerize -wait tcp://localhost:5432 -wait tcp://localhost:6379 -timeout 1m

jobs:
  install-dependencies:
    executor: node-executor
    steps:
      - checkout
      - restore-cache
      - run:
          name: Install dependencies
          command: npm ci
      - save-cache
      - persist_to_workspace:
          root: .
          paths:
            - node_modules
            - .

  lint-and-format:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Run linting
          command: npm run lint
      - run:
          name: Check formatting
          command: npm run format:check
      - run:
          name: Type checking
          command: npm run type-check

  unit-tests:
    executor: node-executor
    parallelism: 4
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Run unit tests
          command: |
            TESTFILES=$(circleci tests glob "src/**/*.test.ts" | circleci tests split --split-by=timings)
            npm run test:unit -- ${TESTFILES} --coverage
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage
      - persist_to_workspace:
          root: .
          paths:
            - coverage

  integration-tests:
    executor: node-executor
    docker:
      - image: cimg/node:20.9.0
      - image: cimg/postgres:15.0
        environment:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
      - image: cimg/redis:7.0
    steps:
      - attach_workspace:
          at: .
      - setup-test-environment
      - run:
          name: Run integration tests
          command: npm run test:integration
          environment:
            DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
            REDIS_URL: redis://localhost:6379
      - store_test_results:
          path: test-results

  e2e-tests:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-focal
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Run E2E tests
          command: |
            npm run build
            npm run test:e2e
      - store_artifacts:
          path: playwright-report
      - store_test_results:
          path: test-results

  security-scan:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Security audit
          command: npm audit --audit-level=moderate
      - run:
          name: License check
          command: npx license-checker --production --summary
      - run:
          name: OWASP dependency check
          command: |
            wget https://github.com/jeremylong/DependencyCheck/releases/download/v8.4.3/dependency-check-8.4.3-release.zip
            unzip dependency-check-8.4.3-release.zip
            ./dependency-check/bin/dependency-check.sh --scan . --format JSON --out dependency-check-report.json
      - store_artifacts:
          path: dependency-check-report.json

  build-and-push:
    executor: docker-executor
    steps:
      - attach_workspace:
          at: .
      - setup_remote_docker:
          version: 20.10.24
          docker_layer_caching: true
      - run:
          name: Build Docker image
          command: |
            docker build -t app:${CIRCLE_SHA1} .
            docker tag app:${CIRCLE_SHA1} app:latest
      - run:
          name: Push to registry
          command: |
            echo ${DOCKER_PASSWORD} | docker login -u ${DOCKER_USERNAME} --password-stdin
            docker push app:${CIRCLE_SHA1}
            docker push app:latest

  deploy-staging:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - kubernetes/install-kubectl
      - aws-cli/setup
      - run:
          name: Update kubeconfig
          command: |
            aws eks update-kubeconfig --name staging-cluster --region us-east-1
      - run:
          name: Deploy to staging
          command: |
            kubectl set image deployment/app app=app:${CIRCLE_SHA1} -n staging
            kubectl rollout status deployment/app -n staging
      - run:
          name: Run smoke tests
          command: npm run test:smoke -- --url=https://staging.example.com

  deploy-production:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - kubernetes/install-kubectl
      - aws-cli/setup
      - run:
          name: Update kubeconfig
          command: |
            aws eks update-kubeconfig --name production-cluster --region us-east-1
      - run:
          name: Blue-Green deployment
          command: |
            # Deploy to green
            kubectl apply -f k8s/production/green-deployment.yaml
            kubectl set image deployment/app-green app=app:${CIRCLE_SHA1} -n production
            kubectl rollout status deployment/app-green -n production
            
            # Switch traffic
            kubectl patch service app -n production -p '{"spec":{"selector":{"version":"green"}}}'
            
            # Monitor
            sleep 300
            
            # Clean up blue
            kubectl delete deployment app-blue -n production
            kubectl label deployment app-green version=blue --overwrite -n production

  performance-test:
    executor: node-executor
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Run performance tests
          command: |
            npm run test:performance
            npm run lighthouse -- --output=json --output-path=./lighthouse-report.json
      - store_artifacts:
          path: lighthouse-report.json
      - run:
          name: Check performance budgets
          command: |
            npm run check:performance-budget

workflows:
  version: 2
  build-test-deploy:
    jobs:
      - install-dependencies:
          filters:
            tags:
              only: /^v.*/
      
      - lint-and-format:
          requires:
            - install-dependencies
      
      - unit-tests:
          requires:
            - install-dependencies
      
      - integration-tests:
          requires:
            - install-dependencies
      
      - e2e-tests:
          requires:
            - unit-tests
            - integration-tests
      
      - security-scan:
          requires:
            - install-dependencies
      
      - build-and-push:
          requires:
            - lint-and-format
            - unit-tests
            - integration-tests
          filters:
            branches:
              only:
                - main
                - develop
      
      - deploy-staging:
          requires:
            - build-and-push
            - e2e-tests
            - security-scan
          filters:
            branches:
              only: develop
      
      - hold-production:
          type: approval
          requires:
            - build-and-push
            - e2e-tests
            - security-scan
          filters:
            branches:
              only: main
      
      - deploy-production:
          requires:
            - hold-production
          filters:
            branches:
              only: main
      
      - performance-test:
          requires:
            - deploy-staging
          filters:
            branches:
              only: develop

  nightly:
    triggers:
      - schedule:
          cron: "0 2 * * *"
          filters:
            branches:
              only:
                - main
    jobs:
      - security-scan
      - performance-test
```

## Deployment Strategies

### Blue-Green Deployment Script
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

IMAGE_TAG=$1
NAMESPACE=${2:-production}
TIMEOUT=${3:-600}

echo "Starting Blue-Green deployment with image: ${IMAGE_TAG}"

# Determine current active environment
CURRENT_ACTIVE=$(kubectl get service app -n ${NAMESPACE} -o jsonpath='{.spec.selector.version}')
echo "Current active environment: ${CURRENT_ACTIVE}"

if [ "${CURRENT_ACTIVE}" == "blue" ]; then
    TARGET="green"
else
    TARGET="blue"
fi

echo "Deploying to ${TARGET} environment"

# Deploy to target environment
kubectl set image deployment/app-${TARGET} app=${IMAGE_TAG} -n ${NAMESPACE}

# Wait for rollout to complete
kubectl rollout status deployment/app-${TARGET} -n ${NAMESPACE} --timeout=${TIMEOUT}s

# Run health checks
echo "Running health checks on ${TARGET} environment"
for i in {1..10}; do
    HEALTH_STATUS=$(kubectl exec deployment/app-${TARGET} -n ${NAMESPACE} -- curl -s http://localhost:8080/health | jq -r '.status')
    if [ "${HEALTH_STATUS}" == "healthy" ]; then
        echo "Health check passed"
        break
    fi
    echo "Health check attempt ${i} failed, retrying..."
    sleep 10
done

if [ "${HEALTH_STATUS}" != "healthy" ]; then
    echo "Health checks failed, aborting deployment"
    exit 1
fi

# Switch traffic to target environment
echo "Switching traffic to ${TARGET} environment"
kubectl patch service app -n ${NAMESPACE} -p '{"spec":{"selector":{"version":"'${TARGET}'"}}}'

# Verify traffic switch
sleep 5
NEW_ACTIVE=$(kubectl get service app -n ${NAMESPACE} -o jsonpath='{.spec.selector.version}')
if [ "${NEW_ACTIVE}" == "${TARGET}" ]; then
    echo "Successfully switched traffic to ${TARGET}"
else
    echo "Failed to switch traffic"
    exit 1
fi

# Monitor for 5 minutes
echo "Monitoring new deployment for 5 minutes"
for i in {1..30}; do
    ERROR_RATE=$(kubectl exec deployment/app-${TARGET} -n ${NAMESPACE} -- curl -s http://localhost:9090/metrics | grep 'http_requests_errors_total' | awk '{print $2}')
    if [ "${ERROR_RATE}" -gt "100" ]; then
        echo "High error rate detected, rolling back"
        kubectl patch service app -n ${NAMESPACE} -p '{"spec":{"selector":{"version":"'${CURRENT_ACTIVE}'"}}}'
        exit 1
    fi
    sleep 10
done

echo "Blue-Green deployment completed successfully"
echo "Old environment (${CURRENT_ACTIVE}) is still running and can be used for rollback"
```

### Canary Deployment Script
```bash
#!/bin/bash
# scripts/canary-deploy.sh

set -e

IMAGE_TAG=$1
NAMESPACE=${2:-production}
CANARY_PERCENTAGE=${3:-10}
INCREMENT=${4:-10}
WAIT_TIME=${5:-300}

echo "Starting Canary deployment with image: ${IMAGE_TAG}"

# Deploy canary version
kubectl set image deployment/app-canary app=${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/app-canary -n ${NAMESPACE}

# Get current replica counts
MAIN_REPLICAS=$(kubectl get deployment app -n ${NAMESPACE} -o jsonpath='{.spec.replicas}')
TOTAL_REPLICAS=${MAIN_REPLICAS}

# Progressive canary rollout
CURRENT_PERCENTAGE=0
while [ ${CURRENT_PERCENTAGE} -lt 100 ]; do
    CURRENT_PERCENTAGE=$((CURRENT_PERCENTAGE + INCREMENT))
    if [ ${CURRENT_PERCENTAGE} -gt 100 ]; then
        CURRENT_PERCENTAGE=100
    fi
    
    # Calculate replica distribution
    CANARY_REPLICAS=$((TOTAL_REPLICAS * CURRENT_PERCENTAGE / 100))
    MAIN_REPLICAS=$((TOTAL_REPLICAS - CANARY_REPLICAS))
    
    echo "Scaling canary to ${CURRENT_PERCENTAGE}% (${CANARY_REPLICAS} replicas)"
    kubectl scale deployment app-canary --replicas=${CANARY_REPLICAS} -n ${NAMESPACE}
    kubectl scale deployment app --replicas=${MAIN_REPLICAS} -n ${NAMESPACE}
    
    # Wait for scaling
    kubectl rollout status deployment/app-canary -n ${NAMESPACE}
    kubectl rollout status deployment/app -n ${NAMESPACE}
    
    # Monitor metrics
    echo "Monitoring canary at ${CURRENT_PERCENTAGE}% for ${WAIT_TIME} seconds"
    START_TIME=$(date +%s)
    while [ $(($(date +%s) - START_TIME)) -lt ${WAIT_TIME} ]; do
        # Check error rate
        ERROR_RATE=$(kubectl top pods -l version=canary -n ${NAMESPACE} | grep app-canary | awk '{print $3}' | sed 's/%//')
        if [ "${ERROR_RATE}" -gt "5" ]; then
            echo "High error rate detected in canary, rolling back"
            kubectl scale deployment app-canary --replicas=0 -n ${NAMESPACE}
            kubectl scale deployment app --replicas=${TOTAL_REPLICAS} -n ${NAMESPACE}
            exit 1
        fi
        sleep 30
    done
    
    echo "Canary at ${CURRENT_PERCENTAGE}% is healthy"
done

# Complete canary deployment
echo "Canary deployment successful, promoting to main"
kubectl set image deployment/app app=${IMAGE_TAG} -n ${NAMESPACE}
kubectl rollout status deployment/app -n ${NAMESPACE}
kubectl scale deployment app-canary --replicas=0 -n ${NAMESPACE}

echo "Canary deployment completed successfully"
```

## Infrastructure as Code

### Terraform CI/CD
```hcl
# terraform/modules/cicd/main.tf
resource "aws_codepipeline" "main" {
  name     = "${var.project_name}-pipeline"
  role_arn = aws_iam_role.pipeline.arn

  artifact_store {
    type     = "S3"
    location = aws_s3_bucket.artifacts.bucket
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "ThirdParty"
      provider         = "GitHub"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        Owner      = var.github_owner
        Repo       = var.github_repo
        Branch     = var.github_branch
        OAuthToken = var.github_token
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.main.name
      }
    }
  }

  stage {
    name = "Test"

    action {
      name            = "UnitTests"
      category        = "Test"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ProjectName = aws_codebuild_project.test.name
      }
    }

    action {
      name            = "IntegrationTests"
      category        = "Test"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["build_output"]
      version         = "1"
      run_order       = 2

      configuration = {
        ProjectName = aws_codebuild_project.integration.name
      }
    }
  }

  stage {
    name = "Deploy-Staging"

    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ClusterName = aws_ecs_cluster.staging.name
        ServiceName = aws_ecs_service.app_staging.name
        FileName    = "imagedefinitions.json"
      }
    }
  }

  stage {
    name = "Approval"

    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        CustomData = "Approve deployment to production"
      }
    }
  }

  stage {
    name = "Deploy-Production"

    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ClusterName = aws_ecs_cluster.production.name
        ServiceName = aws_ecs_service.app_production.name
        FileName    = "imagedefinitions.json"
      }
    }
  }
}

resource "aws_codebuild_project" "main" {
  name          = "${var.project_name}-build"
  service_role  = aws_iam_role.codebuild.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  cache {
    type     = "S3"
    location = "${aws_s3_bucket.cache.bucket}/build-cache"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_LARGE"
    image                      = "aws/codebuild/standard:7.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = true

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }

    environment_variable {
      name  = "IMAGE_REPO_NAME"
      value = aws_ecr_repository.app.name
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }
}
```

## Monitoring and Observability

### Prometheus Metrics in CI/CD
```typescript
// src/metrics/cicd-metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class CICDMetrics {
  private registry: Registry;
  private deploymentCounter: Counter;
  private deploymentDuration: Histogram;
  private deploymentStatus: Gauge;
  private testExecutionTime: Histogram;
  private buildTime: Histogram;
  private rollbackCounter: Counter;

  constructor() {
    this.registry = new Registry();

    this.deploymentCounter = new Counter({
      name: 'cicd_deployments_total',
      help: 'Total number of deployments',
      labelNames: ['environment', 'status', 'strategy'],
      registers: [this.registry]
    });

    this.deploymentDuration = new Histogram({
      name: 'cicd_deployment_duration_seconds',
      help: 'Deployment duration in seconds',
      labelNames: ['environment', 'strategy'],
      buckets: [30, 60, 120, 300, 600, 1200, 3600],
      registers: [this.registry]
    });

    this.deploymentStatus = new Gauge({
      name: 'cicd_deployment_status',
      help: 'Current deployment status (1=success, 0=failure)',
      labelNames: ['environment', 'version'],
      registers: [this.registry]
    });

    this.testExecutionTime = new Histogram({
      name: 'cicd_test_execution_seconds',
      help: 'Test execution time in seconds',
      labelNames: ['test_type', 'status'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry]
    });

    this.buildTime = new Histogram({
      name: 'cicd_build_duration_seconds',
      help: 'Build duration in seconds',
      labelNames: ['branch', 'status'],
      buckets: [30, 60, 120, 300, 600],
      registers: [this.registry]
    });

    this.rollbackCounter = new Counter({
      name: 'cicd_rollbacks_total',
      help: 'Total number of rollbacks',
      labelNames: ['environment', 'reason'],
      registers: [this.registry]
    });
  }

  recordDeployment(
    environment: string,
    status: 'success' | 'failure',
    strategy: string,
    duration: number
  ): void {
    this.deploymentCounter.inc({ environment, status, strategy });
    this.deploymentDuration.observe({ environment, strategy }, duration);
    this.deploymentStatus.set(
      { environment, version: process.env.VERSION || 'unknown' },
      status === 'success' ? 1 : 0
    );
  }

  recordTestExecution(
    testType: string,
    status: 'pass' | 'fail',
    duration: number
  ): void {
    this.testExecutionTime.observe({ test_type: testType, status }, duration);
  }

  recordBuild(
    branch: string,
    status: 'success' | 'failure',
    duration: number
  ): void {
    this.buildTime.observe({ branch, status }, duration);
  }

  recordRollback(environment: string, reason: string): void {
    this.rollbackCounter.inc({ environment, reason });
  }

  getMetrics(): string {
    return this.registry.metrics();
  }
}
```

## Best Practices

### 1. Pipeline Design Principles
```yaml
principles:
  fail_fast:
    - Run fastest tests first
    - Parallel execution where possible
    - Early validation stages
  
  reproducibility:
    - Version-locked dependencies
    - Containerized builds
    - Infrastructure as Code
  
  security:
    - Secrets management
    - Dependency scanning
    - SAST/DAST integration
    - Container scanning
  
  observability:
    - Comprehensive logging
    - Metrics collection
    - Distributed tracing
    - Alerting on failures
```

### 2. Branch Protection Rules
```json
{
  "protection_rules": {
    "main": {
      "required_reviews": 2,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": true,
      "required_status_checks": [
        "ci/build",
        "ci/test",
        "ci/security",
        "sonarqube/quality-gate"
      ],
      "enforce_admins": true,
      "require_up_to_date": true,
      "require_signed_commits": true
    },
    "develop": {
      "required_reviews": 1,
      "required_status_checks": [
        "ci/build",
        "ci/test"
      ],
      "require_up_to_date": true
    }
  }
}
```

### 3. Rollback Strategy
```typescript
// Automated rollback conditions
interface RollbackTrigger {
  metric: string;
  threshold: number;
  duration: number;
  action: () => Promise<void>;
}

const rollbackTriggers: RollbackTrigger[] = [
  {
    metric: 'error_rate',
    threshold: 0.05, // 5% error rate
    duration: 300, // 5 minutes
    action: async () => {
      await kubectl.rollback('deployment/app');
    }
  },
  {
    metric: 'response_time_p99',
    threshold: 2000, // 2 seconds
    duration: 600, // 10 minutes
    action: async () => {
      await blueGreen.switchBack();
    }
  },
  {
    metric: 'memory_usage',
    threshold: 0.9, // 90% memory
    duration: 900, // 15 minutes
    action: async () => {
      await canary.abort();
    }
  }
];
```

## Performance Optimization

### Pipeline Caching Strategy
```yaml
cache_strategy:
  dependency_cache:
    - node_modules
    - .npm
    - .yarn
    - pip_cache
    - maven_repository
  
  build_cache:
    - Docker layer cache
    - Compiled artifacts
    - Webpack cache
  
  test_cache:
    - Test results
    - Coverage reports
    - Jest cache
  
  cache_invalidation:
    - Lock file changes
    - Configuration changes
    - Time-based expiry
```

### Parallel Execution
```yaml
parallel_strategies:
  test_parallelization:
    - Split by test files
    - Split by test suites
    - Matrix testing
  
  build_parallelization:
    - Multi-architecture builds
    - Independent service builds
    - Asset compilation
  
  deployment_parallelization:
    - Regional deployments
    - Service mesh updates
    - Database migrations
```

This comprehensive CI/CD patterns document provides:
- Complete pipeline implementations for major CI/CD platforms
- Advanced deployment strategies (Blue-Green, Canary, Rolling)
- Security scanning and quality gates
- Infrastructure as Code integration
- Monitoring and observability
- Best practices and optimization strategies
- Rollback and recovery procedures

The implementation demonstrates enterprise-grade CI/CD practices with proper testing, security, and deployment automation.