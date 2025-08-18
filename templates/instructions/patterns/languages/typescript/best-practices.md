# TypeScript Best Practices

Modern TypeScript patterns for type-safe, maintainable code.

## Type Safety First

✅ Use strict mode:
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

✅ Prefer interfaces over type aliases for objects:
```typescript
// Good: extensible and clear intent
interface User {
  id: string;
  email: string;
}

// Use type for unions, intersections, primitives
type Status = 'pending' | 'active' | 'deleted';
type ID = string | number;
```

## Avoid `any`, Use `unknown`

❌ Bad:
```typescript
function process(data: any) {
  return data.value; // No type checking
}
```

✅ Good:
```typescript
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

## Const Assertions & Readonly

✅ Use const assertions for literals:
```typescript
const config = {
  api: 'https://api.example.com',
  timeout: 5000
} as const;

// Type: { readonly api: "https://api.example.com"; readonly timeout: 5000; }
```

✅ Prefer readonly for immutability:
```typescript
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

class Service {
  constructor(private readonly config: Config) {}
}
```

## Utility Types

✅ Use built-in utility types:
```typescript
interface User {
  id: string;
  email: string;
  password: string;
}

// Partial for updates
type UserUpdate = Partial<User>;

// Omit sensitive data
type PublicUser = Omit<User, 'password'>;

// Pick specific fields
type UserCredentials = Pick<User, 'email' | 'password'>;

// Required for strict validation
type RequiredUser = Required<User>;
```

## Discriminated Unions

✅ Use for type-safe state management:
```typescript
type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
  | { status: 'loading' };

function handleResult<T>(result: Result<T>) {
  switch (result.status) {
    case 'success':
      return result.data; // TypeScript knows data exists
    case 'error':
      return result.error.message; // TypeScript knows error exists
    case 'loading':
      return 'Loading...';
  }
}
```

## Type Guards

✅ Create reusable type guards:
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

// Usage
if (isUser(data)) {
  console.log(data.email); // Type-safe access
}
```

## Generic Constraints

✅ Use constraints for flexible yet type-safe code:
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const product: Product = { id: '1', name: 'Book', price: 10 };
const price = getProperty(product, 'price'); // Type: number
```

## Error Handling

✅ Type your errors:
```typescript
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validate(input: unknown): asserts input is string {
  if (typeof input !== 'string') {
    throw new ValidationError('input', 'Must be string');
  }
}
```

## Async/Await Best Practices

✅ Always handle errors:
```typescript
async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch user ${id}:`, error);
    return null;
  }
}
```

## Checklist
- [ ] Strict mode enabled
- [ ] No `any` types (use `unknown` instead)
- [ ] Const assertions for literals
- [ ] Readonly for immutable data
- [ ] Utility types for transformations
- [ ] Discriminated unions for state
- [ ] Type guards for runtime checks
- [ ] Generic constraints for flexibility
- [ ] Typed error handling
- [ ] Async error handling