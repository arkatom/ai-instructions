# Django REST Framework - エンタープライズ機能

## マルチテナント実装 {#multi-tenancy}

```python
# apps/core/models.py
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Tenant(models.Model):
    """テナントモデル"""
    name = models.CharField(max_length=100)
    domain = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 設定
    max_users = models.IntegerField(default=10)
    max_storage_gb = models.IntegerField(default=10)
    features = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'tenants'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class TenantAwareModel(models.Model):
    """テナント対応の抽象モデル"""
    tenant = models.ForeignKey(
        Tenant, 
        on_delete=models.CASCADE,
        related_name='%(class)s_set'
    )
    
    class Meta:
        abstract = True

# apps/core/middleware.py
from django.utils.deprecation import MiddlewareMixin
from django.http import Http404

class TenantMiddleware(MiddlewareMixin):
    """テナント識別ミドルウェア"""
    
    def process_request(self, request):
        """リクエストからテナントを識別"""
        # ドメインベースのテナント識別
        host = request.get_host().split(':')[0]
        
        try:
            tenant = Tenant.objects.get(domain=host, is_active=True)
            request.tenant = tenant
        except Tenant.DoesNotExist:
            # デフォルトテナントまたはエラー
            if not settings.ALLOW_UNKNOWN_TENANTS:
                raise Http404("Tenant not found")
            request.tenant = None
        
        # ユーザーのテナントを設定
        if request.user.is_authenticated and hasattr(request.user, 'tenant'):
            if request.tenant and request.user.tenant != request.tenant:
                raise PermissionDenied("Tenant mismatch")

# apps/core/managers.py
from django.db import models

class TenantAwareManager(models.Manager):
    """テナント対応マネージャー"""
    
    def get_queryset(self):
        """現在のテナントでフィルタリング"""
        queryset = super().get_queryset()
        
        # リクエストコンテキストからテナントを取得
        if hasattr(self.model, '_current_tenant'):
            queryset = queryset.filter(tenant=self.model._current_tenant)
        
        return queryset
    
    def for_tenant(self, tenant):
        """特定テナントのクエリセット"""
        return self.get_queryset().filter(tenant=tenant)
```

## 監査ログシステム

```python
# apps/audit/models.py
from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import json

class AuditLog(models.Model):
    """監査ログモデル"""
    
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('VIEW', 'View'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('EXPORT', 'Export'),
    ]
    
    # 基本情報
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # ユーザー情報
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    
    # オブジェクト情報
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True)
    object_id = models.PositiveIntegerField(null=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 変更内容
    changes = models.JSONField(default=dict)
    old_values = models.JSONField(default=dict)
    new_values = models.JSONField(default=dict)
    
    # メタデータ
    request_id = models.CharField(max_length=36, null=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, null=True)
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['content_type', 'object_id']),
        ]

# apps/audit/mixins.py
from django.forms.models import model_to_dict

class AuditMixin:
    """監査ログミックスイン"""
    
    def perform_create(self, serializer):
        """作成時の監査ログ"""
        instance = serializer.save()
        
        AuditLog.objects.create(
            action='CREATE',
            user=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            content_object=instance,
            new_values=model_to_dict(instance),
            request_id=getattr(self.request, 'request_id', None),
            tenant=getattr(self.request, 'tenant', None)
        )
        
        return instance
    
    def perform_update(self, serializer):
        """更新時の監査ログ"""
        old_instance = self.get_object()
        old_values = model_to_dict(old_instance)
        
        instance = serializer.save()
        new_values = model_to_dict(instance)
        
        # 変更点を記録
        changes = {
            key: {'old': old_values.get(key), 'new': new_values.get(key)}
            for key in new_values
            if old_values.get(key) != new_values.get(key)
        }
        
        AuditLog.objects.create(
            action='UPDATE',
            user=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            content_object=instance,
            old_values=old_values,
            new_values=new_values,
            changes=changes,
            request_id=getattr(self.request, 'request_id', None),
            tenant=getattr(self.request, 'tenant', None)
        )
        
        return instance
    
    def perform_destroy(self, instance):
        """削除時の監査ログ"""
        AuditLog.objects.create(
            action='DELETE',
            user=self.request.user,
            ip_address=self.get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            content_object=instance,
            old_values=model_to_dict(instance),
            request_id=getattr(self.request, 'request_id', None),
            tenant=getattr(self.request, 'tenant', None)
        )
        
        super().perform_destroy(instance)
    
    def get_client_ip(self):
        """クライアントIP取得"""
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return self.request.META.get('REMOTE_ADDR')
```

## データエクスポート機能

```python
# apps/export/services.py
import csv
import xlsxwriter
from io import BytesIO
from django.http import HttpResponse

class DataExportService:
    """データエクスポートサービス"""
    
    @staticmethod
    def export_to_csv(queryset, fields, filename='export.csv'):
        """CSV形式でエクスポート"""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        writer = csv.DictWriter(response, fieldnames=fields)
        writer.writeheader()
        
        for obj in queryset:
            row = {field: getattr(obj, field) for field in fields}
            writer.writerow(row)
        
        # 監査ログ記録
        AuditLog.objects.create(
            action='EXPORT',
            user=request.user,
            changes={'format': 'csv', 'count': queryset.count()}
        )
        
        return response
    
    @staticmethod
    def export_to_excel(queryset, fields, filename='export.xlsx'):
        """Excel形式でエクスポート"""
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet()
        
        # ヘッダー
        for col, field in enumerate(fields):
            worksheet.write(0, col, field)
        
        # データ
        for row, obj in enumerate(queryset, start=1):
            for col, field in enumerate(fields):
                worksheet.write(row, col, str(getattr(obj, field)))
        
        workbook.close()
        output.seek(0)
        
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
```