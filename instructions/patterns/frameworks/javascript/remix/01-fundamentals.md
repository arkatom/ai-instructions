# Remix 基本構築パターン

## 🚀 基本アーキテクチャパターン

### Nested Routing with Loaders

```typescript
// app/root.tsx - アプリケーションルート
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  LiveReload,
  useLoaderData,
} from '@remix-run/react';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getUser } from '~/utils/session.server';

interface LoaderData {
  user: User | null;
  ENV: {
    NODE_ENV: string;
    PUBLIC_STRIPE_KEY: string;
  };
}

export const meta: MetaFunction = () => [
  { title: 'Modern Fullstack App' },
  { name: 'description', content: 'Built with Remix and TypeScript' },
  { name: 'viewport', content: 'width=device-width,initial-scale=1' }
];

// ルートレベルでのデータローディング
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  
  return json<LoaderData>({
    user,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
      PUBLIC_STRIPE_KEY: process.env.PUBLIC_STRIPE_KEY || ''
    }
  });
}

export default function App() {
  const { user, ENV } = useLoaderData<typeof loader>();

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <Outlet />
        </main>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}
```

### Layout Route パターン

```typescript
// app/routes/dashboard.tsx - レイアウトルート
import type { LoaderFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/session.server';
import { Outlet } from '@remix-run/react';
import { DashboardSidebar } from '~/components/DashboardSidebar';

// 認証が必要なレイアウトルート
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request); // 認証チェック
  return json({});
}

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <div className="flex-1 p-8">
        <Outlet /> {/* 子ルートをレンダリング */}
      </div>
    </div>
  );
}
```

### Index Route パターン

```typescript
// app/routes/dashboard._index.tsx - インデックスルート
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireUserId } from '~/utils/session.server';
import { getDashboardStats } from '~/models/analytics.server';

interface LoaderData {
  stats: {
    totalUsers: number;
    totalRevenue: number;
    activeSubscriptions: number;
    conversionRate: number;
  };
  recentActivity: Activity[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  
  // 並列データフェッチで最適化
  const [stats, recentActivity] = await Promise.all([
    getDashboardStats(userId),
    getRecentActivity(userId)
  ]);

  return json<LoaderData>({ stats, recentActivity });
}

export default function DashboardIndex() {
  const { stats, recentActivity } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">
          アプリケーションの状況を一覧できます
        </p>
      </div>
      
      <DashboardStats stats={stats} />
      <RecentActivity activities={recentActivity} />
    </div>
  );
}
```

### Dynamic Route パターン

```typescript
// app/routes/products.$productId.tsx - 動的ルート
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { getProduct, getCategories } from '~/models/product.server';
import { notFound } from '~/utils/request.server';

interface LoaderData {
  product: Product;
  categories: Category[];
  relatedProducts: Product[];
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const productId = params.productId;
  if (!productId) {
    throw notFound('Product not found');
  }

  // 並列データフェッチでパフォーマンス向上
  const [product, categories, relatedProducts] = await Promise.all([
    getProduct(productId),
    getCategories(),
    getRelatedProducts(productId, 4)
  ]);

  if (!product) {
    throw notFound('Product not found');
  }

  return json<LoaderData>({
    product,
    categories,
    relatedProducts
  });
}

// SEO最適化のためのMeta関数
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.product) {
    return [{ title: 'Product Not Found' }];
  }

  return [
    { title: `${data.product.name} | 商品管理` },
    { name: 'description', content: data.product.description },
    { property: 'og:title', content: data.product.name },
    { property: 'og:description', content: data.product.description },
    { property: 'og:image', content: data.product.imageUrl },
    { property: 'og:type', content: 'product' }
  ];
};

export default function ProductDetail() {
  const { product, categories, relatedProducts } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">商品ID: {product.id}</p>
        </div>
      </div>

      <ProductDetails product={product} />
      
      {relatedProducts.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">関連商品</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

## 🎯 TypeScript型定義パターン

### Loader/Action型定義

```typescript
// 型安全なLoader定義
export interface LoaderData {
  product: Product;
  categories: Category[];
}

export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
  // 実装
  return json<LoaderData>({ product, categories });
}

// useLoaderDataの型安全な利用
export default function Component() {
  const { product, categories } = useLoaderData<typeof loader>();
  // productとcategoriesは自動的に型推論される
}
```

### Error Boundary パターン

```typescript
// カスタムError Boundary
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="error-container">
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div className="error-container">
      <h1>予期しないエラーが発生しました</h1>
      <p>申し訳ありませんが、問題が発生しました。</p>
    </div>
  );
}
```

## 🔧 実装ポイント

### ルーティング戦略
- ファイルベースルーティングの活用
- ネストルーティングによるレイアウト共有
- 動的ルートでのパラメータ処理

### データフロー最適化
- 並列データフェッチによるパフォーマンス向上
- 適切な型定義による開発効率の向上
- エラーハンドリングの統一

### SEO・アクセシビリティ
- Meta関数によるSEO最適化
- セマンティックHTMLの使用
- エラー状態の適切な処理