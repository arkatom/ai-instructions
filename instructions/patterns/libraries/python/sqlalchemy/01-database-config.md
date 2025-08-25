# SQLAlchemy 2.0 データベース設定

非同期エンジン、接続プール、カスタム型定義のプロダクション向け設定。

## 🔧 基本設定

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

class Base(MappedAsDataclass, DeclarativeBase):
    """SQLAlchemy 2.0 ベースクラス - データクラス統合"""
    pass

class DatabaseManager:
    """データベース接続管理"""
    
    async def initialize(self):
        """エンジンとセッション初期化"""
        
        # 環境別エンジン設定
        if settings.ENVIRONMENT == "test":
            # テスト環境: 軽量設定
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                poolclass=NullPool,  # 接続プール無効
                isolation_level="AUTOCOMMIT",
            )
        else:
            # プロダクション環境: 最適化設定
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                poolclass=QueuePool,
                pool_size=20,           # 基本接続数
                max_overflow=10,        # 追加接続数
                pool_timeout=30,        # タイムアウト
                pool_pre_ping=True,     # 健全性チェック
                pool_recycle=3600,      # 1時間でリサイクル
                connect_args={
                    "command_timeout": 60,
                    "server_settings": {
                        "application_name": settings.APP_NAME,
                        "jit": "off"
                    }
                }
            )
        
        # セッションファクトリー
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,  # コミット後も使用可能
            autoflush=True,
            autocommit=False,
        )
        
        # 接続テスト
        async with self.engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """セッション取得コンテキストマネージャー"""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def close(self):
        """接続クローズ"""
        if self.engine:
            await self.engine.dispose()

# シングルトンインスタンス
db_manager = DatabaseManager()
```

## 🎯 カスタム型定義

```python
# database/types.py
from sqlalchemy.types import TypeDecorator, String, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
import json
import uuid

class UUIDType(TypeDecorator):
    """UUID型（DB非依存）"""
    impl = String(36)
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return str(value)
        return str(value).replace('-', '')
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(value)

class EncryptedType(TypeDecorator):
    """暗号化カラム型"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is not None:
            return encrypt(value)  # 暗号化関数
        return value
    
    def process_result_value(self, value, dialect):
        if value is not None:
            return decrypt(value)  # 復号化関数
        return value

class JSONBType(TypeDecorator):
    """JSONB型（PostgreSQL最適化）"""
    impl = JSON
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB)
        else:
            return dialect.type_descriptor(JSON)

# 使用例
class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True)
    encrypted_data: Mapped[str] = mapped_column(EncryptedType)
    settings: Mapped[dict] = mapped_column(JSONBType)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String))
```

## ⚙️ ミックスイン

```python
# database/mixins.py
from sqlalchemy import DateTime, func
from datetime import datetime

class TimestampMixin:
    """タイムスタンプミックスイン"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

class SoftDeleteMixin:
    """論理削除ミックスイン"""
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        index=True  # 検索性能向上
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

class VersionMixin:
    """楽観的ロック用バージョン管理"""
    version: Mapped[int] = mapped_column(
        default=1,
        nullable=False
    )
    
    __mapper_args__ = {
        "version_id_col": version,
        "version_id_generator": lambda v: (v or 0) + 1
    }
```

## 🔌 接続プール監視

```python
# database/monitoring.py
class PoolMonitor:
    """接続プール監視"""
    
    @staticmethod
    def setup_listeners(engine):
        """イベントリスナー設定"""
        
        @event.listens_for(engine, "connect")
        def receive_connect(dbapi_conn, connection_record):
            connection_record.info['connect_time'] = time.time()
        
        @event.listens_for(engine, "checkout")
        def receive_checkout(dbapi_conn, connection_record, connection_proxy):
            duration = time.time() - connection_record.info.get('connect_time', 0)
            if duration > 300:  # 5分以上
                logger.warning(f"Long-lived connection: {duration}s")
        
        @event.listens_for(engine, "checkin")
        def receive_checkin(dbapi_conn, connection_record):
            # 接続の健全性チェック
            if connection_record.info.get('invalidated'):
                logger.info("Invalidated connection returned to pool")
    
    @staticmethod
    def get_pool_status(engine):
        """プール状態取得"""
        pool = engine.pool
        return {
            "size": pool.size(),
            "checked_out": pool.checked_out(),
            "overflow": pool.overflow(),
            "total": pool.size() + pool.overflow()
        }
```

## 💡 ベストプラクティス

### 接続プール設定
- **pool_size**: CPU数 × 2-4
- **max_overflow**: pool_sizeの50%
- **pool_pre_ping**: 本番環境では必須
- **pool_recycle**: クラウド環境では必須

### パフォーマンス最適化
- **expire_on_commit=False**: 不要なリフレッシュ回避
- **JSONB使用**: PostgreSQLでのJSON最適化
- **インデックス**: 検索・結合カラムに必須
- **バッチ処理**: bulk_insert_mappings活用