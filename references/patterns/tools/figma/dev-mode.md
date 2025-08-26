# Figma Dev Mode設定

開発者モード統合とコード生成設定。

## Dev Mode有効化

```javascript
// figma.manifest.json
{
  "name": "Code Generator",
  "codegen": [{
    "title": "React + Tailwind",
    "language": "React",
    "fileExtensions": ["tsx"]
  }],
  "permissions": ["codegen"]
}
```

## コード生成設定

```typescript
figma.codegen.on('generate', (event) => {
  const { node, language } = event;
  
  if (language === 'React') {
    return [{
      title: 'Component',
      code: `export const ${node.name} = () => <div className="${getStyles(node)}">{children}</div>`,
      language: 'tsx'
    }];
  }
});
```

## 検査モード

```typescript
figma.ui.onmessage = (msg) => {
  if (msg.type === 'inspect') {
    const selection = figma.currentPage.selection[0];
    const info = {
      width: selection.width,
      height: selection.height,
      fills: selection.fills
    };
    figma.ui.postMessage({ type: 'node-info', info });
  }
};
```

## CSS生成

```typescript
function generateCSS(node: RectangleNode): string {
  const fills = node.fills as Paint[];
  let css = '';
  
  if (fills[0]?.type === 'SOLID') {
    const { r, g, b } = fills[0].color;
    css += `background: rgb(${r*255}, ${g*255}, ${b*255});`;
  }
  
  return css;
}
```

## デザイントークン抽出

```typescript
function extractTokens(node: SceneNode) {
  const tokens = { spacing: [], colors: [], typography: [] };
  
  if (node.boundVariables) {
    Object.entries(node.boundVariables).forEach(([prop, variable]) => {
      tokens[getTokenType(prop)].push({ name: variable.name, value: getVariableValue(variable) });
    });
  }
  
  return tokens;
}
```

## プロパティマッピング

```typescript
function mapComponentProps(instance: InstanceNode) {
  const variantProps = {};
  
  instance.componentProperties.forEach((prop, key) => {
    if (prop.type === 'VARIANT') {
      variantProps[key] = prop.value;
    }
  });
  
  return variantProps;
}
```

→ 詳細: [Builder.io統合](./builder-integration.md)