# SQLAlchemy 2.0 データベース設定

SQLAlchemy 2.0における非同期エンジンとデータベース設定。プロダクション環境での最適化、監視、カスタム型定義を重視した実装指針。

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
```

### カスタム型定義

```python
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

## 🔧 接続プール最適化

### プロダクション環境の接続プール設定

```python
# config/database_settings.py
from pydantic import BaseSettings
from typing import Optional

class DatabaseSettings(BaseSettings):
    """データベース設定"""
    DATABASE_URL: str
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_POOL_PRE_PING: bool = True
    
    # 高負荷環境での設定
    DATABASE_CONNECT_TIMEOUT: int = 60
    DATABASE_COMMAND_TIMEOUT: int = 60
    
    class Config:
        env_file = ".env"


# プロダクション最適化エンジン
def create_optimized_engine(settings: DatabaseSettings):
    """高性能プロダクション環境用エンジン"""
    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DATABASE_ECHO,
        poolclass=QueuePool,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=settings.DATABASE_POOL_TIMEOUT,
        pool_recycle=settings.DATABASE_POOL_RECYCLE,
        pool_pre_ping=settings.DATABASE_POOL_PRE_PING,
        # PostgreSQL固有の最適化
        connect_args={
            "command_timeout": settings.DATABASE_COMMAND_TIMEOUT,
            "server_settings": {
                "application_name": "MyApp",
                "tcp_keepalives_idle": "600",
                "tcp_keepalives_interval": "30",
                "tcp_keepalives_count": "3",
            }
        },
        # 非同期処理最適化
        execution_options={
            "isolation_level": "READ_COMMITTED",
            "autocommit": False,
        }
    )
```

## 📊 監視とロギング

### データベース接続監視

```python
# monitoring/database_monitor.py
import time
import logging
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)

class DatabaseMonitor:
    """データベース接続監視"""
    
    def __init__(self):
        self.connection_count = 0
        self.query_count = 0
        self.slow_query_threshold = 1.0  # 1秒
    
    def setup_monitoring(self, engine: Engine):
        """監視設定"""
        
        @event.listens_for(Pool, "connect")
        def receive_connect(dbapi_connection, connection_record):
            """接続時の監視"""
            self.connection_count += 1
            logger.info(f"Database connection established. Total: {self.connection_count}")
        
        @event.listens_for(Pool, "checkout")
        def receive_checkout(dbapi_connection, connection_record, connection_proxy):
            """接続チェックアウト時の監視"""
            logger.debug("Connection checked out from pool")
        
        @event.listens_for(Pool, "checkin")
        def receive_checkin(dbapi_connection, connection_record):
            """接続チェックイン時の監視"""
            logger.debug("Connection checked in to pool")
        
        @event.listens_for(Engine, "before_cursor_execute")
        def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """クエリ実行前の監視"""
            context._query_start_time = time.time()
            self.query_count += 1
        
        @event.listens_for(Engine, "after_cursor_execute")
        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """クエリ実行後の監視"""
            total = time.time() - context._query_start_time
            if total > self.slow_query_threshold:
                logger.warning(f"Slow query detected: {total:.2f}s - {statement[:100]}")
            logger.debug(f"Query executed in {total:.3f}s")


# 使用例
monitor = DatabaseMonitor()
monitor.setup_monitoring(engine)
```