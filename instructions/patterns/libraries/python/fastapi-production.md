# FastAPI Production パターン

プロダクション環境でのFastAPI実装パターン集。高性能で拡張性のあるAPI開発のための包括的な設計手法とベストプラクティス。

## 🚀 プロダクション設定

### アプリケーション構造

```python
# app/main.py
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
import logging
import time

from app.core.config import settings
from app.core.security import get_current_user
from app.core.database import database
from app.core.redis import redis_client
from app.api.v1.api import api_router
from app.api.v2.api import api_router as api_router_v2
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.metrics import MetricsMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションライフサイクル管理"""
    # Startup
    logging.info("FastAPI application starting up...")
    
    # データベース接続
    await database.connect()
    logging.info("Database connected")
    
    # Redis接続
    await redis_client.ping()
    logging.info("Redis connected")
    
    # その他の初期化処理
    await setup_background_tasks()
    
    yield
    
    # Shutdown
    logging.info("FastAPI application shutting down...")
    await database.disconnect()
    await redis_client.close()
    logging.info("Cleanup completed")


def create_application() -> FastAPI:
    """FastAPIアプリケーション作成と設定"""
    
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=settings.DESCRIPTION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENVIRONMENT != "production" else None,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # セキュリティミドルウェア
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS
    )
    
    # CORS設定
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # セッション管理
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SECRET_KEY,
        max_age=settings.SESSION_MAX_AGE,
        same_site="lax",
        https_only=settings.ENVIRONMENT == "production"
    )

    # 圧縮
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # カスタムミドルウェア
    app.add_middleware(MetricsMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(LoggingMiddleware)

    # ルーター登録
    app.include_router(api_router, prefix=settings.API_V1_STR)
    app.include_router(api_router_v2, prefix=settings.API_V2_STR)

    # エラーハンドラー
    setup_exception_handlers(app)

    # ヘルスチェックエンドポイント
    setup_health_checks(app)

    return app


def setup_exception_handlers(app: FastAPI):
    """グローバル例外ハンドラーの設定"""
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                    "type": "http_exception",
                    "timestamp": time.time(),
                    "path": str(request.url.path)
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": 422,
                    "message": "Validation failed",
                    "type": "validation_error",
                    "details": exc.errors(),
                    "timestamp": time.time(),
                    "path": str(request.url.path)
                }
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logging.error(f"Unexpected error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": 500,
                    "message": "Internal server error",
                    "type": "internal_error",
                    "timestamp": time.time(),
                    "path": str(request.url.path)
                }
            },
        )


def setup_health_checks(app: FastAPI):
    """ヘルスチェックエンドポイントの設定"""
    
    @app.get("/health", tags=["health"])
    async def health_check():
        """基本的なヘルスチェック"""
        return {"status": "healthy", "timestamp": time.time()}

    @app.get("/health/detailed", tags=["health"])
    async def detailed_health_check():
        """詳細なヘルスチェック"""
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "services": {}
        }

        # データベース接続チェック
        try:
            await database.execute("SELECT 1")
            health_status["services"]["database"] = "healthy"
        except Exception as e:
            health_status["services"]["database"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"

        # Redis接続チェック
        try:
            await redis_client.ping()
            health_status["services"]["redis"] = "healthy"
        except Exception as e:
            health_status["services"]["redis"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"

        return health_status


async def setup_background_tasks():
    """バックグラウンドタスクの初期化"""
    # ここでバックグラウンドタスクの初期化を行う
    pass


# アプリケーションインスタンス作成
app = create_application()

# app/core/config.py
from pydantic_settings import BaseSettings
from pydantic import validator, Field
from typing import Any, Dict, List, Optional, Union
from functools import lru_cache
import secrets


class Settings(BaseSettings):
    # 基本設定
    PROJECT_NAME: str = "FastAPI Production App"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Production-ready FastAPI application"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # API設定
    API_V1_STR: str = "/api/v1"
    API_V2_STR: str = "/api/v2"
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    
    # セキュリティ設定
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    SESSION_MAX_AGE: int = 3600
    
    # CORS設定
    BACKEND_CORS_ORIGINS: List[str] = []
    ALLOWED_HOSTS: List[str] = ["*"]
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # データベース設定
    DATABASE_URL: str = Field(env="DATABASE_URL")
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    
    # Redis設定
    REDIS_URL: str = Field(env="REDIS_URL")
    REDIS_POOL_SIZE: int = 10
    
    # ロギング設定
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # レート制限設定
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # ファイルアップロード設定
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "gif", "pdf"]
    
    # 外部サービス設定
    EMAIL_SMTP_HOST: Optional[str] = None
    EMAIL_SMTP_PORT: Optional[int] = None
    EMAIL_SMTP_USER: Optional[str] = None
    EMAIL_SMTP_PASSWORD: Optional[str] = None
    
    # 監視設定
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

### 認証・認可システム

```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import redis.asyncio as redis

from app.core.config import settings
from app.models.user import User
from app.crud.user import user_crud


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None
    scopes: list[str] = []


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# パスワードハッシュ化
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT認証
security = HTTPBearer(auto_error=False)

# Redis (トークンブラックリスト用)
redis_client = redis.from_url(settings.REDIS_URL)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """パスワード検証"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """パスワードハッシュ化"""
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any], 
    expires_delta: Optional[timedelta] = None,
    scopes: list[str] = None
) -> str:
    """アクセストークン生成"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "scopes": scopes or [],
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    """リフレッシュトークン生成"""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh"
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


async def verify_token(token: str) -> TokenData:
    """トークン検証"""
    try:
        # ブラックリストチェック
        if await redis_client.get(f"blacklist:{token}"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked"
            )
        
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        username: str = payload.get("sub")
        scopes: list = payload.get("scopes", [])
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
        token_data = TokenData(
            username=username,
            scopes=scopes
        )
        
        return token_data
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """現在のユーザー取得"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token_data = await verify_token(credentials.credentials)
    user = await user_crud.get_by_username(username=token_data.username)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """アクティブなスーパーユーザー取得"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user doesn't have enough privileges"
        )
    return current_user


def require_scopes(*scopes: str):
    """スコープベースの認可デコレーター"""
    def scope_dependency(
        current_user: User = Depends(get_current_user),
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        token_data = verify_token(credentials.credentials)
        
        for scope in scopes:
            if scope not in token_data.scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Operation requires scope: {scope}"
                )
        
        return current_user
    
    return scope_dependency


async def authenticate_user(username: str, password: str) -> Optional[User]:
    """ユーザー認証"""
    user = await user_crud.get_by_username(username=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def revoke_token(token: str):
    """トークン取り消し"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        exp = payload.get("exp")
        
        if exp:
            # トークンの残り有効期限までブラックリストに保存
            ttl = exp - datetime.utcnow().timestamp()
            if ttl > 0:
                await redis_client.setex(
                    f"blacklist:{token}",
                    int(ttl),
                    "revoked"
                )
    except JWTError:
        pass  # 無効なトークンは無視


# Rate Limiting
class RateLimiter:
    def __init__(self, requests: int, window: int):
        self.requests = requests
        self.window = window

    async def __call__(self, request: Request):
        client_ip = request.client.host
        key = f"rate_limit:{client_ip}"
        
        current = await redis_client.get(key)
        
        if current is None:
            await redis_client.setex(key, self.window, 1)
            return True
        
        if int(current) >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
        
        await redis_client.incr(key)
        return True


# 使用例
rate_limiter = RateLimiter(
    requests=settings.RATE_LIMIT_REQUESTS,
    window=settings.RATE_LIMIT_WINDOW
)
```

## 📊 データベース統合

### SQLAlchemy非同期統合

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy import event
from typing import AsyncGenerator
import logging

from app.core.config import settings

# 非同期エンジン作成
if settings.ENVIRONMENT == "test":
    # テスト環境では接続プールを無効化
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.DEBUG,
    )
else:
    # プロダクション環境では接続プール最適化
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=settings.DATABASE_POOL_TIMEOUT,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )

# セッションファクトリー
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# データベース接続管理
class DatabaseManager:
    def __init__(self):
        self.engine = engine

    async def connect(self):
        """データベース接続"""
        try:
            async with self.engine.begin() as conn:
                await conn.execute("SELECT 1")
            logging.info("Database connected successfully")
        except Exception as e:
            logging.error(f"Database connection failed: {e}")
            raise

    async def disconnect(self):
        """データベース切断"""
        await self.engine.dispose()
        logging.info("Database disconnected")

    async def create_tables(self):
        """テーブル作成"""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


database = DatabaseManager()


# 依存性注入用セッション取得
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# トランザクション管理デコレーター
from functools import wraps


def transactional(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        async with AsyncSessionLocal() as session:
            try:
                result = await func(*args, db=session, **kwargs)
                await session.commit()
                return result
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    return wrapper


# SQLAlchemyイベントリスナー
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite用の最適化設定"""
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


# app/models/base.py
from sqlalchemy import Column, Integer, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import as_declarative, declared_attr
from typing import Any


@as_declarative()
class Base:
    id: Any
    __name__: str

    # すべてのテーブルに共通のカラム
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    is_active = Column(Boolean, default=True)


# app/models/user.py
from sqlalchemy import Column, String, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

from app.models.base import Base


class UserRole(PyEnum):
    USER = "user"
    ADMIN = "admin"
    SUPERUSER = "superuser"


class User(Base):
    __tablename__ = "users"

    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    bio = Column(Text)
    
    # 権限管理
    is_superuser = Column(Boolean, default=False)
    role = Column(Enum(UserRole), default=UserRole.USER)
    
    # アカウント状態
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # リレーション
    posts = relationship("Post", back_populates="author")


# app/crud/base.py
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """IDによる単一レコード取得"""
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self, 
        db: AsyncSession, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None
    ) -> List[ModelType]:
        """複数レコード取得"""
        query = select(self.model)
        
        # フィルター適用
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key):
                    query = query.where(getattr(self.model, key) == value)
        
        # ソート
        if order_by and hasattr(self.model, order_by):
            query = query.order_by(getattr(self.model, order_by))
        
        # ページネーション
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()

    async def create(
        self, 
        db: AsyncSession, 
        *, 
        obj_in: CreateSchemaType
    ) -> ModelType:
        """レコード作成"""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """レコード更新"""
        obj_data = jsonable_encoder(db_obj)
        
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: int) -> ModelType:
        """レコード削除（物理削除）"""
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        obj = result.scalar_one_or_none()
        
        if obj:
            await db.delete(obj)
            await db.commit()
        
        return obj

    async def soft_delete(self, db: AsyncSession, *, id: int) -> ModelType:
        """レコード削除（論理削除）"""
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        obj = result.scalar_one_or_none()
        
        if obj:
            obj.is_active = False
            await db.commit()
            await db.refresh(obj)
        
        return obj

    async def count(
        self, 
        db: AsyncSession, 
        filters: Optional[Dict[str, Any]] = None
    ) -> int:
        """レコード数取得"""
        query = select(func.count(self.model.id))
        
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key):
                    query = query.where(getattr(self.model, key) == value)
        
        result = await db.execute(query)
        return result.scalar()
```

## 🔄 非同期処理とバックグラウンドタスク

### Celery統合

```python
# app/core/celery_app.py
from celery import Celery
from celery.schedules import crontab
from kombu import Queue

from app.core.config import settings

# Celery設定
celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"]
)

# 設定
celery_app.conf.update(
    # タスク設定
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tokyo",
    enable_utc=True,
    
    # 結果設定
    result_expires=3600,
    result_backend_transport_options={
        "retry_on_timeout": True,
        "retry_on_error": [ConnectionError, OSError],
    },
    
    # ワーカー設定
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=False,
    
    # ルーティング
    task_routes={
        "app.tasks.send_email": {"queue": "email"},
        "app.tasks.process_image": {"queue": "image"},
        "app.tasks.generate_report": {"queue": "reports"},
        "app.tasks.cleanup_files": {"queue": "maintenance"},
    },
    
    # キュー設定
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="default"),
        Queue("email", routing_key="email"),
        Queue("image", routing_key="image"),
        Queue("reports", routing_key="reports"),
        Queue("maintenance", routing_key="maintenance"),
    ),
    
    # 定期タスク設定
    beat_schedule={
        "cleanup-temp-files": {
            "task": "app.tasks.cleanup_temp_files",
            "schedule": crontab(minute=0, hour=2),  # 毎日午前2時
        },
        "send-daily-report": {
            "task": "app.tasks.send_daily_report",
            "schedule": crontab(minute=0, hour=9),  # 毎日午前9時
        },
        "health-check": {
            "task": "app.tasks.health_check",
            "schedule": 60.0,  # 60秒ごと
        },
    },
)

# app/tasks/email.py
from celery import current_task
from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.email import EmailService
import logging


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, to_email: str, subject: str, content: str):
    """メール送信タスク"""
    try:
        email_service = EmailService()
        result = email_service.send_email(
            to_email=to_email,
            subject=subject,
            content=content
        )
        
        logging.info(f"Email sent successfully to {to_email}")
        return {"status": "sent", "to": to_email, "result": result}
        
    except Exception as exc:
        logging.error(f"Email sending failed: {exc}")
        
        # リトライ
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        
        # 最大リトライ数に達した場合
        logging.error(f"Email sending failed permanently for {to_email}")
        raise


@celery_app.task
def send_bulk_email_task(email_list: list, subject: str, content: str):
    """バルクメール送信タスク"""
    results = []
    
    for email in email_list:
        # 各メールを個別のタスクとして実行
        result = send_email_task.delay(email, subject, content)
        results.append({"email": email, "task_id": result.id})
    
    return {"total": len(email_list), "tasks": results}


# app/tasks/image.py
from PIL import Image
import boto3
from app.core.celery_app import celery_app
from app.core.config import settings
import tempfile
import os


@celery_app.task(bind=True)
def process_image_task(
    self, 
    image_url: str, 
    user_id: int, 
    operations: list
):
    """画像処理タスク"""
    try:
        # 進行状況更新
        self.update_state(
            state="PROGRESS",
            meta={"current": 10, "total": 100, "status": "Downloading image"}
        )
        
        # 画像ダウンロード
        response = requests.get(image_url)
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name
        
        # 進行状況更新
        self.update_state(
            state="PROGRESS",
            meta={"current": 30, "total": 100, "status": "Processing image"}
        )
        
        # 画像処理
        with Image.open(tmp_path) as img:
            for i, operation in enumerate(operations):
                if operation["type"] == "resize":
                    img = img.resize(operation["size"])
                elif operation["type"] == "rotate":
                    img = img.rotate(operation["angle"])
                elif operation["type"] == "filter":
                    # カスタムフィルター適用
                    pass
                
                # 進行状況更新
                progress = 30 + (50 * (i + 1) / len(operations))
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": int(progress), 
                        "total": 100, 
                        "status": f"Applied {operation['type']}"
                    }
                )
        
        # 処理済み画像保存
        output_path = f"/tmp/processed_{user_id}_{int(time.time())}.jpg"
        img.save(output_path, "JPEG", quality=85)
        
        # 進行状況更新
        self.update_state(
            state="PROGRESS",
            meta={"current": 80, "total": 100, "status": "Uploading to storage"}
        )
        
        # S3アップロード
        s3_client = boto3.client("s3")
        s3_key = f"processed/{user_id}/{os.path.basename(output_path)}"
        
        s3_client.upload_file(
            output_path,
            settings.S3_BUCKET,
            s3_key
        )
        
        # クリーンアップ
        os.unlink(tmp_path)
        os.unlink(output_path)
        
        result_url = f"https://{settings.S3_BUCKET}.s3.amazonaws.com/{s3_key}"
        
        return {
            "status": "completed",
            "result_url": result_url,
            "operations_applied": len(operations)
        }
        
    except Exception as exc:
        logging.error(f"Image processing failed: {exc}")
        raise


# app/tasks/reports.py
import pandas as pd
from app.core.celery_app import celery_app
from app.core.database import get_db
from app.crud.user import user_crud
from app.services.report import ReportService


@celery_app.task
def generate_user_report_task(start_date: str, end_date: str):
    """ユーザーレポート生成タスク"""
    try:
        report_service = ReportService()
        
        # データ取得
        data = report_service.get_user_analytics(start_date, end_date)
        
        # レポート生成
        report_path = report_service.generate_excel_report(
            data, 
            f"user_report_{start_date}_{end_date}.xlsx"
        )
        
        # S3アップロード（オプション）
        s3_url = report_service.upload_to_s3(report_path)
        
        return {
            "status": "completed",
            "file_path": report_path,
            "s3_url": s3_url,
            "record_count": len(data)
        }
        
    except Exception as exc:
        logging.error(f"Report generation failed: {exc}")
        raise


# FastAPIとCeleryの統合
# app/api/v1/endpoints/tasks.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.security import get_current_user
from app.models.user import User
from app.tasks.email import send_email_task, send_bulk_email_task
from app.tasks.image import process_image_task
from celery.result import AsyncResult
from pydantic import BaseModel

router = APIRouter()


class EmailTask(BaseModel):
    to_email: str
    subject: str
    content: str


class BulkEmailTask(BaseModel):
    email_list: list[str]
    subject: str
    content: str


class ImageProcessTask(BaseModel):
    image_url: str
    operations: list


@router.post("/send-email")
async def send_email(
    task_data: EmailTask,
    current_user: User = Depends(get_current_user)
):
    """メール送信タスクの開始"""
    result = send_email_task.delay(
        task_data.to_email,
        task_data.subject,
        task_data.content
    )
    
    return {"task_id": result.id, "status": "queued"}


@router.post("/send-bulk-email")
async def send_bulk_email(
    task_data: BulkEmailTask,
    current_user: User = Depends(get_current_user)
):
    """バルクメール送信タスクの開始"""
    result = send_bulk_email_task.delay(
        task_data.email_list,
        task_data.subject,
        task_data.content
    )
    
    return {"task_id": result.id, "status": "queued"}


@router.post("/process-image")
async def process_image(
    task_data: ImageProcessTask,
    current_user: User = Depends(get_current_user)
):
    """画像処理タスクの開始"""
    result = process_image_task.delay(
        task_data.image_url,
        current_user.id,
        task_data.operations
    )
    
    return {"task_id": result.id, "status": "queued"}


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """タスク状態確認"""
    result = AsyncResult(task_id)
    
    if result.state == "PENDING":
        response = {
            "state": result.state,
            "status": "Task is pending"
        }
    elif result.state == "PROGRESS":
        response = {
            "state": result.state,
            "current": result.info.get("current", 0),
            "total": result.info.get("total", 1),
            "status": result.info.get("status", "")
        }
    elif result.state == "SUCCESS":
        response = {
            "state": result.state,
            "result": result.result
        }
    else:  # FAILURE
        response = {
            "state": result.state,
            "error": str(result.info)
        }
    
    return response
```

このFastAPI Productionパターン集は、エンタープライズレベルのAPI開発に必要なすべての要素を包含した包括的なソリューションを提供します。認証・認可、データベース統合、非同期処理、セキュリティ、監視など、プロダクション環境で求められる高品質な実装パターンを実現しています。