# Read Models

## 読み込みモデル設計

### 基本概念
- **目的**: クエリに最適化されたデータ構造
- **特徴**: 非正規化、事前計算、キャッシュ友好的
- **更新**: イベントドリブンまたはバッチ処理

## 実装パターン

### プロジェクション
```typescript
class OrderProjection {
  async handle(event: DomainEvent): Promise<void> {
    switch(event.type) {
      case 'OrderCreated':
        await this.createOrderView(event);
        break;
      case 'OrderItemAdded':
        await this.updateOrderItems(event);
        break;
      case 'OrderShipped':
        await this.updateOrderStatus(event);
        break;
    }
  }
  
  private async createOrderView(event: OrderCreatedEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO order_views (id, customer_id, status, created_at)
      VALUES ($1, $2, $3, $4)
    `, [event.orderId, event.customerId, 'PENDING', event.timestamp]);
  }
}
```

### 非正規化ビュー
```sql
-- 結合を事前計算
CREATE MATERIALIZED VIEW order_summary_view AS
SELECT 
  o.id,
  o.status,
  c.name as customer_name,
  c.email as customer_email,
  SUM(oi.quantity * oi.price) as total,
  COUNT(oi.id) as item_count,
  o.created_at
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, c.name, c.email;

-- インデックス追加
CREATE INDEX idx_order_summary_customer ON order_summary_view(customer_email);
CREATE INDEX idx_order_summary_date ON order_summary_view(created_at DESC);
```

## 更新戦略

### イベントドリブン更新
```typescript
class EventProjector {
  constructor(
    private eventStore: EventStore,
    private projections: Projection[]
  ) {}
  
  async start(): Promise<void> {
    // イベントストリームを購読
    const stream = await this.eventStore.subscribe('$all');
    
    for await (const event of stream) {
      await this.projectEvent(event);
    }
  }
  
  private async projectEvent(event: DomainEvent): Promise<void> {
    // 並列でプロジェクション更新
    await Promise.all(
      this.projections.map(p => p.handle(event))
    );
  }
}
```

### スナップショット戦略
```typescript
class SnapshotProjection {
  async rebuild(fromEventNumber: number = 0): Promise<void> {
    // 既存データクリア
    await this.db.query('TRUNCATE TABLE read_model');
    
    // イベントから再構築
    const events = await this.eventStore.getEvents(fromEventNumber);
    
    for (const batch of this.chunk(events, 1000)) {
      await this.processBatch(batch);
    }
    
    // スナップショット作成
    await this.createSnapshot();
  }
}
```

## データストア選択

### 用途別選択
| 用途 | データストア | 理由 |
|------|------------|------|
| 全文検索 | Elasticsearch | 高速検索、ファセット |
| リアルタイム集計 | Redis | 低レイテンシ、カウンター |
| 複雑なクエリ | PostgreSQL | SQL、トランザクション |
| グラフ探索 | Neo4j | 関係性クエリ |
| 時系列データ | InfluxDB | 時系列最適化 |

## 一貫性管理

### 結果整合性
```typescript
class EventuallyConsistentProjection {
  async handle(event: DomainEvent): Promise<void> {
    const maxRetries = 3;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.updateReadModel(event);
        await this.markEventProcessed(event.id);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          await this.sendToDeadLetter(event, error);
        }
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
}
```

## パフォーマンス最適化

### インデックス設計
```sql
-- 複合インデックス
CREATE INDEX idx_orders_multi ON orders(customer_id, status, created_at DESC);

-- 部分インデックス
CREATE INDEX idx_active_orders ON orders(created_at) 
WHERE status IN ('PENDING', 'PROCESSING');

-- カバリングインデックス
CREATE INDEX idx_order_covering ON orders(id, customer_id, total) 
INCLUDE (status, created_at);
```

### キャッシング
```typescript
class CachedReadModel {
  constructor(
    private cache: Cache,
    private db: Database
  ) {}
  
  async get(id: string): Promise<any> {
    // L1キャッシュ: アプリケーション
    const cached = await this.cache.get(id);
    if (cached) return cached;
    
    // L2キャッシュ: Redis
    const redis = await this.redis.get(id);
    if (redis) {
      await this.cache.set(id, redis);
      return redis;
    }
    
    // DB読み込み
    const data = await this.db.findById(id);
    await this.cache.set(id, data, 300);
    await this.redis.setex(id, 3600, data);
    return data;
  }
}
```

## 監視

### メトリクス
```typescript
class MonitoredProjection {
  async handle(event: DomainEvent): Promise<void> {
    const timer = this.metrics.timer('projection.latency');
    
    try {
      await this.project(event);
      this.metrics.increment('projection.success');
    } catch (error) {
      this.metrics.increment('projection.error');
      throw error;
    } finally {
      timer.end();
    }
  }
}
```

## ベストプラクティス

✅ **推奨**:
- イベント順序の保証
- イデンポテント更新
- 定期的な整合性チェック
- 適切なインデックス設計
- バージョニング戦略

❌ **避けるべき**:
- 同期的な更新要求
- 無制限のデータ成長
- 複雑なビジネスロジック
- トランザクション依存
- リアルタイム一貫性の期待