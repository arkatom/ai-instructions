# SQLAlchemy 2.0 検索とダッシュボード

統計情報、全文検索、ファセット検索、ダッシュボード用分析クエリの実装パターン。

## 📈 統計とレポート機能

```python
# repositories/analytics_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, case, and_, or_
from datetime import datetime, timedelta
from typing import Dict, List, Any

from models.user import User, UserStatus
from models.post import Post, Category


class AnalyticsRepository:
    """分析・レポート用リポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_user_growth_stats(self, days: int = 30) -> Dict[str, Any]:
        """ユーザー成長統計"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(
                func.count(User.id).label("total_users"),
                func.count(User.id).filter(User.created_at >= cutoff_date).label("new_users"),
                func.count(User.id).filter(User.last_login_at >= cutoff_date).label("active_users"),
                func.count(User.id).filter(User.status == UserStatus.ACTIVE).label("active_status_users"),
                func.avg(
                    extract('days', func.now() - User.created_at)
                ).label("avg_user_age_days")
            )
            .where(User.is_deleted == False)
        )
        
        result = await self.session.execute(stmt)
        row = result.first()
        
        return {
            "total_users": row.total_users,
            "new_users": row.new_users,
            "active_users": row.active_users,
            "active_status_users": row.active_status_users,
            "avg_user_age_days": float(row.avg_user_age_days or 0),
            "growth_rate": (row.new_users / (row.total_users - row.new_users)) * 100 if row.total_users > row.new_users else 0
        }
    
    async def get_content_stats(self, days: int = 30) -> Dict[str, Any]:
        """コンテンツ統計"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(
                func.count(Post.id).label("total_posts"),
                func.count(Post.id).filter(Post.created_at >= cutoff_date).label("new_posts"),
                func.count(Post.id).filter(Post.is_published == True).label("published_posts"),
                func.avg(Post.view_count).label("avg_views"),
                func.avg(Post.like_count).label("avg_likes"),
                func.sum(Post.view_count).label("total_views"),
                func.sum(Post.like_count).label("total_likes")
            )
            .where(Post.is_deleted == False)
        )
        
        result = await self.session.execute(stmt)
        row = result.first()
        
        return {
            "total_posts": row.total_posts,
            "new_posts": row.new_posts,
            "published_posts": row.published_posts,
            "avg_views": float(row.avg_views or 0),
            "avg_likes": float(row.avg_likes or 0),
            "total_views": row.total_views or 0,
            "total_likes": row.total_likes or 0,
            "engagement_rate": (row.total_likes / row.total_views * 100) if row.total_views > 0 else 0
        }
    
    async def get_daily_activity_chart(self, days: int = 30) -> List[Dict[str, Any]]:
        """日次アクティビティチャート"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(
                func.date_trunc('day', Post.created_at).label("date"),
                func.count(Post.id).label("posts_count"),
                func.count(func.distinct(Post.author_id)).label("active_authors"),
                func.sum(Post.view_count).label("daily_views"),
                func.sum(Post.like_count).label("daily_likes")
            )
            .where(Post.created_at >= cutoff_date)
            .where(Post.is_deleted == False)
            .group_by(func.date_trunc('day', Post.created_at))
            .order_by(func.date_trunc('day', Post.created_at))
        )
        
        result = await self.session.execute(stmt)
        
        daily_stats = []
        for row in result:
            daily_stats.append({
                "date": row.date.strftime("%Y-%m-%d"),
                "posts_count": row.posts_count,
                "active_authors": row.active_authors,
                "daily_views": row.daily_views or 0,
                "daily_likes": row.daily_likes or 0
            })
        
        return daily_stats
```

## 🔍 全文検索とフィルタリング

```python
# repositories/search_repository.py
from sqlalchemy import select, func, and_, or_, text, cast, String
from sqlalchemy.dialects.postgresql import TSVECTOR
from typing import List, Dict, Any, Optional, Tuple


class SearchRepository:
    """検索機能リポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def full_text_search(
        self,
        query: str,
        content_types: Optional[List[str]] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """PostgreSQL全文検索"""
        
        results = []
        
        # 投稿検索
        if not content_types or "posts" in content_types:
            post_search = (
                select(
                    Post.id,
                    Post.title,
                    Post.content,
                    Post.created_at,
                    func.literal("post").label("content_type"),
                    func.ts_rank(
                        func.to_tsvector('english', func.concat(Post.title, ' ', Post.content)),
                        func.plainto_tsquery('english', query)
                    ).label("rank"),
                    User.username.label("author_username")
                )
                .join(User, Post.author_id == User.id)
                .where(
                    func.to_tsvector('english', func.concat(Post.title, ' ', Post.content))
                    .match(func.plainto_tsquery('english', query))
                )
                .where(Post.is_published == True)
                .where(Post.is_deleted == False)
            )
            
            result = await self.session.execute(
                post_search.order_by(text("rank DESC")).offset(offset).limit(limit)
            )
            
            for row in result:
                results.append({
                    "id": row.id,
                    "title": row.title,
                    "content": row.content[:200] + "..." if len(row.content) > 200 else row.content,
                    "created_at": row.created_at,
                    "content_type": row.content_type,
                    "rank": float(row.rank),
                    "author_username": row.author_username
                })
        
        return {
            "results": results[:limit],
            "total_count": len(results),
            "query": query
        }
    
    async def faceted_search(
        self,
        query: Optional[str] = None,
        categories: Optional[List[int]] = None,
        tags: Optional[List[str]] = None,
        authors: Optional[List[int]] = None,
        date_range: Optional[Tuple[datetime, datetime]] = None,
        min_likes: Optional[int] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """ファセット検索"""
        
        base_query = (
            select(Post, User.username.label("author_username"))
            .join(User, Post.author_id == User.id)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
        )
        
        # 検索条件構築
        conditions = []
        
        if query:
            conditions.append(
                or_(
                    Post.title.ilike(f"%{query}%"),
                    Post.content.ilike(f"%{query}%"),
                    Post.tags.any(func.lower(text("unnest(tags)")).like(f"%{query.lower()}%"))
                )
            )
        
        if categories:
            conditions.append(Post.category_id.in_(categories))
        
        if tags:
            tag_conditions = [Post.tags.any(tag) for tag in tags]
            conditions.append(and_(*tag_conditions))
        
        if authors:
            conditions.append(Post.author_id.in_(authors))
        
        if date_range:
            start_date, end_date = date_range
            conditions.append(and_(
                Post.created_at >= start_date,
                Post.created_at <= end_date
            ))
        
        if min_likes:
            conditions.append(Post.like_count >= min_likes)
        
        if conditions:
            base_query = base_query.where(and_(*conditions))
        
        # メインクエリ実行
        main_result = await self.session.execute(
            base_query.order_by(Post.created_at.desc()).offset(offset).limit(limit)
        )
        
        posts_with_authors = []
        for row in main_result:
            posts_with_authors.append({
                "post": row.Post,
                "author_username": row.author_username
            })
        
        return {
            "results": posts_with_authors,
            "total_count": len(posts_with_authors),
            "query": query
        }
```