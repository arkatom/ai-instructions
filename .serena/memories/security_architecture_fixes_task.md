# セキュリティ・アーキテクチャ修正タスク

## Critical Security Issues
1. ディレクトリトラバーサル脆弱性 (src/init/presets.ts)
2. JSONプロトタイプ汚染 (src/init/presets.ts, update.ts)
3. Gitフックスクリプト引数処理脆弱性

## Architecture Issues
1. CLI単一ファイル巨大化 (600行超)
2. ハードコーディング問題
3. 同期I/Oのパフォーマンス問題

## TDD実践
- 各修正に対するテストを先に書く
- Red → Green → Refactor サイクル遵守