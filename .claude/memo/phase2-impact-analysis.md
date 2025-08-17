# Phase 2: 影響範囲特定 - 完了

## 🎯 影響範囲マップ

### 直接影響を受けるファイル（5個）

#### 1. **BaseGenerator継承クラス** (4ファイル)
- `src/generators/claude.ts` - `loadDynamicTemplate()`使用
- `src/generators/cline.ts` - BaseGenerator継承
- `src/generators/cursor.ts` - BaseGenerator継承  
- `src/generators/github-copilot.ts` - BaseGenerator継承
- `src/generators/factory.ts` - BaseGenerator参照

#### 2. **機能重複ファイル** (1ファイル)
- `src/generators/shared-processor.ts` - `generateDynamicGlobs()`の重複実装
  - **重要**: base.tsと完全に同じロジック（line 323-334）
  - **対応**: 共通モジュールに統合が必要

### テスト影響範囲（4ファイル）

- `test/cli/file-generation-orchestrator.test.ts`
- `test/generators/complete-matrix.test.ts`
- `test/generators/config-loading.test.ts` 
- `test/init/interactive.test.ts`

### 依存関係分析

#### TemplateResolver関連
- **外部参照**: なし（privateメソッドのみ）
- **内部参照**: base.ts内のみ
- **リスク**: 低

#### DynamicTemplateProcessor関連
- **外部参照**: claude.ts (`loadDynamicTemplate`)
- **重複実装**: shared-processor.ts (`generateDynamicGlobs`)
- **リスク**: 中（重複コード統合必要）

#### ConfigurationManager関連
- **既存実装**: config-manager.ts
- **委譲関係**: base.ts → ConfigurationManager
- **リスク**: 低（既存インフラ活用）

#### FileStructureBuilder関連
- **外部参照**: なし
- **委譲関係**: base.ts → ConfigurationManager
- **リスク**: 低

## 🚨 重要な発見

### 1. コード重複の発見
```typescript
// base.ts line 328-342
private generateDynamicGlobs(toolConfig, languageConfig): ReadonlyArray<string>

// shared-processor.ts line 323-334
private static generateDynamicGlobs(toolConfig, languageConfig): ReadonlyArray<string>
```
**完全に同じ実装** → 統合が必要

### 2. ConfigurationManager委譲パターン
```typescript
// base.ts
async getFileStructureConfig(): Promise<FileStructureConfig> {
  return await ConfigurationManager.getFileStructureConfig(this.toolConfig.name);
}
```
**既存の優れた設計** → 他のモジュールでも活用

## 📊 影響度スコア

| 要素 | 影響ファイル数 | 複雑度 | リスク |
|------|---------------|--------|--------|
| TemplateResolver | 1 | 低 | 低 |
| DynamicTemplateProcessor | 2 | 中 | 中 |
| ConfigurationManager | 1 | 低 | 低 |
| FileStructureBuilder | 1 | 低 | 低 |
| BaseGenerator | 6 | 高 | 中 |

## 🎯 Phase 3 への提言

### 優先対応事項
1. **重複コード統合**: `generateDynamicGlobs`の統一
2. **段階的移行**: privateメソッドから開始
3. **テスト優先**: 各ステップでテスト実行
4. **公開API保持**: 破壊的変更の回避

### 実装順序最適化
1. **低リスク順**: TemplateResolver → FileStructureBuilder
2. **中リスク順**: DynamicTemplateProcessor (重複解決含む)
3. **高リスク順**: BaseGenerator統合

---

**Phase 2完了**: 影響範囲特定、依存関係分析、リスク評価
**次ステップ**: Phase 3 - 設計と計画策定