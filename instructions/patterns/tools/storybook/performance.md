# Storybook パフォーマンス最適化

ビルド最適化、ローディング高速化。

## Vite最適化

```typescript
// .storybook/main.ts
export default {
  framework: '@storybook/react-vite',
  viteFinal: (config) => {
    config.build.rollupOptions.output.manualChunks = {
      vendor: ['react', 'react-dom']
    };
    return config;
  }
};
```

## 遅延読み込み

```typescript
export const HeavyComponent: Story = {
  render: () => {
    const Component = lazy(() => import('./HeavyComponent'));
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Component />
      </Suspense>
    );
  }
};
```

## Tree Shaking & 最適化

```typescript
// package.json
{
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.esm.js"
    }
  }
}

// 効率的なインポート
import { Button } from '@/components/Button'; // ✅
```

## 画像最適化

```typescript
export default {
  staticDirs: ['../public'],
  viteFinal: (config) => {
    config.plugins.push(
      imageOptimization({ formats: ['webp'], quality: 80 })
    );
    return config;
  }
};
```

## メモ化

```typescript
const ExpensiveComponent = memo(({ data }: Props) => {
  const processedData = useMemo(() => processData(data), [data]);
  return <div>{processedData}</div>;
});

export const Optimized: Story = {
  render: () => <ExpensiveComponent data={mockData} />
};
```

## 開発サーバー最適化

```typescript
export default {
  features: {
    storyStoreV7: false,
    buildStoriesJson: false
  },
  typescript: {
    reactDocgen: false,
    check: false
  }
};
```

## キャッシュ設定

```typescript
export default {
  webpackFinal: (config) => { config.cache = { type: 'filesystem' }; return config; }
};
```

→ 詳細: [CI統合](./ci-integration.md)