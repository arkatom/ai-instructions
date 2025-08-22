# ドキュメント再構築（2025-08-19）

## 実施内容

ユーザーフィードバックに基づき、長すぎるドキュメントファイルを実用的な100行以下のファイルに再構築。

## 問題点（改善前）

- mcp-server-guide.md: 1053行
- llm-custom-instructions.md: 541行  
- figma-ai.md: 630行
- storybook.md: 557行

**問題**: LLMのコンテキストウィンドウから外れてしまい、カスタムインストラクションとして実用的でない。

## 改善後の構造

### MCPサーバー（/instructions/patterns/tools/mcp-server/）
- index.md (70行) - インデックス
- typescript-basics.md (101行) - TypeScript基本実装
- python-basics.md (107行) - Python基本実装

### LLMカスタムインストラクション（/instructions/patterns/ai/llm-instructions/）
- index.md (39行) - インデックス
- claude-optimization.md (89行) - Claude向け（XMLタグ任意）
- gpt4-optimization.md (96行) - GPT-4向け

### Storybook（/instructions/patterns/tools/storybook/）
- index.md (52行) - インデックス
- csf3-basics.md (98行) - CSF3基本実装

### Figma（/instructions/patterns/tools/figma/）
- index.md (46行) - インデックス
- ai-features.md (97行) - AI機能活用

## 設計原則

1. **100行以下厳守** - カスタムインストラクションとして実用的
2. **言語分離** - TypeScriptとPythonは別ファイル
3. **インデックス必須** - 各セクションへのナビゲーション
4. **クイックスタート** - 各インデックスに20-30行の最小実装例
5. **最新情報** - 2024年の最新仕様に準拠

## アーカイブ

古い長いファイルは `/instructions/patterns/_archive/` に移動。