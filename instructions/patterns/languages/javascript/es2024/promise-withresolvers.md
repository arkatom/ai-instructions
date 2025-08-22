# Promise.withResolvers()

外部からresolve/rejectを制御できるPromiseパターン。

## 基本的な使い方

```javascript
// Promise.withResolvers() - 外部制御可能なPromiseを作成
function createManualPromise() {
  const { promise, resolve, reject } = Promise.withResolvers();
  
  // 外部からresolve/reject可能
  setTimeout(() => {
    resolve('Resolved after 1 second');
  }, 1000);
  
  return { promise, resolve, reject };
}

// 使用例
const { promise, resolve } = createManualPromise();
promise.then(result => console.log(result));
// 外部から制御
resolve('Early resolution');
```

## イベント駆動Promise

```javascript
class EventDrivenPromise {
  constructor() {
    const { promise, resolve, reject } = Promise.withResolvers();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
    this.listeners = new Set();
  }

  onResolve(callback) {
    this.listeners.add(callback);
    this.promise.then(callback);
    return this;
  }

  onReject(callback) {
    this.promise.catch(callback);
    return this;
  }

  resolveWith(value) {
    this.listeners.forEach(listener => listener(value));
    this.resolve(value);
  }

  rejectWith(error) {
    this.reject(error);
  }
}
```

## リクエストキュー実装

```javascript
class RequestQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(requestFn) {
    const { promise, resolve, reject } = Promise.withResolvers();
    
    this.queue.push({ requestFn, resolve, reject });
    this.processQueue();
    return promise;
  }

  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { requestFn, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}

// 使用例
const queue = new RequestQueue(2);
queue.add(() => fetch('/api/data1'));
queue.add(() => fetch('/api/data2'));
queue.add(() => fetch('/api/data3'));
```

## ユースケース

- 非同期操作の手動制御
- リクエストキューの実装
- イベント駆動のPromise管理
- タイムアウト処理の実装