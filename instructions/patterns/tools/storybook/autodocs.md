# Storybook Autodocs

自動ドキュメント生成設定。

## 基本設定

```typescript
// .storybook/main.ts
export default {
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation'
  }
};

// Button.stories.ts
const meta = {
  component: Button,
  tags: ['autodocs']
} satisfies Meta<typeof Button>;
```

## JSDocコメント

```typescript
/**
 * プライマリUIボタンコンポーネント
 */
export interface ButtonProps {
  /** ボタンの表示テキスト */
  children: React.ReactNode;
  /** ボタンの見た目バリエーション */
  variant?: 'primary' | 'secondary';
  /** サイズ指定 */
  size?: 'small' | 'medium' | 'large';
  /** クリックハンドラー */
  onClick?: () => void;
}
```

## 引数テーブル

```typescript
const meta = {
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      description: 'ボタンのスタイル',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'primary' }
      }
    }
  }
} satisfies Meta<typeof Button>;
```

## ストーリー説明

```typescript
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'プライマリアクション用のボタン。'
      }
    }
  }
};
```

## カスタムブロック

```typescript
import { Canvas, Meta } from '@storybook/blocks';

export default {
  docs: {
    page: () => (
      <>
        <Meta />
        <h1>Button Component</h1>
        <Canvas of={Primary} />
      </>
    )
  }
};
```

→ 詳細: [MDXドキュメント](./mdx-docs.md)