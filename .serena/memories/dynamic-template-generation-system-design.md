# 動的テンプレート生成システム設計書

## 📋 Issue #29: Template Duplication Elimination (9→3 Files)

### 🎯 目標
- 9個の重複テンプレートファイルを3個のコアテンプレート + 設定ファイルに集約
- 67%のファイル削減を実現
- 既存src/generatorsシステムを活用して動的生成機能を追加

### 📐 アーキテクチャ設計

#### 現在の状況 (分析結果)
```
templates/
├── cursor/
│   ├── ja/main.mdc
│   ├── en/main.mdc  
│   └── ch/main.mdc
├── github-copilot/
│   ├── ja/main.md
│   ├── en/main.md
│   └── ch/main.md
└── claude/
    ├── ja/main.md
    ├── en/main.md
    └── ch/main.md
```

#### 新アーキテクチャ (目標)
```
templates/
├── core/
│   ├── ja/main.md     # 日本語コアテンプレート
│   ├── en/main.md     # 英語コアテンプレート
│   └── ch/main.md     # 中国語コアテンプレート
└── configs/
    ├── tools/
    │   ├── cursor.json        # Cursor固有設定
    │   ├── github-copilot.json  # GitHub Copilot固有設定
    │   └── claude.json        # Claude固有設定
    └── languages/
        ├── javascript.json    # JavaScript/TypeScript用globs
        ├── python.json       # Python用globs
        ├── php.json         # PHP用globs
        ├── ruby.json        # Ruby用globs
        └── universal.json   # 汎用globs
```

### 🔧 技術実装設計

#### 1. BaseGenerator クラス拡張
既存のBaseGeneratorクラスに以下メソッドを追加:

```typescript
/**
 * 動的テンプレート生成 - コアテンプレート + 設定から生成
 */
async loadDynamicTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
  const lang = options?.lang || 'en';
  const toolName = this.toolConfig.name;
  
  // 1. コアテンプレートをロード
  const coreTemplatePath = join(__dirname, '../../templates/core', lang, templateName);
  const coreTemplate = await readFile(coreTemplatePath, 'utf-8');
  
  // 2. ツール固有設定をロード
  const toolConfigPath = join(__dirname, '../../templates/configs/tools', `${toolName}.json`);
  const toolConfig = JSON.parse(await readFile(toolConfigPath, 'utf-8'));
  
  // 3. 動的置換実行
  return this.applyDynamicReplacements(coreTemplate, toolConfig, options);
}

/**
 * 動的置換の実行
 */
private applyDynamicReplacements(template: string, toolConfig: any, options?: GenerateFilesOptions): string {
  let result = template;
  
  // ツール名置換
  result = result.replace(/\{\{toolName\}\}/g, toolConfig.displayName || this.toolConfig.name);
  
  // ファイル拡張子置換
  if (toolConfig.fileExtension) {
    result = result.replace(/\{\{fileExtension\}\}/g, toolConfig.fileExtension);
  }
  
  // カスタムセクション置換
  if (toolConfig.customSections) {
    Object.entries(toolConfig.customSections).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
    });
  }
  
  // 既存の変数置換も実行
  return this.replaceTemplateVariables(result, options || {});
}
```

#### 2. 設定ファイル仕様

##### tools/cursor.json
```json
{
  "displayName": "Cursor AI",
  "fileExtension": ".mdc",
  "customSections": {
    "toolSpecificFeatures": "## Cursor Specific Features\n- Advanced code completion\n- AI-powered refactoring",
    "additionalInstructions": "Use Cursor's compose feature for complex changes."
  },
  "globs": {
    "inherit": "javascript",
    "additional": ["**/*.mdc"]
  }
}
```

##### tools/github-copilot.json  
```json
{
  "displayName": "GitHub Copilot",
  "fileExtension": ".md",
  "customSections": {
    "toolSpecificFeatures": "## GitHub Copilot Features\n- Context-aware suggestions\n- Multi-language support",
    "additionalInstructions": "Use GitHub Copilot's chat for clarification."
  },
  "globs": {
    "inherit": "universal"
  }
}
```

##### tools/claude.json
```json
{
  "displayName": "Claude AI",
  "fileExtension": ".md", 
  "customSections": {
    "toolSpecificFeatures": "## Claude AI Features\n- Deep reasoning capabilities\n- Extended context understanding",
    "additionalInstructions": "Leverage Claude's analytical strengths for complex problems."
  },
  "globs": {
    "inherit": "universal"
  }
}
```

##### languages/javascript.json
```json
{
  "globs": [
    "**/*.ts",
    "**/*.tsx", 
    "**/*.js",
    "**/*.jsx",
    "**/*.json",
    "**/*.md"
  ],
  "description": "JavaScript/TypeScript project files"
}
```

#### 3. コアテンプレート設計

##### templates/core/ja/main.md
```markdown
---
description: {{projectName}}の主要開発指示
globs: {{dynamicGlobs}}
alwaysApply: true
---

# {{toolName}} 開発指示 - {{projectName}}

## 🚨 核心原則（必須）

すべてのタスク・コマンド・ツール実行前に必ず読み込み

- [基本ルール](./instructions/base.md) - 絶対厳守事項
- [深層思考](./instructions/deep-think.md)  
- [memory](./instructions/memory.md)

{{toolSpecificFeatures}}

## プロジェクト固有のアーキテクチャ・ルール・ドキュメント

- [プロジェクトドキュメント索引](./docs/README.md)

## 📋 場面別必須参照ファイル

### 実行環境
- [コマンド実行](./instructions/command.md) - シェル、実行ルール

### Git・コミット関連
- [Gitルール](./instructions/git.md) - GitHub操作、Issue、ブランチ戦略
- [コミット規約](./instructions/commit-rules.md) - コミットメッセージ形式
- [PRルール](./instructions/pr-rules.md) - プルリクエスト作成規約

### 開発プロセス  
- [開発スタイル](./instructions/develop.md) - Issue駆動、TDD、スクラム
- [TDDルール](./instructions/KentBeck-tdd-rules.md) - テスト駆動開発
- [スクラム開発](./instructions/scrum.md) - スプリント管理

### 用語・表記統一
- [ドメイン用語集](./instructions/domain-terms.md) - 統一表記確認
- [用語更新ワークフロー](./instructions/domain-term-workflow.md) - 新用語提案

### 調査・検索
- [検索パターン集](./instructions/search-patterns.md) - Git検索コマンド
- [トラブルシューティング](./instructions/troubleshooting.md) - 問題解決手順

### 記録・管理
- [ノート・日誌](./instructions/note.md) - 作業記録の書き方

{{additionalInstructions}}

## 🔄 実行フロー

1. 基本ルール読み込み → 絶対厳守事項の確認
2. 場面に応じた専用ファイル読み込み → 具体的な実行ルール確認
3. 参照確認の明示 → `✅️:{filename.md}` で表示  
4. 実行 → ルールに従って作業実行
```

### 🧪 TDD実装戦略

#### Phase 1: Red (失敗するテスト作成)
```typescript
// test/generators/dynamic-template.test.ts
describe('Dynamic Template Generation', () => {
  test('should load core template and apply tool config', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { 
      lang: 'ja', 
      projectName: 'test-project' 
    });
    
    expect(result).toContain('Cursor AI 開発指示');
    expect(result).toContain('test-project');
    expect(result).toContain('Cursor Specific Features');
  });

  test('should handle all 9 combinations (3 tools × 3 languages)', async () => {
    const tools = ['cursor', 'github-copilot', 'claude'] as const;
    const langs = ['ja', 'en', 'ch'] as const;
    
    for (const tool of tools) {
      for (const lang of langs) {
        const generator = GeneratorFactory.createGenerator(tool);
        const result = await generator.loadDynamicTemplate('main.md', { 
          lang, 
          projectName: 'test-project' 
        });
        
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(100);
      }
    }
  });
});
```

#### Phase 2: Green (最小実装)
- BaseGenerator.loadDynamicTemplate()実装
- 設定ファイル読み込み機能
- 基本的な置換ロジック

#### Phase 3: Refactor (リファクタリング)
- エラーハンドリング強化
- パフォーマンス最適化
- 設定検証機能追加

### 📊 実装順序とマイルストーン

#### Milestone 1: 基盤実装
1. コアテンプレートファイル作成 (templates/core/{lang}/main.md)
2. ツール設定ファイル作成 (templates/configs/tools/*.json)
3. BaseGenerator.loadDynamicTemplate()メソッド実装

#### Milestone 2: テスト網羅
1. 全9組み合わせ (3 tools × 3 languages) テスト
2. エラーケーステスト
3. 設定ファイル検証テスト

#### Milestone 3: 統合・移行
1. 既存生成器クラスの修正 (CursorGenerator, etc.)
2. 後方互換性確保
3. 重複ファイル削除

### 🔄 Backward Compatibility
- 既存のloadTemplate()メソッドは保持
- 段階的移行で既存機能を破綻させない
- フォールバック機能でレガシーテンプレート対応

### ⚡ Performance Considerations
- 設定ファイルキャッシュ
- テンプレートコンパイル結果キャッシュ  
- 非同期ファイル読み込み最適化

### 🎯 成果指標
- ファイル数: 9 → 3 (67%削減)
- 重複排除: 100%
- 全組み合わせテストカバレッジ: 100%
- 後方互換性: 100%維持