# Django REST Framework - テスト戦略

## APIテスト基盤 {#api-testing}

```python
# tests/test_api.py
import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from django.core.cache import cache
from unittest.mock import patch, Mock
from decimal import Decimal
import json

User = get_user_model()

class BaseAPITestCase(APITestCase):
    """APIテストのベースクラス"""
    
    @classmethod
    def setUpTestData(cls):
        """テストデータセットアップ"""
        cls.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword123'
        )
        cls.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpassword123',
            is_staff=True
        )
        
        # テスト用テナント
        cls.tenant = Tenant.objects.create(name='Test Tenant')
        cls.user.tenant = cls.tenant
        cls.user.save()
    
    def setUp(self):
        """各テストの前処理"""
        self.client = APIClient()
        cache.clear()  # キャッシュをクリア
    
    def authenticate_user(self, user=None):
        """ユーザー認証"""
        user = user or self.user
        self.client.force_authenticate(user=user)
    
    def authenticate_admin(self):
        """管理者認証"""
        self.client.force_authenticate(user=self.admin_user)
```

## 統合テスト実装

```python
@pytest.mark.django_db
class ProductAPITestCase(BaseAPITestCase):
    """製品API統合テスト"""
    
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # テスト用カテゴリー
        cls.category = Category.objects.create(
            name='Electronics',
            tax_rate=Decimal('0.10')
        )
        
        # テスト用製品
        cls.product = Product.objects.create(
            name='Test Product',
            description='Test Description',
            sku='TEST001',
            price=Decimal('100.00'),
            category=cls.category,
            stock_quantity=50,
            tenant=cls.tenant,
            created_by=cls.user
        )
    
    def test_product_list_authenticated(self):
        """認証済みユーザーのリストアクセステスト"""
        self.authenticate_user()
        url = reverse('product-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Test Product')
    
    def test_product_create_valid_data(self):
        """有効なデータでの製品作成テスト"""
        self.authenticate_user()
        url = reverse('product-list')
        data = {
            'name': 'New Product',
            'description': 'New Description',
            'sku': 'NEW001',
            'price': '150.00',
            'category': self.category.id,
            'stock_quantity': 25
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.count(), 2)
        
        created_product = Product.objects.get(sku='NEW001')
        self.assertEqual(created_product.tenant, self.tenant)
        self.assertEqual(created_product.created_by, self.user)
    
    def test_product_create_invalid_data(self):
        """無効なデータでの製品作成テスト"""
        self.authenticate_user()
        url = reverse('product-list')
        data = {
            'name': '',  # 必須フィールドが空
            'sku': 'TEST001',  # 重複SKU
            'price': '-10.00',  # 負の価格
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)
        self.assertIn('sku', response.data)
        self.assertIn('price', response.data)
```

## モック戦略 {#mocking}

```python
def test_stock_check_action(self):
    """在庫チェックアクションテスト"""
    self.authenticate_user()
    url = reverse('product-check-stock', kwargs={'pk': self.product.id})
    
    with patch('apps.services.StockService.check_availability') as mock_check:
        mock_check.return_value = True
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['in_stock'])
        self.assertEqual(response.data['quantity'], 50)
        mock_check.assert_called_once_with(self.product)

def test_bulk_price_update(self):
    """バルク価格更新テスト"""
    self.authenticate_admin()
    url = reverse('product-bulk-price-update')
    
    # 追加製品作成
    product2 = Product.objects.create(
        name='Product 2',
        sku='TEST002',
        price=Decimal('200.00'),
        category=self.category,
        tenant=self.tenant,
        created_by=self.user
    )
    
    data = [
        {'id': self.product.id, 'price': '120.00'},
        {'id': product2.id, 'price': '250.00'}
    ]
    
    response = self.client.post(url, data, format='json')
    
    self.assertEqual(response.status_code, status.HTTP_200_OK)
    self.assertEqual(response.data['updated_count'], 2)
    
    # 価格が更新されているか確認
    self.product.refresh_from_db()
    product2.refresh_from_db()
    self.assertEqual(self.product.price, Decimal('120.00'))
    self.assertEqual(product2.price, Decimal('250.00'))
```

## キャッシュテスト

```python
class ProductCacheTestCase(BaseAPITestCase):
    """製品APIキャッシュテスト"""
    
    def test_list_cache_behavior(self):
        """リストキャッシュの動作テスト"""
        self.authenticate_user()
        url = reverse('product-list')
        
        # 初回リクエスト
        with self.assertNumQueries(5):  # 期待されるクエリ数
            response1 = self.client.get(url)
        
        # キャッシュからの取得（クエリ数が減少するはず）
        with self.assertNumQueries(2):  # 認証のみのクエリ
            response2 = self.client.get(url)
        
        self.assertEqual(response1.data, response2.data)
    
    def test_cache_invalidation_on_update(self):
        """更新時のキャッシュ無効化テスト"""
        list_url = reverse('product-list')
        detail_url = reverse('product-detail', kwargs={'pk': self.product.id})
        
        # キャッシュを生成
        self.client.get(list_url)
        self.client.get(detail_url)
        
        # 製品を更新
        self.client.patch(detail_url, {'name': 'Updated Name'}, format='json')
        
        # キャッシュが無効化されているか確認
        response = self.client.get(detail_url)
        self.assertEqual(response.data['name'], 'Updated Name')
```

## パフォーマンステスト {#performance-testing}

```python
class ProductPerformanceTestCase(BaseAPITestCase):
    """製品APIパフォーマンステスト"""
    
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        
        # 大量データ作成
        category = Category.objects.create(name='Performance Test')
        products = []
        for i in range(100):
            products.append(Product(
                name=f'Product {i}',
                sku=f'PERF{i:03d}',
                price=Decimal(f'{10 + i}.00'),
                category=category,
                tenant=cls.tenant,
                created_by=cls.user
            ))
        Product.objects.bulk_create(products)
    
    def test_list_query_count(self):
        """リスト取得のクエリ数テスト"""
        self.authenticate_user()
        url = reverse('product-list')
        
        # N+1問題が発生していないかチェック
        with self.assertNumQueries(5):  # 固定のクエリ数
            response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 20)  # ページサイズ

    def test_list_response_time(self):
        """リスト取得のレスポンス時間テスト"""
        import time
        
        self.authenticate_user()
        url = reverse('product-list')
        
        start_time = time.time()
        response = self.client.get(url)
        end_time = time.time()
        
        response_time = end_time - start_time
        self.assertLess(response_time, 1.0)  # 1秒以内
        self.assertEqual(response.status_code, status.HTTP_200_OK)
```