# ai-instructions

🤖 **ClaudeCode、Cursor、GitHub Copilot等のAI開発ツール用の包括的な開発指示テンプレートを生成するプロフェッショナルCLIツール**

[![NPM Version](https://img.shields.io/npm/v/@arkatom/ai-instructions)](https://www.npmjs.com/package/@arkatom/ai-instructions)
[![Tests](https://img.shields.io/badge/tests-110%20passing-brightgreen)](./test)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Semantic Versioning](https://img.shields.io/badge/semver-2.0.0-blue)](https://semver.org/)

[English](./README.md) | **日本語**

## 📋 概要

`ai-instructions`は、AI駆動開発環境のセットアップを効率化し、包括的な指示テンプレートと設定ファイルを生成します。プロジェクト全体でAIアシスタントとのやり取りを標準化したいチームや個人開発者に最適です。

### ✨ 主な特徴

- **🚀 即座のセットアップ**: 数秒で完全な指示セットを生成
- **🛠️ マルチツール対応**: Claude Code、GitHub Copilot、Cursor AI IDE、Cline、Windsurfをサポート
- **📚 開発テンプレート**: 主要な開発方法論ガイド（TDD、Gitワークフロー等）
- **🌐 多言語対応**: 日本語、英語、中国語のテンプレート
- **🛡️ 高度なファイル安全システム**: スマートマージによる5つの衝突解決戦略
- **⚙️ 高い設定可能性**: プロジェクト名と出力ディレクトリのカスタマイズ
- **🔒 入力検証**: プロジェクト名とパスの組み込み検証
- **🧪 実戦テスト済み**: 110の包括的なテストによる信頼性の確保
- **🔄 フォーマット変換**: Claude、Cursor、GitHub Copilot、Windsurf形式間の変換
- **🎯 エージェントテンプレート**: 70+の専門エージェントテンプレート（CLIコマンド統合は開発中 - Issue #93参照）

## 🛡️ 高度なファイル安全システム (v0.5.0)

**🚀 新機能: 5つの解決戦略によるインテリジェントな競合解決**

### 🔒 安全な使用パターン

```bash
# ✅ 推奨: インタラクティブな競合解決（デフォルト）
ai-instructions init --project-name "私のプロジェクト"

# ✅ 安全: 自動バックアップ作成
ai-instructions init --conflict-resolution backup --project-name "私のプロジェクト"

# ✅ スマート: 既存コンテンツとテンプレートをインテリジェントにマージ
ai-instructions init --conflict-resolution merge --project-name "私のプロジェクト"

# ✅ プレビュー: どのファイルが作成/変更されるか確認
ai-instructions init --preview

# ⚠️ スキップ: 競合ファイルをスキップ（非破壊的）
ai-instructions init --conflict-resolution skip --project-name "私のプロジェクト"

# 🚨 危険: 強制上書き（細心の注意を払って使用）
ai-instructions init --force --conflict-resolution overwrite
```

### 🛡️ 競合解決戦略

既存ファイルが検出された場合、5つのインテリジェントな戦略から選択できます：

| 戦略 | 動作 | 使用ケース | データ安全性 |
|------|------|-----------|------------|
| `backup` | タイムスタンプ付きバックアップを作成、新規ファイルを書き込み | **デフォルト** - 最も安全なオプション | 🟢 高 |
| `merge` | 既存+テンプレートコンテンツをインテリジェントにマージ | 既存の指示を更新 | 🟢 高 |
| `interactive` | 競合ごとに選択をプロンプト | 各ファイルの完全な制御 | 🟢 高 |
| `skip` | 競合ファイルをスキップ、非競合ファイルを作成 | 部分的な更新シナリオ | 🟢 高 |
| `overwrite` | バックアップなしで上書き | **危険** - --forceオプションと併用のみ | 🔴 なし |

## 📦 インストール

### グローバルインストール（推奨）

```bash
npm install -g @arkatom/ai-instructions
```

### ローカルプロジェクトインストール

```bash
npm install --save-dev @arkatom/ai-instructions
```

### インストールなしで使用

```bash
npx @arkatom/ai-instructions init
```

## 🚀 クイックスタート

### 基本的な使用方法

```bash
ai-instructions init
```

これにより、現在のディレクトリにAI開発指示の完全なセットが作成されます。

### 現在のステータスを確認

```bash
# 現在のディレクトリのAI指示ファイルを確認
ai-instructions status

# 特定のディレクトリを確認
ai-instructions status --directory ./my-project
```

### インタラクティブヘルプガイド

```bash
# 例付きのインタラクティブセットアップガイドを起動
ai-instructions help-interactive
```

### カスタムプロジェクトセットアップ

```bash
ai-instructions init --project-name "素晴らしいプロジェクト" --output ./my-project
```

### マルチツールサポート

異なるAI開発ツール用の指示を生成：

```bash
# Claude Code指示を生成（デフォルト）
ai-instructions init --tool claude

# GitHub Copilot指示を生成
ai-instructions init --tool github-copilot --project-name "私のプロジェクト"

# Cursor AI IDE指示を生成
ai-instructions init --tool cursor --project-name "私のプロジェクト"

# Cline AI指示を生成
ai-instructions init --tool cline --project-name "私のプロジェクト"
```

### フォーマット変換 (v0.3.0の新機能)

Claudeテンプレートを生成して他の形式に変換：

```bash
# Cursor MDC形式に変換（短縮オプション）
ai-instructions init -f cursor --project-name "私のプロジェクト"

# GitHub Copilot 2024標準に変換
ai-instructions init --output-format copilot --project-name "私のプロジェクト"

# Windsurfペアプログラミングルールに変換
ai-instructions init --output-format windsurf --project-name "私のプロジェクト"
```

### 多言語テンプレート

異なる言語でテンプレートを生成：

```bash
# 英語テンプレート
ai-instructions init --lang en --project-name "my-project"

# 日本語テンプレート（デフォルト）
ai-instructions init --lang ja --project-name "プロジェクト名"

# 中国語テンプレート
ai-instructions init --lang ch --project-name "项目名称"

# 組み合わせ: 日本語Cursor形式
ai-instructions init -f cursor --lang ja --project-name "カーソルプロジェクト"
```

### 安全な更新と移行 (v0.5.0)

```bash
# インテリジェントマージで既存プロジェクトの指示を更新
ai-instructions init --conflict-resolution merge --project-name "既存プロジェクト"

# 更新前に既存ファイルをバックアップ
ai-instructions init --conflict-resolution backup --project-name "既存プロジェクト"

# インタラクティブな更新 - ファイルごとに選択
ai-instructions init --conflict-resolution interactive --project-name "既存プロジェクト"

# 非破壊的な部分更新
ai-instructions init --conflict-resolution skip --project-name "既存プロジェクト"

# プロンプトなしのバッチモード（CI/CDセーフ）
ai-instructions init --no-interactive --conflict-resolution backup
```

## 📁 生成されるファイル構造

選択したAIツールによってファイル構造が異なります：

### Claude Code（デフォルト）
```
your-project/
├── CLAUDE.md                    # メインClaudeCode指示
└── instructions/                # 包括的な開発ガイド
    ├── core/
    │   ├── base.md             # コア開発ルール（必読）
    │   ├── deep-think.md       # 深層思考方法論
    │   └── memory.md           # メモリ管理指示
    ├── methodologies/
    │   ├── tdd.md              # テスト駆動開発
    │   ├── scrum.md            # スクラム方法論
    │   └── github-idd.md       # GitHub Issue駆動開発
    ├── workflows/
    │   └── git-complete.md     # 統合Git運用ガイド
    └── patterns/               # 設計パターンとベストプラクティス
```

### GitHub Copilot (`--tool github-copilot`)
```
your-project/
├── .github/
│   └── copilot-instructions.md # GitHub Copilotの指示
└── instructions/                # 共有開発ガイド
```

### Cursor AI IDE (`--output-format cursor`)
```
your-project/
├── .cursor/
│   └── rules/
│       └── main.mdc            # Cursor IDE設定（MDC形式）
└── instructions/                # 共有開発ガイド
```

### Windsurf AI (`--output-format windsurf`)
```
your-project/
└── .windsurfrules              # Windsurfペアプログラミングルール
```

### Cline AI (`--tool cline`)
```
your-project/
├── .clinerules/                # Cline AIルールディレクトリ
│   ├── coding-standards.md
│   ├── project-context.md
│   └── ai-behavior.md
└── instructions/                # 共有開発ガイド
```

## ⚙️ 設定オプション

### 利用可能なコマンド

| コマンド | 説明 | 例 |
|---------|------|-----|
| `init` | AI開発指示を初期化 | `ai-instructions init` |
| `status` | 現在の設定ステータスを表示 | `ai-instructions status` |
| `help-interactive` | インタラクティブヘルプガイドを起動 | `ai-instructions help-interactive` |
| `help` | コマンドのヘルプを表示 | `ai-instructions help init` |

### コマンドラインオプション

| オプション | エイリアス | 説明 | デフォルト | 例 |
|-----------|-----------|------|-----------|-----|
| `--lang` | `-l` | テンプレート言語 (en, ja, ch) | `ja` | `--lang en` |
| `--output-format` | `-f` | 出力形式 (claude, cursor, copilot, windsurf) | `claude` | `-f cursor` |
| `--output` | `-o` | 出力ディレクトリ | 現在のディレクトリ | `--output ./my-project` |
| `--project-name` | `-n` | テンプレート用プロジェクト名 | `my-project` | `--project-name "私のアプリ"` |
| `--tool` | `-t` | AIツールタイプ（レガシー、--output-formatを使用） | `claude` | `--tool cursor` |
| `--conflict-resolution` | | 🛡️ 競合解決戦略 | `backup` | `--conflict-resolution merge` |
| `--no-interactive` | | 🤖 インタラクティブな競合解決を無効化 | `false` | `--no-interactive` |
| `--no-backup` | | 🚨 自動バックアップを無効化（注意して使用） | `false` | `--no-backup` |
| `--force` | | ⚠️ 既存ファイルを強制上書き（危険） | `false` | `--force` |
| `--preview` | | 🔍 作成/変更されるファイルをプレビュー | `false` | `--preview` |

## 🔄 フォーマット変換の利点

### なぜフォーマット変換を使用するのか？

1. **🎆 単一の真実の源**: 包括的なClaudeテンプレートを維持
2. **🔄 一貫性**: すべてのツールで同じ指示を使用
3. **⚡ 効率**: 各ツール用に個別のテンプレートを作成する必要なし
4. **🔧 柔軟性**: ツール間で簡単に切り替え

### サポートされている形式

| 形式 | ファイル | 説明 |
|------|----------|------|
| `claude` | `CLAUDE.md` | 包括的なClaudeCode指示 |
| `cursor` | `.cursor/rules/main.mdc` | Cursor IDE MDC形式 |
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot 2024標準 |
| `windsurf` | `.windsurfrules` | Windsurfペアプログラミングルール |

## 📚 含まれるテンプレート

### コア指示
- **base.md**: 絶対厳守事項と基本原則
- **deep-think.md**: AIの深層思考を活用した問題解決

### 開発方法論
- **tdd.md**: Kent BeckのTDD原則と実践
- **scrum.md**: アジャイル/スクラム開発プラクティス
- **github-idd.md**: GitHub Issue駆動開発

### ワークフロー
- **git-complete.md**: 統合Git運用（ブランチ、コミット、PR、マージ）

### 設計パターン
- **general/**: 言語非依存のパターンとSOLID原則
- **typescript/**: TypeScript固有のベストプラクティス
- **python/**: Pythonイディオムとパターン

## 🏗️ アーキテクチャ

本プロジェクトは、厳密な依存関係管理を持つレイヤードアーキテクチャを採用しています。

## 🧪 テスト

```bash
# すべてのテストを実行
npm test

# ウォッチモードでテストを実行
npm test:watch

# カバレッジレポート付きでテストを実行
npm test:coverage
```

## 🤝 貢献

貢献を歓迎します！[貢献ガイドライン](./CONTRIBUTING.md)をご覧ください。

## 📄 ライセンス

MITライセンスの下で配布されています。詳細は[LICENSE](./LICENSE)ファイルを参照してください。

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/arkatom/ai-instructions/issues)
- **NPM**: [@arkatom/ai-instructions](https://www.npmjs.com/package/@arkatom/ai-instructions)
- **ドキュメント**: このREADMEと生成される指示ファイル

## 🎉 謝辞

AI駆動開発の未来を形作るすべての貢献者とユーザーに感謝します！

---

**適当度**: 0/10 - このツールは最高品質と一貫性を追求して構築されています。