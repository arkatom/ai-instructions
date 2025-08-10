#!/bin/bash

# Enforce Verify アンインストールスクリプト
# Git検証強制システムを削除します

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Enforce Verify - アンインストール                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo

# シェルの検出
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    # 複数のRCファイルをチェック
    for RC in "$HOME/.zshrc" "$HOME/.bashrc"; do
        if [ -f "$RC" ] && grep -q "enforce-verify" "$RC" 2>/dev/null; then
            SHELL_RC="$RC"
            SHELL_NAME="$(basename $RC .rc)"
            break
        fi
    done
    
    if [ -z "$SHELL_RC" ]; then
        echo -e "${YELLOW}警告: シェルRCファイルの自動検出に失敗しました${NC}"
        echo "手動でRCファイルを指定してください:"
        read -p "RCファイルのパス (例: ~/.zshrc): " SHELL_RC
        SHELL_NAME="unknown"
    fi
fi

# Enforce Verifyエイリアスの存在確認
if ! grep -q "alias git=.*enforce-verify" "$SHELL_RC" 2>/dev/null; then
    echo -e "${YELLOW}Enforce Verify はインストールされていません${NC}"
    
    # 古いGit Guardがあるかチェック
    if grep -q "alias git=.*git-guard" "$SHELL_RC" 2>/dev/null; then
        echo -e "${YELLOW}古いGit Guardエイリアスを検出しました${NC}"
        echo "これも削除しますか？ (y/n)"
        read -r REMOVE_OLD
        if [ "$REMOVE_OLD" = "y" ]; then
            # バックアップ作成
            cp "$SHELL_RC" "$SHELL_RC.bak.$(date +%Y%m%d_%H%M%S)"
            
            # Git Guardエイリアスを削除
            sed -i.tmp '/alias git=.*git-guard/d' "$SHELL_RC"
            sed -i.tmp '/# Git Guard/d' "$SHELL_RC"
            rm "$SHELL_RC.tmp" 2>/dev/null || true
            
            echo -e "${GREEN}✅ Git Guardエイリアスを削除しました${NC}"
        fi
    fi
    
    exit 0
fi

# 確認プロンプト
echo -e "${YELLOW}本当にEnforce Verifyをアンインストールしますか？${NC}"
echo "これにより、--no-verifyフラグの使用が再び可能になります。"
echo -n "続行しますか？ (y/n): "
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "アンインストールをキャンセルしました"
    exit 0
fi

# バックアップ作成
BACKUP_FILE="$SHELL_RC.bak.$(date +%Y%m%d_%H%M%S)"
cp "$SHELL_RC" "$BACKUP_FILE"
echo -e "${BLUE}バックアップを作成しました: $BACKUP_FILE${NC}"

# エイリアスの削除
sed -i.tmp '/alias git=.*enforce-verify/d' "$SHELL_RC"
sed -i.tmp '/# Enforce Verify/d' "$SHELL_RC"
rm "$SHELL_RC.tmp" 2>/dev/null || true

# 空行の整理（連続する空行を1つに）
sed -i.tmp '/^$/N;/^\n$/d' "$SHELL_RC"
rm "$SHELL_RC.tmp" 2>/dev/null || true

echo -e "${GREEN}✅ Enforce Verify のアンインストールが完了しました！${NC}"
echo
echo "以下のコマンドを実行してシェルを再起動してください:"
echo -e "${YELLOW}  source $SHELL_RC${NC}"
echo
echo "または新しいターミナルを開いてください。"
echo
echo -e "${RED}⚠️  警告: --no-verify フラグが再び使用可能になりました${NC}"
echo "品質チェックをスキップすることは推奨されません。"
echo
echo "再インストールする場合:"
echo "  ./scripts/enforce-verify/setup.sh"