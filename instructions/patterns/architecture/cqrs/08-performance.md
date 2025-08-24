# Performance Optimization

## パフォーマンス戦略

### 測定指標
- **コマンド処理**: < 100ms（P99）
- **クエリ応答**: < 50ms（P99）
- **イベント投影遅延**: < 1秒
- **スループット**: 10,000 req/s

## クエリ最適化

### インデックス戦略
```sql
-- 複合インデックス（頻繁なフィルタ条件）
CREATE INDEX idx_orders_filter ON orders(status, customer_id, created_at DESC);

-- カバリングインデックス（SELECT句を含む）
CREATE INDEX idx_orders_covering ON orders(id) INCLUDE (total, status);

-- 部分インデックス（特定条件のみ）
CREATE INDEX idx_pending_orders ON orders(created_at) WHERE status = 'PENDING';
```

### クエリ実行計画
```typescript
class QueryOptimizer {
  async analyzeQuery(sql: string): Promise<void> {
    const plan = await this.db.query(`EXPLAIN ANALYZE ${sql}`);
    
    if (plan.cost > 1000) {
      this.logger.warn('Expensive query detected', { sql, plan });
    }
  }
}
```

## キャッシング

### 多層キャッシュ
```typescript
class MultiLayerCache {
  async get(key: string): Promise<any> {
    // L1: プロセスメモリ（5MB、100ms TTL）
    let value = this.memoryCache.get(key);
    if (value) return value;
    
    // L2: Redis（1GB、5分 TTL）
    value = await this.redis.get(key);
    if (value) {
      this.memoryCache.set(key, value, 100);
      return value;
    }
    
    // L3: DB
    value = await this.db.findOne(key);
    await this.warmCache(key, value);
    return value;
  }
}
```

### キャッシュ無効化
```typescript
class CacheInvalidation {
  @EventHandler(EntityUpdated)
  async invalidate(event: EntityUpdatedEvent): Promise<void> {
    // 特定キー無効化
    await this.cache.delete(`entity:${event.entityId}`);
    
    // パターンマッチ無効化
    await this.cache.deletePattern(`list:*:${event.entityType}`);
  }
}
```

## 非同期処理

### コマンドキューイング
```typescript
class CommandQueue {
  async enqueue(command: Command): Promise<string> {
    const jobId = uuid();
    
    await this.queue.add('commands', {
      id: jobId,
      command,
      priority: this.getPriority(command),
      timestamp: Date.now()
    });
    
    return jobId; // 即座にジョブID返却
  }
}
```

### バッチ処理
```typescript
class BatchProcessor {
  async processBatch(events: Event[]): Promise<void> {
    // イベントをタイプ別にグループ化
    const grouped = this.groupBy(events, 'type');
    
    // 並列処理
    await Promise.all(
      Object.entries(grouped).map(([type, batch]) =>
        this.processTypeBatch(type, batch)
      )
    );
  }
  
  private async processTypeBatch(type: string, events: Event[]): Promise<void> {
    // バルクインサート
    await this.db.bulkInsert(
      'projections',
      events.map(e => this.toProjection(e))
    );
  }
}
```

## データベース最適化

### コネクションプール
```typescript
const dbConfig = {
  connectionLimit: 100,     // 最大接続数
  queueLimit: 0,           // キュー無制限
  waitForConnections: true,
  acquireTimeout: 60000,   // 接続取得タイムアウト
  idleTimeout: 60000       // アイドルタイムアウト
};
```

### パーティショニング
```sql
-- 時系列パーティション
CREATE TABLE events (
  id UUID,
  created_at TIMESTAMP,
  data JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## 読み込み最適化

### 投影の事前計算
```typescript
class PrecomputedProjection {
  async rebuild(): Promise<void> {
    // バックグラウンドで新バージョン構築
    await this.buildNewVersion();
    
    // アトミックスワップ
    await this.db.transaction(async tx => {
      await tx.query('ALTER TABLE projection_v2 RENAME TO projection');
      await tx.query('ALTER TABLE projection RENAME TO projection_old');
      await tx.query('DROP TABLE projection_old');
    });
  }
}
```

## 監視とプロファイリング

### APMインテグレーション
```typescript
class PerformanceMonitor {
  @Trace()
  async handleCommand(command: Command): Promise<void> {
    const span = this.apm.startSpan('command.handle');
    
    try {
      await this.handler.handle(command);
    } finally {
      span.addTags({
        'command.type': command.type,
        'command.size': JSON.stringify(command).length
      });
      span.finish();
    }
  }
}
```

### メトリクス収集
```yaml
metrics:
  - name: command_latency
    type: histogram
    labels: [command_type]
  - name: query_latency
    type: histogram
    labels: [query_type]
  - name: cache_hit_rate
    type: gauge
    labels: [cache_layer]
```

## スケーリング戦略

### 水平スケーリング
- **読み込み**: リードレプリカ追加
- **書き込み**: シャーディング
- **キャッシュ**: Redis Cluster
- **メッセージング**: Kafka パーティション

### 垂直スケーリング
- **CPU**: イベント処理の並列化
- **メモリ**: キャッシュサイズ拡大
- **I/O**: NVMe SSD、高速ネットワーク

## ベストプラクティス

✅ **推奨**:
- 適切なインデックス設計
- 積極的なキャッシング
- 非同期処理の活用
- バッチ処理の実装
- 継続的なパフォーマンス監視

❌ **避けるべき**:
- N+1クエリ問題
- 同期的な重い処理
- 無制限のデータ取得
- キャッシュの過信
- 最適化の推測