# Django REST Framework - 認証・認可パターン

## カスタム権限クラス {#permissions}

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
```

## ロールベース権限制御

```python
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
```

## JWT認証 {#jwt-authentication}

```python
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

## 多要素認証とセッション管理

```python
# apps/authentication/mfa.py
from django.contrib.auth import get_user_model
from django.core.cache import cache
import pyotp
import qrcode
from io import BytesIO
import base64

User = get_user_model()

class MFAService:
    """多要素認証サービス"""
    
    @staticmethod
    def generate_secret():
        """TOTP用のシークレットキー生成"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(user: User, secret: str) -> str:
        """QRコード生成"""
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name='Your App Name'
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, 'PNG')
        
        return base64.b64encode(buffer.getvalue()).decode()
    
    @staticmethod
    def verify_token(secret: str, token: str) -> bool:
        """TOTPトークン検証"""
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)
    
    @staticmethod
    def generate_backup_codes(user: User, count: int = 10) -> list:
        """バックアップコード生成"""
        codes = []
        for _ in range(count):
            code = pyotp.random_base32()[:8]
            codes.append(code)
        
        # ハッシュ化して保存
        cache.set(f'backup_codes:{user.id}', codes, timeout=None)
        return codes

# settings.py での設定
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```