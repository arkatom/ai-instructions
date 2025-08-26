# Django REST Framework - 高度なシリアライザーパターン

## 動的フィールドシリアライザー {#dynamic-serializers}

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

## 複雑なバリデーション

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

## ネストしたシリアライザー {#nested-serializers}

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

## トランザクション処理とバルク操作 {#bulk-operations}

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

    @transaction.atomic
    def update(self, instance, validated_data):
        """注文更新時の処理"""
        items_data = validated_data.pop('items', None)
        
        # 基本情報の更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if items_data is not None:
            # 既存項目の削除
            instance.items.all().delete()
            
            # 新規項目の作成
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id)
                OrderItem.objects.create(
                    order=instance,
                    product=product,
                    **item_data
                )
        
        return instance
```

## リスト/詳細用シリアライザーの分離

```python
class ProductListSerializer(serializers.ModelSerializer):
    """リスト表示用の軽量シリアライザー"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'category_name', 'stock_quantity', 'thumbnail_url']

class ProductDetailSerializer(ProductSerializer):
    """詳細表示用の完全なシリアライザー"""
    related_products = ProductListSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    
    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields + ['related_products', 'reviews', 'specifications']
    
    def get_reviews(self, obj):
        """最新のレビュー5件を取得"""
        reviews = obj.reviews.filter(is_approved=True).order_by('-created_at')[:5]
        return ReviewSerializer(reviews, many=True).data

class ProductWriteSerializer(serializers.ModelSerializer):
    """書き込み専用シリアライザー"""
    
    class Meta:
        model = Product
        fields = ['name', 'description', 'sku', 'price', 'category', 'stock_quantity', 'specifications']
    
    def validate_sku(self, value):
        """SKUの重複チェック（更新時は自分自身を除く）"""
        qs = Product.objects.filter(sku=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("このSKUは既に使用されています")
        return value
```