# SQLAlchemy 2.0 キャッシングとインデックス戦略

Redis統合、インデックス最適化、クエリパフォーマンス監視の実装パターン。

## 💾 Redis統合キャッシング

```python
# services/caching_service.py
import redis.asyncio as redis
import json
import pickle
import hashlib
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

class CachingService:
    """高度なキャッシングサービス"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url, decode_responses=False)
        self.session = None
    
    def _make_key(self, prefix: str, **kwargs) -> str:
        """一意なキー生成"""
        key_data = f"{prefix}:{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def get_cached_query_result(
        self,
        cache_key: str,
        query_func,
        ttl: int = 300,
        **query_params
    ) -> Any:
        """クエリ結果キャッシュ - キャッシュまたはクエリ実行"""
        key = self._make_key(cache_key, **query_params)
        
        # キャッシュチェック
        cached = await self.redis.get(key)
        if cached:
            return pickle.loads(cached)
        
        # キャッシュミス - クエリ実行してキャッシュ
        result = await query_func(**query_params)
        await self.redis.setex(key, ttl, pickle.dumps(result))
        
        return result
    
    async def invalidate_pattern(self, pattern: str):
        """パターンマッチによるキャッシュ無効化"""
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)

# キャッシュ付きリポジトリパターン
class CachedUserRepository(UserRepository):
    """キャッシュ機能付きリポジトリ"""
    
    def __init__(self, session: AsyncSession, cache: CachingService):
        super().__init__(session)
        self.cache = cache
    
    async def get_user_with_stats(self, user_id: int):
        """統計情報付きユーザー取得（キャッシュ利用）"""
        
        async def fetch_user_stats(user_id: int):
            # 重いクエリの実装
            user = await self.get_by_id(user_id)
            stats = await self.session.execute(
                select(
                    func.count(Post.id).label("post_count"),
                    func.sum(Post.view_count).label("total_views")
                ).where(Post.author_id == user_id)
            )
            return {"user": user, "stats": stats.first()}
        
        return await self.cache.get_cached_query_result(
            "user_stats",
            fetch_user_stats,
            ttl=300,
            user_id=user_id
        )
    
    async def invalidate_user_cache(self, user_id: int):
        """ユーザーキャッシュ無効化"""
        await self.cache.invalidate_pattern(f"*user_id*{user_id}*")
```

## 📊 インデックス戦略

```python
# database/indexes.py
from sqlalchemy import Index, text

class OptimizedIndexes:
    """最適化されたインデックス定義"""
    
    @staticmethod
    def create_indexes():
        """パフォーマンス重視のインデックス作成"""
        
        return [
            # 複合インデックス（WHERE句の組み合わせに合わせる）
            Index(
                'idx_posts_author_published_created',
                'author_id', 'is_published', 'created_at',
                postgresql_where=text('is_deleted = false')
            ),
            
            # 部分インデックス（特定条件のみ）
            Index(
                'idx_posts_published_only',
                'created_at',
                postgresql_where=text('is_published = true AND is_deleted = false')
            ),
            
            # GINインデックス（配列・JSON検索用）
            Index(
                'idx_posts_tags_gin',
                'tags',
                postgresql_using='gin'
            ),
            
            # 式インデックス（計算フィールド用）
            Index(
                'idx_posts_engagement_score',
                text('(like_count * 2 + view_count * 0.1)'),
                postgresql_where=text('is_published = true')
            ),
        ]

# インデックス選択の原則:
# 1. WHERE句でよく使うカラムの組み合わせ
# 2. JOIN条件のカラム
# 3. ORDER BY句のカラム
# 4. 選択性の高いカラムを先頭に
# 5. 更新頻度の低いカラムを優先
```

## 🔍 クエリ最適化

```python
# database/query_optimization.py
from sqlalchemy import text

class QueryOptimizer:
    """クエリパフォーマンス分析ツール"""
    
    async def analyze_query(self, query_text: str, params: dict = None):
        """EXPLAIN ANALYZE実行"""
        explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query_text}"
        
        result = await self.session.execute(text(explain_query), params or {})
        plan = result.scalar()
        
        return {
            "execution_time": plan[0]["Execution Time"],
            "planning_time": plan[0]["Planning Time"],
            "total_cost": plan[0]["Plan"]["Total Cost"],
            "rows": plan[0]["Plan"]["Actual Rows"]
        }
    
    async def get_slow_queries(self):
        """スロークエリ検出（pg_stat_statements使用）"""
        stmt = text("""
            SELECT 
                query,
                calls,
                mean_exec_time,
                100.0 * shared_blks_hit / 
                    nullif(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio
            FROM pg_stat_statements 
            ORDER BY mean_exec_time DESC 
            LIMIT 10
        """)
        
        result = await self.session.execute(stmt)
        return [
            {
                "query": row.query,
                "avg_time": row.mean_exec_time,
                "cache_hit": row.cache_hit_ratio
            }
            for row in result
        ]
    
    async def check_index_usage(self, table_name: str):
        """インデックス使用状況確認"""
        stmt = text("""
            SELECT 
                indexname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes 
            WHERE tablename = :table_name
        """)
        
        result = await self.session.execute(stmt, {"table_name": table_name})
        
        for row in result:
            if row.idx_scan == 0:
                print(f"警告: 未使用インデックス {row.indexname}")
```

## 📈 パフォーマンス監視

```python
class PerformanceMonitor:
    """リアルタイムパフォーマンス監視"""
    
    async def get_connection_stats(self):
        """接続統計"""
        stmt = text("""
            SELECT 
                state,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (now() - state_change))) as avg_duration
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY state
        """)
        
        result = await self.session.execute(stmt)
        
        stats = {}
        for row in result:
            stats[row.state or 'idle'] = {
                "count": row.count,
                "avg_duration": row.avg_duration
            }
        
        # 警告判定
        if stats.get('active', {}).get('count', 0) > 50:
            logger.warning("アクティブ接続数が多すぎます")
        
        return stats
    
    async def get_cache_metrics(self):
        """キャッシュヒット率"""
        stmt = text("""
            SELECT 
                sum(blks_hit) * 100.0 / sum(blks_hit + blks_read) as cache_hit_ratio,
                sum(blks_read) as disk_reads,
                sum(blks_hit) as cache_hits
            FROM pg_stat_database
            WHERE datname = current_database()
        """)
        
        result = await self.session.execute(stmt)
        row = result.first()
        
        return {
            "cache_hit_ratio": row.cache_hit_ratio,
            "disk_reads": row.disk_reads,
            "cache_hits": row.cache_hits,
            "healthy": row.cache_hit_ratio > 90  # 90%以上が健全
        }
```

## 💡 最適化戦略

### キャッシング戦略
- **階層型**: Redis → アプリケーション → DB
- **TTL設定**: データ特性に応じた有効期限
- **無効化**: パターンマッチ、タグベース、イベント駆動

### インデックス設計
- **カバリング**: 全データをインデックスから取得
- **部分**: 特定条件のレコードのみ対象
- **式**: 計算結果をインデックス化

### 最適化チェックリスト
1. **EXPLAIN ANALYZE**でクエリプラン確認
2. **N+1問題**の解決（selectinload/joinedload）
3. **バルク操作**の活用
4. **不要なカラム**の除外（load_only）

### モニタリング指標
- キャッシュヒット率 > 90%、スロークエリ < 100ms、接続プール利用率 < 80%