# TypeScript Development Patterns

Best practices and patterns for TypeScript development.

## Type Safety

### Strict Mode
Always enable strict mode in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Type Inference
Leverage TypeScript's type inference:
```typescript
// Let TypeScript infer
const numbers = [1, 2, 3]; // number[]

// Explicit when necessary
const mixed: (string | number)[] = [1, "two", 3];
```

## Code Organization

### Module Structure
- One export per file for components
- Group related types in `.types.ts` files
- Separate concerns (logic, types, constants)

### Import Organization
```typescript
// External imports first
import React from 'react';
import { useEffect } from 'react';

// Internal imports
import { UserService } from '@/services';
import { User } from '@/types';

// Relative imports last
import { formatDate } from './utils';
```

## Error Handling

### Type-Safe Errors
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
  }
}
```

### Result Types
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

## Testing Patterns

### Type-Safe Mocks
```typescript
const mockUser: User = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com'
};
```

### Test Utilities
```typescript
function createMockContext(): Context {
  return {
    user: mockUser,
    session: mockSession
  };
}
```

## Performance Patterns

### Lazy Loading
```typescript
const Component = lazy(() => import('./Component'));
```

### Memoization
```typescript
const expensive = useMemo(() => computeExpensive(data), [data]);
```

## Security Patterns

### Input Validation
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
```

### Type Guards
```typescript
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj
  );
}
```