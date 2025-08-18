# TypeScript ベストプラクティス

型安全で保守性の高いモダンTypeScriptパターン。

## 型安全性優先

✅ strictモード使用:
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

✅ オブジェクトにはinterfaceを優先:
```typescript
// 良い: 拡張可能で意図が明確
interface User {
  id: string;
  email: string;
}

// typeはユニオン、交差、プリミティブに使用
type Status = 'pending' | 'active' | 'deleted';
type ID = string | number;
```

## `any`回避、`unknown`使用

❌ 悪い例:
```typescript
function process(data: any) {
  return data.value; // 型チェックなし
}
```

✅ 良い例:
```typescript
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('無効なデータ');
}
```

## Constアサーション & Readonly

✅ リテラルにconstアサーション:
```typescript
const config = {
  api: 'https://api.example.com',
  timeout: 5000
} as const;

// 型: { readonly api: "https://api.example.com"; readonly timeout: 5000; }
```

✅ 不変性にreadonly:
```typescript
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

class Service {
  constructor(private readonly config: Config) {}
}
```

## ユーティリティ型

✅ 組み込みユーティリティ型活用:
```typescript
interface User {
  id: string;
  email: string;
  password: string;
}

// 更新用にPartial
type UserUpdate = Partial<User>;

// 機密データ除外
type PublicUser = Omit<User, 'password'>;

// 特定フィールド抽出
type UserCredentials = Pick<User, 'email' | 'password'>;

// 厳密検証用Required
type RequiredUser = Required<User>;
```

## 判別可能なユニオン

✅ 型安全な状態管理:
```typescript
type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
  | { status: 'loading' };

function handleResult<T>(result: Result<T>) {
  switch (result.status) {
    case 'success':
      return result.data; // TypeScriptがdataの存在を認識
    case 'error':
      return result.error.message; // errorの存在を認識
    case 'loading':
      return '読み込み中...';
  }
}
```

## 型ガード

✅ 再利用可能な型ガード作成:
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// 使用例
if (isUser(data)) {
  console.log(data.email); // 型安全なアクセス
}
```

## ジェネリック制約

✅ 柔軟かつ型安全なコード:
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const product: Product = { id: '1', name: '本', price: 1000 };
const price = getProperty(product, 'price'); // 型: number
```

## エラーハンドリング

✅ エラーの型付け:
```typescript
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validate(input: unknown): asserts input is string {
  if (typeof input !== 'string') {
    throw new ValidationError('input', '文字列必須');
  }
}
```

## Async/Await ベストプラクティス

✅ 必ずエラー処理:
```typescript
async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`ユーザー取得失敗 ${id}:`, error);
    return null;
  }
}
```

## チェックリスト
- [ ] strictモード有効
- [ ] `any`型なし（`unknown`使用）
- [ ] リテラルにconstアサーション
- [ ] 不変データにreadonly
- [ ] 変換にユーティリティ型
- [ ] 状態に判別可能ユニオン
- [ ] ランタイムチェックに型ガード
- [ ] 柔軟性にジェネリック制約
- [ ] 型付きエラーハンドリング
- [ ] 非同期エラーハンドリング