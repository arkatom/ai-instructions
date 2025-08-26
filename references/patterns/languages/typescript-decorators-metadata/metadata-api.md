# Metadata APIと反射的プログラミング

> 🎯 **目的**: reflect-metadataを活用した動的な型情報の操作とメタプログラミング
> 
> 📊 **対象**: 実行時の型情報活用、カスタムメタデータシステムの構築
> 
> ⚡ **特徴**: TypeScript型情報の実行時アクセス、柔軟なメタデータ管理

## reflect-metadata基礎

```typescript
import 'reflect-metadata';

// メタデータの定義と取得
class MetadataExample {
  @Reflect.metadata('custom:type', 'string')
  @Reflect.metadata('custom:required', true)
  name: string;

  @Reflect.metadata('custom:type', 'number')
  @Reflect.metadata('custom:range', { min: 0, max: 100 })
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}

// メタデータの読み取り
function analyzeClass(target: any) {
  const properties = Object.getOwnPropertyNames(target.prototype);
  
  properties.forEach(prop => {
    const type = Reflect.getMetadata('custom:type', target.prototype, prop);
    const required = Reflect.getMetadata('custom:required', target.prototype, prop);
    const range = Reflect.getMetadata('custom:range', target.prototype, prop);
    
    console.log(`Property ${prop}:`);
    console.log(`  Type: ${type}`);
    console.log(`  Required: ${required}`);
    console.log(`  Range: ${JSON.stringify(range)}`);
  });
}

analyzeClass(MetadataExample);
```

## 型メタデータの活用

```typescript
// TypeScript自動生成メタデータの利用
function GetTypeInfo(target: any, propertyKey: string) {
  const type = Reflect.getMetadata('design:type', target, propertyKey);
  const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey);
  const returnType = Reflect.getMetadata('design:returntype', target, propertyKey);
  
  console.log(`Property ${propertyKey}:`);
  console.log(`  Type: ${type?.name}`);
  console.log(`  Param Types: ${paramTypes?.map((t: any) => t.name)}`);
  console.log(`  Return Type: ${returnType?.name}`);
}

class TypedClass {
  @GetTypeInfo
  name: string;

  @GetTypeInfo
  age: number;

  @GetTypeInfo
  calculate(x: number, y: string): boolean {
    return x > parseInt(y);
  }

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}
```

## カスタムメタデータシステム

```typescript
// メタデータストレージ
class MetadataStorage {
  private static storage = new Map<string, Map<string | symbol, any>>();
  
  static define(
    target: any, 
    key: string | symbol, 
    metadataKey: string, 
    value: any
  ) {
    const targetKey = target.constructor?.name || target.name || 'anonymous';
    
    if (!this.storage.has(targetKey)) {
      this.storage.set(targetKey, new Map());
    }
    
    const targetMetadata = this.storage.get(targetKey)!;
    const fullKey = `${String(key)}:${metadataKey}`;
    targetMetadata.set(fullKey, value);
  }
  
  static get(
    target: any, 
    key: string | symbol, 
    metadataKey: string
  ): any {
    const targetKey = target.constructor?.name || target.name || 'anonymous';
    const targetMetadata = this.storage.get(targetKey);
    
    if (!targetMetadata) return undefined;
    
    const fullKey = `${String(key)}:${metadataKey}`;
    return targetMetadata.get(fullKey);
  }
  
  static getAll(target: any): Map<string, any> {
    const targetKey = target.constructor?.name || target.name || 'anonymous';
    return this.storage.get(targetKey) || new Map();
  }
}

// カスタムメタデータDecorator
function Metadata(key: string, value: any) {
  return function(target: any, propertyKey?: string | symbol) {
    if (propertyKey) {
      MetadataStorage.define(target, propertyKey, key, value);
    } else {
      MetadataStorage.define(target, 'class', key, value);
    }
  };
}

// バリデーション用メタデータ
interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern';
  value?: any;
  message?: string;
}

function Validate(rules: ValidationRule[]) {
  return function(target: any, propertyKey: string) {
    MetadataStorage.define(target, propertyKey, 'validation', rules);
  };
}

// バリデーター実装
function validateObject(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const metadata = MetadataStorage.getAll(obj);
  
  for (const [key, value] of metadata.entries()) {
    if (key.endsWith(':validation')) {
      const propertyKey = key.split(':')[0];
      const rules = value as ValidationRule[];
      const propertyValue = obj[propertyKey];
      
      for (const rule of rules) {
        switch (rule.type) {
          case 'required':
            if (propertyValue == null || propertyValue === '') {
              errors.push(rule.message || `${propertyKey} is required`);
            }
            break;
            
          case 'min':
            if (typeof propertyValue === 'number' && propertyValue < rule.value) {
              errors.push(rule.message || `${propertyKey} must be at least ${rule.value}`);
            } else if (typeof propertyValue === 'string' && propertyValue.length < rule.value) {
              errors.push(rule.message || `${propertyKey} must be at least ${rule.value} characters`);
            }
            break;
            
          case 'pattern':
            if (typeof propertyValue === 'string' && !rule.value.test(propertyValue)) {
              errors.push(rule.message || `${propertyKey} format is invalid`);
            }
            break;
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// 使用例
@Metadata('entity', { table: 'users' })
class User {
  @Validate([
    { type: 'required', message: 'Name is required' },
    { type: 'min', value: 2, message: 'Name must be at least 2 characters' }
  ])
  name: string;

  @Validate([
    { type: 'required' },
    { type: 'pattern', value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }
  ])
  email: string;

  @Validate([
    { type: 'min', value: 18, message: 'Must be at least 18 years old' },
    { type: 'max', value: 120, message: 'Age must be less than 120' }
  ])
  age: number;

  constructor(name: string, email: string, age: number) {
    this.name = name;
    this.email = email;
    this.age = age;
  }
}

// テスト
const user1 = new User('', 'invalid-email', 16);
const validation1 = validateObject(user1);
console.log(validation1);
// { valid: false, errors: [...] }

const user2 = new User('John Doe', 'john@example.com', 25);
const validation2 = validateObject(user2);
console.log(validation2);
// { valid: true, errors: [] }
```