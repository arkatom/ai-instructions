# SQLAlchemy 2.0 テスト環境構築

SQLAlchemy 2.0での包括的なテスト実装。非同期テスト環境、ファクトリーパターン、フィクスチャの設定。

## 🧪 テスト環境構築

### 基本テスト設定

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
import asyncio
from typing import AsyncGenerator, List

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
```

### 非同期ファクトリー管理

```python
# tests/factories/async_factory.py
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Tuple


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
    ) -> Tuple[User, List[Post]]:
        """投稿付きユーザー作成"""
        user = await self.create_user(**user_kwargs)
        
        posts = []
        for _ in range(post_count):
            post = await self.create_post(author=user)
            posts.append(post)
        
        return user, posts
```