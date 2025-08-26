# Remix データロードパターン

## 💾 Advanced Data Loading Patterns

### 並列データフェッチングパターン

```typescript
// app/routes/products.$productId.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useActionData, useNavigation, Form } from '@remix-run/react';
import { z } from 'zod';
import { getProduct, updateProduct } from '~/models/product.server';
import { requireUserId } from '~/utils/session.server';
import { badRequest, notFound } from '~/utils/request.server';

const UpdateProductSchema = z.object({
  name: z.string().min(1, '商品名は必須です'),
  description: z.string().min(10, '説明は10文字以上入力してください'),
  price: z.number().min(0, '価格は0以上である必要があります'),
  categoryId: z.string().uuid('有効なカテゴリーを選択してください'),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

interface LoaderData {
  product: Product;
  categories: Category[];
  relatedProducts: Product[];
}

interface ActionData {
  errors?: {
    name?: string;
    description?: string;
    price?: string;
    categoryId?: string;
    _form?: string;
  };
  success?: boolean;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const productId = params.productId;
  if (!productId) {
    throw notFound('Product not found');
  }

  // 並列データフェッチによるパフォーマンス最適化
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
```

### Action with Validation パターン

```typescript
export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const productId = params.productId;

  if (!productId) {
    throw notFound('Product not found');
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  // インテントベースのアクション処理
  if (intent === 'delete') {
    await deleteProduct(productId, userId);
    return redirect('/dashboard/products');
  }

  // フォームデータの取得と変換
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
    price: Number(formData.get('price')),
    categoryId: formData.get('categoryId'),
    tags: formData.getAll('tags'),
    isActive: formData.get('isActive') === 'on'
  };

  try {
    // Zodによるバリデーション
    const validatedData = UpdateProductSchema.parse(rawData);
    
    await updateProduct(productId, validatedData, userId);
    
    return json<ActionData>({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      return badRequest<ActionData>({
        errors: {
          name: errors.name?.[0],
          description: errors.description?.[0],
          price: errors.price?.[0],
          categoryId: errors.categoryId?.[0]
        }
      });
    }

    return badRequest<ActionData>({
      errors: {
        _form: '商品の更新に失敗しました。再度お試しください。'
      }
    });
  }
}
```

### Component with State Management

```typescript
export default function ProductDetail() {
  const { product, categories, relatedProducts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  // Navigation状態の管理
  const isSubmitting = navigation.state === 'submitting';
  const isDeleting = navigation.formData?.get('intent') === 'delete';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">商品ID: {product.id}</p>
        </div>
        
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-destructive"
            onClick={(e) => {
              if (!confirm('本当に削除しますか？')) {
                e.preventDefault();
              }
            }}
          >
            {isDeleting ? '削除中...' : '商品を削除'}
          </button>
        </Form>
      </div>

      {/* 成功メッセージの表示 */}
      {actionData?.success && (
        <div className="alert alert-success">
          商品が正常に更新されました。
        </div>
      )}

      {/* エラーメッセージの表示 */}
      {actionData?.errors?._form && (
        <div className="alert alert-error">
          {actionData.errors._form}
        </div>
      )}

      <ProductForm
        product={product}
        categories={categories}
        errors={actionData?.errors}
        isSubmitting={isSubmitting}
      />

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

## 🔄 Deferred Loading パターン

### 遅延データローディング

```typescript
// app/routes/dashboard._index.tsx
import { defer } from '@remix-run/node';
import { Await } from '@remix-run/react';
import { Suspense } from 'react';

interface DashboardData {
  stats: DashboardStats;
  recentOrders: Promise<Order[]>; // 遅延ローディング
  analytics: Promise<Analytics>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // 高速なデータは即座に取得
  const stats = await getDashboardStats(userId);
  
  // 時間のかかるデータは Promise として渡す
  const recentOrdersPromise = getRecentOrders(userId);
  const analyticsPromise = getAnalytics(userId);

  return defer<DashboardData>({
    stats,
    recentOrders: recentOrdersPromise,
    analytics: analyticsPromise
  });
}

export default function Dashboard() {
  const { stats, recentOrders, analytics } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      {/* 即座に表示される統計データ */}
      <StatsCards stats={stats} />

      {/* 遅延ローディングされるデータ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">最近の注文</h2>
          <Suspense fallback={<OrdersSkeleton />}>
            <Await resolve={recentOrders}>
              {(orders) => <OrdersList orders={orders} />}
            </Await>
          </Suspense>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">アナリティクス</h2>
          <Suspense fallback={<AnalyticsSkeleton />}>
            <Await resolve={analytics}>
              {(data) => <AnalyticsChart data={data} />}
            </Await>
          </Suspense>
        </section>
      </div>
    </div>
  );
}
```

## 🔍 Error Handling パターン

### Database Error Handling

```typescript
// app/models/product.server.ts
import { prisma } from '~/utils/db.server';

export async function getProduct(id: string): Promise<Product | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        tags: true,
        images: true
      }
    });

    return product;
  } catch (error) {
    console.error('Failed to fetch product:', error);
    throw serverError('商品の取得に失敗しました');
  }
}

export async function updateProduct(
  id: string, 
  data: UpdateProductData, 
  userId: string
): Promise<Product> {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
        updatedAt: new Date()
      },
      include: {
        category: true,
        tags: true
      }
    });

    return product;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw notFound('商品が見つかりません');
      }
      if (error.code === 'P2002') {
        throw badRequest({ _form: '商品名が重複しています' });
      }
    }
    
    console.error('Failed to update product:', error);
    throw serverError('商品の更新に失敗しました');
  }
}
```

## 🎯 実装ポイント

### データフェッチ戦略
- 並列処理による読み込み時間短縮
- 遅延ローディングによる初期表示の最適化
- エラー状態の適切な処理

### バリデーション統合
- Zodによる型安全なバリデーション
- フロントエンド・バックエンド共通バリデーション
- エラーメッセージの国際化対応

### 状態管理
- Navigation状態による UI フィードバック
- 楽観的UI更新の実装
- データの整合性確保