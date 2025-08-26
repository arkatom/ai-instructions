# Storybook CI/CD統合

自動テスト、デプロイ、品質チェック。

## GitHub Actions設定

```yaml
# .github/workflows/storybook.yml
name: Storybook Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build-storybook
      - run: npm run test-storybook:ci
      
      # Visual testing
      - run: npx chromatic --project-token=${{ secrets.CHROMATIC_TOKEN }}
        if: github.event_name == 'pull_request'
```

## テストランナー

```bash
# インストール
npm install --save-dev @storybook/test-runner

# 設定ファイル
# .storybook/test-runner.ts
import { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postVisit(page, context) {
    // カバレッジ収集
    const coverage = await page.coverage.stopJSCoverage();
    // レポート生成
  }
};

export default config;
```

## 自動デプロイ

```yaml
# デプロイワークフロー
deploy:
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v3
    - run: npm ci
    - run: npm run build-storybook
    
    # Vercelデプロイ
    - uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        working-directory: ./storybook-static
```

## 品質チェック

```yaml
# 品質ゲート
quality:
  runs-on: ubuntu-latest
  steps:
    - run: npm run lint:stories
    - run: npm run test-storybook -- --coverage
    - run: npx storybook extract
    
    # カバレッジ確認
    - uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Netlify統合

```toml
# netlify.toml
[build]
  command = "npm run build-storybook"
  publish = "storybook-static"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Docker化

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build-storybook
FROM nginx:alpine
COPY --from=0 /app/storybook-static /usr/share/nginx/html
```

## 設定ファイル例

```json
// package.json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test-storybook": "test-storybook",
    "test-storybook:ci": "concurrently -k -s first -n \"SB,TEST\" -c \"magenta,blue\" \"npm run build-storybook && npx http-server storybook-static --port 6006 --silent\" \"wait-on tcp:6006 && npm run test-storybook\""
  }
}
```

→ 詳細: [基本実装](./csf3-basics.md)