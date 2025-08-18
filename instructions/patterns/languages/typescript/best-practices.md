# TypeScript ベストプラクティス

ES2024+機能を活用した型安全で保守性の高いモダンTypeScriptパターン。

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
// Type assertionではなくtype guardを使用
const hasValue = (data: unknown): data is { value: string } => {
  return typeof data === 'object' && data !== null && 'value' in data &&
    typeof (data as any).value === 'string';
};

const process = (data: unknown): string => {
  if (hasValue(data)) {
    return data.value; // 型安全なアクセス
  }
  throw new Error('無効なデータ');
};
```

## Const AssertionとReadonly

✅ リテラルにconst assertion使用:
```typescript
const config = {
  api: 'https://api.example.com',
  timeout: 5000
} as const;

// 型: { readonly api: "https://api.example.com"; readonly timeout: 5000; }
```

✅ 不変性にはreadonly優先:
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

✅ 組み込みユーティリティ型使用:
```typescript
interface User {
  id: string;
  email: string;
  password: string;
}

// 更新用にPartial
type UserUpdate = Partial<User>;

// 機密データを除外
type PublicUser = Omit<User, 'password'>;

// 特定フィールドを選択
type UserCredentials = Pick<User, 'email' | 'password'>;

// 厳密な検証用にRequired
type RequiredUser = Required<User>;
```

## 判別可能なユニオン

✅ 型安全な状態管理に使用:
```typescript
type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
  | { status: 'loading' };

const handleResult = <T>(result: Result<T>) => {
  switch (result.status) {
    case 'success':
      return result.data; // TypeScriptはdataが存在することを認識
    case 'error':
      return result.error.message; // TypeScriptはerrorが存在することを認識
    case 'loading':
      return '読み込み中...';
  }
};
```

## Type Guards

✅ アロー関数で再利用可能なtype guard作成:
```typescript
// 常にアロー関数をtype guardに使用
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isUser = (value: unknown): value is User => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).email === 'string'
  );
};

// 使用例
if (isUser(data)) {
  console.log(data.email); // 型安全なアクセス
}
```

## ジェネリック制約

✅ 柔軟かつ型安全なコードに制約使用:
```typescript
const getProperty = <T, K extends keyof T>(obj: T, key: K): T[K] => {
  return obj[key];
};

interface Product {
  id: string;
  name: string;
  price: number;
}

const product: Product = { id: '1', name: '本', price: 10 };
const price = getProperty(product, 'price'); // 型: number
```

## エラーハンドリング

✅ エラーに型付け:
```typescript
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const validate = (input: unknown): asserts input is string => {
  if (typeof input !== 'string') {
    throw new ValidationError('input', '文字列である必要があります');
  }
};
```

## Async/Awaitベストプラクティス

✅ アロー関数で常にエラー処理:
```typescript
const fetchUser = async (id: string): Promise<User | null> => {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`ユーザー${id}の取得に失敗:`, error);
    return null;
  }
};
```

## ES2024+ 最新機能

✅ リソース管理のためのusing宣言:
```typescript
// 'using'による自動クリーンアップ
async function processFile() {
  await using file = await openFile('data.txt');
  // スコープ終了時にファイル自動クローズ
  return file.read();
}

class DatabaseConnection implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
```

✅ 型検証のためのsatisfies演算子:
```typescript
type Config = {
  port: number;
  host: string;
  ssl?: boolean;
};

// 型チェックされるがリテラル型を保持
const config = {
  port: 3000,
  host: 'localhost',
  ssl: true
} satisfies Config;

// config.portは単なるnumberではなく3000
```

✅ テンプレートリテラル型:
```typescript
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type APIEndpoint = `/api/${string}`;
type Route<T extends string> = `${HTTPMethod} ${APIEndpoint}`;

const route: Route<'users'> = 'GET /api/users';
```

✅ 高度なマッチング用RegExp vフラグ:
```typescript
const regex = /\p{Emoji}/v; // 任意の絵文字にマッチ
const hasEmoji = (str: string): boolean => regex.test(str);
```

## モジュールベストプラクティス

✅ 常に名前付きエクスポート使用（defaultは禁止）:
```typescript
// ❌ 悪い例: default export
export default class UserService {}

// ✅ 良い例: named export
export class UserService {}
export const userService = new UserService();

// ✅ 良い例: barrel exports
export { UserService } from './UserService';
export { AuthService } from './AuthService';
export type { User, UserRole } from './types';
```

## Type Assertion - 絶対使用禁止

❌ Type assertionは絶対使用しない:
```typescript
// ❌ 悪い例: type assertion
const user = response as User;
const id = <string>value;

// ✅ 良い例: type guardと検証
const validateUser = (data: unknown): User => {
  if (!isUser(data)) {
    throw new Error('無効なユーザーデータ');
  }
  return data;
};
```

## チェックリスト
- [ ] Strictモード有効
- [ ] Type assertion禁止（type guard使用）
- [ ] Default export禁止（named export使用）
- [ ] Function宣言禁止（アロー関数使用）
- [ ] `any`型禁止（`unknown`使用）
- [ ] ES2024+機能使用（using、satisfies）
- [ ] 文字列パターンにテンプレートリテラル型
- [ ] リテラルにconst assertion
- [ ] 不変データにreadonly
- [ ] 変換にユーティリティ型
- [ ] 状態に判別可能なユニオン
- [ ] ランタイムチェックにtype guard
- [ ] 柔軟性にジェネリック制約
- [ ] 型付きエラーハンドリング
- [ ] 非同期エラーハンドリング