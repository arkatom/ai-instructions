# Storybook v8 パターン インデックス

最新Storybook v8の実用的なパターン集（各ファイル100行以下）。

## 📚 基本

- [CSF3基本実装](./csf3-basics.md) - Component Story Format 3.0の基本
- [TypeScript設定](./typescript-setup.md) - 型安全な実装

## 🧪 テスト

- [インタラクションテスト](./interaction-testing.md) - Play関数活用
- [ビジュアルテスト](./visual-testing.md) - Chromatic/Playwright連携

## 📖 ドキュメント

- [Autodocs設定](./autodocs.md) - 自動ドキュメント生成
- [MDX活用](./mdx-docs.md) - 高度なドキュメント作成

## ⚡ 最適化

- [パフォーマンス](./performance.md) - ビルド最適化
- [CI/CD統合](./ci-integration.md) - テスト自動化

## 💡 クイックスタート（25行）

```typescript
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    label: 'Button'
  }
};
```