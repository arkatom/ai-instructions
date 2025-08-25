# SQLAlchemy 2.0 キャッシングとインデックス戦略

Redis統合キャッシング、高度なインデックス戦略、クエリ最適化とパフォーマンス監視の実装パターン。

## 💾 キャッシング戦略

### Redis統合キャッシング

```python
# services/caching_service.py
import redis.asyncio as redis
import json
import pickle
from typing import Any, Optional, Dict, List
from datetime import timedelta
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from models.post import Post
from models.user import User, UserFollow


class CachingService:
    """高度なキャッシングサービス"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url, decode_responses=False)
        self.session = None  # セッション注入用
    
    def set_session(self, session: AsyncSession):
        """セッション設定"""
        self.session = session
    
    def _make_key(self, prefix: str, **kwargs) -> str:
        """キー生成"""
        key_data = f"{prefix}:{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def get_cached_query_result(
        self,
        cache_key: str,
        query_func,
        ttl: int = 300,
        **query_params
    ) -> Any:
        """クエリ結果キャッシュ"""
        
        key = self._make_key(cache_key, **query_params)
        
        # キャッシュから取得試行
        cached = await self.redis.get(key)
        if cached:
            return pickle.loads(cached)
        
        # キャッシュミス - クエリ実行
        result = await query_func(**query_params)
        
        # キャッシュに保存
        serialized = pickle.dumps(result)
        await self.redis.setex(key, ttl, serialized)
        
        return result
    
    async def invalidate_pattern(self, pattern: str):
        """パターンマッチによるキャッシュ無効化"""
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)
    
    async def get_popular_posts_cached(
        self,
        limit: int = 10,
        ttl: int = 600
    ) -> List[Dict[str, Any]]:
        """人気投稿キャッシュ"""
        
        cache_key = f"popular_posts:{limit}"
        cached = await self.redis.get(cache_key)
        
        if cached:
            return json.loads(cached)
        
        # データベースクエリ
        stmt = (
            select(Post, User.username.label("author_username"))
            .join(User, Post.author_id == User.id)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by((Post.like_count + Post.view_count * 0.1).desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        posts_data = []
        
        for row in result:
            posts_data.append({
                "id": row.Post.id,
                "title": row.Post.title,
                "author_username": row.author_username,
                "like_count": row.Post.like_count,
                "view_count": row.Post.view_count,
                "created_at": row.Post.created_at.isoformat()
            })
        
        # キャッシュに保存
        await self.redis.setex(cache_key, ttl, json.dumps(posts_data))
        
        return posts_data


# repositories/cached_repository.py
from repositories.user_repository import UserRepository


class CachedUserRepository(UserRepository):
    """キャッシュ機能付きユーザーリポジトリ"""
    
    def __init__(self, session: AsyncSession, cache_service: CachingService):
        super().__init__(session)
        self.cache = cache_service
    
    async def get_user_with_stats_cached(self, user_id: int) -> Optional[Dict[str, Any]]:
        """統計情報付きユーザー取得（キャッシュ版）"""
        
        async def fetch_user_stats(user_id: int):
            user = await self.get_by_id_with_posts(user_id)
            if not user:
                return None
            
            # 統計情報取得
            stats_stmt = (
                select(
                    func.count(Post.id).label("post_count"),
                    func.count(UserFollow.id).label("follower_count"),
                    func.sum(Post.view_count).label("total_views"),
                    func.sum(Post.like_count).label("total_likes")
                )
                .select_from(
                    User
                    .outerjoin(Post, and_(
                        Post.author_id == User.id,
                        Post.is_deleted == False
                    ))
                    .outerjoin(UserFollow, UserFollow.following_id == User.id)
                )
                .where(User.id == user_id)
            )
            
            stats_result = await self.session.execute(stats_stmt)
            stats = stats_result.first()
            
            return {
                "user": user,
                "stats": {
                    "post_count": stats.post_count or 0,
                    "follower_count": stats.follower_count or 0,
                    "total_views": stats.total_views or 0,
                    "total_likes": stats.total_likes or 0
                }
            }
        
        return await self.cache.get_cached_query_result(
            "user_stats",
            fetch_user_stats,
            ttl=300,
            user_id=user_id
        )
    
    async def invalidate_user_cache(self, user_id: int):
        """ユーザーキャッシュの無効化"""
        await self.cache.invalidate_pattern(f"user_stats:*user_id*{user_id}*")
```

## 📊 インデックス戦略と最適化

### 高度なインデックス活用

```python
# database/indexes.py
from sqlalchemy import Index, text
from sqlalchemy.dialects.postgresql import GIN, BTREE


class OptimizedIndexes:
    """最適化されたインデックス定義"""
    
    @staticmethod
    def create_advanced_indexes():
        """高度なインデックス作成"""
        
        indexes = [
            # 複合インデックス（検索パフォーマンス向上）
            Index(
                'idx_posts_author_published_created',
                'author_id', 'is_published', 'created_at',
                postgresql_where=text('is_deleted = false')
            ),
            
            # 部分インデックス（条件付き）
            Index(
                'idx_posts_published_only',
                'created_at',
                postgresql_where=text('is_published = true AND is_deleted = false')
            ),
            
            # GINインデックス（全文検索・配列検索）
            Index(
                'idx_posts_tags_gin',
                'tags',
                postgresql_using='gin'
            ),
            
            # 式インデックス（計算フィールド）
            Index(
                'idx_posts_engagement_score',
                text('(like_count * 2 + view_count * 0.1)'),
                postgresql_where=text('is_published = true')
            ),
            
            # ユーザー検索用複合インデックス
            Index(
                'idx_users_search_composite',
                'status', 'is_active', 'created_at',
                postgresql_where=text('is_deleted = false')
            )
        ]
        
        return indexes
```

### クエリ最適化ツール

```python
# database/query_optimization.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any


class QueryOptimizer:
    """クエリ最適化ツール"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def analyze_query_performance(self, query_text: str, params: dict = None):
        """クエリパフォーマンス分析"""
        
        # EXPLAIN ANALYZE実行
        explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query_text}"
        
        result = await self.session.execute(text(explain_query), params or {})
        plan = result.scalar()
        
        return {
            "execution_time": plan[0]["Execution Time"],
            "planning_time": plan[0]["Planning Time"],
            "total_cost": plan[0]["Plan"]["Total Cost"],
            "rows": plan[0]["Plan"]["Actual Rows"],
            "plan": plan[0]["Plan"]
        }
    
    async def get_slow_queries_report(self) -> List[Dict[str, Any]]:
        """スロークエリレポート"""
        
        # PostgreSQL pg_stat_statements拡張を使用
        stmt = text("""
            SELECT 
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                rows,
                100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements 
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY total_exec_time DESC 
            LIMIT 10
        """)
        
        result = await self.session.execute(stmt)
        
        slow_queries = []
        for row in result:
            slow_queries.append({
                "query": row.query,
                "calls": row.calls,
                "total_time": float(row.total_exec_time),
                "avg_time": float(row.mean_exec_time),
                "rows": row.rows,
                "hit_percent": float(row.hit_percent or 0)
            })
        
        return slow_queries
    
    async def optimize_table_statistics(self, table_names: List[str]):
        """テーブル統計情報の最適化"""
        
        for table_name in table_names:
            # テーブル統計更新
            await self.session.execute(text(f"ANALYZE {table_name}"))
            
            # インデックス使用状況確認
            usage_stmt = text("""
                SELECT 
                    indexname,
                    idx_tup_read,
                    idx_tup_fetch,
                    idx_scan
                FROM pg_stat_user_indexes 
                WHERE relname = :table_name
            """)
            
            result = await self.session.execute(usage_stmt, {"table_name": table_name})
            
            for row in result:
                if row.idx_scan == 0:  # 使用されていないインデックス
                    print(f"Unused index detected: {row.indexname} on table {table_name}")
```

### パフォーマンス監視

```python
# monitoring/performance_monitor.py
class PerformanceMonitor:
    """パフォーマンス監視"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計取得"""
        
        stmt = text("""
            SELECT 
                state,
                COUNT(*) as connection_count,
                AVG(EXTRACT(EPOCH FROM (now() - state_change))) as avg_duration
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY state
        """)
        
        result = await self.session.execute(stmt)
        
        stats = {}
        for row in result:
            stats[row.state or 'unknown'] = {
                "count": row.connection_count,
                "avg_duration": float(row.avg_duration or 0)
            }
        
        return stats
    
    async def get_table_sizes(self) -> List[Dict[str, Any]]:
        """テーブルサイズ情報"""
        
        stmt = text("""
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        """)
        
        result = await self.session.execute(stmt)
        
        table_sizes = []
        for row in result:
            table_sizes.append({
                "schema": row.schemaname,
                "table": row.tablename,
                "size": row.size,
                "size_bytes": row.size_bytes
            })
        
        return table_sizes
```