# GitHub Actions

## Complete Production Workflow

```yaml
# .github/workflows/production.yml
name: Production CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        type: environment
        description: 'Target environment'
        default: 'staging'

env:
  NODE_VERSION: '20.x'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run tests
        run: npm test -- --coverage --ci
        env:
          CI: true

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        if: matrix.node-version == '20.x' && matrix.os == 'ubuntu-latest'
        with:
          file: ./coverage/lcov.info
          flags: unittests

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: CodeQL Analysis
        uses: github/codeql-action/init@v3
        with:
          languages: javascript
      
      - uses: github/codeql-action/analyze@v3

  build:
    name: Build and Push
    runs-on: ubuntu-latest
    needs: [test, security]
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: 
      name: production
      url: https://myapp.com
    
    steps:
      - name: Deploy to Production
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'my-production-app'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main
```

## Custom Actions

```yaml
# .github/actions/setup-app/action.yml
name: 'Setup Application'
description: 'Setup Node.js app with caching and dependencies'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20.x'
  cache-key:
    description: 'Cache key prefix'
    required: false
    default: 'app'

outputs:
  cache-hit:
    description: 'Whether cache was hit'
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        
    - name: Cache dependencies
      id: cache
      uses: actions/cache@v4
      with:
        path: |
          ~/.npm
          node_modules
        key: ${{ inputs.cache-key }}-${{ runner.os }}-node-${{ inputs.node-version }}-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ inputs.cache-key }}-${{ runner.os }}-node-${{ inputs.node-version }}-
          
    - name: Install dependencies
      if: steps.cache.outputs.cache-hit != 'true'
      run: npm ci
      shell: bash
```

## Conditional Workflows

```yaml
# .github/workflows/conditional.yml
name: Conditional Execution

on: [push, pull_request]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.changes.outputs.frontend }}
      backend: ${{ steps.changes.outputs.backend }}
      docs: ${{ steps.changes.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            frontend:
              - 'src/frontend/**'
              - 'package.json'
            backend:
              - 'src/backend/**'
              - 'requirements.txt'
            docs:
              - 'docs/**'
              - '*.md'

  frontend-tests:
    needs: changes
    if: ${{ needs.changes.outputs.frontend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run frontend tests
        run: npm run test:frontend

  backend-tests:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backend tests
        run: python -m pytest

  docs-build:
    needs: changes
    if: ${{ needs.changes.outputs.docs == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build documentation
        run: npm run docs:build
```

## Environment Management

```yaml
# .github/workflows/environments.yml
name: Multi-Environment Deployment

on:
  push:
    branches: [main, develop, 'release/*']

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.myapp.com
    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging environment"
          echo "URL: https://staging.myapp.com"

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production environment"
          echo "URL: https://myapp.com"
        env:
          DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

## Artifact Management

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build application
        run: npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-files
          path: |
            dist/
            !dist/**/*.map
          retention-days: 30

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: |
            coverage/
            test-results.xml

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-files
          path: ./dist
      
      - name: Deploy artifacts
        run: |
          ls -la dist/
          # Deploy logic here
```

## Self-Hosted Runners

```yaml
# .github/workflows/self-hosted.yml
name: Self-Hosted Runner Pipeline

on: [push]

jobs:
  build-on-premise:
    runs-on: [self-hosted, linux, x64, gpu]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup custom environment
        run: |
          export CUDA_VERSION=12.0
          export PATH=/usr/local/cuda/bin:$PATH
      
      - name: Run ML training
        run: python train_model.py
        
      - name: GPU cleanup
        if: always()
        run: nvidia-smi --gpu-reset
```

## Best Practices

1. **Use Matrices**: Test across multiple versions and platforms
2. **Cache Dependencies**: Reduce build times with effective caching
3. **Conditional Execution**: Only run necessary jobs based on changes
4. **Environment Secrets**: Use GitHub environments for secret management
5. **Artifact Lifecycle**: Set appropriate retention periods for artifacts
6. **Custom Actions**: Create reusable actions for common workflows