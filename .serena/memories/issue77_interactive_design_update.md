# Issue #77: インタラクティブエージェント選択システム設計更新

## 更新日: 2025年8月13日

## 主要な設計改善

### 1. 段階的インタラクティブ選択
- プロジェクトタイプ → 技術スタック → 重視領域 → エージェント推薦
- 各段階で複数選択可能
- ユーザーの選択に基づく動的推薦

### 2. 動的orchestrator.md生成
選択されたエージェントに基づいて自動生成：
- エージェント一覧と役割
- 依存関係マトリックス
- フェーズ別推奨組み合わせ
- タスク別推奨エージェント

### 3. コマンド体系
```bash
# インタラクティブ（デフォルト）
ai-instructions agents init        # ウィザード
ai-instructions agents add         # 追加ウィザード

# orchestrator制御
ai-instructions agents orchestrator --generate
ai-instructions agents orchestrator --update

# 非インタラクティブ（CI/CD）
ai-instructions agents init --all-inclusive --yes
```

### 4. エージェント関係性定義
```yaml
collaborates_well_with: [...]
conflicts_with: [...]
requires: [...]
enhances: [...]
```

## 実装フェーズ
1. Phase 1: 基本的なインタラクティブ選択
2. Phase 2: orchestrator.md自動生成
3. Phase 3: エージェント間の協調パターン

## ユーザー要望の反映
- ✅ 段階的選択プロセス
- ✅ 複数選択可能
- ✅ orchestrator.md動的生成
- ✅ 全部入りオプション
- ✅ 個別追加でも同様のインタラクティブ選択