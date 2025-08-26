# SQLAlchemy 2.0 高度なクエリパターン

SQLAlchemy 2.0の新しいselect()構文を活用した複雑なクエリとJOIN最適化。統計情報、推薦アルゴリズム、分析クエリの実装。

## 🔍 複雑なクエリとJOIN最適化

### ユーザーリポジトリの高度なクエリ

```python
# repositories/user_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, exists, text
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta

from models.user import User, UserRole, UserStatus
from models.post import Post
from models.associations import UserFollow, PostLike


class UserRepository:
    """ユーザーリポジトリ - 高度なクエリパターン"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id_with_posts(self, user_id: int) -> Optional[User]:
        """投稿を含むユーザー取得（N+1問題回避）"""
        stmt = (
            select(User)
            .options(
                selectinload(User.posts)
                .selectinload(Post.comments)
            )
            .where(User.id == user_id)
            .where(User.is_deleted == False)
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_users_with_stats(
        self,
        limit: int = 50,
        offset: int = 0,
        role_filter: Optional[UserRole] = None
    ) -> List[Dict[str, Any]]:
        """統計情報付きユーザー取得"""
        
        # サブクエリ作成
        post_count_subq = (
            select(func.count(Post.id))
            .where(Post.author_id == User.id)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .correlate(User)
            .scalar_subquery()
            .label("post_count")
        )
        
        follower_count_subq = (
            select(func.count(UserFollow.id))
            .where(UserFollow.following_id == User.id)
            .correlate(User)
            .scalar_subquery()
            .label("follower_count")
        )
        
        following_count_subq = (
            select(func.count(UserFollow.id))
            .where(UserFollow.follower_id == User.id)
            .correlate(User)
            .scalar_subquery()
            .label("following_count")
        )
        
        # メインクエリ
        stmt = (
            select(
                User,
                post_count_subq,
                follower_count_subq,
                following_count_subq,
                func.coalesce(User.last_login_at, User.created_at).label("last_activity")
            )
            .where(User.is_deleted == False)
        )
        
        if role_filter:
            stmt = stmt.where(User.role == role_filter)
        
        stmt = (
            stmt.order_by(User.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        users_with_stats = []
        for row in result:
            users_with_stats.append({
                "user": row.User,
                "post_count": row.post_count or 0,
                "follower_count": row.follower_count or 0,
                "following_count": row.following_count or 0,
                "last_activity": row.last_activity
            })
        
        return users_with_stats
    
    async def search_users_advanced(
        self,
        search_term: Optional[str] = None,
        role_filters: Optional[List[UserRole]] = None,
        status_filters: Optional[List[UserStatus]] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        min_posts: Optional[int] = None,
        min_followers: Optional[int] = None,
        order_by: str = "created_at",
        order_direction: str = "desc",
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[User], int]:
        """高度なユーザー検索"""
        
        # ベースクエリ
        base_query = select(User).where(User.is_deleted == False)
        count_query = select(func.count(User.id)).where(User.is_deleted == False)
        
        # 検索条件構築
        conditions = []
        
        # テキスト検索
        if search_term:
            search_conditions = [
                User.username.ilike(f"%{search_term}%"),
                User.first_name.ilike(f"%{search_term}%"),
                User.last_name.ilike(f"%{search_term}%"),
                User.email.ilike(f"%{search_term}%"),
                func.concat(User.first_name, ' ', User.last_name).ilike(f"%{search_term}%")
            ]
            conditions.append(or_(*search_conditions))
        
        # 権限フィルター
        if role_filters:
            conditions.append(User.role.in_(role_filters))
        
        # ステータスフィルター
        if status_filters:
            conditions.append(User.status.in_(status_filters))
        
        # 作成日フィルター
        if created_after:
            conditions.append(User.created_at >= created_after)
        if created_before:
            conditions.append(User.created_at <= created_before)
        
        # 投稿数フィルター
        if min_posts is not None:
            post_count_subq = (
                select(func.count(Post.id))
                .where(Post.author_id == User.id)
                .where(Post.is_published == True)
                .where(Post.is_deleted == False)
                .correlate(User)
                .scalar_subquery()
            )
            conditions.append(post_count_subq >= min_posts)
        
        # フォロワー数フィルター
        if min_followers is not None:
            follower_count_subq = (
                select(func.count(UserFollow.id))
                .where(UserFollow.following_id == User.id)
                .correlate(User)
                .scalar_subquery()
            )
            conditions.append(follower_count_subq >= min_followers)
        
        # 条件適用
        if conditions:
            condition_expr = and_(*conditions)
            base_query = base_query.where(condition_expr)
            count_query = count_query.where(condition_expr)
        
        # ソート
        if order_by == "post_count":
            post_count_expr = (
                select(func.count(Post.id))
                .where(Post.author_id == User.id)
                .where(Post.is_published == True)
                .correlate(User)
                .scalar_subquery()
            )
            order_expr = post_count_expr.desc() if order_direction == "desc" else post_count_expr.asc()
        elif order_by == "follower_count":
            follower_count_expr = (
                select(func.count(UserFollow.id))
                .where(UserFollow.following_id == User.id)
                .correlate(User)
                .scalar_subquery()
            )
            order_expr = follower_count_expr.desc() if order_direction == "desc" else follower_count_expr.asc()
        else:
            order_column = getattr(User, order_by, User.created_at)
            order_expr = order_column.desc() if order_direction == "desc" else order_column.asc()
        
        base_query = base_query.order_by(order_expr)
        
        # ページネーション
        base_query = base_query.offset(offset).limit(limit)
        
        # 実行
        users_result = await self.session.execute(base_query)
        count_result = await self.session.execute(count_query)
        
        users = users_result.scalars().all()
        total_count = count_result.scalar()
        
        return users, total_count
    
    async def get_user_network_analysis(self, user_id: int) -> Dict[str, Any]:
        """ユーザーのネットワーク分析"""
        
        # 相互フォロー数
        mutual_follows_query = (
            select(func.count())
            .select_from(
                UserFollow.alias("f1")
                .join(
                    UserFollow.alias("f2"),
                    and_(
                        text("f1.following_id = f2.follower_id"),
                        text("f1.follower_id = f2.following_id")
                    )
                )
            )
            .where(text("f1.follower_id = :user_id"))
        )
        
        # フォロワーの平均投稿数
        avg_follower_posts_query = (
            select(func.avg(
                select(func.count(Post.id))
                .where(Post.author_id == User.id)
                .where(Post.is_published == True)
                .correlate(User)
                .scalar_subquery()
            ))
            .select_from(
                User.join(UserFollow, UserFollow.follower_id == User.id)
            )
            .where(UserFollow.following_id == user_id)
        )
        
        # 影響度スコア計算
        influence_score_query = (
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (User.role == UserRole.SUPERUSER, 10),
                            (User.role == UserRole.ADMIN, 5),
                            (User.role == UserRole.MODERATOR, 3),
                            else_=1
                        )
                    ),
                    0
                )
            )
            .select_from(
                User.join(UserFollow, UserFollow.follower_id == User.id)
            )
            .where(UserFollow.following_id == user_id)
        )
        
        # 並列実行
        results = await asyncio.gather(
            self.session.execute(mutual_follows_query.params(user_id=user_id)),
            self.session.execute(avg_follower_posts_query),
            self.session.execute(influence_score_query)
        )
        
        return {
            "mutual_follows": results[0].scalar() or 0,
            "avg_follower_posts": float(results[1].scalar() or 0),
            "influence_score": results[2].scalar() or 0
        }
    
    async def get_trending_users(
        self,
        days: int = 30,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """トレンドユーザー取得"""
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # 期間内の新規フォロワー数でランキング
        stmt = (
            select(
                User,
                func.count(UserFollow.id).label("new_followers"),
                func.count(Post.id).filter(
                    and_(
                        Post.created_at >= cutoff_date,
                        Post.is_published == True
                    )
                ).label("recent_posts"),
                func.coalesce(
                    func.sum(Post.view_count).filter(
                        Post.created_at >= cutoff_date
                    ),
                    0
                ).label("recent_views")
            )
            .select_from(
                User
                .outerjoin(
                    UserFollow,
                    and_(
                        UserFollow.following_id == User.id,
                        UserFollow.followed_at >= cutoff_date
                    )
                )
                .outerjoin(
                    Post,
                    and_(
                        Post.author_id == User.id,
                        Post.is_deleted == False
                    )
                )
            )
            .where(User.is_deleted == False)
            .where(User.is_active == True)
            .group_by(User.id)
            .having(func.count(UserFollow.id) > 0)  # 新規フォロワーがいるユーザーのみ
            .order_by(
                func.count(UserFollow.id).desc(),
                func.count(Post.id).desc()
            )
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        trending_users = []
        for row in result:
            trending_users.append({
                "user": row.User,
                "new_followers": row.new_followers,
                "recent_posts": row.recent_posts,
                "recent_views": row.recent_views,
                "trend_score": row.new_followers * 2 + row.recent_posts + (row.recent_views / 100)
            })
        
        return trending_users
```

## 📊 エンゲージメント分析クエリ

### 投稿リポジトリの分析機能

```python
# repositories/post_repository.py
from sqlalchemy import select, func, and_, or_, desc, asc, case
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any


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

## 📈 ダッシュボード用分析クエリ

### 統計とレポート機能

```python
# repositories/analytics_repository.py
from sqlalchemy import select, func, extract, case, and_, or_
from datetime import datetime, timedelta
from typing import Dict, List, Any


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
    
    async def get_top_categories_with_metrics(self, limit: int = 10) -> List[Dict[str, Any]]:
        """カテゴリ別統計"""
        stmt = (
            select(
                Category.name.label("category_name"),
                func.count(Post.id).label("post_count"),
                func.avg(Post.view_count).label("avg_views"),
                func.avg(Post.like_count).label("avg_likes"),
                func.sum(Post.view_count).label("total_views"),
                func.sum(Post.like_count).label("total_likes"),
                func.count(func.distinct(Post.author_id)).label("unique_authors")
            )
            .select_from(
                Category.join(Post, Category.id == Post.category_id)
            )
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .group_by(Category.id, Category.name)
            .order_by(func.count(Post.id).desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        category_stats = []
        for row in result:
            category_stats.append({
                "category_name": row.category_name,
                "post_count": row.post_count,
                "avg_views": float(row.avg_views or 0),
                "avg_likes": float(row.avg_likes or 0),
                "total_views": row.total_views or 0,
                "total_likes": row.total_likes or 0,
                "unique_authors": row.unique_authors,
                "engagement_rate": (row.total_likes / row.total_views * 100) if row.total_views > 0 else 0
            })
        
        return category_stats
```

## 🔍 全文検索とフィルタリング

### 高度な検索機能

```python
# repositories/search_repository.py
from sqlalchemy import select, func, and_, or_, text, cast, String
from sqlalchemy.dialects.postgresql import TSVECTOR
from typing import List, Dict, Any, Optional


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
        
        # 検索結果を統合するUNIONクエリ
        results = []
        total_count = 0
        
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
        
        # ユーザー検索
        if not content_types or "users" in content_types:
            user_search = (
                select(
                    User.id,
                    User.username,
                    func.concat(User.first_name, ' ', User.last_name).label("full_name"),
                    User.bio,
                    User.created_at,
                    func.literal("user").label("content_type"),
                    func.ts_rank(
                        func.to_tsvector('english', func.concat(
                            User.username, ' ',
                            User.first_name, ' ',
                            User.last_name, ' ',
                            func.coalesce(User.bio, '')
                        )),
                        func.plainto_tsquery('english', query)
                    ).label("rank")
                )
                .where(
                    func.to_tsvector('english', func.concat(
                        User.username, ' ',
                        User.first_name, ' ', 
                        User.last_name, ' ',
                        func.coalesce(User.bio, '')
                    )).match(func.plainto_tsquery('english', query))
                )
                .where(User.is_deleted == False)
                .where(User.is_active == True)
            )
            
            result = await self.session.execute(
                user_search.order_by(text("rank DESC")).limit(limit // 2)
            )
            
            for row in result:
                results.append({
                    "id": row.id,
                    "title": row.username,
                    "content": row.full_name,
                    "bio": row.bio,
                    "created_at": row.created_at,
                    "content_type": row.content_type,
                    "rank": float(row.rank)
                })
        
        # ランクでソート
        results.sort(key=lambda x: x["rank"], reverse=True)
        
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
        
        # ファセット情報も取得
        facet_queries = {
            "categories": (
                select(
                    Category.id, 
                    Category.name, 
                    func.count(Post.id).label("count")
                )
                .join(Post, Category.id == Post.category_id)
                .where(Post.is_published == True)
                .where(Post.is_deleted == False)
                .group_by(Category.id, Category.name)
                .order_by(func.count(Post.id).desc())
                .limit(10)
            ),
            "top_tags": (
                select(
                    func.unnest(Post.tags).label("tag"),
                    func.count().label("count")
                )
                .where(Post.is_published == True)
                .where(Post.is_deleted == False)
                .group_by(func.unnest(Post.tags))
                .order_by(func.count().desc())
                .limit(20)
            )
        }
        
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
        
        # ファセット情報取得
        facets = {}
        for facet_name, facet_query in facet_queries.items():
            facet_result = await self.session.execute(facet_query)
            facets[facet_name] = [
                {"name": row[0] if isinstance(row[0], str) else row[1], "count": row[-1]}
                for row in facet_result
            ]
        
        return {
            "results": posts_with_authors,
            "facets": facets,
            "total_count": len(posts_with_authors),
            "query": query
        }
```