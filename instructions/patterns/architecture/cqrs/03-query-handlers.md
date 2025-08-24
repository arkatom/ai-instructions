# Query Handlers

## クエリハンドラー設計

### 基本構造
```typescript
interface Query<T> {
  readonly type: string;
  readonly parameters: T;
}

class QueryHandler<TQuery extends Query<any>, TResult> {
  async handle(query: TQuery): Promise<TResult> {
    // 1. パラメータ検証
    // 2. 読み込み専用DBアクセス
    // 3. 結果変換・返却
  }
}
```

## 実装パターン

### シンプルクエリ
```typescript
class GetOrderQuery extends Query<{ orderId: string }> {}

class GetOrderHandler {
  constructor(private readDb: ReadDatabase) {}
  
  async handle(query: GetOrderQuery): Promise<OrderView> {
    const sql = `SELECT * FROM order_views WHERE id = $1`;
    const result = await this.readDb.query(sql, [query.parameters.orderId]);
    return this.mapToView(result.rows[0]);
  }
}
```

### 複雑な集計クエリ
```typescript
class GetSalesReportHandler {
  async handle(query: GetSalesReportQuery): Promise<SalesReport> {
    const sql = `
      WITH monthly_sales AS (
        SELECT DATE_TRUNC('month', created_at) as month,
               SUM(total) as revenue,
               COUNT(*) as order_count
        FROM orders
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY month
      )
      SELECT * FROM monthly_sales ORDER BY month
    `;
    
    const result = await this.readDb.query(sql, [
      query.parameters.startDate,
      query.parameters.endDate
    ]);
    
    return {
      period: query.parameters,
      data: result.rows,
      summary: this.calculateSummary(result.rows)
    };
  }
}
```

## クエリ最適化

### インデックス戦略
```sql
-- 頻繁なクエリパターンに最適化
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status) WHERE status != 'completed';
```

### マテリアライズドビュー
```sql
CREATE MATERIALIZED VIEW order_summary AS
SELECT customer_id,
       COUNT(*) as total_orders,
       SUM(total) as lifetime_value,
       MAX(created_at) as last_order_date
FROM orders
GROUP BY customer_id;

-- 定期更新
REFRESH MATERIALIZED VIEW CONCURRENTLY order_summary;
```

## キャッシング戦略

### Redisキャッシュ
```typescript
class CachedQueryHandler {
  constructor(
    private cache: RedisClient,
    private handler: QueryHandler
  ) {}
  
  async handle(query: Query): Promise<any> {
    const key = this.getCacheKey(query);
    
    // キャッシュチェック
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);
    
    // DBクエリ実行
    const result = await this.handler.handle(query);
    
    // キャッシュ保存（TTL付き）
    await this.cache.setex(key, 300, JSON.stringify(result));
    return result;
  }
}
```

## ページネーション

### カーソルベース
```typescript
class PaginatedQueryHandler {
  async handle(query: PaginatedQuery): Promise<PaginatedResult> {
    const limit = query.pageSize + 1; // 次ページ確認用
    const sql = `
      SELECT * FROM items
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `;
    
    const rows = await this.db.query(sql, [query.cursor || 0, limit]);
    const hasMore = rows.length > query.pageSize;
    
    return {
      items: rows.slice(0, query.pageSize),
      nextCursor: hasMore ? rows[query.pageSize - 1].id : null,
      hasMore
    };
  }
}
```

## GraphQL統合

```typescript
const resolvers = {
  Query: {
    order: async (_, { id }, context) => {
      const query = new GetOrderQuery({ orderId: id });
      return context.queryBus.ask(query);
    },
    
    orders: async (_, { filter, pagination }, context) => {
      const query = new SearchOrdersQuery({ filter, pagination });
      return context.queryBus.ask(query);
    }
  }
};
```

## エラーハンドリング

```typescript
class SafeQueryHandler {
  async handle(query: Query): Promise<Result<T>> {
    try {
      const result = await this.innerHandler.handle(query);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { success: false, error: 'NOT_FOUND' };
      }
      // ログ記録、メトリクス送信
      return { success: false, error: 'INTERNAL_ERROR' };
    }
  }
}
```

## パフォーマンス監視

```typescript
class MonitoredQueryHandler {
  async handle(query: Query): Promise<any> {
    const start = Date.now();
    const labels = { query_type: query.type };
    
    try {
      const result = await this.handler.handle(query);
      this.metrics.histogram('query_duration', Date.now() - start, labels);
      return result;
    } catch (error) {
      this.metrics.increment('query_errors', labels);
      throw error;
    }
  }
}
```

## ベストプラクティス

✅ **推奨**:
- 読み込み専用DB接続の使用
- 適切なインデックス設計
- キャッシュの活用
- ページネーション実装
- エラーの適切な処理

❌ **避けるべき**:
- 書き込み操作の混入
- N+1クエリ問題
- 無制限の結果返却
- キャッシュの過度な依存
- 同期的な重い処理