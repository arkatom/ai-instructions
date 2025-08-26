# FastAPI アプリケーション設定

プロダクション環境でのFastAPIアプリケーション構築。ライフサイクル管理、ミドルウェア設定、エラーハンドリングの実装。

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
```

## ⚙️ 設定管理

### Pydantic Settingsによる設定管理

```python
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


# 環境別設定
class DevelopmentSettings(Settings):
    """開発環境設定"""
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/dev_db"
    REDIS_URL: str = "redis://localhost:6379/0"


class ProductionSettings(Settings):
    """本番環境設定"""
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    # プロダクション固有の設定
    ALLOWED_HOSTS: List[str] = ["yourdomain.com", "api.yourdomain.com"]
    
    
class TestingSettings(Settings):
    """テスト環境設定"""
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/test_db"
    REDIS_URL: str = "redis://localhost:6379/1"


def get_settings_by_environment() -> Settings:
    """環境に応じた設定を取得"""
    env = os.getenv("ENVIRONMENT", "development")
    
    if env == "production":
        return ProductionSettings()
    elif env == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()
```

## 🎛️ カスタムミドルウェア

### 包括的なミドルウェア実装

```python
# app/middleware/logging.py
import logging
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class LoggingMiddleware(BaseHTTPMiddleware):
    """構造化ログ出力ミドルウェア"""
    
    def __init__(self, app, logger: logging.Logger = None):
        super().__init__(app)
        self.logger = logger or logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # リクエストID生成
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # リクエストログ
        self.logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "user_agent": request.headers.get("user-agent"),
                "client_ip": request.client.host if request.client else None,
                "timestamp": start_time
            }
        )
        
        # レスポンス処理
        try:
            response = await call_next(request)
            
            # レスポンスログ
            process_time = time.time() - start_time
            self.logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "process_time": process_time,
                    "response_size": response.headers.get("content-length"),
                }
            )
            
            # レスポンスヘッダーにリクエストIDを追加
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # エラーログ
            process_time = time.time() - start_time
            self.logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "process_time": process_time,
                },
                exc_info=True
            )
            raise


# app/middleware/rate_limit.py
import asyncio
import time
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis


class RateLimitMiddleware(BaseHTTPMiddleware):
    """レート制限ミドルウェア"""
    
    def __init__(
        self,
        app,
        redis_client: redis.Redis,
        requests_per_minute: int = 100,
        burst_size: int = 10
    ):
        super().__init__(app)
        self.redis = redis_client
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.window_size = 60  # 1分
    
    async def dispatch(self, request: Request, call_next):
        # レート制限対象のパスかチェック
        if not self._should_rate_limit(request):
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        current_time = int(time.time())
        
        # Sliding window log アルゴリズム
        is_allowed = await self._is_request_allowed(client_ip, current_time)
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(self.window_size)}
            )
        
        response = await call_next(request)
        
        # レスポンスヘッダーにレート制限情報を追加
        remaining = await self._get_remaining_requests(client_ip, current_time)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(current_time + self.window_size)
        
        return response
    
    def _should_rate_limit(self, request: Request) -> bool:
        """レート制限対象のリクエストかチェック"""
        # 静的ファイルやヘルスチェックは除外
        excluded_paths = ["/health", "/docs", "/openapi.json", "/static"]
        return not any(request.url.path.startswith(path) for path in excluded_paths)
    
    def _get_client_ip(self, request: Request) -> str:
        """クライアントIPを取得"""
        # プロキシ経由の場合はX-Forwarded-Forを優先
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        return request.client.host if request.client else "unknown"
    
    async def _is_request_allowed(self, client_ip: str, current_time: int) -> bool:
        """リクエストが許可されるかチェック"""
        key = f"rate_limit:{client_ip}"
        
        # 古いエントリを削除
        await self.redis.zremrangebyscore(
            key, 0, current_time - self.window_size
        )
        
        # 現在のリクエスト数を取得
        current_requests = await self.redis.zcard(key)
        
        if current_requests >= self.requests_per_minute:
            return False
        
        # リクエストを記録
        await self.redis.zadd(key, {str(current_time): current_time})
        await self.redis.expire(key, self.window_size)
        
        return True
    
    async def _get_remaining_requests(self, client_ip: str, current_time: int) -> int:
        """残りリクエスト数を取得"""
        key = f"rate_limit:{client_ip}"
        current_requests = await self.redis.zcard(key)
        return max(0, self.requests_per_minute - current_requests)


# app/middleware/metrics.py
import time
from typing import Dict
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, Gauge


class MetricsMiddleware(BaseHTTPMiddleware):
    """Prometheusメトリクス収集ミドルウェア"""
    
    def __init__(self, app):
        super().__init__(app)
        
        # メトリクス定義
        self.requests_total = Counter(
            "http_requests_total",
            "Total HTTP requests",
            ["method", "endpoint", "status_code"]
        )
        
        self.request_duration = Histogram(
            "http_request_duration_seconds",
            "HTTP request duration",
            ["method", "endpoint"]
        )
        
        self.active_requests = Gauge(
            "http_requests_active",
            "Active HTTP requests"
        )
        
        self.request_size = Histogram(
            "http_request_size_bytes",
            "HTTP request size",
            ["method", "endpoint"]
        )
        
        self.response_size = Histogram(
            "http_response_size_bytes",
            "HTTP response size",
            ["method", "endpoint", "status_code"]
        )
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # アクティブリクエスト数を増加
        self.active_requests.inc()
        
        # リクエストサイズ測定
        request_size = int(request.headers.get("content-length", 0))
        
        method = request.method
        endpoint = self._get_endpoint(request)
        
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
            
            # レスポンスサイズ測定
            response_size = int(response.headers.get("content-length", 0))
            
        except Exception as e:
            status_code = "500"
            response_size = 0
            raise
        
        finally:
            # メトリクス更新
            duration = time.time() - start_time
            
            self.requests_total.labels(
                method=method,
                endpoint=endpoint,
                status_code=status_code
            ).inc()
            
            self.request_duration.labels(
                method=method,
                endpoint=endpoint
            ).observe(duration)
            
            if request_size > 0:
                self.request_size.labels(
                    method=method,
                    endpoint=endpoint
                ).observe(request_size)
            
            if response_size > 0:
                self.response_size.labels(
                    method=method,
                    endpoint=endpoint,
                    status_code=status_code
                ).observe(response_size)
            
            # アクティブリクエスト数を減少
            self.active_requests.dec()
        
        return response
    
    def _get_endpoint(self, request: Request) -> str:
        """エンドポイント名を取得"""
        # ルートパターンを取得（パラメータは除外）
        route = request.scope.get("route")
        if route:
            return route.path
        return request.url.path
```