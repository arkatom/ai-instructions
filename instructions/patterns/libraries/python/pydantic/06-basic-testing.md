# Pydantic v2 基本テスト戦略

## 🧪 包括的テスト戦略

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
```

## 💳 決済バリデーションテスト

```python
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
```

## 🛒 注文バリデーションテスト

```python
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
                "name": "田中太郎",
                "street": "1-1-1 Tokyo",
                "city": "Shibuya",
                "postal_code": "150-0001",
                "country": "JP"
            },
            "payment": {
                "amount": 1100.0,  # 商品1000円 + 税100円
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
        
        assert order.total_amount == 1100.0
        assert order.total_items == 2
        assert order.payment.amount == order.grand_total
```

## 💡 テストのベストプラクティス

1. **正常系と異常系**: 両方のケースを網羅的にテスト
2. **エラーメッセージ**: 具体的で分かりやすいメッセージの確認
3. **データの整合性**: 複数フィールド間の関係性を検証
4. **バリデーション順序**: フィールド→モデル全体の順で検証
5. **テストデータ**: 実際のユースケースに近いデータを使用

## 🚀 テスト実行

```bash
# 全テスト実行
pytest tests/

# 特定のテストクラス実行
pytest tests/test_validation.py::TestUserValidation

# カバレッジ付きテスト
pytest --cov=models tests/

# 詳細出力
pytest -v tests/
```