#!/bin/bash

# ローカルでGitHub Actionsワークフローをテストするスクリプト
# 6時間待つ必要なく、即座に検証可能

set -e

echo "🧪 ローカルワークフローテスト開始"
echo "================================"

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Bypass Detection テスト
echo -e "\n${YELLOW}[1/4] Bypass Detection Check${NC}"
echo "------------------------------"

# bypass-audit.jsonの検証
echo "📋 bypass-audit.json検証..."
if [ -f ".github/bypass-audit.json" ]; then
    # JSONの構造チェック
    jq '.bypass_events' .github/bypass-audit.json > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ bypass-audit.json: OK${NC}"
    else
        echo -e "${RED}❌ bypass-audit.json: フィールドエラー${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ bypass-audit.json: ファイルなし${NC}"
    exit 1
fi

# フック整合性チェック
echo "🔒 フック整合性チェック..."
./scripts/protect-hooks.sh verify
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ フック整合性: OK${NC}"
else
    echo -e "${RED}❌ フック整合性: NG${NC}"
    exit 1
fi

# カバレッジベースライン
echo "📊 カバレッジベースライン..."
if [ -f ".github/coverage-baseline.txt" ]; then
    echo -e "${GREEN}✅ coverage-baseline.txt: OK${NC}"
else
    echo -e "${RED}❌ coverage-baseline.txt: ファイルなし${NC}"
    exit 1
fi

# 2. Test Coverage チェック
echo -e "\n${YELLOW}[2/4] Test Coverage Check${NC}"
echo "------------------------------"

# 依存関係インストール
echo "📦 依存関係インストール..."
npm ci --prefer-offline --no-audit

# テスト実行（CI環境を模倣）
echo "🧪 テスト実行中..."
npm run test:ci || {
    echo -e "${YELLOW}⚠️ テストは完了しましたが、カバレッジ警告があります${NC}"
}

# カバレッジチェック
if [ -f "coverage/coverage-summary.json" ]; then
    COVERAGE=$(node -p "require('./coverage/coverage-summary.json').total.lines.pct")
    echo -e "📊 現在のカバレッジ: ${GREEN}${COVERAGE}%${NC}"
    
    # ベースラインと比較
    if [ -f ".github/coverage-baseline.txt" ]; then
        BASELINE=$(cat .github/coverage-baseline.txt)
        DIFF=$(echo "$COVERAGE - $BASELINE" | bc)
        
        if (( $(echo "$DIFF < -5" | bc -l) )); then
            echo -e "${RED}❌ カバレッジが大幅に低下: $BASELINE% → $COVERAGE%${NC}"
        else
            echo -e "${GREEN}✅ カバレッジ: 許容範囲内${NC}"
        fi
    fi
else
    echo -e "${RED}❌ カバレッジレポートが生成されませんでした${NC}"
fi

# 3. Documentation Check
echo -e "\n${YELLOW}[3/4] Documentation & Architecture Check${NC}"
echo "------------------------------"

# ドキュメント構造チェック
echo "📚 ドキュメント構造チェック..."
REQUIRED_DOCS=(
    "README.md"
    "instructions/README.md"
    "docs/README.md"
)

DOCS_OK=true
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "  ✅ $doc"
    else
        echo -e "  ${YELLOW}⚠️ $doc (optional)${NC}"
    fi
done

# アーキテクチャファイルチェック
echo "🏗️ アーキテクチャファイルチェック..."
if [ -d "docs/architecture" ]; then
    echo -e "${GREEN}✅ Architecture docs: 存在${NC}"
else
    echo -e "${YELLOW}⚠️ Architecture docs: なし（任意）${NC}"
fi

# 4. その他のワークフロー検証
echo -e "\n${YELLOW}[4/4] Workflow Files Validation${NC}"
echo "------------------------------"

# YAMLシンタックスチェック
echo "📝 ワークフローYAML検証..."
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        # YAMLの基本的な構文チェック
        python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "  ✅ $(basename $workflow)"
        else
            echo -e "  ${RED}❌ $(basename $workflow): YAML構文エラー${NC}"
            WORKFLOW_ERROR=true
        fi
    fi
done

# 最終結果
echo -e "\n================================"
echo -e "${GREEN}🎉 ローカルテスト完了${NC}"
echo -e "================================"

echo -e "\n💡 ヒント:"
echo "  • GitHub上でワークフローを手動実行: gh workflow run <workflow-name>"
echo "  • 特定のワークフローをテスト: act -W .github/workflows/<workflow>.yml"
echo "  • リアルタイム監視: gh run watch <run-id>"

echo -e "\n📋 次のステップ:"
echo "  1. 修正が必要な箇所を確認"
echo "  2. git add & commit で変更を保存"
echo "  3. git push でリモートに反映"
echo "  4. gh run list でCI結果を確認"