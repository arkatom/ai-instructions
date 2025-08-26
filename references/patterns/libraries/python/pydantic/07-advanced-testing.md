# Pydantic v2 高度なテスト戦略

## ⚡ パフォーマンステスト

```python
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
    
    def test_nested_model_performance(self):
        """ネストしたモデルのパフォーマンステスト"""
        import time
        
        start_time = time.time()
        
        # 複雑な注文データの作成
        orders = []
        for i in range(100):
            order_data = {
                "order_id": f"ORD-20240101-{i:04d}",
                "customer_id": i,
                "items": [
                    {
                        "product_id": j,
                        "product_name": f"Product {j}",
                        "quantity": 1,
                        "unit_price": 1000.0
                    }
                    for j in range(10)  # 各注文に10アイテム
                ],
                "shipping_address": {
                    "name": f"Customer {i}",
                    "street": "1-1-1 Tokyo",
                    "city": "Shibuya",
                    "postal_code": "150-0001",
                    "country": "JP"
                },
                "payment": {
                    "amount": 11000.0,  # 10000 + 税
                    "currency": "JPY",
                    "card_number": "4111111111111111",
                    "card_holder_name": f"CUSTOMER {i}",
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
            orders.append(OrderModel(**order_data))
        
        end_time = time.time()
        
        # 100件の複雑な注文バリデーションが2秒以内に完了
        assert end_time - start_time < 2.0
        assert len(orders) == 100
```

## 🔍 エッジケーステスト

```python
class TestEdgeCases:
    """エッジケーステスト"""
    
    def test_boundary_values(self):
        """境界値テスト"""
        # 最小値
        min_user = UserCreate(
            username="abc",  # 最小3文字
            email="a@b.c",
            first_name="あ",  # 最小1文字
            last_name="い",
            password="Pass123!",  # 最小8文字
            password_confirm="Pass123!"
        )
        assert min_user.username == "abc"
        
        # 最大値
        max_user = UserCreate(
            username="a" * 50,  # 最大50文字
            email="test@example.com",
            first_name="あ" * 50,  # 最大50文字
            last_name="い" * 50,
            password="P" * 127 + "!",  # 最大128文字
            password_confirm="P" * 127 + "!"
        )
        assert len(max_user.username) == 50
    
    def test_unicode_handling(self):
        """Unicode文字処理テスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "太郎😀",  # 絵文字を含む
            "last_name": "田中🎌",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "bio": "こんにちは👋 プログラマーです💻"
        }
        
        user = UserCreate(**user_data)
        assert "😀" in user.first_name
        assert "🎌" in user.last_name
    
    def test_null_optional_fields(self):
        """NULL許容フィールドテスト"""
        user_data = {
            "username": "test_user",
            "email": "test@example.com",
            "first_name": "テスト",
            "last_name": "ユーザー",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            # Optional fields are None
            "display_name": None,
            "bio": None,
            "birth_date": None,
            "phone": None,
            "website": None
        }
        
        user = UserCreate(**user_data)
        assert user.display_name is None
        assert user.bio is None
        assert user.age is None  # birth_dateがNoneなので
    
    def test_payment_amount_mismatch(self):
        """決済金額不一致の詳細テスト"""
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
        assert any("決済金額" in str(error) for error in errors)
```

## 🏁 パフォーマンス最適化のポイント

1. **validate_assignment=False**: 頻繁な代入がある場合は無効化
2. **キャッシング**: computed_fieldの結果をキャッシュ
3. **遅延評価**: 必要な時だけバリデーション実行
4. **バッチ処理**: 大量データは一括処理
5. **プロファイリング**: ボトルネックの特定と最適化

## 📊 ベンチマーク基準

| 処理内容 | 件数 | 目標時間 |
|---------|-----|---------|
| 単純バリデーション | 1000件 | < 1秒 |
| JSON シリアライゼーション | 1000件 | < 0.5秒 |
| 複雑なネストモデル | 100件 | < 2秒 |
| computed_field計算 | 1000件 | < 0.3秒 |

## 🧪 統合テスト例

```python
async def test_end_to_end_flow():
    """エンドツーエンドフローテスト"""
    # 1. ユーザー作成
    user_create = UserCreate(
        username="integration_test",
        email="integration@test.com",
        first_name="統合",
        last_name="テスト",
        password="IntegrationTest123!",
        password_confirm="IntegrationTest123!"
    )
    
    # 2. バリデーション成功確認
    assert user_create.username == "integration_test"
    
    # 3. レスポンスモデルへの変換
    user_response = UserResponse(
        **user_create.model_dump(exclude={"password", "password_confirm"}),
        id=1,
        uuid="550e8400-e29b-41d4-a716-446655440000",
        role="user",
        status="active",
        is_verified=False,
        is_active=True
    )
    
    # 4. シリアライゼーション
    json_data = user_response.model_dump_json()
    assert "integration_test" in json_data
    
    # 5. デシリアライゼーション
    restored_user = UserResponse.model_validate_json(json_data)
    assert restored_user.username == user_response.username
```

## 🚀 継続的テスト戦略

```bash
# CI/CDパイプライン用テストコマンド
# リンティング
flake8 models/ tests/

# 型チェック
mypy models/ tests/

# ユニットテスト
pytest tests/unit/ -v

# 統合テスト
pytest tests/integration/ -v

# パフォーマンステスト
pytest tests/performance/ -v --benchmark-only

# フルテストスイート
pytest tests/ --cov=models --cov-report=html
```