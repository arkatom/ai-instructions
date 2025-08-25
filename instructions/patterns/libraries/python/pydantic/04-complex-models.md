# Pydantic v2 複雑なモデル実装

## 💳 決済モデル

```python
# models/complex_validation.py
from pydantic import BaseModel, Field, field_validator, model_validator, computed_field
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date, time, timezone
from .base import BaseAPIModel
from .validators import BusinessRuleValidator
import re


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
```

## 🛒 注文モデル（ネストしたバリデーション）

```python
class OrderItemModel(BaseAPIModel):
    """注文アイテムモデル"""
    
    product_id: int = Field(gt=0, description="商品ID")
    product_name: str = Field(min_length=1, max_length=200, description="商品名")
    quantity: int = Field(gt=0, le=100, description="数量")
    unit_price: float = Field(gt=0, description="単価")
    discount_rate: float = Field(ge=0, le=1, default=0, description="割引率")
    tax_rate: float = Field(ge=0, le=1, default=0.1, description="税率")
    
    @computed_field
    @property
    def subtotal(self) -> float:
        """小計計算（割引適用後）"""
        return self.quantity * self.unit_price * (1 - self.discount_rate)
    
    @computed_field
    @property
    def tax_amount(self) -> float:
        """税額計算"""
        return self.subtotal * self.tax_rate
    
    @computed_field
    @property
    def total(self) -> float:
        """合計金額（税込）"""
        return self.subtotal + self.tax_amount


class OrderModel(BaseAPIModel):
    """注文モデル - ネストしたバリデーション例"""
    
    order_id: str = Field(pattern=r"^ORD-\d{8}-\d{4}$", description="注文ID")
    customer_id: int = Field(gt=0, description="顧客ID")
    items: List[OrderItemModel] = Field(min_length=1, description="注文アイテム")
    shipping_address: Dict[str, str] = Field(description="配送先住所")
    payment: PaymentModel = Field(description="決済情報")
    order_date: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="注文日時"
    )
    shipping_method: str = Field(
        pattern=r"^(standard|express|overnight)$",
        default="standard",
        description="配送方法"
    )
    notes: Optional[str] = Field(default=None, max_length=1000, description="備考")
    
    @computed_field
    @property
    def total_amount(self) -> float:
        """合計金額計算"""
        return sum(item.total for item in self.items)
    
    @computed_field
    @property
    def total_items(self) -> int:
        """合計アイテム数"""
        return sum(item.quantity for item in self.items)
    
    @computed_field
    @property
    def shipping_fee(self) -> float:
        """配送料計算"""
        base_fee = {
            "standard": 500,
            "express": 1000,
            "overnight": 2000
        }
        fee = base_fee.get(self.shipping_method, 500)
        
        # 1万円以上は送料無料
        if self.total_amount >= 10000:
            fee = 0
        
        return fee
    
    @computed_field
    @property
    def grand_total(self) -> float:
        """総合計（送料込み）"""
        return self.total_amount + self.shipping_fee
    
    @model_validator(mode="after")
    def validate_payment_amount(self) -> "OrderModel":
        """決済金額チェック"""
        if abs(self.payment.amount - self.grand_total) > 0.01:
            raise ValueError(
                f"決済金額（{self.payment.amount}）と"
                f"注文合計金額（{self.grand_total}）が一致しません"
            )
        return self
    
    @model_validator(mode="after")
    def validate_shipping_address(self) -> "OrderModel":
        """配送先住所検証"""
        required_fields = ["name", "street", "city", "postal_code", "country"]
        
        for field in required_fields:
            if field not in self.shipping_address:
                raise ValueError(f"配送先住所に{field}が必要です")
        
        # 日本の郵便番号検証
        if self.shipping_address.get("country") == "JP":
            postal_code = self.shipping_address["postal_code"]
            self.shipping_address["postal_code"] = BusinessRuleValidator.validate_japanese_postal_code(postal_code)
        
        return self


# Forward reference の解決
OrderModel.model_rebuild()
```

## 📊 レポートモデル（集計・統計）

```python
class SalesReportModel(BaseAPIModel):
    """売上レポートモデル"""
    
    report_date: date = Field(description="レポート日付")
    orders: List[OrderModel] = Field(description="注文リスト")
    
    @computed_field
    @property
    def total_orders(self) -> int:
        """総注文数"""
        return len(self.orders)
    
    @computed_field
    @property
    def total_revenue(self) -> float:
        """総売上"""
        return sum(order.grand_total for order in self.orders)
    
    @computed_field
    @property
    def average_order_value(self) -> float:
        """平均注文金額"""
        if self.total_orders == 0:
            return 0
        return self.total_revenue / self.total_orders
    
    @computed_field
    @property
    def total_items_sold(self) -> int:
        """総販売アイテム数"""
        return sum(order.total_items for order in self.orders)
    
    @computed_field
    @property
    def payment_method_breakdown(self) -> Dict[str, int]:
        """決済方法別内訳"""
        breakdown = {}
        for order in self.orders:
            # カード番号から判定したカードタイプを集計
            card_type = "Unknown"
            if order.payment.card_number.startswith("4"):
                card_type = "Visa"
            elif order.payment.card_number.startswith(("51", "52", "53", "54", "55")):
                card_type = "MasterCard"
            
            breakdown[card_type] = breakdown.get(card_type, 0) + 1
        
        return breakdown
    
    @computed_field
    @property
    def shipping_method_breakdown(self) -> Dict[str, Dict[str, Any]]:
        """配送方法別内訳"""
        breakdown = {}
        
        for order in self.orders:
            method = order.shipping_method
            if method not in breakdown:
                breakdown[method] = {
                    "count": 0,
                    "revenue": 0,
                    "shipping_fees": 0
                }
            
            breakdown[method]["count"] += 1
            breakdown[method]["revenue"] += order.grand_total
            breakdown[method]["shipping_fees"] += order.shipping_fee
        
        return breakdown
```

## 🔄 状態遷移モデル

```python
from enum import Enum

class OrderStatus(str, Enum):
    """注文ステータス"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class OrderStateTransition(BaseAPIModel):
    """注文状態遷移モデル"""
    
    order_id: str = Field(description="注文ID")
    current_status: OrderStatus = Field(description="現在のステータス")
    new_status: OrderStatus = Field(description="新しいステータス")
    reason: Optional[str] = Field(default=None, description="変更理由")
    
    # 有効な状態遷移を定義
    VALID_TRANSITIONS = {
        OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        OrderStatus.PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        OrderStatus.SHIPPED: [OrderStatus.DELIVERED],
        OrderStatus.DELIVERED: [OrderStatus.REFUNDED],
        OrderStatus.CANCELLED: [],
        OrderStatus.REFUNDED: []
    }
    
    @model_validator(mode="after")
    def validate_state_transition(self) -> "OrderStateTransition":
        """状態遷移の妥当性検証"""
        valid_next_states = self.VALID_TRANSITIONS.get(self.current_status, [])
        
        if self.new_status not in valid_next_states:
            raise ValueError(
                f"{self.current_status} から {self.new_status} への"
                f"遷移は許可されていません。"
                f"有効な遷移: {', '.join(valid_next_states)}"
            )
        
        # キャンセル・返金時は理由必須
        if self.new_status in [OrderStatus.CANCELLED, OrderStatus.REFUNDED]:
            if not self.reason:
                raise ValueError(f"{self.new_status} には理由が必要です")
        
        return self
```

## 💡 実装のポイント

1. **ネストしたモデル**: 複雑な構造を階層的に管理
2. **computed_field**: ビジネスロジックをモデルに統合
3. **相互依存の検証**: model_validatorで複数フィールド間の整合性確認
4. **Forward Reference**: 循環参照を解決
5. **状態管理**: Enumと遷移ルールで安全な状態管理

## 🚀 使用例

```python
# 注文作成
order = OrderModel(
    order_id="ORD-20240101-0001",
    customer_id=123,
    items=[
        OrderItemModel(
            product_id=1,
            product_name="Python Book",
            quantity=2,
            unit_price=3000
        )
    ],
    shipping_address={
        "name": "田中太郎",
        "street": "渋谷1-1-1",
        "city": "渋谷区",
        "postal_code": "150-0001",
        "country": "JP"
    },
    payment=PaymentModel(
        amount=6600,  # 商品6000円 + 送料600円
        card_number="4111111111111111",
        card_holder_name="TARO TANAKA",
        expiry_month=12,
        expiry_year=2025,
        cvv="123",
        billing_address={
            "street": "渋谷1-1-1",
            "city": "渋谷区",
            "postal_code": "150-0001",
            "country": "JP"
        }
    )
)

print(f"総合計: {order.grand_total}円")
print(f"送料: {order.shipping_fee}円")
```