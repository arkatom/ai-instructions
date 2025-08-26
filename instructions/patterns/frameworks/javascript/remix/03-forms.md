# Remix フォームパターン

## 📝 Progressive Enhancement Forms

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
    _form?: string;
  };
  success?: boolean;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  // セキュリティチェック
  try {
    checkHoneypot(formData); // ボット対策
    await validateCSRF(formData, request.headers); // CSRF対策
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
    
    // メール送信
    await sendContactEmail(validatedData);
    
    return redirect('/contact/success');
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      return json<ActionData>({
        errors: {
          name: errors.name?.[0],
          email: errors.email?.[0],
          subject: errors.subject?.[0],
          message: errors.message?.[0]
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
```

### Client-side Enhancement

```typescript
export default function Contact() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [formId] = useState(() => Math.random().toString(36));

  const isSubmitting = navigation.state === 'submitting';

  // クライアントサイドバリデーション
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
            />
            {(actionData?.errors?.name || clientErrors.name) && (
              <p className="text-red-500 text-sm mt-1">
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
            />
            {(actionData?.errors?.email || clientErrors.email) && (
              <p className="text-red-500 text-sm mt-1">
                {actionData?.errors?.email || clientErrors.email}
              </p>
            )}
          </div>
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
              actionData?.errors?.subject ? 'border-red-500' : ''
            }`}
            disabled={isSubmitting}
          />
          {actionData?.errors?.subject && (
            <p className="text-red-500 text-sm mt-1">
              {actionData.errors.subject}
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
          />
          {(actionData?.errors?.message || clientErrors.message) && (
            <p className="text-red-500 text-sm mt-1">
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
            {isSubmitting ? '送信中...' : '送信する'}
          </button>
        </div>
      </Form>
    </div>
  );
}
```

## 🔐 セキュリティパターン

### CSRF Protection

```typescript
// app/utils/csrf.server.ts
import { createCookie } from '@remix-run/node';
import crypto from 'crypto';

const csrfCookie = createCookie('__csrf', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 // 24 hours
});

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function validateCSRF(formData: FormData, headers: Headers): Promise<void> {
  const token = formData.get('_csrf');
  const cookieHeader = headers.get('Cookie');
  const cookieToken = await csrfCookie.parse(cookieHeader);

  if (!token || !cookieToken || token !== cookieToken) {
    throw new Error('Invalid CSRF token');
  }
}
```

### Honeypot Protection

```typescript
// app/utils/honeypot.server.ts
export const honeypot = {
  getInputProps() {
    return {
      name: 'website',
      tabIndex: -1,
      autoComplete: 'off',
      style: {
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        opacity: 0,
        pointerEvents: 'none'
      } as React.CSSProperties
    };
  }
};

export function checkHoneypot(formData: FormData): void {
  const honeypotValue = formData.get('website');
  if (honeypotValue) {
    throw new Error('Bot detected');
  }
}
```

## 💡 実装ポイント

### Progressive Enhancement
- JavaScript無効時でも動作する基本フォーム
- クライアントサイド拡張による UX 向上
- 段階的なバリデーション実装

### セキュリティ対策
- CSRF トークンによるリクエスト保護
- Honeypot によるボット対策
- 適切な入力サニタイゼーション

### ユーザビリティ
- リアルタイムバリデーション
- 明確なエラーメッセージ
- アクセシビリティ対応 (ARIA属性)