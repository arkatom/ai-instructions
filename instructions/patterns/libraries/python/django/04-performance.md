# Django REST Framework - パフォーマンス最適化

## クエリ最適化 {#query-optimization}

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
```

## キャッシュ戦略 {#caching}

```python
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
```

## 実装例：最適化された製品ViewSet

```python
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
```

## 最適化されたページネーション

```python
# apps/api/pagination.py
from rest_framework.pagination import PageNumberPagination, CursorPagination
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

## 非同期処理 {#async-processing}

```python
# apps/api/async_tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.db import transaction

@shared_task
def process_bulk_import(file_path, user_id):
    """大量データの非同期インポート"""
    import csv
    
    with open(file_path, 'r') as file:
        reader = csv.DictReader(file)
        products = []
        
        for row in reader:
            products.append(Product(
                name=row['name'],
                price=row['price'],
                stock_quantity=row['quantity']
            ))
        
        # バルクインサート
        with transaction.atomic():
            Product.objects.bulk_create(products, batch_size=1000)
    
    # 完了通知
    send_notification.delay(user_id, 'Import completed')
```