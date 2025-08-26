# Pydantic v2 カスタムシリアライゼーション

## 📤 APIレスポンスシリアライゼーション

```python
# serializers/custom_serializers.py
from pydantic import BaseModel, Field, field_serializer, model_serializer, ConfigDict
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
```

## 📄 ページネーションレスポンス

```python
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
```

## 🔐 条件付きシリアライゼーション

```python
class ConditionalSerializer(BaseModel):
    """条件付きシリアライゼーション"""
    
    user_id: int = Field(description="ユーザーID")
    username: str = Field(description="ユーザー名")
    email: str = Field(description="メールアドレス")
    is_admin: bool = Field(description="管理者フラグ")
    sensitive_data: Optional[str] = Field(default=None, description="機密データ")
    internal_notes: Optional[str] = Field(default=None, description="内部メモ")
    
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
                "sensitive_data": self.sensitive_data,
                "internal_notes": self.internal_notes
            })
        else:
            # 一般ユーザーには最小限の情報のみ
            data["email"] = self.email.split("@")[0] + "@***"  # メールアドレスをマスク
        
        return data
```

## 🎨 マルチフォーマットシリアライゼーション

```python
class MultiFormatSerializer(BaseModel):
    """マルチフォーマットシリアライゼーション"""
    
    name: str = Field(description="名前")
    created_at: datetime = Field(description="作成日時")
    tags: List[str] = Field(description="タグリスト")
    metadata: Dict[str, Any] = Field(description="メタデータ")
    price: float = Field(description="価格")
    
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
    
    @field_serializer("price")
    def serialize_price(self, value: float) -> str:
        """価格フォーマット（通貨記号付き）"""
        return f"¥{value:,.0f}"
```

## ⚡ パフォーマンス最適化シリアライザー

```python
class PerformanceOptimizedSerializer(BaseModel):
    """パフォーマンス最適化シリアライゼーション"""
    
    id: int
    name: str
    description: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    cached_data: Optional[Any] = None
    
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
    
    @field_serializer("cached_data")
    def serialize_cached_data(self, value: Any) -> Optional[str]:
        """キャッシュデータのシリアライゼーション"""
        if value is None:
            return None
        
        # キャッシュキーのみ返す（実データは外部ストレージ）
        if hasattr(value, "__cache_key__"):
            return value.__cache_key__
        
        # それ以外は省略
        return "[cached]"
```

## 🛠️ シリアライゼーションユーティリティ

```python
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
            sensitive_fields = ["password", "token", "secret", "key", "cvv"]
            
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
    
    @staticmethod
    def serialize_for_export(
        data: Union[BaseModel, List[BaseModel]],
        format: str = "json"
    ) -> str:
        """エクスポート用シリアライゼーション"""
        if format == "json":
            if isinstance(data, list):
                return json.dumps(
                    [item.model_dump(mode="json") for item in data],
                    ensure_ascii=False,
                    indent=2
                )
            return data.model_dump_json(indent=2)
        
        elif format == "csv":
            # CSV形式でのエクスポート
            import csv
            import io
            
            if not isinstance(data, list):
                data = [data]
            
            if not data:
                return ""
            
            output = io.StringIO()
            fieldnames = list(data[0].model_dump().keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            
            writer.writeheader()
            for item in data:
                writer.writerow(item.model_dump())
            
            return output.getvalue()
        
        else:
            raise ValueError(f"Unsupported format: {format}")
```

## 💡 ベストプラクティス

1. **when_used パラメータ**: JSON/Python で異なるシリアライゼーション
2. **model_serializer**: モデル全体のカスタマイズ
3. **field_serializer**: フィールド単位のカスタマイズ
4. **パフォーマンス考慮**: 大量データの場合は必要最小限のフィールド
5. **セキュリティ**: 機密情報のマスキング

## 🚀 使用例

```python
# APIレスポンス作成
response = APIResponse(
    success=True,
    message="データ取得成功",
    data={"user_id": 1, "name": "田中太郎"},
    meta={"request_id": "req-123"}
)

# ページネーションレスポンス
paginated = PaginatedResponse.create(
    items=[{"id": i, "name": f"Item {i}"} for i in range(10)],
    page=1,
    per_page=10,
    total=100
)

# ログ用シリアライゼーション
user_data = ConditionalSerializer(
    user_id=1,
    username="admin",
    email="admin@example.com",
    is_admin=True,
    sensitive_data="secret"
)
log_output = SerializationUtils.serialize_for_logging(user_data)
print(f"Log: {log_output}")
```