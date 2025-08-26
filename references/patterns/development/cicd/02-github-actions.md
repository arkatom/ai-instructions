# GitHub Actions

## 基本ワークフロー

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: matrix.node == '20'
```

## 高度な機能

### 再利用可能ワークフロー
```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      deploy_key:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - run: echo "Deploying to ${{ inputs.environment }}"
```

### 条件付き実行
```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
    steps:
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            frontend: 'src/frontend/**'
            backend: 'src/backend/**'
  
  frontend-build:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: npm run build:frontend
```

### キャッシュ戦略
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
      .next/cache
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## 環境とシークレット

### 環境設定
```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://example.com
    steps:
      - run: |
          echo "Deploy to production"
          echo "Using secret: ${{ secrets.PROD_API_KEY }}"
```

### Dependabot統合
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "team-name"
```

## セキュリティ

### OIDC認証（AWS）
```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789:role/GitHubActions
      aws-region: us-east-1
```

### CodeQL分析
```yaml
- uses: github/codeql-action/init@v3
  with:
    languages: javascript, typescript
- run: npm run build
- uses: github/codeql-action/analyze@v3
```

## アーティファクト管理

```yaml
# Upload artifacts
- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: dist/
    retention-days: 30

# Download artifacts
- uses: actions/download-artifact@v4
  with:
    name: build-output
    path: ./dist
```

## 並列処理とMatrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [18, 20]
    exclude:
      - os: windows-latest
        node: 18
  max-parallel: 2
  fail-fast: false
```

## カスタムアクション

```yaml
# action.yml
name: 'Custom Deploy'
inputs:
  environment:
    required: true
    default: 'staging'
outputs:
  url:
    value: ${{ steps.deploy.outputs.url }}
runs:
  using: 'composite'
  steps:
    - id: deploy
      run: |
        echo "url=https://${{ inputs.environment }}.example.com" >> $GITHUB_OUTPUT
      shell: bash
```

## 最適化テクニック

### 並列ジョブ
- テスト、ビルド、Lintを並列実行
- `needs`で依存関係を管理
- 独立したジョブは並列化

### 実行時間短縮
- キャッシュの積極活用
- 不要なステップをスキップ
- Dockerレイヤーキャッシュ
- Self-hosted runnerの活用

### コスト削減
- 条件付き実行で不要な実行を回避
- タイムアウト設定
- 並列数の制限
- Artifact保持期間の最適化

## トラブルシューティング

| 問題 | 解決策 |
|------|--------|
| Rate limit | Tokenを使用、実行を分散 |
| タイムアウト | timeout-minutes設定、処理を分割 |
| キャッシュミス | restore-keys設定、キャッシュキー見直し |
| シークレット漏洩 | マスク処理、環境変数使用 |

## ベストプラクティス

✅ **推奨**:
- ワークフローの再利用
- 適切なトリガー設定
- 環境別のシークレット管理
- 包括的なエラーハンドリング
- 定期的な依存関係更新

❌ **避けるべき**:
- シークレットのハードコード
- 無制限の並列実行
- キャッシュなしの大規模ビルド
- テストなしの自動デプロイ
- 過度に複雑なワークフロー