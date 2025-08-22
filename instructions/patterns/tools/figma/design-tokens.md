# Figma デザイントークン

Variables抽出、変換、同期の自動化。

## トークン抽出

```typescript
async function extractTokens(fileKey: string) {
  const file = await getFigmaFile(fileKey);
  
  return {
    colors: extractColorTokens(file),
    typography: extractTypography(file),
    spacing: extractSpacing(file)
  };
}

function extractColorTokens(file: any) {
  const colors = {};
  Object.values(file.variables || {}).forEach((variable: any) => {
    if (variable.resolvedType === 'COLOR') {
      colors[variable.name] = rgbaToHex(variable.valuesByMode.light);
    }
  });
  return colors;
}
```

## CSS Variables生成

```typescript
function generateCSSVariables(tokens: DesignTokens) {
  let css = ':root {\n';
  
  Object.entries(tokens.colors).forEach(([name, value]) => {
    css += `  --color-${kebabCase(name)}: ${value};\n`;
  });
  
  return css + '}\n';
}
```

## Tailwind設定

```typescript
function generateTailwindConfig(tokens: DesignTokens) {
  return `module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(tokens.colors, null, 2)}
    }
  }
}`;
}
```

## 自動同期

```yaml
# .github/workflows/design-tokens.yml
name: Sync Design Tokens
on:
  schedule: [cron: '0 */6 * * *']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Extract tokens
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
        run: npm run extract-tokens
      - uses: peter-evans/create-pull-request@v5
        with:
          title: 'Update design tokens'
```

→ 詳細: [AI機能](./ai-features.md)