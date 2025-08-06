# GitHub Copilot カスタム指示 - {{projectName}}

## 🚨 基本原則（必須）

すべてのタスク・コマンド・ツール実行前に必ず読み込み

- [基本ルール](./instructions/base.md) - 絶対厳守事項
- [深層思考](./instructions/deep-think.md)
- [memory](./instructions/memory.md)

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

## 🔄 実行フロー

1. 基本ルール読み込み → 絶対厳守事項の確認
2. 場面に応じた専用ファイル読み込み → 具体的な実行ルール確認

- 例：実装時 → プロジェクトドキュメント索引 を参照

3. 参照確認の明示 → `✅️:{filename.md}` で表示
4. 実行 → ルールに従って作業実行