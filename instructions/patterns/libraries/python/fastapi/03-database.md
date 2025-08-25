# FastAPI データベース統合

SQLAlchemyとの非同期統合、接続プール最適化、トランザクション管理、マイグレーション戦略の実装。

## 🗄️ SQLAlchemy非同期統合

### データベース設定と接続管理

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker
)
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy import event, text
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """データベース管理クラス"""
    
    def __init__(self):
        self.engine = None
        self.session_factory = None
    
    async def initialize(self):
        """データベース初期化"""
        # エンジン作成
        self.engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            poolclass=QueuePool if settings.ENVIRONMENT == "production" else NullPool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_pre_ping=True,
            pool_recycle=3600,
            connect_args={
                "server_settings": {
                    "application_name": settings.PROJECT_NAME,
                }
            }
        )
        
        # セッションファクトリー作成
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=True,
            autocommit=False
        )
        
        # イベントリスナー設定
        self._setup_event_listeners()
        
        logger.info("Database initialized successfully")
    
    def _setup_event_listeners(self):
        """SQLAlchemyイベントリスナー設定"""
        
        @event.listens_for(self.engine.sync_engine, "connect")
        def set_postgresql_options(dbapi_connection, connection_record):
            """PostgreSQL最適化設定"""
            with dbapi_connection.cursor() as cursor:
                cursor.execute("SET timezone TO 'UTC'")
                cursor.execute("SET statement_timeout TO '30s'")
    
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
    
    async def close(self):
        """データベース接続終了"""
        if self.engine:
            await self.engine.dispose()
        logger.info("Database connections closed")


# グローバルインスタンス
database_manager = DatabaseManager()


# FastAPI依存関数
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """データベースセッション依存関数"""
    async with database_manager.get_session() as session:
        yield session


# app/models/base.py
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass, Mapped, mapped_column
from sqlalchemy import DateTime, Boolean, func
from datetime import datetime
from typing import Optional


class Base(MappedAsDataclass, DeclarativeBase):
    """SQLAlchemy基底クラス"""
    pass


class TimestampMixin(MappedAsDataclass):
    """タイムスタンプミックスイン"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        init=False
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
        init=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None,
        init=False
    )
```

## 🔄 リポジトリパターン実装

### 非同期リポジトリベースクラス

```python
# app/repositories/base.py
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
import logging

T = TypeVar('T')
CreateSchemaType = TypeVar('CreateSchemaType', bound=BaseModel)
UpdateSchemaType = TypeVar('UpdateSchemaType', bound=BaseModel)

logger = logging.getLogger(__name__)


class BaseRepository(Generic[T], ABC):
    """非同期リポジトリ基底クラス"""
    
    def __init__(self, session: AsyncSession, model_class: Type[T]):
        self.session = session
        self.model_class = model_class
    
    async def get_by_id(self, id: int) -> Optional[T]:
        """IDによる取得"""
        try:
            result = await self.session.execute(
                select(self.model_class).where(self.model_class.id == id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching {self.model_class.__name__} by id {id}: {e}")
            raise
    
    async def get_by_ids(self, ids: List[int]) -> List[T]:
        """複数IDによる取得"""
        result = await self.session.execute(
            select(self.model_class).where(self.model_class.id.in_(ids))
        )
        return result.scalars().all()
    
    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Dict[str, Any] = None
    ) -> List[T]:
        """全件取得（フィルター、ページネーション対応）"""
        query = select(self.model_class)
        
        # フィルター適用
        if filters:
            for field, value in filters.items():
                if hasattr(self.model_class, field):
                    column = getattr(self.model_class, field)
                    query = query.where(column == value)
        
        query = query.offset(skip).limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create(self, obj_in: CreateSchemaType) -> T:
        """エンティティ作成"""
        try:
            db_obj = self.model_class(**obj_in.model_dump())
            self.session.add(db_obj)
            await self.session.flush()
            await self.session.refresh(db_obj)
            return db_obj
        except SQLAlchemyError as e:
            logger.error(f"Error creating {self.model_class.__name__}: {e}")
            await self.session.rollback()
            raise
    
    async def update(self, db_obj: T, obj_in: UpdateSchemaType) -> T:
        """エンティティ更新"""
        try:
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            
            await self.session.flush()
            await self.session.refresh(db_obj)
            return db_obj
        except SQLAlchemyError as e:
            logger.error(f"Error updating {self.model_class.__name__}: {e}")
            await self.session.rollback()
            raise
    
    async def delete(self, id: int) -> bool:
        """エンティティ削除"""
        try:
            result = await self.session.execute(
                delete(self.model_class).where(self.model_class.id == id)
            )
            return result.rowcount > 0
        except SQLAlchemyError as e:
            logger.error(f"Error deleting {self.model_class.__name__} with id {id}: {e}")
            await self.session.rollback()
            raise
    
    async def count(self, filters: Dict[str, Any] = None) -> int:
        """件数取得"""
        query = select(func.count(self.model_class.id))
        
        if filters:
            for field, value in filters.items():
                if hasattr(self.model_class, field):
                    column = getattr(self.model_class, field)
                    query = query.where(column == value)
        
        result = await self.session.execute(query)
        return result.scalar()


# app/repositories/user.py
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from .base import BaseRepository


class UserRepository(BaseRepository[User]):
    """ユーザーリポジトリ"""
    
    def __init__(self, session: AsyncSession):
        super().__init__(session, User)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """メールアドレスによる取得"""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """ユーザー名による取得"""
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_with_posts(self, user_id: int) -> Optional[User]:
        """投稿を含むユーザー取得"""
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.posts))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def is_email_taken(self, email: str, exclude_id: Optional[int] = None) -> bool:
        """メールアドレスが使用済みかチェック"""
        query = select(User.id).where(User.email == email)
        
        if exclude_id:
            query = query.where(User.id != exclude_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def get_active_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """アクティブユーザー取得"""
        result = await self.session.execute(
            select(User)
            .where(User.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
```

## 🔧 CRUD操作とサービス層

### CRUDベースクラス

```python
# app/crud/base.py
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """CRUD基底クラス"""
    
    def __init__(self, model: Type[ModelType]):
        self.model = model
    
    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()
    
    async def get_multi(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[ModelType]:
        result = await db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create(
        self, 
        db: AsyncSession, 
        obj_in: CreateSchemaType
    ) -> ModelType:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def remove(self, db: AsyncSession, id: int) -> ModelType:
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalar_one()
        await db.delete(obj)
        await db.commit()
        return obj


# app/crud/user.py
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """ユーザーCRUD操作"""
    
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()
    
    async def create(self, db: AsyncSession, obj_in: UserCreate) -> User:
        db_obj = User(
            username=obj_in.username,
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            is_active=True
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def authenticate(
        self, db: AsyncSession, username: str, password: str
    ) -> Optional[User]:
        user = await self.get_by_username(db, username=username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    
    async def is_active(self, user: User) -> bool:
        return user.is_active
    
    async def is_superuser(self, user: User) -> bool:
        return user.is_superuser


user = CRUDUser(User)
```

## 💾 トランザクション管理

### 高度なトランザクション制御

```python
# app/core/transaction.py
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class TransactionManager:
    """トランザクション管理"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    @asynccontextmanager
    async def transaction(
        self,
        rollback_on_exception: bool = True,
        commit_on_success: bool = True
    ) -> AsyncGenerator[AsyncSession, None]:
        """トランザクション管理コンテキスト"""
        transaction = await self.session.begin()
        
        try:
            yield self.session
            
            if commit_on_success:
                await transaction.commit()
                logger.debug("Transaction committed successfully")
            
        except Exception as e:
            if rollback_on_exception:
                await transaction.rollback()
                logger.error(f"Transaction rolled back due to error: {e}")
            raise
        
        finally:
            if transaction.is_active:
                await transaction.close()


def transactional(
    rollback_on_exception: bool = True,
    commit_on_success: bool = True
):
    """トランザクションデコレーター"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # セッションを引数から取得
            session = None
            for arg in args:
                if isinstance(arg, AsyncSession):
                    session = arg
                    break
            
            if not session:
                # セッションがない場合は通常の実行
                return await func(*args, **kwargs)
            
            # トランザクション内で実行
            transaction_manager = TransactionManager(session)
            async with transaction_manager.transaction(
                rollback_on_exception=rollback_on_exception,
                commit_on_success=commit_on_success
            ):
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# app/services/user_service.py
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.crud.user import user
from app.schemas.user import UserCreate, UserUpdate, User as UserSchema
from app.core.transaction import transactional


class UserService:
    """ユーザーサービス"""
    
    @transactional()
    async def create_user(
        self,
        db: AsyncSession,
        user_create: UserCreate
    ) -> UserSchema:
        """ユーザー作成"""
        # 既存チェック
        existing_user = await user.get_by_email(db, email=user_create.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        existing_username = await user.get_by_username(db, username=user_create.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # ユーザー作成
        db_user = await user.create(db, obj_in=user_create)
        
        # ウェルカムメール送信（非同期）
        await self.send_welcome_email(db_user.email)
        
        return UserSchema.model_validate(db_user)
    
    async def send_welcome_email(self, email: str):
        """ウェルカムメール送信（非同期処理）"""
        # バックグラウンドタスクとして実装
        pass


user_service = UserService()
```

## 🔄 データベースマイグレーション

### Alembic統合

```python
# alembic/env.py
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# アプリケーションのモデルをインポート
from app.core.config import settings
from app.models.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """オフラインマイグレーション"""
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """マイグレーション実行"""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """オンラインマイグレーション"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=settings.DATABASE_URL,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())


# scripts/migrate.py
#!/usr/bin/env python3
"""データベースマイグレーションスクリプト"""

import asyncio
import click
from alembic import command
from alembic.config import Config

@click.group()
def cli():
    """Database migration commands"""
    pass

@click.command()
@click.option('--message', '-m', required=True, help='Migration message')
def create_migration(message: str):
    """新しいマイグレーションファイルを作成"""
    alembic_cfg = Config("alembic.ini")
    command.revision(alembic_cfg, message=message, autogenerate=True)
    click.echo(f"Migration created: {message}")

@click.command()
def upgrade():
    """最新バージョンにマイグレーション実行"""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    click.echo("Database upgraded to latest version")

@click.command()
def downgrade():
    """1つ前のバージョンにダウングレード"""
    alembic_cfg = Config("alembic.ini")
    command.downgrade(alembic_cfg, "-1")
    click.echo("Database downgraded by one version")

cli.add_command(create_migration)
cli.add_command(upgrade)
cli.add_command(downgrade)

if __name__ == '__main__':
    cli()
```