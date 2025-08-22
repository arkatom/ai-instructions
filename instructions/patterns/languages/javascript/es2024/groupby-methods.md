# Object.groupBy() と Map.groupBy()

ES2024で追加された配列要素のグループ化メソッド。

## 基本的な使い方

```javascript
// Object.groupBy() - キー関数で配列要素をグループ化
const products = [
  { id: 1, category: 'electronics', price: 100 },
  { id: 2, category: 'books', price: 20 },
  { id: 3, category: 'electronics', price: 200 },
  { id: 4, category: 'books', price: 15 }
];

// カテゴリでグループ化
const groupedByCategory = Object.groupBy(products, product => product.category);
console.log(groupedByCategory);
// {
//   electronics: [{ id: 1, ... }, { id: 3, ... }],
//   books: [{ id: 2, ... }, { id: 4, ... }]
// }

// 価格帯でグループ化
const groupedByPriceRange = Object.groupBy(products, product => {
  if (product.price < 50) return 'cheap';
  if (product.price < 150) return 'medium';
  return 'expensive';
});
```

## Map.groupBy()

```javascript
// Map.groupBy() - Mapを返すバージョン
const mapGrouped = Map.groupBy(products, product => product.category);
console.log(mapGrouped.get('electronics'));

// Mapの利点：任意のオブジェクトをキーに使える
const complexKeyGroups = Map.groupBy(products, product => ({
  category: product.category,
  priceRange: product.price > 50 ? 'high' : 'low'
}));
```

## 高度なパターン

```javascript
class ProductAnalyzer {
  // 複数のキー関数でグループ化
  static groupByMultipleKeys(products, keyFunctions) {
    return keyFunctions.reduce((acc, keyFn, index) => {
      const key = `group_${index}`;
      acc[key] = Object.groupBy(products, keyFn);
      return acc;
    }, {});
  }

  // ネストされたグループ化
  static nestedGroupBy(products, primaryKey, secondaryKey) {
    const primaryGroups = Object.groupBy(products, primaryKey);
    
    return Object.fromEntries(
      Object.entries(primaryGroups).map(([key, items]) => [
        key,
        Object.groupBy(items, secondaryKey)
      ])
    );
  }
}

// 使用例
const multipleGroups = ProductAnalyzer.groupByMultipleKeys(products, [
  p => p.category,
  p => p.price > 50 ? 'expensive' : 'cheap'
]);

const nestedGroups = ProductAnalyzer.nestedGroupBy(
  products,
  p => p.category,
  p => p.price > 50 ? 'expensive' : 'cheap'
);
```

## ユースケース

- データ分析・集計
- UIでのカテゴリ別表示
- レポート生成
- フィルタリング機能の実装