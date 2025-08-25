# SQLAlchemy 2.0 エンゲージメント分析クエリ

投稿のエンゲージメント分析、推薦アルゴリズム、コンテンツ推薦の実装パターン。

## 📊 投稿リポジトリの分析機能

```python
# repositories/post_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc, case, Float
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any

from models.post import Post, Category
from models.user import User
from models.comment import Comment
from models.associations import PostLike


class PostRepository:
    """投稿リポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_engagement(
        self,
        limit: int = 20,
        offset: int = 0,
        author_id: Optional[int] = None,
        category_id: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """エンゲージメント指標付き投稿取得"""
        
        # エンゲージメントスコア計算
        engagement_score = (
            Post.view_count * 0.1 +
            Post.like_count * 2.0 +
            func.coalesce(
                select(func.count(Comment.id))
                .where(Comment.post_id == Post.id)
                .where(Comment.is_deleted == False)
                .correlate(Post)
                .scalar_subquery(),
                0
            ) * 5.0
        ).label("engagement_score")
        
        # いいね率計算
        like_rate = case(
            (Post.view_count > 0, Post.like_count.cast(Float) / Post.view_count * 100),
            else_=0.0
        ).label("like_rate")
        
        stmt = (
            select(
                Post,
                engagement_score,
                like_rate,
                func.coalesce(
                    select(func.count(Comment.id))
                    .where(Comment.post_id == Post.id)
                    .where(Comment.is_deleted == False)
                    .correlate(Post)
                    .scalar_subquery(),
                    0
                ).label("comment_count")
            )
            .options(
                selectinload(Post.author),
                selectinload(Post.category)
            )
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
        )
        
        # フィルター適用
        if author_id:
            stmt = stmt.where(Post.author_id == author_id)
        
        if category_id:
            stmt = stmt.where(Post.category_id == category_id)
        
        if tags:
            # PostgreSQLの配列操作
            stmt = stmt.where(
                or_(*[Post.tags.any(tag) for tag in tags])
            )
        
        stmt = (
            stmt.order_by(engagement_score.desc(), Post.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        posts_with_metrics = []
        for row in result:
            posts_with_metrics.append({
                "post": row.Post,
                "engagement_score": float(row.engagement_score),
                "like_rate": float(row.like_rate),
                "comment_count": row.comment_count
            })
        
        return posts_with_metrics
    
    async def get_content_recommendations(
        self,
        user_id: int,
        limit: int = 10
    ) -> List[Post]:
        """コンテンツ推薦アルゴリズム"""
        
        # ユーザーの興味分析
        user_interests_subq = (
            select(
                func.unnest(Post.tags).label("tag"),
                func.count().label("interest_score")
            )
            .select_from(
                Post.join(PostLike, PostLike.post_id == Post.id)
            )
            .where(PostLike.user_id == user_id)
            .group_by(func.unnest(Post.tags))
            .subquery()
        )
        
        # 類似ユーザーの投稿
        similar_users_subq = (
            select(PostLike.user_id)
            .select_from(
                PostLike.join(
                    PostLike.alias("user_likes"),
                    PostLike.post_id == text("user_likes.post_id")
                )
            )
            .where(text("user_likes.user_id") == user_id)
            .where(PostLike.user_id != user_id)
            .group_by(PostLike.user_id)
            .having(func.count() >= 3)  # 3つ以上の共通いいね
            .subquery()
        )
        
        # 推薦スコア計算
        recommendation_score = (
            # タグ一致度
            func.coalesce(
                select(func.sum(user_interests_subq.c.interest_score))
                .select_from(user_interests_subq)
                .where(
                    user_interests_subq.c.tag.in_(
                        select(func.unnest(Post.tags))
                    )
                ),
                0
            ) * 2.0 +
            # 類似ユーザーからの推薦
            func.coalesce(
                select(func.count())
                .select_from(PostLike.join(similar_users_subq))
                .where(PostLike.post_id == Post.id),
                0
            ) * 3.0 +
            # エンゲージメント指標
            Post.like_count * 0.5 +
            Post.view_count * 0.01
        ).label("recommendation_score")
        
        stmt = (
            select(Post, recommendation_score)
            .options(selectinload(Post.author))
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .where(Post.author_id != user_id)  # 自分の投稿は除外
            .where(
                ~exists(
                    select(1)
                    .select_from(PostLike)
                    .where(PostLike.post_id == Post.id)
                    .where(PostLike.user_id == user_id)
                )
            )  # 既にいいねした投稿は除外
            .order_by(recommendation_score.desc(), Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return [row.Post for row in result]
```