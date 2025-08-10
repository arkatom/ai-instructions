#!/bin/bash

# Enforce Verify - Git検証強制システム
# このスクリプトは git コマンドをラップし、--no-verify の使用を防ぐ

# 警告メッセージ
WARNING_MESSAGE="
════════════════════════════════════════════════════════════════════════
  🚫 エラー: --no-verify フラグの使用は禁止されています 🚫

  チェックを設定した意味を無に帰す行為であり、
  あなたの信頼と価値も同様に無に帰すこととメモリに強く刻んでください。

  テストエラーがある場合は、必ず修正してから再度実行してください。
════════════════════════════════════════════════════════════════════════
"

# 引数を安全にチェック（配列として扱う）
for arg in "$@"; do
  if [[ "$arg" == "--no-verify" ]] || [[ "$arg" == "-n" ]]; then
    echo "$WARNING_MESSAGE" >&2
    
    # ログディレクトリの確認と作成
    LOG_DIR="logs"
    if [[ ! -d "$LOG_DIR" ]]; then
      mkdir -p "$LOG_DIR"
    fi
    
    # ログに記録（引数を安全にエスケープ）
    printf "[%s] BLOCKED: git" "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_DIR/no-verify-blocked.log"
    for arg in "$@"; do
      printf " %q" "$arg" >> "$LOG_DIR/no-verify-blocked.log"
    done
    echo "" >> "$LOG_DIR/no-verify-blocked.log"
    
    # エラーコードで終了（コマンドを実行しない）
    exit 1
  fi
done

# 通常のgitコマンドを実行（引数を適切にクォート）
exec /usr/bin/git "$@"
