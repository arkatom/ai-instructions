# SQLAlchemy 2.0 Content Models

Essential content model patterns with relationships, indexing, and hybrid properties.

## 📝 Core Content Models

### Post Model with Advanced Features

```python
# models/post.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, Index, func, select
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Optional

from models.base import Base, TimestampMixin, SoftDeleteMixin

class Post(Base, TimestampMixin, SoftDeleteMixin):
    """Advanced post model with relationships and hybrid properties"""
    __tablename__ = "posts"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    # Core content
    title: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, default=None)
    
    # Status and metadata
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Foreign keys
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), default=None)
    
    # Relationships
    author: Mapped["User"] = relationship("User", back_populates="posts", lazy="selectin", init=False)
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="posts", lazy="selectin", init=False)
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="post", cascade="all, delete-orphan", lazy="selectin", init=False)
    
    # Strategic indexes for performance
    __table_args__ = (
        Index("idx_posts_author_published", "author_id", "is_published"),
        Index("idx_posts_category_published", "category_id", "is_published"), 
        Index("idx_posts_created_published", "created_at", "is_published"),
    )
    
    # Hybrid properties - accessible in both Python and SQL
    @hybrid_property
    def comment_count(self) -> int:
        """Active comment count (instance access)"""
        # selectin loaderの場合はPythonで計算
        return len([c for c in self.comments if not c.is_deleted and c.is_approved])
    
    @comment_count.expression
    def comment_count(cls):
        """Active comment count (query expression)"""
        return (
            select(func.count(Comment.id))
            .where(Comment.post_id == cls.id)
            .where(Comment.is_deleted == False)
            .where(Comment.is_approved == True)
            .correlate(cls)
            .scalar_subquery()
        )
    
    @hybrid_property
    def is_popular(self) -> bool:
        """Popular post indicator based on engagement"""
        return self.view_count > 1000 or self.like_count > 100
```

### Category Model with Hierarchy

```python
# models/category.py
class Category(Base, TimestampMixin):
    """Hierarchical category model"""
    __tablename__ = "categories"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, default=None)
    color: Mapped[Optional[str]] = mapped_column(String(7), default=None)  # HEX color
    
    # Organization
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # Self-referencing hierarchy
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), default=None)
    
    # Relationships
    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side=[id], back_populates="children", lazy="selectin", init=False)
    children: Mapped[List["Category"]] = relationship("Category", back_populates="parent", cascade="all, delete-orphan", lazy="selectin", init=False)
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="category", lazy="selectin", init=False)
    
    __table_args__ = (
        Index("idx_categories_parent_active", "parent_id", "is_active"),
        Index("idx_categories_sort_active", "sort_order", "is_active"),
    )
    
    @hybrid_property
    def post_count(self) -> int:
        """Published post count"""
        # selectin loaderの場合はPythonで計算
        return len([p for p in self.posts if p.is_published and not p.is_deleted])
    
    @hybrid_property
    def full_path(self) -> str:
        """Full category path for breadcrumbs"""
        if self.parent:
            return f"{self.parent.full_path} > {self.name}"
        return self.name
```

### Comment Model with Threading

```python
# models/comment.py
class Comment(Base, TimestampMixin, SoftDeleteMixin):
    """Threaded comment model with moderation"""
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    content: Mapped[str] = mapped_column(Text)
    
    # Moderation
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_spam: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), default=None)  # IPv6 support
    
    # Foreign keys
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), default=None)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), default=None)
    
    # Guest comment fields (when author_id is None)
    guest_name: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    guest_email: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    
    # Relationships
    post: Mapped["Post"] = relationship("Post", back_populates="comments", lazy="selectin", init=False)
    author: Mapped[Optional["User"]] = relationship("User", back_populates="comments", lazy="selectin", init=False)
    
    # Threading
    parent: Mapped[Optional["Comment"]] = relationship("Comment", remote_side=[id], back_populates="replies", lazy="selectin", init=False)
    replies: Mapped[List["Comment"]] = relationship("Comment", back_populates="parent", cascade="all, delete-orphan", lazy="selectin", init=False)
    
    __table_args__ = (
        Index("idx_comments_post_approved", "post_id", "is_approved"),
        Index("idx_comments_author_approved", "author_id", "is_approved"),
        Index("idx_comments_parent_approved", "parent_id", "is_approved"),
    )
    
    @hybrid_property
    def author_name(self) -> str:
        """Display name for comment author"""
        if self.author:
            return self.author.display_name or self.author.username
        return self.guest_name or "Anonymous"
    
    @hybrid_property
    def reply_count(self) -> int:
        """Count of approved replies"""
        return len([r for r in self.replies if not r.is_deleted and r.is_approved])
```

## 🏷️ Tag System

```python
# models/tags.py  
class Tag(Base, TimestampMixin):
    """Tag model with usage tracking"""
    __tablename__ = "tags"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    
    @hybrid_property
    def is_popular(self) -> bool:
        return self.usage_count > 10

# Many-to-many association with metadata
class PostTag(Base, TimestampMixin):
    """Post-Tag association"""
    __tablename__ = "post_tags"
    
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), default=None)
```

## 📊 Repository Patterns

```python
# repositories/content_repository.py
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

class ContentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_published_posts(self, limit: int = 20):
        """Get published posts with computed statistics"""
        
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.comments.and_(Comment.is_approved == True))
                .selectinload(Comment.author)
            )
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        posts = result.scalars().all()
        
        # Leverage hybrid properties
        return [
            {
                "post": post,
                "comment_count": post.comment_count,  # Uses hybrid property
                "is_popular": post.is_popular,        # Uses hybrid property
                "category_path": post.category.full_path if post.category else None
            }
            for post in posts
        ]
    
    async def get_category_hierarchy(self):
        """Get hierarchical category structure"""
        
        stmt = (
            select(Category)
            .options(selectinload(Category.children))
            .where(Category.is_active == True)
            .where(Category.parent_id.is_(None))  # Root categories
            .order_by(Category.sort_order)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_threaded_comments(self, post_id: int):
        """Get threaded comments for a post"""
        
        stmt = (
            select(Comment)
            .options(
                selectinload(Comment.author),
                selectinload(Comment.replies.and_(
                    and_(Comment.is_approved == True, Comment.is_deleted == False)
                )).selectinload(Comment.author)
            )
            .where(Comment.post_id == post_id)
            .where(Comment.parent_id.is_(None))  # Root comments only
            .where(Comment.is_approved == True)
            .where(Comment.is_deleted == False)
            .order_by(Comment.created_at)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()

```