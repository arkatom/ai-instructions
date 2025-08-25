# SQLAlchemy 2.0 ユーザーモデル実装

SQLAlchemy 2.0のMapped型とMappedAsDataclassを活用したユーザーモデル実装。認証、プロフィール、権限管理を統合した包括的なユーザーシステム。

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