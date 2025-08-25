# SQLAlchemy 2.0 コンテンツモデル実装

SQLAlchemy 2.0における投稿、コメント、カテゴリなどのコンテンツモデル実装。リレーションシップ、インデックス、ハイブリッドプロパティを活用した高機能実装。

## 📝 投稿とコンテンツモデル

### 高機能投稿モデル

```python
# models/post.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Boolean, ForeignKey, Index, func
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Optional

from models.base import Base, TimestampMixin, SoftDeleteMixin
from database.types import ArrayType


class Post(Base, TimestampMixin, SoftDeleteMixin):
    """投稿モデル"""
    __tablename__ = "posts"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    # コンテンツ
    title: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, default=None)
    
    # メタデータ
    tags: Mapped[Optional[List[str]]] = mapped_column(
        ArrayType(String),
        default_factory=list
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # 外部キー
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        default=None
    )
    
    # リレーションシップ
    author: Mapped["User"] = relationship(
        "User",
        back_populates="posts",
        lazy="selectin",
        init=False
    )
    
    category: Mapped[Optional["Category"]] = relationship(
        "Category",
        back_populates="posts",
        lazy="selectin",
        init=False
    )
    
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan",
        lazy="dynamic",
        init=False
    )
    
    # インデックス
    __table_args__ = (
        Index("idx_posts_author_published", "author_id", "is_published"),
        Index("idx_posts_category_published", "category_id", "is_published"),
        Index("idx_posts_tags", "tags", postgresql_using="gin"),
        Index("idx_posts_created_published", "created_at", "is_published"),
    )
    
    # ハイブリッドプロパティ
    @hybrid_property
    def comment_count(self) -> int:
        """コメント数"""
        return self.comments.count()
    
    @comment_count.expression
    def comment_count(cls):
        """コメント数（クエリ時）"""
        return (
            select(func.count(Comment.id))
            .where(Comment.post_id == cls.id)
            .where(Comment.is_deleted == False)
            .correlate(cls)
            .scalar_subquery()
        )


class Category(Base, TimestampMixin):
    """カテゴリモデル"""
    __tablename__ = "categories"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    color: Mapped[Optional[str]] = mapped_column(String(7), default=None)  # HEX color
    icon: Mapped[Optional[str]] = mapped_column(String(50), default=None)  # Icon class
    
    # SEOメタデータ
    meta_title: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    meta_description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    
    # 順序とステータス
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
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
    
    # 投稿との関連
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="category",
        lazy="dynamic",
        init=False
    )
    
    # インデックス
    __table_args__ = (
        Index("idx_categories_parent_active", "parent_id", "is_active"),
        Index("idx_categories_sort_active", "sort_order", "is_active"),
    )
    
    @hybrid_property
    def post_count(self) -> int:
        """投稿数"""
        return self.posts.filter(Post.is_published == True).count()
    
    @post_count.expression
    def post_count(cls):
        """投稿数（クエリ時）"""
        return (
            select(func.count(Post.id))
            .where(Post.category_id == cls.id)
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .correlate(cls)
            .scalar_subquery()
        )


class Comment(Base, TimestampMixin, SoftDeleteMixin):
    """コメントモデル"""
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    content: Mapped[str] = mapped_column(Text)
    
    # ステータス
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_spam: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    
    # IPアドレスとユーザーエージェント（モデレーション用）
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), default=None)  # IPv6対応
    user_agent: Mapped[Optional[str]] = mapped_column(Text, default=None)
    
    # 外部キー
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"),
        index=True
    )
    author_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        default=None
    )
    
    # 階層コメント用（自己参照）
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"),
        default=None
    )
    
    # ゲストコメント用フィールド
    guest_name: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    guest_email: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    guest_website: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    
    # リレーションシップ
    post: Mapped["Post"] = relationship(
        "Post",
        back_populates="comments",
        lazy="selectin",
        init=False
    )
    
    author: Mapped[Optional["User"]] = relationship(
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
    
    # インデックス
    __table_args__ = (
        Index("idx_comments_post_approved", "post_id", "is_approved"),
        Index("idx_comments_author_approved", "author_id", "is_approved"),
        Index("idx_comments_parent_approved", "parent_id", "is_approved"),
        Index("idx_comments_created_approved", "created_at", "is_approved"),
    )
    
    @hybrid_property
    def author_name(self) -> str:
        """コメント作成者名（登録ユーザーまたはゲスト）"""
        if self.author:
            return self.author.display_name or self.author.username
        return self.guest_name or "匿名"
    
    @hybrid_property
    def reply_count(self) -> int:
        """返信数"""
        return len(self.replies)
    
    @reply_count.expression
    def reply_count(cls):
        """返信数（クエリ時）"""
        return (
            select(func.count(Comment.id))
            .where(Comment.parent_id == cls.id)
            .where(Comment.is_deleted == False)
            .where(Comment.is_approved == True)
            .correlate(cls)
            .scalar_subquery()
        )
```

## 🏷️ タグとメタデータモデル

### タグ管理システム

```python
# models/tags.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Integer, Boolean, Index, func
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Optional

from models.base import Base, TimestampMixin


class Tag(Base, TimestampMixin):
    """タグモデル"""
    __tablename__ = "tags"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    color: Mapped[Optional[str]] = mapped_column(String(7), default=None)  # HEX color
    
    # 使用統計
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # インデックス
    __table_args__ = (
        Index("idx_tags_usage_count", "usage_count"),
        Index("idx_tags_name_usage", "name", "usage_count"),
    )
    
    @hybrid_property
    def display_name(self) -> str:
        """表示名"""
        return self.name.title()
    
    def __repr__(self) -> str:
        return f"<Tag(name='{self.name}', usage_count={self.usage_count})>"


class PostTag(Base, TimestampMixin):
    """投稿-タグ関連テーブル（拡張版）"""
    __tablename__ = "post_tags"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"),
        index=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        index=True
    )
    
    # タグ付け者
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        default=None
    )
    
    # インデックス
    __table_args__ = (
        UniqueConstraint("post_id", "tag_id"),
        Index("idx_post_tags_post", "post_id"),
        Index("idx_post_tags_tag", "tag_id"),
    )
```