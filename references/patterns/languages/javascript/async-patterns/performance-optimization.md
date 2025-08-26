# パフォーマンス最適化

## 並列実行の最適化

```javascript
// ❌ 悪い例：順次実行
async function slowProcess() {
  const user = await fetchUser();
  const posts = await fetchPosts();
  const comments = await fetchComments();
  return { user, posts, comments };
}

// ✅ 良い例：並列実行
async function fastProcess() {
  const [user, posts, comments] = await Promise.all([
    fetchUser(),
    fetchPosts(),
    fetchComments()
  ]);
  return { user, posts, comments };
}

// ✅ エラー処理も考慮した並列実行
async function robustProcess() {
  const results = await Promise.allSettled([
    fetchUser(),
    fetchPosts(),
    fetchComments()
  ]);
  
  return results.reduce((acc, result, index) => {
    const keys = ['user', 'posts', 'comments'];
    acc[keys[index]] = result.status === 'fulfilled' 
      ? result.value 
      : null;
    return acc;
  }, {});
}
```

## メモリ効率の改善

```javascript
// 大量データの効率的な処理
async function* processLargeDataset(dataSource) {
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const batch = await dataSource.fetch(offset, batchSize);
    if (batch.length === 0) break;
    
    for (const item of batch) {
      yield processItem(item);
    }
    
    offset += batchSize;
    // メモリ解放のための一時停止
    await new Promise(r => setImmediate(r));
  }
}

// WeakMapを使用したキャッシュ
const cache = new WeakMap();
async function cachedOperation(obj) {
  if (cache.has(obj)) {
    return cache.get(obj);
  }
  
  const result = await expensiveOperation(obj);
  cache.set(obj, result);
  return result;
}
```

## デバウンスとスロットリング

```javascript
// デバウンス実装
function debounceAsync(fn, delay) {
  let timeoutId;
  let pendingPromise;
  
  return (...args) => {
    clearTimeout(timeoutId);
    
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pendingPromise = null;
          }
        }, delay);
      });
    }
    
    return pendingPromise;
  };
}

// スロットリング実装
function throttleAsync(fn, interval) {
  let lastCallTime = 0;
  let lastCallPromise;
  
  return async (...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall >= interval) {
      lastCallTime = now;
      lastCallPromise = fn(...args);
      return lastCallPromise;
    }
    
    return lastCallPromise || Promise.resolve();
  };
}
```

## リソース管理

```javascript
// 接続プール
class ConnectionPool {
  constructor(maxConnections = 10) {
    this.connections = [];
    this.available = [];
    this.waiting = [];
    this.maxConnections = maxConnections;
  }
  
  async acquire() {
    if (this.available.length > 0) {
      return this.available.pop();
    }
    
    if (this.connections.length < this.maxConnections) {
      const conn = await this.createConnection();
      this.connections.push(conn);
      return conn;
    }
    
    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }
  
  release(conn) {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(conn);
    } else {
      this.available.push(conn);
    }
  }
  
  async withConnection(fn) {
    const conn = await this.acquire();
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }
}
```

## 早期リターンとショートサーキット

```javascript
// 条件付き実行の最適化
async function optimizedFetch(id, options = {}) {
  // キャッシュチェック（高速パス）
  const cached = await cache.get(id);
  if (cached && !options.force) {
    return cached;
  }
  
  // バリデーション（早期リターン）
  if (!isValidId(id)) {
    throw new Error('Invalid ID');
  }
  
  // 実際のフェッチ（低速パス）
  const data = await fetch(`/api/items/${id}`);
  await cache.set(id, data);
  return data;
}

// Promise.raceによる早期終了
async function fetchWithTimeout(url, timeout = 5000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}
```

## ベストプラクティス

1. **並列化を最大限活用** - 独立したタスクは必ずPromise.allで並列実行
2. **適切なキャッシュ戦略** - 頻繁にアクセスされるデータはメモ化
3. **リソースの適切な管理** - 接続プールやセマフォでリソース制限
4. **ストリーミング処理** - 大量データは一度に処理せずストリーム化
5. **早期リターン** - 不要な処理を避けて高速パスを優先
6. **エラー境界の設定** - エラーが全体に波及しないよう部分的な失敗を許容