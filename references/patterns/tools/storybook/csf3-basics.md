# CSF3 基本実装

Component Story Format 3.0の実用的な基本パターン。

## セットアップ

```bash
npx storybook@latest init --builder vite
```

## 基本構造

```typescript
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

// Meta定義（共通設定）
const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'], // 自動ドキュメント
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large']
    },
    onClick: { action: 'clicked' }
  },
  args: {
    // デフォルト値
    label: 'Button',
    primary: true
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリー定義（簡潔）
export const Primary: Story = {
  args: {
    primary: true
  }
};

export const Secondary: Story = {
  args: {
    primary: false
  }
};

export const Large: Story = {
  args: {
    size: 'large'
  }
};
```

## Render関数使用

```typescript
import { useState } from 'react';

export const WithState: Story = {
  render: (args) => {
    const [count, setCount] = useState(0);
    return (
      <Button 
        {...args}
        onClick={() => setCount(c => c + 1)}
        label={`Clicked ${count} times`}
      />
    );
  }
};
```

## Play関数（インタラクション）

```typescript
import { within, userEvent } from '@storybook/test';

export const Clickable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.click(button);
  }
};
```

## ヒント
- `satisfies`で型安全性確保
- argsでプロパティ継承
- tagsで自動ドキュメント生成