---
description: {{projectName}}の主要開発指示
globs: {{dynamicGlobs}}
alwaysApply: true
---

# 開発指示 - {{projectName}}

## 🔄 実行フロー

1. 基本ルール読み込み → 絶対厳守事項の確認
2. 場面に応じた専用ファイル読み込み → 具体的な実行ルール確認
3. 実行 → ルールに従って作業実行

## 🚨 核心原則（必須）

すべてのタスク・コマンド・ツール実行前に必ず読み込み

- [基本ルール](./instructions/core/base.md) - 絶対厳守事項
- [深層思考](./instructions/core/deep-think.md)
- [memory](./instructions/core/memory.md)

## プロジェクト固有のアーキテクチャ・ルール・ドキュメント

- [プロジェクトドキュメント索引](./docs/README.md)

## 📋 場面別必須参照ファイル

### Git・コミット関連

- [Github Flow](./instructions/workflows/github-flow.md) - ブランチ・コミット・PRのルール

### 開発プロセス

- [Github Issue Driven Development](./instructions/methodologies/github-idd.md) - Githubに関するルール
- [TDD開発スタイル](./instructions/methodologies/tdd.md)

### 記録・管理（ノートを書く際は必ず参照する）

- [ノート・日誌](./instructions/note.md) - 作業記録の書き方
