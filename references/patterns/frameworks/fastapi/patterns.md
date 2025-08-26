# FastAPIパターン (2024)

高性能な非同期Pythonフレームワークの最新ベストプラクティス。

## 基本設定とプロジェクト構造

### プロジェクト構造
```
app/
├── __init__.py
├── main.py              # アプリケーションエントリポイント
├── core/
│   ├── config.py        # 設定管理
│   ├── security.py      # セキュリティ設定
│   └── database.py      # データベース設定
├── api/
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── endpoints/   # APIエンドポイント
│   │   └── deps.py      # 依存関係
├── models/              # SQLAlchemyモデル
├── schemas/             # Pydanticスキーマ
├── crud/                # CRUD操作
├── services/            # ビジネスロジック
└── tests/               # テストファイル
```

## Async SQLAlchemy 2.0統合

### データベース設定
```python
# core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

SQLALCHEMY_DATABASE_URL = "postgresql+asyncpg://user:password@localhost/db"

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# 依存性注入用
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### モデル定義 (SQLAlchemy 2.0)
```python
# models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

## Pydantic v2スキーマ

### リクエスト/レスポンススキーマ
```python
# schemas/user.py
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=8)

class UserInDB(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

class UserResponse(UserInDB):
    pass  # パスワードを除外

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
```

## 非同期CRUD操作

### CRUD実装
```python
# crud/user.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

class UserCRUD:
    @staticmethod
    async def create(db: AsyncSession, user_create: UserCreate) -> User:
        db_user = User(
            email=user_create.email,
            username=user_create.username,
            hashed_password=get_password_hash(user_create.password),
            is_active=user_create.is_active,
        )
        db.add(db_user)
        try:
            await db.commit()
            await db.refresh(db_user)
            return db_user
        except IntegrityError:
            await db.rollback()
            raise ValueError("User already exists")
    
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_multi(
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[User]:
        result = await db.execute(
            select(User)
            .offset(skip)
            .limit(limit)
            .order_by(User.created_at.desc())
        )
        return result.scalars().all()
    
    @staticmethod
    async def update(
        db: AsyncSession, 
        user_id: int, 
        user_update: UserUpdate
    ) -> Optional[User]:
        update_data = user_update.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        
        result = await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**update_data)
            .returning(User)
        )
        await db.commit()
        return result.scalar_one_or_none()
```

## APIエンドポイント

### エンドポイント実装
```python
# api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.api.deps import get_db, get_current_user
from app.crud.user import UserCRUD
from app.schemas.user import UserResponse, UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """新規ユーザー作成"""
    try:
        user = await UserCRUD.create(db, user_in)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ユーザー一覧取得"""
    users = await UserCRUD.get_multi(db, skip=skip, limit=limit)
    return users

@router.get("/{user_id}", response_model=UserResponse)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """特定ユーザー取得"""
    user = await UserCRUD.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ユーザー情報更新"""
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    user = await UserCRUD.update(db, user_id, user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user
```

## 認証・認可

### JWT認証
```python
# core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await UserCRUD.get_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception
    return user
```

## Pytestによるテスト

### 非同期テスト設定
```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db

# テスト用データベース
TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test_db"

@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def client(async_session):
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()
```

### APIテスト
```python
# tests/test_users.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "testpass123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "hashed_password" not in data

@pytest.mark.asyncio
async def test_read_user(client: AsyncClient, created_user):
    response = await client.get(f"/api/v1/users/{created_user['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == created_user["email"]

@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, created_user, auth_headers):
    response = await client.patch(
        f"/api/v1/users/{created_user['id']}",
        json={"username": "updated_user"},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "updated_user"
```

## パフォーマンス最適化

### 接続プーリング
```python
# core/database.py
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,           # 同時接続数
    max_overflow=40,        # 追加接続数
    pool_pre_ping=True,     # 接続健全性チェック
    pool_recycle=3600,      # 接続リサイクル時間（秒）
)
```

### レスポンスキャッシング
```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache
from fastapi_cache.backend.redis import RedisBackend

@router.get("/popular", response_model=List[UserResponse])
@cache(expire=60)  # 60秒キャッシュ
async def get_popular_users(
    db: AsyncSession = Depends(get_db)
):
    return await UserCRUD.get_popular(db)
```

## チェックリスト
- [ ] 非同期処理の活用
- [ ] Pydantic v2での型安全性
- [ ] SQLAlchemy 2.0の新機能活用
- [ ] 適切なエラーハンドリング
- [ ] JWT認証の実装
- [ ] pytestでの非同期テスト
- [ ] 接続プーリングの最適化
- [ ] レスポンスキャッシング