# Figma AI機能（2024）

最新のFigma AI機能の実用的な活用方法。

## 主要AI機能

```
- Make Design: AIによるデザイン生成
- Visual Search: 画像検索
- Text Rewriting: テキスト書き換え
- Background Removal: 背景除去
- Image Upscaling: 高解像度化
```

## Make Design実装

```typescript
// Figma Plugin API
figma.showUI(__html__, { width: 400, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-design') {
    const prompt = msg.prompt; // "Create dashboard"
    
    // フレーム生成
    const frame = figma.createFrame();
    frame.name = 'AI Generated';
    frame.resize(1440, 900);
    
    // AI生成コンポーネント配置
    await generateComponents(frame, prompt);
  }
};
```

## Dev Mode設定

```json
// figma.manifest.json
{
  "name": "AI Code Generator",
  "id": "plugin-id",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "codegen": [{
    "title": "React + Tailwind",
    "language": "React",
    "fileExtensions": ["tsx"]
  }],
  "permissions": ["codegen"]
}
```

## Variables活用

```typescript
// 変数取得
const variables = await figma.variables.getLocalVariables();
const colorVar = variables.find(v => v.name === 'primary');

// モード対応
const lightValue = colorVar.valuesByMode['light'];
const darkValue = colorVar.valuesByMode['dark'];

// コード生成時の参照
const generateWithVariables = (node) => {
  const fills = node.fills;
  if (fills?.[0]?.boundVariables?.color) {
    return `var(--${fills[0].boundVariables.color.name})`;
  }
  return null;
};
```

## UI3新機能

```typescript
const ui3Features = {
  canvas: {
    focusMode: true,
    smartGuides: true
  },
  properties: {
    grouped: true,
    resizable: true
  },
  ai: {
    autoNaming: true,
    contentGeneration: true
  }
};
```

## ヒント
- Make Designでプロトタイプ高速作成
- Variablesでデザイントークン管理
- Dev Modeでコード生成統合