# Remix Full-Stack パターン

Web標準に基づくモダンなフルスタック開発のためのRemix実装パターン集。パフォーマンスとユーザーエクスペリエンスを両立するアプリケーション構築手法。

## 🚀 基本アーキテクチャパターン

### Nested Routing with Loaders

```typescript
// app/root.tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  LiveReload,
  useLoaderData,
  useCatch
} from '@remix-run/react';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getUser } from '~/utils/session.server';
import { GlobalErrorBoundary } from '~/components/ErrorBoundary';
import { Navigation } from '~/components/Navigation';
import { Toaster } from '~/components/Toaster';

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

// app/routes/dashboard.tsx - Layout Route
import type { LoaderFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/session.server';
import { Outlet } from '@remix-run/react';
import { DashboardSidebar } from '~/components/DashboardSidebar';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <div className="flex-1 p-8">
        <Outlet />
      </div>
    </div>
  );
}

// app/routes/dashboard._index.tsx - Index Route
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireUserId } from '~/utils/session.server';
import { getDashboardStats } from '~/models/analytics.server';
import { DashboardStats } from '~/components/DashboardStats';
import { RecentActivity } from '~/components/RecentActivity';

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

### Advanced Data Loading Patterns

```typescript
// app/routes/products.$productId.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useActionData, useNavigation, Form } from '@remix-run/react';
import { z } from 'zod';
import { getProduct, updateProduct } from '~/models/product.server';
import { requireUserId } from '~/utils/session.server';
import { ProductForm } from '~/components/ProductForm';
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

  // Parallel data fetching for performance
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

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const productId = params.productId;

  if (!productId) {
    throw notFound('Product not found');
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    await deleteProduct(productId, userId);
    return redirect('/dashboard/products');
  }

  // Validate form data
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
    price: Number(formData.get('price')),
    categoryId: formData.get('categoryId'),
    tags: formData.getAll('tags'),
    isActive: formData.get('isActive') === 'on'
  };

  try {
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

export default function ProductDetail() {
  const { product, categories, relatedProducts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

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

      {actionData?.success && (
        <div className="alert alert-success">
          商品が正常に更新されました。
        </div>
      )}

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

// Meta function for SEO
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
```

## 🔄 Progressive Enhancement Forms

### Advanced Form Handling

```typescript
// app/routes/contact.tsx
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { sendContactEmail } from '~/utils/email.server';
import { honeypot, checkHoneypot } from '~/utils/honeypot.server';
import { validateCSRF } from '~/utils/csrf.server';

const ContactSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  subject: z.string().min(1, '件名を入力してください'),
  message: z.string().min(10, 'メッセージは10文字以上入力してください'),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
});

interface ActionData {
  errors?: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    priority?: string;
    _form?: string;
  };
  success?: boolean;
  formId?: string;
}

export const meta: MetaFunction = () => [
  { title: 'お問い合わせ | Contact Us' },
  { name: 'description', content: 'お気軽にお問い合わせください' }
];

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // Security checks
  try {
    checkHoneypot(formData);
    await validateCSRF(formData, request.headers);
  } catch (error) {
    return json<ActionData>({
      errors: { _form: 'セキュリティエラーが発生しました。' }
    }, { status: 400 });
  }

  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    priority: formData.get('priority') || 'medium'
  };

  try {
    const validatedData = ContactSchema.parse(rawData);
    
    // Send email
    await sendContactEmail(validatedData);
    
    // Log the contact for analytics
    await logContactSubmission(validatedData);
    
    return redirect('/contact/success');
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      return json<ActionData>({
        errors: {
          name: errors.name?.[0],
          email: errors.email?.[0],
          subject: errors.subject?.[0],
          message: errors.message?.[0],
          priority: errors.priority?.[0]
        }
      }, { status: 400 });
    }

    return json<ActionData>({
      errors: {
        _form: 'お問い合わせの送信に失敗しました。再度お試しください。'
      }
    }, { status: 500 });
  }
}

export default function Contact() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [formId] = useState(() => Math.random().toString(36));

  const isSubmitting = navigation.state === 'submitting';

  // Client-side validation enhancement
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string) => {
    const errors: Record<string, string> = {};
    
    switch (name) {
      case 'name':
        if (!value.trim()) errors.name = '名前を入力してください';
        break;
      case 'email':
        if (!value.trim()) {
          errors.email = 'メールアドレスを入力してください';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.email = '有効なメールアドレスを入力してください';
        }
        break;
      case 'subject':
        if (!value.trim()) errors.subject = '件名を入力してください';
        break;
      case 'message':
        if (!value.trim()) {
          errors.message = 'メッセージを入力してください';
        } else if (value.length < 10) {
          errors.message = 'メッセージは10文字以上入力してください';
        }
        break;
    }

    setClientErrors(prev => ({ ...prev, ...errors }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    validateField(e.target.name, e.target.value);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">お問い合わせ</h1>
        <p className="text-muted-foreground">
          ご質問やご要望がございましたら、お気軽にお問い合わせください。
        </p>
      </div>

      {actionData?.errors?._form && (
        <div className="alert alert-error mb-6">
          {actionData.errors._form}
        </div>
      )}

      <Form method="post" className="space-y-6" noValidate>
        {honeypot.getInputProps()}
        <input type="hidden" name="formId" value={formId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="form-label">
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className={`form-input ${
                (actionData?.errors?.name || clientErrors.name) ? 'border-red-500' : ''
              }`}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-describedby={
                (actionData?.errors?.name || clientErrors.name) ? 'name-error' : undefined
              }
            />
            {(actionData?.errors?.name || clientErrors.name) && (
              <p id="name-error" className="text-red-500 text-sm mt-1">
                {actionData?.errors?.name || clientErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="form-label">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-input ${
                (actionData?.errors?.email || clientErrors.email) ? 'border-red-500' : ''
              }`}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-describedby={
                (actionData?.errors?.email || clientErrors.email) ? 'email-error' : undefined
              }
            />
            {(actionData?.errors?.email || clientErrors.email) && (
              <p id="email-error" className="text-red-500 text-sm mt-1">
                {actionData?.errors?.email || clientErrors.email}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="priority" className="form-label">
            優先度
          </label>
          <select
            id="priority"
            name="priority"
            className="form-select"
            disabled={isSubmitting}
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="form-label">
            件名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            className={`form-input ${
              (actionData?.errors?.subject || clientErrors.subject) ? 'border-red-500' : ''
            }`}
            onBlur={handleBlur}
            disabled={isSubmitting}
            aria-describedby={
              (actionData?.errors?.subject || clientErrors.subject) ? 'subject-error' : undefined
            }
          />
          {(actionData?.errors?.subject || clientErrors.subject) && (
            <p id="subject-error" className="text-red-500 text-sm mt-1">
              {actionData?.errors?.subject || clientErrors.subject}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="message" className="form-label">
            メッセージ <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            className={`form-textarea ${
              (actionData?.errors?.message || clientErrors.message) ? 'border-red-500' : ''
            }`}
            onBlur={handleBlur}
            disabled={isSubmitting}
            aria-describedby={
              (actionData?.errors?.message || clientErrors.message) ? 'message-error' : undefined
            }
          />
          {(actionData?.errors?.message || clientErrors.message) && (
            <p id="message-error" className="text-red-500 text-sm mt-1">
              {actionData?.errors?.message || clientErrors.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="text-red-500">*</span> は必須項目です
          </p>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                送信中...
              </>
            ) : (
              '送信する'
            )}
          </button>
        </div>
      </Form>
    </div>
  );
}
```

## 🔐 認証・セッション管理

### Session-based Authentication

```typescript
// app/utils/session.server.ts
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import bcrypt from 'bcryptjs';
import { getUserById, getUserByEmail } from '~/models/user.server';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === 'production'
  }
});

export async function createUserSession(
  userId: string,
  redirectTo: string = '/dashboard'
) {
  const session = await sessionStorage.getSession();
  session.set('userId', userId);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session)
    }
  });
}

export async function getUserSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getUserSession(request);
  const userId = session.get('userId');
  return typeof userId === 'string' ? userId : null;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  try {
    return await getUserById(userId);
  } catch {
    throw await logout(request);
  }
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) {
    throw await logout(request);
  }
  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session)
    }
  });
}

export async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) return null;

  return { id: user.id, email: user.email };
}

// Rate limiting for authentication
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts || now > attempts.resetTime) {
    loginAttempts.set(identifier, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minutes
    return true;
  }

  if (attempts.count >= 5) {
    return false; // Rate limited
  }

  attempts.count++;
  return true;
}

export function clearRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}

// app/routes/login.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useSearchParams } from '@remix-run/react';
import { verifyLogin, createUserSession, getUserId, checkRateLimit } from '~/utils/session.server';

interface ActionData {
  errors?: {
    email?: string;
    password?: string;
    _form?: string;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect('/dashboard');
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const redirectTo = formData.get('redirectTo') || '/dashboard';

  // Validation
  if (typeof email !== 'string' || !email.includes('@')) {
    return json<ActionData>({
      errors: { email: '有効なメールアドレスを入力してください' }
    }, { status: 400 });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return json<ActionData>({
      errors: { password: 'パスワードは6文字以上である必要があります' }
    }, { status: 400 });
  }

  // Rate limiting
  const clientIP = request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
  
  if (!checkRateLimit(`login:${clientIP}:${email}`)) {
    return json<ActionData>({
      errors: { _form: 'ログイン試行回数が上限に達しました。15分後に再度お試しください。' }
    }, { status: 429 });
  }

  // Verify credentials
  const user = await verifyLogin(email, password);
  if (!user) {
    return json<ActionData>({
      errors: { _form: 'メールアドレスまたはパスワードが正しくありません' }
    }, { status: 400 });
  }

  // Clear rate limit on successful login
  clearRateLimit(`login:${clientIP}:${email}`);

  return createUserSession(user.id, typeof redirectTo === 'string' ? redirectTo : '/dashboard');
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">ログイン</h2>
          <p className="mt-2 text-gray-600">アカウントにサインインしてください</p>
        </div>

        <Form method="post" className="space-y-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          
          {actionData?.errors?._form && (
            <div className="alert alert-error">
              {actionData.errors._form}
            </div>
          )}

          <div>
            <label htmlFor="email" className="form-label">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className={`form-input ${actionData?.errors?.email ? 'border-red-500' : ''}`}
              aria-describedby={actionData?.errors?.email ? 'email-error' : undefined}
            />
            {actionData?.errors?.email && (
              <p id="email-error" className="text-red-500 text-sm mt-1">
                {actionData.errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              className={`form-input ${actionData?.errors?.password ? 'border-red-500' : ''}`}
              aria-describedby={actionData?.errors?.password ? 'password-error' : undefined}
            />
            {actionData?.errors?.password && (
              <p id="password-error" className="text-red-500 text-sm mt-1">
                {actionData.errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-500">
              パスワードを忘れた方
            </Link>
          </div>

          <button type="submit" className="btn-primary w-full">
            ログイン
          </button>

          <div className="text-center">
            <span className="text-gray-600">アカウントをお持ちでない方は </span>
            <Link to="/register" className="text-blue-600 hover:text-blue-500">
              新規登録
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
```

## 🎨 スタイリングとUI

### Tailwind CSS Integration

```typescript
// app/components/ui/Button.tsx
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils/class-names';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="w-4 h-4 mr-2 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

// app/components/ui/Form.tsx
import { useField } from 'remix-validated-form';
import { cn } from '~/utils/class-names';

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  required?: boolean;
  description?: string;
  className?: string;
}

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  description,
  className
}: FormFieldProps) {
  const { error, getInputProps } = useField(name);

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <input
        {...getInputProps({
          type,
          id: name,
          placeholder,
          className: cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus-visible:ring-red-500'
          )
        })}
      />
      
      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

// Theme switching
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">テーマを切り替え</span>
    </Button>
  );
}
```

## 🧪 テスト戦略

### Comprehensive Testing

```typescript
// test/utils/test-helpers.ts
import { createRemixStub } from '@remix-run/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock server setup
export const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test utilities
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

// Integration test
describe('Product Management Flow', () => {
  test('complete product lifecycle', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    server.use(
      rest.post('/api/products', (req, res, ctx) => {
        return res(ctx.json({ id: '3', ...req.body }));
      }),
      rest.put('/api/products/3', (req, res, ctx) => {
        return res(ctx.json({ id: '3', ...req.body }));
      }),
      rest.delete('/api/products/3', (req, res, ctx) => {
        return res(ctx.status(204));
      })
    );

    // Navigate to create product
    renderWithRemix(<App />, {
      initialEntries: ['/products/new']
    });

    // Fill out form
    await user.type(screen.getByLabelText('商品名'), 'New Product');
    await user.type(screen.getByLabelText('説明'), 'New product description');
    await user.type(screen.getByLabelText('価格'), '1500');

    // Submit form
    await user.click(screen.getByText('商品を作成'));

    // Verify navigation to product detail
    await waitFor(() => {
      expect(screen.getByText('New Product')).toBeInTheDocument();
    });

    // Edit product
    await user.click(screen.getByText('編集'));
    await user.clear(screen.getByLabelText('商品名'));
    await user.type(screen.getByLabelText('商品名'), 'Updated Product');
    await user.click(screen.getByText('更新'));

    // Verify update
    await waitFor(() => {
      expect(screen.getByText('Updated Product')).toBeInTheDocument();
    });

    // Delete product
    await user.click(screen.getByText('削除'));
    await user.click(screen.getByText('確認'));

    // Verify navigation back to products list
    await waitFor(() => {
      expect(screen.getByText('商品一覧')).toBeInTheDocument();
    });
  });
});
```

## 🚀 パフォーマンス最適化

### Resource Optimization

```typescript
// app/routes/products._index.tsx
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link, useFetcher } from '@remix-run/react';
import { defer } from '@remix-run/node';
import { Await } from '@remix-run/react';
import { Suspense } from 'react';
import { getProducts, getFeaturedProducts } from '~/models/product.server';
import { ProductCard } from '~/components/ProductCard';
import { ProductSkeleton } from '~/components/ProductSkeleton';

interface LoaderData {
  products: Product[];
  featuredProducts: Promise<Product[]>;
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = 20;
  const search = url.searchParams.get('search') || '';

  // Fast: Get immediate products
  const productsPromise = getProducts({
    page,
    limit,
    search
  });

  // Slow: Featured products (deferred)
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

  // Infinite scroll implementation
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

      {/* Featured Products - Deferred */}
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

      {/* Regular Products */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          
          {/* Fetcher results for infinite scroll */}
          {fetcher.data?.products?.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Load More Button */}
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

// Resource preloading
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
  }
];

// app/utils/cache.server.ts
import { LRUCache } from 'lru-cache';
import { remember } from '@epic-web/remember';

// In-memory cache for frequently accessed data
const cache = remember('app-cache', () => 
  new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 5 // 5 minutes
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

// Cached loader helper
export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300000 // 5 minutes
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

このRemix Full-Stackパターン集は、Web標準に基づく最新のフルスタック開発手法を提供します。Progressive Enhancement、型安全性、パフォーマンス最適化を重視し、実際のプロダクション環境で使用可能な高品質なパターンを包含しています。