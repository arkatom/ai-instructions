# 高階関数

## 基本的な高階関数

```javascript
// カスタム map, filter, reduce
const map = (fn) => (array) => array.map(fn);
const filter = (predicate) => (array) => array.filter(predicate);
const reduce = (reducer, initial) => (array) => array.reduce(reducer, initial);

// 関数合成
const compose = (...fns) => (value) => 
  fns.reduceRight((acc, fn) => fn(acc), value);

const pipe = (...fns) => (value) => 
  fns.reduce((acc, fn) => fn(acc), value);

// 使用例
const numbers = [1, 2, 3, 4, 5];
const double = x => x * 2;
const isEven = x => x % 2 === 0;
const sum = (acc, x) => acc + x;

const processNumbers = pipe(
  map(double),
  filter(isEven),
  reduce(sum, 0)
);

console.log(processNumbers(numbers)); // 30
```

## 高度な配列操作

```javascript
// インデックス付きマップとフィルタ
const mapWithIndex = (fn) => (array) => 
  array.map((item, index) => fn(item, index));

const filterWithIndex = (predicate) => (array) =>
  array.filter((item, index) => predicate(item, index));

// 条件に基づく要素の取得
const takeWhile = (predicate) => (array) => {
  const result = [];
  for (const item of array) {
    if (predicate(item)) {
      result.push(item);
    } else {
      break;
    }
  }
  return result;
};

const dropWhile = (predicate) => (array) => {
  let dropping = true;
  return array.filter((item) => {
    if (dropping && predicate(item)) {
      return false;
    }
    dropping = false;
    return true;
  });
};

// 配列のチャンク化
const chunk = (size) => (array) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// 配列の zip操作
const zip = (...arrays) => {
  const length = Math.min(...arrays.map(arr => arr.length));
  return Array.from({ length }, (_, i) => arrays.map(arr => arr[i]));
};

const zipWith = (fn) => (...arrays) => {
  const length = Math.min(...arrays.map(arr => arr.length));
  return Array.from({ length }, (_, i) => 
    fn(...arrays.map(arr => arr[i]))
  );
};
```

## 関数デコレータ

```javascript
// メモ化
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// デバウンス
const debounce = (delay) => (fn) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// スロットリング
const throttle = (limit) => (fn) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// 再帰関数の最適化
const trampoline = (fn) => {
  return (...args) => {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result();
    }
    return result;
  };
};

// 使用例
const fibonacciTrampoline = trampoline((n, a = 0, b = 1) => {
  if (n === 0) return a;
  if (n === 1) return b;
  return () => fibonacciTrampoline(n - 1, b, a + b);
});
```

## トランスデューサ

```javascript
// トランスデューサの基本実装
const transducer = {
  map: (fn) => (reducer) => (acc, value) => reducer(acc, fn(value)),
  
  filter: (predicate) => (reducer) => (acc, value) => 
    predicate(value) ? reducer(acc, value) : acc,
    
  take: (n) => (reducer) => {
    let taken = 0;
    return (acc, value) => {
      if (taken >= n) return acc;
      taken++;
      return reducer(acc, value);
    };
  },
  
  drop: (n) => (reducer) => {
    let dropped = 0;
    return (acc, value) => {
      if (dropped < n) {
        dropped++;
        return acc;
      }
      return reducer(acc, value);
    };
  }
};

// トランスデューサの合成
const composeTransducers = (...transducers) => (reducer) =>
  transducers.reduceRight((acc, t) => t(acc), reducer);

const transduce = (transducer, reducer, initial, collection) =>
  collection.reduce(transducer(reducer), initial);

// 使用例
const xform = composeTransducers(
  transducer.map(x => x * 2),
  transducer.filter(x => x > 5),
  transducer.take(3)
);

const result = transduce(
  xform,
  (acc, value) => [...acc, value],
  [],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
);

console.log(result); // [6, 8, 10]
```