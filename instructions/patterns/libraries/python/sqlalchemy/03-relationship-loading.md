# SQLAlchemy 2.0 リレーションシップローディング

SQLAlchemy 2.0における遅延読み込み戦略とパフォーマンス最適化。N+1問題の徹底解決とクエリ最適化パターン。

## ⚡ 遅延読み込み戦略

### 効率的なLazy Loading設定

```python
# models/optimized_relationships.py
from sqlalchemy.orm import relationship, selectinload, joinedload, contains_eager
from sqlalchemy import select

class OptimizedUser(Base):
    """最適化されたユーザーモデル"""
    __tablename__ = "users"
    
    # ... 基本フィールド ...
    
    # 戦略別リレーションシップ設定
    
    # 即座に読み込み（小さくて常に必要）
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile",
        back_populates="user",
        lazy="selectin",  # 常に1対1で読み込み
        uselist=False,
        init=False
    )
    
    # 必要時のみ読み込み（大量データ）
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="author",
        lazy="dynamic",  # クエリオブジェクトとして返す
        cascade="all, delete-orphan",
        init=False
    )
    
    # JOINで一度に読み込み（小〜中規模データ）
    recent_posts: Mapped[List["Post"]] = relationship(
        "Post",
        primaryjoin="and_(User.id == Post.author_id, Post.created_at >= text('NOW() - INTERVAL 30 DAY'))",
        lazy="selectin",
        viewonly=True,  # 読み取り専用
        init=False
    )
    
    # 条件付きリレーションシップ
    published_posts: Mapped[List["Post"]] = relationship(
        "Post",
        primaryjoin="and_(User.id == Post.author_id, Post.is_published == True)",
        lazy="selectin",
        viewonly=True,
        init=False
    )


class PostRepository:
    """投稿リポジトリ - 最適化されたクエリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_related(
        self,
        include_author: bool = True,
        include_comments: bool = False,
        include_tags: bool = True,
        limit: int = 10
    ) -> List[Post]:
        """関連データを含む投稿取得"""
        
        # 動的なeager loading
        options = []
        
        if include_author:
            options.append(selectinload(Post.author))
        
        if include_comments:
            options.extend([
                selectinload(Post.comments),
                selectinload(Post.comments).selectinload(Comment.author)
            ])
        
        if include_tags:
            options.append(selectinload(Post.tags))
        
        stmt = (
            select(Post)
            .options(*options)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_post_with_nested_comments(self, post_id: int) -> Optional[Post]:
        """ネストしたコメントを含む投稿取得"""
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.comments.and_(Comment.parent_id.is_(None))),
                selectinload(Post.comments).selectinload(Comment.replies),
                selectinload(Post.comments).selectinload(Comment.author),
                selectinload(Post.tags)
            )
            .where(Post.id == post_id)
            .where(Post.is_deleted == False)
        )
        
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

## 🚀 高度なクエリパターン

### JOINとサブクエリの最適化

```python
# repositories/advanced_queries.py
from sqlalchemy import select, func, and_, or_, case, exists, text
from sqlalchemy.orm import contains_eager, Load
from typing import List, Dict, Any


class AdvancedPostRepository:
    """高度なクエリパターン実装"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_counts(self) -> List[Dict[str, Any]]:
        """カウント付き投稿一覧"""
        stmt = (
            select(
                Post,
                func.count(Comment.id).label("comment_count"),
                func.count(PostLike.id).label("like_count")
            )
            .outerjoin(Comment, and_(
                Comment.post_id == Post.id,
                Comment.is_deleted == False
            ))
            .outerjoin(PostLike)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .group_by(Post.id)
            .order_by(Post.created_at.desc())
        )
        
        result = await self.session.execute(stmt)
        
        posts_with_counts = []
        for row in result:
            posts_with_counts.append({
                "post": row.Post,
                "comment_count": row.comment_count,
                "like_count": row.like_count
            })
        
        return posts_with_counts
    
    async def get_popular_posts_by_period(
        self,
        days: int = 30,
        min_likes: int = 5
    ) -> List[Post]:
        """期間内の人気投稿"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # サブクエリでいいね数を計算
        like_count_subq = (
            select(
                PostLike.post_id,
                func.count(PostLike.id).label("total_likes")
            )
            .where(PostLike.liked_at >= cutoff_date)
            .group_by(PostLike.post_id)
            .subquery()
        )
        
        stmt = (
            select(Post)
            .join(like_count_subq, Post.id == like_count_subq.c.post_id)
            .options(
                selectinload(Post.author),
                selectinload(Post.tags)
            )
            .where(like_count_subq.c.total_likes >= min_likes)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by(like_count_subq.c.total_likes.desc())
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_user_feed(
        self,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """ユーザーフィード（フォロー中のユーザーの投稿）"""
        
        # フォロー中のユーザーIDを取得するサブクエリ
        following_subq = (
            select(UserFollow.following_id)
            .where(UserFollow.follower_id == user_id)
            .subquery()
        )
        
        stmt = (
            select(
                Post,
                User.username.label("author_username"),
                User.avatar_url.label("author_avatar"),
                func.count(Comment.id).label("comment_count"),
                case(
                    (exists().where(
                        and_(
                            PostLike.post_id == Post.id,
                            PostLike.user_id == user_id
                        )
                    ), True),
                    else_=False
                ).label("is_liked_by_user")
            )
            .join(User, Post.author_id == User.id)
            .outerjoin(Comment, and_(
                Comment.post_id == Post.id,
                Comment.is_deleted == False
            ))
            .where(Post.author_id.in_(following_subq))
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .group_by(Post.id, User.username, User.avatar_url)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        feed_items = []
        for row in result:
            feed_items.append({
                "post": row.Post,
                "author_username": row.author_username,
                "author_avatar": row.author_avatar,
                "comment_count": row.comment_count,
                "is_liked_by_user": row.is_liked_by_user
            })
        
        return feed_items
```

## 🎯 パフォーマンス最適化

### N+1問題の徹底解決

```python
# repositories/optimized_repository.py
from sqlalchemy.orm import selectinload, joinedload, subqueryload


class OptimizedRepository:
    """N+1問題を回避する最適化されたリポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_optimized(self, limit: int = 10) -> List[Post]:
        """最適化された投稿取得（N+1回避）"""
        
        # selectinload使用パターン
        stmt = (
            select(Post)
            .options(
                # 著者情報を一度に取得
                selectinload(Post.author),
                
                # タグ情報を一度に取得
                selectinload(Post.tags),
                
                # カテゴリ情報を一度に取得
                selectinload(Post.category),
                
                # コメントと作成者を一度に取得
                selectinload(Post.comments).selectinload(Comment.author)
            )
            .where(Post.is_published == True)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_posts_with_join(self, limit: int = 10) -> List[Post]:
        """JOIN使用パターン"""
        
        stmt = (
            select(Post)
            .join(User, Post.author_id == User.id)
            .outerjoin(Category, Post.category_id == Category.id)
            .options(
                # JOINしたデータを活用
                contains_eager(Post.author),
                contains_eager(Post.category),
                
                # 別途取得が必要なもの
                selectinload(Post.tags)
            )
            .where(Post.is_published == True)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_nested_comments_optimized(self, post_id: int) -> List[Comment]:
        """ネストコメントの最適化取得"""
        
        # 全コメントを一度に取得
        stmt = (
            select(Comment)
            .options(
                selectinload(Comment.author),
                selectinload(Comment.replies).selectinload(Comment.author)
            )
            .where(Comment.post_id == post_id)
            .where(Comment.is_deleted == False)
            .order_by(Comment.created_at.asc())
        )
        
        result = await self.session.execute(stmt)
        all_comments = result.scalars().all()
        
        # Pythonでツリー構造を構築
        comment_dict = {comment.id: comment for comment in all_comments}
        root_comments = []
        
        for comment in all_comments:
            if comment.parent_id is None:
                root_comments.append(comment)
            else:
                parent = comment_dict.get(comment.parent_id)
                if parent:
                    if not hasattr(parent, '_nested_replies'):
                        parent._nested_replies = []
                    parent._nested_replies.append(comment)
        
        return root_comments
```