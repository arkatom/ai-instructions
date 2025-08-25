# SQLAlchemy 2.0 Performance Testing & Integration

Essential patterns for performance testing, monitoring, and CI/CD integration.

## 📊 Performance Testing

### Core Performance Test Patterns

```python
# tests/test_performance.py
import pytest
import time
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
class TestPerformance:
    
    async def test_bulk_insert_performance(self, db_session):
        """Bulk insert performance - <1s for 1000 records"""
        
        users_data = [
            {"username": f"user{i}", "email": f"user{i}@example.com", "hashed_password": "hash"}
            for i in range(1000)
        ]
        
        start_time = time.time()
        await db_session.execute(
            text("INSERT INTO users (username, email, hashed_password, created_at) VALUES (:username, :email, :hashed_password, NOW())"),
            users_data
        )
        await db_session.commit()
        
        execution_time = time.time() - start_time
        assert execution_time < 1.0, f"Bulk insert took {execution_time:.3f}s"
        
        count = await db_session.scalar(text("SELECT COUNT(*) FROM users WHERE username LIKE 'user%'"))
        assert count == 1000
    
    async def test_complex_query_performance(self, db_session):
        """Complex query performance - <100ms"""
        
        start_time = time.time()
        # Your complex query here
        result = await db_session.execute(
            text("SELECT u.*, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON u.id = p.author_id GROUP BY u.id LIMIT 100")
        )
        execution_time = time.time() - start_time
        
        assert execution_time < 0.1, f"Query took {execution_time:.3f}s"
        assert len(result.fetchall()) > 0
    
    async def test_concurrent_access(self, test_engine):
        """50 concurrent operations test"""
        
        async def create_user_task():
            async with AsyncSession(test_engine) as session:
                user = User(username=f"concurrent_{time.time()}", email=f"test{time.time()}@example.com", hashed_password="hash")
                session.add(user)
                await session.commit()
                return user.id
        
        tasks = [create_user_task() for _ in range(50)]
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        execution_time = time.time() - start_time
        
        exceptions = [r for r in results if isinstance(r, Exception)]
        assert len(exceptions) == 0
        assert execution_time < 5.0
        assert len(results) == 50
    
    @pytest.mark.slow
    async def test_memory_usage(self, db_session):
        """Memory usage monitoring for large datasets"""
        import psutil, os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Process in chunks to test memory efficiency
        for offset in range(0, 10000, 100):
            result = await db_session.execute(
                text("SELECT * FROM users LIMIT 100 OFFSET :offset"),
                {"offset": offset}
            )
            users = result.fetchall()
            
            current_memory = process.memory_info().rss / 1024 / 1024
            memory_increase = current_memory - initial_memory
            assert memory_increase < 100, f"Memory increased by {memory_increase:.1f}MB"
```

## 🔄 Integration Testing

```python
# tests/test_integration.py
from tests.factories import AsyncFactoryManager

@pytest.mark.asyncio  
class TestIntegration:
    
    async def test_user_post_comment_flow(self, db_session):
        """End-to-end data flow validation"""
        factory = AsyncFactoryManager(db_session)
        
        # Create user -> post -> comment chain
        user = await factory.create_user()
        post = await factory.create_post(author=user)
        comment = await factory.create_comment(post=post, author=user)
        
        # Verify relationships
        assert post.author_id == user.id
        assert comment.post_id == post.id
        assert comment.author_id == user.id
    
    async def test_soft_delete_cascade(self, db_session):
        """Soft delete cascade validation"""
        factory = AsyncFactoryManager(db_session)
        
        user, posts = await factory.create_user_with_posts(post_count=2)
        
        # Soft delete user
        await db_session.execute(
            text("UPDATE users SET is_deleted = true WHERE id = :user_id"),
            {"user_id": user.id}
        )
        await db_session.commit()
        
        # Verify soft delete
        user_deleted = await db_session.scalar(
            text("SELECT is_deleted FROM users WHERE id = :user_id"),
            {"user_id": user.id}
        )
        assert user_deleted is True
    
    async def test_transaction_rollback(self, db_session):
        """Transaction rollback behavior"""
        initial_count = await db_session.scalar(text("SELECT COUNT(*) FROM users"))
        
        try:
            async with db_session.begin():
                user = User(username="test", email="test@example.com", hashed_password="hash")
                db_session.add(user)
                await db_session.flush()
                # Force duplicate key error
                await db_session.execute(text("INSERT INTO users (id) VALUES (:id)"), {"id": user.id})
        except Exception:
            pass  # Expected to fail
        
        final_count = await db_session.scalar(text("SELECT COUNT(*) FROM users"))
        assert final_count == initial_count
```

## 🔧 CI/CD Configuration

### GitHub Actions Setup

```yaml
# .github/workflows/tests.yml
name: Database Tests

on: [push, pull_request]

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
    
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: pip install -r requirements-test.txt
    
    - name: Run migrations  
      env:
        DATABASE_URL: postgresql+asyncpg://postgres:test@localhost:5432/testdb
      run: alembic upgrade head
    
    - name: Run tests
      env:
        DATABASE_URL: postgresql+asyncpg://postgres:test@localhost:5432/testdb
      run: |
        pytest tests/unit -v --cov=src
        pytest tests/integration -v
        pytest tests/performance -v -m "not slow"
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Test Configuration

```ini
# pytest.ini
[tool:pytest]
asyncio_mode = auto
testpaths = tests
markers =
    slow: slow tests (use -m "not slow" to skip)
    integration: integration tests
    performance: performance tests
addopts = -v --tb=short --strict-markers
filterwarnings = ignore::DeprecationWarning
```

## 📋 Monitoring & Health

### Query Performance Tracking

```python
# monitoring/query_monitor.py
import time
from sqlalchemy import event

class QueryMonitor:
    def __init__(self, slow_threshold: float = 0.1):
        self.slow_threshold = slow_threshold
        
    def setup_listeners(self, engine):
        @event.listens_for(engine, "before_cursor_execute")
        def before_execute(conn, cursor, statement, parameters, context, executemany):
            context._query_start_time = time.time()
            
        @event.listens_for(engine, "after_cursor_execute")  
        def after_execute(conn, cursor, statement, parameters, context, executemany):
            total = time.time() - context._query_start_time
            if total > self.slow_threshold:
                print(f"Slow query ({total:.3f}s): {statement[:100]}...")

# Usage: monitor = QueryMonitor(); monitor.setup_listeners(engine)
```

### Database Health Checks

```python
from sqlalchemy import text

class DatabaseHealthCheck:
    async def check_connection(self, session) -> bool:
        try:
            await session.execute(text("SELECT 1"))
            return True
        except Exception:
            return False
    
    async def check_table_counts(self, session) -> dict:
        tables = ['users', 'posts', 'comments']
        counts = {}
        for table in tables:
            try:
                counts[table] = await session.scalar(text(f"SELECT COUNT(*) FROM {table}"))
            except Exception as e:
                counts[table] = f"Error: {str(e)}"
        return counts

```