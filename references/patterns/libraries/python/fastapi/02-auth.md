# FastAPI 認証・認可システム

JWT、OAuth2、スコープベース認可を含む包括的な認証システムの実装。セキュリティベストプラクティスとレート制限機能。

## 🔐 JWT認証システム

### セキュリティ設定と認証実装

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

## 🔑 OAuth2統合

### Google OAuth2プロバイダー

```python
# app/core/oauth.py
import httpx
from fastapi import HTTPException, status
from typing import Dict, Any, Optional


class OAuth2Provider:
    """OAuth2プロバイダー基底クラス"""
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
    
    async def get_user_info(self, token: str) -> Dict[str, Any]:
        raise NotImplementedError


class GoogleOAuth2(OAuth2Provider):
    """Google OAuth2実装"""
    
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        super().__init__(client_id, client_secret)
        self.redirect_uri = redirect_uri
    
    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """認可コードをアクセストークンに交換"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange code for token"
                )
            
            return response.json()
    
    async def get_user_info(self, token: str) -> Dict[str, Any]:
        """ユーザー情報取得"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch user info"
                )
            
            return response.json()


# app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

router = APIRouter()

google_oauth = GoogleOAuth2(
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    redirect_uri=settings.GOOGLE_REDIRECT_URI
)


class UserLogin(BaseModel):
    username: str
    password: str


class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None


@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """ユーザーログイン"""
    user = await authenticate_user(
        user_credentials.username,
        user_credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    
    access_token = create_access_token(
        subject=user.username,
        expires_delta=access_token_expires,
        scopes=user.get_scopes()
    )
    
    refresh_token = create_refresh_token(subject=user.username)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_request: RefreshTokenRequest):
    """トークンリフレッシュ"""
    try:
        payload = jwt.decode(
            refresh_request.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = await user_crud.get_by_username(username=username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        access_token = create_access_token(
            subject=user.username,
            scopes=user.get_scopes()
        )
        
        new_refresh_token = create_refresh_token(subject=user.username)
        
        # 古いリフレッシュトークンを無効化
        await revoke_token(refresh_request.refresh_token)
        
        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """ユーザーログアウト"""
    # アクセストークンを無効化
    await revoke_token(credentials.credentials)
    
    return {"message": "Successfully logged out"}


@router.get("/google")
async def google_login():
    """Google OAuth2ログインURL生成"""
    auth_url = (
        "https://accounts.google.com/o/oauth2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        "response_type=code&"
        "scope=openid email profile&"
        "access_type=offline"
    )
    
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_callback(code: str):
    """Google OAuth2コールバック"""
    # アクセストークン取得
    token_data = await google_oauth.exchange_code_for_token(code)
    access_token = token_data["access_token"]
    
    # ユーザー情報取得
    user_info = await google_oauth.get_user_info(access_token)
    
    # ユーザー作成または取得
    user = await user_crud.get_by_email(email=user_info["email"])
    
    if not user:
        # 新規ユーザー作成
        user = await user_crud.create(
            username=user_info["email"],
            email=user_info["email"],
            full_name=user_info.get("name"),
            is_verified=True,  # OAuth2ユーザーは検証済み
            oauth_provider="google",
            oauth_id=user_info["id"]
        )
    
    # JWTトークン生成
    jwt_access_token = create_access_token(
        subject=user.username,
        scopes=user.get_scopes()
    )
    
    jwt_refresh_token = create_refresh_token(subject=user.username)
    
    return Token(
        access_token=jwt_access_token,
        refresh_token=jwt_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
```

## 🛡️ セキュリティミドルウェア

### 高度なセキュリティ実装

```python
# app/middleware/security.py
import secrets
import hashlib
from typing import Set
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """セキュリティヘッダーミドルウェア"""
    
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # セキュリティヘッダー追加
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # HSTS (HTTPS環境でのみ)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.example.com"
        )
        response.headers["Content-Security-Policy"] = csp_policy
        
        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """CSRF保護ミドルウェア"""
    
    def __init__(self, app, exempt_paths: Set[str] = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or {"/docs", "/openapi.json", "/health"}
    
    async def dispatch(self, request: Request, call_next):
        # GET、HEAD、OPTIONS は除外
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        
        # 除外パスをチェック
        if request.url.path in self.exempt_paths:
            return await call_next(request)
        
        # CSRFトークン検証
        csrf_token = request.headers.get("X-CSRF-Token")
        session_token = request.session.get("csrf_token")
        
        if not csrf_token or not session_token or csrf_token != session_token:
            return Response(
                content="CSRF token missing or invalid",
                status_code=403
            )
        
        return await call_next(request)


def generate_csrf_token() -> str:
    """CSRFトークン生成"""
    return secrets.token_urlsafe(32)


# app/api/v1/endpoints/csrf.py
@router.get("/csrf-token")
async def get_csrf_token(request: Request):
    """CSRFトークン取得"""
    token = generate_csrf_token()
    request.session["csrf_token"] = token
    return {"csrf_token": token}
```

## 🚦 レート制限とAPI保護

### 高度なレート制限実装

```python
# app/core/rate_limiting.py
import asyncio
from enum import Enum
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
import redis.asyncio as redis


class RateLimitStrategy(Enum):
    """レート制限戦略"""
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"


class AdvancedRateLimiter:
    """高度なレート制限実装"""
    
    def __init__(
        self,
        redis_client: redis.Redis,
        strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
    ):
        self.redis = redis_client
        self.strategy = strategy
    
    async def is_allowed(
        self,
        identifier: str,
        limit: int,
        window: int,
        cost: int = 1
    ) -> tuple[bool, Dict[str, int]]:
        """レート制限チェック"""
        if self.strategy == RateLimitStrategy.SLIDING_WINDOW:
            return await self._sliding_window_check(identifier, limit, window, cost)
        elif self.strategy == RateLimitStrategy.TOKEN_BUCKET:
            return await self._token_bucket_check(identifier, limit, window, cost)
        else:
            return await self._fixed_window_check(identifier, limit, window, cost)
    
    async def _sliding_window_check(
        self, identifier: str, limit: int, window: int, cost: int
    ) -> tuple[bool, Dict[str, int]]:
        """スライディングウィンドウアルゴリズム"""
        key = f"rate_limit:sliding:{identifier}"
        current_time = asyncio.get_event_loop().time()
        
        # パイプラインで効率的に実行
        pipe = self.redis.pipeline()
        
        # 古いエントリを削除
        pipe.zremrangebyscore(key, 0, current_time - window)
        
        # 現在のリクエスト数を取得
        pipe.zcard(key)
        
        # 現在のリクエストを追加
        pipe.zadd(key, {str(current_time): current_time})
        
        # TTL設定
        pipe.expire(key, window)
        
        results = await pipe.execute()
        
        current_count = results[1]
        
        if current_count + cost > limit:
            # リクエストを削除（超過分）
            await self.redis.zrem(key, str(current_time))
            return False, {
                "limit": limit,
                "remaining": max(0, limit - current_count),
                "reset_time": int(current_time + window)
            }
        
        return True, {
            "limit": limit,
            "remaining": max(0, limit - current_count - cost),
            "reset_time": int(current_time + window)
        }
    
    async def _token_bucket_check(
        self, identifier: str, limit: int, window: int, cost: int
    ) -> tuple[bool, Dict[str, int]]:
        """トークンバケットアルゴリズム"""
        key = f"rate_limit:bucket:{identifier}"
        current_time = asyncio.get_event_loop().time()
        
        # バケット状態を取得
        bucket_data = await self.redis.hmget(
            key, "tokens", "last_refill"
        )
        
        tokens = float(bucket_data[0] or limit)
        last_refill = float(bucket_data[1] or current_time)
        
        # トークン補充
        time_passed = current_time - last_refill
        tokens_to_add = time_passed * (limit / window)
        tokens = min(limit, tokens + tokens_to_add)
        
        if tokens >= cost:
            # トークン消費
            tokens -= cost
            
            # 状態更新
            await self.redis.hmset(key, {
                "tokens": tokens,
                "last_refill": current_time
            })
            await self.redis.expire(key, window * 2)  # バケットの2倍の期間保持
            
            return True, {
                "limit": limit,
                "remaining": int(tokens),
                "reset_time": int(current_time + ((limit - tokens) * window / limit))
            }
        
        return False, {
            "limit": limit,
            "remaining": int(tokens),
            "reset_time": int(current_time + ((cost - tokens) * window / limit))
        }


# 使用例
rate_limiter = AdvancedRateLimiter(
    redis_client=redis_client,
    strategy=RateLimitStrategy.SLIDING_WINDOW
)


async def rate_limit_dependency(
    request: Request,
    limit: int = 100,
    window: int = 60,
    cost: int = 1
):
    """レート制限依存関数"""
    # クライアント識別
    client_id = get_client_identifier(request)
    
    # レート制限チェック
    is_allowed, info = await rate_limiter.is_allowed(
        identifier=client_id,
        limit=limit,
        window=window,
        cost=cost
    )
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={
                "X-RateLimit-Limit": str(info["limit"]),
                "X-RateLimit-Remaining": str(info["remaining"]),
                "X-RateLimit-Reset": str(info["reset_time"]),
                "Retry-After": str(window)
            }
        )
    
    # レスポンスヘッダー情報を保存
    request.state.rate_limit_info = info


def get_client_identifier(request: Request) -> str:
    """クライアント識別子取得"""
    # 認証済みユーザーの場合はユーザーIDを使用
    if hasattr(request.state, "user"):
        return f"user:{request.state.user.id}"
    
    # IPアドレス（プロキシ考慮）
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return f"ip:{forwarded_for.split(',')[0].strip()}"
    
    return f"ip:{request.client.host}"
```

このFastAPI認証システムにより、JWT、OAuth2、CSRF保護、レート制限を含む包括的なセキュリティを実現できます。