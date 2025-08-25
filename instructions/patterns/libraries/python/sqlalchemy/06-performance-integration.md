# SQLAlchemy 2.0 パフォーマンステストと統合テスト

負荷テスト、統合テスト、CI/CD統合の実装パターン。

## 📊 パフォーマンステスト

### 負荷テストと最適化検証

```python
# tests/test_performance.py
import pytest
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from repositories.user_repository import UserRepository


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
    
    async def test_concurrent_access(self, test_engine):
        """同時アクセステスト"""
        
        async def create_user_session():
            session_factory = async_sessionmaker(bind=test_engine, class_=AsyncSession)
            async with session_factory() as session:
                user = User(
                    username=f"concurrent_user_{time.time()}",
                    email=f"concurrent{time.time()}@example.com",
                    hashed_password="hashed",
                    first_name="Concurrent",
                    last_name="User"
                )
                session.add(user)
                await session.commit()
                return user.id
        
        # 50個の同時セッション
        tasks = [create_user_session() for _ in range(50)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # 例外が発生していないことを確認
        exceptions = [r for r in results if isinstance(r, Exception)]
        assert len(exceptions) == 0
        
        # 実行時間確認（5秒以内）
        assert end_time - start_time < 5.0
        
        # 全てのユーザーが作成されたことを確認
        assert len(results) == 50
        assert all(isinstance(r, int) for r in results)
    
    @pytest.mark.slow
    async def test_memory_usage_large_dataset(self, db_session):
        """大規模データセットでのメモリ使用量テスト"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # 大量データ処理
        repo = UserRepository(db_session)
        
        # 10000件のユーザーを100件ずつ処理
        total_processed = 0
        for offset in range(0, 10000, 100):
            users, _ = await repo.search_users_advanced(
                limit=100,
                offset=offset
            )
            total_processed += len(users)
            
            # メモリ使用量チェック
            current_memory = process.memory_info().rss / 1024 / 1024
            memory_increase = current_memory - initial_memory
            
            # 100MB以上のメモリ増加がないことを確認
            assert memory_increase < 100
        
        final_memory = process.memory_info().rss / 1024 / 1024
        total_increase = final_memory - initial_memory
        
        # 総メモリ増加が200MB以下であることを確認
        assert total_increase < 200
```

## 🔄 統合テスト

```python
# tests/test_integration.py
from tests.factories import AsyncFactoryManager
from repositories.user_repository import UserRepository
from sqlalchemy import text


@pytest.mark.asyncio
class TestIntegration:
    """統合テスト"""
    
    async def test_user_post_comment_flow(self, db_session):
        """ユーザー-投稿-コメントの一連のフロー"""
        factory = AsyncFactoryManager(db_session)
        
        # 1. ユーザー作成
        user = await factory.create_user()
        assert user.id is not None
        
        # 2. 投稿作成
        post = await factory.create_post(author=user)
        assert post.id is not None
        assert post.author_id == user.id
        
        # 3. コメント作成
        comment = await factory.create_comment(post=post, author=user)
        assert comment.id is not None
        assert comment.post_id == post.id
        assert comment.author_id == user.id
        
        # 4. データ整合性確認
        repo = UserRepository(db_session)
        retrieved_user = await repo.get_by_id_with_posts(user.id)
        
        assert len(retrieved_user.posts) == 1
        assert retrieved_user.posts[0].id == post.id
    
    async def test_soft_delete_cascade(self, db_session):
        """論理削除のカスケードテスト"""
        factory = AsyncFactoryManager(db_session)
        
        # テストデータ作成
        user, posts = await factory.create_user_with_posts(post_count=2)
        comments = []
        for post in posts:
            comment = await factory.create_comment(post=post, author=user)
            comments.append(comment)
        
        # ユーザーの論理削除
        await db_session.execute(
            text("UPDATE users SET is_deleted = true WHERE id = :user_id"),
            {"user_id": user.id}
        )
        
        # 削除確認
        result = await db_session.execute(
            text("SELECT is_deleted FROM users WHERE id = :user_id"),
            {"user_id": user.id}
        )
        assert result.scalar() is True
```

## 🔧 テスト設定とCI/CD統合

### GitHub Actions設定例

```yaml
# .github/workflows/tests.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r requirements-test.txt
    
    - name: Run unit tests
      run: |
        pytest tests/unit -v --cov=src --cov-report=xml
    
    - name: Run integration tests
      env:
        DATABASE_URL: postgresql+asyncpg://postgres:test@localhost:5432/testdb
        REDIS_URL: redis://localhost:6379
      run: |
        pytest tests/integration -v
    
    - name: Run performance tests
      run: |
        pytest tests/performance -v -m "not slow"
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

### pytest.ini設定

```ini
[tool:pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    performance: marks tests as performance tests
addopts = 
    -v 
    --tb=short
    --strict-markers
    --disable-warnings
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
```

## 📋 テストベストプラクティス

```python
# tests/utils/assertions.py
def assert_user_equals(actual_user, expected_user):
    """ユーザーオブジェクト比較アサーション"""
    assert actual_user.id == expected_user.id
    assert actual_user.username == expected_user.username
    assert actual_user.email == expected_user.email
    assert actual_user.role == expected_user.role


def assert_query_performance(execution_time, max_time=0.1):
    """クエリパフォーマンスアサーション"""
    assert execution_time < max_time, f"Query took {execution_time:.3f}s, expected < {max_time}s"


# tests/markers.py - カスタムマーカー
import pytest

slow = pytest.mark.slow
integration = pytest.mark.integration
unit = pytest.mark.unit
performance = pytest.mark.performance
```