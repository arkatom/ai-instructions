#!/bin/bash

# 作業完了後の検証スクリプト
# 「完了」と言う前に必ず実行する

RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
CYAN="\033[1;36m"
RESET="\033[0m"

echo "${CYAN}=== 作業完了検証 ===${RESET}"
echo ""

ERRORS=0

# 1. 削除すべきファイルが残っていないか
echo "🔍 不要ファイルチェック..."
UNWANTED_FILES=(
  "instructions/note-*.md"
  "*.tmp"
  "*.bak"
)

for pattern in "${UNWANTED_FILES[@]}"; do
  if ls $pattern 2>/dev/null | grep -q .; then
    echo "${RED}❌ 不要ファイルが残っています: $pattern${RESET}"
    ls $pattern 2>/dev/null
    ((ERRORS++))
  fi
done

# 2. Git状態の確認
echo ""
echo "🔍 Git状態チェック..."
if [ -n "$(git status --porcelain)" ]; then
  echo "${YELLOW}⚠️ コミットされていない変更があります:${RESET}"
  git status --short
fi

# 3. 日付の確認
echo ""
echo "🔍 日付チェック..."
TODAY=$(date +%Y年%m月%d日)
echo "今日の日付: ${CYAN}$TODAY${RESET}"

# ノートファイルの日付確認
if ls docs/notes/*.md 2>/dev/null | grep -q .; then
  LATEST_NOTE=$(ls -t docs/notes/*.md | head -1)
  if [[ "$LATEST_NOTE" == *"$TODAY"* ]]; then
    echo "${GREEN}✅ 最新のノートは今日の日付です${RESET}"
  else
    echo "${YELLOW}⚠️ 最新のノートの日付を確認してください${RESET}"
    echo "   最新: $(basename "$LATEST_NOTE")"
  fi
fi

# 4. TODOリストの確認
echo ""
echo "🔍 TODOリストチェック..."
echo "${YELLOW}TODOリストはすべて完了していますか？${RESET}"
echo "（TodoWriteツールで確認してください）"

# 5. テストの実行
echo ""
echo "🔍 テスト実行..."
if npm test > /dev/null 2>&1; then
  echo "${GREEN}✅ テスト成功${RESET}"
else
  echo "${RED}❌ テスト失敗${RESET}"
  ((ERRORS++))
fi

# 結果表示
echo ""
echo "${CYAN}=== 検証結果 ===${RESET}"
if [ $ERRORS -eq 0 ]; then
  echo "${GREEN}✅ エラーなし - 作業完了を報告できます${RESET}"
else
  echo "${RED}❌ $ERRORS 個の問題があります - 修正してください${RESET}"
  exit 1
fi