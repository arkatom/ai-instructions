# Vite デプロイメント戦略

## 🚀 本番ビルド最適化

```typescript
// vite.config.production.ts
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87'],
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || '';
          
          if (/png|jpe?g|svg|gif|webp|ico/i.test(extType)) {
            return 'images/[name]-[hash].[ext]';
          }
          if (/css/i.test(extType)) {
            return 'styles/[name]-[hash].[ext]';
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return 'fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
        
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@mui/material', '@emotion/react'],
        },
      },
    },
    
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
  },
  
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    
    createHtmlPlugin({
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true,
      },
    }),
    
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 3000000,
      },
    }),
  ],
  
  define: {
    'process.env.NODE_ENV': '"production"',
    __DEV__: false,
    __PROD__: true,
  },
});
```

## 📦 Docker化

```dockerfile
# Dockerfile.production
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile --production=false

COPY . .

RUN yarn build

# 本番用イメージ
FROM nginx:alpine

# nginx設定
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        application/javascript
        application/json
        text/css
        text/javascript
        text/xml
        text/plain;
    
    server {
        listen 80;
        root /usr/share/nginx/html;
        index index.html;
        
        # セキュリティヘッダー
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000";
        
        # キャッシュ設定
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # HTMLファイルはキャッシュしない
        location ~* \.(html)$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # SPAのルーティング対応
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # API プロキシ
        location /api/ {
            proxy_pass http://backend:3001/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

## ☁️ CI/CDパイプライン

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Run linting
        run: yarn lint
      
      - name: Run type checking
        run: yarn type-check
      
      - name: Run tests
        run: yarn test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
  
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Build application
        run: yarn build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_APP_VERSION: ${{ github.sha }}
      
      - name: Build Docker image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker tag my-app:${{ github.sha }} my-app:latest
      
      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: |
          echo "Deploying to production..."

  e2e-tests:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Install Playwright
        run: yarn playwright install --with-deps
      
      - name: Run E2E tests
        run: yarn test:e2e
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🌐 CDN配信戦略

```typescript
// CDN最適化設定
export default defineConfig({
  base: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.example.com/app/' 
    : '/',
    
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || '';
          
          if (/png|jpe?g|svg|gif|webp/i.test(extType)) {
            return 'media/[name]-[hash].[ext]';
          }
          if (/css|js/i.test(extType)) {
            return 'static/[name]-[hash].[ext]';
          }
          
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
  
  plugins: [
    {
      name: 'resource-hints',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'resource-hints.json',
          source: JSON.stringify({
            dns_prefetch: ['//fonts.googleapis.com', '//api.example.com'],
            preconnect: ['//cdn.example.com'],
          }),
        });
      },
    },
  ],
});

// Service Worker with CDN cache strategy
export class CDNCacheStrategy {
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.hostname.includes('cdn.example.com')) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;
      
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open('cdn-cache-v1');
        cache.put(request, response.clone());
      }
      return response;
    }
    
    return fetch(request);
  }
}
```

## 🔧 環境別設定管理

```typescript
// config/environments.ts
interface EnvironmentConfig {
  apiUrl: string;
  cdnUrl: string;
  enableAnalytics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  features: Record<string, boolean>;
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    apiUrl: 'http://localhost:3001',
    cdnUrl: '',
    enableAnalytics: false,
    logLevel: 'debug',
    features: {
      newDashboard: true,
      betaFeatures: true,
    },
  },
  
  staging: {
    apiUrl: 'https://api-staging.example.com',
    cdnUrl: 'https://cdn-staging.example.com',
    enableAnalytics: true,
    logLevel: 'info',
    features: {
      newDashboard: true,
      betaFeatures: false,
    },
  },
  
  production: {
    apiUrl: 'https://api.example.com',
    cdnUrl: 'https://cdn.example.com',
    enableAnalytics: true,
    logLevel: 'warn',
    features: {
      newDashboard: false,
      betaFeatures: false,
    },
  },
};

export const getConfig = () => {
  const env = import.meta.env.MODE || 'development';
  return environments[env] || environments.development;
};
```

## 💡 実装指針

```typescript
// デプロイメント戦略:
// - Blue-Green Deployment
// - Canary Release  
// - Feature Toggles
// - Zero-downtime Deployment
```