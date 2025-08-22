# TypeScript Decorators 概要と2024年の現状

> 🎯 **目的**: TypeScriptのDecoratorsとメタデータAPIの現状と基本概念の理解
> 
> 📊 **対象**: Stage 3 Decorator Proposal準拠、TypeScript 5.0+対応
> 
> ⚡ **特徴**: TC39提案の最新状況、設定方法、基本構文の解説

## TC39 Decorator Proposal (Stage 3)の現状

2024年現在、DecoratorsはTC39のStage 3に到達し、仕様がほぼ確定状態です。

```typescript
// Stage 3 Decorator (推奨)
function logged<T extends new(...args: any[]) => any>(constructor: T) {
  return class extends constructor {
    constructor(...args: any[]) {
      console.log(`Creating instance of ${constructor.name}`);
      super(...args);
    }
  };
}

@logged
class UserService {
  getUser(id: string) {
    return { id, name: 'John' };
  }
}

// Legacy Decorator (非推奨)
function legacyLogged(target: any) {
  const original = target;
  const wrapper = function (...args: any[]) {
    console.log(`Legacy: Creating ${original.name}`);
    return new original(...args);
  };
  wrapper.prototype = original.prototype;
  return wrapper;
}
```

## TypeScript設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,  // Legacy decorators用
    "emitDecoratorMetadata": true,   // Metadata反映用
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "useDefineForClassFields": false, // Decoratorとの互換性
    "moduleResolution": "node",
    "strict": true
  }
}
```

```bash
# 必要な依存関係のインストール
npm install reflect-metadata
npm install -D @types/reflect-metadata typescript@5.0+
```

## Decoratorの種類と基本構文

```typescript
import 'reflect-metadata';

// 1. Class Decorator
function Entity(tableName: string) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    Reflect.defineMetadata('tableName', tableName, constructor);
    return constructor;
  };
}

// 2. Method Decorator  
function Cache(ttl: number = 300) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: any; expiry: number }>();
    
    descriptor.value = function(...args: any[]) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      
      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }
      
      const result = originalMethod.apply(this, args);
      cache.set(key, { value: result, expiry: Date.now() + ttl * 1000 });
      
      return result;
    };
  };
}

// 3. Property Decorator
function Column(options: { type: string; nullable?: boolean }) {
  return function(target: any, propertyKey: string) {
    const columns = Reflect.getMetadata('columns', target.constructor) || [];
    columns.push({ propertyKey, ...options });
    Reflect.defineMetadata('columns', columns, target.constructor);
  };
}

// 4. Parameter Decorator
function Inject(token: string) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('inject-tokens', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('inject-tokens', existingTokens, target);
  };
}

// 使用例
@Entity('users')
class User {
  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar' })
  email: string;

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }

  @Cache(600)
  async fetchProfile(): Promise<any> {
    // 重い処理をキャッシュ
    return await new Promise(resolve => 
      setTimeout(() => resolve({ profile: 'data' }), 1000)
    );
  }
}
```

## Legacy DecoratorとStage 3の違い

```typescript
// Legacy Decorator (TypeScript 4.x以前)
function LegacyReadonly(target: any, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    writable: false,
    configurable: false
  });
}

// Stage 3 Decorator (TypeScript 5.0+)
function Readonly<T>(target: undefined, context: ClassFieldDecoratorContext<T, any>) {
  return function(initialValue: any) {
    return {
      get() { return initialValue; },
      set() { throw new Error('Property is readonly'); }
    };
  };
}

class Example {
  @Readonly
  readonlyProp = 'cannot change';
}
```