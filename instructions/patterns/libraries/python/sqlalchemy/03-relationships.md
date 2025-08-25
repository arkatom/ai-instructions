# SQLAlchemy 2.0 リレーションシップパターン

SQLAlchemy 2.0における高度なリレーションシップ定義と遅延読み込み戦略。N+1問題の回避とパフォーマンス最適化を重視。

## 🔗 基本的なリレーションシップパターン

### 1対多・多対多の実装

```python
# models/blog.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Table, Column, Integer
from typing import List, Optional

from models.base import Base, TimestampMixin


# 多対多関連テーブル
post_tags = Table(
    'post_tags',
    Base.metadata,
    Column('post_id', Integer, ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)


class Category(Base, TimestampMixin):
    """カテゴリモデル"""
    __tablename__ = "categories"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    
    # 1対多リレーションシップ（カテゴリ -> 投稿）
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="category",
        lazy="dynamic",  # 大量のデータが予想される場合
        cascade="all, delete-orphan",
        init=False
    )
    
    # 階層構造（自己参照）
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"),
        default=None
    )
    
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        remote_side=[id],
        back_populates="children",
        lazy="selectin",
        init=False
    )
    
    children: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin",
        init=False
    )


class Tag(Base, TimestampMixin):
    """タグモデル"""
    __tablename__ = "tags"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), default=None)  # HEX color
    
    # 多対多リレーションシップ（タグ <-> 投稿）
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        secondary=post_tags,
        back_populates="tags",
        lazy="selectin",
        init=False
    )


class Post(Base, TimestampMixin, SoftDeleteMixin):
    """投稿モデル（リレーションシップ強化版）"""
    __tablename__ = "posts"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    
    # 外部キー
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        default=None
    )
    
    # リレーションシップ
    author: Mapped["User"] = relationship(
        "User",
        back_populates="posts",
        lazy="selectin",  # 常に必要なため即座に読み込み
        init=False
    )
    
    category: Mapped[Optional["Category"]] = relationship(
        "Category",
        back_populates="posts",
        lazy="selectin",
        init=False
    )
    
    # 多対多リレーションシップ
    tags: Mapped[List["Tag"]] = relationship(
        "Tag",
        secondary=post_tags,
        back_populates="posts",
        lazy="selectin",
        init=False
    )
    
    # 1対多リレーションシップ
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
        lazy="dynamic",  # コメントは必要時のみ読み込み
        init=False
    )


class Comment(Base, TimestampMixin, SoftDeleteMixin):
    """コメントモデル"""
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    content: Mapped[str] = mapped_column(Text)
    
    # 外部キー
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE")
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    
    # 階層コメント用（自己参照）
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"),
        default=None
    )
    
    # リレーションシップ
    post: Mapped["Post"] = relationship(
        "Post",
        back_populates="comments",
        lazy="selectin",
        init=False
    )
    
    author: Mapped["User"] = relationship(
        "User",
        back_populates="comments",
        lazy="selectin",
        init=False
    )
    
    # 階層構造
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        remote_side=[id],
        back_populates="replies",
        lazy="selectin",
        init=False
    )
    
    replies: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin",
        init=False
    )
```

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

## 🔄 カスケード操作

### 効率的なカスケード設定

```python
# models/cascading.py
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, event
from sqlalchemy.orm.events import InstanceEvents


class UserWithCascading(Base, TimestampMixin):
    """カスケード操作を含むユーザーモデル"""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    
    # カスケード設定パターン
    
    # 1. 削除時に子レコードも削除
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="author",
        cascade="all, delete-orphan",  # ユーザー削除時に投稿も削除
        passive_deletes=True,  # DB側のON DELETE CASCADEを使用
        init=False
    )
    
    # 2. 削除時にNULLを設定
    moderated_posts: Mapped[List["Post"]] = relationship(
        "Post",
        foreign_keys="Post.moderator_id",
        cascade="save-update",  # 削除はカスケードしない
        passive_deletes=True,
        init=False
    )
    
    # 3. 論理削除のカスケード
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="author",
        cascade="save-update, merge",
        init=False
    )


@event.listens_for(UserWithCascading, 'before_delete')
def before_user_delete(mapper, connection, target):
    """ユーザー削除前の処理"""
    # 論理削除のカスケード
    connection.execute(
        text("UPDATE comments SET is_deleted = true WHERE author_id = :user_id"),
        {"user_id": target.id}
    )
    
    # 統計情報の更新
    connection.execute(
        text("UPDATE posts SET author_display_name = :name WHERE author_id = :user_id"),
        {"name": f"削除されたユーザー({target.username})", "user_id": target.id}
    )


class SoftDeleteCascade:
    """論理削除のカスケード処理"""
    
    @staticmethod
    async def soft_delete_user(session: AsyncSession, user_id: int):
        """ユーザーの論理削除（関連データも含む）"""
        # ユーザーの論理削除
        await session.execute(
            update(User)
            .where(User.id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        # 関連する投稿の論理削除
        await session.execute(
            update(Post)
            .where(Post.author_id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        # 関連するコメントの論理削除
        await session.execute(
            update(Comment)
            .where(Comment.author_id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        await session.commit()
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