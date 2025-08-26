# Vite コード分割戦略

## 📦 チャンク最適化設定

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // ベンダーライブラリの分離
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@mui/material', '@emotion/react'],
          utils: ['lodash-es', 'date-fns', 'zod'],
          
          // 機能別チャンク
          auth: ['./src/auth/index.ts'],
          dashboard: ['./src/dashboard/index.ts'],
          admin: ['./src/admin/index.ts'],
        },
        
        // チャンク命名パターン
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'vendor') {
            return 'vendor-[hash].js';
          }
          return 'chunks/[name]-[hash].js';
        },
        
        // アセット命名
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
            return 'images/[name]-[hash].[ext]';
          }
          if (/css/i.test(extType || '')) {
            return 'styles/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
});
```

## 🎯 動的インポート戦略

```typescript
// ルート分割
const HomePage = lazy(() => import('./pages/HomePage'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const AdminPanel = lazy(() => 
  import('./pages/AdminPanel').then(module => ({ 
    default: module.AdminPanel 
  }))
);

// 機能モジュールの遅延読み込み
const loadDashboard = () => import('./modules/dashboard');
const loadReporting = () => import('./modules/reporting');

// 条件付き読み込み
const loadAdvancedFeatures = async () => {
  if (user.hasPremium) {
    return import('./features/premium');
  }
  return import('./features/basic');
};
```

## 🏗️ チャンク分割アルゴリズム

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // サイズベースの分割
          if (id.includes('node_modules')) {
            const directories = id.split('node_modules/')[1].split('/');
            const packageName = directories[0].startsWith('@') 
              ? `${directories[0]}/${directories[1]}` 
              : directories[0];
            
            // 大きなライブラリは個別チャンク
            const largePackages = ['@mui/material', 'lodash-es', 'moment'];
            if (largePackages.includes(packageName)) {
              return packageName.replace('@', '').replace('/', '-');
            }
            
            // その他は vendor チャンクに
            return 'vendor';
          }
          
          // 機能ディレクトリベースの分割
          if (id.includes('/features/')) {
            const feature = id.split('/features/')[1].split('/')[0];
            return `feature-${feature}`;
          }
          
          // ページベースの分割
          if (id.includes('/pages/')) {
            const page = id.split('/pages/')[1].split('/')[0];
            return `page-${page}`;
          }
          
          // 共通コンポーネント
          if (id.includes('/components/')) {
            return 'components';
          }
        },
      },
    },
  },
});
```

## 🚀 レイジーローディング実装

```typescript
// コンポーネントレベルの分割
interface LazyComponentProps {
  fallback?: React.ComponentType;
  errorBoundary?: React.ComponentType<{ error: Error }>;
}

export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentProps = {}
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <ErrorBoundary fallback={options.errorBoundary}>
        <Suspense fallback={options.fallback || <div>Loading...</div>}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

// 使用例
const LazyChart = createLazyComponent(
  () => import('./components/Chart'),
  { 
    fallback: ChartSkeleton,
    errorBoundary: ChartError 
  }
);
```

## 📈 プリロード戦略

```typescript
// インテリジェントプリロード
export class PreloadManager {
  private preloadedModules = new Set<string>();
  
  preloadRoute(path: string) {
    if (this.preloadedModules.has(path)) return;
    
    const modulePromise = this.getModuleForRoute(path);
    if (modulePromise) {
      modulePromise.catch(() => {}); // エラーを無視
      this.preloadedModules.add(path);
    }
  }
  
  preloadOnHover(element: HTMLElement, modulePath: string) {
    let timeoutId: number;
    
    element.addEventListener('mouseenter', () => {
      timeoutId = window.setTimeout(() => {
        this.preloadRoute(modulePath);
      }, 100); // 100ms遅延
    });
    
    element.addEventListener('mouseleave', () => {
      clearTimeout(timeoutId);
    });
  }
  
  preloadCriticalResources() {
    // 初回読み込み後に重要なリソースをプリロード
    requestIdleCallback(() => {
      this.preloadRoute('/dashboard');
      this.preloadRoute('/profile');
    });
  }
}
```

## 🎨 CSS分割戦略

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // CSS分割
          if (assetInfo.name?.endsWith('.css')) {
            // クリティカルCSS
            if (assetInfo.name.includes('critical')) {
              return 'styles/critical-[hash].css';
            }
            // ページ固有CSS
            if (assetInfo.name.includes('page-')) {
              return 'styles/pages/[name]-[hash].css';
            }
            // コンポーネントCSS
            return 'styles/components/[name]-[hash].css';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    
    cssCodeSplit: true, // CSS分割を有効化
  },
  
  css: {
    modules: {
      generateScopedName: (name, filename) => {
        const componentName = filename
          .split('/')
          .pop()
          ?.replace(/\.(module\.)?(css|scss|less)$/, '');
        return `${componentName}_${name}_[hash:base64:5]`;
      },
    },
  },
});
```

## 🔧 バンドル分析と最適化

```typescript
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

export default defineConfig({
  plugins: [
    // バンドルサイズ可視化
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 重複排除アルゴリズム
          return optimizeChunkDistribution(id);
        },
      },
    },
  },
});

function optimizeChunkDistribution(id: string): string | void {
  // サイズベースの分割判定
  const moduleInfo = getModuleInfo(id);
  
  if (moduleInfo.size > 100 * 1024) { // 100KB以上
    return 'large-modules';
  }
  
  if (moduleInfo.frequency > 0.8) { // 80%以上のページで使用
    return 'common';
  }
  
  // その他の最適化ロジック
}
```

## 💡 分割戦略のベストプラクティス

```typescript
// 動的チャンク生成
export function createDynamicChunk(modules: string[]) {
  return Promise.all(
    modules.map(module => import(/* @vite-ignore */ module))
  );
}

// 条件付きチャンク読み込み
export async function loadConditionalFeatures(userFeatures: string[]) {
  const chunks = await Promise.allSettled(
    userFeatures.map(feature => 
      import(`./features/${feature}/index.ts`)
    )
  );
  
  return chunks
    .filter((result): result is PromiseFulfilledResult<any> => 
      result.status === 'fulfilled'
    )
    .map(result => result.value);
}

// 実装指針:
// - サイズベース自動分割
// - 使用頻度分割
// - キャッシュ戦略連携
```