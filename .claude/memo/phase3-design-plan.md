# Phase 3: 設計と計画 - 詳細設計書

## 🏗️ アーキテクチャ設計

### モジュール依存関係図
```
BaseGenerator (90行)
    ├── TemplateResolver (120行)
    ├── DynamicTemplateProcessor (150行)
    │   └── TemplateResolver (依存)
    ├── ConfigurationManager (既存強化)
    └── FileStructureBuilder (80行)
        └── ConfigurationManager (依存)
```

### 依存注入パターン設計
```typescript
// BaseGenerator内での依存注入
export abstract class BaseGenerator {
  private templateResolver: TemplateResolver;
  private dynamicProcessor: DynamicTemplateProcessor;
  private fileStructureBuilder: FileStructureBuilder;
  
  constructor(toolConfig: ToolConfig) {
    this.templateResolver = new TemplateResolver(this.templateDir);
    this.dynamicProcessor = new DynamicTemplateProcessor(
      this.templateDir, 
      this.templateResolver
    );
    this.fileStructureBuilder = new FileStructureBuilder();
  }
}
```

## 🛡️ エラーハンドリング方針

### 統一エラー処理パターン
1. **型安全なエラー再投射**: 既存のカスタムエラー型を維持
2. **ErrorHandler統一**: 全モジュールでErrorHandler.normalizeToError()使用
3. **段階的エラー分離**: 各モジュールで責任範囲を明確化

### エラー境界設計
```typescript
// 各モジュール共通のエラー処理パターン
try {
  // モジュール固有の処理
} catch (error) {
  // カスタムエラーの再投射
  if (error instanceof ModuleSpecificError) {
    throw error;
  }
  // 予期しないエラーの正規化
  throw new ModuleError('operation', ErrorHandler.normalizeToError(error));
}
```

## 🔒 型安全性確保方法

### 1. 厳密な型ガード活用
```typescript
// 入力検証の徹底
export class TemplateResolver {
  async loadTemplate(
    paths: string[],
    defaultTemplate: string
  ): Promise<string> {
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new TemplateNotFoundError('template', 'unknown', paths);
    }
    // 処理続行
  }
}
```

### 2. Readonly型の積極活用
```typescript
// 不変性の保証
export interface TemplateContext {
  readonly toolConfig: StrictToolConfiguration;
  readonly languageConfig: StrictLanguageConfiguration;
  readonly options: Readonly<GenerateFilesOptions>;
}
```

### 3. ジェネリクス制約
```typescript
// 型制約による安全性
export class DynamicTemplateProcessor<T extends StrictToolConfiguration> {
  constructor(
    private templatesDir: string,
    private templateResolver: TemplateResolver
  ) {}
}
```

## 🧪 テストケース設計（価値重視）

### Unit Test Strategy
```typescript
describe('TemplateResolver', () => {
  describe('loadTemplate', () => {
    it('should load template from first available path', async () => {
      // 実際の使用パターンをテスト
    });
    
    it('should fallback to English when language-specific template missing', async () => {
      // フォールバック機能のテスト（重要な機能）
    });
    
    it('should throw TemplateNotFoundError when no templates exist', async () => {
      // エラーケースのテスト（バグ防止）
    });
  });
});
```

### Integration Test Strategy
```typescript
describe('BaseGenerator Integration', () => {
  it('should maintain backward compatibility with existing generators', async () => {
    // ClaudeGenerator, CursorGenerator等の動作保証
  });
  
  it('should handle dependency injection correctly', async () => {
    // モジュール間の連携テスト
  });
});
```

## 📝 実装順序決定（小単位分割）

### Phase 3.1: TemplateResolver抽出（低リスク）
```bash
# Step 1: TemplateResolverクラス作成
src/generators/modules/template-resolver.ts

# Step 2: privateメソッド移動
- buildTemplatePaths()
- tryReadTemplate()
- showFallbackWarning()
- loadTemplate()

# Step 3: BaseGeneratorでの使用
- 依存注入パターン実装
- 既存テスト実行・通過確認

# Commit: "refactor: extract TemplateResolver from BaseGenerator"
```

### Phase 3.2: FileStructureBuilder抽出（低リスク）
```bash
# Step 1: FileStructureBuilderクラス作成
src/generators/modules/file-structure-builder.ts

# Step 2: 関連メソッド移動
- generateOutputDirectoryStructure()
- getFileStructureConfig() (ConfigurationManagerへの委譲維持)

# Commit: "refactor: extract FileStructureBuilder from BaseGenerator"
```

### Phase 3.3: DynamicTemplateProcessor抽出（中リスク）
```bash
# Step 1: DynamicTemplateProcessorクラス作成
src/generators/modules/dynamic-template-processor.ts

# Step 2: 重複コード統合
- base.ts の generateDynamicGlobs()
- shared-processor.ts の generateDynamicGlobs()
- 共通実装に統一

# Step 3: 動的処理メソッド移動
- loadDynamicTemplate()
- applyDynamicReplacements()
- generateDynamicGlobs()

# Commit: "refactor: extract DynamicTemplateProcessor and eliminate code duplication"
```

### Phase 3.4: ConfigurationManager統合（低リスク）
```bash
# Step 1: 既存ConfigurationManagerの拡張
# バリデーションロジックの統合

# Step 2: BaseGeneratorから委譲の最適化

# Commit: "refactor: enhance ConfigurationManager with validation consolidation"
```

### Phase 3.5: BaseGenerator統合（高リスク）
```bash
# Step 1: 依存注入パターン実装
# Step 2: 公開API互換性テスト
# Step 3: 全継承クラスでの動作確認
# Step 4: ESLint disable除去

# Commit: "refactor: complete BaseGenerator modularization"
```

## 🎯 品質保証計画

### 各Phase共通チェック項目
- [ ] ESLint警告0件
- [ ] 複雑度10以下確認
- [ ] 単体テスト100%通過
- [ ] 統合テスト通過
- [ ] 型チェック通過

### Phase完了基準
1. **機能テスト**: 既存のすべてのgeneratorが正常動作
2. **パフォーマンステスト**: 処理時間の劣化がない
3. **メモリテスト**: メモリリークの発生がない

## 🚀 リスク軽減策

### 1. 段階的コミット
- 各モジュール抽出後に必ずコミット
- 問題発生時の即座のロールバック可能性

### 2. 機能フラグパターン
```typescript
// 必要に応じて、新旧実装の切り替え可能に
const USE_NEW_ARCHITECTURE = process.env.NODE_ENV !== 'production';
```

### 3. 並行テスト実行
- リファクタリング前後の両方でテスト実行
- 結果比較による品質保証

---

**Phase 3完了**: 詳細設計、型安全性方針、テスト戦略、実装順序
**次ステップ**: Phase 4 - 段階的実装開始（TemplateResolverから）