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
