# Django REST Framework - 企業レベルパターン集

> エンタープライズアプリケーション向けDjango REST Frameworkの実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **Django**: 5.0+, DRF: 3.15+

## 🎯 中核パターン

### 1. エンタープライズAPI設計パターン

```python
# apps/api/v1/views.py
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from drf_spectacular.utils import extend_schema, OpenApiParameter
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class BaseEnterpriseViewSet(viewsets.ModelViewSet):
    """
    企業向けベースViewSet
    共通の認証、権限、フィルタリング、ページネーション機能を提供
    """
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    def get_queryset(self):
        """
        テナント分離とパフォーマンス最適化を適用
        """
        queryset = super().get_queryset()
        
        # テナント分離（マルチテナント対応）
        if hasattr(self.request.user, 'tenant'):
            queryset = queryset.filter(tenant=self.request.user.tenant)
        
        # Soft delete対応
        if hasattr(queryset.model, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        
        return queryset.select_related().prefetch_related()
    
    def perform_create(self, serializer):
        """作成時の共通処理"""
        instance = serializer.save(
            created_by=self.request.user,
            tenant=getattr(self.request.user, 'tenant', None)
        )
        logger.info(f"Created {instance.__class__.__name__} {instance.id}")
        
    def perform_update(self, serializer):
        """更新時の共通処理"""
        instance = serializer.save(updated_by=self.request.user)
        logger.info(f"Updated {instance.__class__.__name__} {instance.id}")
    
    def perform_destroy(self, instance):
        """論理削除の実装"""
        if hasattr(instance, 'is_deleted'):
            instance.is_deleted = True
            instance.deleted_by = self.request.user
            instance.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])
        else:
            instance.delete()
        logger.info(f"Deleted {instance.__class__.__name__} {instance.id}")

# 具体的なViewSet実装例
class ProductViewSet(BaseEnterpriseViewSet):
    """製品管理ViewSet"""
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filterset_fields = ['category', 'status', 'price_range']
    search_fields = ['name', 'description', 'sku']
    ordering_fields = ['created_at', 'price', 'name']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """アクションに応じてシリアライザーを切り替え"""
        if self.action == 'list':
            return ProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ProductWriteSerializer
        return ProductDetailSerializer
    
    @extend_schema(
        summary="製品の在庫チェック",
        responses={200: {"type": "object", "properties": {"in_stock": {"type": "boolean"}}}},
    )
    @action(detail=True, methods=['get'])
    def check_stock(self, request, pk=None):
        """在庫状況をチェック"""
        product = self.get_object()
        stock_service = StockService()
        
        try:
            in_stock = stock_service.check_availability(product)
            return Response({'in_stock': in_stock, 'quantity': product.stock_quantity})
        except Exception as e:
            logger.error(f"Stock check failed for product {pk}: {e}")
            return Response(
                {'error': 'Stock check failed'}, 
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
    
    @extend_schema(
        summary="バルク価格更新",
        request={"type": "array", "items": {"type": "object"}},
        responses={200: {"type": "object"}}
    )
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def bulk_price_update(self, request):
        """複数製品の価格を一括更新"""
        from django.db import transaction
        
        serializer = BulkPriceUpdateSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        
        updated_count = 0
        with transaction.atomic():
            for item in serializer.validated_data:
                try:
                    product = Product.objects.get(id=item['id'])
                    product.price = item['price']
                    product.save(update_fields=['price', 'updated_at'])
                    updated_count += 1
                except Product.DoesNotExist:
                    continue
        
        return Response({'updated_count': updated_count})
```

### 2. 高度なシリアライザーパターン

```python
# apps/api/serializers.py
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from typing import Dict, Any, Optional
import datetime

User = get_user_model()

class DynamicFieldsModelSerializer(serializers.ModelSerializer):
    """
    フィールドを動的に制御できるシリアライザー
    """
    def __init__(self, *args, **kwargs):
        # 'fields' 引数で表示フィールドを制限
        fields = kwargs.pop('fields', None)
        super().__init__(*args, **kwargs)
        
        if fields is not None:
            allowed = set(fields)
            existing = set(self.fields)
            for field_name in existing - allowed:
                self.fields.pop(field_name)

class TimestampedSerializer(serializers.ModelSerializer):
    """タイムスタンプ付きシリアライザー"""
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    updated_by = serializers.StringRelatedField(read_only=True)

class ProductSerializer(DynamicFieldsModelSerializer, TimestampedSerializer):
    """製品シリアライザー"""
    
    # カスタムフィールド
    category_name = serializers.CharField(source='category.name', read_only=True)
    price_with_tax = serializers.SerializerMethodField()
    availability_status = serializers.SerializerMethodField()
    
    # バリデーション付きフィールド
    sku = serializers.CharField(
        max_length=50,
        validators=[UniqueValidator(queryset=Product.objects.all())]
    )
    price = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2,
        min_value=Decimal('0.01')
    )
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'sku', 'price', 'price_with_tax',
            'category', 'category_name', 'stock_quantity', 'availability_status',
            'image_url', 'tags', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    
    def get_price_with_tax(self, obj) -> Decimal:
        """税込価格を計算"""
        tax_rate = getattr(obj.category, 'tax_rate', Decimal('0.10'))
        return obj.price * (1 + tax_rate)
    
    def get_availability_status(self, obj) -> str:
        """在庫状況を取得"""
        if obj.stock_quantity > 10:
            return 'in_stock'
        elif obj.stock_quantity > 0:
            return 'low_stock'
        return 'out_of_stock'
    
    def validate_price(self, value):
        """価格バリデーション"""
        if self.instance and value < self.instance.price * Decimal('0.5'):
            raise serializers.ValidationError(
                "価格は現在価格の50%以下にできません"
            )
        return value
    
    def validate(self, data):
        """オブジェクトレベルバリデーション"""
        if data.get('stock_quantity', 0) < 0:
            raise serializers.ValidationError(
                "在庫数は負の値にできません"
            )
        
        # ビジネスルールの検証
        category = data.get('category')
        if category and category.requires_approval and not self.context['request'].user.is_staff:
            raise serializers.ValidationError(
                "この商品カテゴリーは管理者承認が必要です"
            )
        
        return data

class NestedProductOrderSerializer(serializers.ModelSerializer):
    """ネストした注文項目シリアライザー"""
    
    # 読み取り専用のネストしたオブジェクト
    product = ProductSerializer(read_only=True, fields=['id', 'name', 'price', 'sku'])
    
    # 書き込み用のID
    product_id = serializers.IntegerField(write_only=True)
    
    # 計算フィールド
    subtotal = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_id', 'quantity', 'unit_price', 'subtotal']
    
    def get_subtotal(self, obj):
        return obj.quantity * obj.unit_price
    
    def validate_product_id(self, value):
        """製品IDバリデーション"""
        try:
            product = Product.objects.get(id=value)
            if not product.is_active:
                raise serializers.ValidationError("非アクティブな製品です")
            return value
        except Product.DoesNotExist:
            raise serializers.ValidationError("製品が見つかりません")

class OrderSerializer(TimestampedSerializer):
    """注文シリアライザー"""
    
    # ネストした注文項目
    items = NestedProductOrderSerializer(many=True)
    
    # 計算フィールド
    total_amount = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    
    # カスタマー情報（読み取り専用）
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_email', 'customer_name',
            'status', 'items', 'total_amount', 'item_count', 'shipping_address',
            'billing_address', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        return sum(item.quantity * item.unit_price for item in obj.items.all())
    
    def get_item_count(self, obj):
        return obj.items.count()
    
    @transaction.atomic
    def create(self, validated_data):
        """注文作成時の複雑な処理"""
        items_data = validated_data.pop('items')
        order = Order.objects.create(**validated_data)
        
        for item_data in items_data:
            product_id = item_data.pop('product_id')
            product = Product.objects.get(id=product_id)
            
            # 在庫チェック
            if product.stock_quantity < item_data['quantity']:
                raise serializers.ValidationError(
                    f"製品 {product.name} の在庫が不足しています"
                )
            
            # 注文項目作成
            OrderItem.objects.create(
                order=order,
                product=product,
                unit_price=product.price,
                **item_data
            )
            
            # 在庫減算
            product.stock_quantity -= item_data['quantity']
            product.save(update_fields=['stock_quantity'])
        
        return order
```

### 3. 認証・認可パターン

```python
# apps/authentication/permissions.py
from rest_framework import permissions
from rest_framework.permissions import BasePermission
from django.contrib.auth.models import Group
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model
    User = get_user_model()

class IsOwnerOrReadOnly(permissions.BasePermission):
    """オーナーのみ編集可能、他は読み取り専用"""
    
    def has_object_permission(self, request, view, obj):
        # 読み取り権限はすべてのリクエストに許可
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # 書き込み権限はオーナーのみ
        return obj.owner == request.user

class IsTenantMember(permissions.BasePermission):
    """テナントメンバーのみアクセス可能"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # スーパーユーザーは全テナントにアクセス可能
        if request.user.is_superuser:
            return True
        
        return hasattr(request.user, 'tenant') and request.user.tenant is not None
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # オブジェクトが同一テナントに属するかチェック
        if hasattr(obj, 'tenant'):
            return obj.tenant == request.user.tenant
        
        # オブジェクトのユーザーが同一テナントかチェック
        if hasattr(obj, 'user'):
            return obj.user.tenant == request.user.tenant
        
        return False

class HasRole(permissions.BasePermission):
    """特定のロールを持つユーザーのみアクセス可能"""
    
    def __init__(self, required_roles):
        self.required_roles = required_roles if isinstance(required_roles, list) else [required_roles]
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        user_roles = request.user.groups.values_list('name', flat=True)
        return any(role in user_roles for role in self.required_roles)

class ResourcePermission(permissions.BasePermission):
    """リソースベースの詳細権限制御"""
    
    # アクションと必要権限のマッピング
    action_permissions = {
        'list': 'view',
        'retrieve': 'view',
        'create': 'add',
        'update': 'change',
        'partial_update': 'change',
        'destroy': 'delete',
    }
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # 必要な権限を取得
        action = getattr(view, 'action', None)
        required_permission = self.action_permissions.get(action)
        
        if not required_permission:
            return True  # マッピングにないアクションは許可
        
        # モデル名を取得
        model_name = getattr(view, 'queryset', None)
        if hasattr(model_name, 'model'):
            model_name = model_name.model._meta.model_name
        
        # 権限チェック
        permission_code = f'{view.queryset.model._meta.app_label}.{required_permission}_{model_name}'
        return request.user.has_perm(permission_code)

# apps/authentication/jwt_auth.py
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from rest_framework import serializers
import logging

logger = logging.getLogger(__name__)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """カスタムJWTトークンシリアライザー"""
    
    tenant_id = serializers.CharField(required=False, allow_blank=True)
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # カスタムクレームを追加
        token['user_id'] = user.id
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        
        # テナント情報を追加
        if hasattr(user, 'tenant') and user.tenant:
            token['tenant_id'] = user.tenant.id
            token['tenant_name'] = user.tenant.name
        
        # ロール情報を追加
        token['roles'] = list(user.groups.values_list('name', flat=True))
        
        return token
    
    def validate(self, attrs):
        # テナント指定がある場合の認証
        tenant_id = attrs.get('tenant_id')
        if tenant_id:
            user = authenticate(
                username=attrs['username'],
                password=attrs['password'],
                tenant_id=tenant_id
            )
            if not user:
                raise serializers.ValidationError('認証に失敗しました')
        else:
            data = super().validate(attrs)
            return data
        
        # トークン生成
        refresh = self.get_token(user)
        
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.get_full_name(),
                'tenant': user.tenant.name if hasattr(user, 'tenant') and user.tenant else None
            }
        }

class CustomTokenObtainPairView(TokenObtainPairView):
    """カスタムJWTトークン取得ビュー"""
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # ログイン成功をログに記録
            user_email = request.data.get('username', 'unknown')
            logger.info(f"User {user_email} logged in successfully")
            
            # セキュアなCookieにリフレッシュトークンを設定
            refresh_token = response.data.get('refresh')
            if refresh_token:
                response.set_cookie(
                    'refresh_token',
                    refresh_token,
                    max_age=60 * 60 * 24 * 7,  # 7日間
                    httponly=True,
                    secure=True,
                    samesite='Lax'
                )
        
        return response
```

### 4. パフォーマンス最適化パターン

```python
# apps/api/optimizations.py
from django.db import models
from django.core.cache import cache
from django.conf import settings
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.db.models import Prefetch, Count, Avg, Sum
from typing import Any, Dict, List, Optional
import hashlib
import json

class OptimizedQuerySetMixin:
    """最適化されたクエリセットミックスイン"""
    
    def get_queryset(self):
        """N+1問題を防ぐ最適化されたクエリセット"""
        queryset = super().get_queryset()
        
        # select_related()でフォワードリレーションを最適化
        if hasattr(self, 'select_related_fields'):
            queryset = queryset.select_related(*self.select_related_fields)
        
        # prefetch_related()でリバースリレーションを最適化
        if hasattr(self, 'prefetch_related_fields'):
            prefetch_objects = []
            for field in self.prefetch_related_fields:
                if isinstance(field, dict):
                    # カスタムPrefetchオブジェクト
                    prefetch_objects.append(
                        Prefetch(
                            field['lookup'],
                            queryset=field.get('queryset'),
                            to_attr=field.get('to_attr')
                        )
                    )
                else:
                    prefetch_objects.append(field)
            queryset = queryset.prefetch_related(*prefetch_objects)
        
        return queryset

class CachedModelViewSet(OptimizedQuerySetMixin, viewsets.ModelViewSet):
    """キャッシュ機能付きViewSet"""
    
    cache_timeout = 60 * 15  # 15分
    cache_key_prefix = None
    
    def get_cache_key(self, *args) -> str:
        """キャッシュキーを生成"""
        prefix = self.cache_key_prefix or self.__class__.__name__
        key_data = {
            'viewset': prefix,
            'action': self.action,
            'args': args,
            'user_id': self.request.user.id if self.request.user.is_authenticated else None,
            'query_params': dict(self.request.query_params)
        }
        
        # ハッシュ化してキーを短縮
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def list(self, request, *args, **kwargs):
        """キャッシュ付きリスト取得"""
        cache_key = self.get_cache_key('list')
        cached_response = cache.get(cache_key)
        
        if cached_response is not None:
            return Response(cached_response)
        
        response = super().list(request, *args, **kwargs)
        
        if response.status_code == 200:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def retrieve(self, request, *args, **kwargs):
        """キャッシュ付き詳細取得"""
        cache_key = self.get_cache_key('retrieve', kwargs.get('pk'))
        cached_response = cache.get(cache_key)
        
        if cached_response is not None:
            return Response(cached_response)
        
        response = super().retrieve(request, *args, **kwargs)
        
        if response.status_code == 200:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def invalidate_cache(self, instance=None):
        """キャッシュを無効化"""
        # リストキャッシュを無効化
        list_cache_key = self.get_cache_key('list')
        cache.delete(list_cache_key)
        
        # 詳細キャッシュを無効化
        if instance:
            detail_cache_key = self.get_cache_key('retrieve', instance.pk)
            cache.delete(detail_cache_key)
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        self.invalidate_cache(serializer.instance)
    
    def perform_update(self, serializer):
        super().perform_update(serializer)
        self.invalidate_cache(serializer.instance)
    
    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        self.invalidate_cache(instance)

class ProductOptimizedViewSet(CachedModelViewSet):
    """最適化された製品ViewSet"""
    
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    cache_key_prefix = 'product'
    
    # 最適化設定
    select_related_fields = ['category', 'brand', 'supplier']
    prefetch_related_fields = [
        'tags',
        {
            'lookup': 'reviews',
            'queryset': Review.objects.select_related('user').order_by('-created_at')[:5],
            'to_attr': 'recent_reviews'
        },
        {
            'lookup': 'variants',
            'queryset': ProductVariant.objects.filter(is_active=True),
            'to_attr': 'active_variants'
        }
    ]
    
    def get_queryset(self):
        """さらに最適化されたクエリセット"""
        queryset = super().get_queryset()
        
        # 集約データを事前計算
        queryset = queryset.annotate(
            review_count=Count('reviews'),
            average_rating=Avg('reviews__rating'),
            total_sales=Sum('order_items__quantity')
        )
        
        return queryset
    
    @method_decorator(cache_page(60 * 30))  # 30分キャッシュ
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """人気商品リスト（重い集計処理のため長時間キャッシュ）"""
        popular_products = self.get_queryset().filter(
            is_active=True
        ).order_by('-total_sales', '-average_rating')[:20]
        
        serializer = self.get_serializer(popular_products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """統計情報（キャッシュ必須）"""
        cache_key = self.get_cache_key('statistics')
        cached_stats = cache.get(cache_key)
        
        if cached_stats is not None:
            return Response(cached_stats)
        
        # 重い集計処理
        stats = {
            'total_products': Product.objects.count(),
            'active_products': Product.objects.filter(is_active=True).count(),
            'average_price': Product.objects.aggregate(Avg('price'))['price__avg'],
            'total_categories': Category.objects.count(),
            'out_of_stock': Product.objects.filter(stock_quantity=0).count(),
            'low_stock': Product.objects.filter(
                stock_quantity__gt=0, 
                stock_quantity__lte=10
            ).count(),
        }
        
        # 1時間キャッシュ
        cache.set(cache_key, stats, 60 * 60)
        
        return Response(stats)

# apps/api/pagination.py
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from collections import OrderedDict

class OptimizedPageNumberPagination(PageNumberPagination):
    """最適化されたページネーション"""
    
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    
    def get_paginated_response(self, data):
        """パフォーマンス情報を含むページネーションレスポンス"""
        return Response(OrderedDict([
            ('count', self.page.paginator.count),
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('page_info', {
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
                'page_size': self.page_size,
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            }),
            ('results', data)
        ]))

class CursorPaginationOptimized(CursorPagination):
    """大規模データセット用カーソルページネーション"""
    
    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'
    page_size_query_param = 'page_size'
    
    def get_paginated_response(self, data):
        """カーソル情報を含むレスポンス"""
        return Response(OrderedDict([
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('cursor_info', {
                'current_cursor': self.cursor,
                'page_size': self.page_size,
                'ordering': self.ordering,
            }),
            ('results', data)
        ]))
```

### 5. テスト戦略パターン

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
    
    def test_product_list_unauthenticated(self):
        """未認証ユーザーのリストアクセステスト"""
        url = reverse('product-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
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
    
    def test_product_update_owner(self):
        """オーナーによる製品更新テスト"""
        self.authenticate_user()
        url = reverse('product-detail', kwargs={'pk': self.product.id})
        data = {'name': 'Updated Product Name'}
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, 'Updated Product Name')
    
    def test_product_delete_admin_only(self):
        """管理者のみ削除可能テスト"""
        self.authenticate_user()
        url = reverse('product-detail', kwargs={'pk': self.product.id})
        
        # 一般ユーザーは削除不可
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # 管理者は削除可能
        self.authenticate_admin()
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
    
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

class ProductCacheTestCase(BaseAPITestCase):
    """製品APIキャッシュテスト"""
    
    def setUp(self):
        super().setUp()
        self.product = Product.objects.create(
            name='Cached Product',
            sku='CACHE001',
            price=Decimal('100.00'),
            category=Category.objects.create(name='Test Category'),
            tenant=self.tenant,
            created_by=self.user
        )
        self.authenticate_user()
    
    def test_list_cache_behavior(self):
        """リストキャッシュの動作テスト"""
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

# パフォーマンステスト
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

### 6. エラーハンドリング・ロギングパターン

```python
# apps/api/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError
from django.db import IntegrityError
import logging
import traceback
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """カスタム例外ハンドラー"""
    
    # DRFのデフォルトハンドラーを実行
    response = exception_handler(exc, context)
    
    # カスタムエラーレスポンス形式
    if response is not None:
        error_data = {
            'error': True,
            'message': 'An error occurred',
            'details': response.data,
            'status_code': response.status_code,
            'timestamp': timezone.now().isoformat(),
        }
        
        # エラータイプに応じたメッセージ
        if response.status_code == 400:
            error_data['message'] = 'Bad request - please check your input'
        elif response.status_code == 401:
            error_data['message'] = 'Authentication required'
        elif response.status_code == 403:
            error_data['message'] = 'Permission denied'
        elif response.status_code == 404:
            error_data['message'] = 'Resource not found'
        elif response.status_code == 429:
            error_data['message'] = 'Rate limit exceeded'
        elif response.status_code >= 500:
            error_data['message'] = 'Internal server error'
        
        response.data = error_data
    
    # 未処理の例外をログに記録
    if response is None or response.status_code >= 500:
        logger.error(
            f"Unhandled exception in {context['view'].__class__.__name__}: {exc}",
            extra={
                'exception_type': type(exc).__name__,
                'traceback': traceback.format_exc(),
                'request_data': getattr(context['request'], 'data', None),
                'user': getattr(context['request'], 'user', None),
            }
        )
    
    return response

class BusinessLogicException(Exception):
    """ビジネスロジック例外"""
    def __init__(self, message: str, code: str = None, details: Dict = None):
        self.message = message
        self.code = code or 'BUSINESS_ERROR'
        self.details = details or {}
        super().__init__(message)

class InsufficientStockException(BusinessLogicException):
    """在庫不足例外"""
    def __init__(self, product_name: str, requested: int, available: int):
        message = f"Insufficient stock for {product_name}. Requested: {requested}, Available: {available}"
        details = {
            'product_name': product_name,
            'requested_quantity': requested,
            'available_quantity': available
        }
        super().__init__(message, 'INSUFFICIENT_STOCK', details)

# apps/api/middleware.py
import logging
import time
import uuid
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
import json

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(MiddlewareMixin):
    """リクエストログミドルウェア"""
    
    def process_request(self, request):
        """リクエスト開始時の処理"""
        request.start_time = time.time()
        request.request_id = str(uuid.uuid4())
        
        # リクエスト情報をログに記録
        logger.info(
            f"Request started: {request.method} {request.path}",
            extra={
                'request_id': request.request_id,
                'method': request.method,
                'path': request.path,
                'user': str(request.user) if hasattr(request, 'user') else None,
                'ip_address': self.get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            }
        )
    
    def process_response(self, request, response):
        """レスポンス時の処理"""
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            
            # レスポンス情報をログに記録
            logger.info(
                f"Request completed: {request.method} {request.path} - "
                f"{response.status_code} in {duration:.3f}s",
                extra={
                    'request_id': getattr(request, 'request_id', None),
                    'method': request.method,
                    'path': request.path,
                    'status_code': response.status_code,
                    'duration': duration,
                    'response_size': len(response.content) if hasattr(response, 'content') else 0,
                }
            )
            
            # パフォーマンス警告
            if duration > 5.0:  # 5秒以上
                logger.warning(
                    f"Slow request detected: {request.method} {request.path} took {duration:.3f}s",
                    extra={'request_id': getattr(request, 'request_id', None)}
                )
        
        # レスポンスヘッダーにリクエストIDを追加
        if hasattr(request, 'request_id'):
            response['X-Request-ID'] = request.request_id
        
        return response
    
    def get_client_ip(self, request):
        """クライアントIPを取得"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class ErrorHandlingMiddleware(MiddlewareMixin):
    """エラーハンドリングミドルウェア"""
    
    def process_exception(self, request, exception):
        """例外処理"""
        logger.error(
            f"Unhandled exception: {exception}",
            extra={
                'request_id': getattr(request, 'request_id', None),
                'exception_type': type(exception).__name__,
                'request_path': request.path,
                'request_method': request.method,
            },
            exc_info=True
        )
        
        # 本番環境では詳細なエラー情報を隠す
        if settings.DEBUG:
            return None  # Djangoのデフォルトエラーハンドリング
        
        return JsonResponse({
            'error': True,
            'message': 'Internal server error',
            'request_id': getattr(request, 'request_id', None),
        }, status=500)

# apps/api/monitoring.py
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.db import connection
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
import psutil
import time

@api_view(['GET'])
@permission_classes([IsAdminUser])
def health_check(request):
    """ヘルスチェックエンドポイント"""
    
    health_data = {
        'status': 'healthy',
        'timestamp': time.time(),
        'checks': {}
    }
    
    # データベース接続チェック
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_data['checks']['database'] = {'status': 'ok'}
    except Exception as e:
        health_data['checks']['database'] = {'status': 'error', 'message': str(e)}
        health_data['status'] = 'unhealthy'
    
    # キャッシュチェック
    try:
        cache.set('health_check', 'ok', 30)
        if cache.get('health_check') == 'ok':
            health_data['checks']['cache'] = {'status': 'ok'}
        else:
            raise Exception("Cache read/write failed")
    except Exception as e:
        health_data['checks']['cache'] = {'status': 'error', 'message': str(e)}
        health_data['status'] = 'unhealthy'
    
    # システムリソースチェック
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_data['checks']['system'] = {
            'status': 'ok',
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent,
        }
        
        # リソース使用率が高い場合は警告
        if cpu_percent > 80 or memory.percent > 80 or disk.percent > 80:
            health_data['checks']['system']['status'] = 'warning'
            
    except Exception as e:
        health_data['checks']['system'] = {'status': 'error', 'message': str(e)}
    
    status_code = 200 if health_data['status'] == 'healthy' else 503
    return Response(health_data, status=status_code)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def metrics(request):
    """メトリクス情報"""
    
    # データベースメトリクス
    db_queries = connection.queries
    
    # キャッシュメトリクス
    cache_stats = getattr(cache, '_cache', {}).get_stats() if hasattr(cache, '_cache') else {}
    
    return Response({
        'database': {
            'query_count': len(db_queries),
            'connection_status': 'connected' if connection.connection else 'disconnected'
        },
        'cache': cache_stats,
        'system': {
            'cpu_count': psutil.cpu_count(),
            'memory_total': psutil.virtual_memory().total,
            'disk_total': psutil.disk_usage('/').total,
        }
    })
```

### 7. デプロイメント・本番環境パターン

```python
# config/settings/production.py
import os
from .base import *
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

# セキュリティ設定
DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# データベース（本番用）
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': 'require',
        },
        'CONN_MAX_AGE': 60,
    }
}

# Redis Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            }
        },
        'KEY_PREFIX': 'drf_app',
        'TIMEOUT': 300,
    }
}

# Celery設定
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND')
CELERY_TASK_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30分

# セキュリティヘッダー
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_HSTS_SECONDS = 31536000
X_FRAME_OPTIONS = 'DENY'

# SSL設定
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# CORS設定
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True

# 静的ファイル（AWS S3）
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
AWS_DEFAULT_ACL = None
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}

STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/static/'
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'

# ログ設定
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(levelname)s %(asctime)s %(module)s %(process)d %(thread)d %(message)s'
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/app.log',
            'maxBytes': 1024*1024*10,  # 10MB
            'backupCount': 5,
            'formatter': 'json',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'sentry': {
            'level': 'ERROR',
            'class': 'sentry_sdk.integrations.logging.SentryHandler',
        },
    },
    'root': {
        'handlers': ['console', 'file', 'sentry'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console', 'file', 'sentry'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Sentry設定
sentry_sdk.init(
    dsn=os.environ.get('SENTRY_DSN'),
    integrations=[
        DjangoIntegration(transaction_style='url'),
        CeleryIntegration(monitor_beat_tasks=True),
    ],
    traces_sample_rate=0.1,
    send_default_pii=True,
    environment=os.environ.get('ENVIRONMENT', 'production'),
)

# レート制限
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle'
]
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '100/hour',
    'user': '1000/hour'
}

# Docker/docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=False
      - DB_HOST=db
      - DB_NAME=djangoapp
      - DB_USER=postgres
      - DB_PASSWORD=password
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/var/log/django
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=djangoapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  celery:
    build: .
    command: celery -A config worker --loglevel=info
    environment:
      - DEBUG=False
      - DB_HOST=db
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/var/log/django

  celery-beat:
    build: .
    command: celery -A config beat --loglevel=info
    environment:
      - DEBUG=False
      - DB_HOST=db
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    depends_on:
      - db
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web

volumes:
  postgres_data:

# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream django {
        server web:8000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    server {
        listen 80;
        server_name example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name example.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        location / {
            proxy_pass http://django;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Rate limiting
            limit_req zone=api burst=20 nodelay;
        }

        location /api/auth/ {
            proxy_pass http://django;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Stricter rate limiting for auth endpoints
            limit_req zone=login burst=5 nodelay;
        }

        location /health/ {
            proxy_pass http://django;
            proxy_set_header Host $host;
            access_log off;
        }
    }
}

# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: django-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: django-api
  template:
    metadata:
      labels:
        app: django-api
    spec:
      containers:
      - name: django
        image: your-registry/django-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DEBUG
          value: "False"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        livenessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

このDjango REST Frameworkの企業レベルパターン集は以下の要素を網羅しています：

1. **エンタープライズAPI設計**: 共通機能、テナント分離、論理削除対応
2. **高度なシリアライザー**: 動的フィールド、ネスト、複雑なバリデーション
3. **認証・認可**: JWT、権限制御、テナントベース認証
4. **パフォーマンス最適化**: キャッシュ、クエリ最適化、ページネーション
5. **包括的テスト**: 単体、統合、パフォーマンステスト
6. **エラーハンドリング**: カスタム例外、ログ、監視
7. **本番デプロイ**: Docker、Kubernetes、セキュリティ対策

これらのパターンを使用することで、スケーラブルで保守性の高いエンタープライズアプリケーションを構築できます。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Phase 3: Python Advanced Libraries - FastAPI production patterns document", "status": "completed", "id": "18"}, {"content": "Phase 3: SQLAlchemy 2.0 advanced ORM patterns document", "status": "completed", "id": "19"}, {"content": "Phase 3: Pydantic v2 data validation patterns document", "status": "completed", "id": "20"}, {"content": "Phase 3: Async Python concurrency patterns document", "status": "completed", "id": "21"}, {"content": "Phase 3: Pytest advanced testing patterns document", "status": "completed", "id": "22"}, {"content": "Phase 3: Celery distributed task patterns document", "status": "completed", "id": "23"}, {"content": "Phase 3: NumPy/Pandas data science patterns document", "status": "completed", "id": "24"}, {"content": "Phase 3: Django REST framework enterprise patterns document", "status": "completed", "id": "25"}, {"content": "Phase 4: Architecture Patterns (8 documents)", "status": "in_progress", "id": "26"}, {"content": "Phase 5: Development Methodologies (3 documents)", "status": "pending", "id": "27"}]