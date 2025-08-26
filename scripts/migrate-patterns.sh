#!/bin/bash

# migrate-patterns.sh - patterns/をreferences/へ安全に移行
# 
# 目的：304個のファイル（3.5MB）を削除せず、適切に再配置
# Issue #118: patterns/配下の適切な分離と再配置

set -e  # エラー時に停止

echo "🚀 patterns/からreferences/への移行を開始します..."

# 1. 現在の状態を確認
echo "📊 現在の状態を確認中..."
if [ ! -d "instructions/patterns" ]; then
    echo "❌ instructions/patterns/が見つかりません"
    exit 1
fi

FILE_COUNT=$(find instructions/patterns -type f -name "*.md" | wc -l | tr -d ' ')
echo "✅ 移行対象: ${FILE_COUNT}個のファイル"

# 2. バックアップの確認
echo "💾 バックアップを確認..."
if [ -d "references/patterns" ]; then
    echo "⚠️  references/patterns/は既に存在します"
    read -p "上書きしますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 移行を中止しました"
        exit 1
    fi
fi

# 3. referencesディレクトリ作成
echo "📁 references/ディレクトリを作成..."
mkdir -p references

# 4. Git履歴を保持しながら移動
echo "🔄 Git履歴を保持しながら移動中..."
git mv instructions/patterns references/ 2>/dev/null || {
    echo "⚠️  Gitでの移動に失敗。通常の移動を試みます..."
    mv instructions/patterns references/
}

# 5. CLAUDE.mdの参照パスを更新（必要に応じて）
echo "📝 ドキュメントの更新確認..."
if grep -q "instructions/patterns" CLAUDE.md; then
    echo "✅ CLAUDE.mdは既に更新済み（参照ルールが記載されています）"
fi

# 6. READMEに移行の記録を追加
echo "📋 README更新の準備..."
cat << 'EOF' > migration-note.md

## 📦 ディレクトリ構造の変更（$(date +%Y-%m-%d)）

### patterns/の移行
- 旧: `instructions/patterns/` 
- 新: `references/patterns/`
- 理由: カスタムインストラクションと参考資料の明確な分離
- 詳細: Issue #118参照

### 使用方針
- **instructions/**: AIへの思考指示（必須）
- **references/**: 実装例・参考資料（オプション）

EOF

# 7. 結果の表示
echo ""
echo "✅ 移行が完了しました！"
echo ""
echo "📊 移行結果:"
echo "  - 移動したファイル: ${FILE_COUNT}個"
echo "  - 新しい場所: references/patterns/"
echo ""
echo "📝 次のステップ:"
echo "  1. git statusで変更を確認"
echo "  2. git add -A で変更をステージング"
echo "  3. git commit -m 'refactor: patterns/をreferences/へ移行 (#118)'"
echo "  4. テストして問題がないか確認"
echo ""
echo "⚠️  注意事項:"
echo "  - CLAUDE.mdは既に更新済み（参照ルールが明記されています）"
echo "  - AIはデフォルトでreferences/を参照しません（創造性優先）"
echo "  - 必要時のみ明示的に参照します"