# SQLAlchemy 2.0 関連テーブルパターン

SQLAlchemy 2.0における関連テーブルとアソシエーション実装。多対多関係と自己参照による階層構造を効率的に管理。

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

## 🔗 関連テーブルとアソシエーション

### 多対多関係の実装

```python
# models/associations.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, DateTime, UniqueConstraint, Index
from datetime import datetime

from models.base import Base


class UserFollow(Base):
    """ユーザーフォロー関連テーブル"""
    __tablename__ = "user_follows"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        init=False
    )
    following_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        init=False
    )
    
    followed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        init=False
    )
    
    # リレーションシップ
    follower_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[follower_id],
        back_populates="following",
        init=False
    )
    
    following_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[following_id],
        back_populates="followers",
        init=False
    )
    
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id"),
        Index("idx_user_follows_follower", "follower_id"),
        Index("idx_user_follows_following", "following_id"),
        CheckConstraint("follower_id != following_id"),
    )


class PostLike(Base):
    """投稿いいね関連テーブル"""
    __tablename__ = "post_likes"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE")
    )
    
    liked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        init=False
    )
    
    __table_args__ = (
        UniqueConstraint("user_id", "post_id"),
        Index("idx_post_likes_user", "user_id"),
        Index("idx_post_likes_post", "post_id"),
    )
```