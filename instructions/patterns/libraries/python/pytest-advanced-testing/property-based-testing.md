## Property-Based Testing

### 1. Hypothesisを使用したプロパティベーステスト

```python
import pytest
from hypothesis import given, strategies as st, assume, example, settings
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
import string
import re
from typing import List, Dict, Any
import json

# 基本的なプロパティベーステスト
@given(st.integers(min_value=0, max_value=1000))
def test_fibonacci_properties(n):
    """フィボナッチ数列のプロパティテスト"""
    from myapp.math_utils import fibonacci
    
    result = fibonacci(n)
    
    # プロパティ1: 結果は非負整数
    assert isinstance(result, int)
    assert result >= 0
    
    # プロパティ2: フィボナッチ数列の性質
    if n >= 2:
        assert result == fibonacci(n-1) + fibonacci(n-2)
    elif n == 1:
        assert result == 1
    elif n == 0:
        assert result == 0

@given(st.lists(st.integers(), min_size=1))
def test_sorting_properties(numbers):
    """ソート関数のプロパティテスト"""
    from myapp.algorithms import custom_sort
    
    sorted_numbers = custom_sort(numbers.copy())
    
    # プロパティ1: 長さが保持される
    assert len(sorted_numbers) == len(numbers)
    
    # プロパティ2: 全ての要素が含まれる
    assert sorted(sorted_numbers) == sorted(numbers)
    
    # プロパティ3: ソートされている
    for i in range(len(sorted_numbers) - 1):
        assert sorted_numbers[i] <= sorted_numbers[i + 1]
    
    # プロパティ4: 冪等性（すでにソートされたリストをソートしても変わらない）
    assert custom_sort(sorted_numbers) == sorted_numbers

# 文字列処理のプロパティテスト
@given(st.text(alphabet=string.ascii_letters + string.digits, min_size=1, max_size=100))
def test_string_validation_properties(input_string):
    """文字列検証のプロパティテスト"""
    from myapp.validators import validate_username
    
    result = validate_username(input_string)
    
    # プロパティ1: 結果は辞書型
    assert isinstance(result, dict)
    assert "is_valid" in result
    assert "errors" in result
    
    # プロパティ2: is_validがTrueならエラーは空
    if result["is_valid"]:
        assert len(result["errors"]) == 0
    
    # プロパティ3: 特定の条件での検証
    if len(input_string) < 3:
        assert not result["is_valid"]
        assert "too_short" in result["errors"]
    
    if len(input_string) > 50:
        assert not result["is_valid"]
        assert "too_long" in result["errors"]

# 複合データ型のプロパティテスト
user_strategy = st.fixed_dictionaries({
    "username": st.text(alphabet=string.ascii_letters, min_size=3, max_size=20),
    "email": st.emails(),
    "age": st.integers(min_value=13, max_value=120),
    "is_active": st.booleans()
})

@given(user_strategy)
def test_user_serialization_properties(user_data):
    """ユーザーデータシリアライゼーションのプロパティテスト"""
    from myapp.serializers import UserSerializer
    
    serializer = UserSerializer(user_data)
    
    # シリアライゼーション
    serialized = serializer.serialize()
    
    # プロパティ1: シリアライズされたデータはJSON文字列
    assert isinstance(serialized, str)
    
    # プロパティ2: JSONとしてパース可能
    parsed_data = json.loads(serialized)
    
    # プロパティ3: 元のデータと一致
    assert parsed_data["username"] == user_data["username"]
    assert parsed_data["email"] == user_data["email"]
    assert parsed_data["age"] == user_data["age"]
    assert parsed_data["is_active"] == user_data["is_active"]
    
    # プロパティ4: デシリアライゼーション
    deserialized = UserSerializer.deserialize(serialized)
    assert deserialized == user_data

# 事前条件を含むプロパティテスト
@given(st.lists(st.integers(), min_size=2))
def test_binary_search_properties(numbers):
    """バイナリサーチのプロパティテスト"""
    from myapp.algorithms import binary_search
    
    # 事前条件: リストをソート
    sorted_numbers = sorted(numbers)
    
    # テスト対象の要素を選択
    target = sorted_numbers[len(sorted_numbers) // 2]
    
    result = binary_search(sorted_numbers, target)
    
    # プロパティ1: 見つかった場合のインデックス
    if result is not None:
        assert 0 <= result < len(sorted_numbers)
        assert sorted_numbers[result] == target
    
    # プロパティ2: 存在しない要素は見つからない
    assume(target + 1 not in sorted_numbers)  # 仮定
    not_found_result = binary_search(sorted_numbers, target + 1)
    assert not_found_result is None

# 設定付きプロパティテスト
@settings(max_examples=1000, deadline=None)
@given(
    st.lists(
        st.tuples(st.text(), st.integers()),
        min_size=1,
        max_size=100
    )
)
def test_database_operations_properties(records):
    """データベース操作のプロパティテスト"""
    from myapp.database import InMemoryDatabase
    
    db = InMemoryDatabase()
    
    # レコード挿入
    for name, value in records:
        db.insert(name, value)
    
    # プロパティ1: 挿入したレコード数と格納されたレコード数が一致
    assert db.count() == len(set(name for name, _ in records))  # 重複を除く
    
    # プロパティ2: 挿入した値を取得できる
    for name, value in records:
        retrieved_value = db.get(name)
        if retrieved_value is not None:  # 重複で上書きされた可能性
            assert isinstance(retrieved_value, int)

# 例外処理のプロパティテスト
@given(st.text())
def test_email_validation_properties(input_text):
    """メール検証のプロパティテスト"""
    from myapp.validators import validate_email
    
    result = validate_email(input_text)
    
    # プロパティ1: 結果はブール値
    assert isinstance(result, bool)
    
    # プロパティ2: 基本的なメール形式の特性
    has_at_symbol = "@" in input_text
    has_domain_dot = "@" in input_text and "." in input_text.split("@")[-1]
    
    if result:
        # 有効なメールアドレスの条件
        assert has_at_symbol
        assert has_domain_dot
        assert len(input_text) > 5  # 最小長
    
    # プロパティ3: 明らかに無効なケース
    if not has_at_symbol or input_text.count("@") != 1:
        assert not result

# ステートフルプロパティテスト
class ShoppingCartStateMachine(RuleBasedStateMachine):
    """ショッピングカートのステートマシンテスト"""
    
    def __init__(self):
        super().__init__()
        self.cart = ShoppingCart()
        self.expected_items = {}
    
    @rule(product_id=st.integers(min_value=1, max_value=100),
          quantity=st.integers(min_value=1, max_value=10))
    def add_item(self, product_id, quantity):
        """商品追加ルール"""
        self.cart.add_item(product_id, quantity)
        
        if product_id in self.expected_items:
            self.expected_items[product_id] += quantity
        else:
            self.expected_items[product_id] = quantity
    
    @rule(product_id=st.integers(min_value=1, max_value=100))
    def remove_item(self, product_id):
        """商品削除ルール"""
        if product_id in self.expected_items:
            self.cart.remove_item(product_id)
            del self.expected_items[product_id]
    
    @rule(product_id=st.integers(min_value=1, max_value=100),
          new_quantity=st.integers(min_value=1, max_value=10))
    def update_quantity(self, product_id, new_quantity):
        """数量更新ルール"""
        if product_id in self.expected_items:
            self.cart.update_quantity(product_id, new_quantity)
            self.expected_items[product_id] = new_quantity
    
    @rule()
    def clear_cart(self):
        """カートクリアルール"""
        self.cart.clear()
        self.expected_items.clear()
    
    @invariant()
    def cart_consistency(self):
        """カート一貫性の不変条件"""
        # 商品数の一致
        assert len(self.cart.items) == len(self.expected_items)
        
        # 各商品の数量一致
        for product_id, expected_quantity in self.expected_items.items():
            assert self.cart.get_quantity(product_id) == expected_quantity
        
        # 総数量の一致
        expected_total = sum(self.expected_items.values())
        assert self.cart.total_quantity() == expected_total
        
        # 空でない場合の総額は正の値
        if self.expected_items:
            assert self.cart.total_price() > 0

class ShoppingCart:
    """ショッピングカート（テスト対象）"""
    
    def __init__(self):
        self.items = {}
        self.price_per_item = 10  # 固定価格
    
    def add_item(self, product_id: int, quantity: int):
        if product_id in self.items:
            self.items[product_id] += quantity
        else:
            self.items[product_id] = quantity
    
    def remove_item(self, product_id: int):
        if product_id in self.items:
            del self.items[product_id]
    
    def update_quantity(self, product_id: int, quantity: int):
        if product_id in self.items:
            self.items[product_id] = quantity
    
    def get_quantity(self, product_id: int) -> int:
        return self.items.get(product_id, 0)
    
    def clear(self):
        self.items.clear()
    
    def total_quantity(self) -> int:
        return sum(self.items.values())
    
    def total_price(self) -> float:
        return sum(quantity * self.price_per_item for quantity in self.items.values())

# ステートフルテストの実行
TestShoppingCart = ShoppingCartStateMachine.TestCase

# 回帰テスト用の例
@given(st.lists(st.integers()))
@example([])  # 空リストの場合
@example([1])  # 単一要素の場合
@example([1, 2, 3, 4, 5])  # 順序リストの場合
@example([5, 4, 3, 2, 1])  # 逆順リストの場合
def test_list_operations_with_examples(numbers):
    """具体例付きリスト操作テスト"""
    from myapp.list_utils import process_list
    
    result = process_list(numbers)
    
    # 基本プロパティ
    assert isinstance(result, list)
    assert len(result) == len(numbers)
    
    # 空リストの特別処理
    if not numbers:
        assert result == []
    
    # 単一要素の処理
    if len(numbers) == 1:
        assert result[0] == numbers[0] * 2  # 仮の処理ルール

# データベースクエリのプロパティテスト
@given(
    st.lists(
        st.fixed_dictionaries({
            "id": st.integers(min_value=1),
            "name": st.text(min_size=1, max_size=50),
            "category": st.sampled_from(["A", "B", "C"])
        }),
        min_size=0,
        max_size=100
    )
)
def test_database_query_properties(records):
    """データベースクエリのプロパティテスト"""
    from myapp.database import QueryBuilder
    
    # テストデータの挿入
    query_builder = QueryBuilder()
    
    for record in records:
        query_builder.insert("products", record)
    
    # カテゴリ別検索のプロパティ
    for category in ["A", "B", "C"]:
        results = query_builder.select("products").where("category", category).execute()
        
        # プロパティ1: 結果の全てが指定カテゴリ
        for result in results:
            assert result["category"] == category
        
        # プロパティ2: 期待される数と一致
        expected_count = len([r for r in records if r["category"] == category])
        assert len(results) == expected_count
    
    # 範囲検索のプロパティ
    if records:
        min_id = min(r["id"] for r in records)
        max_id = max(r["id"] for r in records)
        
        results = query_builder.select("products").where("id", ">=", min_id).execute()
        assert len(results) == len(records)
        
        # 中間値での検索
        mid_id = (min_id + max_id) // 2
        results = query_builder.select("products").where("id", ">", mid_id).execute()
        expected_count = len([r for r in records if r["id"] > mid_id])
        assert len(results) == expected_count
```

続きを作成いたします。

