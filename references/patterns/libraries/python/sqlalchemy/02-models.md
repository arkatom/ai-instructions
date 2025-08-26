# SQLAlchemy 2.0 モデル定義

SQLAlchemy 2.0のMapped型とMappedAsDataclassを活用した高度なモデル定義パターン。型安全性とパフォーマンスを重視した実装方法。

## 🏗️ 基底クラスとミックスイン

### 基本ミックスイン定義

```python
# models/base.py
from sqlalchemy.orm import (
    Mapped, 
    mapped_column, 
    DeclarativeBase,
    MappedAsDataclass,
    relationship
)
from sqlalchemy import (
    Integer, 
    String, 
    DateTime, 
    Boolean, 
    Text,
    func,
    Index,
    UniqueConstraint,
    CheckConstraint
)
from datetime import datetime
from typing import Optional
import uuid

from database.types import GUID


class TimestampMixin(MappedAsDataclass):
    """タイムスタンプミックスイン"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        init=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        init=False
    )


class SoftDeleteMixin(MappedAsDataclass):
    """論理削除ミックスイン"""
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        init=False,
        index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None,
        init=False
    )


class AuditMixin(MappedAsDataclass):
    """監査ミックスイン"""
    created_by_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        default=None,
        init=False
    )
    updated_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, 
        default=None,
        init=False
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        init=False
    )
```

## 👤 高度なユーザーモデル

### 包括的なユーザーモデル定義

```python
# models/user.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Text, Enum, ForeignKey, Index
from sqlalchemy.ext.hybrid import hybrid_property
from enum import Enum as PyEnum
from typing import List, Optional
from datetime import datetime

from models.base import Base, TimestampMixin, SoftDeleteMixin, AuditMixin
from database.types import GUID, JSONType


class UserRole(PyEnum):
    """ユーザー権限列挙型"""
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPERUSER = "superuser"


class UserStatus(PyEnum):
    """ユーザー状態列挙型"""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class User(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    """ユーザーモデル"""
    __tablename__ = "users"
    
    # 基本フィールド
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    uuid: Mapped[str] = mapped_column(
        GUID,
        default_factory=uuid.uuid4,
        unique=True,
        index=True,
        init=False
    )
    
    # 認証情報
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255))
    
    # プロフィール情報
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50))
    display_name: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    bio: Mapped[Optional[str]] = mapped_column(Text, default=None)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    
    # ステータス
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        default=UserRole.USER
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus),
        default=UserStatus.PENDING,
        index=True
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # メタデータ
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONType,
        default_factory=dict
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None
    )
    login_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # リレーションシップ
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="author",
        cascade="all, delete-orphan",
        lazy="selectin",  # N+1問題回避
        init=False
    )
    
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="author",
        cascade="all, delete-orphan",
        lazy="dynamic",  # 大量データの場合
        init=False
    )
    
    followers: Mapped[List["UserFollow"]] = relationship(
        "UserFollow",
        foreign_keys="UserFollow.following_id",
        back_populates="following_user",
        cascade="all, delete-orphan",
        init=False
    )
    
    following: Mapped[List["UserFollow"]] = relationship(
        "UserFollow",
        foreign_keys="UserFollow.follower_id",
        back_populates="follower_user",
        cascade="all, delete-orphan",
        init=False
    )
    
    # インデックス定義
    __table_args__ = (
        Index("idx_users_email_status", "email", "status"),
        Index("idx_users_role_active", "role", "is_active"),
        Index("idx_users_created_at_status", "created_at", "status"),
        CheckConstraint("email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'"),
        CheckConstraint("username ~ '^[a-zA-Z0-9_]{3,50}$'"),
    )
    
    # ハイブリッドプロパティ
    @hybrid_property
    def full_name(self) -> str:
        """フルネーム取得"""
        return f"{self.first_name} {self.last_name}".strip()
    
    @full_name.expression
    def full_name(cls):
        """SQLクエリ用フルネーム式"""
        return func.concat(cls.first_name, ' ', cls.last_name)
    
    @hybrid_property
    def follower_count(self) -> int:
        """フォロワー数（プロパティアクセス時）"""
        return len(self.followers)
    
    @follower_count.expression
    def follower_count(cls):
        """フォロワー数（クエリ時）"""
        return (
            select(func.count(UserFollow.id))
            .where(UserFollow.following_id == cls.id)
            .correlate(cls)
            .scalar_subquery()
        )
    
    @hybrid_property
    def is_admin(self) -> bool:
        """管理者権限チェック"""
        return self.role in (UserRole.ADMIN, UserRole.SUPERUSER)
    
    @is_admin.expression
    def is_admin(cls):
        """管理者権限チェック（クエリ時）"""
        return cls.role.in_([UserRole.ADMIN, UserRole.SUPERUSER])
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
```

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

## 📊 高度なモデル機能

### カスタムバリデーション

```python
# models/validators.py
from sqlalchemy.orm import validates
from sqlalchemy.exc import ValidationError
import re


class UserValidationMixin:
    """ユーザーバリデーションミックスイン"""
    
    @validates('email')
    def validate_email(self, key, email):
        """メールアドレス検証"""
        if not re.match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$', email):
            raise ValidationError("Invalid email format")
        return email.lower()
    
    @validates('username')
    def validate_username(self, key, username):
        """ユーザー名検証"""
        if not re.match(r'^[a-zA-Z0-9_]{3,50}$', username):
            raise ValidationError("Username must be 3-50 characters, alphanumeric and underscore only")
        return username.lower()
    
    @validates('password')
    def validate_password(self, key, password):
        """パスワード検証"""
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain at least one lowercase letter")
        if not re.search(r'\d', password):
            raise ValidationError("Password must contain at least one number")
        return password


# 改良されたUserモデル
class User(Base, TimestampMixin, SoftDeleteMixin, UserValidationMixin):
    # ... 既存のフィールド定義 ...
    
    @validates('first_name', 'last_name')
    def validate_name(self, key, name):
        """名前検証"""
        if len(name.strip()) < 1:
            raise ValidationError(f"{key} cannot be empty")
        if len(name) > 50:
            raise ValidationError(f"{key} cannot exceed 50 characters")
        return name.strip().title()
```

### イベントリスナーとライフサイクル

```python
# models/events.py
from sqlalchemy import event
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@event.listens_for(User, 'before_insert')
def receive_before_insert(mapper, connection, target):
    """ユーザー挿入前処理"""
    # UUID生成
    if not target.uuid:
        target.uuid = str(uuid.uuid4())
    
    # パスワードハッシュ化
    if hasattr(target, '_plain_password'):
        target.hashed_password = hash_password(target._plain_password)
        delattr(target, '_plain_password')
    
    logger.info(f"Creating new user: {target.username}")


@event.listens_for(User, 'before_update')
def receive_before_update(mapper, connection, target):
    """ユーザー更新前処理"""
    target.updated_at = datetime.utcnow()
    target.version += 1
    
    logger.info(f"Updating user: {target.username}")


@event.listens_for(Post, 'after_insert')
def receive_post_after_insert(mapper, connection, target):
    """投稿挿入後処理"""
    # 通知送信、インデックス更新など
    logger.info(f"New post created: {target.title} by user {target.author_id}")


@event.listens_for(Session, 'before_commit')
def receive_before_commit(session):
    """コミット前の最終検証"""
    for instance in session.new:
        if hasattr(instance, 'validate_before_save'):
            instance.validate_before_save()
    
    for instance in session.dirty:
        if hasattr(instance, 'validate_before_update'):
            instance.validate_before_update()
```

## 🛡️ セキュリティとプライバシー

### データマスキングとプライバシー

```python
# models/privacy.py
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import func
import hashlib


class PrivacyMixin:
    """プライバシー保護ミックスイン"""
    
    @hybrid_property
    def masked_email(self) -> str:
        """マスクされたメールアドレス"""
        if '@' in self.email:
            local, domain = self.email.split('@', 1)
            if len(local) <= 2:
                masked_local = local[0] + '*'
            else:
                masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
            return f"{masked_local}@{domain}"
        return "*****"
    
    @masked_email.expression
    def masked_email(cls):
        """マスクされたメールアドレス（クエリ用）"""
        return func.regexp_replace(
            cls.email,
            r'^(.).*(@.*)$',
            r'\1****\2'
        )
    
    @property
    def email_hash(self) -> str:
        """メールアドレスのハッシュ（統計用）"""
        return hashlib.sha256(self.email.encode()).hexdigest()[:16]


# 改良されたUserモデル
class User(Base, TimestampMixin, SoftDeleteMixin, PrivacyMixin):
    # ... 既存の定義 ...
    
    def to_public_dict(self) -> dict:
        """公開用辞書（機密情報除外）"""
        return {
            'id': self.id,
            'uuid': self.uuid,
            'username': self.username,
            'display_name': self.display_name,
            'full_name': self.full_name,
            'avatar_url': self.avatar_url,
            'is_verified': self.is_verified,
            'created_at': self.created_at,
            'follower_count': self.follower_count
        }
    
    def to_private_dict(self) -> dict:
        """プライベート用辞書（所有者のみ）"""
        return {
            **self.to_public_dict(),
            'email': self.masked_email,  # マスク済み
            'settings': self.settings,
            'last_login_at': self.last_login_at,
            'login_count': self.login_count
        }
```