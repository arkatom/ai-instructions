# Django REST Framework - モデル・シリアライザー

> 高度なモデル設計とシリアライザーの実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **Django**: 5.0+, DRF: 3.15+

## 🏗️ 高度なシリアライザーパターン

### 動的フィールド制御シリアライザー

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
```

### 製品シリアライザー実装

```python
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
```

### ネストしたシリアライザー実装

```python
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
```

### 複雁な注文シリアライザー

```python
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

## 📋 特殊なシリアライザーパターン

### バルク操作シリアライザー

```python
class BulkCreateSerializer(serializers.ListSerializer):
    """バルク作成用シリアライザー"""
    
    def create(self, validated_data):
        """バッチ処理で作成"""
        instances = []
        with transaction.atomic():
            for item_data in validated_data:
                instance = self.child.Meta.model(**item_data)
                instances.append(instance)
            
            # バルク作成（パフォーマンス最適化）
            created_instances = self.child.Meta.model.objects.bulk_create(instances)
            
        return created_instances
    
    def update(self, instances, validated_data):
        """バルク更新"""
        instance_mapping = {instance.id: instance for instance in instances}
        data_mapping = {item['id']: item for item in validated_data}
        
        updated_instances = []
        with transaction.atomic():
            for instance_id, data in data_mapping.items():
                if instance_id in instance_mapping:
                    instance = instance_mapping[instance_id]
                    for attr, value in data.items():
                        setattr(instance, attr, value)
                    updated_instances.append(instance)
            
            # バルク更新
            self.child.Meta.model.objects.bulk_update(
                updated_instances,
                fields=data_mapping[list(data_mapping.keys())[0]].keys()
            )
        
        return updated_instances

class ProductBulkSerializer(ProductSerializer):
    """製品バルク操作シリアライザー"""
    
    class Meta(ProductSerializer.Meta):
        list_serializer_class = BulkCreateSerializer
```

### ファイルアップロードシリアライザー

```python
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image
import io

class ImageUploadSerializer(serializers.Serializer):
    """画像アップロードシリアライザー"""
    
    image = serializers.ImageField()
    alt_text = serializers.CharField(max_length=255, required=False)
    compress = serializers.BooleanField(default=True)
    max_width = serializers.IntegerField(default=1920)
    max_height = serializers.IntegerField(default=1080)
    
    def validate_image(self, value):
        """画像バリデーション"""
        # ファイルサイズチェック (5MB)
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                "ファイルサイズは5MB以下である必要があります"
            )
        
        # 画像フォーマットチェック
        allowed_formats = ['JPEG', 'PNG', 'WebP']
        try:
            img = Image.open(value)
            if img.format not in allowed_formats:
                raise serializers.ValidationError(
                    f"サポートされていない形式です: {allowed_formats}"
                )
        except Exception as e:
            raise serializers.ValidationError("無効な画像ファイルです")
        
        return value
    
    def save(self):
        """画像を処理して保存"""
        image = self.validated_data['image']
        compress = self.validated_data['compress']
        max_width = self.validated_data['max_width']
        max_height = self.validated_data['max_height']
        
        if compress:
            # 画像圧縮とリサイズ
            img = Image.open(image)
            
            # サイズ調整
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            
            # 圧縮して保存
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            output.seek(0)
            
            # 新しいファイルオブジェクト作成
            compressed_file = InMemoryUploadedFile(
                output,
                'ImageField',
                f"compressed_{image.name}",
                'image/jpeg',
                output.getbuffer().nbytes,
                None
            )
            
            return compressed_file
        
        return image
```

### 条件付きシリアライゼーション

```python
class ConditionalSerializer(serializers.ModelSerializer):
    """条件付きシリアライゼーション"""
    
    # 管理者のみ表示されるフィールド
    internal_notes = serializers.CharField(read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'
    
    def to_representation(self, instance):
        """ユーザーの権限に応じてフィールドを制御"""
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        if request and request.user:
            # 管理者以外は機密情報を除外
            if not request.user.is_staff:
                sensitive_fields = ['internal_notes', 'created_by_email', 'cost_price']
                for field in sensitive_fields:
                    data.pop(field, None)
            
            # テナント別データ制御
            if hasattr(request.user, 'tenant') and hasattr(instance, 'tenant'):
                if request.user.tenant != instance.tenant:
                    # 異なるテナントのデータは制限
                    allowed_fields = ['id', 'name', 'public_description']
                    data = {k: v for k, v in data.items() if k in allowed_fields}
        
        return data
```

### バージョニング対応シリアライザー

```python
class VersionedSerializer:
    """バージョン対応シリアライザーミックスイン"""
    
    def get_serializer_class(self):
        """バージョンに応じたシリアライザーを返す"""
        api_version = getattr(self.request, 'version', 'v1')
        
        version_serializers = {
            'v1': self.serializer_class_v1,
            'v2': self.serializer_class_v2,
            'v3': self.serializer_class_v3,
        }
        
        return version_serializers.get(api_version, self.serializer_class_v1)

class ProductSerializerV1(ProductSerializer):
    """製品シリアライザー v1"""
    
    class Meta(ProductSerializer.Meta):
        # v1では一部フィールドを除外
        fields = [
            'id', 'name', 'description', 'price', 'category',
            'created_at', 'updated_at'
        ]

class ProductSerializerV2(ProductSerializer):
    """製品シリアライザー v2"""
    
    # v2で新しいフィールドを追加
    rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    
    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields + ['rating', 'review_count']
```

この高度なシリアライザーパターンを使用することで、柔軟性が高く保守性のあるAPIを構築できます。次はViewSetとAPI実装の高度なパターンを学習しましょう。