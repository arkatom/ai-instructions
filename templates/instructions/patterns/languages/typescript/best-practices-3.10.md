# TypeScript 3.10+ Functional Programming Best Practices

Purely functional programming patterns leveraging TypeScript 3.10 through 4.9 features with absolute functional programming compliance.

## 🚨 FUNCTIONAL PROGRAMMING MANDATE

**ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:**
- All functions MUST be arrow functions
- Functional programming is MANDATORY, not optional
- Immutability is REQUIRED for all data structures
- Pure functions with no side effects are MANDATORY
- Composition over inheritance is ABSOLUTE

## ❌ ABSOLUTELY FORBIDDEN

The following practices are **COMPLETELY BANNED** and will result in immediate rejection:

- ❌ **Function declarations** (`function name() {}`) - Use arrow functions ONLY
- ❌ **`any` type** - Use `unknown` or proper typing
- ❌ **Type assertions** (`as Type`) - Use type guards instead
- ❌ **Classes** - Use functional factories with closures
- ❌ **Mutable state** - Use immutable data structures
- ❌ **Side effects in functions** - Keep functions pure
- ❌ **Object-oriented patterns** - Use functional patterns only

## 🔧 FUNCTIONAL PRINCIPLES

### 1. Immutability First
All data must be immutable. Never mutate existing data.

### 2. Pure Functions Only
Functions must be pure - same input always produces same output, no side effects.

### 3. Function Composition
Build complex operations by composing simple functions.

### 4. Higher-Order Functions
Use functions that take or return other functions.

## Type Safety Priority

### Strict Mode Configuration
Ensure maximum type safety with functional patterns.

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noImplicitThis": true
  }
}
```

### Functional Interface vs Type Usage
Appropriate usage patterns with functional approach.

```typescript
// ✅ Prefer interfaces for immutable object structures
interface User {
  readonly id: string;
  readonly email: string;
  readonly profile?: UserProfile;
}

interface UserProfile {
  readonly name: string;
  readonly avatar?: string;
}

// Functional interface extension
interface AdminUser extends User {
  readonly permissions: readonly string[];
}

// ✅ Use type for unions, primitives, computed types
type Status = 'pending' | 'active' | 'deleted';
type ID = string | number;
type UserWithStatus = User & { readonly status: Status };
```

## Functional Union Types and Type Guards

### Functional Union Type Utilization
Improved Union types with pure functional patterns.

```typescript
// ✅ Functional type safety with Union types
type Result<T> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

const handleResult = <T>(result: Result<T>): T => {
  if (result.success) {
    return result.data; // TypeScript recognizes data exists
  }
  throw new Error(result.error); // TypeScript recognizes error exists
};

// Functional discriminated unions
type Shape = 
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'square'; readonly size: number }
  | { readonly kind: 'rectangle'; readonly width: number; readonly height: number };

const getArea = (shape: Shape): number => {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.size ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    default:
      const _exhaustiveCheck: never = shape;
      throw new Error(`Unhandled shape: ${_exhaustiveCheck}`);
  }
};
```

### Functional Type Guard Patterns
Type narrowing and runtime safety with pure functions.

```typescript
// ✅ Functional type guards
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isUser = (value: unknown): value is User => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    isString((value as Record<string, unknown>).id) &&
    isString((value as Record<string, unknown>).email)
  );
};

// Functional usage example
const processUserData = (data: unknown): string => {
  if (isUser(data)) {
    return data.email; // Type-safe access
  }
  throw new Error('Invalid user data');
};

// Functional assertion functions (TS 3.7+)
const assertIsUser = (value: unknown): asserts value is User => {
  if (!isUser(value)) {
    throw new Error('Not user data');
  }
};

const handleUserData = (data: unknown): void => {
  assertIsUser(data);
  console.log(data.email); // Type is confirmed after assertion
};
```

## Functional Generics and Constraints

### Functional Generic Constraint Patterns
Balance between flexibility and type safety with functional approach.

```typescript
// ✅ Functional keyof constraints
const getProperty = <T, K extends keyof T>(obj: T, key: K): T[K] => {
  return obj[key];
};

const user: User = { id: '1', email: 'test@example.com' };
const email = getProperty(user, 'email'); // Type: string

// Functional conditional type constraints
type NonNullable<T> = T extends null | undefined ? never : T;

const processNonNull = <T>(value: NonNullable<T>): T => {
  return value;
};

// Functional mapped type utilization
type Partial<T> = {
  readonly [P in keyof T]?: T[P];
};

type Required<T> = {
  readonly [P in keyof T]-?: T[P];
};

type UserUpdate = Partial<User>;
type RequiredUser = Required<User>;
```

### Functional Utility Types
Effective use of built-in utility types with functional patterns.

```typescript
interface User {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly profile: UserProfile;
}

// ✅ Functional utility type patterns
type PublicUser = Omit<User, 'password'>;
type UserCredentials = Pick<User, 'email' | 'password'>;
type UserUpdate = Partial<Omit<User, 'id'>>;

// Functional Record type for type-safe maps
type UserStatus = 'active' | 'inactive' | 'pending';
type StatusConfig = Record<UserStatus, { readonly color: string; readonly label: string }>;

const statusConfig: StatusConfig = {
  active: { color: 'green', label: 'Active' },
  inactive: { color: 'gray', label: 'Inactive' },
  pending: { color: 'orange', label: 'Pending' }
} as const;

// Functional user factory
const createUser = (email: string, name: string): User => ({
  id: generateId(),
  email,
  password: '',
  profile: { name }
});

type CreateUserParams = Parameters<typeof createUser>; // [string, string]
type UserCreationResult = ReturnType<typeof createUser>; // User
```

## Functional Const Assertions (TS 3.4+)

### Functional Literal Type Preservation
Preserve types precisely with const assertion in functional patterns.

```typescript
// ✅ Functional const assertion patterns
const config = {
  api: 'https://api.example.com',
  timeout: 5000,
  retries: 3
} as const;

// Type: {
//   readonly api: "https://api.example.com";
//   readonly timeout: 5000;
//   readonly retries: 3;
// }

const colors = ['red', 'green', 'blue'] as const;
type Color = typeof colors[number]; // 'red' | 'green' | 'blue'

// Functional const assertion in functions
const getConfig = () => {
  return {
    environment: 'production',
    version: '1.0.0'
  } as const;
};

type Config = ReturnType<typeof getConfig>;
// Type: { readonly environment: "production"; readonly version: "1.0.0"; }
```

## Functional Template Literal Types (TS 4.1+)

### Functional String Literal Type Manipulation
Type-safe string manipulation with template literal types using functional patterns.

```typescript
// ✅ Functional Template Literal Types
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type APIEndpoint = `/api/${string}`;
type HTTPRequest = `${HTTPMethod} ${APIEndpoint}`;

// Examples: 'GET /api/users', 'POST /api/posts', etc.

// Functional dynamic property names
type EventName = 'click' | 'hover' | 'focus';
type EventHandlers = {
  readonly [K in EventName as `on${Capitalize<K>}`]: (event: Event) => void;
};

// Result: { onClick: ..., onHover: ..., onFocus: ... }

// Functional CSS-in-JS type-safe patterns
type CSSProperty = 'margin' | 'padding' | 'border';
type CSSDirection = 'top' | 'right' | 'bottom' | 'left';
type DirectionalCSS = `${CSSProperty}-${CSSDirection}`;

const createStyles = (): Record<DirectionalCSS, string> => ({
  'margin-top': '10px',
  'margin-right': '5px',
  'margin-bottom': '10px',
  'margin-left': '5px',
  'padding-top': '8px',
  'padding-right': '8px',
  'padding-bottom': '8px',
  'padding-left': '8px',
  'border-top': '1px solid',
  'border-right': '1px solid',
  'border-bottom': '1px solid',
  'border-left': '1px solid'
});
```

## Functional Function Patterns

### Arrow Function Priority
Exclusively use arrow functions for all function definitions.

```typescript
// ✅ Functional arrow function patterns
const calculateDiscount = (price: number, rate: number): number => {
  return price * (1 - rate);
};

const asyncFetchUser = async (id: string): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${id}`);
  }
  return response.json();
};

// Functional higher-order function patterns
const withLogging = <T extends readonly unknown[], R>(
  fn: (...args: T) => R
) => (...args: T): R => {
  console.log(`Calling function with args:`, args);
  const result = fn(...args);
  console.log(`Result:`, result);
  return result;
};

const loggedCalculateDiscount = withLogging(calculateDiscount);
```

## Functional Error Handling

### Functional Type-Safe Error Handling
Custom exceptions and type guards using functional patterns.

```typescript
// ✅ Functional error handling
type ValidationError = {
  readonly type: 'ValidationError';
  readonly field: string;
  readonly message: string;
};

type NetworkError = {
  readonly type: 'NetworkError';
  readonly status: number;
  readonly message: string;
};

const createValidationError = (field: string, message: string): ValidationError => ({
  type: 'ValidationError',
  field,
  message
});

const createNetworkError = (status: number, message: string): NetworkError => ({
  type: 'NetworkError',
  status,
  message
});

// Functional error type guards
const isValidationError = (error: unknown): error is ValidationError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as Record<string, unknown>).type === 'ValidationError'
  );
};

const isNetworkError = (error: unknown): error is NetworkError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as Record<string, unknown>).type === 'NetworkError'
  );
};

// Functional Result type pattern
type Result<T, E = Error> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

const safeAsyncOperation = async (id: string): Promise<Result<User, ValidationError | NetworkError>> => {
  try {
    const user = await fetchUser(id);
    return { success: true, data: user };
  } catch (error) {
    if (error instanceof Error) {
      return { 
        success: false, 
        error: createNetworkError(500, error.message)
      };
    }
    return { 
      success: false, 
      error: createNetworkError(500, 'Unknown error')
    };
  }
};
```

## Functional Module Patterns

### Named Exports Priority (Functional Rules)
Prefer named exports as principle, allow default exports exceptionally.

```typescript
// ✅ Principle: Functional named exports
export const UserService = {
  create: (data: UserData): Promise<User> => createUserImpl(data),
  update: (id: string, data: Partial<UserData>): Promise<User> => updateUserImpl(id, data),
  delete: (id: string): Promise<void> => deleteUserImpl(id)
};

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// ✅ Exception 1: Main entry points (App components, etc.)
const Application = (config: AppConfig) => {
  const start = (): void => {
    // Implementation
  };
  
  return { start };
};

export default Application;

// ✅ Exception 2: Single responsibility modules
// math-utils.ts
const calculate = (operation: string, a: number, b: number): number => {
  // Single primary functionality
  switch (operation) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide': return a / b;
    default: throw new Error(`Unknown operation: ${operation}`);
  }
};

export default calculate;

// ✅ Functional barrel exports pattern
// index.ts
export { UserService } from './UserService';
export { validateEmail, validatePassword } from './validators';
export type { User, UserData } from './types';
```

## TypeScript 3.10-4.9 Functional Programming Checklist

### Mandatory Functional Type Safety
- [ ] Enable all strict mode settings
- [ ] Complete elimination of `any` type usage (FORBIDDEN)
- [ ] Zero type assertions (`as`) - use functional type guards only
- [ ] Properly distinguish interface vs type usage
- [ ] Use functional discriminated union patterns

### Functional Modern Features
- [ ] Preserve literal types with functional const assertions
- [ ] Manipulate string types with functional template literal types
- [ ] Transform types with functional utility types
- [ ] Define flexible types with functional conditional types
- [ ] Manipulate object types with functional mapped types

### Pure Functional Functions & Modules
- [ ] Complete elimination of function declarations (FORBIDDEN)
- [ ] ALL functions are arrow functions (MANDATORY)
- [ ] Prefer named exports, exceptional default exports
- [ ] Ensure runtime safety with functional type guards
- [ ] Balance flexibility and safety with functional generic constraints

### Functional Code Quality
- [ ] Add type annotations to ALL functions
- [ ] Use functional error factories and type guards
- [ ] Handle errors with functional Result patterns
- [ ] Use ESLint TypeScript rules for functional programming
- [ ] Ensure all data structures are immutable
- [ ] Maintain pure functions with no side effects

### Functional Performance
- [ ] Design immutable types for optimal tree shaking
- [ ] Use functional lazy evaluation patterns
- [ ] Optimize through functional composition
- [ ] Leverage const assertions for compile-time optimization

### Functional Architecture
- [ ] Replace all classes with functional factories
- [ ] Use higher-order functions instead of inheritance
- [ ] Implement functional dependency injection
- [ ] Design purely functional modules and exports

**Appropriate Score: 1/10** - This represents the absolute dedication to functional programming with zero tolerance for imperative or object-oriented patterns.