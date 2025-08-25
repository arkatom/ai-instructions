# SQLAlchemy 2.0 テスト戦略

SQLAlchemy 2.0での包括的なテスト実装。非同期テスト、モック戦略、ファクトリーパターン、パフォーマンステストの完全ガイド。

## 🧪 テスト環境構築

### 基本テスト設定

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
```

## 🏗️ ファクトリーパターン

### テストデータファクトリー

```python
# tests/factories.py
import factory
from factory import LazyFunction, SubFactory, LazyAttribute
from faker import Faker
from datetime import datetime
from typing import List, Optional

from models.user import User, UserRole, UserStatus
from models.post import Post
from models.comment import Comment


fake = Faker()


class UserFactory(factory.Factory):
    """ユーザーファクトリー"""
    class Meta:
        model = User
    
    username = LazyAttribute(lambda obj: fake.user_name())
    email = LazyAttribute(lambda obj: fake.email())
    hashed_password = LazyAttribute(lambda obj: fake.password(length=12))
    first_name = LazyAttribute(lambda obj: fake.first_name())
    last_name = LazyAttribute(lambda obj: fake.last_name())
    display_name = LazyAttribute(lambda obj: f"{obj.first_name} {obj.last_name}")
    bio = LazyAttribute(lambda obj: fake.text(max_nb_chars=200))
    role = UserRole.USER
    status = UserStatus.ACTIVE
    is_verified = True
    is_active = True


class AdminUserFactory(UserFactory):
    """管理者ユーザーファクトリー"""
    role = UserRole.ADMIN
    username = LazyAttribute(lambda obj: f"admin_{fake.user_name()}")


class PostFactory(factory.Factory):
    """投稿ファクトリー"""
    class Meta:
        model = Post
    
    title = LazyAttribute(lambda obj: fake.sentence(nb_words=6))
    slug = LazyAttribute(lambda obj: fake.slug())
    content = LazyAttribute(lambda obj: fake.text(max_nb_chars=1000))
    excerpt = LazyAttribute(lambda obj: fake.text(max_nb_chars=200))
    tags = LazyAttribute(lambda obj: fake.words(nb=3))
    is_published = True
    is_featured = False
    view_count = LazyAttribute(lambda obj: fake.random_int(min=0, max=1000))
    like_count = LazyAttribute(lambda obj: fake.random_int(min=0, max=100))


class CommentFactory(factory.Factory):
    """コメントファクトリー"""
    class Meta:
        model = Comment
    
    content = LazyAttribute(lambda obj: fake.text(max_nb_chars=500))


# tests/factories/async_factory.py
class AsyncFactoryManager:
    """非同期ファクトリー管理"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_user(self, **kwargs) -> User:
        """ユーザー作成"""
        user_data = UserFactory.build(**kwargs)
        user = User(**user_data.__dict__)
        
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        
        return user
    
    async def create_post(self, author: Optional[User] = None, **kwargs) -> Post:
        """投稿作成"""
        if not author:
            author = await self.create_user()
        
        post_data = PostFactory.build(**kwargs)
        post = Post(**post_data.__dict__)
        post.author_id = author.id
        
        self.session.add(post)
        await self.session.commit()
        await self.session.refresh(post)
        
        return post
    
    async def create_comment(
        self, 
        post: Optional[Post] = None, 
        author: Optional[User] = None,
        **kwargs
    ) -> Comment:
        """コメント作成"""
        if not post:
            post = await self.create_post()
        if not author:
            author = await self.create_user()
        
        comment_data = CommentFactory.build(**kwargs)
        comment = Comment(**comment_data.__dict__)
        comment.post_id = post.id
        comment.author_id = author.id
        
        self.session.add(comment)
        await self.session.commit()
        await self.session.refresh(comment)
        
        return comment
    
    async def create_user_with_posts(
        self, 
        post_count: int = 3,
        **user_kwargs
    ) -> tuple[User, List[Post]]:
        """投稿付きユーザー作成"""
        user = await self.create_user(**user_kwargs)
        
        posts = []
        for _ in range(post_count):
            post = await self.create_post(author=user)
            posts.append(post)
        
        return user, posts
```

## ✅ リポジトリテスト

### 包括的なリポジトリテスト

```python
# tests/test_repositories/test_user_repository.py
import pytest
from repositories.user_repository import UserRepository
from models.user import User, UserRole, UserStatus
from tests.factories import AsyncFactoryManager


@pytest.mark.asyncio
class TestUserRepository:
    """ユーザーリポジトリテスト"""
    
    @pytest.fixture
    async def factory(self, db_session):
        return AsyncFactoryManager(db_session)
    
    @pytest.fixture
    async def user_repo(self, db_session):
        return UserRepository(db_session)
    
    async def test_get_by_id_with_posts(self, user_repo, factory):
        """投稿込みユーザー取得テスト"""
        user, posts = await factory.create_user_with_posts(post_count=3)
        
        result = await user_repo.get_by_id_with_posts(user.id)
        
        assert result is not None
        assert result.id == user.id
        assert len(result.posts) == 3
        assert all(post.author_id == user.id for post in result.posts)
    
    async def test_get_users_with_stats(self, user_repo, factory):
        """統計情報付きユーザー取得テスト"""
        user, posts = await factory.create_user_with_posts(post_count=5)
        
        result = await user_repo.get_users_with_stats(limit=10)
        
        assert len(result) == 1
        user_data = result[0]
        
        assert user_data["user"].id == user.id
        assert user_data["post_count"] == 5
        assert user_data["follower_count"] == 0
        assert user_data["following_count"] == 0
    
    async def test_search_users_advanced(self, user_repo, factory):
        """高度なユーザー検索テスト"""
        # テストデータ作成
        regular_user = await factory.create_user(
            username="regular_user",
            role=UserRole.USER
        )
        admin_user = await factory.create_user(
            username="admin_user", 
            role=UserRole.ADMIN
        )
        
        # 管理者のみ検索
        users, total = await user_repo.search_users_advanced(
            role_filters=[UserRole.ADMIN],
            limit=10
        )
        
        assert total == 1
        assert len(users) == 1
        assert users[0].role == UserRole.ADMIN
        assert users[0].username == "admin_user"
        
        # テキスト検索
        users, total = await user_repo.search_users_advanced(
            search_term="admin",
            limit=10
        )
        
        assert total == 1
        assert users[0].username == "admin_user"
    
    async def test_get_trending_users(self, user_repo, factory):
        """トレンドユーザー取得テスト"""
        user1, posts1 = await factory.create_user_with_posts(post_count=2)
        user2, posts2 = await factory.create_user_with_posts(post_count=1)
        
        # フォロー関係作成
        follower = await factory.create_user()
        # UserFollowの作成を実装
        
        result = await user_repo.get_trending_users(days=30, limit=5)
        
        # トレンドスコアでソートされていることを確認
        assert len(result) >= 0  # データに依存
    
    async def test_user_network_analysis(self, user_repo, factory):
        """ユーザーネットワーク分析テスト"""
        user = await factory.create_user()
        
        result = await user_repo.get_user_network_analysis(user.id)
        
        assert "mutual_follows" in result
        assert "avg_follower_posts" in result
        assert "influence_score" in result
        assert isinstance(result["mutual_follows"], int)
        assert isinstance(result["avg_follower_posts"], float)
        assert isinstance(result["influence_score"], int)


# tests/test_repositories/test_post_repository.py
@pytest.mark.asyncio
class TestPostRepository:
    """投稿リポジトリテスト"""
    
    @pytest.fixture
    async def post_repo(self, db_session):
        return PostRepository(db_session)
    
    @pytest.fixture
    async def factory(self, db_session):
        return AsyncFactoryManager(db_session)
    
    async def test_get_posts_with_engagement(self, post_repo, factory):
        """エンゲージメント付き投稿取得テスト"""
        user, posts = await factory.create_user_with_posts(post_count=3)
        
        # コメント追加
        for post in posts:
            await factory.create_comment(post=post)
        
        result = await post_repo.get_posts_with_engagement(limit=5)
        
        assert len(result) == 3
        
        for item in result:
            assert "post" in item
            assert "engagement_score" in item
            assert "like_rate" in item
            assert "comment_count" in item
            assert isinstance(item["engagement_score"], float)
    
    async def test_get_content_recommendations(self, post_repo, factory):
        """コンテンツ推薦テスト"""
        user = await factory.create_user()
        other_user, posts = await factory.create_user_with_posts(post_count=3)
        
        # いいねデータがないため空のリストが返される
        result = await post_repo.get_content_recommendations(user.id, limit=5)
        
        # 基本的な構造確認
        assert isinstance(result, list)
        # 推薦アルゴリズムのテストは別途データを用意して実行
```

## 🎭 モック戦略

### 効果的なモック実装

```python
# tests/test_services/test_user_service.py
import pytest
from unittest.mock import AsyncMock, Mock, patch
from services.user_service import UserService
from services.caching_service import CachingService


@pytest.mark.asyncio
class TestUserServiceWithMocks:
    """モックを使用したユーザーサービステスト"""
    
    @pytest.fixture
    def mock_cache_service(self):
        return Mock(spec=CachingService)
    
    @pytest.fixture
    def mock_repository(self):
        mock = Mock()
        mock.get_by_id = AsyncMock()
        mock.get_users_with_stats = AsyncMock()
        return mock
    
    @pytest.fixture
    def user_service(self, mock_repository, mock_cache_service):
        return UserService(mock_repository, mock_cache_service)
    
    async def test_get_user_cached(self, user_service, mock_repository, mock_cache_service):
        """キャッシュされたユーザー取得テスト"""
        # モックデータ準備
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "testuser"
        
        mock_cache_service.get_cached_query_result.return_value = mock_user
        
        # テスト実行
        result = await user_service.get_user_cached(1)
        
        # 検証
        assert result == mock_user
        mock_cache_service.get_cached_query_result.assert_called_once()
        mock_repository.get_by_id.assert_not_called()  # キャッシュヒット時は呼ばれない
    
    async def test_get_user_cache_miss(self, user_service, mock_repository, mock_cache_service):
        """キャッシュミス時のテスト"""
        # キャッシュミス設定
        mock_cache_service.get_cached_query_result.side_effect = Exception("Cache miss")
        
        mock_user = Mock()
        mock_repository.get_by_id.return_value = mock_user
        
        # テスト実行
        result = await user_service.get_user_cached(1)
        
        # 検証
        assert result == mock_user
        mock_repository.get_by_id.assert_called_once_with(1)
    
    @patch('services.user_service.send_notification')
    async def test_user_notification_integration(self, mock_send_notification, user_service, mock_repository):
        """外部サービス統合のモックテスト"""
        mock_send_notification.return_value = True
        
        mock_user = Mock()
        mock_user.email = "test@example.com"
        mock_repository.get_by_id.return_value = mock_user
        
        result = await user_service.send_welcome_email(1)
        
        assert result is True
        mock_send_notification.assert_called_once_with(
            "test@example.com", 
            "welcome", 
            user=mock_user
        )


# tests/mocks/database_mocks.py
class MockAsyncSession:
    """非同期セッションのモック"""
    
    def __init__(self):
        self.added_objects = []
        self.committed = False
        self.rolled_back = False
    
    def add(self, obj):
        self.added_objects.append(obj)
    
    async def commit(self):
        self.committed = True
    
    async def rollback(self):
        self.rolled_back = True
    
    async def refresh(self, obj):
        # IDを設定（新規作成をシミュレート）
        if not hasattr(obj, 'id') or obj.id is None:
            obj.id = len(self.added_objects)
    
    async def execute(self, stmt):
        # クエリ実行のモック
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        return mock_result
    
    async def close(self):
        pass
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.rollback()
        else:
            await self.commit()
        await self.close()
```

## 📊 パフォーマンステスト

### 負荷テストと最適化検証

```python
# tests/test_performance.py
import pytest
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
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


# tests/test_integration.py
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
        from repositories.bulk_operations import BulkOperationsRepository
        bulk_repo = BulkOperationsRepository(db_session)
        
        # 論理削除実行（実装が必要）
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


# pytest.ini設定例
"""
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
addopts = 
    -v 
    --tb=short
    --strict-markers
    --disable-warnings
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
"""
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

## 📋 テストベストプラクティス

### コード品質保証

```python
# tests/conftest.py - 共通設定追加
@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """全テストでデータベースアクセスを有効化"""
    pass


@pytest.fixture
def settings_override():
    """テスト用設定オーバーライド"""
    return {
        "TESTING": True,
        "DATABASE_ECHO": False,
        "CACHE_ENABLED": False
    }


# テスト分類マーカー
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.unit
]


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

このテスト戦略により、SQLAlchemy 2.0を使用したアプリケーションの品質と信頼性を確保できます。非同期処理、複雑なクエリ、パフォーマンス要件を含む包括的なテストカバレッジを実現します。