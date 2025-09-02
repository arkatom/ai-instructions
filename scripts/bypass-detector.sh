#!/bin/bash
# バイパス検出・記録システム

set -e

BYPASS_LOG=".github/bypass-audit.json"
BYPASS_TYPE=""
BYPASS_REASON=""
USER=$(git config user.name || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# バイパス検出関数
detect_bypass() {
  # git commit --no-verify の検出
  if [[ "$*" == *"--no-verify"* ]]; then
    BYPASS_TYPE="pre-commit-skip"
    echo "⚠️ WARNING: --no-verify detected!"
    require_justification
  fi
  
  # gh pr merge --admin の検出
  if [[ "$*" == *"--admin"* ]]; then
    BYPASS_TYPE="admin-merge"
    echo "⚠️ WARNING: --admin merge detected!"
    require_justification
  fi
  
  # git push --force の検出
  if [[ "$*" == *"--force"* ]] || [[ "$*" == *"-f"* ]]; then
    BYPASS_TYPE="force-push"
    echo "⚠️ WARNING: force push detected!"
    require_justification
  fi
}

# 理由記録を強制
require_justification() {
  echo "🔴 品質バイパスが検出されました。"
  echo "📝 バイパスの理由を記録する必要があります。"
  echo ""
  echo "理由を選択してください:"
  echo "1) 緊急のセキュリティ修正"
  echo "2) プロダクション障害対応"
  echo "3) CI/CDシステムの不具合"
  echo "4) テスト環境での実験"
  echo "5) その他（詳細を入力）"
  
  read -p "選択 (1-5): " choice
  
  case $choice in
    1) BYPASS_REASON="emergency-security-fix" ;;
    2) BYPASS_REASON="production-incident" ;;
    3) BYPASS_REASON="ci-cd-failure" ;;
    4) BYPASS_REASON="test-environment" ;;
    5) 
      read -p "詳細な理由: " custom_reason
      BYPASS_REASON="custom: $custom_reason"
      ;;
    *)
      echo "❌ 無効な選択です。バイパスは拒否されました。"
      exit 1
      ;;
  esac
  
  # 二次確認
  echo ""
  echo "⚠️ 本当にバイパスしますか？これは監査ログに記録されます。"
  read -p "続行しますか？ (yes/no): " confirm
  
  if [[ "$confirm" != "yes" ]]; then
    echo "✅ バイパスがキャンセルされました。"
    exit 0
  fi
  
  # 監査ログに記録
  record_bypass
  
  # 通知を送信
  send_notifications
}

# 監査ログ記録
record_bypass() {
  local event=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "user": "$USER",
  "type": "$BYPASS_TYPE",
  "reason": "$BYPASS_REASON",
  "command": "$*",
  "commit_sha": "$(git rev-parse HEAD 2>/dev/null || echo 'N/A')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'N/A')"
}
EOF
)
  
  # JSONファイルに追記
  if [ -f "$BYPASS_LOG" ]; then
    jq ".bypass_events += [$event]" "$BYPASS_LOG" > tmp.json && mv tmp.json "$BYPASS_LOG"
  fi
  
  echo "📝 バイパスが監査ログに記録されました。"
}

# 通知送信
send_notifications() {
  # GitHub Issue作成
  if command -v gh &> /dev/null; then
    gh issue create \
      --title "⚠️ Quality Bypass Alert: $BYPASS_TYPE by $USER" \
      --body "## Bypass Event Detected

**Type:** $BYPASS_TYPE
**User:** $USER
**Reason:** $BYPASS_REASON
**Timestamp:** $TIMESTAMP
**Branch:** $(git branch --show-current)

This bypass has been recorded in the audit log.
Please review and ensure this was justified." \
      --label "bypass-alert,quality" 2>/dev/null || true
  fi
  
  echo "📨 通知が送信されました。"
}

# 月次チェック
check_monthly_limit() {
  local current_month=$(date +%Y-%m)
  local month_count=$(jq "[.bypass_events[] | select(.timestamp | startswith(\"$current_month\"))] | length" "$BYPASS_LOG")
  local max_allowed=$(jq '.policy.max_bypasses_per_month' "$BYPASS_LOG")
  
  if [ "$month_count" -ge "$max_allowed" ]; then
    echo "🚫 今月のバイパス上限（$max_allowed回）に達しました。"
    echo "品質改善の取り組みが必要です。"
    exit 1
  fi
}

# メイン処理
detect_bypass "$@"
check_monthly_limit

# 元のコマンドを実行
exec "$@"