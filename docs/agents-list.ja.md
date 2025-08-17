# 利用可能なエージェント

## 概要

ai-instructionsプロジェクトには、AI開発ワークフローを強化する90個の専門エージェントが含まれています。これらのエージェントは`agents deploy`コマンドでデプロイできます。

## メインオーケストレーター

### 🌈 orchestrator
**すべてのエージェントのマスター指揮者** - 複雑なマルチドメインタスクのために複数のサブエージェントを調整します。複数の専門家が協力する必要がある場合、オーケストレーターがワークフロー全体を管理します。

## カテゴリー

### 🚀 開発 (20エージェント)
機能構築、システム実装、アプリケーション作成

- **rapid-prototyper** - MVPやプルーフオブコンセプトを素早く構築
- **frontend-developer** - React、Vue、Angular UIの実装
- **backend-architect** - API設計、マイクロサービス、システムアーキテクチャ
- **fullstack-engineer** - 完全なアプリケーション開発
- **typescript-pro** - 高度なTypeScript開発
- **python-pro** - Pythonの専門知識とベストプラクティス
- **javascript-pro** - モダンJavaScript開発
- **react-pro** - Reactスペシャリスト（フックとパフォーマンス最適化）
- **nextjs-pro** - Next.js 14+ App Routerエキスパート
- **vue-specialist** - Vue.js 3 Composition APIエキスパート
- **angular-expert** - Angular 17+エンタープライズアプリケーション
- **golang-pro** - Go言語と並行プログラミング
- **rust-pro** - Rustシステムプログラミング
- **java-enterprise** - Spring Bootとエンタープライズ Java
- **database-specialist** - SQL/NoSQLデータベース設計
- **mobile-app-builder** - React Nativeとモバイル開発
- **devops-automator** - CI/CDパイプラインと自動化
- **test-writer-fixer** - 包括的なテスト作成と修正
- **studio-backend-architect** - スタジオ固有のバックエンドパターン
- **frontend-specialist** - モダンフロントエンドフレームワーク

### ✅ 品質 (11エージェント)
コード品質、セキュリティ、パフォーマンスの確保

- **code-reviewer** - 徹底的なコードレビューとベストプラクティス
- **test-engineer** - テスト戦略と自動化
- **security-auditor** - 脆弱性評価とセキュリティ
- **performance-tester** - 負荷テストとベンチマーキング
- **accessibility-auditor** - WCAG準拠とインクルーシブデザイン
- **e2e-test-specialist** - PlaywrightとCypressテスト
- **api-tester** - APIテストとコントラクト検証
- **test-results-analyzer** - テストメトリクスと洞察
- **performance-benchmarker** - スピードと最適化分析
- **tool-evaluator** - フレームワークとツールの評価
- **studio-workflow-optimizer** - ワークフロー効率の改善

### 💼 ビジネス (19エージェント)
製品戦略、マーケティング、成長

- **trend-researcher** - 市場トレンドとバイラル機会
- **product-strategist** - 製品ロードマップとポジショニング
- **project-manager** - スプリント計画と調整
- **business-analyst** - 要件とプロセス最適化
- **tiktok-strategist** - TikTokマーケティングとバイラルコンテンツ
- **app-store-optimizer** - ASOとアプリストアプレゼンス
- **growth-hacker** - ユーザー獲得と維持
- **content-creator** - コンテンツ戦略とコピーライティング
- **feedback-synthesizer** - ユーザーフィードバック分析
- **sprint-prioritizer** - 6日サイクルの機能優先順位付け
- **project-shipper** - ローンチ調整とGo-to-Market
- **studio-producer** - チーム間調整
- **experiment-tracker** - A/Bテストとメトリクス
- **technical-writer** - ドキュメントとガイド
- **api-designer** - API仕様と設計
- **requirements-analyst** - 要件エンジニアリング
- **instagram-curator** - Instagramコンテンツ戦略
- **reddit-community-builder** - Redditコミュニティ管理
- **twitter-engager** - Twitter/Xエンゲージメント戦略

### 🎨 クリエイティブ (6エージェント)
デザイン、UX、ビジュアルクリエイティビティ

- **ui-designer** - 美しく機能的なインターフェース
- **ux-designer** - ユーザーエクスペリエンスとインタラクションデザイン
- **ux-researcher** - ユーザーリサーチと検証
- **brand-guardian** - ブランド一貫性とガイドライン
- **visual-storyteller** - データビジュアライゼーションとインフォグラフィックス
- **whimsy-injector** - UIに楽しさと個性を追加

### 🏗️ インフラストラクチャ (12エージェント)
DevOps、クラウド、システム管理

- **cloud-architect** - AWS、GCP、Azureアーキテクチャ
- **kubernetes-expert** - K8sクラスター管理
- **devops-engineer** - Infrastructure as Code
- **monitoring-specialist** - 観測性とアラート
- **deployment-manager** - リリースオーケストレーション
- **incident-responder** - 本番環境の問題解決
- **infrastructure-maintainer** - システムヘルスとスケーリング
- **performance-engineer** - システム最適化
- **support-responder** - カスタマーサポート自動化
- **analytics-reporter** - メトリクスと洞察
- **finance-tracker** - コスト最適化と予算管理
- **legal-compliance-checker** - 規制コンプライアンス

### 🤖 データ＆AI (7エージェント)
機械学習、データサイエンス、AI統合

- **ai-engineer** - LLM統合とAI機能
- **data-scientist** - 統計分析とML
- **data-engineer** - データパイプラインとETL
- **mlops-engineer** - MLデプロイメントと運用
- **prompt-engineer** - プロンプト最適化とRAG
- **analytics-engineer** - dbtとモダンデータスタック
- **studio-ai-engineer** - スタジオ固有のAI実装

### 🔧 専門 (14エージェント)
ユニークで専門的な機能

- **agent-generator** - 新しいカスタムエージェントを動的に作成
- **joker** - プログラミングユーモアとチームモラル
- **error-detective** - 高度なデバッグと根本原因分析
- **workflow-optimizer** - 人間とAIのコラボレーション効率
- **context-manager** - セッションとメモリ管理
- **documentation-writer** - 自動ドキュメント生成
- **fintech-specialist** - 金融技術と決済
- **healthcare-dev** - HIPAA準拠と医療システム
- **game-developer** - Unity、Unreal、ゲームメカニクス
- **ecommerce-expert** - Eコマースプラットフォームとチェックアウト
- **embedded-engineer** - IoTと組み込みシステム
- **blockchain-developer** - Web3とスマートコントラクト
- **mobile-developer** - ネイティブiOSとAndroid
- **studio-coach** - エージェントパフォーマンスコーチング

## 使用例

```bash
# 複雑なタスク用にオーケストレーターをデプロイ
ai-instructions agents deploy orchestrator

# 開発チームをデプロイ
ai-instructions agents deploy rapid-prototyper code-reviewer test-writer-fixer

# TikTokアプリ開発用にデプロイ
ai-instructions agents deploy tiktok-strategist mobile-app-builder app-store-optimizer

# 楽しい専門エージェントをデプロイ
ai-instructions agents deploy joker whimsy-injector

# エージェントの詳細情報を取得
ai-instructions agents info agent-generator

# プロジェクト固有の推奨事項を取得
ai-instructions agents recommend
```

## エージェントの依存関係

一緒に使うと効果的なエージェント：
- `test-writer-fixer` + `code-reviewer` - 品質保証チーム
- `ui-designer` + `frontend-developer` - デザイン実装
- `orchestrator` + 任意の専門家 - 複雑なマルチドメインタスク
- `trend-researcher` + `tiktok-strategist` - バイラルコンテンツ作成

## 注記

- Claude Code用：エージェントは`./.claude/agents/`ディレクトリにMDファイルとしてデプロイされます
- その他のツール用：エージェントは`./agents/`ディレクトリにデプロイできます
- `agents list`を使用してすべての利用可能なエージェントを表示
- `agents info <name>`でエージェントの詳細情報を取得
- `agents deploy-all`を使用してすべてのエージェントを一度にデプロイ
- オーケストレーターは複数のエージェントを自動的に調整できます