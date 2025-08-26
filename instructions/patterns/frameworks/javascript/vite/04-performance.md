# Vite パフォーマンス最適化

## ⚡ ビルド速度最適化

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    target: 'es2020',
    minify: true,
    treeShaking: true,
    legalComments: 'none',
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'lodash-es'],
    exclude: ['@vite/client', '@vite/env'],
    esbuildOptions: {
      target: 'es2020',
      supported: { bigint: true },
    },
  },
  
  build: {
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        maxParallelFileReads: 10,
        experimentalMinChunkSize: 20000,
      },
    },
    reportCompressedSize: false,
  },
});
```

## 🗜️ アセット最適化

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || '';
          
          if (/png|jpe?g|svg|gif|webp/i.test(extType)) {
            return 'images/[name]-[hash].[ext]';
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return 'fonts/[name]-[hash].[ext]';
          }
          
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    assetsInlineLimit: 4096, // 4KB以下はインライン化
  },
});

// 画像最適化プラグイン
import { imageOptimization } from 'vite-plugin-imagemin';

export const imagePlugin = () => imageOptimization({
  mozjpeg: { quality: 80 },
  optipng: { optimizationLevel: 7 },
  webp: { quality: 75 },
});
```

## 🚀 ランタイム最適化

```typescript
// レイジーローディング最適化
export class OptimizedLazyLoader {
  private cache = new Map<string, Promise<any>>();
  
  load<T>(moduleFactory: () => Promise<T>, key: string): Promise<T> {
    if (!this.cache.has(key)) {
      this.cache.set(key, moduleFactory());
    }
    return this.cache.get(key)!;
  }
  
  preload(moduleFactory: () => Promise<any>, key: string) {
    requestIdleCallback(() => {
      this.load(moduleFactory, key);
    });
  }
}

// Tree Shaking最適化
export const optimizedUtils = {
  debounce: (fn: Function, delay: number) => { /* 実装 */ },
  throttle: (fn: Function, delay: number) => { /* 実装 */ },
  memoize: <T extends Function>(fn: T): T => { /* 実装 */ },
} as const;

// コンポーネント最適化
export function createOptimizedComponent<T>(
  Component: React.ComponentType<T>
) {
  return React.memo(Component, (prevProps, nextProps) => {
    return Object.keys(prevProps as object).every(
      key => (prevProps as any)[key] === (nextProps as any)[key]
    );
  });
}
```

## 📦 バンドルサイズ削減

```typescript
import { defineConfig } from 'vite';
import { analyzer } from 'vite-bundle-analyzer';

export default defineConfig({
  plugins: [
    analyzer({
      analyzerMode: 'server',
      openAnalyzer: false,
    }),
  ],
  
  build: {
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  
  define: {
    __DEV__: false,
    'process.env.NODE_ENV': '"production"',
  },
});
```

## 🔧 メモリ使用量最適化

```typescript
// メモリリーク防止
export class MemoryOptimizedComponent extends React.Component {
  private subscriptions = new Set<() => void>();
  
  subscribe(cleanup: () => void) {
    this.subscriptions.add(cleanup);
  }
  
  componentWillUnmount() {
    this.subscriptions.forEach(cleanup => cleanup());
    this.subscriptions.clear();
  }
}

// WeakMapメモ化
const componentCache = new WeakMap<object, React.ReactNode>();

export function memoizeByProps<T extends object>(
  Component: React.ComponentType<T>
) {
  return function MemoizedComponent(props: T) {
    if (componentCache.has(props)) {
      return componentCache.get(props);
    }
    
    const element = <Component {...props} />;
    componentCache.set(props, element);
    return element;
  };
}

// リソース管理
export class ResourceManager {
  private resources = new Map<string, any>();
  
  addResource(key: string, resource: any) {
    if (this.resources.has(key)) {
      this.cleanup(key);
    }
    this.resources.set(key, resource);
  }
  
  cleanup(key?: string) {
    if (key) {
      const resource = this.resources.get(key);
      if (resource?.cleanup) resource.cleanup();
      this.resources.delete(key);
    } else {
      this.resources.forEach((resource) => {
        if (resource?.cleanup) resource.cleanup();
      });
      this.resources.clear();
    }
  }
}
```

## ⚡ キャッシュ戦略

```typescript
// HTTPキャッシュ最適化
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});

// Service Workerキャッシュ
export class CacheManager {
  private cacheVersion = 'v1';
  
  async cacheStaticAssets() {
    const cache = await caches.open(`static-${this.cacheVersion}`);
    return cache.addAll([
      '/',
      '/static/js/main.js',
      '/static/css/main.css',
    ]);
  }
  
  async handleFetch(request: Request): Promise<Response> {
    if (request.url.includes('/api/')) {
      try {
        const response = await fetch(request);
        const cache = await caches.open(`dynamic-${this.cacheVersion}`);
        cache.put(request, response.clone());
        return response;
      } catch {
        return caches.match(request) || new Response('Offline', { status: 503 });
      }
    }
    
    return caches.match(request) || fetch(request);
  }
}
```

## 📊 パフォーマンス監視

```typescript
// Web Vitals監視
export class PerformanceMonitor {
  private metrics = new Map<string, number>();
  
  measureWebVitals() {
    // CLS監視
    new PerformanceObserver((list) => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.metrics.set('CLS', clsValue);
    }).observe({ type: 'layout-shift', buffered: true });
    
    // LCP監視
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      this.metrics.set('LCP', entries[entries.length - 1].startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }
  
  sendMetrics() {
    navigator.sendBeacon('/api/metrics', 
      JSON.stringify(Object.fromEntries(this.metrics))
    );
  }
}
```

## 💡 実装指針

```typescript
// パフォーマンス最適化戦略:
// - Critical Rendering Path最適化
// - Resource Hints活用
// - Code Splitting効果的実装
// - 遅延読み込み戦略
// - Service Worker活用
```