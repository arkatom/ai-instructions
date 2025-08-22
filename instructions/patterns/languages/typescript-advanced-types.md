# TypeScript Advanced Types & Generics Patterns

## 目次
1. [Advanced Type System](#advanced-type-system)
2. [Generic Patterns](#generic-patterns)
3. [Utility Types](#utility-types)
4. [Type Guards & Narrowing](#type-guards--narrowing)
5. [Conditional Types](#conditional-types)
6. [Template Literal Types](#template-literal-types)
7. [Mapped Types](#mapped-types)
8. [Infer Patterns](#infer-patterns)

## Advanced Type System

### 1. Branded Types

```typescript
// Brand types for type-safe primitives
type Brand<K, T> = K & { __brand: T };

type UserId = Brand<string, 'UserId'>;
type ProductId = Brand<string, 'ProductId'>;
type Email = Brand<string, 'Email'>;
type PositiveNumber = Brand<number, 'PositiveNumber'>;

// Helper functions for creating branded types
const UserId = (id: string): UserId => id as UserId;
const ProductId = (id: string): ProductId => id as ProductId;
const Email = (email: string): Email => {
  if (!email.includes('@')) {
    throw new Error('Invalid email format');
  }
  return email as Email;
};

const PositiveNumber = (n: number): PositiveNumber => {
  if (n <= 0) throw new Error('Number must be positive');
  return n as PositiveNumber;
};

// Usage - Type safety prevents mixing IDs
class UserService {
  findUser(id: UserId): Promise<User> {
    // Implementation
    return Promise.resolve({} as User);
  }
}

class ProductService {
  findProduct(id: ProductId): Promise<Product> {
    return Promise.resolve({} as Product);
  }
}

// This would be a compile error:
// userService.findUser(ProductId('123')); // Error!
```

### 2. Discriminated Unions

```typescript
// Advanced discriminated union with exhaustive checking
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// Custom error types
class NetworkError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
  }
}

type ApiError = NetworkError | ValidationError | Error;

// Result helper functions
const Ok = <T>(value: T): Result<T> => ({
  success: true,
  value
});

const Err = <E = Error>(error: E): Result<never, E> => ({
  success: false,
  error
});

// Pattern matching for results
function match<T, E, R>(
  result: Result<T, E>,
  patterns: {
    ok: (value: T) => R;
    err: (error: E) => R;
  }
): R {
  return result.success 
    ? patterns.ok(result.value)
    : patterns.err(result.error);
}

// Advanced state machine with discriminated unions
type ConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; attempt: number }
  | { status: 'connected'; socket: WebSocket; sessionId: string }
  | { status: 'error'; error: Error; lastAttempt: Date };

class WebSocketManager {
  private state: ConnectionState = { status: 'disconnected' };

  async connect(): Promise<void> {
    switch (this.state.status) {
      case 'disconnected':
        this.state = { status: 'connecting', attempt: 1 };
        await this.attemptConnection();
        break;
        
      case 'connecting':
        // Already connecting
        break;
        
      case 'connected':
        // Already connected
        break;
        
      case 'error':
        if (Date.now() - this.state.lastAttempt.getTime() > 5000) {
          this.state = { status: 'connecting', attempt: 1 };
          await this.attemptConnection();
        }
        break;
        
      default:
        const _exhaustive: never = this.state;
        throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }

  private async attemptConnection(): Promise<void> {
    // Implementation
  }
}
```

### 3. Type Predicates

```typescript
// Advanced type predicates with validation
interface User {
  id: string;
  name: string;
  email: string;
}

interface Admin extends User {
  role: 'admin';
  permissions: string[];
}

interface Customer extends User {
  role: 'customer';
  subscription?: 'free' | 'premium';
}

type AnyUser = Admin | Customer;

// Type predicate functions
function isAdmin(user: AnyUser): user is Admin {
  return user.role === 'admin';
}

function isCustomer(user: AnyUser): user is Customer {
  return user.role === 'customer';
}

function isPremiumCustomer(user: AnyUser): user is Customer & { subscription: 'premium' } {
  return isCustomer(user) && user.subscription === 'premium';
}

// Generic type predicate
function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

// Array type predicates
function isArrayOf<T>(
  arr: unknown[],
  predicate: (item: unknown) => item is T
): arr is T[] {
  return arr.every(predicate);
}

// Usage with filtering
const users: (AnyUser | null)[] = [/* ... */];
const admins: Admin[] = users
  .filter(isNotNull)
  .filter(isAdmin);

const premiumCustomers = users
  .filter(isNotNull)
  .filter(isPremiumCustomer);
```

## Generic Patterns

### 1. Advanced Generic Constraints

```typescript
// Complex generic constraints
type Constructor<T = {}> = new (...args: any[]) => T;

// Mixin pattern with generics
function Timestamped<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    timestamp = Date.now();
    
    getAge(): number {
      return Date.now() - this.timestamp;
    }
  };
}

function Activatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    isActive = false;
    
    activate() {
      this.isActive = true;
    }
    
    deactivate() {
      this.isActive = false;
    }
  };
}

// Combining mixins
class User {
  constructor(public name: string) {}
}

const TimestampedUser = Timestamped(User);
const ActivatableTimestampedUser = Activatable(TimestampedUser);

const user = new ActivatableTimestampedUser('John');
user.activate();
console.log(user.getAge());

// Generic constraints with keyof
function pluck<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    result[key] = obj[key];
  });
  return result;
}

// Deep property access with generics
type DeepKeyOf<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | `${K}.${DeepKeyOf<T[K]>}`
        : never;
    }[keyof T]
  : never;

function getDeepProperty<T, K extends DeepKeyOf<T>>(
  obj: T,
  path: K
): any {
  const keys = path.split('.');
  let result: any = obj;
  
  for (const key of keys) {
    result = result[key];
    if (result === undefined) break;
  }
  
  return result;
}
```

### 2. Generic Factory Patterns

```typescript
// Abstract factory with generics
interface Product {
  id: string;
  name: string;
}

interface Repository<T extends Product> {
  find(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Generic repository implementation
class InMemoryRepository<T extends Product> implements Repository<T> {
  private items = new Map<string, T>();

  async find(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  async save(item: T): Promise<void> {
    this.items.set(item.id, item);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

// Factory with dependency injection
class RepositoryFactory {
  private repositories = new Map<string, Repository<any>>();

  register<T extends Product>(
    type: string,
    repository: Repository<T>
  ): void {
    this.repositories.set(type, repository);
  }

  get<T extends Product>(type: string): Repository<T> {
    const repo = this.repositories.get(type);
    if (!repo) {
      throw new Error(`Repository for ${type} not found`);
    }
    return repo;
  }
}

// Generic builder pattern
class Builder<T> {
  private result: Partial<T> = {};

  set<K extends keyof T>(key: K, value: T[K]): this {
    this.result[key] = value;
    return this;
  }

  build(): T {
    // Validate all required properties are set
    return this.result as T;
  }
}

interface UserConfig {
  id: string;
  name: string;
  email: string;
  age?: number;
}

const user = new Builder<UserConfig>()
  .set('id', '123')
  .set('name', 'John')
  .set('email', 'john@example.com')
  .build();
```

### 3. Higher-Order Generics

```typescript
// Function composition with generics
type Fn<A, B> = (a: A) => B;

function compose<A, B, C>(
  f: Fn<B, C>,
  g: Fn<A, B>
): Fn<A, C> {
  return (x: A) => f(g(x));
}

function pipe<A, B, C>(
  f: Fn<A, B>,
  g: Fn<B, C>
): Fn<A, C> {
  return (x: A) => g(f(x));
}

// Variadic pipe function
type PipeArgs<T extends any[], R> = T extends [
  (...args: any[]) => infer A,
  ...infer Rest
]
  ? Rest extends [(arg: A) => any, ...any[]]
    ? Rest extends [any, ...infer Rest2]
      ? PipeArgs<Rest2, R>
      : [T[0], ...PipeArgs<Rest, R>]
    : never
  : T;

function variadicPipe<T extends any[], R>(
  ...fns: PipeArgs<T, R>
): (...args: Parameters<T[0]>) => R {
  return (...args: Parameters<T[0]>) => {
    return fns.reduce((acc, fn, i) => {
      return i === 0 ? fn(...args) : fn(acc);
    }, undefined as any) as R;
  };
}

// Currying with generics
type Curry<F> = F extends (...args: infer A) => infer R
  ? A extends [infer First, ...infer Rest]
    ? (arg: First) => Curry<(...args: Rest) => R>
    : R
  : never;

function curry<F extends (...args: any[]) => any>(
  fn: F
): Curry<F> {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  } as Curry<F>;
}

// Usage
const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add);
const result = curriedAdd(1)(2)(3); // 6
```

## Utility Types

### 1. Custom Utility Types

```typescript
// Deep partial and required
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

// Deep readonly
type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : T extends Function
  ? T
  : T extends object
  ? DeepReadonlyObject<T>
  : T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// Mutable (remove readonly)
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// NonNullableKeys
type NonNullableKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};

// FunctionKeys
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

// NonFunctionKeys
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

// ValueOf
type ValueOf<T> = T[keyof T];

// PromiseType
type PromiseType<T extends Promise<any>> = T extends Promise<infer U>
  ? U
  : never;

// AsyncReturnType
type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;

// Diff (properties in T but not in U)
type Diff<T, U> = T extends U ? never : T;

// Intersection
type Intersection<T, U> = Extract<T, U>;

// Symmetric Difference
type SymmetricDiff<T, U> = Diff<T | U, T & U>;
```

### 2. Advanced Mapped Types

```typescript
// Getter/Setter types
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

type GettersAndSetters<T> = Getters<T> & Setters<T>;

// Implementation
class Store<T extends object> implements GettersAndSetters<T> {
  private data: T;

  constructor(initialData: T) {
    this.data = initialData;
    
    // Dynamically create getters and setters
    Object.keys(initialData).forEach(key => {
      const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      
      (this as any)[`get${capitalizedKey}`] = () => {
        return this.data[key as keyof T];
      };
      
      (this as any)[`set${capitalizedKey}`] = (value: any) => {
        this.data[key as keyof T] = value;
      };
    });
  }
}

// Proxified type
type Proxied<T> = {
  [P in keyof T]: T[P] extends object
    ? Proxied<T[P]>
    : T[P];
} & {
  subscribe(listener: (value: T) => void): () => void;
};

// Event emitter types
type EventMap = Record<string, any>;

type EventKey<T extends EventMap> = string & keyof T;
type EventReceiver<T> = (params: T) => void;

interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(
    eventName: K,
    fn: EventReceiver<T[K]>
  ): void;
  off<K extends EventKey<T>>(
    eventName: K,
    fn: EventReceiver<T[K]>
  ): void;
  emit<K extends EventKey<T>>(
    eventName: K,
    params: T[K]
  ): void;
}

// Type-safe event emitter implementation
class TypedEventEmitter<T extends EventMap> implements Emitter<T> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends EventKey<T>>(
    eventName: K,
    fn: EventReceiver<T[K]>
  ): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(fn);
  }

  off<K extends EventKey<T>>(
    eventName: K,
    fn: EventReceiver<T[K]>
  ): void {
    this.listeners.get(eventName)?.delete(fn);
  }

  emit<K extends EventKey<T>>(
    eventName: K,
    params: T[K]
  ): void {
    this.listeners.get(eventName)?.forEach(fn => fn(params));
  }
}

// Usage
interface AppEvents {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  dataUpdate: { table: string; id: string };
}

const emitter = new TypedEventEmitter<AppEvents>();
emitter.on('login', ({ userId, timestamp }) => {
  console.log(`User ${userId} logged in at ${timestamp}`);
});
```

## Type Guards & Narrowing

### 1. Advanced Type Guards

```typescript
// Structural type guards
type Json =
  | string
  | number
  | boolean
  | null
  | { [property: string]: Json }
  | Json[];

function isJsonObject(
  value: Json
): value is { [property: string]: Json } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isJsonArray(value: Json): value is Json[] {
  return Array.isArray(value);
}

// Exhaustive type guards
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default:
      return assertNever(shape);
  }
}

// Custom type guard combinators
function and<A, B>(
  guardA: (value: any) => value is A,
  guardB: (value: any) => value is B
): (value: any) => value is A & B {
  return (value: any): value is A & B => {
    return guardA(value) && guardB(value);
  };
}

function or<A, B>(
  guardA: (value: any) => value is A,
  guardB: (value: any) => value is B
): (value: any) => value is A | B {
  return (value: any): value is A | B => {
    return guardA(value) || guardB(value);
  };
}

// Schema validation with type guards
type Schema<T> = {
  [K in keyof T]: (value: unknown) => value is T[K];
};

function createValidator<T>(schema: Schema<T>) {
  return (value: unknown): value is T => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    
    for (const key in schema) {
      const validator = schema[key];
      const prop = (value as any)[key];
      
      if (!validator(prop)) {
        return false;
      }
    }
    
    return true;
  };
}

// Usage
const isString = (value: unknown): value is string =>
  typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number';

interface Person {
  name: string;
  age: number;
}

const isPerson = createValidator<Person>({
  name: isString,
  age: isNumber
});
```

### 2. Control Flow Analysis

```typescript
// Advanced control flow narrowing
class NetworkResponse<T> {
  constructor(
    public status: number,
    public data?: T,
    public error?: Error
  ) {}

  isSuccess(): this is NetworkResponse<T> & { data: T } {
    return this.status >= 200 && this.status < 300 && this.data !== undefined;
  }

  isError(): this is NetworkResponse<T> & { error: Error } {
    return this.status >= 400 && this.error !== undefined;
  }
}

async function fetchUser(id: string): Promise<NetworkResponse<User>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (response.ok) {
      const data = await response.json();
      return new NetworkResponse(response.status, data);
    } else {
      return new NetworkResponse(
        response.status,
        undefined,
        new Error(`HTTP ${response.status}`)
      );
    }
  } catch (error) {
    return new NetworkResponse(500, undefined, error as Error);
  }
}

// Usage with narrowing
async function handleUserFetch(id: string) {
  const response = await fetchUser(id);
  
  if (response.isSuccess()) {
    // TypeScript knows response.data is defined and is User
    console.log('User:', response.data.name);
  } else if (response.isError()) {
    // TypeScript knows response.error is defined
    console.error('Error:', response.error.message);
  }
}

// Discriminated union narrowing with const assertions
const ACTIONS = {
  INCREMENT: 'INCREMENT',
  DECREMENT: 'DECREMENT',
  RESET: 'RESET'
} as const;

type ActionType = typeof ACTIONS[keyof typeof ACTIONS];

type Action =
  | { type: typeof ACTIONS.INCREMENT; payload: number }
  | { type: typeof ACTIONS.DECREMENT; payload: number }
  | { type: typeof ACTIONS.RESET };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case ACTIONS.INCREMENT:
      return state + action.payload;
    case ACTIONS.DECREMENT:
      return state - action.payload;
    case ACTIONS.RESET:
      return 0;
    default:
      const _exhaustive: never = action;
      return state;
  }
}
```

## Conditional Types

### 1. Advanced Conditional Types

```typescript
// Extract function parameter types
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

// Extract constructor parameter types
type ConstructorParameters<T> = T extends new (...args: infer P) => any
  ? P
  : never;

// Extract instance type
type InstanceType<T> = T extends new (...args: any[]) => infer R
  ? R
  : never;

// Extract promise type recursively
type UnwrapPromise<T> = T extends Promise<infer U>
  ? UnwrapPromise<U>
  : T;

// Extract array element type
type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

// Conditional type with multiple conditions
type IsEqual<T, U> = T extends U ? (U extends T ? true : false) : false;

type IsAny<T> = 0 extends 1 & T ? true : false;

type IsNever<T> = [T] extends [never] ? true : false;

type IsUnknown<T> = IsNever<T> extends false
  ? T extends unknown
    ? unknown extends T
      ? IsAny<T> extends false
        ? true
        : false
      : false
    : false
  : false;

// Function overload resolution
type OverloadedFunction = {
  (x: string): number;
  (x: number): string;
  (x: boolean): boolean;
};

type ResolveOverload<T, Args extends any[]> = T extends {
  (...args: Args): infer R;
}
  ? R
  : never;

type Result1 = ResolveOverload<OverloadedFunction, [string]>; // number
type Result2 = ResolveOverload<OverloadedFunction, [number]>; // string

// Recursive conditional types
type DeepFlatten<T> = T extends readonly (infer U)[]
  ? DeepFlatten<U>
  : T;

type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never;
    }[keyof T]
  : '';

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Prev = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  ...0[]
];

// Path value extraction
type PathValue<T, P extends Paths<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Paths<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;
```

### 2. Distributive Conditional Types

```typescript
// Basic distributive behavior
type ToArray<T> = T extends any ? T[] : never;

type Example = ToArray<string | number>; // string[] | number[]

// Non-distributive version
type ToArrayNonDistributive<T> = [T] extends [any] ? T[] : never;

type Example2 = ToArrayNonDistributive<string | number>; // (string | number)[]

// Filter types from union
type Filter<T, U> = T extends U ? T : never;

type StringsOnly = Filter<
  string | number | boolean | null,
  string
>; // string

// Exclude null and undefined
type NonNullable<T> = T extends null | undefined ? never : T;

// Extract function types from union
type FunctionTypes<T> = T extends (...args: any[]) => any ? T : never;

type Mixed = string | number | (() => void) | { a: number };
type Functions = FunctionTypes<Mixed>; // () => void

// Conditional type inference in mapped types
type PropGetters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: T[K] extends Function
    ? T[K]
    : () => T[K];
};
```

## Template Literal Types

### 1. String Manipulation Types

```typescript
// CSS-in-JS type safety
type CSSProperty = 
  | 'margin'
  | 'padding'
  | 'border'
  | 'color'
  | 'background';

type CSSUnit = 'px' | 'em' | 'rem' | '%' | 'vh' | 'vw';

type CSSValue<P extends CSSProperty> = P extends 'color' | 'background'
  ? string
  : `${number}${CSSUnit}` | 'auto' | 'inherit';

type CSSProperties = {
  [P in CSSProperty]?: CSSValue<P>;
};

// Route parameter extraction
type ExtractRouteParams<T extends string> = string extends T
  ? Record<string, string>
  : T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
  : T extends `${infer _Start}:${infer Param}`
  ? { [K in Param]: string }
  : {};

type RouteParams = ExtractRouteParams<'/users/:userId/posts/:postId'>;
// { userId: string; postId: string }

// Query builder type safety
type QueryOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';

type WhereClause<T> = {
  [K in keyof T as `where${Capitalize<string & K>}`]?: {
    operator: QueryOperator;
    value: T[K];
  };
};

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

type UserWhereClause = WhereClause<User>;
// {
//   whereId?: { operator: QueryOperator; value: number };
//   whereName?: { operator: QueryOperator; value: string };
//   ...
// }

// Event handler types
type EventHandlerName<T extends string> = `on${Capitalize<T>}`;

type DOMEventHandlers = {
  [K in keyof GlobalEventHandlersEventMap as EventHandlerName<K>]?: (
    event: GlobalEventHandlersEventMap[K]
  ) => void;
};

// Command pattern with template literals
type Command<T extends string> = {
  type: `${Uppercase<T>}_COMMAND`;
  execute(): void;
  undo(): void;
};

class MoveCommand implements Command<'move'> {
  type = 'MOVE_COMMAND' as const;
  
  constructor(
    private entity: Entity,
    private delta: Vector3
  ) {}
  
  execute(): void {
    this.entity.position.add(this.delta);
  }
  
  undo(): void {
    this.entity.position.sub(this.delta);
  }
}
```

### 2. Advanced String Pattern Matching

```typescript
// Email validation type
type ValidEmail<T extends string> = T extends `${infer _}@${infer _}.${infer _}`
  ? T
  : never;

type Email1 = ValidEmail<'user@example.com'>; // 'user@example.com'
type Email2 = ValidEmail<'invalid'>; // never

// Hex color validation
type HexDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' 
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

type HexColor<T extends string> = T extends `#${HexDigit}${HexDigit}${HexDigit}${infer Rest}`
  ? Rest extends ''
    ? T // 3-digit hex
    : Rest extends `${HexDigit}${HexDigit}${HexDigit}`
      ? T // 6-digit hex
      : never
  : never;

// Join and split types
type Join<T extends readonly string[], D extends string> =
  T extends readonly []
    ? ''
    : T extends readonly [infer F]
    ? F extends string
      ? F
      : never
    : T extends readonly [infer F, ...infer R]
    ? F extends string
      ? R extends readonly string[]
        ? `${F}${D}${Join<R, D>}`
        : never
      : never
    : string;

type Split<S extends string, D extends string> =
  string extends S
    ? string[]
    : S extends ''
    ? []
    : S extends `${infer T}${D}${infer U}`
    ? [T, ...Split<U, D>]
    : [S];

// Usage
type Joined = Join<['a', 'b', 'c'], '.'>; // 'a.b.c'
type Splitted = Split<'a.b.c', '.'>; // ['a', 'b', 'c']

// Case conversion
type CamelToKebab<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? `-${Lowercase<T>}${CamelToKebab<U>}`
    : `${T}${CamelToKebab<U>}`
  : S;

type KebabToCamel<S extends string> = S extends `${infer T}-${infer U}`
  ? `${T}${Capitalize<KebabToCamel<U>>}`
  : S;

type Kebab = CamelToKebab<'myVariableName'>; // 'my-variable-name'
type Camel = KebabToCamel<'my-variable-name'>; // 'myVariableName'
```

## Mapped Types

### 1. Advanced Mapped Type Patterns

```typescript
// Recursive mapped types
type DeepFreeze<T> = {
  readonly [P in keyof T]: T[P] extends (infer R)[]
    ? readonly DeepFreeze<R>[]
    : T[P] extends Function
    ? T[P]
    : T[P] extends object
    ? DeepFreeze<T[P]>
    : T[P];
};

// Nullable properties
type NullableProps<T> = {
  [P in keyof T]: T[P] | null;
};

// Optional properties based on condition
type OptionalProps<T, K extends keyof T = keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Required properties based on condition
type RequiredProps<T, K extends keyof T = keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

// Modify property types
type ModifyProps<T, M extends Partial<Record<keyof T, any>>> = {
  [P in keyof T]: P extends keyof M ? M[P] : T[P];
};

// Usage
interface Original {
  id: string;
  name: string;
  age: number;
  optional?: string;
}

type Modified = ModifyProps<Original, {
  id: number;
  age: string;
}>;
// { id: number; name: string; age: string; optional?: string }

// Validation errors type
type ValidationErrors<T> = {
  [P in keyof T]?: T[P] extends object
    ? ValidationErrors<T[P]>
    : string | string[];
};

// Form state management
type FormState<T> = {
  values: T;
  errors: ValidationErrors<T>;
  touched: { [P in keyof T]?: boolean };
  dirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
};

// Pick by value type
type PickByValue<T, V> = Pick<
  T,
  { [K in keyof T]: T[K] extends V ? K : never }[keyof T]
>;

// Omit by value type
type OmitByValue<T, V> = Pick<
  T,
  { [K in keyof T]: T[K] extends V ? never : K }[keyof T]
>;

// Usage
interface Example {
  a: string;
  b: number;
  c: string;
  d: boolean;
}

type StringProps = PickByValue<Example, string>; // { a: string; c: string }
type NonStringProps = OmitByValue<Example, string>; // { b: number; d: boolean }
```

### 2. Key Remapping

```typescript
// Advanced key remapping
type RemovePrefix<T, P extends string> = T extends `${P}${infer R}` ? R : T;

type RemovePrefixFromKeys<T, P extends string> = {
  [K in keyof T as RemovePrefix<K, P>]: T[K];
};

// Add prefix to keys
type AddPrefix<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
};

// Snake case to camel case for keys
type SnakeToCamelCase<S extends string> =
  S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
    : S;

type CamelCaseKeys<T> = {
  [K in keyof T as SnakeToCamelCase<string & K>]: T[K];
};

// Usage
interface SnakeCase {
  user_id: string;
  first_name: string;
  last_name: string;
  created_at: Date;
}

type CamelCase = CamelCaseKeys<SnakeCase>;
// {
//   userId: string;
//   firstName: string;
//   lastName: string;
//   createdAt: Date;
// }

// Nested key paths
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

// Get nested property
type GetNestedProperty<T, P> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? GetNestedProperty<T[K], Rest>
    : never
  : P extends keyof T
  ? T[P]
  : never;

// Set nested property
type SetNestedProperty<T, P, V> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? {
        [Key in keyof T]: Key extends K
          ? SetNestedProperty<T[Key], Rest, V>
          : T[Key];
      }
    : never
  : P extends keyof T
  ? {
      [Key in keyof T]: Key extends P ? V : T[Key];
    }
  : never;
```

## Infer Patterns

### 1. Advanced Inference

```typescript
// Tuple manipulation with infer
type Head<T extends readonly any[]> = T extends readonly [infer H, ...any[]]
  ? H
  : never;

type Tail<T extends readonly any[]> = T extends readonly [any, ...infer R]
  ? R
  : [];

type Last<T extends readonly any[]> = T extends readonly [...any[], infer L]
  ? L
  : never;

type Length<T extends readonly any[]> = T['length'];

type Reverse<T extends readonly any[]> = T extends readonly [
  ...infer Rest,
  infer Last
]
  ? [Last, ...Reverse<Rest>]
  : [];

// Function composition inference
type ComposeResult<Fns extends readonly any[]> = Fns extends readonly [
  (...args: infer A) => infer B,
  ...infer Rest
]
  ? Rest extends readonly [any, ...any[]]
    ? Rest extends readonly [(arg: B) => any, ...any[]]
      ? ComposeResult<Rest> extends (...args: any[]) => infer R
        ? (...args: A) => R
        : never
      : never
    : (...args: A) => B
  : never;

// Promise chain inference
type ChainedPromise<T> = T extends {
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: (value: infer V) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): PromiseLike<TResult1 | TResult2>;
}
  ? V
  : never;

// Method decorator inference
type MethodDecorator<T> = T extends (
  target: infer Target,
  propertyKey: infer Key,
  descriptor: infer Descriptor
) => any
  ? {
      target: Target;
      key: Key;
      descriptor: Descriptor;
    }
  : never;

// React component props inference
type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;

type ComponentPropsWithRef<T> = T extends React.ComponentType<infer P>
  ? P extends { ref?: infer R }
    ? P & { ref?: R }
    : P
  : never;

// Extract return types from overloaded functions
type OverloadedReturnType<T> = T extends {
  (...args: any[]): infer R1;
  (...args: any[]): infer R2;
  (...args: any[]): infer R3;
  (...args: any[]): infer R4;
}
  ? R1 | R2 | R3 | R4
  : T extends {
      (...args: any[]): infer R1;
      (...args: any[]): infer R2;
      (...args: any[]): infer R3;
    }
  ? R1 | R2 | R3
  : T extends {
      (...args: any[]): infer R1;
      (...args: any[]): infer R2;
    }
  ? R1 | R2
  : T extends (...args: any[]) => infer R
  ? R
  : never;
```

### 2. Recursive Type Inference

```typescript
// JSON type inference
type InferJSON<T extends string> = T extends `"${infer S}"`
  ? S
  : T extends `${infer N extends number}`
  ? N
  : T extends 'true'
  ? true
  : T extends 'false'
  ? false
  : T extends 'null'
  ? null
  : T extends `[${infer Items}]`
  ? InferJSONArray<Items>
  : T extends `{${infer Props}}`
  ? InferJSONObject<Props>
  : never;

type InferJSONArray<T extends string> = T extends ''
  ? []
  : T extends `${infer Item},${infer Rest}`
  ? [InferJSON<Item>, ...InferJSONArray<Rest>]
  : [InferJSON<T>];

type InferJSONObject<T extends string> = T extends ''
  ? {}
  : T extends `"${infer Key}":${infer Value},${infer Rest}`
  ? { [K in Key]: InferJSON<Value> } & InferJSONObject<Rest>
  : T extends `"${infer Key}":${infer Value}`
  ? { [K in Key]: InferJSON<Value> }
  : never;

// Type-level arithmetic
type BuildTuple<L extends number, T extends any[] = []> = T['length'] extends L
  ? T
  : BuildTuple<L, [...T, any]>;

type Add<A extends number, B extends number> = [
  ...BuildTuple<A>,
  ...BuildTuple<B>
]['length'];

type Subtract<A extends number, B extends number> = BuildTuple<A> extends [
  ...infer U,
  ...BuildTuple<B>
]
  ? U['length']
  : never;

// Type-level string parsing
type ParseInt<T extends string> = T extends `${infer N extends number}` ? N : never;

type ParseFloat<T extends string> = T extends `${infer N extends number}.${infer D}`
  ? `${N}.${D}` extends `${infer F extends number}`
    ? F
    : never
  : ParseInt<T>;

// SQL query type inference
type ParseSQL<T extends string> = T extends `SELECT ${infer Columns} FROM ${infer Table}${infer Rest}`
  ? {
      type: 'SELECT';
      columns: Split<Columns, ','>;
      table: Trim<Table>;
      where: ParseWhere<Rest>;
    }
  : never;

type ParseWhere<T extends string> = T extends ` WHERE ${infer Condition}`
  ? Condition
  : null;

type Trim<T extends string> = T extends ` ${infer R}`
  ? Trim<R>
  : T extends `${infer R} `
  ? Trim<R>
  : T;

// Usage
type Query = ParseSQL<'SELECT id, name, email FROM users WHERE active = true'>;
// {
//   type: 'SELECT';
//   columns: ['id', 'name', 'email'];
//   table: 'users';
//   where: 'active = true';
// }
```

## Best Practices & Patterns

### 1. Type Safety Patterns

```typescript
// Nominal typing for primitives
declare const brand: unique symbol;

type Brand<T, TBrand> = T & { [brand]: TBrand };

type USD = Brand<number, 'USD'>;
type EUR = Brand<number, 'EUR'>;
type Miles = Brand<number, 'Miles'>;
type Kilometers = Brand<number, 'Kilometers'>;

function convertCurrency(amount: USD, rate: number): EUR {
  return (amount * rate) as EUR;
}

function convertDistance(miles: Miles): Kilometers {
  return (miles * 1.60934) as Kilometers;
}

// Opaque types
declare const opaqueSymbol: unique symbol;

type Opaque<T, Token> = T & { [opaqueSymbol]: Token };

type Password = Opaque<string, 'Password'>;
type HashedPassword = Opaque<string, 'HashedPassword'>;

function hashPassword(password: Password): HashedPassword {
  // Implementation
  return crypto.hash(password) as HashedPassword;
}

// Phantom types
class Quantity<T, Unit> {
  constructor(public readonly value: T) {}
  
  add(other: Quantity<T, Unit>): Quantity<T, Unit> {
    return new Quantity((this.value as any) + (other.value as any));
  }
  
  multiply(scalar: number): Quantity<T, Unit> {
    return new Quantity((this.value as any) * scalar);
  }
}

type Meters = Quantity<number, 'meters'>;
type Seconds = Quantity<number, 'seconds'>;
type MetersPerSecond = Quantity<number, 'meters/second'>;

function velocity(distance: Meters, time: Seconds): MetersPerSecond {
  return new Quantity(distance.value / time.value) as MetersPerSecond;
}
```

### 2. Performance Patterns

```typescript
// Lazy evaluation with types
type Lazy<T> = () => T;

class LazyValue<T> {
  private cached?: T;
  private evaluated = false;
  
  constructor(private readonly thunk: Lazy<T>) {}
  
  get value(): T {
    if (!this.evaluated) {
      this.cached = this.thunk();
      this.evaluated = true;
    }
    return this.cached!;
  }
  
  map<U>(fn: (value: T) => U): LazyValue<U> {
    return new LazyValue(() => fn(this.value));
  }
  
  flatMap<U>(fn: (value: T) => LazyValue<U>): LazyValue<U> {
    return new LazyValue(() => fn(this.value).value);
  }
}

// Memoization with types
type MemoizedFunction<T extends (...args: any[]) => any> = T & {
  clear(): void;
};

function memoize<T extends (...args: any[]) => any>(
  fn: T
): MemoizedFunction<T> {
  const cache = new Map<string, ReturnType<T>>();
  
  const memoized = ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    
    return cache.get(key)!;
  }) as MemoizedFunction<T>;
  
  memoized.clear = () => cache.clear();
  
  return memoized;
}

// Debounce with proper typing
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// Throttle with proper typing
function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}
```

## Summary

このドキュメントでは、TypeScriptの高度な型システムとジェネリクスパターンを包括的にカバーしました：

1. **Advanced Type System**: ブランド型、判別共用体、型述語
2. **Generic Patterns**: 高度なジェネリック制約、ファクトリーパターン、高階ジェネリクス
3. **Utility Types**: カスタムユーティリティ型、高度なマップ型
4. **Type Guards & Narrowing**: 高度な型ガード、制御フロー解析
5. **Conditional Types**: 高度な条件型、分配条件型
6. **Template Literal Types**: 文字列操作型、高度な文字列パターンマッチング
7. **Mapped Types**: 高度なマップ型パターン、キーの再マッピング
8. **Infer Patterns**: 高度な推論、再帰的型推論

これらのパターンを活用することで、より型安全で保守性の高いTypeScriptコードを書くことができます。