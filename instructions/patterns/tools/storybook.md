# Storybook v8 パターン (2024)

最新のStorybook v8を活用したコンポーネント開発・テスト・ドキュメント化のベストプラクティス。

## 基本設定

### インストールと初期設定
```bash
# Storybook v8のインストール
npx storybook@latest init

# Vite 5を使用する場合（推奨）
npx storybook@latest init --builder vite

# 既存プロジェクトのアップグレード
npx storybook@latest upgrade
```

### 設定ファイル構造
```
.storybook/
├── main.ts              # メイン設定
├── preview.ts           # プレビュー設定
├── manager.ts           # UIカスタマイズ
└── test-runner.ts       # テスト設定
```

## Component Story Format 3.0

### CSF 3.0の基本構文
```typescript
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

// Meta設定（TypeScript型安全）
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'], // 自動ドキュメント生成
  argTypes: {
    backgroundColor: { control: 'color' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
    },
  },
  args: {
    // デフォルトargs
    primary: true,
    label: 'Button',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリー定義（簡潔な記法）
export const Primary: Story = {
  args: {
    primary: true,
    label: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    primary: false,
    label: 'Secondary Button',
  },
};

// Play関数でインタラクションテスト
export const Clicked: Story = {
  args: {
    label: 'Click me',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    // インタラクションテスト
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

### レンダー関数とフック
```typescript
export const WithHooks: Story = {
  render: (args) => {
    const [count, setCount] = useState(0);
    
    return (
      <div>
        <p>Count: {count}</p>
        <Button 
          {...args} 
          onClick={() => setCount(count + 1)}
          label={`Clicked ${count} times`}
        />
      </div>
    );
  },
};

// 複数コンポーネントの組み合わせ
export const ButtonGroup: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button primary label="Save" />
      <Button label="Cancel" />
      <Button label="Delete" variant="danger" />
    </div>
  ),
};
```

## インタラクションテスト

### Play関数による自動テスト
```typescript
import { within, userEvent, expect, waitFor } from '@storybook/test';

export const FormSubmission: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    
    await step('ユーザー情報を入力', async () => {
      const emailInput = canvas.getByLabelText('Email');
      await userEvent.type(emailInput, 'test@example.com');
      
      const passwordInput = canvas.getByLabelText('Password');
      await userEvent.type(passwordInput, 'password123');
    });
    
    await step('フォームを送信', async () => {
      const submitButton = canvas.getByRole('button', { name: 'Submit' });
      await userEvent.click(submitButton);
    });
    
    await step('成功メッセージを確認', async () => {
      await waitFor(() => {
        expect(canvas.getByText('Login successful')).toBeInTheDocument();
      });
    });
  },
};
```

### 複雑なインタラクション
```typescript
export const DragAndDrop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // ドラッグ要素を取得
    const draggableItem = canvas.getByTestId('draggable-item');
    const dropZone = canvas.getByTestId('drop-zone');
    
    // ドラッグ&ドロップをシミュレート
    await userEvent.drag(draggableItem, dropZone);
    
    // 結果を検証
    await expect(dropZone).toContainElement(draggableItem);
  },
};

// キーボードナビゲーション
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    
    await userEvent.tab();
    await expect(input).toHaveFocus();
    
    await userEvent.keyboard('{ArrowDown}');
    const firstOption = canvas.getByRole('option', { name: 'Option 1' });
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');
  },
};
```

## ビジュアルリグレッションテスト

### Chromatic連携
```typescript
// .storybook/preview.ts
export const parameters = {
  chromatic: {
    // レスポンシブテスト
    viewports: [320, 768, 1200],
    // アニメーション無効化
    pauseAnimationAtEnd: true,
    // 遅延読み込み対応
    delay: 300,
  },
};

// ストーリーレベルの設定
export const ResponsiveCard: Story = {
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
      diffThreshold: 0.2,
    },
  },
};
```

### Playwright連携
```typescript
// playwright-ct.config.ts
import { defineConfig } from '@playwright/experimental-ct-react';

export default defineConfig({
  use: {
    // Storybookのポータブルストーリー使用
    ctPort: 3100,
    ctViteConfig: {
      // Vite設定
    },
  },
});

// component.spec.ts
import { test, expect } from '@playwright/experimental-ct-react';
import * as stories from './Button.stories';
import { composeStories } from '@storybook/react';

const { Primary } = composeStories(stories);

test('Primary button visual test', async ({ mount }) => {
  const component = await mount(<Primary />);
  await expect(component).toHaveScreenshot();
});
```

## 自動ドキュメント生成

### Autodocs設定
```typescript
// .storybook/main.ts
export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-docs',
  ],
  docs: {
    autodocs: 'tag', // 'tag' または true
    defaultName: 'Documentation',
  },
};

// コンポーネントのJSDocコメント
/**
 * プライマリUIボタンコンポーネント
 * 
 * @component
 * @example
 * <Button primary label="Click me" />
 */
export interface ButtonProps {
  /** ボタンの表示テキスト */
  label: string;
  /** プライマリスタイルの適用 */
  primary?: boolean;
  /** ボタンサイズ */
  size?: 'small' | 'medium' | 'large';
  /** クリックハンドラー */
  onClick?: () => void;
}
```

### MDXドキュメント
```mdx
{/* Button.mdx */}
import { Meta, Story, Canvas, ArgTypes } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

基本的なUIボタンコンポーネント。

## 使用方法

<Canvas of={ButtonStories.Primary} />

## Props

<ArgTypes of={ButtonStories} />

## バリエーション

### プライマリボタン
<Canvas of={ButtonStories.Primary} />

### セカンダリボタン
<Canvas of={ButtonStories.Secondary} />

## ベストプラクティス

- アクセシビリティを考慮してaria-labelを設定
- フォーカス状態を明確に表示
- 適切なコントラスト比を維持
```

## TypeScript型安全性

### 厳密な型定義
```typescript
import type { Meta, StoryObj } from '@storybook/react';

// コンポーネントPropsの型
interface ButtonProps {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// satisfiesで型安全性を保証
const meta = {
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'] as const,
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'] as const,
    },
  },
} satisfies Meta<typeof Button>;

// Story型の自動推論
type Story = StoryObj<typeof meta>;

// 型安全なストーリー定義
export const TypedStory: Story = {
  args: {
    label: 'Typed Button',
    variant: 'primary', // 型チェックされる
    size: 'md',
  },
};
```

### ジェネリックコンポーネント対応
```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}

// ジェネリック型を保持したストーリー
const meta = {
  component: List,
} satisfies Meta<typeof List>;

export const StringList: StoryObj<typeof List<string>> = {
  args: {
    items: ['Apple', 'Banana', 'Orange'],
    renderItem: (item) => <li>{item}</li>,
  },
};
```

## React Server Components対応

### RSCストーリー設定
```typescript
// RSCコンポーネントのストーリー
// ServerComponent.stories.tsx
export default {
  component: ServerComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/dashboard',
      },
    },
  },
};

// 非同期コンポーネントのモック
export const Default: Story = {
  async beforeEach() {
    // サーバーデータのモック
    await mockServerData();
  },
  render: () => (
    <Suspense fallback={<div>Loading...</div>}>
      <ServerComponent />
    </Suspense>
  ),
};
```

## アドオン活用

### Essential Addons
```typescript
// .storybook/main.ts
export default {
  addons: [
    '@storybook/addon-essentials', // 基本アドオンセット
    '@storybook/addon-a11y',       // アクセシビリティ
    '@storybook/addon-coverage',    // カバレッジ
    '@storybook/addon-designs',     // デザインファイル連携
    '@storybook/addon-interactions', // インタラクション
  ],
};

// アクセシビリティチェック
export const AccessibleButton: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
};
```

### カスタムアドオン開発
```typescript
// .storybook/addons/custom-addon.ts
import { addons, types } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';

addons.register('my-addon', {
  type: types.PANEL,
  title: 'Custom Panel',
  match: ({ viewMode }) => viewMode === 'story',
  render: ({ active, key }) => (
    <AddonPanel active={active} key={key}>
      <div>Custom addon content</div>
    </AddonPanel>
  ),
});
```

## パフォーマンス最適化

### ビルド最適化
```typescript
// .storybook/main.ts
export default {
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: './vite.config.ts',
      },
    },
  },
  features: {
    // 不要な機能を無効化
    storyStoreV7: false,
    buildStoriesJson: true,
  },
  // Tree shakingを有効化
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      compilerOptions: {
        allowSyntheticDefaultImports: false,
        esModuleInterop: false,
      },
      propFilter: (prop) => {
        return prop.parent
          ? !/node_modules/.test(prop.parent.fileName)
          : true;
      },
    },
  },
};
```

### 遅延読み込み
```typescript
// ストーリーの動的インポート
export const HeavyComponent: Story = {
  render: () => {
    const Component = lazy(() => import('./HeavyComponent'));
    
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Component />
      </Suspense>
    );
  },
};
```

## テスト統合

### Test Runner設定
```bash
# テストランナーのインストール
npm install --save-dev @storybook/test-runner

# テスト実行
npm run test-storybook

# CI環境での実行
npm run test-storybook -- --ci
```

### カバレッジ測定
```typescript
// .storybook/test-runner.ts
import { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postVisit(page, context) {
    // カバレッジ収集
    const coverage = await page.coverage();
    // カバレッジをレポート
  },
};

export default config;
```

## チェックリスト
- [ ] CSF 3.0への移行
- [ ] TypeScript型安全性の確保
- [ ] インタラクションテストの実装
- [ ] ビジュアルリグレッションテストの設定
- [ ] Autodocs有効化
- [ ] アクセシビリティチェック
- [ ] パフォーマンス最適化
- [ ] CI/CD統合
- [ ] カスタムアドオンの検討