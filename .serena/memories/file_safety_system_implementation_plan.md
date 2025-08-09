# File Overwrite Safety System Implementation Plan

## 実装開始: 2025-08-08 (Issue #26/#16/#17統合)

### 🎯 統合要件分析
- **Issue #26**: 包括的ファイル安全性システム（5解決オプション + インテリジェントマージ）
- **Issue #16**: インタラクティブ競合解決（5選択肢システム）  
- **Issue #17**: 緊急パッチ版（基本安全機能）

### 📊 現状分析 (2025-08-08 20:45)

#### ✅ 既存実装済み機能
- `src/utils/file-conflict-handler.ts` - 完全な競合解決システム実装済み
- ConflictResolution enum: BACKUP, MERGE, INTERACTIVE, SKIP, OVERWRITE
- FileConflictHandler class: 全メソッド実装済み
- inquirer.js統合、Markdown智能マージ、タイムスタンプバックアップ

#### ❌ 未実装・問題箇所  
- `src/utils/file-utils.ts` - FileConflictHandlerが使用されていない
- `writeFileContentSafe()` - 警告表示のみ、実際の競合解決なし
- 全ジェネレータ - 非推奨`writeFileContent()`使用継続
- CLI統合 - force/safe/preview フラグ未実装

### 🔧 実装計画

#### Phase 1: コア統合 (今日中)
1. **file-utils.ts完全修正**
   - `writeFileContentSafe()` → FileConflictHandler統合
   - `writeFileContentAdvanced()` のデフォルト使用に切り替え
   - 非推奨メソッドの段階的廃止

2. **全ジェネレータ修正**
   - claude.ts, cursor.ts, github-copilot.ts
   - 安全ファイル操作への完全移行
   - force/interactiveオプション伝達

#### Phase 2: CLI統合 (1-2日)
1. **コマンドラインオプション追加**
   - `--force` - 強制上書き
   - `--safe` - 常にバックアップ
   - `--interactive` - インタラクティブ解決
   - `--conflict-strategy` - バッチ処理用

2. **非インタラクティブ環境対応**
   - CI/CDパイプライン対応
   - デフォルト戦略設定

#### Phase 3: テスト・検証 (2-3日)
1. **包括的テストスイート作成**
   - 全競合シナリオ網羅
   - インタラクティブフロー自動化
   - エッジケース検証

### 🧪 TDD実装ステップ

#### Red Phase: 失敗テスト作成
- ファイル競合検出テスト
- インタラクティブプロンプトテスト  
- 5つの解決戦略テスト
- 非インタラクティブ環境テスト

#### Green Phase: 最小実装
- file-utils.tsの完全修正
- ジェネレータ統合
- 基本CLI統合

#### Refactor Phase: 最適化
- パフォーマンス改善
- UX向上
- エラーハンドリング強化

### 💡 技術的決定事項

#### 1. 統合アーキテクチャ
```typescript
// file-utils.ts
export class FileUtils {
  // メイン安全書き込みメソッド  
  static async writeFileContentSafe(filePath: string, content: string, force?: boolean): Promise<void> {
    return this.writeFileContentAdvanced(filePath, content, { 
      force, 
      interactive: !process.env.CI,
      defaultResolution: ConflictResolution.BACKUP 
    });
  }
}
```

#### 2. デフォルト動作
- **インタラクティブ環境**: ユーザープロンプト表示
- **CI/CD環境**: 自動的にBACKUP戦略使用
- **force フラグ**: 全ての安全チェックをバイパス

#### 3. 後方互換性
- `writeFileContent()` - 段階的廃止警告
- 既存CLIフラグ全て保持
- 新しいデフォルト動作は安全側に設定

### 📋 受け入れ基準

#### 機能要件
- [ ] 全ファイル競合が実行前に検出される
- [ ] 5つの解決戦略が完全動作する  
- [ ] インタラクティブプロンプトが直感的である
- [ ] 非インタラクティブ環境で適切にフォールバックする
- [ ] 全ツール(claude, cursor, github-copilot)で一貫動作する

#### 安全性要件
- [ ] ゼロデータ損失シナリオ
- [ ] 原子的操作（全体成功または全体失敗）
- [ ] バックアップの確実な作成
- [ ] エラー時の適切なロールバック

#### パフォーマンス要件
- [ ] 競合検出 < 1秒（通常プロジェクト）
- [ ] インタラクティブプロンプト応答性
- [ ] 大ファイルでの効率的処理

### 🚀 開始準備完了

**Next Action**: file-utils.ts修正から開始
**Priority**: P0 Critical
**Expected Duration**: 3-5日
**Success Metric**: ゼロデータ損失 + 100%安全ファイル操作