# Pydantic v2 ユーザーモデル実装

## 👤 ユーザーベースモデル

```python
# models/user.py
from pydantic import EmailStr, SecretStr, Field, field_validator, model_validator, computed_field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from .base import BaseAPIModel, TimestampMixin, Username, Password, JapanesePhone, UserRole, UserStatus


class UserBase(BaseAPIModel):
    """ユーザーベースモデル"""
    username: Username = Field(
        description="ユーザー名（3-50文字、英数字とアンダースコアのみ）",
        examples=["john_doe", "user123"]
    )
    email: EmailStr = Field(
        description="メールアドレス",
        examples=["user@example.com"]
    )
    first_name: str = Field(
        min_length=1,
        max_length=50,
        description="名前",
        examples=["太郎"]
    )
    last_name: str = Field(
        min_length=1,
        max_length=50,
        description="苗字",
        examples=["田中"]
    )
    display_name: Optional[str] = Field(
        default=None,
        max_length=100,
        description="表示名",
        examples=["田中太郎"]
    )
    bio: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="自己紹介",
        examples=["Pythonエンジニアです"]
    )
    birth_date: Optional[date] = Field(
        default=None,
        description="生年月日",
        examples=["1990-01-01"]
    )
    phone: Optional[JapanesePhone] = Field(
        default=None,
        description="電話番号",
        examples=["090-1234-5678"]
    )
    website: Optional[HttpUrl] = Field(
        default=None,
        description="ウェブサイト",
        examples=["https://example.com"]
    )
    
    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: Optional[date]) -> Optional[date]:
        """生年月日バリデーション"""
        if v is None:
            return v
        
        today = date.today()
        if v > today:
            raise ValueError("生年月日は今日より前の日付である必要があります")
        
        # 年齢制限（13歳以上）
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 13:
            raise ValueError("13歳以上である必要があります")
        
        return v
    
    @computed_field
    @property
    def full_name(self) -> str:
        """フルネーム計算フィールド"""
        return f"{self.last_name} {self.first_name}".strip()
    
    @computed_field
    @property
    def age(self) -> Optional[int]:
        """年齢計算フィールド"""
        if self.birth_date is None:
            return None
        
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )
```

## ✨ ユーザー作成モデル

```python
class UserCreate(UserBase):
    """ユーザー作成モデル"""
    password: Password = Field(
        description="パスワード（8文字以上、大文字・小文字・数字・特殊文字を含む）"
    )
    password_confirm: str = Field(
        description="パスワード確認"
    )
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """パスワードバリデーション"""
        from .base import validate_password_strength
        return validate_password_strength(v)
    
    @model_validator(mode="after")
    def validate_passwords_match(self) -> "UserCreate":
        """パスワード一致確認"""
        if self.password != self.password_confirm:
            raise ValueError("パスワードが一致しません")
        return self
```

## 🔄 ユーザー更新モデル

```python
class UserUpdate(BaseAPIModel):
    """ユーザー更新モデル"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=1000)
    birth_date: Optional[date] = None
    phone: Optional[JapanesePhone] = None
    website: Optional[HttpUrl] = None
    
    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: Optional[date]) -> Optional[date]:
        """生年月日バリデーション"""
        if v is None:
            return v
        
        today = date.today()
        if v > today:
            raise ValueError("生年月日は今日より前の日付である必要があります")
        
        return v
```

## 📤 ユーザーレスポンスモデル

```python
class UserResponse(UserBase, TimestampMixin):
    """ユーザーレスポンスモデル"""
    id: int = Field(description="ユーザーID")
    uuid: UUID4 = Field(description="ユーザーUUID")
    role: UserRole = Field(description="ユーザー権限")
    status: UserStatus = Field(description="ユーザー状態")
    is_verified: bool = Field(description="メール認証済みかどうか")
    is_active: bool = Field(description="アクティブかどうか")
    last_login_at: Optional[datetime] = Field(
        default=None,
        description="最終ログイン日時"
    )
    login_count: int = Field(default=0, description="ログイン回数")
    
    # 統計情報（computed fields）
    @computed_field
    @property
    def posts_count(self) -> int:
        """投稿数（実際の実装では外部から注入）"""
        return getattr(self, "_posts_count", 0)
    
    @computed_field
    @property
    def followers_count(self) -> int:
        """フォロワー数（実際の実装では外部から注入）"""
        return getattr(self, "_followers_count", 0)
    
    @field_serializer("last_login_at", when_used="json")
    def serialize_last_login(self, value: Optional[datetime]) -> Optional[str]:
        """最終ログイン日時のカスタムシリアライゼーション"""
        if value is None:
            return None
        return value.isoformat()
    
    class Config:
        # パスワード関連フィールドは除外
        json_schema_extra = {
            "example": {
                "id": 1,
                "uuid": "550e8400-e29b-41d4-a716-446655440000",
                "username": "john_doe",
                "email": "john@example.com",
                "first_name": "太郎",
                "last_name": "田中",
                "full_name": "田中 太郎",
                "role": "user",
                "status": "active",
                "is_verified": True,
                "is_active": True,
                "posts_count": 10,
                "followers_count": 25
            }
        }
```

## 🔐 パスワード変更モデル

```python
class PasswordChange(BaseAPIModel):
    """パスワード変更モデル"""
    current_password: str = Field(description="現在のパスワード")
    new_password: Password = Field(description="新しいパスワード")
    new_password_confirm: str = Field(description="新しいパスワード確認")
    
    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """新パスワードバリデーション"""
        from .base import validate_password_strength
        return validate_password_strength(v)
    
    @model_validator(mode="after")
    def validate_passwords(self) -> "PasswordChange":
        """パスワード検証"""
        if self.new_password == self.current_password:
            raise ValueError("新しいパスワードは現在のパスワードと異なる必要があります")
        
        if self.new_password != self.new_password_confirm:
            raise ValueError("新しいパスワードが一致しません")
        
        return self
```

## 📊 ユーザー統計モデル

```python
class UserStatistics(BaseModel):
    """ユーザー統計モデル"""
    user_id: int
    total_posts: int = 0
    total_comments: int = 0
    total_likes_received: int = 0
    total_likes_given: int = 0
    followers_count: int = 0
    following_count: int = 0
    average_post_engagement: float = 0.0
    
    @computed_field
    @property
    def engagement_rate(self) -> float:
        """エンゲージメント率計算"""
        if self.total_posts == 0:
            return 0.0
        return (self.total_likes_received + self.total_comments) / self.total_posts
```

## 💡 実装のポイント

1. **computed_field**: 動的に計算される値を定義
2. **field_validator**: フィールド単位のバリデーション
3. **model_validator**: モデル全体のバリデーション
4. **field_serializer**: カスタムシリアライゼーション
5. **継承とMixin**: コードの再利用性を高める

## 🚀 使用例

```python
# ユーザー作成
user_data = {
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "SecurePass123!",
    "password_confirm": "SecurePass123!"
}
new_user = UserCreate(**user_data)

# ユーザー更新
update_data = {
    "bio": "Software Engineer",
    "website": "https://johndoe.com"
}
user_update = UserUpdate(**update_data)

# レスポンス生成
response = UserResponse(
    id=1,
    uuid="550e8400-e29b-41d4-a716-446655440000",
    username="john_doe",
    email="john@example.com",
    first_name="John",
    last_name="Doe",
    role=UserRole.USER,
    status=UserStatus.ACTIVE,
    is_verified=True,
    is_active=True
)
```