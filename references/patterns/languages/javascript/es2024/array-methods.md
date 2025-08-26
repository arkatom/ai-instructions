# 非破壊的配列メソッド

ES2024で追加された元の配列を変更しない新メソッド。

## toSorted() - 非破壊ソート

```javascript
const numbers = [3, 1, 4, 1, 5];

// 従来のsort()は元配列を変更
const sorted1 = numbers.sort(); // numbers自体が変更される

// toSorted()は新しい配列を返す
const sorted2 = numbers.toSorted(); // numbersは変更されない
console.log(numbers); // [3, 1, 4, 1, 5]
console.log(sorted2); // [1, 1, 3, 4, 5]

// カスタムソート
const items = [{id: 3}, {id: 1}, {id: 2}];
const sortedItems = items.toSorted((a, b) => a.id - b.id);
```

## toReversed() - 非破壊逆順

```javascript
const arr = [1, 2, 3, 4, 5];

// toReversed()は新しい配列を返す
const reversed = arr.toReversed();
console.log(arr);      // [1, 2, 3, 4, 5]
console.log(reversed); // [5, 4, 3, 2, 1]
```

## toSpliced() - 非破壊スプライス

```javascript
const colors = ['red', 'green', 'blue'];

// toSpliced(start, deleteCount, ...items)
const modified = colors.toSpliced(1, 1, 'yellow', 'orange');
console.log(colors);   // ['red', 'green', 'blue']
console.log(modified); // ['red', 'yellow', 'orange', 'blue']

// 要素の削除
const removed = colors.toSpliced(1, 1);
// ['red', 'blue']

// 要素の挿入
const inserted = colors.toSpliced(1, 0, 'purple');
// ['red', 'purple', 'green', 'blue']
```

## with() - インデックス指定更新

```javascript
const arr = [1, 2, 3, 4, 5];

// with(index, value) - 指定インデックスの値を更新
const updated = arr.with(2, 99);
console.log(arr);     // [1, 2, 3, 4, 5]
console.log(updated); // [1, 2, 99, 4, 5]

// 負のインデックスも使用可能
const last = arr.with(-1, 100);
console.log(last); // [1, 2, 3, 4, 100]
```

## 実用例

```javascript
// イミュータブルな状態管理
function updateTodoList(todos, id, updates) {
  const index = todos.findIndex(todo => todo.id === id);
  if (index === -1) return todos;
  
  const updatedTodo = { ...todos[index], ...updates };
  return todos.with(index, updatedTodo);
}

// パイプライン処理
const result = data
  .toSorted((a, b) => a.priority - b.priority)
  .toReversed()
  .toSpliced(0, 1)
  .with(0, { ...data[0], processed: true });
```