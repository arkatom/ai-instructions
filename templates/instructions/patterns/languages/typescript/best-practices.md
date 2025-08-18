# TypeScript Best Practices

Modern TypeScript patterns for type-safe, maintainable code with ES2024+ features.

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
// Use type guard instead of type assertion
const hasValue = (data: unknown): data is { value: string } => {
  return typeof data === 'object' && data !== null && 'value' in data &&
    typeof (data as any).value === 'string';
};

const process = (data: unknown): string => {
  if (hasValue(data)) {
    return data.value; // Type-safe access
  }
  throw new Error('Invalid data');
};
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

✅ Create reusable type guards with arrow functions:
```typescript
// Always use arrow functions for type guards
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

// Usage
if (isUser(data)) {
  console.log(data.email); // Type-safe access
}
```

## Generic Constraints

✅ Use constraints for flexible yet type-safe code:
```typescript
const getProperty = <T, K extends keyof T>(obj: T, key: K): T[K] => {
  return obj[key];
};

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

const validate = (input: unknown): asserts input is string => {
  if (typeof input !== 'string') {
    throw new ValidationError('input', 'Must be string');
  }
};
```

## Async/Await Best Practices

✅ Always handle errors with arrow functions:
```typescript
const fetchUser = async (id: string): Promise<User | null> => {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch user ${id}:`, error);
    return null;
  }
};
```

## ES2024+ Features

✅ Using declarations for resource management:
```typescript
// Automatic cleanup with 'using'
async function processFile() {
  await using file = await openFile('data.txt');
  // File automatically closed when scope ends
  return file.read();
}

class DatabaseConnection implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
```

✅ Satisfies operator for type validation:
```typescript
type Config = {
  port: number;
  host: string;
  ssl?: boolean;
};

// Type-checked but preserves literal types
const config = {
  port: 3000,
  host: 'localhost',
  ssl: true
} satisfies Config;

// config.port is 3000, not just number
```

✅ Template literal types:
```typescript
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type APIEndpoint = `/api/${string}`;
type Route<T extends string> = `${HTTPMethod} ${APIEndpoint}`;

const route: Route<'users'> = 'GET /api/users';
```

✅ RegExp v flag for advanced matching:
```typescript
const regex = /\p{Emoji}/v; // Match any emoji
const hasEmoji = (str: string): boolean => regex.test(str);
```

## Module Best Practices

✅ Always use named exports (never default):
```typescript
// ❌ Bad: default export
export default class UserService {}

// ✅ Good: named export
export class UserService {}
export const userService = new UserService();

// ✅ Good: barrel exports
export { UserService } from './UserService';
export { AuthService } from './AuthService';
export type { User, UserRole } from './types';
```

## Type Assertions - NEVER Use

❌ Never use type assertions:
```typescript
// ❌ Bad: type assertion
const user = response as User;
const id = <string>value;

// ✅ Good: type guards and validation
const validateUser = (data: unknown): User => {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  return data;
};
```

## Security Best Practices

✅ Input validation with type guards:
```typescript
// Good - comprehensive input validation
const validateUserInput = (input: unknown): User => {
  if (
    typeof input === 'object' &&
    input !== null &&
    'email' in input &&
    'name' in input &&
    typeof (input as any).email === 'string' &&
    typeof (input as any).name === 'string' &&
    isValidEmail((input as any).email)
  ) {
    return input as User;
  }
  throw new ValidationError('Invalid user input');
};

// Email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Bad - no input validation
const processUser = (data: any) => {
  return data.email; // Potential security vulnerability
};
```

✅ Prevent XSS with proper escaping:
```typescript
// Good - safe HTML sanitization
const sanitizeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Use DOMPurify for complex HTML
import DOMPurify from 'dompurify';

const sanitizeComplexHtml = (html: string): string => {
  return DOMPurify.sanitize(html);
};

// Bad - direct HTML injection
const renderHtml = (userInput: string) => {
  return `<div>${userInput}</div>`; // XSS vulnerability
};
```

✅ Secure environment variable handling:
```typescript
// Good - typed environment variables
interface EnvironmentConfig {
  readonly DATABASE_URL: string;
  readonly API_KEY: string;
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

const getConfig = (): EnvironmentConfig => {
  const requiredVars = ['DATABASE_URL', 'API_KEY'] as const;
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
  
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    API_KEY: process.env.API_KEY!,
    NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development'
  };
};

// Bad - unvalidated environment access
const config = {
  dbUrl: process.env.DATABASE_URL, // Might be undefined
  apiKey: process.env.API_KEY      // No validation
};
```

✅ Secure authentication patterns:
```typescript
// Good - secure token handling
interface AuthToken {
  readonly token: string;
  readonly expiresAt: Date;
  readonly userId: string;
}

const validateAuthToken = (token: unknown): AuthToken | null => {
  if (
    typeof token === 'object' &&
    token !== null &&
    'token' in token &&
    'expiresAt' in token &&
    'userId' in token &&
    typeof (token as any).token === 'string' &&
    (token as any).expiresAt instanceof Date &&
    typeof (token as any).userId === 'string'
  ) {
    const authToken = token as AuthToken;
    
    // Check if token is expired
    if (authToken.expiresAt < new Date()) {
      return null;
    }
    
    return authToken;
  }
  
  return null;
};

// Rate limiting type
interface RateLimitConfig {
  readonly maxAttempts: number;
  readonly windowMs: number;
}

const createRateLimiter = (config: RateLimitConfig) => {
  const attempts = new Map<string, number[]>();
  
  return (identifier: string): boolean => {
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(
      attempt => now - attempt < config.windowMs
    );
    
    if (validAttempts.length >= config.maxAttempts) {
      return false; // Rate limit exceeded
    }
    
    validAttempts.push(now);
    attempts.set(identifier, validAttempts);
    return true;
  };
};
```

## Checklist
- [ ] Strict mode enabled
- [ ] NO type assertions (use type guards)
- [ ] NO default exports (use named exports)
- [ ] NO function declarations (use arrow functions)
- [ ] No `any` types (use `unknown` instead)
- [ ] Using ES2024+ features (using, satisfies)
- [ ] Template literal types for string patterns
- [ ] Const assertions for literals
- [ ] Readonly for immutable data
- [ ] Utility types for transformations
- [ ] Discriminated unions for state
- [ ] Type guards for runtime checks
- [ ] Generic constraints for flexibility
- [ ] Typed error handling
- [ ] Async error handling
- [ ] Validate all user inputs with type guards
- [ ] Sanitize HTML content to prevent XSS
- [ ] Validate environment variables at startup
- [ ] Implement secure authentication patterns
- [ ] Use rate limiting for API endpoints