# 動的テンプレートシステム設計更新 (2025/08/08)

## 🎯 設計変更の背景と理由

### 削除された機能
- `{{toolName}}` - ツール名表示
- `{{toolSpecificFeatures}}` - ツール固有機能セクション  
- `{{additionalInstructions}}` - 追加指示セクション
- `customSections` - 設定ファイルのカスタムセクション機能

### 削除理由
**トークン効率とUX観点からの判断:**
- カスタムインストラクションに記載しても意味がない内容
- 余計なトークン消費によりコンテキストウィンドウから重要な指示が漏れるリスク
- ユーザー視点で考えると害悪でしかない

## 📐 現在のアーキテクチャ

### ディレクトリ構造
```
templates/
├── core/
│   ├── ja/main.md     # 日本語コアテンプレート
│   ├── en/main.md     # 英語コアテンプレート
│   └── ch/main.md     # 中国語コアテンプレート
├── configs/
│   ├── tools/
│   │   ├── cursor.json        # Cursor設定（簡潔）
│   │   ├── github-copilot.json # GitHub Copilot設定（簡潔）
│   │   └── claude.json        # Claude設定（簡潔）
│   └── languages/
│       ├── javascript.json    # JavaScript用globs
│       ├── typescript.json    # TypeScript用globs  
│       ├── python.json       # Python用globs
│       ├── php.json         # PHP用globs
│       ├── ruby.json        # Ruby用globs
│       └── universal.json   # 汎用globs
└── instructions/
    ├── ja/              # 日本語instruction files
    ├── en/              # 英語instruction files
    └── ch/              # 中国語instruction files
```

### 設定ファイル仕様（簡潔版）

#### tools/cursor.json
```json
{
  "displayName": "Cursor AI",
  "fileExtension": ".mdc",
  "globs": {
    "inherit": "javascript",
    "additional": ["**/*.mdc", "**/.cursor/**"]
  },
  "description": "Cursor AI用の設定ファイル - MDC形式とCursor固有機能対応"
}
```

#### tools/github-copilot.json
```json
{
  "displayName": "GitHub Copilot",
  "fileExtension": ".md",
  "globs": {
    "inherit": "universal"
  },
  "description": "GitHub Copilot用の設定ファイル - 汎用的なMarkdown形式"
}
```

#### tools/claude.json
```json
{
  "displayName": "Claude AI",
  "fileExtension": ".md",
  "globs": {
    "inherit": "universal"
  },
  "description": "Claude AI用の設定ファイル - 汎用的なMarkdown形式"
}
```

## 🔧 実装の詳細

### BaseGenerator.applyDynamicReplacements()
```typescript
private applyDynamicReplacements(
  template: string, 
  toolConfig: any, 
  languageConfig: any, 
  options?: GenerateFilesOptions
): string {
  let result = template;
  
  // 1. Project name replacement (維持)
  if (options?.projectName) {
    result = result.replace(/\{\{projectName\}\}/g, options.projectName);
  }
  
  // 2. Remove tool name placeholders (空文字列置換)
  result = result.replace(/\{\{toolName\}\}/g, '');
  
  // 3. Dynamic globs replacement (維持)
  const dynamicGlobs = this.generateDynamicGlobs(toolConfig, languageConfig);
  result = result.replace(/\{\{dynamicGlobs\}\}/g, JSON.stringify(dynamicGlobs, null, 2).replace(/"/g, '\\"'));
  
  // 4. Remove tool-specific features placeholders (空文字列置換)
  result = result.replace(/\{\{toolSpecificFeatures\}\}/g, '');
  
  // 5. Remove additional instructions placeholders (空文字列置換)
  result = result.replace(/\{\{additionalInstructions\}\}/g, '');
  
  // 6. File extension replacement (維持)
  if (toolConfig.fileExtension) {
    result = result.replace(/\{\{fileExtension\}\}/g, toolConfig.fileExtension);
  }
  
  return result;
}
```

## 📝 テスト更新の必要性

### 期待値の変更
- `Cursor AI 開発指示` → `開発指示` （toolNameが空文字列）
- `## Cursor 固有機能` → 存在しない（セクション自体が削除）
- `## 追加指示` → 存在しない（セクション自体が削除）

### プレースホルダー確認
- `{{toolName}}` → 空文字列に置換される
- `{{toolSpecificFeatures}}` → 空文字列に置換される
- `{{additionalInstructions}}` → 空文字列に置換される
- `{{projectName}}` → 実際のプロジェクト名に置換（維持）
- `{{dynamicGlobs}}` → 言語別globsに置換（維持）

## 🚀 メリット
1. **トークン効率の向上** - 不要な情報を削除
2. **コンテキストウィンドウの有効活用** - 重要な指示に集中
3. **ユーザー体験の向上** - 実用的な内容のみを提供
4. **メンテナンス性の向上** - シンプルな設計

## 📅 更新日
- 2025/08/08 - 設計変更と実装
- Issue #29: Dynamic template system cleanup