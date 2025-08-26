# SQLAlchemy 2.0 高度なクエリパターン

SQLAlchemy 2.0の新しいselect()構文を活用した複雑なクエリとJOIN最適化。ユーザーリポジトリの実装例。

## 🔍 ユーザーリポジトリの高度なクエリ

```python
# repositories/user_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, exists, text
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import asyncio

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