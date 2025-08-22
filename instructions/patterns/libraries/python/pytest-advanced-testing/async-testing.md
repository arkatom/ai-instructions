## Async Testing Patterns

### 1. 高度な非同期テスト

```python
import pytest
import asyncio
import aiohttp
import asyncpg
from typing import AsyncGenerator, List, Dict, Any
import time
from unittest.mock import AsyncMock, patch
import logging

# 非同期フィクスチャ
@pytest.fixture(scope="session")
def event_loop():
    """セッション全体で共有されるイベントループ"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def async_database():
    """非同期データベース接続"""
    connection = await asyncpg.connect(
        "postgresql://testuser:testpass@localhost/testdb"
    )
    
    # テーブルの初期化
    await connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    yield connection
    
    # クリーンアップ
    await connection.execute("DROP TABLE IF EXISTS users")
    await connection.close()

@pytest.fixture
async def async_http_client():
    """非同期HTTPクライアント"""
    async with aiohttp.ClientSession() as session:
        yield session

@pytest.fixture
async def async_test_data(async_database):
    """非同期テストデータ作成"""
    users = []
    
    for i in range(5):
        user_id = await async_database.fetchval(
            "INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id",
            f"user{i}",
            f"user{i}@example.com"
        )
        users.append(user_id)
    
    yield users
    
    # クリーンアップ
    for user_id in users:
        await async_database.execute("DELETE FROM users WHERE id = $1", user_id)

# 非同期テストケース
@pytest.mark.asyncio
async def test_async_database_operations(async_database):
    """非同期データベース操作のテスト"""
    # ユーザーの作成
    user_id = await async_database.fetchval(
        "INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id",
        "asyncuser",
        "async@example.com"
    )
    
    assert user_id is not None
    
    # ユーザーの取得
    user = await async_database.fetchrow(
        "SELECT * FROM users WHERE id = $1", user_id
    )
    
    assert user["username"] == "asyncuser"
    assert user["email"] == "async@example.com"
    
    # ユーザーの更新
    await async_database.execute(
        "UPDATE users SET email = $1 WHERE id = $2",
        "updated@example.com",
        user_id
    )
    
    updated_user = await async_database.fetchrow(
        "SELECT * FROM users WHERE id = $1", user_id
    )
    
    assert updated_user["email"] == "updated@example.com"
    
    # ユーザーの削除
    deleted_count = await async_database.execute(
        "DELETE FROM users WHERE id = $1", user_id
    )
    
    assert "DELETE 1" in deleted_count

@pytest.mark.asyncio
async def test_async_http_requests(async_http_client):
    """非同期HTTPリクエストのテスト"""
    # 複数の並行リクエスト
    urls = [
        "https://httpbin.org/json",
        "https://httpbin.org/user-agent",
        "https://httpbin.org/headers"
    ]
    
    tasks = []
    for url in urls:
        task = asyncio.create_task(async_http_client.get(url))
        tasks.append(task)
    
    responses = await asyncio.gather(*tasks)
    
    # レスポンスの検証
    assert len(responses) == len(urls)
    for response in responses:
        assert response.status == 200

# 非同期コンテキストマネージャーのテスト
class AsyncResourceManager:
    """非同期リソース管理クラス"""
    
    def __init__(self, resource_name: str):
        self.resource_name = resource_name
        self.is_acquired = False
    
    async def __aenter__(self):
        await asyncio.sleep(0.1)  # リソース取得をシミュレート
        self.is_acquired = True
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await asyncio.sleep(0.1)  # リソース解放をシミュレート
        self.is_acquired = False

@pytest.mark.asyncio
async def test_async_context_manager():
    """非同期コンテキストマネージャーのテスト"""
    manager = AsyncResourceManager("test_resource")
    
    assert not manager.is_acquired
    
    async with manager:
        assert manager.is_acquired
    
    assert not manager.is_acquired

# 非同期ジェネレータのテスト
async def async_number_generator(start: int, end: int) -> AsyncGenerator[int, None]:
    """非同期数値ジェネレータ"""
    for i in range(start, end):
        await asyncio.sleep(0.01)  # 非同期処理をシミュレート
        yield i

@pytest.mark.asyncio
async def test_async_generator():
    """非同期ジェネレータのテスト"""
    numbers = []
    
    async for number in async_number_generator(1, 6):
        numbers.append(number)
    
    assert numbers == [1, 2, 3, 4, 5]

# 非同期例外処理のテスト
async def async_function_with_exception():
    """例外を発生させる非同期関数"""
    await asyncio.sleep(0.1)
    raise ValueError("Async error occurred")

@pytest.mark.asyncio
async def test_async_exception_handling():
    """非同期例外処理のテスト"""
    with pytest.raises(ValueError, match="Async error occurred"):
        await async_function_with_exception()

# タイムアウトテスト
@pytest.mark.asyncio
@pytest.mark.timeout(2)
async def test_async_timeout():
    """非同期タイムアウトのテスト"""
    # 1秒で完了する処理（タイムアウト内）
    await asyncio.sleep(1)
    assert True

@pytest.mark.asyncio
async def test_async_operation_timeout():
    """非同期操作のタイムアウトテスト"""
    async def slow_operation():
        await asyncio.sleep(5)  # 5秒の処理
        return "completed"
    
    # 2秒でタイムアウト
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(slow_operation(), timeout=2.0)

# 非同期モックのテスト
@pytest.mark.asyncio
async def test_async_mock():
    """非同期モックのテスト"""
    # AsyncMock の使用
    mock_service = AsyncMock()
    mock_service.get_data.return_value = {"result": "mocked_data"}
    
    result = await mock_service.get_data("test_param")
    
    assert result == {"result": "mocked_data"}
    mock_service.get_data.assert_awaited_once_with("test_param")

# 非同期パフォーマンステスト
@pytest.mark.asyncio
async def test_async_performance():
    """非同期パフォーマンステスト"""
    async def cpu_bound_task(n: int) -> int:
        """CPU集約的なタスク"""
        await asyncio.sleep(0)  # 他のタスクに制御を譲る
        return sum(i**2 for i in range(n))
    
    # 並行実行
    start_time = time.time()
    
    tasks = [cpu_bound_task(1000) for _ in range(10)]
    results = await asyncio.gather(*tasks)
    
    execution_time = time.time() - start_time
    
    assert len(results) == 10
    assert all(isinstance(result, int) for result in results)
    assert execution_time < 1.0  # 1秒以内で完了することを期待

# 非同期エラー集約テスト
@pytest.mark.asyncio
async def test_async_error_aggregation():
    """非同期エラー集約のテスト"""
    async def failing_task(task_id: int):
        await asyncio.sleep(0.1)
        if task_id % 2 == 0:
            raise ValueError(f"Task {task_id} failed")
        return f"Task {task_id} succeeded"
    
    tasks = [failing_task(i) for i in range(5)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 結果の分析
    successes = [r for r in results if isinstance(r, str)]
    failures = [r for r in results if isinstance(r, Exception)]
    
    assert len(successes) == 3  # 奇数のタスクが成功
    assert len(failures) == 2   # 偶数のタスクが失敗
    
    for failure in failures:
        assert isinstance(failure, ValueError)
```

### 2. 非同期統合テスト

```python
import pytest
import asyncio
import aioredis
from unittest.mock import AsyncMock, patch
import json
from typing import Dict, Any

class AsyncTestService:
    """非同期テストサービス"""
    
    def __init__(self, db_pool, redis_client, http_client):
        self.db_pool = db_pool
        self.redis_client = redis_client
        self.http_client = http_client
    
    async def create_user_with_cache(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """キャッシュ付きユーザー作成"""
        # データベースにユーザーを作成
        async with self.db_pool.acquire() as connection:
            user_id = await connection.fetchval(
                "INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id",
                user_data["username"],
                user_data["email"]
            )
        
        # キャッシュに保存
        cache_key = f"user:{user_id}"
        user_data["id"] = user_id
        await self.redis_client.setex(
            cache_key, 
            3600,  # 1時間
            json.dumps(user_data)
        )
        
        # 外部APIに通知
        await self.http_client.post(
            "https://api.example.com/notifications",
            json={"event": "user_created", "user_id": user_id}
        )
        
        return user_data
    
    async def get_user_with_cache(self, user_id: int) -> Dict[str, Any]:
        """キャッシュ付きユーザー取得"""
        cache_key = f"user:{user_id}"
        
        # キャッシュから取得試行
        cached_data = await self.redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # データベースから取得
        async with self.db_pool.acquire() as connection:
            user = await connection.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )
        
        if user:
            user_data = dict(user)
            # キャッシュに保存
            await self.redis_client.setex(
                cache_key,
                3600,
                json.dumps(user_data)
            )
            return user_data
        
        return None

@pytest.fixture
async def async_service_dependencies():
    """非同期サービス依存関係"""
    # データベースプールのモック
    db_pool = AsyncMock()
    
    # Redisクライアントのモック
    redis_client = AsyncMock()
    
    # HTTPクライアントのモック
    http_client = AsyncMock()
    
    return {
        "db_pool": db_pool,
        "redis_client": redis_client,
        "http_client": http_client
    }

@pytest.fixture
async def async_test_service(async_service_dependencies):
    """非同期テストサービス"""
    return AsyncTestService(**async_service_dependencies)

@pytest.mark.asyncio
async def test_async_service_user_creation(async_test_service, async_service_dependencies):
    """非同期サービスのユーザー作成テスト"""
    # モックの設定
    mock_connection = AsyncMock()
    mock_connection.fetchval.return_value = 123
    async_service_dependencies["db_pool"].acquire.return_value.__aenter__.return_value = mock_connection
    
    user_data = {
        "username": "testuser",
        "email": "test@example.com"
    }
    
    # サービスメソッドの実行
    result = await async_test_service.create_user_with_cache(user_data)
    
    # アサーション
    assert result["id"] == 123
    assert result["username"] == "testuser"
    assert result["email"] == "test@example.com"
    
    # モックの呼び出し確認
    mock_connection.fetchval.assert_awaited_once()
    async_service_dependencies["redis_client"].setex.assert_awaited_once()
    async_service_dependencies["http_client"].post.assert_awaited_once()

@pytest.mark.asyncio
async def test_async_service_cache_hit(async_test_service, async_service_dependencies):
    """キャッシュヒット時のテスト"""
    # キャッシュデータの設定
    cached_user = {
        "id": 123,
        "username": "cacheduser",
        "email": "cached@example.com"
    }
    async_service_dependencies["redis_client"].get.return_value = json.dumps(cached_user)
    
    # サービスメソッドの実行
    result = await async_test_service.get_user_with_cache(123)
    
    # アサーション
    assert result == cached_user
    
    # データベースアクセスがないことを確認
    async_service_dependencies["db_pool"].acquire.assert_not_awaited()

@pytest.mark.asyncio
async def test_async_service_cache_miss(async_test_service, async_service_dependencies):
    """キャッシュミス時のテスト"""
    # キャッシュミスの設定
    async_service_dependencies["redis_client"].get.return_value = None
    
    # データベースデータの設定
    db_user = {
        "id": 123,
        "username": "dbuser",
        "email": "db@example.com"
    }
    mock_connection = AsyncMock()
    mock_connection.fetchrow.return_value = db_user
    async_service_dependencies["db_pool"].acquire.return_value.__aenter__.return_value = mock_connection
    
    # サービスメソッドの実行
    result = await async_test_service.get_user_with_cache(123)
    
    # アサーション
    assert result == db_user
    
    # データベースアクセスとキャッシュ保存の確認
    mock_connection.fetchrow.assert_awaited_once()
    async_service_dependencies["redis_client"].setex.assert_awaited_once()

# 非同期統合テスト（実際のサービスを使用）
@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_async_service_integration():
    """実際のサービスを使用した統合テスト"""
    # 実際のRedis接続
    redis_client = await aioredis.from_url("redis://localhost")
    
    # 実際のHTTPクライアント
    async with aiohttp.ClientSession() as http_client:
        # テストキーの設定
        test_key = "integration_test"
        test_value = {"message": "integration test data"}
        
        # Redis書き込み・読み込みテスト
        await redis_client.setex(test_key, 60, json.dumps(test_value))
        
        cached_data = await redis_client.get(test_key)
        retrieved_value = json.loads(cached_data)
        
        assert retrieved_value == test_value
        
        # HTTPリクエストテスト
        async with http_client.get("https://httpbin.org/json") as response:
            assert response.status == 200
            data = await response.json()
            assert "slideshow" in data
        
        # クリーンアップ
        await redis_client.delete(test_key)
    
    await redis_client.close()

# 複数の非同期操作の並行テスト
@pytest.mark.asyncio
async def test_concurrent_async_operations():
    """並行非同期操作のテスト"""
    async def async_operation(operation_id: int, delay: float) -> Dict[str, Any]:
        """非同期操作のシミュレーション"""
        await asyncio.sleep(delay)
        return {
            "operation_id": operation_id,
            "completed_at": time.time(),
            "delay": delay
        }
    
    # 複数の操作を並行実行
    operations = [
        async_operation(i, 0.1 * i) for i in range(1, 6)
    ]
    
    start_time = time.time()
    results = await asyncio.gather(*operations)
    total_time = time.time() - start_time
    
    # 並行実行により総時間が短縮されることを確認
    assert total_time < 1.5  # 逐次実行なら1.5秒かかる
    assert len(results) == 5
    
    # 結果の順序が保持されることを確認
    for i, result in enumerate(results, 1):
        assert result["operation_id"] == i

# エラー処理とリトライのテスト
@pytest.mark.asyncio
async def test_async_retry_mechanism():
    """非同期リトライメカニズムのテスト"""
    call_count = 0
    
    async def unreliable_async_function():
        nonlocal call_count
        call_count += 1
        
        if call_count < 3:
            raise ConnectionError("Temporary failure")
        
        return "Success after retries"
    
    async def retry_async_function(func, max_retries=3, delay=0.1):
        """非同期リトライ関数"""
        for attempt in range(max_retries):
            try:
                return await func()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                await asyncio.sleep(delay)
    
    # リトライメカニズムのテスト
    result = await retry_async_function(unreliable_async_function)
    
    assert result == "Success after retries"
    assert call_count == 3
```

