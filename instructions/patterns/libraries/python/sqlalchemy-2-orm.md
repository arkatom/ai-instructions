# SQLAlchemy 2.0 Advanced ORM パターン

SQLAlchemy 2.0の最新機能を活用した高度なORM実装パターン集。非同期処理、型安全性、パフォーマンス最適化を重視したモダンなデータアクセス層構築手法。

## 🔧 SQLAlchemy 2.0 基本設定

### 非同期エンジンとセッション設定

```python
# database/config.py
from sqlalchemy.ext.asyncio import (
    create_async_engine, 
    AsyncSession, 
    async_sessionmaker,
    AsyncEngine
)
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy import event, text
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
import logging

from config.settings import settings


class Base(MappedAsDataclass, DeclarativeBase):
    """
    SQLAlchemy 2.0 スタイルのベースクラス
    MappedAsDataclassを使用してデータクラス機能を提供
    """
    pass


class DatabaseManager:
    """データベース接続とセッション管理"""
    
    def __init__(self):
        self.engine: Optional[AsyncEngine] = None
        self.session_factory: Optional[async_sessionmaker[AsyncSession]] = None
        
    async def initialize(self):
        """データベース初期化"""
        # 非同期エンジン作成
        if settings.ENVIRONMENT == "test":
            # テスト環境: インメモリまたは一時的な接続
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                echo=settings.DATABASE_ECHO,
                poolclass=NullPool,  # テスト時は接続プールを無効化
                isolation_level="AUTOCOMMIT",
            )
        else:
            # プロダクション環境: 最適化された接続プール
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                echo=settings.DATABASE_ECHO,
                poolclass=QueuePool,
                pool_size=settings.DATABASE_POOL_SIZE,
                max_overflow=settings.DATABASE_MAX_OVERFLOW,
                pool_timeout=settings.DATABASE_POOL_TIMEOUT,
                pool_pre_ping=True,  # 接続の健全性チェック
                pool_recycle=3600,   # 1時間で接続をリサイクル
                connect_args={
                    "command_timeout": 60,
                    "server_settings": {
                        "application_name": settings.APP_NAME,
                        "jit": "off",  # JITを無効化（必要に応じて）
                    }
                }
            )
        
        # セッションファクトリー作成
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,  # コミット後もオブジェクトを使用可能
            autoflush=True,          # 自動フラッシュ有効
            autocommit=False,        # 自動コミット無効
        )
        
        # データベース接続テスト
        await self._test_connection()
        
        # イベントリスナー設定
        self._setup_event_listeners()
        
        logging.info("Database initialized successfully")
    
    async def _test_connection(self):
        """データベース接続テスト"""
        try:
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            logging.info("Database connection test successful")
        except Exception as e:
            logging.error(f"Database connection failed: {e}")
            raise
    
    def _setup_event_listeners(self):
        """SQLAlchemyイベントリスナー設定"""
        
        @event.listens_for(self.engine.sync_engine, "connect")
        def set_postgresql_options(dbapi_connection, connection_record):
            """PostgreSQL最適化設定"""
            if "postgresql" in settings.DATABASE_URL:
                with dbapi_connection.cursor() as cursor:
                    # タイムゾーン設定
                    cursor.execute("SET timezone TO 'UTC'")
                    # 分離レベル設定
                    cursor.execute("SET default_transaction_isolation TO 'read committed'")
                    # 統計情報更新
                    cursor.execute("SET track_counts TO on")
                    cursor.execute("SET track_io_timing TO on")
        
        @event.listens_for(AsyncSession, "before_bulk_insert")
        def receive_before_bulk_insert(query, query_context, result):
            """バルクインサート前のログ"""
            logging.info(f"Bulk insert starting: {query}")
        
        @event.listens_for(AsyncSession, "after_transaction_end")
        def receive_after_transaction_end(session, transaction):
            """トランザクション終了後のログ"""
            if transaction.is_active:
                logging.debug("Transaction committed successfully")
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """セッション取得（コンテキストマネージャー）"""
        if not self.session_factory:
            raise RuntimeError("Database not initialized")
        
        async with self.session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def create_tables(self):
        """テーブル作成"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logging.info("Tables created successfully")
    
    async def drop_tables(self):
        """テーブル削除"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logging.info("Tables dropped successfully")
    
    async def close(self):
        """データベース接続終了"""
        if self.engine:
            await self.engine.dispose()
        logging.info("Database connections closed")


# グローバルデータベースインスタンス
db_manager = DatabaseManager()


# 依存性注入用
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI依存性注入用セッション取得"""
    async with db_manager.get_session() as session:
        yield session


# database/types.py
from sqlalchemy import TypeDecorator, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from typing import Any, Optional, Dict, List
import json
import uuid


class GUID(TypeDecorator):
    """プラットフォーム独立なGUID型"""
    impl = String
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID())
        else:
            return dialect.type_descriptor(String(36))
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(value))
            return str(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value


class JSONType(TypeDecorator):
    """プラットフォーム独立なJSON型"""
    impl = Text
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB())
        else:
            return dialect.type_descriptor(Text())
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.dumps(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.loads(value)


class ArrayType(TypeDecorator):
    """プラットフォーム独立な配列型"""
    impl = Text
    cache_ok = True
    
    def __init__(self, item_type=String):
        self.item_type = item_type
        super().__init__()
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(self.item_type))
        else:
            return dialect.type_descriptor(Text())
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.dumps(value)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.loads(value)
```

### 高度なモデル定義

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

## 🔍 高度なクエリパターン

### 複雑なクエリとJOIN最適化

```python
# repositories/user_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, exists, text
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta

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


# repositories/post_repository.py
from sqlalchemy import select, func, and_, or_, desc, asc, case
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any


class PostRepository:
    """投稿リポジトリ"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_engagement(
        self,
        limit: int = 20,
        offset: int = 0,
        author_id: Optional[int] = None,
        category_id: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """エンゲージメント指標付き投稿取得"""
        
        # エンゲージメントスコア計算
        engagement_score = (
            Post.view_count * 0.1 +
            Post.like_count * 2.0 +
            func.coalesce(
                select(func.count(Comment.id))
                .where(Comment.post_id == Post.id)
                .where(Comment.is_deleted == False)
                .correlate(Post)
                .scalar_subquery(),
                0
            ) * 5.0
        ).label("engagement_score")
        
        # いいね率計算
        like_rate = case(
            (Post.view_count > 0, Post.like_count.cast(Float) / Post.view_count * 100),
            else_=0.0
        ).label("like_rate")
        
        stmt = (
            select(
                Post,
                engagement_score,
                like_rate,
                func.coalesce(
                    select(func.count(Comment.id))
                    .where(Comment.post_id == Post.id)
                    .where(Comment.is_deleted == False)
                    .correlate(Post)
                    .scalar_subquery(),
                    0
                ).label("comment_count")
            )
            .options(
                selectinload(Post.author),
                selectinload(Post.category)
            )
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
        )
        
        # フィルター適用
        if author_id:
            stmt = stmt.where(Post.author_id == author_id)
        
        if category_id:
            stmt = stmt.where(Post.category_id == category_id)
        
        if tags:
            # PostgreSQLの配列操作
            stmt = stmt.where(
                or_(*[Post.tags.any(tag) for tag in tags])
            )
        
        stmt = (
            stmt.order_by(engagement_score.desc(), Post.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        
        posts_with_metrics = []
        for row in result:
            posts_with_metrics.append({
                "post": row.Post,
                "engagement_score": float(row.engagement_score),
                "like_rate": float(row.like_rate),
                "comment_count": row.comment_count
            })
        
        return posts_with_metrics
    
    async def get_content_recommendations(
        self,
        user_id: int,
        limit: int = 10
    ) -> List[Post]:
        """コンテンツ推薦アルゴリズム"""
        
        # ユーザーの興味分析
        user_interests_subq = (
            select(
                func.unnest(Post.tags).label("tag"),
                func.count().label("interest_score")
            )
            .select_from(
                Post.join(PostLike, PostLike.post_id == Post.id)
            )
            .where(PostLike.user_id == user_id)
            .group_by(func.unnest(Post.tags))
            .subquery()
        )
        
        # 類似ユーザーの投稿
        similar_users_subq = (
            select(PostLike.user_id)
            .select_from(
                PostLike.join(
                    PostLike.alias("user_likes"),
                    PostLike.post_id == text("user_likes.post_id")
                )
            )
            .where(text("user_likes.user_id") == user_id)
            .where(PostLike.user_id != user_id)
            .group_by(PostLike.user_id)
            .having(func.count() >= 3)  # 3つ以上の共通いいね
            .subquery()
        )
        
        # 推薦スコア計算
        recommendation_score = (
            # タグ一致度
            func.coalesce(
                select(func.sum(user_interests_subq.c.interest_score))
                .select_from(user_interests_subq)
                .where(
                    user_interests_subq.c.tag.in_(
                        select(func.unnest(Post.tags))
                    )
                ),
                0
            ) * 2.0 +
            # 類似ユーザーからの推薦
            func.coalesce(
                select(func.count())
                .select_from(PostLike.join(similar_users_subq))
                .where(PostLike.post_id == Post.id),
                0
            ) * 3.0 +
            # エンゲージメント指標
            Post.like_count * 0.5 +
            Post.view_count * 0.01
        ).label("recommendation_score")
        
        stmt = (
            select(Post, recommendation_score)
            .options(selectinload(Post.author))
            .where(Post.is_published == True)
            .where(Post.is_deleted == False)
            .where(Post.author_id != user_id)  # 自分の投稿は除外
            .where(
                ~exists(
                    select(1)
                    .select_from(PostLike)
                    .where(PostLike.post_id == Post.id)
                    .where(PostLike.user_id == user_id)
                )
            )  # 既にいいねした投稿は除外
            .order_by(recommendation_score.desc(), Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return [row.Post for row in result]
```

## 🧪 テスト戦略

### SQLAlchemy 2.0テストパターン

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
import asyncio
from typing import AsyncGenerator

from database.config import Base
from models.user import User, UserRole, UserStatus
from models.post import Post


@pytest.fixture(scope="session")
def event_loop():
    """イベントループ設定"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """テスト用データベースエンジン"""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    
    # テーブル作成
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # クリーンアップ
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """テスト用データベースセッション"""
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with session_factory() as session:
        # トランザクション開始
        await session.begin()
        
        try:
            yield session
        finally:
            # ロールバック
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def sample_user(db_session: AsyncSession) -> User:
    """サンプルユーザー作成"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password="hashed_password_here",
        first_name="Test",
        last_name="User",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def sample_posts(db_session: AsyncSession, sample_user: User) -> List[Post]:
    """サンプル投稿作成"""
    posts = []
    
    for i in range(5):
        post = Post(
            title=f"Test Post {i}",
            slug=f"test-post-{i}",
            content=f"This is test post content {i}",
            author_id=sample_user.id,
            is_published=True,
            tags=[f"tag{i}", "test"],
            view_count=i * 10,
            like_count=i * 2
        )
        posts.append(post)
        db_session.add(post)
    
    await db_session.commit()
    
    for post in posts:
        await db_session.refresh(post)
    
    return posts


# tests/test_repositories/test_user_repository.py
import pytest
from repositories.user_repository import UserRepository
from models.user import User, UserRole, UserStatus


@pytest.mark.asyncio
class TestUserRepository:
    """ユーザーリポジトリテスト"""
    
    async def test_get_by_id_with_posts(self, db_session, sample_user, sample_posts):
        """投稿込みユーザー取得テスト"""
        repo = UserRepository(db_session)
        
        result = await repo.get_by_id_with_posts(sample_user.id)
        
        assert result is not None
        assert result.id == sample_user.id
        assert len(result.posts) == 5
        assert all(post.author_id == sample_user.id for post in result.posts)
    
    async def test_get_users_with_stats(self, db_session, sample_user, sample_posts):
        """統計情報付きユーザー取得テスト"""
        repo = UserRepository(db_session)
        
        result = await repo.get_users_with_stats(limit=10)
        
        assert len(result) == 1
        user_data = result[0]
        
        assert user_data["user"].id == sample_user.id
        assert user_data["post_count"] == 5
        assert user_data["follower_count"] == 0
        assert user_data["following_count"] == 0
    
    async def test_search_users_advanced(self, db_session, sample_user):
        """高度なユーザー検索テスト"""
        repo = UserRepository(db_session)
        
        # 管理者ユーザー作成
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password="hashed",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE
        )
        db_session.add(admin_user)
        await db_session.commit()
        
        # 検索テスト
        users, total = await repo.search_users_advanced(
            search_term="admin",
            role_filters=[UserRole.ADMIN],
            limit=10
        )
        
        assert total == 1
        assert len(users) == 1
        assert users[0].role == UserRole.ADMIN
    
    async def test_hybrid_properties(self, db_session, sample_user):
        """ハイブリッドプロパティテスト"""
        # full_nameプロパティテスト
        assert sample_user.full_name == "Test User"
        
        # データベースクエリでのテスト
        repo = UserRepository(db_session)
        result = await db_session.execute(
            select(User.full_name).where(User.id == sample_user.id)
        )
        full_name_from_db = result.scalar()
        assert full_name_from_db == "Test User"


# tests/test_models/test_user_model.py
import pytest
from models.user import User, UserRole, UserStatus


@pytest.mark.asyncio
class TestUserModel:
    """ユーザーモデルテスト"""
    
    async def test_user_creation(self, db_session):
        """ユーザー作成テスト"""
        user = User(
            username="newuser",
            email="new@example.com",
            hashed_password="hashed",
            first_name="New",
            last_name="User"
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.id is not None
        assert user.uuid is not None
        assert user.created_at is not None
        assert user.role == UserRole.USER
        assert user.status == UserStatus.PENDING
        assert not user.is_verified
        assert user.is_active
    
    async def test_user_validation(self, db_session):
        """ユーザーバリデーションテスト"""
        # 無効なメールアドレス
        with pytest.raises(Exception):  # CheckConstraint violation
            user = User(
                username="invaliduser",
                email="invalid-email",
                hashed_password="hashed",
                first_name="Invalid",
                last_name="User"
            )
            db_session.add(user)
            await db_session.commit()
    
    async def test_hybrid_properties(self, sample_user):
        """ハイブリッドプロパティテスト"""
        assert sample_user.full_name == "Test User"
        assert not sample_user.is_admin
        
        # 管理者権限テスト
        sample_user.role = UserRole.ADMIN
        assert sample_user.is_admin


# tests/test_performance.py
import pytest
import time
from sqlalchemy import text


@pytest.mark.asyncio
class TestPerformance:
    """パフォーマンステスト"""
    
    async def test_bulk_insert_performance(self, db_session):
        """バルクインサートパフォーマンステスト"""
        users_data = [
            {
                "username": f"user{i}",
                "email": f"user{i}@example.com",
                "hashed_password": "hashed",
                "first_name": f"User{i}",
                "last_name": "Test"
            }
            for i in range(1000)
        ]
        
        start_time = time.time()
        
        # バルクインサート実行
        await db_session.execute(
            text("""
                INSERT INTO users (username, email, hashed_password, first_name, last_name, created_at, updated_at)
                VALUES (:username, :email, :hashed_password, :first_name, :last_name, NOW(), NOW())
            """),
            users_data
        )
        await db_session.commit()
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # 1000件のインサートが1秒以内に完了することを確認
        assert execution_time < 1.0
        
        # 件数確認
        count_result = await db_session.execute(
            text("SELECT COUNT(*) FROM users WHERE username LIKE 'user%'")
        )
        assert count_result.scalar() == 1000
    
    async def test_complex_query_performance(self, db_session, sample_user, sample_posts):
        """複雑なクエリのパフォーマンステスト"""
        repo = UserRepository(db_session)
        
        start_time = time.time()
        
        # 複雑なクエリ実行
        result = await repo.get_users_with_stats(limit=100)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # 0.1秒以内に完了することを確認
        assert execution_time < 0.1
        assert len(result) > 0
```

このSQLAlchemy 2.0 Advanced ORMパターン集は、最新のSQLAlchemy 2.0機能を最大限活用した高度なORM実装を提供します。非同期処理、型安全性、パフォーマンス最適化、包括的なテスト戦略など、モダンなPythonアプリケーション開発に必要なすべての要素を包含しています。