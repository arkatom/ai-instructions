# CSS Modules 実践ガイド

## 基本設定と型安全性

### Next.js 14+ での設定

```typescript
// next.config.js
const nextConfig = {
  // CSS Modules の自動型生成を有効化
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.module\.(css|scss)$/,
      use: [
        {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: process.env.NODE_ENV === 'production'
                ? '[hash:base64:8]' // 本番環境: 短縮化
                : '[path][name]__[local]--[hash:base64:5]', // 開発環境: デバッグ可能
              exportLocalsConvention: 'camelCase',
            },
          },
        },
      ],
    });
    return config;
  },
};
```

### TypeScript 型定義の自動生成

```typescript
// typed-css-modules.config.js
module.exports = {
  pattern: 'src/**/*.module.{css,scss}',
  watch: true,
  camelCase: true,
  exportType: 'default',
  nameFormat: '[name]__[local]--[hash:base64:5]',
};

// package.json scripts
{
  "scripts": {
    "css-types": "typed-css-modules -p 'src/**/*.module.{css,scss}' -w",
    "dev": "concurrently \"next dev\" \"npm run css-types\""
  }
}
```

## 高度なパターンと実装

### 1. 動的スタイリングとテーマ統合

```typescript
// styles/Button.module.css
.button {
  /* CSS変数を活用したテーマ対応 */
  background-color: var(--button-bg, #007bff);
  color: var(--button-color, white);
  padding: var(--button-padding, 8px 16px);
  border-radius: var(--button-radius, 4px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* 状態管理のためのデータ属性セレクタ */
  &[data-variant="primary"] {
    --button-bg: var(--color-primary);
  }
  
  &[data-variant="danger"] {
    --button-bg: var(--color-danger);
  }
  
  &[data-size="small"] {
    --button-padding: 4px 8px;
    font-size: 0.875rem;
  }
  
  &[data-loading="true"] {
    pointer-events: none;
    opacity: 0.7;
    
    &::after {
      content: "";
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.6s linear infinite;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Composition API を活用した複数クラスの組み合わせ */
.button.primary {
  composes: button;
  composes: primary from "./themes.module.css";
}

/* パフォーマンス最適化: will-change の適切な使用 */
.button:hover {
  will-change: transform, background-color;
  transform: translateY(-1px);
}

.button:active {
  will-change: auto; /* 終了後にリセット */
  transform: translateY(0);
}
```

### 2. TypeScript統合とユーティリティ関数

```typescript
// utils/cssModules.ts
import { clsx, type ClassValue } from 'clsx';

/**
 * CSS Modules のクラス名を安全に結合
 * 条件付きクラス、動的クラス、未定義値の処理を統一
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * CSS Modules の型安全なバリアント生成
 */
export function createStyleVariants<T extends Record<string, string>>(
  styles: T,
  variants: Record<string, Record<string, string>>
) {
  return (variant: keyof typeof variants, condition = true) => {
    if (!condition) return '';
    return variants[variant as string]
      ?.split(' ')
      .map(className => styles[className] || className)
      .join(' ') || '';
  };
}

// 使用例
// components/Button.tsx
import styles from './Button.module.css';
import { cn, createStyleVariants } from '@/utils/cssModules';

const styleVariants = createStyleVariants(styles, {
  primary: 'button primary',
  secondary: 'button secondary',
  danger: 'button danger',
});

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  className?: string;
}

export function Button({ 
  variant = 'primary', 
  size = 'medium',
  loading = false,
  className,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        styles.button,
        styleVariants(variant),
        className
      )}
      data-variant={variant}
      data-size={size}
      data-loading={loading}
      disabled={loading}
      {...props}
    />
  );
}
```

### 3. SSR/SSG 最適化とクリティカルCSS

```typescript
// utils/criticalCss.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * クリティカルCSSの抽出と最適化
 * ビルド時に実行し、初期レンダリングのパフォーマンスを向上
 */
export function extractCriticalCss(moduleFiles: string[]) {
  const critical = new Set<string>();
  
  moduleFiles.forEach(file => {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8');
    // ファーストビューに必要なセレクタのみ抽出
    const criticalSelectors = content.match(
      /\.(button|header|nav|hero|container)[^{]*{[^}]*}/g
    );
    
    if (criticalSelectors) {
      criticalSelectors.forEach(selector => critical.add(selector));
    }
  });
  
  return Array.from(critical).join('\n');
}

// pages/_document.tsx での使用
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const criticalCss = process.env.NODE_ENV === 'production' 
    ? extractCriticalCss(['styles/*.module.css'])
    : '';
    
  return (
    <Html>
      <Head>
        {criticalCss && (
          <style 
            dangerouslySetInnerHTML={{ __html: criticalCss }}
            data-critical="true"
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

## パフォーマンス最適化

### 1. バンドルサイズの削減

```javascript
// webpack.config.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              // 未使用のCSS変数を削除
              discardUnused: { fontFace: false },
              // 重複ルールをマージ
              mergeRules: true,
              // セレクタの最適化
              normalizeWhitespace: true,
            },
          ],
        },
      }),
    ],
    // CSS Modules のツリーシェイキング
    sideEffects: false,
  },
  module: {
    rules: [
      {
        test: /\.module\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                // 本番環境では短いクラス名を生成
                localIdentName: '[hash:base64:5]',
                // 未使用のエクスポートを削除
                exportOnlyLocals: false,
              },
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['postcss-preset-env', { stage: 3 }],
                  ['postcss-sort-media-queries'],
                  ['postcss-combine-duplicated-selectors'],
                ],
              },
            },
          },
        ],
      },
    ],
  },
};
```

### 2. ランタイムパフォーマンス

```typescript
// hooks/useLazyStyles.ts
import { useEffect, useState } from 'react';

/**
 * CSS Modules の遅延読み込み
 * 大規模なスタイルシートを必要時にのみロード
 */
export function useLazyStyles(
  importFn: () => Promise<{ default: Record<string, string> }>
) {
  const [styles, setStyles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let cancelled = false;
    
    importFn().then(module => {
      if (!cancelled) {
        setStyles(module.default);
        setLoading(false);
      }
    });
    
    return () => { cancelled = true; };
  }, []);
  
  return { styles, loading };
}

// 使用例
function HeavyComponent() {
  const { styles, loading } = useLazyStyles(
    () => import('./HeavyComponent.module.css')
  );
  
  if (loading) return <Skeleton />;
  
  return <div className={styles.container}>...</div>;
}
```

## トラブルシューティング

### 1. 本番環境でのクラス名不一致

```typescript
// 問題: 開発環境と本番環境でクラス名が異なる
// 解決策: 一貫したハッシュ生成設定

// css-loader.config.js
const getLocalIdent = (context, localIdentName, localName) => {
  const hash = crypto
    .createHash('md5')
    .update(context.resourcePath + localName)
    .digest('base64')
    .slice(0, 5);
    
  return `${localName}_${hash}`;
};

module.exports = {
  modules: {
    getLocalIdent, // カスタム関数で一貫性を保証
  },
};
```

### 2. Hydration エラーの回避

```typescript
// 問題: SSR/CSR でのクラス名不一致
// 解決策: isomorphic な実装

import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphic';

function DynamicStyledComponent() {
  const [mounted, setMounted] = useState(false);
  
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);
  
  // クライアントサイドのみのスタイル適用
  const dynamicClass = mounted ? styles.clientOnly : '';
  
  return <div className={cn(styles.base, dynamicClass)} />;
}
```

### 3. CSS Modules とサードパーティライブラリの統合

```css
/* グローバルスタイルとの共存 */
.container {
  /* ローカルスコープ */
  padding: 1rem;
  
  /* グローバルクラスの上書き */
  :global(.third-party-class) {
    margin: 0;
    padding: inherit;
  }
  
  /* 子要素のグローバルスタイル制御 */
  :global {
    .react-select__control {
      border-color: var(--border-color);
    }
    
    .react-select__menu {
      z-index: var(--z-index-dropdown);
    }
  }
}
```

## ベストプラクティス

1. **命名規則**: BEM風の命名でコンポーネント構造を明確化
2. **Composition**: 共通スタイルの再利用で保守性向上
3. **CSS変数**: テーマとレスポンシブ対応の統一
4. **PostCSS**: 自動プレフィックス、最適化の自動化
5. **型安全性**: TypeScript統合で開発体験向上
6. **パフォーマンス**: Critical CSS、遅延読み込みの活用
7. **テスト**: スナップショットテストでスタイル変更を検知