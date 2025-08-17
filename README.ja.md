# ai-instructions

AI開発指示のテンプレート生成と専門エージェントをデプロイするCLIツール

[English](./README.md) | **日本語**

[![NPM Version](https://img.shields.io/npm/v/@arkatom/ai-instructions)](https://www.npmjs.com/package/@arkatom/ai-instructions)

## 機能

`ai-instructions`はAIコーディングアシスタントとの作業を支援します：
- Claude Code、Cursor、GitHub Copilot、Cline用の完全な指示テンプレート
- 90種類の専門エージェント（orchestrator、code-reviewer、rapid-prototyper、チームの士気を高めるjokerまで！）
- 多言語サポート（英語、日本語、中国語）
- 既存プロジェクト更新時のスマートなファイル競合処理

## インストール

```bash
# グローバルインストール（推奨）
npm install -g @arkatom/ai-instructions

# または直接実行
npx @arkatom/ai-instructions init
```

## クイックスタート

### 1. 指示テンプレートの生成

```bash
# プロジェクト用の包括的なAI指示を生成
ai-instructions init

# カスタムプロジェクト名で
ai-instructions init --project-name "my-awesome-app"

# 日本語プロジェクト用
ai-instructions init --lang ja
```

これにより、AIアシスタントが開発標準に従うように導く構造化された指示セットが作成されます。

### 2. 専門エージェントのデプロイ（90種類利用可能！）

テストを書くAI？コードをレビューするAI？プログラミングジョークを言うAIまで？すべて揃っています：

```bash
# マスターオーケストレーターをデプロイ（他のエージェントを調整）
ai-instructions agents deploy orchestrator

# 品質重視のチームを構築
ai-instructions agents deploy code-reviewer test-writer-fixer

# 高速開発用
ai-instructions agents deploy rapid-prototyper frontend-developer

# 楽しさが必要？
ai-instructions agents deploy joker whimsy-injector

# カスタムエージェントを動的に作成！
ai-instructions agents deploy agent-generator
```

[全エージェントリスト](./docs/agents-list.md) | [日本語版](./docs/agents-list.ja.md)を参照

## 生成されるファイル

`init`を実行すると、以下が生成されます：

### Claude Code（デフォルト）
```
your-project/
├── CLAUDE.md                    # メイン指示ファイル
└── instructions/                # 包括的ガイド（すべての形式に含まれる）
    ├── core/                    # コア開発ルール
    │   ├── base.md             # 基本原則
    │   └── deep-think.md       # 品質優先の方法論
    ├── workflows/              # Git、GitHubワークフロー
    ├── methodologies/          # TDD、Scrumなど
    └── patterns/               # 言語固有のパターン
```

### GitHub Copilot
```
your-project/
├── .github/
│   └── copilot-instructions.md # GitHub Copilot 2024標準
└── instructions/                # 同じ包括的ガイド
```

### Cursor
```
your-project/
├── .cursor/
│   └── rules/
│       └── main.mdc            # Cursor固有の形式
└── instructions/                # 同じ包括的ガイド
```

### Cline
```
your-project/
├── .clinerules/                # Cline固有のルール
│   ├── 01-coding.md
│   └── 02-documentation.md
└── instructions/                # 同じ包括的ガイド
```

**注意**：すべての開発ガイドを含む`instructions/`ディレクトリは、すべてのツールで生成され、異なるAIアシスタント間で一貫した開発標準を提供します。

## エージェントシステムの詳細

### エージェントの仕組み

**重要**：エージェントシステムはAIアシスタント用のメタデータとプロンプトを提供します。実際のエージェント機能はAIツールの能力に依存します：

- **Claude Code**：組み込みのTaskツールを使用してエージェント機能にアクセス
- **その他のツール**：エージェントのYAMLファイルは参照プロンプトとテンプレートとして機能
- エージェントを「デプロイ」すると、そのメタデータが`./agents/`ディレクトリにインストールされます
- このメタデータにはプロンプト、ツール要件、インタラクションパターンが含まれます
- YAMLファイルからエージェントプロンプトをコピーして任意のAIアシスタントで使用できます

### 一部紹介

- **orchestrator** - マスター指揮者、マルチエージェントワークフローを管理
- **rapid-prototyper** - 数日ではなく数時間でMVPを構築
- **code-reviewer** - 厳格だが公正なコード品質の守護者
- **agent-generator** - オンデマンドで新しいカスタムエージェントを作成
- **joker** - プログラミングユーモアでチームの士気を高く保つ
- **whimsy-injector** - UIに楽しいタッチを追加

### エージェントコマンド

```bash
# 90種類すべての利用可能なエージェントを表示
ai-instructions agents list

# 任意のエージェントの詳細情報を取得
ai-instructions agents info orchestrator

# プロジェクトに基づいた推奨を取得
ai-instructions agents recommend

# プロジェクトを分析してエージェントを提案
ai-instructions agents profile ./my-project
```

## 実際の使用例

### TikTokでバイラルになるアプリの開始
```bash
# プロジェクトのセットアップ
ai-instructions init --project-name "viral-video-app"

# 必要に応じて専門エージェントをデプロイ
ai-instructions agents deploy \
  trend-researcher \
  tiktok-strategist \
  mobile-app-builder \
  app-store-optimizer
```

### エンタープライズアプリケーションの構築
```bash
# 適切な構造で初期化
ai-instructions init --project-name "enterprise-dashboard"

# エンタープライズ向けエージェントをデプロイ
ai-instructions agents deploy \
  orchestrator \
  backend-architect \
  security-auditor \
  technical-writer
```

### ハッカソン用のクイックプロトタイプ
```bash
# 高速セットアップ
ai-instructions init --project-name "hackathon-project" --conflict-resolution skip

# スピード重視のエージェントをデプロイ
ai-instructions agents deploy rapid-prototyper frontend-developer
```

## ファイル安全オプション

既存プロジェクトの更新時：

```bash
# スマートマージ（推奨）- 変更を保持＋新しいコンテンツを追加
ai-instructions init --conflict-resolution merge

# 更新前にバックアップを作成
ai-instructions init --conflict-resolution backup

# 実行内容をプレビュー
ai-instructions init --preview
```

## CLIオプション

| オプション | 説明 | デフォルト |
|--------|-------------|---------|
| `--lang` | 言語（en, ja, ch） | `en` |
| `--output` | 出力ディレクトリ | カレントディレクトリ |
| `--project-name` | プロジェクト名 | `my-project` |
| `--tool` | AIツールタイプ | `claude` |
| `--conflict-resolution` | 既存ファイルの処理方法 | `backup` |
| `--preview` | 書き込まずに変更をプレビュー | `false` |

## 開発

```bash
# クローンとインストール
git clone https://github.com/arkatom/ai-instructions.git
cd ai-instructions
npm install

# テスト実行（780以上のテスト！）
npm test

# ビルド
npm run build

# ローカルでテスト
npm run dev init
```

## なぜ使うべきか？

- **時間を節約**：毎回同じ指示を書くのをやめる
- **一貫性**：AIアシスタントがあなたの基準に従う
- **90種類の専門エージェント**：完全な開発チームを持つようなもの
- **実戦テスト済み**：本番環境で使用、包括的なテストカバレッジ

## ライセンス

MIT

---

[GitHub](https://github.com/arkatom/ai-instructions) | [npm](https://www.npmjs.com/package/@arkatom/ai-instructions) | [Issues](https://github.com/arkatom/ai-instructions/issues)