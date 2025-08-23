# Rollback Strategies

## ロールバック戦略

### 1. Blue-Green Deployment
```yaml
# 即座に旧バージョンへ切り替え
deployment:
  blue: v1.0 (stable)
  green: v2.0 (new)
  switch: load_balancer.target = blue  # 瞬時切り替え
```

**利点**: 即座の切り替え、ゼロダウンタイム
**欠点**: リソース2倍必要、DBスキーマ変更が困難

### 2. Canary Deployment
```yaml
# 段階的にトラフィックを戻す
rollback_stages:
  - { version: v2.0, traffic: 10%, duration: 5m }
  - { version: v2.0, traffic: 0%, duration: immediate }  # 問題検知時
```

**利点**: リスク最小化、段階的検証
**欠点**: 複雑な設定、部分的影響

### 3. Feature Flags
```typescript
// コードはそのまま、機能だけOFF
if (featureFlag.isEnabled('new-feature')) {
  // 新機能（問題あればOFF）
} else {
  // 従来の処理
}
```

**利点**: コードデプロイ不要、即座に無効化
**欠点**: コード複雑化、フラグ管理必要

## 自動ロールバック

### メトリクスベース
```yaml
# Flagger自動ロールバック設定
analysis:
  interval: 30s
  threshold: 5
  metrics:
    - name: error-rate
      threshold: 1  # エラー率1%超で自動ロールバック
    - name: latency-p99
      threshold: 500  # P99レイテンシ500ms超で自動ロールバック
```

### ヘルスチェック
```javascript
// 起動時ヘルスチェック失敗で自動ロールバック
app.get('/health', (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await checkRedis(),
    external_api: await checkExternalAPI()
  };
  
  if (!Object.values(checks).every(v => v)) {
    return res.status(503).json({ status: 'unhealthy', checks });
  }
  res.json({ status: 'healthy' });
});
```

## データベースロールバック

### スキーマ変更戦略
```sql
-- 前方互換性を保つ変更
-- Step 1: カラム追加（NULL許可）
ALTER TABLE users ADD COLUMN new_field VARCHAR(255);

-- Step 2: アプリ更新（新旧両対応）
-- Step 3: データ移行
UPDATE users SET new_field = old_field WHERE new_field IS NULL;

-- Step 4: 制約追加（ロールバック可能期間後）
ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;
```

### バックアップ戦略
```bash
# デプロイ前の自動バックアップ
pg_dump prod_db > backup_$(date +%Y%m%d_%H%M%S).sql

# ポイントインタイムリカバリ
pg_restore --time="2024-01-15 14:30:00" prod_db
```

## Git戦略

### Revert vs Reset
```bash
# Revert: 履歴を保持（推奨）
git revert HEAD~3..HEAD
git push origin main

# Reset: 履歴を書き換え（緊急時のみ）
git reset --hard HEAD~3
git push --force-with-lease origin main
```

## Kubernetes ロールバック

```bash
# 前バージョンへロールバック
kubectl rollout undo deployment/api

# 特定リビジョンへ
kubectl rollout undo deployment/api --to-revision=3

# 履歴確認
kubectl rollout history deployment/api
```

## ロールバック手順書

### 1. 即座の対応（5分以内）
1. インシデント宣言
2. 影響範囲確認
3. ロールバック判定
4. 実行（自動/手動）

### 2. ロールバックチェックリスト
- [ ] 現在のバージョン記録
- [ ] データバックアップ確認
- [ ] 依存サービス互換性確認
- [ ] ロールバック実行
- [ ] 動作確認
- [ ] ステークホルダー通知

### 3. 事後対応
- RCA（根本原因分析）実施
- ランブック更新
- 自動化の改善
- 再発防止策の実装

## テスト戦略

### ロールバックテスト
```yaml
# 定期的なロールバック訓練
chaos_engineering:
  schedule: "0 2 * * 1"  # 毎週月曜AM2時
  scenarios:
    - deploy_bad_version
    - trigger_auto_rollback
    - verify_recovery_time
```

## 監視とアラート

### 主要メトリクス
- **デプロイ成功率**: 95%以上
- **ロールバック頻度**: 月1回以下
- **MTTR**: 30分以内
- **影響ユーザー数**: 1%未満

### アラート設定
```yaml
alerts:
  - name: high_rollback_rate
    expr: rate(deployments_rolled_back[1h]) > 0.1
    severity: critical
    action: page_oncall
```

## ベストプラクティス

✅ **推奨**:
- 前方互換性の維持
- 小さなリリース
- カナリーデプロイメント
- 自動ロールバック設定
- 定期的な訓練

❌ **避けるべき**:
- 破壊的変更の直接適用
- テストなしのロールバック
- 手動のみの手順
- バックアップなしの変更
- ロールバック手順の未文書化