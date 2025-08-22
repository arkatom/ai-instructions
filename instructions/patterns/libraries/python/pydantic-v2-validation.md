# Pydantic v2 Data Validation パターン

Pydantic v2の最新機能を活用した高度なデータバリデーション・シリアライゼーションパターン集。型安全性、パフォーマンス、拡張性を重視したモダンなデータ処理手法。

## 🔧 Pydantic v2 基本設定

### 基本モデルとフィールド設定

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


# Annotated型の定義
Password = Annotated[str, Field(min_length=8, max_length=128)]
Username = Annotated[str, Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")]
JapanesePhone = Annotated[str, field_validator("validate_phone")(validate_japanese_phone)]


# models/user.py
from pydantic import EmailStr, SecretStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date


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
        return validate_password_strength(v)
    
    @model_validator(mode="after")
    def validate_passwords_match(self) -> "UserCreate":
        """パスワード一致確認"""
        if self.password != self.password_confirm:
            raise ValueError("パスワードが一致しません")
        return self


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

### 高度なバリデーションパターン

```python
# validators/custom_validators.py
from pydantic import field_validator, ValidationInfo
from typing import Any, Dict, List, Optional, Union
import re
import requests
from datetime import datetime, timezone
import hashlib


class DynamicValidator:
    """動的バリデーション"""
    
    @staticmethod
    def create_enum_validator(allowed_values: List[str], case_sensitive: bool = True):
        """動的Enumバリデーター作成"""
        def validator(v: str) -> str:
            if not case_sensitive:
                v = v.lower()
                allowed_values_lower = [val.lower() for val in allowed_values]
                if v not in allowed_values_lower:
                    raise ValueError(f"値は {allowed_values} のいずれかである必要があります")
                # 元の値を返す
                return next(val for val in allowed_values if val.lower() == v)
            else:
                if v not in allowed_values:
                    raise ValueError(f"値は {allowed_values} のいずれかである必要があります")
                return v
        return validator
    
    @staticmethod
    def create_regex_validator(pattern: str, message: str):
        """動的正規表現バリデーター作成"""
        compiled_pattern = re.compile(pattern)
        
        def validator(v: str) -> str:
            if not compiled_pattern.match(v):
                raise ValueError(message)
            return v
        return validator
    
    @staticmethod
    def create_length_validator(min_length: int, max_length: int):
        """動的長さバリデーター作成"""
        def validator(v: Union[str, List]) -> Union[str, List]:
            length = len(v)
            if length < min_length:
                raise ValueError(f"長さは{min_length}以上である必要があります")
            if length > max_length:
                raise ValueError(f"長さは{max_length}以下である必要があります")
            return v
        return validator


class BusinessRuleValidator:
    """ビジネスルールバリデーション"""
    
    @staticmethod
    def validate_credit_card(card_number: str) -> str:
        """クレジットカード番号バリデーション（Luhnアルゴリズム）"""
        # 数字以外を除去
        card_number = re.sub(r"\D", "", card_number)
        
        if not card_number:
            raise ValueError("カード番号が必要です")
        
        # Luhnアルゴリズムチェック
        def luhn_check(card_num: str) -> bool:
            digits = [int(d) for d in card_num]
            checksum = 0
            
            # 右から2番目の桁から開始
            for i in range(len(digits) - 2, -1, -1):
                if (len(digits) - i) % 2 == 0:  # 偶数位置
                    digits[i] *= 2
                    if digits[i] > 9:
                        digits[i] -= 9
                checksum += digits[i]
            
            return (checksum + digits[-1]) % 10 == 0
        
        if not luhn_check(card_number):
            raise ValueError("無効なクレジットカード番号です")
        
        # カードタイプ判定
        if card_number.startswith("4"):
            card_type = "Visa"
        elif card_number.startswith(("51", "52", "53", "54", "55")):
            card_type = "MasterCard"
        elif card_number.startswith(("34", "37")):
            card_type = "American Express"
        else:
            card_type = "Unknown"
        
        return card_number
    
    @staticmethod
    def validate_japanese_postal_code(postal_code: str) -> str:
        """日本の郵便番号バリデーション"""
        # ハイフン除去
        postal_code = postal_code.replace("-", "")
        
        if not re.match(r"^\d{7}$", postal_code):
            raise ValueError("郵便番号は7桁の数字である必要があります")
        
        # フォーマット整形
        return f"{postal_code[:3]}-{postal_code[3:]}"
    
    @staticmethod
    def validate_japanese_residence_card(card_number: str) -> str:
        """在留カード番号バリデーション"""
        # 在留カード番号のパターン
        if not re.match(r"^[A-Z]{2}\d{8}$", card_number):
            raise ValueError("在留カード番号は2文字のアルファベット + 8桁の数字である必要があります")
        
        return card_number


class ExternalValidator:
    """外部APIを使用したバリデーション"""
    
    @staticmethod
    async def validate_email_deliverability(email: str) -> str:
        """メール到達可能性チェック（外部API使用）"""
        # 実際の実装では外部のメール検証APIを使用
        # ここではモック実装
        domain = email.split("@")[1]
        
        # 一般的な無効ドメインをチェック
        invalid_domains = ["test.com", "example.com", "invalid.com"]
        if domain in invalid_domains:
            raise ValueError("無効なメールドメインです")
        
        return email
    
    @staticmethod
    async def validate_address(address: str, country: str = "JP") -> Dict[str, Any]:
        """住所バリデーション（地理情報API使用）"""
        # 実際の実装では Google Geocoding API などを使用
        # ここではモック実装
        
        if len(address) < 5:
            raise ValueError("住所が短すぎます")
        
        # モック地理情報
        return {
            "formatted_address": address,
            "latitude": 35.6762,
            "longitude": 139.6503,
            "country": country,
            "validated": True
        }


# models/complex_validation.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date, time


class PaymentModel(BaseAPIModel):
    """決済モデル - 複雑なバリデーション例"""
    
    # 基本情報
    amount: float = Field(
        gt=0,
        le=1000000,
        description="金額（1円以上100万円以下）"
    )
    currency: str = Field(
        default="JPY",
        pattern=r"^[A-Z]{3}$",
        description="通貨コード（ISO 4217）"
    )
    
    # カード情報
    card_number: str = Field(description="カード番号")
    card_holder_name: str = Field(
        min_length=2,
        max_length=50,
        description="カード名義人"
    )
    expiry_month: int = Field(ge=1, le=12, description="有効期限（月）")
    expiry_year: int = Field(ge=2024, le=2050, description="有効期限（年）")
    cvv: str = Field(pattern=r"^\d{3,4}$", description="セキュリティコード")
    
    # 請求先情報
    billing_address: Dict[str, str] = Field(description="請求先住所")
    
    @field_validator("card_number")
    @classmethod
    def validate_card_number(cls, v: str) -> str:
        """カード番号バリデーション"""
        return BusinessRuleValidator.validate_credit_card(v)
    
    @field_validator("card_holder_name")
    @classmethod
    def validate_card_holder_name(cls, v: str) -> str:
        """カード名義人バリデーション"""
        # 英字とスペースのみ許可
        if not re.match(r"^[A-Za-z\s]+$", v):
            raise ValueError("カード名義人は英字とスペースのみ使用できます")
        return v.upper()
    
    @model_validator(mode="after")
    def validate_expiry_date(self) -> "PaymentModel":
        """有効期限バリデーション"""
        current_date = datetime.now()
        expiry_date = datetime(self.expiry_year, self.expiry_month, 1)
        
        if expiry_date < current_date:
            raise ValueError("カードの有効期限が切れています")
        
        return self
    
    @model_validator(mode="after")
    def validate_billing_address(self) -> "PaymentModel":
        """請求先住所バリデーション"""
        required_fields = ["street", "city", "postal_code", "country"]
        
        for field in required_fields:
            if field not in self.billing_address:
                raise ValueError(f"請求先住所に{field}が必要です")
        
        # 郵便番号バリデーション（日本の場合）
        if self.billing_address.get("country") == "JP":
            postal_code = self.billing_address["postal_code"]
            self.billing_address["postal_code"] = BusinessRuleValidator.validate_japanese_postal_code(postal_code)
        
        return self


class OrderModel(BaseAPIModel):
    """注文モデル - ネストしたバリデーション例"""
    
    order_id: str = Field(pattern=r"^ORD-\d{8}-\d{4}$", description="注文ID")
    customer_id: int = Field(gt=0, description="顧客ID")
    items: List["OrderItemModel"] = Field(min_length=1, description="注文アイテム")
    shipping_address: Dict[str, str] = Field(description="配送先住所")
    payment: PaymentModel = Field(description="決済情報")
    order_date: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="注文日時"
    )
    
    @computed_field
    @property
    def total_amount(self) -> float:
        """合計金額計算"""
        return sum(item.subtotal for item in self.items)
    
    @computed_field
    @property
    def total_items(self) -> int:
        """合計アイテム数"""
        return sum(item.quantity for item in self.items)
    
    @model_validator(mode="after")
    def validate_payment_amount(self) -> "OrderModel":
        """決済金額チェック"""
        if abs(self.payment.amount - self.total_amount) > 0.01:
            raise ValueError("決済金額と注文合計金額が一致しません")
        return self


class OrderItemModel(BaseAPIModel):
    """注文アイテムモデル"""
    
    product_id: int = Field(gt=0, description="商品ID")
    product_name: str = Field(min_length=1, max_length=200, description="商品名")
    quantity: int = Field(gt=0, le=100, description="数量")
    unit_price: float = Field(gt=0, description="単価")
    
    @computed_field
    @property
    def subtotal(self) -> float:
        """小計計算"""
        return self.quantity * self.unit_price


# Forward reference の解決
OrderModel.model_rebuild()
```

## 🛠️ カスタムシリアライゼーション

### 高度なシリアライゼーションパターン

```python
# serializers/custom_serializers.py
from pydantic import BaseModel, Field, field_serializer, model_serializer
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timezone
from enum import Enum
import json


class APIResponse(BaseModel):
    """API レスポンスベースモデル"""
    success: bool = Field(default=True, description="成功フラグ")
    message: Optional[str] = Field(default=None, description="メッセージ")
    data: Optional[Any] = Field(default=None, description="データ")
    errors: Optional[List[str]] = Field(default=None, description="エラーリスト")
    meta: Optional[Dict[str, Any]] = Field(default=None, description="メタデータ")
    
    @field_serializer("data", when_used="json")
    def serialize_data(self, value: Any) -> Any:
        """データのカスタムシリアライゼーション"""
        if value is None:
            return None
        
        # Pydanticモデルの場合は辞書に変換
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        
        # リストの場合は各要素を処理
        if isinstance(value, list):
            return [
                item.model_dump(mode="json") if isinstance(item, BaseModel) else item
                for item in value
            ]
        
        return value


class PaginationMeta(BaseModel):
    """ページネーションメタデータ"""
    page: int = Field(ge=1, description="現在のページ番号")
    per_page: int = Field(ge=1, le=100, description="1ページあたりのアイテム数")
    total: int = Field(ge=0, description="総アイテム数")
    pages: int = Field(ge=0, description="総ページ数")
    has_prev: bool = Field(description="前のページが存在するか")
    has_next: bool = Field(description="次のページが存在するか")


class PaginatedResponse(APIResponse):
    """ページネーション付きレスポンス"""
    data: List[Any] = Field(description="データリスト")
    pagination: PaginationMeta = Field(description="ページネーション情報")
    
    @classmethod
    def create(
        cls,
        items: List[Any],
        page: int,
        per_page: int,
        total: int,
        message: Optional[str] = None
    ) -> "PaginatedResponse":
        """ページネーションレスポンス作成"""
        pages = (total + per_page - 1) // per_page
        
        pagination = PaginationMeta(
            page=page,
            per_page=per_page,
            total=total,
            pages=pages,
            has_prev=page > 1,
            has_next=page < pages
        )
        
        return cls(
            data=items,
            pagination=pagination,
            message=message,
            meta={
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "api_version": "v1"
            }
        )


class ConditionalSerializer(BaseModel):
    """条件付きシリアライゼーション"""
    
    user_id: int = Field(description="ユーザーID")
    username: str = Field(description="ユーザー名")
    email: str = Field(description="メールアドレス")
    is_admin: bool = Field(description="管理者フラグ")
    sensitive_data: Optional[str] = Field(default=None, description="機密データ")
    
    @model_serializer
    def serialize_model(self) -> Dict[str, Any]:
        """モデル全体のカスタムシリアライゼーション"""
        data = {
            "user_id": self.user_id,
            "username": self.username,
        }
        
        # 管理者の場合のみ追加情報を含める
        if self.is_admin:
            data.update({
                "email": self.email,
                "is_admin": self.is_admin,
                "sensitive_data": self.sensitive_data
            })
        
        return data


class MultiFormatSerializer(BaseModel):
    """マルチフォーマットシリアライゼーション"""
    
    name: str = Field(description="名前")
    created_at: datetime = Field(description="作成日時")
    tags: List[str] = Field(description="タグリスト")
    metadata: Dict[str, Any] = Field(description="メタデータ")
    
    @field_serializer("created_at", when_used="json")
    def serialize_datetime_json(self, value: datetime) -> str:
        """JSON用日時シリアライゼーション"""
        return value.isoformat()
    
    @field_serializer("created_at", when_used="python")
    def serialize_datetime_python(self, value: datetime) -> datetime:
        """Python用日時シリアライゼーション"""
        return value
    
    @field_serializer("tags", when_used="json")
    def serialize_tags_json(self, value: List[str]) -> str:
        """JSON用タグシリアライゼーション（カンマ区切り文字列）"""
        return ",".join(value)
    
    @field_serializer("metadata", when_used="json")
    def serialize_metadata_json(self, value: Dict[str, Any]) -> str:
        """JSON用メタデータシリアライゼーション"""
        return json.dumps(value, ensure_ascii=False)


class PerformanceOptimizedSerializer(BaseModel):
    """パフォーマンス最適化シリアライゼーション"""
    
    id: int
    name: str
    description: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    
    model_config = ConfigDict(
        # シリアライゼーション最適化
        ser_json_bytes="base64",        # バイナリデータ最適化
        ser_json_timedelta="float",     # 時間差最適化
        validate_assignment=False,       # 代入時バリデーション無効化（パフォーマンス向上）
        arbitrary_types_allowed=True,   # 任意型許可（必要に応じて）
    )
    
    @field_serializer("items", when_used="json")
    def serialize_items_optimized(self, value: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """最適化されたアイテムシリアライゼーション"""
        # 大量データの場合は必要なフィールドのみ抽出
        if len(value) > 1000:
            return [
                {"id": item.get("id"), "name": item.get("name")}
                for item in value
            ]
        return value


# シリアライゼーションユーティリティ
class SerializationUtils:
    """シリアライゼーションユーティリティ"""
    
    @staticmethod
    def serialize_for_api(
        data: Any,
        include_null: bool = False,
        exclude_fields: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """API用シリアライゼーション"""
        if isinstance(data, BaseModel):
            exclude_set = set(exclude_fields) if exclude_fields else None
            
            serialized = data.model_dump(
                mode="json",
                exclude=exclude_set,
                exclude_none=not include_null
            )
            
            return serialized
        
        return data
    
    @staticmethod
    def serialize_for_cache(data: Any) -> str:
        """キャッシュ用シリアライゼーション"""
        if isinstance(data, BaseModel):
            return data.model_dump_json()
        
        return json.dumps(data, ensure_ascii=False, default=str)
    
    @staticmethod
    def serialize_for_logging(data: Any, max_length: int = 1000) -> str:
        """ログ用シリアライゼーション（機密情報をマスク）"""
        if isinstance(data, BaseModel):
            # 機密フィールドをマスク
            sensitive_fields = ["password", "token", "secret", "key"]
            
            serialized = data.model_dump()
            for field in sensitive_fields:
                if field in serialized:
                    serialized[field] = "***MASKED***"
            
            json_str = json.dumps(serialized, ensure_ascii=False, default=str)
        else:
            json_str = json.dumps(data, ensure_ascii=False, default=str)
        
        # 長さ制限
        if len(json_str) > max_length:
            json_str = json_str[:max_length] + "...[truncated]"
        
        return json_str
```

## 🧪 テストとバリデーション

### 包括的テスト戦略

```python
# tests/test_validation.py
import pytest
from pydantic import ValidationError
from datetime import datetime, date, timezone
from models.user import UserCreate, UserUpdate, UserResponse
from models.complex_validation import PaymentModel, OrderModel, OrderItemModel


class TestUserValidation:
    """ユーザーバリデーションテスト"""
    
    def test_valid_user_creation(self):
        """有効なユーザー作成テスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "birth_date": "1990-01-01",
            "phone": "090-1234-5678"
        }
        
        user = UserCreate(**user_data)
        
        assert user.username == "test_user"
        assert user.email == "test@example.com"
        assert user.full_name == "ユーザー テスト"
        assert user.age == 34  # 2024年基準
    
    def test_invalid_password(self):
        """無効なパスワードテスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "weak",  # 弱いパスワード
            "password_confirm": "weak"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)
        
        errors = exc_info.value.errors()
        assert any("パスワードは8文字以上" in str(error) for error in errors)
    
    def test_password_mismatch(self):
        """パスワード不一致テスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "DifferentPass123!"
        }
        
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)
        
        errors = exc_info.value.errors()
        assert any("パスワードが一致しません" in str(error) for error in errors)
    
    def test_invalid_email(self):
        """無効なメールアドレステスト"""
        user_data = {
            "username": "test_user",
            "email": "invalid-email",  # 無効なメール
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!"
        }
        
        with pytest.raises(ValidationError):
            UserCreate(**user_data)
    
    def test_invalid_birth_date(self):
        """無効な生年月日テスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "birth_date": "2030-01-01"  # 未来の日付
        }
        
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)
        
        errors = exc_info.value.errors()
        assert any("今日より前の日付" in str(error) for error in errors)
    
    def test_underage_user(self):
        """未成年ユーザーテスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "birth_date": "2020-01-01"  # 4歳
        }
        
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)
        
        errors = exc_info.value.errors()
        assert any("13歳以上である必要があります" in str(error) for error in errors)


class TestPaymentValidation:
    """決済バリデーションテスト"""
    
    def test_valid_payment(self):
        """有効な決済テスト"""
        payment_data = {
            "amount": 1000.0,
            "currency": "JPY",
            "card_number": "4111111111111111",  # テスト用Visaカード
            "card_holder_name": "TARO TANAKA",
            "expiry_month": 12,
            "expiry_year": 2025,
            "cvv": "123",
            "billing_address": {
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            }
        }
        
        payment = PaymentModel(**payment_data)
        
        assert payment.amount == 1000.0
        assert payment.card_number == "4111111111111111"
        assert payment.billing_address["postal_code"] == "150-0001"
    
    def test_invalid_card_number(self):
        """無効なカード番号テスト"""
        payment_data = {
            "amount": 1000.0,
            "currency": "JPY",
            "card_number": "1234567890123456",  # 無効なカード番号
            "card_holder_name": "TARO TANAKA",
            "expiry_month": 12,
            "expiry_year": 2025,
            "cvv": "123",
            "billing_address": {
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            }
        }
        
        with pytest.raises(ValidationError) as exc_info:
            PaymentModel(**payment_data)
        
        errors = exc_info.value.errors()
        assert any("無効なクレジットカード番号" in str(error) for error in errors)
    
    def test_expired_card(self):
        """期限切れカードテスト"""
        payment_data = {
            "amount": 1000.0,
            "currency": "JPY",
            "card_number": "4111111111111111",
            "card_holder_name": "TARO TANAKA",
            "expiry_month": 1,
            "expiry_year": 2020,  # 期限切れ
            "cvv": "123",
            "billing_address": {
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            }
        }
        
        with pytest.raises(ValidationError) as exc_info:
            PaymentModel(**payment_data)
        
        errors = exc_info.value.errors()
        assert any("有効期限が切れています" in str(error) for error in errors)


class TestOrderValidation:
    """注文バリデーションテスト"""
    
    def test_valid_order(self):
        """有効な注文テスト"""
        order_data = {
            "order_id": "ORD-20240101-0001",
            "customer_id": 1,
            "items": [
                {
                    "product_id": 1,
                    "product_name": "テスト商品",
                    "quantity": 2,
                    "unit_price": 500.0
                }
            ],
            "shipping_address": {
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            },
            "payment": {
                "amount": 1000.0,
                "currency": "JPY",
                "card_number": "4111111111111111",
                "card_holder_name": "TARO TANAKA",
                "expiry_month": 12,
                "expiry_year": 2025,
                "cvv": "123",
                "billing_address": {
                    "street": "1-1-1 Tokyo",
                    "city": "Shibuya",
                    "postal_code": "150-0001",
                    "country": "JP"
                }
            }
        }
        
        order = OrderModel(**order_data)
        
        assert order.total_amount == 1000.0
        assert order.total_items == 2
        assert order.payment.amount == order.total_amount
    
    def test_payment_amount_mismatch(self):
        """決済金額不一致テスト"""
        order_data = {
            "order_id": "ORD-20240101-0001",
            "customer_id": 1,
            "items": [
                {
                    "product_id": 1,
                    "product_name": "テスト商品",
                    "quantity": 2,
                    "unit_price": 500.0
                }
            ],
            "shipping_address": {
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            },
            "payment": {
                "amount": 1500.0,  # 合計金額と不一致
                "currency": "JPY",
                "card_number": "4111111111111111",
                "card_holder_name": "TARO TANAKA",
                "expiry_month": 12,
                "expiry_year": 2025,
                "cvv": "123",
                "billing_address": {
                    "street": "1-1-1 Tokyo",
                    "city": "Shibuya",
                    "postal_code": "150-0001",
                    "country": "JP"
                }
            }
        }
        
        with pytest.raises(ValidationError) as exc_info:
            OrderModel(**order_data)
        
        errors = exc_info.value.errors()
        assert any("決済金額と注文合計金額が一致しません" in str(error) for error in errors)


# パフォーマンステスト
class TestPerformance:
    """パフォーマンステスト"""
    
    def test_bulk_validation_performance(self):
        """バルクバリデーションパフォーマンステスト"""
        import time
        
        user_data_template = {
            "username": "test_user_{}",
            "email": "test{}@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!"
        }
        
        start_time = time.time()
        
        # 1000件のユーザーバリデーション
        users = []
        for i in range(1000):
            user_data = {
                **user_data_template,
                "username": user_data_template["username"].format(i),
                "email": user_data_template["email"].format(i)
            }
            users.append(UserCreate(**user_data))
        
        end_time = time.time()
        
        # 1000件のバリデーションが1秒以内に完了することを確認
        assert end_time - start_time < 1.0
        assert len(users) == 1000
    
    def test_serialization_performance(self):
        """シリアライゼーションパフォーマンステスト"""
        import time
        
        # 大量データ作成
        users = []
        for i in range(1000):
            user = UserResponse(
                id=i,
                uuid=f"550e8400-e29b-41d4-a716-44665544{i:04d}",
                username=f"user{i}",
                email=f"user{i}@example.com",
                first_name="テスト",
                last_name="ユーザー",
                role="user",
                status="active",
                is_verified=True,
                is_active=True
            )
            users.append(user)
        
        start_time = time.time()
        
        # JSON シリアライゼーション
        serialized = [user.model_dump(mode="json") for user in users]
        
        end_time = time.time()
        
        # 1000件のシリアライゼーションが0.5秒以内に完了することを確認
        assert end_time - start_time < 0.5
        assert len(serialized) == 1000


if __name__ == "__main__":
    pytest.main([__file__])
```

このPydantic v2 Data Validationパターン集は、最新のPydantic v2機能を最大限活用した高度なデータバリデーション・シリアライゼーション実装を提供します。型安全性、パフォーマンス、拡張性を重視し、実際のプロダクション環境で使用可能な包括的なソリューションを実現しています。