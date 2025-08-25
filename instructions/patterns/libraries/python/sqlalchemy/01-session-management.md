# SQLAlchemy 2.0 セッション管理

SQLAlchemy 2.0における非同期セッション管理とトランザクション制御の最重要パターン。

## 🚀 非同期リポジトリパターン

```python
# repository/base.py
from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.exc import SQLAlchemyError

T = TypeVar('T')

class AsyncRepository(Generic[T]):
    """非同期リポジトリ基底クラス - 全リポジトリはこれを継承"""
    
    def __init__(self, session: AsyncSession, model_class: Type[T]):
        self.session = session
        self.model_class = model_class
    
    async def get_by_id(self, id: int) -> Optional[T]:
        """IDによる取得"""
        result = await self.session.execute(
            select(self.model_class).where(self.model_class.id == id)
        )
        return result.scalar_one_or_none()
    
    async def create(self, entity: T) -> T:
        """エンティティ作成"""
        self.session.add(entity)
        await self.session.flush()  # IDを即座に取得
        await self.session.refresh(entity)  # リレーション更新
        return entity
    
    async def update(self, entity: T) -> T:
        """エンティティ更新"""
        await self.session.merge(entity)
        await self.session.flush()
        return entity
    
    async def delete(self, id: int) -> bool:
        """エンティティ削除"""
        result = await self.session.execute(
            delete(self.model_class).where(self.model_class.id == id)
        )
        return result.rowcount > 0
    
    async def get_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """ページネーション付き全取得"""
        result = await self.session.execute(
            select(self.model_class).offset(offset).limit(limit)
        )
        return result.scalars().all()
    
    # 他の基本メソッド: count(), exists(), bulk_create(), bulk_update()
```

## 🔐 トランザクション管理

```python
# services/transaction.py
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession

class TransactionManager:
    """トランザクション管理 - 複雑な操作を安全に実行"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    @asynccontextmanager
    async def transaction(self):
        """通常トランザクション"""
        async with self.db_manager.get_session() as session:
            try:
                await session.begin()
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise
    
    @asynccontextmanager
    async def read_only_session(self):
        """読み取り専用セッション - パフォーマンス最適化"""
        async with self.db_manager.get_session() as session:
            await session.execute(text("SET TRANSACTION READ ONLY"))
            yield session
    
    @asynccontextmanager
    async def nested_transaction(self, session: AsyncSession):
        """ネストトランザクション（セーブポイント）"""
        savepoint = await session.begin_nested()
        try:
            yield session
            await savepoint.commit()
        except Exception:
            await savepoint.rollback()
            raise

# 使用例: 資金移動トランザクション
async def transfer_funds(tm: TransactionManager, from_id, to_id, amount):
    async with tm.transaction() as session:
        account_repo = AccountRepository(session)
        
        # 複数操作を1トランザクションで実行
        from_account = await account_repo.get_by_id(from_id)
        to_account = await account_repo.get_by_id(to_id)
        
        if from_account.balance < amount:
            raise InsufficientFundsError()
        
        from_account.balance -= amount
        to_account.balance += amount
        
        await account_repo.update(from_account)
        await account_repo.update(to_account)
        # commitは自動実行
```

## ♻️ セッション再利用とバッチ処理

```python
# database/session_manager.py
class SessionManager:
    """高度なセッション管理"""
    
    @asynccontextmanager
    async def get_session(
        self,
        isolation_level: Optional[str] = None,  # "READ COMMITTED"等
        read_only: bool = False
    ):
        """設定可能なセッション取得"""
        async with self.db_manager.session_factory() as session:
            # 分離レベル設定
            if isolation_level:
                await session.execute(
                    text(f"SET TRANSACTION ISOLATION LEVEL {isolation_level}")
                )
            
            # 読み取り専用設定
            if read_only:
                await session.execute(text("SET TRANSACTION READ ONLY"))
            
            yield session
    
    @asynccontextmanager
    async def batch_session(self, batch_size: int = 1000):
        """バッチ処理用セッション - 大量データ処理に最適"""
        async with self.db_manager.session_factory() as session:
            # PostgreSQL最適化
            await session.execute(text("SET synchronous_commit = OFF"))
            yield session
            await session.execute(text("SET synchronous_commit = ON"))

# バッチ処理例
async with session_manager.batch_session() as session:
    user_repo = UserRepository(session)
    for i in range(10000):
        user = User(username=f"user_{i}")
        await user_repo.create(user)
        
        if i % 1000 == 0:  # 1000件ごとにコミット
            await session.commit()
```

## 🔄 エラーハンドリングと再試行

```python
# database/error_handling.py
from functools import wraps
from sqlalchemy.exc import DisconnectionError, OperationalError, IntegrityError
import asyncio

def retry_on_database_error(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0
):
    """データベースエラー時の自動再試行デコレータ"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                
                except (DisconnectionError, OperationalError) as e:
                    if attempt == max_retries:
                        raise
                    
                    wait_time = delay * (backoff_factor ** attempt)
                    await asyncio.sleep(wait_time)
                
                except IntegrityError:
                    # 整合性エラーは再試行しない
                    raise
            
        return wrapper
    return decorator

# 使用例
class UserService:
    @retry_on_database_error(max_retries=3)
    async def create_user(self, user_data: dict) -> User:
        """ユーザー作成（自動再試行付き）"""
        async with self.transaction_manager.transaction() as session:
            user_repo = UserRepository(session)
            user = User(**user_data)
            return await user_repo.create(user)
```

## 📊 接続プール監視

```python
class ConnectionPoolMonitor:
    """接続プール状態監視"""
    
    def get_pool_status(self) -> dict:
        pool = self.engine.pool
        return {
            'pool_size': pool.size(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'utilization': pool.checkedout() / pool.size() * 100
        }
    
    async def monitor_health(self):
        """プール健全性チェック"""
        status = self.get_pool_status()
        if status['utilization'] > 80:
            logger.warning(f"Pool utilization high: {status['utilization']}%")
```

## 💡 ベストプラクティス

### セッション管理の原則
- **スコープ最小化**: セッションは必要最小限の期間で保持
- **明示的なトランザクション**: 複数操作は明示的にトランザクション化
- **エラーハンドリング**: 必ずrollback処理を実装
- **バッチ処理**: 大量データは適切にバッチ化

### パフォーマンス最適化
- 読み取り専用セッションの活用
- 適切な分離レベルの選択
- 接続プールサイズの調整
- バルク操作の活用

### 典型的な実装パターン
```python
# サービス層での使用
class UserService:
    def __init__(self, transaction_manager: TransactionManager):
        self.tm = transaction_manager
    
    async def register_user_with_profile(self, user_data, profile_data):
        """複数エンティティの同時作成"""
        async with self.tm.transaction() as session:
            user_repo = UserRepository(session)
            profile_repo = ProfileRepository(session)
            
            user = await user_repo.create(User(**user_data))
            profile_data['user_id'] = user.id
            profile = await profile_repo.create(Profile(**profile_data))
            
            return user, profile  # 両方成功または両方失敗
```