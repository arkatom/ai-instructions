# Figma AI統合 インデックス

Figma AI機能とコード生成の実用的パターン集（各ファイル100行以下）。

## 🎨 AI機能

- [AI機能概要](./ai-features.md) - Make Design、Visual Search等
- [Dev Mode設定](./dev-mode.md) - 開発者モード統合

## 🔧 コード生成

- [Builder.io統合](./builder-integration.md) - AIコード生成
- [Code Connect](./code-connect.md) - コンポーネントマッピング

## 🤖 自動化

- [MCPサーバー](./mcp-server.md) - Figma MCPサーバー実装
- [デザイントークン](./design-tokens.md) - トークン抽出と同期

## 💡 クイックスタート（20行）

```typescript
// Figma to React（最小構成）
import figma from '@figma/code-connect';

figma.connect(Button, 'figma-url', {
  props: {
    label: figma.string('Label'),
    variant: figma.enum('Variant', {
      primary: 'primary',
      secondary: 'secondary'
    })
  },
  example: ({ label, variant }) => (
    <Button variant={variant}>
      {label}
    </Button>
  )
});
```

## 主要ツール

- **Figma AI**: デザイン生成
- **Builder.io**: コード生成
- **Code Connect**: コンポーネント連携
- **Variables**: デザイントークン