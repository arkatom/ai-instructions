# LLMカスタムインストラクション インデックス

実用的なLLMカスタムインストラクション集（各ファイル100行以下）。

## 📚 基本

- [基本原則](./basic-principles.md) - インストラクション設計の基本
- [構造化プロンプト](./structured-prompts.md) - 効果的な構造化手法

## 🤖 モデル別最適化

- [Claude向け設定](./claude-optimization.md) - Claude用最適化（最新版）
- [GPT-4向け設定](./gpt4-optimization.md) - GPT-4用最適化
- [Gemini向け設定](./gemini-optimization.md) - Gemini用最適化

## 🛠 テクニック

- [プロンプトエンジニアリング](./prompt-engineering.md) - 高度な技法
- [プロジェクト設定](./project-settings.md) - CLAUDE.md形式等

## 💡 クイックスタート

```markdown
# 最小構成（15行）

You are a helpful assistant.

## Task
[具体的なタスク]

## Context
[背景情報]

## Output
[期待する出力形式]

## Constraints
- 制約1
- 制約2
```