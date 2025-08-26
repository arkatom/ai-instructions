# Django REST Framework - 基礎概念とAPI設計

## ViewSet設計パターン {#viewset-patterns}

### BaseEnterpriseViewSet - 共通機能の集約

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
```

### 具体的なViewSet実装

```python
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
```

## カスタムアクション実装 {#custom-actions}

```python
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

## フィルタリング・検索・並び替え {#filtering}

```python
# apps/api/v1/filters.py
import django_filters
from django.db.models import Q

class ProductFilter(django_filters.FilterSet):
    """高度な製品フィルタリング"""
    
    # 範囲フィルター
    price_min = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    price_max = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    
    # 日付範囲
    created_after = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    
    # 複数値フィルター
    categories = django_filters.ModelMultipleChoiceFilter(
        field_name='category',
        queryset=Category.objects.all()
    )
    
    # カスタムフィルター
    has_stock = django_filters.BooleanFilter(method='filter_has_stock')
    search = django_filters.CharFilter(method='filter_search')
    
    def filter_has_stock(self, queryset, name, value):
        """在庫有無でフィルタリング"""
        if value:
            return queryset.filter(stock_quantity__gt=0)
        return queryset.filter(stock_quantity=0)
    
    def filter_search(self, queryset, name, value):
        """複数フィールドでの全文検索"""
        return queryset.filter(
            Q(name__icontains=value) |
            Q(description__icontains=value) |
            Q(sku__icontains=value)
        )
    
    class Meta:
        model = Product
        fields = ['status', 'is_featured', 'category']
```

## URLルーティング設計

```python
# apps/api/v1/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'orders', OrderViewSet)

# APIバージョニング
app_name = 'api_v1'
urlpatterns = [
    path('', include(router.urls)),
    path('auth/', include('apps.authentication.urls')),
    path('health/', include('apps.health.urls')),
]

# プロジェクトURL設定
urlpatterns = [
    path('api/v1/', include('apps.api.v1.urls')),
    path('api/v2/', include('apps.api.v2.urls')),  # 将来のバージョン
]
```

## ミドルウェア設計

```python
# apps/api/middleware.py
import uuid
import time
from django.utils.deprecation import MiddlewareMixin

class RequestIDMiddleware(MiddlewareMixin):
    """リクエストIDの付与"""
    def process_request(self, request):
        request.id = str(uuid.uuid4())
        request.META['X-Request-ID'] = request.id

class PerformanceMiddleware(MiddlewareMixin):
    """パフォーマンス計測"""
    def process_request(self, request):
        request._start_time = time.time()
    
    def process_response(self, request, response):
        if hasattr(request, '_start_time'):
            duration = time.time() - request._start_time
            response['X-Response-Time'] = f"{duration:.3f}s"
        return response
```