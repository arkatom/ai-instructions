# SQLAlchemy 2.0 高度なユーザー検索

複雑な検索条件を組み合わせた高度なユーザー検索の実装パターン。

## 🔍 高度なユーザー検索

```python
# repositories/user_repository.py (続き)
from sqlalchemy import select, func, and_, or_, case
from typing import List, Optional, Tuple
from datetime import datetime


class UserRepository:
    """ユーザーリポジトリ - 検索機能"""
    
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
```