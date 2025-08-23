# モナドとファンクタ

## Maybe モナド

```javascript
// Maybe モナドの実装
class Maybe {
  constructor(value) {
    this.value = value;
  }
  
  static of(value) {
    return new Maybe(value);
  }
  
  static nothing() {
    return new Maybe(null);
  }
  
  static some(value) {
    return value == null ? Maybe.nothing() : Maybe.of(value);
  }
  
  isNothing() {
    return this.value === null || this.value === undefined;
  }
  
  map(fn) {
    return this.isNothing() ? Maybe.nothing() : Maybe.of(fn(this.value));
  }
  
  flatMap(fn) {
    return this.isNothing() ? Maybe.nothing() : fn(this.value);
  }
  
  filter(predicate) {
    return this.isNothing() || !predicate(this.value) ? 
      Maybe.nothing() : this;
  }
  
  getOrElse(defaultValue) {
    return this.isNothing() ? defaultValue : this.value;
  }
  
  orElse(alternativeMaybe) {
    return this.isNothing() ? alternativeMaybe : this;
  }
}

// 安全な計算例
const safeDivide = (a, b) => 
  b === 0 ? Maybe.nothing() : Maybe.of(a / b);

const safeRoot = (x) => 
  x < 0 ? Maybe.nothing() : Maybe.of(Math.sqrt(x));

const safeParse = (str) => {
  try {
    return Maybe.of(JSON.parse(str));
  } catch {
    return Maybe.nothing();
  }
};

// チェーン操作
const processValue = (x) =>
  Maybe.of(x)
    .flatMap(val => safeDivide(val, 2))
    .flatMap(safeRoot)
    .map(result => Math.round(result * 100) / 100);

console.log(processValue(8).getOrElse(0)); // 2
console.log(processValue(-4).getOrElse(0)); // 0
```

## Either モナド

```javascript
// Either モナド（Left/Right）
class Either {
  constructor(value, isLeft = false) {
    this.value = value;
    this.isLeft = isLeft;
  }
  
  static left(value) {
    return new Either(value, true);
  }
  
  static right(value) {
    return new Either(value, false);
  }
  
  map(fn) {
    return this.isLeft ? this : Either.right(fn(this.value));
  }
  
  flatMap(fn) {
    return this.isLeft ? this : fn(this.value);
  }
  
  mapLeft(fn) {
    return this.isLeft ? Either.left(fn(this.value)) : this;
  }
  
  fold(leftFn, rightFn) {
    return this.isLeft ? leftFn(this.value) : rightFn(this.value);
  }
  
  getOrElse(defaultValue) {
    return this.isLeft ? defaultValue : this.value;
  }
}

// エラーハンドリングでの使用
const validateAge = (age) =>
  age < 0 ? Either.left('年齢は負数にできません') :
  age > 150 ? Either.left('年齢が不正です') :
  Either.right(age);

const validateName = (name) =>
  !name || name.trim().length === 0 ? 
    Either.left('名前は必須です') :
    Either.right(name.trim());

const createUser = (name, age) =>
  validateName(name)
    .flatMap(validName =>
      validateAge(age).map(validAge => ({ name: validName, age: validAge }))
    );

const user1 = createUser('John', 30);
const user2 = createUser('', -5);

console.log(user1.getOrElse(null)); // { name: 'John', age: 30 }
console.log(user2.fold(error => `Error: ${error}`, user => user)); // Error: 名前は必須です
```

## IO モナド

```javascript
// IO モナドで副作用を管理
class IO {
  constructor(effect) {
    this.effect = effect;
  }
  
  static of(value) {
    return new IO(() => value);
  }
  
  map(fn) {
    return new IO(() => fn(this.effect()));
  }
  
  flatMap(fn) {
    return new IO(() => fn(this.effect()).effect());
  }
  
  run() {
    return this.effect();
  }
}

// IO操作の例
const readFile = (filename) => new IO(() => {
  // 実際のファイル読み込み（簡略化）
  return `Contents of ${filename}`;
});

const writeFile = (filename, content) => new IO(() => {
  // 実際のファイル書き込み（簡略化）
  console.log(`Writing to ${filename}: ${content}`);
  return `Written to ${filename}`;
});

const log = (message) => new IO(() => {
  console.log(message);
  return message;
});

// IO操作の合成
const processFile = (inputFile, outputFile) =>
  readFile(inputFile)
    .flatMap(content => log(`Processing: ${content}`))
    .map(content => content.toUpperCase())
    .flatMap(processedContent => 
      writeFile(outputFile, processedContent)
    );

// 実行時まで副作用を遅延
const fileOperation = processFile('input.txt', 'output.txt');
// まだ実行されていない

fileOperation.run(); // ここで実行される
```

## Task モナド（非同期操作）

```javascript
// 非同期操作のためのTask モナド
class Task {
  constructor(executor) {
    this.executor = executor;
  }
  
  static of(value) {
    return new Task(resolve => resolve(value));
  }
  
  static rejected(error) {
    return new Task((_, reject) => reject(error));
  }
  
  map(fn) {
    return new Task((resolve, reject) => {
      this.executor(
        value => resolve(fn(value)),
        reject
      );
    });
  }
  
  flatMap(fn) {
    return new Task((resolve, reject) => {
      this.executor(
        value => fn(value).executor(resolve, reject),
        reject
      );
    });
  }
  
  mapError(fn) {
    return new Task((resolve, reject) => {
      this.executor(
        resolve,
        error => reject(fn(error))
      );
    });
  }
  
  run() {
    return new Promise((resolve, reject) => {
      this.executor(resolve, reject);
    });
  }
  
  static all(tasks) {
    return new Task((resolve, reject) => {
      Promise.all(tasks.map(task => task.run()))
        .then(resolve)
        .catch(reject);
    });
  }
}

// 非同期操作の例
const fetchUser = (id) => new Task((resolve, reject) => {
  setTimeout(() => {
    if (id > 0) {
      resolve({ id, name: `User ${id}` });
    } else {
      reject(new Error('Invalid user ID'));
    }
  }, 100);
});

const fetchPosts = (userId) => new Task((resolve, reject) => {
  setTimeout(() => {
    resolve([
      { id: 1, title: 'Post 1', userId },
      { id: 2, title: 'Post 2', userId }
    ]);
  }, 150);
});

// Task の合成
const getUserWithPosts = (id) =>
  fetchUser(id)
    .flatMap(user =>
      fetchPosts(user.id)
        .map(posts => ({ ...user, posts }))
    );

getUserWithPosts(1)
  .run()
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

## ファンクタ法則

```javascript
// ファンクタ法則の検証
const testFunctorLaws = (Functor, value) => {
  const f = x => x * 2;
  const g = x => x + 1;
  const id = x => x;
  
  // 恒等法則: F.of(a).map(id) === F.of(a)
  const identity1 = Functor.of(value).map(id);
  const identity2 = Functor.of(value);
  
  // 合成法則: F.of(a).map(x => g(f(x))) === F.of(a).map(f).map(g)
  const composition1 = Functor.of(value).map(x => g(f(x)));
  const composition2 = Functor.of(value).map(f).map(g);
  
  console.log('Identity law:', JSON.stringify(identity1) === JSON.stringify(identity2));
  console.log('Composition law:', JSON.stringify(composition1) === JSON.stringify(composition2));
};

// Maybe ファンクタで検証
testFunctorLaws(Maybe, 5);
```