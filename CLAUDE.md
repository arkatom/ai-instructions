---
description: AI開発指示
alwaysApply: true
---

# AI開発指示

## 🎯 核心原則（必須読込）

### 品質基準
- **品質優先**: 速さより正確性と完全性
- **深層思考**: 表面的な理解を避け、本質を把握
- **価値提供**: 期待を超える成果を目指す

### 実行フロー
1. **分析** → 要求の本質を理解
2. **計画** → 最適なアプローチを選択
3. **実装** → 品質基準を満たす実行
4. **検証** → 結果の妥当性を確認

## 📚 必須参照

### コア指示（常時適用）
- [基本ルール](./instructions/core/base.md) - 絶対厳守事項
- [実装前分析](./instructions/methodologies/implementation-analysis.md) - 実装前に必須

### 場面別指示（自動判断）
| 場面 | 参照ファイル | 適用条件 |
|------|------------|---------|
| Git操作 | [Git運用](./instructions/workflows/git-complete.md) | commit/PR/branch操作時 |
| TDD開発 | [TDD手法](./instructions/methodologies/tdd.md) | テスト駆動開発時 |
| Issue管理 | [Issue駆動](./instructions/methodologies/github-idd.md) | Issue関連作業時 |
| デバッグ | [デバッグ思考](./instructions/core/debugging-thinking.md) | 問題調査・原因分析時 |
| 協働作業 | [協働インターフェース](./instructions/core/collaboration-interface.md) | 人間/AI間の情報交換時 |

### 失敗防止ガイド（常時参照）
| 技術 | 参照ファイル | 重要度 |
|------|------------|---------|
| TypeScript | [TypeScript失敗防止](./instructions/guidelines/typescript-pitfalls.md) | 必須 |
| React | [React失敗防止](./instructions/guidelines/react-pitfalls.md) | 必須 |
| JavaScript | [JavaScript失敗防止](./instructions/guidelines/javascript-pitfalls.md) | 必須 |
| Python | [Python失敗防止](./instructions/guidelines/python-pitfalls.md) | 必須 |
| Testing | [テスト失敗防止](./instructions/guidelines/testing-pitfalls.md) | 必須 |

## 🔧 ツール活用

### 優先順位
1. **専用ツール** → 利用可能なら最優先
2. **エージェント** → 複雑なタスクは適切に委任
3. **コマンド** → ツールがない場合のみ

### 記録管理
- 重要事項 → Issue/memoryに記録
- 作業記録 → [ノート形式](./instructions/note.md)で保存

## ⚠️ 重要制約

### してはいけないこと
- コード重複・散在
- 不要ファイルの放置
- 表面的な理解での実装
- 適当な推測や仮定

### 必ずすること
- 参照確認: `✅:{filename.md}`を出力
- 適当度評価: 1-10で自己評価（5以上なら再考）
- 完全性確認: ユーザーが追加質問不要な状態

## 📂 構造規約

```
project/
├── docs/          # ドキュメント集約
├── instructions/  # AI指示（このファイル群）
│   ├── core/     # 思考プロセス
│   ├── guidelines/ # 失敗防止ガイド
│   └── methodologies/ # 開発手法
├── references/    # 実装例（人間向け）
│   └── patterns/ # 具体的実装パターン
└── src/          # ソースコード
```

## 🎨 patterns/について

`references/patterns/`配下のファイルは**開発者向けリファレンス**です。
AIは必要と判断した場合のみ参照してください。
過度な具体例への依存は創造性を制限します。

---
*コンテキスト効率: 100行以内で核心を伝達*
