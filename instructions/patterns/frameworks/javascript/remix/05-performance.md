# Remix パフォーマンスパターン

## ⚡ Resource Optimization

### Deferred Loading パターン

```typescript
// app/routes/products._index.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import { defer } from '@remix-run/node';
import { Await } from '@remix-run/react';
import { Suspense } from 'react';
import { getProducts, getFeaturedProducts } from '~/models/product.server';

interface LoaderData {
  products: Product[];
  featuredProducts: Promise<Product[]>; // 遅延ローディング
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = 20;
  const search = url.searchParams.get('search') || '';

  // 高速データ: 即座に取得
  const productsPromise = getProducts({
    page,
    limit,
    search
  });

  // 低速データ: 遅延ローディング
  const featuredProductsPromise = getFeaturedProducts();

  const { products, totalCount } = await productsPromise;

  return defer<LoaderData>({
    products,
    featuredProducts: featuredProductsPromise,
    totalCount,
    page,
    hasMore: totalCount > page * limit
  });
}

export default function ProductsIndex() {
  const { products, featuredProducts, totalCount, page, hasMore } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // 無限スクロール実装
  const loadMore = () => {
    if (fetcher.state === 'idle' && hasMore) {
      fetcher.load(`?page=${page + 1}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">商品一覧</h1>
        <p className="text-muted-foreground">{totalCount}件の商品</p>
      </div>

      {/* おすすめ商品 - 遅延ローディング */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">おすすめ商品</h2>
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        }>
          <Await resolve={featuredProducts}>
            {(featured) => (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </Await>
        </Suspense>
      </section>

      {/* 通常商品 */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          
          {/* フェッチャーによる追加データ */}
          {fetcher.data?.products?.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* さらに読み込むボタン */}
        {hasMore && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              disabled={fetcher.state !== 'idle'}
              className="btn-secondary"
            >
              {fetcher.state === 'loading' ? 'ロード中...' : 'さらに読み込む'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
```

### Resource Preloading

```typescript
// app/routes/products._index.tsx
import type { LinksFunction } from '@remix-run/node';

export const links: LinksFunction = () => [
  {
    rel: 'preload',
    href: '/images/hero-banner.webp',
    as: 'image',
    type: 'image/webp'
  },
  {
    rel: 'prefetch',
    href: '/api/featured-products'
  },
  {
    rel: 'preconnect',
    href: 'https://api.external-service.com'
  }
];
```

## 💾 キャッシング戦略

### In-memory Cache

```typescript
// app/utils/cache.server.ts
import { LRUCache } from 'lru-cache';
import { remember } from '@epic-web/remember';

// アプリケーション内キャッシュ
const cache = remember('app-cache', () => 
  new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 5 // 5分間
  })
);

export function getCached<T>(key: string): T | undefined {
  return cache.get(key);
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// キャッシュ付きローダーヘルパー
export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300000 // 5分
): Promise<T> {
  const cached = getCached<{ data: T; expiry: number }>(key);
  
  if (cached && Date.now() < cached.expiry) {
    return Promise.resolve(cached.data);
  }

  return fetcher().then((data) => {
    setCached(key, { data, expiry: Date.now() + ttl });
    return data;
  });
}
```

### Redis Cache Integration

```typescript
// app/utils/redis-cache.server.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5分
): Promise<T> {
  try {
    // キャッシュから取得を試行
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // キャッシュミスの場合、データを取得してキャッシュ
    const data = await fetcher();
    await redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Cache error:', error);
    // キャッシュエラー時はデータを直接取得
    return fetcher();
  }
}

// キャッシュ無効化
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}
```

### HTTP Cache Headers

```typescript
// app/routes/api/products.ts
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const products = await getProducts();
  
  return json(products, {
    headers: {
      // ブラウザキャッシュ: 5分
      'Cache-Control': 'public, max-age=300',
      // CDNキャッシュ: 1時間
      's-maxage': '3600',
      // ETag による条件付きリクエスト
      'ETag': generateETag(products),
      // 最終更新時間
      'Last-Modified': new Date(products[0]?.updatedAt).toUTCString()
    }
  });
}
```

## 🔄 Optimistic UI パターン

### Optimistic Updates

```typescript
// app/routes/todos.$todoId.toggle.ts
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher } from '@remix-run/react';
import { updateTodoStatus } from '~/models/todo.server';

export async function action({ params, request }: ActionFunctionArgs) {
  const todoId = params.todoId!;
  const formData = await request.formData();
  const completed = formData.get('completed') === 'true';

  const updatedTodo = await updateTodoStatus(todoId, completed);
  
  return json({ todo: updatedTodo });
}

// コンポーネントでの楽観的更新
export function TodoItem({ todo }: { todo: Todo }) {
  const toggleFetcher = useFetcher();
  
  // 楽観的な状態計算
  const optimisticCompleted = toggleFetcher.formData 
    ? toggleFetcher.formData.get('completed') === 'true'
    : todo.completed;

  const handleToggle = () => {
    toggleFetcher.submit(
      { completed: (!todo.completed).toString() },
      { method: 'post', action: `/todos/${todo.id}/toggle` }
    );
  };

  return (
    <div className={`todo-item ${optimisticCompleted ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={optimisticCompleted}
        onChange={handleToggle}
        disabled={toggleFetcher.state === 'submitting'}
      />
      <span className={optimisticCompleted ? 'line-through' : ''}>
        {todo.title}
      </span>
      {toggleFetcher.state === 'submitting' && (
        <Spinner className="w-4 h-4 ml-2" />
      )}
    </div>
  );
}
```

## 🚀 Code Splitting パターン

### Lazy Loading Components

```typescript
// app/components/LazyChart.tsx
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('./Chart'));

export function LazyChart({ data }: { data: ChartData }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <Chart data={data} />
    </Suspense>
  );
}

// Dynamic Import with Error Boundary
export function DynamicComponent({ type }: { type: string }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadComponent = async () => {
      try {
        const module = await import(`./components/${type}`);
        setComponent(() => module.default);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, [type]);

  if (loading) return <ComponentSkeleton />;
  if (error) return <ComponentError error={error} />;
  if (!Component) return null;

  return <Component />;
}
```

## 📊 Performance Monitoring

### Web Vitals Tracking

```typescript
// app/utils/analytics.client.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Google Analytics, DataDog等に送信
  gtag('event', metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_category: 'Web Vitals',
    event_label: metric.id,
    non_interaction: true,
  });
}

// Core Web Vitals の測定
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);

// カスタム metrics
export function trackCustomMetric(name: string, value: number, labels?: Record<string, string>) {
  sendToAnalytics({
    name: `custom_${name}`,
    value,
    labels
  });
}
```

### Bundle Size Monitoring

```typescript
// remix.config.js
module.exports = {
  future: {
    v2_routeConvention: true,
  },
  serverModuleFormat: "cjs",
  // Bundle analyzer の設定
  serverDependenciesToBundle: [
    // 必要な依存関係のみバンドル
    /^@radix-ui/,
    /^@hookform/
  ],
  // Tree shaking の最適化
  serverMinify: process.env.NODE_ENV === 'production',
};

// Webpack Bundle Analyzer (開発時)
if (process.env.ANALYZE_BUNDLE) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
  
  module.exports.plugins = [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
    })
  ];
}
```

## 🎯 実装ポイント

### 読み込み最適化
- 遅延ローディングによる初期読み込み時間短縮
- リソースプリローディングによるナビゲーション高速化
- コード分割による Bundle サイズ最適化

### キャッシング戦略
- 多層キャッシング（メモリ、Redis、HTTP）
- 適切な TTL 設定
- キャッシュ無効化戦略

### ユーザーエクスペリエンス
- 楽観的 UI 更新による体感速度向上
- スケルトンローディングによる視覚的フィードバック
- エラー状態の適切な処理