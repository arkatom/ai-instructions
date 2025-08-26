# Builder.io統合

Builder.io AIプラグインによるコード生成。

## プラグイン設定

```typescript
const builderConfig = {
  framework: 'react',
  styling: 'tailwind',
  options: {
    useTypeScript: true,
    responsiveDesign: true,
    componentLibrary: 'shadcn-ui'
  },
  aiModel: 'claude-3.5-sonnet'
};
```

## 生成例（React）

```typescript
export interface CardProps {
  title: string;
  description: string;
  variant?: 'default' | 'featured';
}

export const Card = ({ title, description, variant = 'default' }: CardProps) => {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-6 shadow-sm",
      variant === 'featured' && "border-primary"
    )}>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};
```

## Vue.js生成

```vue
<template>
  <div :class="cardClasses">
    <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
    <p class="text-gray-600">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description: string;
  variant?: 'default' | 'featured';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
});

const cardClasses = computed(() => [
  'rounded-lg border bg-white p-6 shadow-sm',
  props.variant === 'featured' && 'border-blue-500'
]);
</script>
```

## カスタムプロンプト

```javascript
{
  customPrompt: `Generate production-ready code with:
    - TypeScript strict mode
    - Tailwind CSS
    - Accessibility attributes
    - Responsive design`
}
```

→ 詳細: [Code Connect](./code-connect.md)