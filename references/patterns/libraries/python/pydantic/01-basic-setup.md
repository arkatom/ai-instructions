# Pydantic v2 基本設定

## 🔧 基本モデルとフィールド設定

```python
# models/base.py
from pydantic import (
    BaseModel, 
    Field, 
    ConfigDict,
    ValidationInfo,
    field_validator,
    model_validator,
    computed_field,
    field_serializer
)
from pydantic.types import EmailStr, SecretStr, HttpUrl, UUID4
from pydantic_extra_types import PaymentCardNumber, PhoneNumber
from typing import Any, Dict, List, Optional, Union, Annotated, ClassVar
from datetime import datetime, date, timezone
from enum import Enum
import re
import uuid


class TimestampMixin(BaseModel):
    """タイムスタンプミックスイン"""
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="作成日時",
        json_schema_extra={"format": "date-time"}
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="更新日時",
        json_schema_extra={"format": "date-time"}
    )


class BaseAPIModel(BaseModel):
    """API用ベースモデル"""
    model_config = ConfigDict(
        # 基本設定
        str_strip_whitespace=True,      # 文字列の前後空白を削除
        validate_assignment=True,        # 代入時にバリデーション実行
        validate_default=True,          # デフォルト値もバリデーション
        use_enum_values=True,           # Enumの値を使用
        extra="forbid",                 # 余分なフィールドを禁止
        
        # シリアライゼーション設定
        ser_json_bytes="base64",        # bytesをbase64でシリアライズ
        ser_json_timedelta="float",     # timedeltaを秒数でシリアライズ
        ser_json_inf_nan="constants",   # inf/nanを定数でシリアライズ
        
        # JSON Schema設定
        json_schema_mode="validation",   # バリデーション用スキーマ
        json_schema_serialization_defaults_required=True,
        
        # パフォーマンス設定
        arbitrary_types_allowed=False,   # 任意の型を禁止
        frozen=False,                   # オブジェクトの変更を許可
    )
```

## 📝 カスタム型定義

```python
# カスタム型定義
class UserRole(str, Enum):
    """ユーザー権限"""
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPERUSER = "superuser"


class UserStatus(str, Enum):
    """ユーザー状態"""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"
```

## 🔒 カスタムバリデーター

```python
# カスタムバリデーター
def validate_password_strength(password: str) -> str:
    """パスワード強度バリデーション"""
    if len(password) < 8:
        raise ValueError("パスワードは8文字以上である必要があります")
    
    if not re.search(r"[A-Z]", password):
        raise ValueError("パスワードには大文字を含める必要があります")
    
    if not re.search(r"[a-z]", password):
        raise ValueError("パスワードには小文字を含める必要があります")
    
    if not re.search(r"\d", password):
        raise ValueError("パスワードには数字を含める必要があります")
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("パスワードには特殊文字を含める必要があります")
    
    return password


def validate_japanese_phone(phone: str) -> str:
    """日本の電話番号バリデーション"""
    # ハイフンと空白を除去
    phone_clean = re.sub(r"[\s\-]", "", phone)
    
    # 日本の電話番号パターン
    patterns = [
        r"^0[789]0\d{8}$",      # 携帯電話
        r"^0\d{9,10}$",         # 固定電話
        r"^0120\d{6}$",         # フリーダイヤル
        r"^050\d{8}$",          # IP電話
    ]
    
    for pattern in patterns:
        if re.match(pattern, phone_clean):
            return phone_clean
    
    raise ValueError("有効な日本の電話番号ではありません")
```

## 🏷️ Annotated型の定義

```python
# Annotated型の定義
Password = Annotated[str, Field(min_length=8, max_length=128)]
Username = Annotated[str, Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")]
JapanesePhone = Annotated[str, field_validator("validate_phone")(validate_japanese_phone)]
```

## ⚙️ ConfigDict詳細設定

### 基本設定オプション

| オプション | デフォルト | 説明 |
|-----------|----------|------|
| `str_strip_whitespace` | False | 文字列の前後空白を自動削除 |
| `validate_assignment` | False | 代入時にバリデーション実行 |
| `validate_default` | False | デフォルト値もバリデーション |
| `extra` | "ignore" | 余分なフィールドの扱い（forbid/allow/ignore） |
| `frozen` | False | イミュータブルモデル |

### シリアライゼーション設定

| オプション | デフォルト | 説明 |
|-----------|----------|------|
| `ser_json_bytes` | "utf8" | bytesのシリアライゼーション方法 |
| `ser_json_timedelta` | "iso8601" | timedeltaのシリアライゼーション |
| `ser_json_inf_nan` | "null" | 無限大/NaNの扱い |

## 💡 ベストプラクティス

1. **BaseAPIModelの継承**: 全てのAPIモデルで共通設定を継承
2. **Enumの活用**: 固定値にはEnumを使用して型安全性を確保
3. **Annotated型**: 共通の制約を持つフィールドは再利用可能に
4. **バリデーター関数**: 複雑なバリデーションは関数として分離
5. **Mixinの活用**: 共通フィールドはMixinとして定義

## 🚀 使用例

```python
# 基本的な使用例
class SimpleModel(BaseAPIModel):
    """シンプルなモデル例"""
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=150)
    email: EmailStr
    role: UserRole = UserRole.USER
    
# Mixinの使用例
class ArticleModel(BaseAPIModel, TimestampMixin):
    """記事モデル"""
    title: str = Field(max_length=200)
    content: str
    author: Username
    status: str = Field(default="draft")
```