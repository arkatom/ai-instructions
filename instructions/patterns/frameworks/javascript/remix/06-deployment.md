# Remix デプロイパターン

## 🧪 テスト戦略

### Comprehensive Testing

```typescript
// test/utils/test-helpers.ts
import { createRemixStub } from '@remix-run/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock Server 設定
export const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// テストユーティリティ
export function renderWithRemix(
  children: React.ReactElement,
  options: {
    initialEntries?: string[];
    loader?: () => any;
    action?: () => any;
  } = {}
) {
  const RemixStub = createRemixStub([
    {
      path: '/',
      Component: () => children,
      loader: options.loader,
      action: options.action
    }
  ]);

  return render(
    <RemixStub initialEntries={options.initialEntries || ['/']} />
  );
}

export const createMockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});
```

### Integration Testing

```typescript
// test/routes/products.test.tsx
import { json } from '@remix-run/node';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsRoute from '~/routes/products._index';
import { renderWithRemix, server } from '../utils/test-helpers';

const mockProducts = [
  {
    id: '1',
    name: 'Test Product 1',
    price: 1000,
    description: 'Test description 1'
  },
  {
    id: '2',
    name: 'Test Product 2',
    price: 2000,
    description: 'Test description 2'
  }
];

describe('Products Route', () => {
  beforeEach(() => {
    server.use(
      rest.get('/api/products', (req, res, ctx) => {
        return res(ctx.json(mockProducts));
      })
    );
  });

  test('displays products list', async () => {
    renderWithRemix(<ProductsRoute />, {
      loader: () => json({ products: mockProducts })
    });

    expect(screen.getByText('商品一覧')).toBeInTheDocument();
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
  });

  test('filters products by search term', async () => {
    const user = userEvent.setup();
    
    renderWithRemix(<ProductsRoute />, {
      loader: () => json({ products: mockProducts })
    });

    const searchInput = screen.getByLabelText('商品検索');
    await user.type(searchInput, 'Product 1');

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument();
    });
  });

  test('handles empty search results', async () => {
    const user = userEvent.setup();
    
    renderWithRemix(<ProductsRoute />, {
      loader: () => json({ products: mockProducts })
    });

    const searchInput = screen.getByLabelText('商品検索');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('商品が見つかりませんでした')).toBeInTheDocument();
    });
  });
});
```

### E2E Testing with Playwright

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('user can register, login, and logout', async ({ page }) => {
    // 新規登録
    await page.goto('/register');
    
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.fill('[name="confirmPassword"]', 'password123');
    
    await page.click('button[type="submit"]');
    
    // ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('ダッシュボード');
    
    // ログアウト
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL('/login');
    
    // ログイン
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 再度ダッシュボードに戻ることを確認
    await expect(page).toHaveURL('/dashboard');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('.alert-error')).toContainText(
      'メールアドレスまたはパスワードが正しくありません'
    );
  });
});
```

## 🚀 Production Deployment

### Environment Configuration

```typescript
// app/utils/env.server.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
  EMAIL_SERVICE_API_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  PUBLIC_STRIPE_KEY: z.string()
});

function getEnv() {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
}

export const env = getEnv();
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine as base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies
FROM base as deps
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Build
FROM base as build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production
FROM base as production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY package.json ./

EXPOSE 3000
USER node
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run linting
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test
      
      - name: Run E2E tests
        run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t myapp:${{ github.sha }} .
          docker tag myapp:${{ github.sha }} myapp:latest
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push myapp:${{ github.sha }}
          docker push myapp:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} '
            docker pull myapp:latest
            docker-compose up -d --no-deps app
            docker image prune -f
          '
```

## 📊 Monitoring & Observability

### Application Monitoring

```typescript
// app/utils/monitoring.server.ts
import { performance } from 'perf_hooks';

// パフォーマンス測定
export function measureTime<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  
  return fn().then(
    (result) => {
      const duration = performance.now() - start;
      console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
      
      // APM ツールに送信 (DataDog, New Relic等)
      sendMetric('performance.timer', duration, { operation: name });
      
      return result;
    },
    (error) => {
      const duration = performance.now() - start;
      console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
      
      sendMetric('performance.timer', duration, { 
        operation: name, 
        error: true 
      });
      
      throw error;
    }
  );
}

// エラー追跡
export function trackError(error: Error, context?: Record<string, any>) {
  console.error('Application error:', error, context);
  
  // Sentry, Bugsnag等にエラーを送信
  if (typeof window === 'undefined') {
    // サーバーサイドエラー
    Sentry.captureException(error, { extra: context });
  } else {
    // クライアントサイドエラー
    window.Sentry?.captureException(error, { extra: context });
  }
}
```

### Health Checks

```typescript
// app/routes/health.ts
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { prisma } from '~/utils/db.server';
import { redis } from '~/utils/cache.server';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    external_api: 'healthy' | 'unhealthy';
  };
  version: string;
  uptime: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = performance.now();
  
  const checks = await Promise.allSettled([
    // データベース接続確認
    prisma.$queryRaw`SELECT 1`,
    
    // Redis接続確認
    redis.ping(),
    
    // 外部API接続確認
    fetch('https://api.external-service.com/health', {
      signal: AbortSignal.timeout(5000)
    })
  ]);

  const services = {
    database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    external_api: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
  } as const;

  const allHealthy = Object.values(services).every(status => status === 'healthy');
  
  const healthCheck: HealthCheck = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services,
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime()
  };

  const responseTime = performance.now() - startTime;
  
  return json(healthCheck, {
    status: allHealthy ? 200 : 503,
    headers: {
      'X-Response-Time': `${responseTime.toFixed(2)}ms`
    }
  });
}
```

### Logging Strategy

```typescript
// app/utils/logger.server.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'remix-app',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 構造化ログ用ヘルパー
export function logRequest(request: Request, responseTime?: number) {
  logger.info('HTTP Request', {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('User-Agent'),
    responseTime,
    timestamp: new Date().toISOString()
  });
}

export function logError(error: Error, context?: Record<string, any>) {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

export { logger };
```

## 🎯 実装ポイント

### テスト戦略
- 単体テスト、統合テスト、E2Eテストの適切な分散
- MSW によるモック管理
- CI/CD パイプラインでのテスト自動化

### デプロイメント
- Docker による環境の標準化
- 段階的デプロイメント
- ロールバック戦略の実装

### 運用監視
- アプリケーションメトリクスの収集
- エラー追跡と通知
- ヘルスチェックによる可用性監視

### セキュリティ
- 環境変数による設定管理
- シークレット管理の実装
- セキュリティヘッダーの設定