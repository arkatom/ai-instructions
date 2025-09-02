#!/bin/bash
# pre-commitフック保護システム

set -e

HOOKS_DIR=".husky"
PROTECTED_HASH_FILE=".github/hooks-integrity.sha256"

# フックの整合性チェック
verify_hooks_integrity() {
  echo "🔍 フックの整合性を検証中..."
  
  # 現在のフックのハッシュを計算
  local current_hash=$(find "$HOOKS_DIR" -type f -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)
  
  # 保護されたハッシュと比較
  if [ -f "$PROTECTED_HASH_FILE" ]; then
    local protected_hash=$(cat "$PROTECTED_HASH_FILE")
    
    if [ "$current_hash" != "$protected_hash" ]; then
      echo "🚨 警告: pre-commitフックが改竄されています！"
      echo "期待値: $protected_hash"
      echo "現在値: $current_hash"
      
      # 自動修復を試みる
      restore_hooks
      
      # 改竄を記録
      record_tampering
      
      return 1
    fi
  else
    # 初回実行時はハッシュを保存
    echo "$current_hash" > "$PROTECTED_HASH_FILE"
    echo "✅ フックの保護ハッシュを記録しました。"
  fi
  
  echo "✅ フックの整合性が確認されました。"
}

# フックの自動復元
restore_hooks() {
  echo "🔧 フックを復元中..."
  
  # バックアップから復元
  if [ -d ".husky.backup" ]; then
    rm -rf "$HOOKS_DIR"
    cp -r ".husky.backup" "$HOOKS_DIR"
    echo "✅ フックが復元されました。"
  else
    echo "❌ バックアップが見つかりません。手動での修復が必要です。"
    exit 1
  fi
}

# 改竄記録
record_tampering() {
  local event=$(cat <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "type": "hook-tampering",
  "user": "$(git config user.name || echo 'unknown')",
  "action": "automatic-restoration"
}
EOF
)
  
  # 監査ログに追記
  if [ -f ".github/bypass-audit.json" ]; then
    jq ".bypass_events += [$event]" ".github/bypass-audit.json" > tmp.json && mv tmp.json ".github/bypass-audit.json"
  fi
  
  # 即座に通知
  if command -v gh &> /dev/null; then
    gh issue create \
      --title "🚨 CRITICAL: Pre-commit Hook Tampering Detected" \
      --body "Hook integrity check failed. Automatic restoration attempted." \
      --label "security,critical" 2>/dev/null || true
  fi
}

# 定期的な整合性チェック（CI/CDで実行）
periodic_integrity_check() {
  while true; do
    verify_hooks_integrity
    sleep 3600  # 1時間ごとにチェック
  done
}

# バックアップ作成
create_backup() {
  cp -r "$HOOKS_DIR" ".husky.backup"
  echo "✅ フックのバックアップを作成しました。"
}

# メイン処理
case "${1:-}" in
  verify)
    verify_hooks_integrity
    ;;
  backup)
    create_backup
    ;;
  monitor)
    periodic_integrity_check
    ;;
  *)
    echo "Usage: $0 {verify|backup|monitor}"
    exit 1
    ;;
esac