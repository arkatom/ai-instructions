# Storybook MDXドキュメント

MDXによる高度なドキュメント作成。

## 基本MDX

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
```

## インタラクティブ例

```mdx
import { useState } from 'react';

export const InteractiveExample = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(c => c + 1)}>
        Click me ({count})
      </Button>
    </div>
  );
};

<InteractiveExample />
```

## コードブロック

```mdx
使用例：

```tsx
import { Button } from '@/components/Button';

function App() {
  return (
    <Button variant="primary" size="large">
      Submit
    </Button>
  );
}
```

## カスタムコンポーネント

```mdx
export const UsageTable = ({ data }) => (
  <table>
    <thead>
      <tr>
        <th>Prop</th>
        <th>Type</th>
        <th>Default</th>
      </tr>
    </thead>
    <tbody>
      {data.map(row => (
        <tr key={row.prop}>
          <td>{row.prop}</td>
          <td>{row.type}</td>
          <td>{row.default}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

<UsageTable data={[
  { prop: 'variant', type: 'string', default: 'primary' },
  { prop: 'size', type: 'string', default: 'medium' }
]} />
```

## ベストプラクティス

```mdx
## ✅ 推奨
- 明確な使用例を提供
- インタラクティブなデモを含める
- エラーケースも記載

## ❌ 避ける
- 長すぎる説明
- 技術的詳細の過多
- 古い例の放置
```

→ 詳細: [パフォーマンス](./performance.md)