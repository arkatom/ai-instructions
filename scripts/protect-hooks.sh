#!/bin/bash

# Hook integrity protection script

HOOKS_DIR=".husky"
INTEGRITY_FILE=".github/hooks-integrity.sha256"

verify() {
  echo "🔍 Verifying hook integrity..."
  
  if [ ! -f "$INTEGRITY_FILE" ]; then
    echo "⚠️ Integrity file not found. Creating..."
    generate
    return 0
  fi
  
  while IFS=' ' read -r hook expected_hash; do
    if [ -f "$HOOKS_DIR/$hook" ]; then
      actual_hash=$(sha256sum "$HOOKS_DIR/$hook" | awk '{print $1}')
      if [ "$actual_hash" != "$expected_hash" ]; then
        echo "❌ Hook tampered: $hook"
        echo "   Expected: $expected_hash"
        echo "   Actual: $actual_hash"
        exit 1
      fi
      echo "✅ $hook: OK"
    else
      echo "⚠️ Hook missing: $hook"
    fi
  done < "$INTEGRITY_FILE"
  
  echo "✅ All hooks verified"
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

case "${1:-verify}" in
  verify)
    verify
    ;;
  generate)
    generate
    ;;
  *)
    echo "Usage: $0 [verify|generate]"
    exit 1
    ;;
esac