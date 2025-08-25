# SQLAlchemy 2.0 ユーザーモデル実装

Mapped型とMappedAsDataclassを活用した認証・権限管理システム。

## 🏗️ 基底ミックスイン

```python
# models/base.py
from sqlalchemy.orm import Mapped, mapped_column, MappedAsDataclass
from sqlalchemy import DateTime, Boolean, Integer, func
from datetime import datetime
from typing import Optional

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
        Boolean, default=False, init=False, index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=None, init=False
    )

class AuditMixin(MappedAsDataclass):
    """監査ミックスイン"""
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, init=False)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer, init=False)
    version: Mapped[int] = mapped_column(Integer, default=1, init=False)
```

## 👤 ユーザーモデル

```python
# models/user.py
from sqlalchemy import String, Boolean, Enum, Index
from sqlalchemy.ext.hybrid import hybrid_property
from enum import Enum as PyEnum

class UserRole(PyEnum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"

class UserStatus(PyEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"

class User(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    """包括的ユーザーモデル"""
    __tablename__ = "users"
    
    # 基本フィールド
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), init=False)
    
    # プロフィール
    first_name: Mapped[Optional[str]] = mapped_column(String(50))
    last_name: Mapped[Optional[str]] = mapped_column(String(50))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # 権限管理
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.USER, index=True
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus), default=UserStatus.PENDING, index=True
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    
    # 認証追跡
    last_login_at: Mapped[Optional[datetime]] = mapped_column(init=False)
    login_count: Mapped[int] = mapped_column(Integer, default=0, init=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, init=False)
    
    # JSON設定
    settings: Mapped[dict] = mapped_column(JSONType, default_factory=dict)
    
    # リレーションシップ
    profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    posts: Mapped[List["Post"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    
    # ハイブリッドプロパティ
    @hybrid_property
    def full_name(self) -> str:
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
    
    @hybrid_property
    def is_admin(self) -> bool:
        return self.role in [UserRole.ADMIN, UserRole.MODERATOR]
    
    # インデックス
    __table_args__ = (
        Index('idx_users_search', 'email', 'username'),
        Index('idx_users_active_verified', 'is_active', 'is_verified'),
        Index('idx_users_role_status', 'role', 'status'),
    )
```

## 🔑 認証プロフィール

```python
# models/user_profile.py
class UserProfile(Base, TimestampMixin):
    """ユーザープロフィール拡張"""
    __tablename__ = "user_profiles"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    
    # 詳細情報
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    birth_date: Mapped[Optional[date]] = mapped_column(Date)
    
    # ソーシャル
    twitter: Mapped[Optional[str]] = mapped_column(String(100))
    github: Mapped[Optional[str]] = mapped_column(String(100))
    website: Mapped[Optional[str]] = mapped_column(String(255))
    
    # 設定
    theme: Mapped[str] = mapped_column(String(20), default="light")
    language: Mapped[str] = mapped_column(String(10), default="ja")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Tokyo")
    
    # 通知設定
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    push_notifications: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # リレーション
    user: Mapped["User"] = relationship(back_populates="profile")
```

## 🔐 フォロー関係

```python
# models/user_follow.py
class UserFollow(Base, TimestampMixin):
    """ユーザーフォロー関係"""
    __tablename__ = "user_follows"
    
    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    following_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    
    # フォロー関係メタデータ
    is_mutual: Mapped[bool] = mapped_column(Boolean, default=False)
    notification_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # リレーション
    follower: Mapped["User"] = relationship(
        foreign_keys=[follower_id],
        backref="following_relationships"
    )
    following: Mapped["User"] = relationship(
        foreign_keys=[following_id],
        backref="follower_relationships"
    )
    
    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id'),
        Index('idx_follow_mutual', 'is_mutual'),
    )
```

## 💡 実装のポイント

### モデル設計原則
- **Mapped型**: 型安全性の確保
- **MappedAsDataclass**: データクラス機能統合
- **init=False**: 自動生成フィールド
- **インデックス**: 検索性能最適化

### セキュリティ
- パスワードは常にハッシュ化
- 論理削除でデータ保護
- 監査ログで変更追跡
- ロールベースアクセス制御

### パフォーマンス
- 適切なインデックス設定
- JSONフィールドでの柔軟な設定管理
- リレーションシップの最適化
- ハイブリッドプロパティの活用