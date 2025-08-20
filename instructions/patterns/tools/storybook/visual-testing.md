# Storybook ビジュアルテスト

Chromatic、Playwright連携によるビジュアルリグレッションテスト。

## Chromatic設定

```typescript
// .storybook/preview.ts
export const parameters = {
  chromatic: {
    viewports: [320, 768, 1200],
    pauseAnimationAtEnd: true,
    delay: 300
  }
};
```

```bash
# Chromaticセットアップ
npm install --save-dev chromatic
npx chromatic --project-token=YOUR_TOKEN

# CI統合
npx chromatic --exit-zero-on-changes
```

## ストーリーレベル設定

```typescript
export const ResponsiveCard: Story = {
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
      diffThreshold: 0.2,
      delay: 500
    }
  }
};

export const DarkMode: Story = {
  parameters: {
    chromatic: {
      modes: {
        light: { theme: 'light' },
        dark: { theme: 'dark' }
      }
    }
  }
};
```

## Playwright統合

```typescript
// playwright-ct.config.ts
import { defineConfig } from '@playwright/experimental-ct-react';

export default defineConfig({
  use: {
    ctPort: 3100
  },
  testDir: './tests/component'
});
```

```typescript
// Button.spec.ts
import { test, expect } from '@playwright/experimental-ct-react';
import { Primary } from './Button.stories';

test('Button visual test', async ({ mount }) => {
  const component = await mount(<Primary />);
  await expect(component).toHaveScreenshot();
});
```

## スナップショット設定

```typescript
// 自動スナップショット
export const AllVariants: Story = {
  parameters: {
    snapshot: {
      variants: [
        { name: 'Default' },
        { name: 'Hover', pseudo: { hover: true } },
        { name: 'Focus', pseudo: { focus: true } },
        { name: 'Disabled', args: { disabled: true } }
      ]
    }
  }
};
```

## アニメーション制御

```typescript
export const AnimatedButton: Story = {
  parameters: {
    chromatic: {
      pauseAnimationAtEnd: true
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    // アニメーション完了まで待機
    await userEvent.hover(button);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};
```

## CI/CD統合

```yaml
# .github/workflows/visual-tests.yml
name: Visual Tests
on: [push, pull_request]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx chromatic --project-token=${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

→ 詳細: [Autodocs](./autodocs.md)