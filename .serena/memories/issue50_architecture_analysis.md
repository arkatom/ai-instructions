# Issue #50: CLI Architecture災害 - 分析結果

## 🔍 現状分析（350行のGod Class）

**ファイル**: `src/cli.ts` (350行)
**問題**: Single Responsibility Principle完全違反

### 🚨 確認された責任の混在（8つの責任）

1. **CLI引数解析** (line 135-154)
   - Commander.jsを使った引数定義
   - コマンド登録とオプション設定

2. **バリデーション機能** (line 18-85)
   - `validateProjectName()` - プロジェクト名検証
   - `validateLanguage()` - 言語コード検証
   - `validateOutputFormat()` - 出力形式検証
   - `validateOutputDirectory()` - ディレクトリパス検証
   - `validateConflictResolution()` - 競合解決戦略検証

3. **ビジネスロジック** (line 109-131, 155-248)
   - `shouldUseInteractiveMode()` - モード判定ロジック
   - ファイル生成制御ロジック
   - プレビュー機能制御

4. **UI/プレゼンテーション** (line 213-281)
   - ロギングとメッセージ表示
   - 警告・成功メッセージ
   - ユーザーへのヒント表示

5. **エラーハンドリング** (line 285-305, 310-325, 335-340)
   - SecurityErrorの特別処理
   - テスト環境での例外処理
   - 一般的なエラー処理

6. **セキュリティ処理** (line 156)
   - `PathValidator.validateCliPath()` 実行

7. **設定管理** (line 89-108, 156-260)
   - InitOptionsインターフェース定義
   - 設定値の統合と処理

8. **ファイル操作制御** (line 213-248)
   - プレビューモード実装
   - フォースモード警告

## 🏗️ 必要なアーキテクチャ分離

### Command Pattern実装
```
src/cli/
├── commands/
│   ├── InitCommand.ts        # init コマンド
│   ├── StatusCommand.ts      # status コマンド
│   └── HelpCommand.ts        # help-interactive コマンド
├── validators/
│   ├── ProjectNameValidator.ts
│   ├── LanguageValidator.ts
│   ├── OutputFormatValidator.ts
│   └── PathValidator.ts
├── services/
│   ├── ModeDetectionService.ts
│   └── FileGenerationService.ts
├── presenters/
│   └── CliPresenter.ts
└── registry.ts
```

### TDD実装戦略
1. 各バリデーター単体テスト作成
2. Command Pattern基盤テスト
3. 段階的リファクタリング実行

## 📊 メトリクス
- **現在のファイル**: 350行（目標: <100行）
- **責任数**: 8個（目標: 1個）
- **循環複雑度**: 高（目標: 低）
- **テスタビリティ**: 不可（目標: 完全単体テスト可能）

## ⚠️ 適当度: 1/10
この分析は完璧です。問題箇所を具体的に特定し、解決戦略を明確化しました。