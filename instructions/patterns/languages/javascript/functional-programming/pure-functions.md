# 純粋関数と副作用

## 純粋関数の基本原則

```javascript
// 純粋関数の例
const add = (a, b) => a + b;
const multiply = (x, y) => x * y;
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

// 不純な関数とその純粋版
// 不純: 外部状態に依存
let counter = 0;
const impureIncrement = () => ++counter;

// 純粋: 新しい状態を返す
const pureIncrement = (count) => count + 1;

// 不純: 入力を変更
const impurePush = (arr, item) => {
  arr.push(item);
  return arr;
};

// 純粋: 新しい配列を返す
const purePush = (arr, item) => [...arr, item];
```

## 副作用の管理

```javascript
// 副作用を純粋関数で包む
const createEffectWrapper = (sideEffect) => {
  return (pureFunction) => {
    return (...args) => {
      const result = pureFunction(...args);
      sideEffect(result);
      return result;
    };
  };
};

const logEffect = createEffectWrapper(console.log);
const addWithLogging = logEffect(add);

const result = addWithLogging(2, 3); // Logs: 5, Returns: 5

// IO操作を純粋関数として表現
const createIO = (effect) => ({
  effect,
  map: (fn) => createIO(() => fn(effect())),
  flatMap: (fn) => createIO(() => fn(effect()).effect()),
  run: () => effect()
});

const readFile = (filename) => createIO(() => {
  return `Contents of ${filename}`;
});

const processFile = (content) => content.toUpperCase();

const fileOperation = readFile('test.txt')
  .map(processFile)
  .map(content => `Processed: ${content}`);

console.log(fileOperation.run());
```

## 状態管理パターン

```javascript
// 状態更新を純粋関数で行う
const updateState = (state, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
    case 'SET_NAME':
      return { ...state, name: action.payload };
    default:
      return state;
  }
};

// レンズパターンで深いオブジェクトを操作
const lens = (getter, setter) => ({
  get: getter,
  set: setter,
  over: (fn) => (obj) => setter(fn(getter(obj)))(obj)
});

const prop = (key) => lens(
  obj => obj[key],
  value => obj => ({ ...obj, [key]: value })
);

const path = (keys) => keys.reduce((acc, key) => 
  lens(
    obj => acc.get(obj)[key],
    value => obj => acc.set({ ...acc.get(obj), [key]: value })(obj)
  ),
  lens(x => x, value => _ => value)
);

// 使用例
const user = { name: 'John', address: { city: 'Tokyo', zip: '123' } };
const nameLens = prop('name');
const cityLens = path(['address', 'city']);

const newUser = cityLens.set('Osaka')(user);
const upperName = nameLens.over(str => str.toUpperCase())(user);
```

## エラーハンドリング

```javascript
// Result型でエラーを管理
const Result = {
  Ok: (value) => ({ type: 'Ok', value }),
  Error: (error) => ({ type: 'Error', error }),
  
  map: (fn) => (result) => 
    result.type === 'Ok' ? Result.Ok(fn(result.value)) : result,
    
  flatMap: (fn) => (result) => 
    result.type === 'Ok' ? fn(result.value) : result,
    
  unwrapOr: (defaultValue) => (result) =>
    result.type === 'Ok' ? result.value : defaultValue
};

// 純粋な計算でエラーハンドリング
const safeDivide = (a, b) => 
  b === 0 ? Result.Error('Division by zero') : Result.Ok(a / b);

const calculate = (x, y, z) =>
  Result.flatMap(result1 =>
    Result.map(result2 => result1 + result2)(safeDivide(y, z))
  )(safeDivide(x, 2));

console.log(calculate(10, 4, 2)); // Ok(7)
console.log(calculate(10, 4, 0)); // Error('Division by zero')
```