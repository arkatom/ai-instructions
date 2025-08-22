# トラブルシューティングとマイグレーション

> 🎯 **目的**: Decorator実装時の問題解決とLegacy版からの移行戦略
> 
> 📊 **対象**: よくある問題、デバッグ手法、テスト戦略、エラー処理
> 
> ⚡ **特徴**: 実践的な問題解決、段階的移行、デバッグツール

## 一般的な問題と解決策

```typescript
// 問題1: "experimentalDecorators" エラー
// 解決策: tsconfig.jsonの設定確認
/*
tsconfig.json:
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
*/

// 問題2: メタデータが undefined になる
// 解決策: reflect-metadataのimportと順序確認
import 'reflect-metadata'; // 必ず他のimportより先に

// 問題3: Decorator適用順序の問題
// 解決策: Decoratorは下から上に適用される
class Example {
  @LogEnd      // 3番目に実行
  @Cache       // 2番目に実行  
  @LogStart    // 1番目に実行
  method() {}
}

// 問題4: "useDefineForClassFields" 互換性問題
// 解決策: falseに設定
/*
tsconfig.json:
{
  "compilerOptions": {
    "useDefineForClassFields": false
  }
}
*/

// 問題5: Webpack/Viteでのメタデータ消失
// 解決策: バンドラー設定の調整
const webpackConfig = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              emitDecoratorMetadata: true
            }
          }
        }
      }
    ]
  }
};
```

## Legacy Decoratorからの移行

```typescript
// Legacy Decorator (TypeScript 4.x以前)
function LegacyLogger(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  descriptor.value = function(...args: any[]) {
    console.log(`Calling ${propertyName}`, args);
    const result = method.apply(this, args);
    console.log(`Finished ${propertyName}`, result);
    return result;
  };
}

// Stage 3 Decorator (TypeScript 5.0+)
function ModernLogger(target: any, context: ClassMethodDecoratorContext) {
  const methodName = String(context.name);
  
  return function(...args: any[]) {
    console.log(`Calling ${methodName}`, args);
    const result = target.apply(this, args);
    console.log(`Finished ${methodName}`, result);
    return result;
  };
}

// 互換性を保つラッパー
function UniversalLogger(target: any, contextOrPropertyName?: any, descriptor?: PropertyDescriptor) {
  // Legacy Decorator検出
  if (typeof contextOrPropertyName === 'string' && descriptor) {
    const method = descriptor.value;
    descriptor.value = function(...args: any[]) {
      console.log(`Calling ${contextOrPropertyName}`, args);
      const result = method.apply(this, args);
      console.log(`Finished ${contextOrPropertyName}`, result);
      return result;
    };
    return;
  }
  
  // Stage 3 Decorator
  const methodName = String(contextOrPropertyName.name);
  return function(...args: any[]) {
    console.log(`Calling ${methodName}`, args);
    const result = target.apply(this, args);
    console.log(`Finished ${methodName}`, result);
    return result;
  };
}

// 段階的移行戦略
// 1. 既存のLegacy Decoratorを特定
// 2. 新しいDecoratorを作成（両方式をサポート）
// 3. 段階的に置き換え
// 4. TypeScript設定を更新
// 5. Legacy Decoratorを削除
```

## デバッグとテスト戦略

```typescript
// Decoratorのデバッグ用ヘルパー
function DebugDecorator(name: string) {
  return function(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    console.log(`Debug: ${name} decorator applied to`, {
      target: target.constructor?.name || target.name,
      propertyKey,
      hasDescriptor: !!descriptor
    });
    
    if (descriptor && typeof descriptor.value === 'function') {
      const originalMethod = descriptor.value;
      descriptor.value = function(...args: any[]) {
        console.log(`Debug: Calling ${name}(${propertyKey})`, args);
        const result = originalMethod.apply(this, args);
        console.log(`Debug: ${name}(${propertyKey}) returned`, result);
        return result;
      };
    }
  };
}

// メタデータ検証ツール
function inspectMetadata(target: any, propertyKey?: string) {
  console.log('=== Metadata Inspection ===');
  console.log('Target:', target.constructor?.name || target.name);
  console.log('Property:', propertyKey || 'class-level');
  
  // 型メタデータ
  if (propertyKey) {
    const designType = Reflect.getMetadata('design:type', target, propertyKey);
    const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
    const returnType = Reflect.getMetadata('design:returntype', target, propertyKey);
    
    console.log('Design metadata:');
    console.log('  Type:', designType?.name);
    console.log('  Param types:', paramTypes?.map((t: any) => t.name));
    console.log('  Return type:', returnType?.name);
  }
  
  // カスタムメタデータ
  const metadataKeys = Reflect.getMetadataKeys(target, propertyKey);
  console.log('Custom metadata keys:', metadataKeys);
  
  metadataKeys.forEach(key => {
    if (!key.startsWith('design:')) {
      const value = Reflect.getMetadata(key, target, propertyKey);
      console.log(`  ${key}:`, value);
    }
  });
  
  console.log('========================');
}

// Decoratorのテスト用ユーティリティ
class DecoratorTestHelper {
  static createMockDescriptor(originalValue: Function): PropertyDescriptor {
    return {
      value: originalValue,
      writable: true,
      enumerable: true,
      configurable: true
    };
  }
  
  static createMockContext(name: string, kind: string = 'method'): any {
    return {
      name,
      kind,
      static: false,
      private: false
    };
  }
  
  static testDecorator(
    decorator: Function,
    testFunction: Function,
    ...decoratorArgs: any[]
  ) {
    const target = { testMethod: testFunction };
    const descriptor = this.createMockDescriptor(testFunction);
    const context = this.createMockContext('testMethod');
    
    // Decoratorを適用
    if (decoratorArgs.length > 0) {
      const decoratorFactory = decorator(...decoratorArgs);
      decoratorFactory(target, 'testMethod', descriptor);
    } else {
      decorator(target, 'testMethod', descriptor);
    }
    
    return {
      target,
      descriptor,
      decoratedMethod: descriptor.value
    };
  }
}

// テスト例
function testLogDecorator() {
  const originalFunction = function(a: number, b: number) {
    return a + b;
  };
  
  const testResult = DecoratorTestHelper.testDecorator(
    Log, 
    originalFunction, 
    { level: 'debug' }
  );
  
  // テスト実行
  console.log('Testing decorated method...');
  const result = testResult.decoratedMethod.call({}, 2, 3);
  console.log('Result:', result);
}

// パフォーマンステスト
function benchmarkDecorator(
  decorator: Function,
  testFunction: Function,
  iterations: number = 10000
) {
  // 装飾なしの実行時間
  const plainStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    testFunction(i);
  }
  const plainTime = performance.now() - plainStart;
  
  // 装飾ありの実行時間
  const { decoratedMethod } = DecoratorTestHelper.testDecorator(decorator, testFunction);
  const decoratedStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    decoratedMethod.call({}, i);
  }
  const decoratedTime = performance.now() - decoratedStart;
  
  const overhead = ((decoratedTime / plainTime - 1) * 100).toFixed(2);
  console.log(`Decorator Performance:`);
  console.log(`  Plain: ${plainTime.toFixed(3)}ms`);
  console.log(`  Decorated: ${decoratedTime.toFixed(3)}ms`);
  console.log(`  Overhead: ${overhead}%`);
}
```

## エラー処理パターン

```typescript
// Decorator内でのエラーハンドリング
function SafeDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    try {
      const result = originalMethod.apply(this, args);
      
      // Promise の場合は .catch() で処理
      if (result instanceof Promise) {
        return result.catch((error: any) => {
          console.error(`Error in ${propertyKey}:`, error);
          throw error; // 元のエラーを再スロー
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      // カスタムエラー処理
      if (error instanceof TypeError) {
        throw new Error(`Type error in ${propertyKey}: ${error.message}`);
      }
      throw error;
    }
  };
}

// Decorator適用時のエラー検証
function ValidatedDecorator(validationFn: (target: any, key: string) => boolean) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!validationFn(target, propertyKey)) {
      throw new Error(`Decorator validation failed for ${target.constructor.name}.${propertyKey}`);
    }
    
    // 通常のDecorator処理
    const originalMethod = descriptor.value;
    descriptor.value = function(...args: any[]) {
      return originalMethod.apply(this, args);
    };
  };
}

// 使用例
class ExampleClass {
  @SafeDecorator
  @ValidatedDecorator((target, key) => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', target, key);
    return paramTypes && paramTypes.length > 0; // 最低1個のパラメータが必要
  })
  processData(data: string): string {
    if (!data) {
      throw new Error('Data is required');
    }
    return data.toUpperCase();
  }
}
```