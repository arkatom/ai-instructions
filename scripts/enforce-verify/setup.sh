#!/bin/bash

# Enforce Verify セットアップスクリプト
# Git検証強制システムをインストールします

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# プロジェクトルートから実行されているか確認
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
ENFORCE_VERIFY_PATH="$PROJECT_ROOT/scripts/enforce-verify/enforce-verify.sh"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Enforce Verify - Git検証強制システム セットアップ    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo

# スクリプトの存在確認
if [ ! -f "$ENFORCE_VERIFY_PATH" ]; then
    echo -e "${RED}エラー: enforce-verify.sh が見つかりません${NC}"
    echo "パス: $ENFORCE_VERIFY_PATH"
    exit 1
fi

# 実行権限の付与
chmod +x "$ENFORCE_VERIFY_PATH"

# シェルの検出
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    echo -e "${YELLOW}警告: シェルの自動検出に失敗しました${NC}"
    echo "手動でRCファイルを指定してください:"
    read -p "RCファイルのパス (例: ~/.zshrc): " SHELL_RC
    SHELL_NAME="unknown"
fi

# 既存のgit-guardエイリアスをチェック
if grep -q "alias git=.*git-guard" "$SHELL_RC" 2>/dev/null; then
    echo -e "${YELLOW}既存のGit Guardエイリアスを検出しました${NC}"
    echo "これをEnforce Verifyに置き換えます..."
    
    # バックアップ作成
    cp "$SHELL_RC" "$SHELL_RC.bak.$(date +%Y%m%d_%H%M%S)"
    
    # 既存のエイリアスを削除
    sed -i.tmp '/alias git=.*git-guard/d' "$SHELL_RC"
    sed -i.tmp '/# Git Guard/d' "$SHELL_RC"
    rm "$SHELL_RC.tmp" 2>/dev/null || true
fi

# 既存のEnforce Verifyエイリアスをチェック
if grep -q "alias git=.*enforce-verify" "$SHELL_RC" 2>/dev/null; then
    echo -e "${GREEN}Enforce Verify は既にセットアップされています${NC}"
    echo "再インストールしますか？ (y/n)"
    read -r REINSTALL
    if [ "$REINSTALL" != "y" ]; then
        echo "セットアップをキャンセルしました"
        exit 0
    fi
    
    # 既存のエイリアスを削除
    sed -i.tmp '/alias git=.*enforce-verify/d' "$SHELL_RC"
    sed -i.tmp '/# Enforce Verify/d' "$SHELL_RC"
    rm "$SHELL_RC.tmp" 2>/dev/null || true
fi

# エイリアスの追加
echo "" >> "$SHELL_RC"
echo "# Enforce Verify - Git検証強制システム" >> "$SHELL_RC"
echo "alias git='$ENFORCE_VERIFY_PATH'" >> "$SHELL_RC"

echo -e "${GREEN}✅ セットアップが完了しました！${NC}"
echo
echo "以下のコマンドを実行してシェルを再起動してください:"
echo -e "${YELLOW}  source $SHELL_RC${NC}"
echo
echo "または新しいターミナルを開いてください。"
echo
echo -e "${BLUE}動作確認:${NC}"
echo "  git commit --no-verify -m \"test\"  # これはブロックされます"
echo "  git commit -m \"test\"              # これは正常に動作します"
echo
echo -e "${YELLOW}アンインストール方法:${NC}"
echo "  ./scripts/enforce-verify/uninstall.sh"