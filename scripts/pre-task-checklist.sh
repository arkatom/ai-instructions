#!/bin/bash

# タスク開始前の必須チェックリスト
# これを実行してからタスクを開始することで、適当な作業を防ぐ

RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
CYAN="\033[1;36m"
RESET="\033[0m"

echo "${CYAN}=== タスク開始前チェックリスト ===${RESET}"
echo ""

# チェック項目
CHECKS=(
  "指示内容を正確に理解しているか？"
  "作業ディレクトリは正しいか？"
  "git statusで現在の状態を確認したか？"
  "必要なファイルのバックアップは取ったか？"
  "作業計画を立てたか？"
)

ALL_PASSED=true

for i in "${!CHECKS[@]}"; do
  echo -n "[$((i+1))] ${CHECKS[$i]} (y/n): "
  read -r answer
  if [ "$answer" != "y" ]; then
    echo "${RED}   ❌ 未確認${RESET}"
    ALL_PASSED=false
  else
    echo "${GREEN}   ✅ 確認済${RESET}"
  fi
done

echo ""
if [ "$ALL_PASSED" = false ]; then
  echo "${RED}❌ チェックリストが完了していません${RESET}"
  echo "${YELLOW}すべての項目を確認してから作業を開始してください${RESET}"
  exit 1
else
  echo "${GREEN}✅ すべてのチェック完了！作業を開始できます${RESET}"
fi