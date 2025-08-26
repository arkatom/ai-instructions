# パフォーマンス最適化とベストプラクティス

> 🎯 **目的**: Decoratorのパフォーマンス影響の理解と最適化手法
> 
> 📊 **対象**: メモリ効率、実行時オーバーヘッド、プロダクション設定
> 
> ⚡ **特徴**: ベンチマーク手法、キャッシュ戦略、Tree-shaking対応

## Decorator実行時パフォーマンス

```typescript
// パフォーマンス測定用Decorator
function BenchmarkDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  let callCount = 0;
  let totalTime = 0;
  let minTime = Infinity;
  let maxTime = 0;
  
  descriptor.value = function(...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        updateStats(duration);
      });
    } else {
      const duration = performance.now() - start;
      updateStats(duration);
      return result;
    }
    
    function updateStats(duration: number) {
      callCount++;
      totalTime += duration;
      minTime = Math.min(minTime, duration);
      maxTime = Math.max(maxTime, duration);
      
      if (callCount % 100 === 0) { // 100回ごとに統計を出力
        console.log(`${propertyKey} Stats (${callCount} calls):`);
        console.log(`  Average: ${(totalTime / callCount).toFixed(3)}ms`);
        console.log(`  Min: ${minTime.toFixed(3)}ms`);
        console.log(`  Max: ${maxTime.toFixed(3)}ms`);
      }
    }
  };
}

// Decorator適用時のオーバーヘッド分析
class PerformanceAnalysis {
  // Decoratorなしのメソッド
  plainMethod(n: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += i;
    }
    return sum;
  }
  
  // 単一Decoratorのメソッド
  @BenchmarkDecorator
  singleDecoratorMethod(n: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += i;
    }
    return sum;
  }
  
  // 複数Decoratorのメソッド
  @Log({ level: 'debug', includeResult: false })
  @Cache(300)
  @BenchmarkDecorator
  multiDecoratorMethod(n: number): number {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += i;
    }
    return sum;
  }
}

// パフォーマンステスト
function runPerformanceTest() {
  const analysis = new PerformanceAnalysis();
  const iterations = 10000;
  const n = 1000;
  
  console.log('Running performance analysis...');
  
  // Plain method test
  const plainStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    analysis.plainMethod(n);
  }
  const plainTime = performance.now() - plainStart;
  
  // Single decorator test
  const singleStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    analysis.singleDecoratorMethod(n);
  }
  const singleTime = performance.now() - singleStart;
  
  // Multi decorator test
  const multiStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    analysis.multiDecoratorMethod(n);
  }
  const multiTime = performance.now() - multiStart;
  
  console.log(`\nPerformance Results (${iterations} iterations):`);
  console.log(`Plain method: ${plainTime.toFixed(3)}ms`);
  console.log(`Single decorator: ${singleTime.toFixed(3)}ms (${((singleTime/plainTime - 1) * 100).toFixed(1)}% overhead)`);
  console.log(`Multi decorator: ${multiTime.toFixed(3)}ms (${((multiTime/plainTime - 1) * 100).toFixed(1)}% overhead)`);
}
```

## Memory-Efficient Decorators

```typescript
// メモリ効率的なDecorator実装パターン

// ❌ メモリリークの可能性がある実装
function BadCacheDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cache = new Map(); // これは全メソッドで共有され、クリアされない
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result); // 永続的にメモリに残る
    return result;
  };
}

// ✅ メモリ効率的な実装
interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  keyGenerator?: (...args: any[]) => string;
}

function EfficientCacheDecorator(options: CacheOptions = {}) {
  const { maxSize = 100, ttl = 300000, keyGenerator = JSON.stringify } = options;
  
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    // WeakMapを使用してインスタンスごとにキャッシュを分離
    const instanceCaches = new WeakMap();
    
    descriptor.value = function(...args: any[]) {
      let cache = instanceCaches.get(this);
      
      if (!cache) {
        cache = {
          data: new Map(),
          accessOrder: new Set()
        };
        instanceCaches.set(this, cache);
      }
      
      const key = keyGenerator(...args);
      const now = Date.now();
      
      // キャッシュから取得を試行
      const cached = cache.data.get(key);
      if (cached && now < cached.expiry) {
        // アクセス順序を更新（LRU用）
        cache.accessOrder.delete(key);
        cache.accessOrder.add(key);
        return cached.value;
      }
      
      // 期限切れエントリを削除
      if (cached) {
        cache.data.delete(key);
        cache.accessOrder.delete(key);
      }
      
      // サイズ制限チェック
      if (cache.data.size >= maxSize) {
        // 最も古いエントリを削除（LRU）
        const oldestKey = cache.accessOrder.values().next().value;
        cache.data.delete(oldestKey);
        cache.accessOrder.delete(oldestKey);
      }
      
      // 新しい値を計算してキャッシュ
      const result = originalMethod.apply(this, args);
      cache.data.set(key, {
        value: result,
        expiry: now + ttl
      });
      cache.accessOrder.add(key);
      
      return result;
    };
  };
}

// WeakMap/WeakSetを活用したクリーンアップ
class InstanceMetadata {
  private static metadataMap = new WeakMap();
  
  static set(instance: any, key: string, value: any): void {
    if (!this.metadataMap.has(instance)) {
      this.metadataMap.set(instance, new Map());
    }
    this.metadataMap.get(instance).set(key, value);
  }
  
  static get(instance: any, key: string): any {
    const instanceData = this.metadataMap.get(instance);
    return instanceData ? instanceData.get(key) : undefined;
  }
}

function MemoryEfficientDecorator(options: any = {}) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      // インスタンスごとのメタデータを使用
      let callCount = InstanceMetadata.get(this, `${propertyKey}:callCount`) || 0;
      callCount++;
      InstanceMetadata.set(this, `${propertyKey}:callCount`, callCount);
      
      return originalMethod.apply(this, args);
    };
  };
}
```

## 最適化されたMetadata使用パターン

```typescript
// ❌ 非効率的なメタデータアクセス
function InEfficientValidation(target: any, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    set: function(value: any) {
      // 毎回メタデータを取得（非効率）
      const rules = Reflect.getMetadata('validation:rules', this.constructor, propertyKey);
      const type = Reflect.getMetadata('validation:type', this.constructor, propertyKey);
      const required = Reflect.getMetadata('validation:required', this.constructor, propertyKey);
      
      // 検証処理
      this[`_${propertyKey}`] = value;
    },
    get: function() {
      return this[`_${propertyKey}`];
    }
  });
}

// ✅ 効率的なメタデータキャッシュ
class MetadataCache {
  private static cache = new WeakMap<any, Map<string, any>>();
  
  static getValidationMetadata(target: any, propertyKey: string) {
    if (!this.cache.has(target)) {
      this.cache.set(target, new Map());
    }
    
    const targetCache = this.cache.get(target)!;
    const cacheKey = `validation:${propertyKey}`;
    
    if (!targetCache.has(cacheKey)) {
      // 一度だけメタデータを収集してキャッシュ
      const metadata = {
        rules: Reflect.getMetadata('validation:rules', target, propertyKey) || [],
        type: Reflect.getMetadata('validation:type', target, propertyKey),
        required: Reflect.getMetadata('validation:required', target, propertyKey) || false
      };
      targetCache.set(cacheKey, metadata);
    }
    
    return targetCache.get(cacheKey);
  }
}

function EfficientValidation(target: any, propertyKey: string) {
  const metadata = MetadataCache.getValidationMetadata(target.constructor, propertyKey);
  
  Object.defineProperty(target, propertyKey, {
    set: function(value: any) {
      // キャッシュされたメタデータを使用
      if (metadata.required && (value == null || value === '')) {
        throw new Error(`${propertyKey} is required`);
      }
      
      for (const rule of metadata.rules) {
        // ルール検証
      }
      
      this[`_${propertyKey}`] = value;
    },
    get: function() {
      return this[`_${propertyKey}`];
    }
  });
}
```

## Production Ready設定

```typescript
// 本番環境用のTypeScript設定
const PRODUCTION_CONFIG = {
  // tsconfig.json
  compilerOptions: {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "node",
    
    // Decorators設定
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    
    // 最適化
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    
    // 出力設定
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false, // Decoratorのメタデータ保持用
    
    // モジュール設定
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
};

// Webpack設定例
const WEBPACK_CONFIG = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // TypeScript設定
              compilerOptions: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
              }
            }
          }
        ]
      }
    ]
  },
  optimization: {
    // Tree-shakingでDecorator関連のコードが削除されないよう注意
    sideEffects: false,
    usedExports: true
  }
};

// Vite設定例
const VITE_CONFIG = {
  esbuild: {
    // ESBuildでのDecorator対応
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false
      }
    }
  },
  define: {
    // reflect-metadataのポリフィル設定
    'Reflect.metadata': 'Reflect.metadata'
  }
};
```

## Tree-shaking対応パターン

```typescript
// Tree-shaking対応のDecorator実装
// ❌ Tree-shakingで削除される可能性
const decorators = {
  Log: function(options: any) { /* ... */ },
  Cache: function(options: any) { /* ... */ },
  Validate: function(rules: any) { /* ... */ }
};

// ✅ Tree-shaking対応
export function Log(options: LoggingOptions = { level: 'info' }) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 実装...
  };
}

export function Cache(ttl: number = 300) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 実装...
  };
}

export function Validate(rules: ValidationRule[]) {
  return function(target: any, propertyKey: string) {
    // 実装...
  };
}

// 条件付きでDecoratorを適用（開発時のみなど）
function conditionalDecorator(
  condition: boolean,
  decorator: (...args: any[]) => any,
  ...args: any[]
) {
  if (condition) {
    return decorator(...args);
  }
  return function(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    // 何もしない
    return descriptor || target;
  };
}

// 使用例
const DEBUG = process.env.NODE_ENV === 'development';

class ApiService {
  @conditionalDecorator(DEBUG, Log, { level: 'debug' })
  async fetchData(url: string) {
    return fetch(url);
  }
}
```