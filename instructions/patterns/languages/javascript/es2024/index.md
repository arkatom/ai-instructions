# JavaScript ES2024 パターン索引

ES2024の新機能と最新のJavaScriptパターン集（各100行以下）。

## 🆕 ES2024新機能

- [Object.groupByとMap.groupBy](./groupby-methods.md) - 配列グループ化
- [Promise.withResolvers](./promise-withresolvers.md) - 外部制御Promise
- [Temporal API](./temporal-api.md) - 日付時刻の新標準
- [正規表現v flag](./regexp-v-flag.md) - Unicode対応強化
- [ArrayBuffer転送](./arraybuffer-transfer.md) - 効率的なバッファ操作

## 🔧 モダンパターン

- [配列メソッド](./array-methods.md) - toSorted, toReversed等
- [オブジェクトメソッド](./object-methods.md) - structuredClone等
- [文字列メソッド](./string-methods.md) - isWellFormed, toWellFormed
- [イテレータとジェネレータ](./iterator-generator.md) - 高度な反復処理
- [モジュールパターン](./module-patterns.md) - ESMの活用

## 🎯 実用パターン

- [エラーハンドリング](./error-handling.md) - モダンなエラー処理
- [パフォーマンス最適化](./performance-optimization.md) - 高速化テクニック
- [DOM操作パターン](./dom-patterns.md) - 効率的なDOM更新
- [非同期パターン](./async-patterns.md) - 並行処理と制御
- [関数型パターン](./functional-patterns.md) - 関数型プログラミング

## 💡 クイックスタート（20行）

```javascript
// ES2024の主要機能サンプル
const data = [
  { category: 'A', value: 1 },
  { category: 'B', value: 2 },
  { category: 'A', value: 3 }
];

// Object.groupBy
const grouped = Object.groupBy(data, item => item.category);

// Promise.withResolvers
const { promise, resolve } = Promise.withResolvers();
setTimeout(() => resolve('done'), 1000);

// Array methods (non-mutating)
const sorted = [3, 1, 2].toSorted();
const reversed = [1, 2, 3].toReversed();

// Well-formed strings
const str = "\\uD800"; // 不正なUnicode
console.log(str.isWellFormed()); // false
console.log(str.toWellFormed()); // �
```

## 📚 参考資料

- [ECMAScript 2024仕様](https://tc39.es/ecma262/)
- [TC39 Proposals](https://github.com/tc39/proposals)
- [MDN Web Docs](https://developer.mozilla.org/)