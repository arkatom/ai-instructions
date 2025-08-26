# SQLAlchemy 2.0 リポジトリテストとモック

リポジトリの包括的なテストとモック戦略の実装パターン。

## ✅ リポジトリテスト

### ユーザーリポジトリテスト

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
```

### 投稿リポジトリテスト

```python
# tests/test_repositories/test_post_repository.py
from repositories.post_repository import PostRepository


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
```

### 非同期セッションモック

```python
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