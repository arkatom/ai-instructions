# Remix 認証パターン

## 🔐 Session-based Authentication

### セッション管理システム

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

// セッション作成とリダイレクト
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

// セッション取得
export async function getUserSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

// ユーザーID取得
export async function getUserId(request: Request): Promise<string | null> {
  const session = await getUserSession(request);
  const userId = session.get('userId');
  return typeof userId === 'string' ? userId : null;
}

// ユーザー情報取得
export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  try {
    return await getUserById(userId);
  } catch {
    throw await logout(request);
  }
}

// 認証必須ガード
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

// ログアウト処理
export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session)
    }
  });
}

// ログイン認証
export async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) return null;

  return { id: user.id, email: user.email };
}
```

### レート制限システム

```typescript
// Rate limiting for authentication
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts || now > attempts.resetTime) {
    loginAttempts.set(identifier, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15分
    return true;
  }

  if (attempts.count >= 5) {
    return false; // レート制限
  }

  attempts.count++;
  return true;
}

export function clearRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}
```

## 🔑 ログインページ実装

```typescript
// app/routes/login.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useSearchParams } from '@remix-run/react';
import { verifyLogin, createUserSession, getUserId, checkRateLimit, clearRateLimit } from '~/utils/session.server';

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

  // バリデーション
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

  // レート制限チェック
  const clientIP = request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
  
  if (!checkRateLimit(`login:${clientIP}:${email}`)) {
    return json<ActionData>({
      errors: { _form: 'ログイン試行回数が上限に達しました。15分後に再度お試しください。' }
    }, { status: 429 });
  }

  // 認証情報確認
  const user = await verifyLogin(email, password);
  if (!user) {
    return json<ActionData>({
      errors: { _form: 'メールアドレスまたはパスワードが正しくありません' }
    }, { status: 400 });
  }

  // 成功時はレート制限をクリア
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

## 🛡️ ユーザー登録パターン

```typescript
// app/routes/register.tsx
import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData, Link } from '@remix-run/react';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail } from '~/models/user.server';
import { createUserSession } from '~/utils/session.server';
import { z } from 'zod';

const RegisterSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"]
});

interface ActionData {
  errors?: {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    _form?: string;
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  };

  try {
    const validatedData = RegisterSchema.parse(rawData);
    
    // 既存ユーザーチェック
    const existingUser = await getUserByEmail(validatedData.email);
    if (existingUser) {
      return json<ActionData>({
        errors: { email: 'このメールアドレスは既に使用されています' }
      }, { status: 400 });
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(validatedData.password, 12);
    
    // ユーザー作成
    const user = await createUser({
      name: validatedData.name,
      email: validatedData.email,
      passwordHash
    });

    // セッション作成とリダイレクト
    return createUserSession(user.id, '/dashboard');

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      return json<ActionData>({
        errors: {
          name: errors.name?.[0],
          email: errors.email?.[0],
          password: errors.password?.[0],
          confirmPassword: errors.confirmPassword?.[0]
        }
      }, { status: 400 });
    }

    return json<ActionData>({
      errors: { _form: 'アカウントの作成に失敗しました。再度お試しください。' }
    }, { status: 500 });
  }
}

export default function Register() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">新規登録</h2>
          <p className="mt-2 text-gray-600">アカウントを作成してください</p>
        </div>

        <Form method="post" className="space-y-6">
          {actionData?.errors?._form && (
            <div className="alert alert-error">
              {actionData.errors._form}
            </div>
          )}

          <div>
            <label htmlFor="name" className="form-label">
              お名前
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className={`form-input ${actionData?.errors?.name ? 'border-red-500' : ''}`}
            />
            {actionData?.errors?.name && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
            )}
          </div>

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
            />
            {actionData?.errors?.email && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
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
            />
            {actionData?.errors?.password && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="form-label">
              パスワード確認
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              className={`form-input ${actionData?.errors?.confirmPassword ? 'border-red-500' : ''}`}
            />
            {actionData?.errors?.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full">
            アカウントを作成
          </button>

          <div className="text-center">
            <span className="text-gray-600">既にアカウントをお持ちの方は </span>
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              ログイン
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
```

## 🔒 権限管理パターン

### Role-based Access Control

```typescript
// app/utils/permissions.server.ts
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

export enum Permission {
  READ_USERS = 'read:users',
  WRITE_USERS = 'write:users',
  DELETE_USERS = 'delete:users',
  READ_PRODUCTS = 'read:products',
  WRITE_PRODUCTS = 'write:products',
  DELETE_PRODUCTS = 'delete:products'
}

const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.READ_USERS,
    Permission.WRITE_USERS,
    Permission.DELETE_USERS,
    Permission.READ_PRODUCTS,
    Permission.WRITE_PRODUCTS,
    Permission.DELETE_PRODUCTS
  ],
  [UserRole.EDITOR]: [
    Permission.READ_USERS,
    Permission.READ_PRODUCTS,
    Permission.WRITE_PRODUCTS
  ],
  [UserRole.VIEWER]: [
    Permission.READ_PRODUCTS
  ]
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole].includes(permission);
}

export async function requirePermission(
  request: Request,
  permission: Permission
) {
  const user = await requireUser(request);
  
  if (!hasPermission(user.role as UserRole, permission)) {
    throw new Response('Forbidden', { status: 403 });
  }
  
  return user;
}
```

## 🎯 実装ポイント

### セキュリティベストプラクティス
- セッション管理の適切な実装
- パスワードの安全なハッシュ化
- レート制限による総当たり攻撃対策
- CSRF対策の実装

### ユーザーエクスペリエンス
- 明確なエラーメッセージ
- ログイン状態の維持
- 適切なリダイレクト処理
- パスワードリセット機能

### スケーラビリティ
- 権限ベースのアクセス制御
- 監査ログの実装
- セッション管理の最適化