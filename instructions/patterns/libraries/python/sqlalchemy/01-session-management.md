# SQLAlchemy 2.0 セッション管理

SQLAlchemy 2.0における非同期セッション管理とトランザクション制御。リポジトリパターン、依存性注入、エラーハンドリングの実装指針。

## 🚀 実装のベストプラクティス

### 1. 非同期セッション管理

```python
# repository/base.py
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import SQLAlchemyError

T = TypeVar('T')

class AsyncRepository(Generic[T], ABC):
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
    
    async def create(self, entity: T) -> T:
        """エンティティ作成"""
        try:
            self.session.add(entity)
            await self.session.flush()
            await self.session.refresh(entity)
            return entity
        except SQLAlchemyError as e:
            logger.error(f"Error creating {self.model_class.__name__}: {e}")
            await self.session.rollback()
            raise
    
    async def update(self, entity: T) -> T:
        """エンティティ更新"""
        try:
            await self.session.merge(entity)
            await self.session.flush()
            await self.session.refresh(entity)
            return entity
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
    
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """全エンティティ取得（ページネーション対応）"""
        try:
            result = await self.session.execute(
                select(self.model_class).offset(offset).limit(limit)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all {self.model_class.__name__}: {e}")
            raise
    
    async def count(self) -> int:
        """エンティティ数取得"""
        try:
            result = await self.session.execute(
                select(func.count(self.model_class.id))
            )
            return result.scalar_one()
        except SQLAlchemyError as e:
            logger.error(f"Error counting {self.model_class.__name__}: {e}")
            raise
    
    async def exists(self, id: int) -> bool:
        """エンティティ存在チェック"""
        try:
            result = await self.session.execute(
                select(self.model_class.id).where(self.model_class.id == id)
            )
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking existence of {self.model_class.__name__} with id {id}: {e}")
            raise
```

### 2. トランザクション管理

```python
# services/base.py
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)

class TransactionManager:
    """トランザクション管理"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[AsyncSession, None]:
        """トランザクション管理コンテキスト"""
        async with self.db_manager.get_session() as session:
            try:
                await session.begin()
                yield session
                await session.commit()
                logger.debug("Transaction committed successfully")
            except SQLAlchemyError as e:
                await session.rollback()
                logger.error(f"Transaction rolled back due to error: {e}")
                raise
            except Exception as e:
                await session.rollback()
                logger.error(f"Transaction rolled back due to unexpected error: {e}")
                raise
    
    @asynccontextmanager
    async def read_only_session(self) -> AsyncGenerator[AsyncSession, None]:
        """読み取り専用セッション"""
        async with self.db_manager.get_session() as session:
            try:
                # 読み取り専用設定
                await session.execute(text("SET TRANSACTION READ ONLY"))
                yield session
            finally:
                await session.close()
    
    @asynccontextmanager
    async def nested_transaction(self, session: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
        """ネストしたトランザクション（セーブポイント）"""
        savepoint = await session.begin_nested()
        try:
            yield session
            await savepoint.commit()
            logger.debug("Nested transaction committed successfully")
        except Exception as e:
            await savepoint.rollback()
            logger.error(f"Nested transaction rolled back: {e}")
            raise


# 使用例
async def transfer_funds(transaction_manager, from_account_id, to_account_id, amount):
    """資金移動（トランザクション例）"""
    async with transaction_manager.transaction() as session:
        account_repo = AccountRepository(session)
        
        # 複数の操作を同一トランザクション内で実行
        from_account = await account_repo.get_by_id(from_account_id)
        to_account = await account_repo.get_by_id(to_account_id)
        
        if from_account.balance < amount:
            raise InsufficientFundsError("残高不足")
        
        from_account.balance -= amount
        to_account.balance += amount
        
        await account_repo.update(from_account)
        await account_repo.update(to_account)
        
        # トランザクションログを記録
        transaction_log = TransactionLog(
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount,
            transaction_type="transfer"
        )
        await transaction_log_repo.create(transaction_log)
        
        await session.flush()  # 制約チェックを実行
        # コミットはコンテキストマネージャーが自動実行
```

### 3. セッション管理の高度なパターン

```python
# database/session_manager.py
from typing import AsyncGenerator, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
import asyncio
import logging

logger = logging.getLogger(__name__)


class SessionManager:
    """高度なセッション管理"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
        self._local_sessions: Dict[str, AsyncSession] = {}
    
    @asynccontextmanager
    async def get_session(
        self,
        session_id: Optional[str] = None,
        isolation_level: Optional[str] = None,
        read_only: bool = False
    ) -> AsyncGenerator[AsyncSession, None]:
        """設定可能なセッション取得"""
        
        if session_id and session_id in self._local_sessions:
            # 既存セッションを再利用
            yield self._local_sessions[session_id]
            return
        
        async with self.db_manager.session_factory() as session:
            try:
                # 分離レベル設定
                if isolation_level:
                    await session.execute(
                        text(f"SET TRANSACTION ISOLATION LEVEL {isolation_level}")
                    )
                
                # 読み取り専用設定
                if read_only:
                    await session.execute(text("SET TRANSACTION READ ONLY"))
                
                # セッションIDが指定されている場合はローカルに保存
                if session_id:
                    self._local_sessions[session_id] = session
                
                yield session
                
            except Exception:
                await session.rollback()
                raise
            finally:
                # ローカルセッションのクリーンアップ
                if session_id and session_id in self._local_sessions:
                    del self._local_sessions[session_id]
                await session.close()
    
    @asynccontextmanager
    async def batch_session(self, batch_size: int = 1000) -> AsyncGenerator[AsyncSession, None]:
        """バッチ処理用セッション"""
        async with self.db_manager.session_factory() as session:
            try:
                # バッチ処理用最適化
                await session.execute(text("SET synchronous_commit = OFF"))
                await session.execute(text("SET wal_buffers = '16MB'"))
                
                yield session
                
            except Exception:
                await session.rollback()
                raise
            finally:
                # 設定を元に戻す
                await session.execute(text("SET synchronous_commit = ON"))
                await session.close()
    
    async def cleanup_sessions(self):
        """セッションクリーンアップ"""
        for session_id, session in list(self._local_sessions.items()):
            try:
                await session.close()
                del self._local_sessions[session_id]
                logger.debug(f"Session {session_id} cleaned up")
            except Exception as e:
                logger.error(f"Error cleaning up session {session_id}: {e}")


class ConnectionPoolMonitor:
    """接続プール監視"""
    
    def __init__(self, engine):
        self.engine = engine
        self._monitoring = False
    
    async def start_monitoring(self, interval: int = 60):
        """監視開始"""
        self._monitoring = True
        while self._monitoring:
            pool_status = self.get_pool_status()
            logger.info(f"Connection pool status: {pool_status}")
            
            # 接続プールが満杯に近い場合の警告
            if pool_status['checked_out'] / pool_status['pool_size'] > 0.8:
                logger.warning("Connection pool is nearly full!")
            
            await asyncio.sleep(interval)
    
    def stop_monitoring(self):
        """監視停止"""
        self._monitoring = False
    
    def get_pool_status(self) -> Dict[str, Any]:
        """プール状態取得"""
        pool = self.engine.pool
        return {
            'pool_size': pool.size(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'checked_in': pool.checkedin(),
        }


# 使用例
session_manager = SessionManager(db_manager)

# 通常のセッション使用
async with session_manager.get_session() as session:
    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(1)

# 読み取り専用セッション
async with session_manager.get_session(read_only=True) as session:
    user_repo = UserRepository(session)
    users = await user_repo.get_all()

# バッチ処理用セッション
async with session_manager.batch_session() as session:
    user_repo = UserRepository(session)
    for i in range(1000):
        user = User(username=f"user_{i}")
        await user_repo.create(user)
        
        if i % 100 == 0:
            await session.commit()  # 100件ごとにコミット
```

### 4. エラーハンドリングと再試行

```python
# database/error_handling.py
import asyncio
from typing import Callable, Any, Optional
from functools import wraps
from sqlalchemy.exc import (
    SQLAlchemyError, 
    DisconnectionError, 
    OperationalError,
    IntegrityError
)
import logging

logger = logging.getLogger(__name__)


def retry_on_database_error(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0
):
    """データベースエラー時の再試行デコレータ"""
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                
                except (DisconnectionError, OperationalError) as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        logger.error(f"Max retries ({max_retries}) exceeded for {func.__name__}")
                        break
                    
                    wait_time = delay * (backoff_factor ** attempt)
                    logger.warning(
                        f"Database error in {func.__name__}, "
                        f"retrying in {wait_time}s (attempt {attempt + 1}/{max_retries}): {e}"
                    )
                    await asyncio.sleep(wait_time)
                
                except IntegrityError as e:
                    # 整合性エラーは再試行しない
                    logger.error(f"Integrity error in {func.__name__}: {e}")
                    raise
                
                except SQLAlchemyError as e:
                    # その他のSQLAlchemyエラーも再試行しない
                    logger.error(f"SQLAlchemy error in {func.__name__}: {e}")
                    raise
            
            # 最後の例外を再発生
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


class DatabaseErrorHandler:
    """データベースエラーハンドラー"""
    
    @staticmethod
    async def handle_connection_error(session: AsyncSession, error: Exception):
        """接続エラーハンドリング"""
        logger.error(f"Database connection error: {error}")
        
        try:
            await session.rollback()
        except Exception as rollback_error:
            logger.error(f"Error during rollback: {rollback_error}")
        
        # 接続を再確立
        await session.close()
    
    @staticmethod
    async def handle_integrity_error(session: AsyncSession, error: IntegrityError):
        """整合性制約エラーハンドリング"""
        logger.error(f"Integrity constraint violation: {error}")
        
        try:
            await session.rollback()
        except Exception as rollback_error:
            logger.error(f"Error during rollback: {rollback_error}")
        
        # エラーの詳細を解析して適切な例外を発生
        if "unique" in str(error).lower():
            raise DuplicateRecordError("Record already exists")
        elif "foreign key" in str(error).lower():
            raise InvalidReferenceError("Referenced record does not exist")
        else:
            raise DatabaseConstraintError(f"Database constraint violation: {error}")


# 使用例
class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
    
    @retry_on_database_error(max_retries=3, delay=1.0)
    async def create_user(self, user_data: dict) -> User:
        """ユーザー作成（再試行付き）"""
        try:
            user = User(**user_data)
            return await self.user_repo.create(user)
        
        except IntegrityError as e:
            await DatabaseErrorHandler.handle_integrity_error(self.session, e)
        
        except (DisconnectionError, OperationalError) as e:
            await DatabaseErrorHandler.handle_connection_error(self.session, e)
            raise  # 再試行のため再発生
```