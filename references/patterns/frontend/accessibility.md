# Accessibility (A11y) 実践ガイド WCAG 2.1 AAA準拠

## セマンティックHTML実装パターン

### 1. ランドマークとドキュメント構造

```html
<!-- 正しいドキュメント構造 -->
<!DOCTYPE html>
<html lang="ja" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="ページの説明（155文字以内）">
  <title>ページタイトル | サイト名</title>
</head>
<body>
  <!-- スキップリンク（必須） -->
  <a href="#main" class="skip-link">メインコンテンツへスキップ</a>
  
  <!-- ヘッダー -->
  <header role="banner" aria-label="サイトヘッダー">
    <nav role="navigation" aria-label="メインナビゲーション">
      <ul role="list">
        <li><a href="/" aria-current="page">ホーム</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  </header>
  
  <!-- メインコンテンツ -->
  <main id="main" role="main" aria-label="メインコンテンツ">
    <article role="article" aria-labelledby="article-title">
      <h1 id="article-title">見出しレベル1（ページに1つのみ）</h1>
      
      <section aria-labelledby="section-1">
        <h2 id="section-1">セクション見出し</h2>
        <!-- 階層構造を守る（h1→h2→h3） -->
      </section>
    </article>
    
    <!-- 補助的コンテンツ -->
    <aside role="complementary" aria-label="関連情報">
      <!-- サイドバー内容 -->
    </aside>
  </main>
  
  <!-- フッター -->
  <footer role="contentinfo" aria-label="サイトフッター">
    <p>&copy; 2025 サイト名. All rights reserved.</p>
  </footer>
</body>
</html>
```

### 2. インタラクティブ要素の実装

```typescript
// components/AccessibleButton.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaDescribedby?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    children,
    variant = 'primary',
    size = 'medium',
    loading = false,
    icon,
    iconPosition = 'left',
    ariaLabel,
    ariaPressed,
    ariaExpanded,
    ariaControls,
    ariaDescribedby,
    disabled,
    onClick,
    ...props
  }, ref) => {
    // フォーカス管理
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Space と Enter でクリックをトリガー
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!disabled && !loading && onClick) {
          onClick(e as any);
        }
      }
    };
    
    return (
      <button
        ref={ref}
        type="button"
        className={`btn btn--${variant} btn--${size}`}
        disabled={disabled || loading}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        // ARIA属性
        aria-label={ariaLabel || (loading ? 'Loading...' : undefined)}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-describedby={ariaDescribedby}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        // ロール（必要に応じて）
        role={ariaPressed !== undefined ? 'switch' : 'button'}
        {...props}
      >
        {loading && (
          <span className="sr-only" aria-live="polite">
            処理中です。しばらくお待ちください。
          </span>
        )}
        {icon && iconPosition === 'left' && (
          <span aria-hidden="true">{icon}</span>
        )}
        <span>{children}</span>
        {icon && iconPosition === 'right' && (
          <span aria-hidden="true">{icon}</span>
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
```

## ARIA実装パターン

### 1. 動的コンテンツとライブリージョン

```typescript
// components/LiveRegion.tsx
import { useEffect, useRef, useState } from 'react';

type AriaLive = 'polite' | 'assertive' | 'off';
type AriaRelevant = 'additions' | 'removals' | 'text' | 'all';

interface LiveRegionProps {
  message: string;
  ariaLive?: AriaLive;
  ariaAtomic?: boolean;
  ariaRelevant?: AriaRelevant;
  clearAfter?: number; // ミリ秒
  role?: 'status' | 'alert' | 'log';
}

export function LiveRegion({
  message,
  ariaLive = 'polite',
  ariaAtomic = true,
  ariaRelevant = 'additions',
  clearAfter = 5000,
  role = 'status',
}: LiveRegionProps) {
  const [displayMessage, setDisplayMessage] = useState(message);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    setDisplayMessage(message);
    
    if (clearAfter && message) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDisplayMessage('');
      }, clearAfter);
    }
    
    return () => clearTimeout(timeoutRef.current);
  }, [message, clearAfter]);
  
  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      aria-relevant={ariaRelevant}
      className="sr-only"
    >
      {displayMessage}
    </div>
  );
}

// 通知システム
interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export function AccessibleNotification({ type, message, onClose }: NotificationProps) {
  const ariaLiveMap = {
    success: 'polite' as AriaLive,
    error: 'assertive' as AriaLive,
    warning: 'assertive' as AriaLive,
    info: 'polite' as AriaLive,
  };
  
  const roleMap = {
    success: 'status',
    error: 'alert',
    warning: 'alert',
    info: 'status',
  } as const;
  
  return (
    <div
      role={roleMap[type]}
      aria-live={ariaLiveMap[type]}
      className={`notification notification--${type}`}
    >
      <div className="notification__content">
        <span className="notification__icon" aria-hidden="true">
          {/* アイコン */}
        </span>
        <p className="notification__message">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="通知を閉じる"
          className="notification__close"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
```

### 2. 複雑なUIパターン

```typescript
// components/AccessibleModal.tsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  closeOnEsc?: boolean;
  closeOnOverlayClick?: boolean;
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closeOnEsc = true,
  closeOnOverlayClick = true,
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [modalId] = useState(() => `modal-${Math.random().toString(36).substr(2, 9)}`);
  
  // フォーカストラップ
  const getFocusableElements = () => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];
  };
  
  const handleTabKey = (e: KeyboardEvent) => {
    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (!e.shiftKey && document.activeElement === lastElement) {
      firstElement?.focus();
      e.preventDefault();
    }
    
    if (e.shiftKey && document.activeElement === firstElement) {
      lastElement?.focus();
      e.preventDefault();
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      handleTabKey(e);
    }
    
    if (e.key === 'Escape' && closeOnEsc) {
      onClose();
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      // 現在のフォーカス要素を保存
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // モーダルにフォーカスを移動
      setTimeout(() => {
        const firstFocusable = getFocusableElements()[0];
        firstFocusable?.focus();
      }, 100);
      
      // イベントリスナー追加
      document.addEventListener('keydown', handleKeyDown);
      
      // スクロールロック
      document.body.style.overflow = 'hidden';
      
      // スクリーンリーダー用のaria-hidden設定
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.setAttribute('aria-hidden', 'true');
      }
    } else {
      // フォーカスを元に戻す
      previousActiveElement.current?.focus();
      
      // クリーンアップ
      document.body.style.overflow = '';
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.removeAttribute('aria-hidden');
      }
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return createPortal(
    <div
      className="modal-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        aria-describedby={`${modalId}-description`}
        className={`modal modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id={`${modalId}-title`} className="modal__title">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="モーダルを閉じる"
            className="modal__close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        
        <div id={`${modalId}-description`} className="modal__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

## フォーム実装

### アクセシブルなフォームコンポーネント

```typescript
// components/AccessibleForm.tsx
import { useState, useId } from 'react';

interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date';
  required?: boolean;
  error?: string;
  helpText?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function AccessibleFormField({
  label,
  type = 'text',
  required = false,
  error,
  helpText,
  autoComplete,
  placeholder,
  value,
  onChange,
}: FormFieldProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
  
  const ariaDescribedby = [
    error && errorId,
    helpText && helpId,
  ].filter(Boolean).join(' ') || undefined;
  
  return (
    <div className="form-field">
      <label htmlFor={fieldId} className="form-field__label">
        {label}
        {required && (
          <span className="form-field__required" aria-label="必須">
            *
          </span>
        )}
      </label>
      
      <input
        id={fieldId}
        type={type}
        className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={ariaDescribedby}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      
      {helpText && (
        <p id={helpId} className="form-field__help">
          {helpText}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="form-field__error" role="alert">
          <span className="sr-only">エラー:</span> {error}
        </p>
      )}
    </div>
  );
}

// 複雑なフォームバリデーション
export function AccessibleForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const validate = (field: string, value: string) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'name':
        if (!value) {
          newErrors.name = '名前は必須です';
        } else if (value.length < 2) {
          newErrors.name = '名前は2文字以上で入力してください';
        } else {
          delete newErrors.name;
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) {
          newErrors.email = 'メールアドレスは必須です';
        } else if (!emailRegex.test(value)) {
          newErrors.email = '有効なメールアドレスを入力してください';
        } else {
          delete newErrors.email;
        }
        break;
        
      case 'password':
        if (!value) {
          newErrors.password = 'パスワードは必須です';
        } else if (value.length < 8) {
          newErrors.password = 'パスワードは8文字以上で入力してください';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          newErrors.password = 'パスワードは大文字、小文字、数字を含む必要があります';
        } else {
          delete newErrors.password;
        }
        break;
    }
    
    setErrors(newErrors);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // すべてのフィールドをタッチ済みにする
    const allTouched = Object.keys(formData).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);
    
    // バリデーション実行
    Object.entries(formData).forEach(([field, value]) => {
      validate(field, value);
    });
    
    if (Object.keys(errors).length === 0) {
      // 送信処理
      console.log('Form submitted:', formData);
    } else {
      // エラーアナウンス
      const errorCount = Object.keys(errors).length;
      const announcement = `フォームに${errorCount}個のエラーがあります。修正してください。`;
      
      // スクリーンリーダー用アナウンス
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'alert');
      liveRegion.setAttribute('aria-live', 'assertive');
      liveRegion.className = 'sr-only';
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);
      
      setTimeout(() => {
        document.body.removeChild(liveRegion);
      }, 3000);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="ユーザー登録フォーム">
      <AccessibleFormField
        label="名前"
        required
        value={formData.name}
        onChange={(value) => {
          setFormData({ ...formData, name: value });
          if (touched.name) validate('name', value);
        }}
        error={touched.name ? errors.name : undefined}
        autoComplete="name"
      />
      
      <AccessibleFormField
        label="メールアドレス"
        type="email"
        required
        value={formData.email}
        onChange={(value) => {
          setFormData({ ...formData, email: value });
          if (touched.email) validate('email', value);
        }}
        error={touched.email ? errors.email : undefined}
        autoComplete="email"
      />
      
      <AccessibleFormField
        label="パスワード"
        type="password"
        required
        value={formData.password}
        onChange={(value) => {
          setFormData({ ...formData, password: value });
          if (touched.password) validate('password', value);
        }}
        error={touched.password ? errors.password : undefined}
        helpText="8文字以上で、大文字・小文字・数字を含めてください"
        autoComplete="new-password"
      />
      
      <button type="submit" className="btn btn--primary">
        登録する
      </button>
    </form>
  );
}
```

## キーボードナビゲーション

```typescript
// hooks/useKeyboardNavigation.ts
import { useEffect, useRef } from 'react';

interface UseKeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: (e: KeyboardEvent) => void;
  onHome?: () => void;
  onEnd?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions) {
  const { enabled = true, ...handlers } = options;
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyHandlers: Record<string, (() => void) | ((e: KeyboardEvent) => void) | undefined> = {
        'Escape': handlers.onEscape,
        'Enter': handlers.onEnter,
        'ArrowUp': handlers.onArrowUp,
        'ArrowDown': handlers.onArrowDown,
        'ArrowLeft': handlers.onArrowLeft,
        'ArrowRight': handlers.onArrowRight,
        'Tab': handlers.onTab,
        'Home': handlers.onHome,
        'End': handlers.onEnd,
      };
      
      const handler = keyHandlers[e.key];
      if (handler) {
        if (e.key === 'Tab' && handlers.onTab) {
          handlers.onTab(e);
        } else if (typeof handler === 'function') {
          e.preventDefault();
          handler();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handlers]);
}
```

## ベストプラクティス

1. **セマンティックHTML**: 適切な要素とランドマークの使用
2. **ARIA属性**: 必要最小限で適切に使用
3. **キーボード操作**: すべての機能をキーボードで操作可能に
4. **フォーカス管理**: 明確なフォーカス表示とトラップ
5. **ライブリージョン**: 動的更新の適切なアナウンス
6. **色コントラスト**: WCAG AAA基準（7:1以上）
7. **エラー処理**: 明確で実用的なエラーメッセージ