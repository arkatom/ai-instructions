# Storybook TypeScript設定

型安全なStorybook v8のTypeScript設定。

## 基本設定

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript'
  }
};

export default config;
```

## 型定義

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    }
  }
};

export default preview;
```

## 厳密な型付け

```typescript
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button, ButtonProps } from './Button';

const meta = {
  component: Button,
  argTypes: {
    onClick: { action: 'clicked' },
    variant: {
      control: 'select',
      options: ['primary', 'secondary'] as const
    }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button'
  }
};
```

## ジェネリック対応

```typescript
// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <>{items.map(renderItem)}</>;
}

// Story with generics
const meta = {
  component: List
} satisfies Meta<typeof List>;

export const StringList: StoryObj<typeof List<string>> = {
  args: {
    items: ['A', 'B', 'C'],
    renderItem: (item) => <div>{item}</div>
  }
};
```

## カスタム型

```typescript
// types/storybook.d.ts
import '@storybook/react';

declare module '@storybook/react' {
  interface Parameters {
    customParam?: string;
  }
}
```

## tsconfig設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src",
    ".storybook"
  ]
}
```

→ 詳細: [CSF3基本実装](./csf3-basics.md)