# Tailwind CSS 実践ガイド 2025

## 最適化された設定とJITモード

### 本番環境向け最小構成

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    // 動的クラス生成パターンをセーフリストに追加
    './src/utils/tailwind-safelist.ts',
  ],
  // ダークモード戦略（class or media）
  darkMode: 'class',
  theme: {
    extend: {
      // カスタムブレークポイント（デバイス固有）
      screens: {
        'xs': '475px',
        '3xl': '1920px',
        'touch': { 'raw': '(hover: none)' },
        'mouse': { 'raw': '(hover: hover)' },
        'retina': { 'raw': '(-webkit-min-device-pixel-ratio: 2)' },
      },
      // デザインシステムとの統合
      colors: {
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          // RGB値での定義で opacity-* との併用を可能に
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
        },
      },
      // パフォーマンス最適化された影
      boxShadow: {
        'soft': '0 2px 8px -2px rgb(0 0 0 / 0.1)',
        'hard': '0 10px 40px -15px rgb(0 0 0 / 0.3)',
        'inner-soft': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
      },
      // GPU加速アニメーション
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateZ(0)' },
          '100%': { opacity: '1', transform: 'translateZ(0)' },
        },
        slideUp: {
          '0%': { transform: 'translate3d(0, 20px, 0)', opacity: '0' },
          '100%': { transform: 'translate3d(0, 0, 0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale3d(0.95, 0.95, 1)', opacity: '0' },
          '100%': { transform: 'scale3d(1, 1, 1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    // カスタムユーティリティ
    function({ addUtilities, matchUtilities, theme }) {
      // GPU加速用ユーティリティ
      addUtilities({
        '.gpu': {
          'transform': 'translateZ(0)',
          'will-change': 'transform',
        },
        '.gpu-off': {
          'transform': 'none',
          'will-change': 'auto',
        },
      });
      
      // 動的グリッドシステム
      matchUtilities(
        {
          'grid-auto-fill': (value) => ({
            gridTemplateColumns: `repeat(auto-fill, minmax(${value}, 1fr))`,
          }),
          'grid-auto-fit': (value) => ({
            gridTemplateColumns: `repeat(auto-fit, minmax(${value}, 1fr))`,
          }),
        },
        {
          values: {
            '200': '200px',
            '250': '250px',
            '300': '300px',
          },
        }
      );
    },
  ],
};
```

### PostCSS 最適化パイプライン

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    'tailwindcss': {},
    'postcss-focus-visible': {}, // :focus-visible ポリフィル
    'autoprefixer': {},
    ...(process.env.NODE_ENV === 'production' ? {
      'cssnano': {
        preset: ['advanced', {
          reduceIdents: false, // アニメーション名を保持
          zindex: false, // z-index の再計算を無効化
        }],
      },
      '@fullhuman/postcss-purgecss': {
        content: ['./src/**/*.{js,jsx,ts,tsx}'],
        defaultExtractor: content => {
          // Tailwind の動的クラスを正確に抽出
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
          const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
          return broadMatches.concat(innerMatches);
        },
        safelist: {
          standard: [/^(hover|focus|active|disabled|group-hover):/],
          deep: [/^animate-/, /^transition-/],
          greedy: [/^bg-opacity-/, /^text-opacity-/],
        },
      },
    } : {}),
  },
};
```

## 高度なコンポーネントパターン

### 1. 条件付きスタイリングとバリアント管理

```typescript
// utils/cn.ts (class-variance-authority + clsx)
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cva, type VariantProps } from 'class-variance-authority';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// components/Button.tsx
const buttonVariants = cva(
  // ベーススタイル
  'inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
      // 複合バリアント
      loading: {
        true: 'relative text-transparent pointer-events-none',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        size: 'lg',
        class: 'text-base font-semibold',
      },
      {
        loading: true,
        class: 'before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-current',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, loading }), className)}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
        {children}
      </button>
    );
  }
);
```

### 2. 動的クラス生成とセーフリスト

```typescript
// utils/tailwind-safelist.ts
// 動的に生成されるクラスをビルド時に含める

const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
const sizes = ['1', '2', '3', '4', '5', '6', '8', '10', '12'];

// バンドルに含めるクラスを明示的に定義
export const safelist = [
  // 動的な背景色
  ...colors.map(color => `bg-${color}-500`),
  ...colors.map(color => `hover:bg-${color}-600`),
  
  // 動的なサイズ
  ...sizes.map(size => `w-${size}`),
  ...sizes.map(size => `h-${size}`),
  
  // グリッドカラム
  ...Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`),
  
  // アニメーション遅延
  ...['75', '100', '150', '200', '300', '500', '700', '1000'].map(
    delay => `animation-delay-${delay}`
  ),
];

// 実際の使用時の型安全な関数
export function getTailwindClass(
  type: 'bg' | 'text' | 'border',
  color: string,
  shade: number = 500
): string {
  // 実行時の検証
  const validColors = new Set(colors);
  if (!validColors.has(color)) {
    console.warn(`Invalid color: ${color}`);
    return '';
  }
  
  return `${type}-${color}-${shade}`;
}
```

### 3. レスポンシブとアダプティブデザイン

```tsx
// components/ResponsiveGrid.tsx
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
}

export function ResponsiveGrid({ 
  children, 
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = 4 
}: ResponsiveGridProps) {
  // 型安全なレスポンシブクラス生成
  const gridClasses = cn(
    'grid',
    `gap-${gap}`,
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`
  );
  
  return <div className={gridClasses}>{children}</div>;
}

// コンテナクエリベースのレスポンシブ
export function ContainerResponsive({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="@sm:p-4 @md:p-6 @lg:p-8 @xl:p-10">
        <h2 className="@sm:text-lg @md:text-xl @lg:text-2xl @xl:text-3xl">
          コンテナサイズに応じた表示
        </h2>
        {children}
      </div>
    </div>
  );
}
```

## パフォーマンス最適化

### 1. Critical CSS インライン化

```typescript
// scripts/extract-critical.js
const critical = require('critical');
const fs = require('fs');
const path = require('path');

async function extractCritical() {
  const result = await critical.generate({
    inline: false,
    src: 'out/index.html',
    target: 'out/index.html',
    width: 1300,
    height: 900,
    penthouse: {
      blockJSRequests: false,
    },
  });
  
  // Critical CSS を別ファイルに保存
  fs.writeFileSync(
    path.join(__dirname, '../public/critical.css'),
    result.css
  );
  
  return result.css;
}

// _document.tsx での使用
import { readFileSync } from 'fs';
import { join } from 'path';

export default function Document() {
  const criticalCss = process.env.NODE_ENV === 'production'
    ? readFileSync(join(process.cwd(), 'public/critical.css'), 'utf8')
    : '';
    
  return (
    <Html>
      <Head>
        {criticalCss && (
          <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
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

### 2. 動的インポートと遅延読み込み

```typescript
// components/HeavyComponent.tsx
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Tailwind クラスの動的読み込み
const DynamicHeavyStyles = dynamic(
  () => import('./HeavyStyles'),
  {
    loading: () => <div className="animate-pulse bg-gray-200 h-64" />,
    ssr: false,
  }
);

// Intersection Observer での遅延読み込み
export function LazyLoadedSection() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref} className="min-h-[200px]">
      {isVisible ? (
        <DynamicHeavyStyles />
      ) : (
        <div className="animate-pulse bg-gray-200 h-64" />
      )}
    </div>
  );
}
```

## デバッグとトラブルシューティング

### 1. 開発環境でのクラス検証

```typescript
// utils/dev-helpers.ts
export function validateTailwindClass(className: string): void {
  if (process.env.NODE_ENV !== 'production') {
    const validPatterns = [
      /^(hover|focus|active|group-hover):/,
      /^(sm|md|lg|xl|2xl):/,
      /^(dark):/,
      /^[\w-]+$/,
    ];
    
    const classes = className.split(' ');
    classes.forEach(cls => {
      const isValid = validPatterns.some(pattern => pattern.test(cls));
      if (!isValid && cls) {
        console.warn(`⚠️ Potentially invalid Tailwind class: "${cls}"`);
      }
    });
  }
}

// ESLint プラグイン設定
// .eslintrc.js
module.exports = {
  extends: ['plugin:tailwindcss/recommended'],
  rules: {
    'tailwindcss/no-custom-classname': 'warn',
    'tailwindcss/classnames-order': 'warn',
    'tailwindcss/enforces-negative-arbitrary-values': 'warn',
    'tailwindcss/enforces-shorthand': 'warn',
    'tailwindcss/migration-from-tailwind-2': 'warn',
  },
};
```

### 2. プロダクションビルドサイズ分析

```javascript
// analyze-bundle.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : '../analyze/client.html',
        })
      );
    }
    
    // Tailwind CSS の最適化
    config.module.rules.push({
      test: /\.css$/,
      use: [
        {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
            modules: false,
          },
        },
      ],
    });
    
    return config;
  },
};
```

## ベストプラクティス

1. **JIT モード**: 常に有効化し、動的クラスはセーフリストで管理
2. **パージ設定**: content 配列を正確に設定し、未使用CSSを確実に削除
3. **カスタムユーティリティ**: 頻出パターンはプラグインとして定義
4. **型安全性**: CVAやtailwind-mergeで条件付きクラスを管理
5. **パフォーマンス**: Critical CSS抽出、遅延読み込みの活用
6. **保守性**: ESLintプラグインでクラス順序と妥当性を検証
7. **デザインシステム**: CSS変数と組み合わせて柔軟性を確保