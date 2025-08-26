# Figma Code Connect

コンポーネントマッピングと自動コード同期。

## 基本設定

```typescript
import figma from '@figma/code-connect';
import { Button } from './Button';

figma.connect(Button, 'figma-component-url', {
  props: {
    label: figma.string('Label'),
    variant: figma.enum('Variant', {
      primary: 'primary',
      secondary: 'secondary'
    }),
    size: figma.enum('Size', {
      small: 'sm',
      medium: 'md', 
      large: 'lg'
    })
  },
  example: ({ label, variant, size }) => (
    <Button variant={variant} size={size}>
      {label}
    </Button>
  )
});
```

## 複雑なマッピング

```typescript
figma.connect(Card, 'card-figma-url', {
  props: {
    title: figma.string('Title'),
    hasAction: figma.boolean('Show Button'),
    variant: figma.enum('Style', {
      'Default': 'default',
      'Featured': 'featured'
    })
  },
  example: ({ title, hasAction, variant }) => (
    <Card variant={variant}>
      <Card.Title>{title}</Card.Title>
      {hasAction && <Card.Button>Action</Card.Button>}
    </Card>
  )
});
```

## インスタンススワップ

```typescript
figma.connect(IconButton, 'icon-button-url', {
  props: {
    icon: figma.instance('Icon'),
    label: figma.string('Label')
  },
  example: ({ icon, label }) => (
    <IconButton aria-label={label}>
      {icon}
    </IconButton>
  )
});
```

## CLI統合

```bash
npm install -g @figma/code-connect

figma connect create --file src/components/Button.tsx
figma connect publish
figma connect status
```

→ 詳細: [MCPサーバー](./mcp-server.md)