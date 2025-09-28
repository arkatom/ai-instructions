#!/bin/bash

# Hook integrity protection script

HOOKS_DIR=".husky"
INTEGRITY_FILE=".github/hooks-integrity.sha256"

verify() {
  echo "🔍 フックの整合性を検証中..."
  
  if [ ! -f "$INTEGRITY_FILE" ]; then
    echo "⚠️ 整合性ファイルが見つかりません。生成中..."
    generate
    return 0
  fi
  
  local has_error=0
  while IFS=' ' read -r hook expected_hash; do
    if [ -f "$HOOKS_DIR/$hook" ]; then
      actual_hash=$(sha256sum "$HOOKS_DIR/$hook" | awk '{print $1}')
      if [ "$actual_hash" != "$expected_hash" ]; then
        echo "🚨 警告: ${hook}フックが改竄されています！"
        echo "期待値: $hook $expected_hash"
        echo "現在値: $actual_hash"
        
        # バックアップからの復元を試みる
        echo "🔧 フックを復元中..."
        if [ -f "$HOOKS_DIR/.backup/$hook" ]; then
          cp "$HOOKS_DIR/.backup/$hook" "$HOOKS_DIR/$hook"
          echo "✅ バックアップから復元しました: $hook"
        else
          echo "❌ バックアップが見つかりません。手動での修復が必要です。"
          has_error=1
        fi
      else
        echo "✅ $hook: 正常"
      fi
    else
      echo "⚠️ フックが見つかりません: $hook"
      has_error=1
    fi
  done < "$INTEGRITY_FILE"
  
  if [ $has_error -eq 0 ]; then
    echo "✅ すべてのフックが検証されました"
  else
    exit 1
  fi
}

generate() {
  echo "📝 Generating hook integrity hashes..."
  > "$INTEGRITY_FILE"
  
  for hook in "$HOOKS_DIR"/*; do
    if [ -f "$hook" ]; then
      hook_name=$(basename "$hook")
      hash=$(sha256sum "$hook" | awk '{print $1}')
      echo "$hook_name $hash" >> "$INTEGRITY_FILE"
      echo "✅ Generated hash for $hook_name"
    fi
  done
  
  echo "✅ Integrity file generated: $INTEGRITY_FILE"
}

backup() {
  echo "💾 フックをバックアップ中..."
  mkdir -p "$HOOKS_DIR/.backup"
  
  for hook in "$HOOKS_DIR"/*; do
    if [ -f "$hook" ] && [ "$(basename "$hook")" != ".backup" ]; then
      hook_name=$(basename "$hook")
      cp "$hook" "$HOOKS_DIR/.backup/$hook_name"
      echo "✅ バックアップ完了: $hook_name"
    fi
  done
  
  echo "✅ すべてのフックをバックアップしました"
}

case "${1:-verify}" in
  verify)
    verify
    ;;
  generate)
    generate
    backup
    ;;
  backup)
    backup
    ;;
  *)
    echo "Usage: $0 [verify|generate|backup]"
    exit 1
    ;;
esac