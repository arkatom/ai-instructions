# Django REST Framework - エラーハンドリング・ロギング

## カスタム例外ハンドラー

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
```

## ロギング設計 {#logging}

```python
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
```

## 監視とヘルスチェック {#monitoring}

```python
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
```