---
description: 開発指示
globs: [
  \"**/*.css\",
  \"**/*.html\",
  \"**/*.json\",
  \"**/*.md\",
  \"**/*.txt\",
  \"**/*.xml\",
  \"**/*.yaml\",
  \"**/*.yml\",
  \"**/.env\",
  \"**/.gitignore\",
  \"**/CHANGELOG*\",
  \"**/Dockerfile\",
  \"**/LICENSE*\",
  \"**/README*\",
  \"**/docker-compose.yml\"
]
alwaysApply: true
---

# 開発指示

## 🔄 実行フロー

1. 基本ルール読み込み → 絶対厳守事項の確認
2. 場面に応じた専用ファイル読み込み → 具体的な実行ルール確認
3. 実行 → ルールに従って作業実行


## 🚨 核心原則（必須）

すべてのタスク・コマンド・ツール実行前に必ず読み込み

- [基本ルール](./instructions/core/base.md) - 絶対厳守事項
- [深層思考](./instructions/core/deep-think.md)

## プロジェクト固有のアーキテクチャ・ルール・ドキュメント

- [プロジェクトドキュメント索引](./docs/README.md)

## 📋 場面別必須参照ファイル

### Git・GitHub関連

- [Complete Git & GitHub Guide](./instructions/workflows/git-complete.md) - 統合されたGit運用ガイド

### 開発プロセス

- [TDD開発スタイル](./instructions/methodologies/tdd.md)
- [Github Issue Driven Development](./instructions/methodologies/github-idd.md)

### エージェントシステム（Claude Code専用）

- **Agent Dependency Management**: エージェント間の依存関係と協調パターンが実装済み
- 利用可能な場合は適切なエージェント選択と組み合わせを活用

### 記録・管理

- [ノート・日誌](./instructions/note.md) - 作業記録の書き方
- [Memory管理](./instructions/core/memory.md) - 重要情報の記録（必要時のみ）
