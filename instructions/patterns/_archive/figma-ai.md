# Figma AI統合パターン (2024)

最新のFigma AI機能とコード生成プラグイン、MCPサーバーによるデザインtoコード自動化のベストプラクティス。

## Figma AI機能 (Config 2024発表)

### AI搭載機能一覧
```
- Make Design: AIによるデザイン生成
- Visual Search: 画像からデザインアセット検索
- Text Rewriting: AIによるテキストリライト
- Auto Layout Suggestions: 自動レイアウト提案
- Component Search: 自然言語でのコンポーネント検索
- Background Removal: 自動背景除去
- Image Upscaling: AI画像高解像度化
```

### Make Design (AI設計生成)
```typescript
// Figma Plugin API使用例
figma.showUI(__html__, { width: 400, height: 600 });

// AIプロンプトからデザイン生成
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-design') {
    const prompt = msg.prompt; // "Create a modern dashboard"
    
    // Figma AIによるフレーム生成
    const frame = figma.createFrame();
    frame.name = 'AI Generated Design';
    frame.resize(1440, 900);
    
    // AI生成コンポーネントの配置
    await generateComponents(frame, prompt);
  }
};
```

## Dev Mode統合

### Dev Mode設定
```javascript
// figma.manifest.json
{
  "name": "Custom Code Generator",
  "id": "your-plugin-id",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "codegen": [
    {
      "title": "React + Tailwind",
      "language": "React",
      "fileExtensions": ["tsx", "jsx"]
    },
    {
      "title": "Vue + UnoCSS",
      "language": "Vue",
      "fileExtensions": ["vue"]
    }
  ],
  "permissions": ["codegen"]
}
```

### Code Connect設定
```typescript
// figma.connect.tsx
import figma from '@figma/code-connect';

// コンポーネントマッピング
figma.connect(Button, 'figma-url-here', {
  props: {
    label: figma.string('Label'),
    variant: figma.enum('Variant', {
      primary: 'primary',
      secondary: 'secondary',
    }),
    size: figma.enum('Size', {
      small: 'sm',
      medium: 'md',
      large: 'lg',
    }),
    onClick: figma.function('On Click'),
  },
  example: ({ label, variant, size, onClick }) => (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
    >
      {label}
    </Button>
  ),
});
```

## コード生成プラグイン

### Builder.io AIプラグイン
```typescript
// Builder.io統合設定
const builderConfig = {
  // フレームワーク選択
  framework: 'react', // react, vue, svelte, angular
  
  // スタイリング
  styling: 'tailwind', // tailwind, css-modules, styled-components
  
  // コンポーネント生成オプション
  options: {
    useTypeScript: true,
    responsiveDesign: true,
    componentLibrary: 'shadcn-ui',
    useYourComponents: true, // 既存コンポーネント利用
  },
  
  // AIモデル選択
  aiModel: 'claude-3', // claude-3, gpt-4
};

// 生成されるReactコード例
export const DashboardCard = ({ title, value, icon }) => {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
};
```

### Figma to AI Code by DesignCode
```typescript
// Claude AI / GPT-4o統合
const codeGenConfig = {
  model: 'claude-3-opus', // または 'gpt-4o'
  
  // ターゲットフレームワーク
  targets: {
    web: ['react', 'vue', 'svelte'],
    mobile: ['react-native', 'flutter', 'swiftui'],
  },
  
  // プロンプトカスタマイズ
  customPrompt: `
    Generate production-ready code with:
    - TypeScript
    - Tailwind CSS
    - Accessibility attributes
    - Responsive design
    - Dark mode support
  `,
};

// 生成例: React Native
const MobileCard = ({ data }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data.title}</Text>
      <Text style={styles.value}>{data.value}</Text>
    </View>
  );
};
```

## Figma MCP Server

### MCPサーバー設定
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": [
        "@figma/mcp-server",
        "--access-token",
        "YOUR_FIGMA_ACCESS_TOKEN"
      ],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

### MCPサーバー実装
```typescript
// figma-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';

class FigmaMCPServer {
  private figmaToken: string;
  
  constructor(token: string) {
    this.figmaToken = token;
  }
  
  // Figmaファイル取得
  async getFile(fileKey: string) {
    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: {
          'X-Figma-Token': this.figmaToken,
        },
      }
    );
    return response.data;
  }
  
  // ノード情報取得
  async getNode(fileKey: string, nodeId: string) {
    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`,
      {
        headers: {
          'X-Figma-Token': this.figmaToken,
        },
      }
    );
    return response.data.nodes[nodeId];
  }
  
  // デザイントークン抽出
  async extractDesignTokens(fileKey: string) {
    const file = await this.getFile(fileKey);
    
    return {
      colors: this.extractColors(file),
      typography: this.extractTypography(file),
      spacing: this.extractSpacing(file),
      shadows: this.extractShadows(file),
    };
  }
  
  // カラー抽出
  private extractColors(file: any) {
    const colors = {};
    // スタイル解析ロジック
    if (file.styles) {
      Object.entries(file.styles).forEach(([id, style]: any) => {
        if (style.styleType === 'FILL') {
          colors[style.name] = style.description;
        }
      });
    }
    return colors;
  }
}

// MCPサーバー起動
const server = new Server(
  {
    name: 'figma-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール登録
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'getDesign',
      description: 'Get Figma design data',
      inputSchema: {
        type: 'object',
        properties: {
          fileKey: { type: 'string' },
          nodeId: { type: 'string' },
        },
      },
    },
    {
      name: 'extractTokens',
      description: 'Extract design tokens',
      inputSchema: {
        type: 'object',
        properties: {
          fileKey: { type: 'string' },
        },
      },
    },
  ],
}));

// サーバー実行
const transport = new StdioServerTransport();
server.connect(transport);
```

### Cursor IDE統合
```typescript
// .cursorrules
{
  "mcp": {
    "servers": {
      "figma": {
        "enabled": true,
        "config": {
          "fileKey": "YOUR_FIGMA_FILE_KEY",
          "autoSync": true,
          "codeGeneration": {
            "framework": "react",
            "styling": "tailwind",
            "typescript": true
          }
        }
      }
    }
  }
}

// Cursorでの使用例
// @figma get-component Button
// @figma generate-code Card variant=elevated
// @figma sync-tokens
```

## デザイントークン統合

### トークン抽出と変換
```typescript
// design-tokens.config.ts
interface DesignTokenConfig {
  source: {
    figma: {
      fileKey: string;
      branch?: string;
    };
  };
  transforms: TransformConfig[];
  formats: FormatConfig[];
}

const config: DesignTokenConfig = {
  source: {
    figma: {
      fileKey: 'YOUR_FILE_KEY',
    },
  },
  transforms: [
    {
      type: 'color',
      transformer: (token) => ({
        css: `rgb(${token.r}, ${token.g}, ${token.b})`,
        hex: rgbToHex(token),
      }),
    },
    {
      type: 'typography',
      transformer: (token) => ({
        fontFamily: token.fontFamily,
        fontSize: `${token.fontSize}px`,
        fontWeight: token.fontWeight,
        lineHeight: token.lineHeight,
      }),
    },
  ],
  formats: [
    {
      format: 'css',
      destination: './tokens/variables.css',
    },
    {
      format: 'js',
      destination: './tokens/tokens.js',
    },
    {
      format: 'tailwind',
      destination: './tailwind.config.js',
    },
  ],
};
```

### 生成されるトークンファイル
```css
/* variables.css */
:root {
  /* Colors */
  --color-primary: rgb(79, 70, 229);
  --color-secondary: rgb(220, 38, 127);
  --color-background: rgb(255, 255, 255);
  --color-text: rgb(17, 24, 39);
  
  /* Typography */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

## Variables & Modes対応

### 変数管理
```typescript
// Figma Variables API
const variables = await figma.variables.getLocalVariables();

// モード切り替え
const colorVariable = variables.find(v => v.name === 'primary-color');
const modes = colorVariable.variableCollectionId;

// ライトモード/ダークモード値取得
const lightValue = colorVariable.valuesByMode['light'];
const darkValue = colorVariable.valuesByMode['dark'];

// コード生成時の変数参照
const generateWithVariables = (node: SceneNode) => {
  const fills = node.fills;
  if (fills && fills[0].type === 'SOLID') {
    const boundVariable = fills[0].boundVariables?.color;
    if (boundVariable) {
      return `var(--${boundVariable.name})`;
    }
  }
  return null;
};
```

## コンポーネントプロパティマッピング

### Variant対応
```typescript
// Figmaコンポーネントバリアント
interface ComponentMapping {
  figmaComponent: string;
  codeComponent: string;
  variantMapping: {
    [figmaVariant: string]: {
      props: Record<string, any>;
      className?: string;
    };
  };
}

const buttonMapping: ComponentMapping = {
  figmaComponent: 'Button',
  codeComponent: 'Button',
  variantMapping: {
    'Variant=Primary': {
      props: { variant: 'primary' },
      className: 'btn-primary',
    },
    'Variant=Secondary': {
      props: { variant: 'secondary' },
      className: 'btn-secondary',
    },
    'Size=Small': {
      props: { size: 'sm' },
    },
    'Size=Large': {
      props: { size: 'lg' },
    },
  },
};
```

## UI3対応

### 新UI機能活用
```typescript
// UI3 Component-Centered Design
const ui3Features = {
  // イマーシブキャンバス
  canvas: {
    focusMode: true,
    contextualToolbar: true,
    smartGuides: true,
  },
  
  // プロパティパネル改善
  properties: {
    grouped: true,
    labels: true,
    resizable: true,
  },
  
  // AI統合
  ai: {
    autoNaming: true,
    contentGeneration: true,
    layoutSuggestions: true,
  },
};

// プラグインUI更新
figma.ui.postMessage({
  type: 'ui3-update',
  features: ui3Features,
});
```

## ワークフロー自動化

### CI/CD統合
```yaml
# .github/workflows/figma-sync.yml
name: Figma Design Sync

on:
  schedule:
    - cron: '0 */6 * * *' # 6時間ごと
  workflow_dispatch:

jobs:
  sync-design-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Extract Figma Tokens
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}
        run: |
          npx figma-tokens-sync
          npm run build:tokens
      
      - name: Generate Component Code
        run: |
          npx figma-codegen
          npm run format
      
      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Update design tokens from Figma'
          commit-message: 'chore: sync design tokens'
          branch: figma-sync
```

## ベストプラクティス

### 命名規則
```typescript
// Figmaレイヤー命名
const namingConventions = {
  components: 'PascalCase',    // Button, Card, Header
  variants: 'camelCase',        // primaryButton, largeSize
  tokens: 'kebab-case',         // color-primary, space-lg
  icons: 'snake_case',          // icon_arrow_right
};

// 自動変換
const convertName = (figmaName: string, type: string) => {
  switch (type) {
    case 'component':
      return toPascalCase(figmaName);
    case 'css-variable':
      return toKebabCase(figmaName);
    case 'js-variable':
      return toCamelCase(figmaName);
  }
};
```

### パフォーマンス最適化
```typescript
// 大規模ファイルの処理
const optimizedFetch = async (fileKey: string) => {
  // 必要なノードのみ取得
  const nodeIds = ['1:2', '3:4']; // 特定ノードID
  
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`,
    {
      headers: {
        'X-Figma-Token': process.env.FIGMA_TOKEN,
      },
    }
  );
  
  // キャッシュ活用
  const cache = new Map();
  if (cache.has(fileKey)) {
    return cache.get(fileKey);
  }
  
  const data = await response.json();
  cache.set(fileKey, data);
  return data;
};
```

## チェックリスト
- [ ] Figma AI機能の有効化
- [ ] Dev Mode設定完了
- [ ] コード生成プラグイン選定
- [ ] MCPサーバー設定
- [ ] デザイントークン同期設定
- [ ] CI/CD統合
- [ ] 命名規則の統一
- [ ] Code Connect設定
- [ ] Variables活用