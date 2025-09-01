# リリース品質ゲート設計

## 問題認識
- mainへのプッシュで無条件にNPMパブリッシュ
- 品質チェックが不十分
- 「適当な修正」も自動公開のリスク

## 設計原則（CLAUDE.md準拠）
1. **品質優先**: リリース前の厳格な検証
2. **深層思考**: 変更の影響を十分に評価
3. **価値提供**: ユーザーに価値ある変更のみ公開

## 提案する品質ゲート

### レベル1: 自動品質チェック
- TypeScript strict mode通過
- 全テストカバレッジ80%以上
- ESLintエラー0
- パフォーマンステスト通過

### レベル2: セマンティックバージョニング
- feat: minor version
- fix: patch version  
- chore: no release
- BREAKING CHANGE: major version

### レベル3: リリース承認フロー
- Prerelease → Canary → Stable
- 手動承認ゲート追加
- ロールバック戦略明確化

### レベル4: 品質メトリクス
- バンドルサイズ監視
- 依存関係セキュリティチェック
- Breaking change検出
- ユーザー影響評価