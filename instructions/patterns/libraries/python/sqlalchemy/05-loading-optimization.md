# SQLAlchemy 2.0 N+1問題とバルク操作

SQLAlchemy 2.0における N+1問題の解決とバルク操作の最適化パターン。

## ⚡ N+1問題の徹底解決

### selectinloadによる最適化

```python
# repositories/optimized_loading.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_
from sqlalchemy.orm import selectinload, joinedload, contains_eager, Load
from typing import List, Dict, Any
from datetime import datetime

from models.post import Post, Comment, PostLike
from models.user import User, UserFollow


class OptimizedLoadingRepository:
    """N+1問題を解決するリポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_everything_optimized(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """全関連データを効率的に取得"""
        
        stmt = (
            select(Post)
            .options(
                # 著者情報（1対1）
                selectinload(Post.author),
                
                # カテゴリ情報（多対1）
                selectinload(Post.category),
                
                # タグ情報（多対多）
                selectinload(Post.tags),
                
                # コメントと著者を一度に取得
                selectinload(Post.comments.and_(
                    Comment.is_deleted == False
                )).selectinload(Comment.author),
                
                # ネストしたコメント
                selectinload(Post.comments).selectinload(Comment.replies.and_(
                    Comment.is_deleted == False
                )).selectinload(Comment.author)
            )
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        posts = result.scalars().all()
        
        # 追加の集計データを一度のクエリで取得
        post_ids = [post.id for post in posts]
        
        stats_stmt = (
            select(
                Post.id,
                func.count(Comment.id).label("comment_count"),
                func.count(PostLike.id).label("like_count"),
                func.count(func.distinct(Comment.author_id)).label("unique_commenters")
            )
            .outerjoin(Comment, and_(
                Comment.post_id == Post.id,
                Comment.is_deleted == False
            ))
            .outerjoin(PostLike)
            .where(Post.id.in_(post_ids))
            .group_by(Post.id)
        )
        
        stats_result = await self.session.execute(stats_stmt)
        stats_by_post_id = {
            row.id: {
                "comment_count": row.comment_count,
                "like_count": row.like_count,
                "unique_commenters": row.unique_commenters
            }
            for row in stats_result
        }
        
        # 結果をマージ
        posts_with_stats = []
        for post in posts:
            stats = stats_by_post_id.get(post.id, {
                "comment_count": 0,
                "like_count": 0,
                "unique_commenters": 0
            })
            
            posts_with_stats.append({
                "post": post,
                "stats": stats
            })
        
        return posts_with_stats
    
    async def get_user_feed_optimized(
        self,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """最適化されたユーザーフィード"""
        
        # フォロー中のユーザーを取得
        following_stmt = (
            select(UserFollow.following_id)
            .where(UserFollow.follower_id == user_id)
        )
        following_result = await self.session.execute(following_stmt)
        following_ids = [row[0] for row in following_result]
        
        if not following_ids:
            return []
        
        # 投稿を効率的に取得
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.tags),
                # 最新のコメント3件のみ
                selectinload(Post.comments.and_(
                    Comment.is_deleted == False
                ).limit(3)).selectinload(Comment.author)
            )
            .where(Post.author_id.in_(following_ids))
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        posts = result.scalars().all()
        
        # ユーザーのいいね状態を一括取得
        post_ids = [post.id for post in posts]
        liked_posts_stmt = (
            select(PostLike.post_id)
            .where(PostLike.user_id == user_id)
            .where(PostLike.post_id.in_(post_ids))
        )
        liked_result = await self.session.execute(liked_posts_stmt)
        liked_post_ids = set(row[0] for row in liked_result)
        
        feed_items = []
        for post in posts:
            feed_items.append({
                "post": post,
                "is_liked": post.id in liked_post_ids,
                "comment_preview": post.comments[:3]  # 最新3件
            })
        
        return feed_items
```

## 🚀 バルク操作の最適化

### 高速バルク処理パターン

```python
# repositories/bulk_operations.py
from sqlalchemy import select, update, delete, text, func, bindparam
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Any


class BulkOperationsRepository:
    """バルク操作専用リポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def bulk_insert_users(self, users_data: List[Dict[str, Any]]) -> List[int]:
        """高速ユーザーバルクインサート"""
        
        # PostgreSQL UPSERTを使用
        stmt = insert(User).values(users_data)
        
        # 重複時の更新処理
        stmt = stmt.on_conflict_do_update(
            index_elements=['email'],
            set_={
                'updated_at': func.now(),
                'first_name': stmt.excluded.first_name,
                'last_name': stmt.excluded.last_name,
                'display_name': stmt.excluded.display_name
            }
        ).returning(User.id)
        
        result = await self.session.execute(stmt)
        await self.session.commit()
        
        return [row.id for row in result]
    
    async def bulk_update_post_stats(
        self,
        post_updates: List[Dict[str, Any]]
    ) -> int:
        """投稿統計の一括更新"""
        
        # バインドパラメータを使用した効率的な更新
        stmt = (
            update(Post)
            .where(Post.id == bindparam('post_id'))
            .values(
                view_count=bindparam('view_count'),
                like_count=bindparam('like_count'),
                updated_at=func.now()
            )
        )
        
        result = await self.session.execute(stmt, post_updates)
        affected_rows = result.rowcount
        await self.session.commit()
        
        return affected_rows
    
    async def bulk_soft_delete_posts(self, post_ids: List[int]) -> int:
        """投稿の一括論理削除"""
        
        stmt = (
            update(Post)
            .where(Post.id.in_(post_ids))
            .values(
                is_deleted=True,
                deleted_at=func.now()
            )
        )
        
        result = await self.session.execute(stmt)
        affected_rows = result.rowcount
        
        # 関連コメントも論理削除
        comment_stmt = (
            update(Comment)
            .where(Comment.post_id.in_(post_ids))
            .values(
                is_deleted=True,
                deleted_at=func.now()
            )
        )
        
        await self.session.execute(comment_stmt)
        await self.session.commit()
        
        return affected_rows
    
    async def bulk_create_user_follows(
        self,
        follower_id: int,
        following_ids: List[int]
    ) -> int:
        """フォロー関係の一括作成"""
        
        follow_data = [
            {"follower_id": follower_id, "following_id": following_id}
            for following_id in following_ids
        ]
        
        # 重複を避けるUPSERT
        stmt = insert(UserFollow).values(follow_data)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=['follower_id', 'following_id']
        )
        
        result = await self.session.execute(stmt)
        await self.session.commit()
        
        return result.rowcount
    
    async def bulk_analyze_user_engagement(self, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """ユーザーエンゲージメントの一括分析"""
        
        # CTEを使用した効率的な集計
        stmt = text("""
            WITH user_stats AS (
                SELECT 
                    u.id as user_id,
                    COUNT(DISTINCT p.id) as post_count,
                    COUNT(DISTINCT c.id) as comment_count,
                    COUNT(DISTINCT pl.id) as received_likes,
                    AVG(p.view_count) as avg_views_per_post,
                    MAX(p.created_at) as last_post_date
                FROM users u
                LEFT JOIN posts p ON u.id = p.author_id AND p.is_deleted = false
                LEFT JOIN comments c ON u.id = c.author_id AND c.is_deleted = false
                LEFT JOIN post_likes pl ON p.id = pl.post_id
                WHERE u.id = ANY(:user_ids)
                GROUP BY u.id
            )
            SELECT 
                user_id,
                post_count,
                comment_count,
                received_likes,
                COALESCE(avg_views_per_post, 0) as avg_views_per_post,
                last_post_date,
                CASE 
                    WHEN post_count = 0 THEN 0
                    ELSE received_likes::float / post_count 
                END as likes_per_post
            FROM user_stats
        """)
        
        result = await self.session.execute(stmt, {"user_ids": user_ids})
        
        engagement_data = {}
        for row in result:
            engagement_data[row.user_id] = {
                "post_count": row.post_count,
                "comment_count": row.comment_count,
                "received_likes": row.received_likes,
                "avg_views_per_post": float(row.avg_views_per_post or 0),
                "last_post_date": row.last_post_date,
                "likes_per_post": float(row.likes_per_post or 0)
            }
        
        return engagement_data
```