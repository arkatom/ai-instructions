# 基本的なDecoratorパターン

> 🎯 **目的**: TypeScriptで頻繁に使用される基本的なDecoratorパターンの実装と活用法
> 
> 📊 **対象**: Factory Pattern、Composition、Property/Class Decoratorの実践的な使い方
> 
> ⚡ **特徴**: 再利用可能な設計パターン、組み合わせ可能なDecorator実装

## Decorator Factory Pattern

```typescript
// 設定可能なDecorator作成パターン
interface LoggingOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
  prefix?: string;
  includeArgs?: boolean;
  includeResult?: boolean;
}

function Log(options: LoggingOptions = { level: 'info' }) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const { level, prefix = '', includeArgs = true, includeResult = true } = options;
    
    descriptor.value = function(...args: any[]) {
      const logger = console[level] || console.log;
      
      if (includeArgs) {
        logger(`${prefix}[${propertyKey}] Called with:`, args);
      } else {
        logger(`${prefix}[${propertyKey}] Called`);
      }
      
      try {
        const result = originalMethod.apply(this, args);
        
        if (includeResult && result !== undefined) {
          logger(`${prefix}[${propertyKey}] Returned:`, result);
        }
        
        return result;
      } catch (error) {
        logger(`${prefix}[${propertyKey}] Error:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}

// 使用例
class ApiClient {
  @Log({ level: 'debug', prefix: 'API', includeResult: false })
  async fetchUser(id: string) {
    return await fetch(`/api/users/${id}`).then(r => r.json());
  }

  @Log({ level: 'error', includeArgs: false })
  deleteUser(id: string) {
    return fetch(`/api/users/${id}`, { method: 'DELETE' });
  }
}
```

## Method Decorator Composition

```typescript
// 複数のDecoratorを組み合わせるパターン
function Retry(attempts: number = 3, delay: number = 1000) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      let lastError: any;
      
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          
          if (attempt < attempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
            console.warn(`Attempt ${attempt} failed, retrying...`);
          }
        }
      }
      
      throw lastError;
    };
  };
}

function Timeout(ms: number) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), ms)
        )
      ]);
    };
  };
}

function Measure(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        console.log(`${propertyKey} took ${duration.toFixed(2)}ms`);
      });
    } else {
      const duration = performance.now() - start;
      console.log(`${propertyKey} took ${duration.toFixed(2)}ms`);
      return result;
    }
  };
}

// Decorator合成の使用例
class NetworkService {
  @Measure
  @Timeout(5000)
  @Retry(3, 2000)
  @Log({ level: 'info', prefix: 'NET' })
  async fetchData(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}
```

## Property Decorator Patterns

```typescript
// プロパティvalidation
function MinLength(min: number) {
  return function(target: any, propertyKey: string) {
    let value = target[propertyKey];
    
    const getter = () => value;
    const setter = (newValue: string) => {
      if (typeof newValue !== 'string' || newValue.length < min) {
        throw new Error(`${propertyKey} must be at least ${min} characters long`);
      }
      value = newValue;
    };
    
    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true
    });
  };
}

function Email(target: any, propertyKey: string) {
  let value = target[propertyKey];
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  Object.defineProperty(target, propertyKey, {
    get: () => value,
    set: (newValue: string) => {
      if (!emailRegex.test(newValue)) {
        throw new Error(`${propertyKey} must be a valid email address`);
      }
      value = newValue;
    },
    enumerable: true,
    configurable: true
  });
}

// 自動型変換
function Transform<T>(transformer: (value: any) => T) {
  return function(target: any, propertyKey: string) {
    let value = target[propertyKey];
    
    Object.defineProperty(target, propertyKey, {
      get: () => value,
      set: (newValue: any) => {
        value = transformer(newValue);
      },
      enumerable: true,
      configurable: true
    });
  };
}

// 使用例
class UserForm {
  @MinLength(2)
  name: string;

  @Email
  email: string;

  @Transform((val: string) => parseInt(val, 10))
  age: number;

  constructor(name: string, email: string, age: string | number) {
    this.name = name;
    this.email = email;
    this.age = age;
  }
}

// テスト
try {
  const user = new UserForm('Jo', 'invalid-email', '25');
} catch (error) {
  console.error(error.message); // "name must be at least 2 characters long"
}
```

## Class Decorator Patterns

```typescript
// Singleton パターン
function Singleton<T extends new(...args: any[]) => any>(constructor: T) {
  let instance: T | null = null;
  
  return class extends constructor {
    constructor(...args: any[]) {
      if (instance) {
        return instance;
      }
      super(...args);
      instance = this as T;
      return instance;
    }
  } as T;
}

// Mixin パターン  
type Constructor = new (...args: any[]) => any;

function Timestamped<T extends Constructor>(Base: T) {
  return class extends Base {
    createdAt: Date = new Date();
    updatedAt: Date = new Date();
    
    touch() {
      this.updatedAt = new Date();
    }
  };
}

function Serializable<T extends Constructor>(Base: T) {
  return class extends Base {
    serialize(): string {
      const obj: any = {};
      Object.getOwnPropertyNames(this).forEach(prop => {
        obj[prop] = (this as any)[prop];
      });
      return JSON.stringify(obj);
    }
    
    static deserialize<U>(this: new() => U, json: string): U {
      const obj = JSON.parse(json);
      const instance = new this();
      Object.assign(instance, obj);
      return instance;
    }
  };
}

// 使用例
@Singleton
class ConfigManager {
  private config: Record<string, any> = {};
  
  set(key: string, value: any) {
    this.config[key] = value;
  }
  
  get(key: string) {
    return this.config[key];
  }
}

@Serializable
@Timestamped
class Document {
  title: string;
  content: string;
  
  constructor(title: string, content: string) {
    super();
    this.title = title;
    this.content = content;
  }
}

// 動作確認
const config1 = new ConfigManager();
const config2 = new ConfigManager();
console.log(config1 === config2); // true (Singleton)

const doc = new Document('Test', 'Content');
doc.touch();
const serialized = doc.serialize();
const deserialized = Document.deserialize(serialized);
```