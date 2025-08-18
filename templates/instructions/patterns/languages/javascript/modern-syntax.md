# JavaScript Modern Syntax

## Destructuring

### Object Destructuring
Extract values from objects concisely.

```javascript
// Good
const { name, age, city = 'Unknown' } = user;

// Nested destructuring
const { address: { street, zip } } = user;

// Rename variables
const { name: userName, age: userAge } = user;

// Bad
const name = user.name;
const age = user.age;
const city = user.city || 'Unknown';
```

### Array Destructuring
Extract values from arrays.

```javascript
// Good
const [first, second, ...rest] = numbers;

// Skip elements
const [, , third] = numbers;

// Swap variables
[a, b] = [b, a];

// Default values
const [x = 0, y = 0] = coordinates || [];
```

## Spread and Rest

### Spread Operator
Expand iterables into individual elements.

```javascript
// Good - Array operations
const combined = [...arr1, ...arr2];
const copy = [...original];
const max = Math.max(...numbers);

// Object operations
const merged = { ...defaults, ...userConfig };
const clone = { ...original };
const updated = { ...user, name: 'New Name' };

// Bad
const combined = arr1.concat(arr2);
const merged = Object.assign({}, defaults, userConfig);
```

### Rest Parameters
Collect remaining elements.

```javascript
// Good
function sum(...numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}

function logInfo(message, ...details) {
  console.log(message);
  details.forEach(detail => console.log('  -', detail));
}

// Bad
function sum() {
  return Array.from(arguments).reduce((a, b) => a + b, 0);
}
```

## Template Literals

### String Interpolation
Build strings dynamically.

```javascript
// Good
const message = `Hello, ${name}! You have ${count} new messages.`;

// Multi-line strings
const html = `
  <div class="card">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
`;

// Tagged templates
const sql = SQL`SELECT * FROM users WHERE id = ${userId}`;

// Bad
const message = 'Hello, ' + name + '! You have ' + count + ' new messages.';
```

## Arrow Functions

### Concise Syntax
Shorter function expressions.

```javascript
// Good
const double = x => x * 2;
const add = (a, b) => a + b;
const getUser = id => ({ id, name: 'User' });

// Implicit return with object
const createUser = (name, age) => ({ name, age });

// With array methods
const squared = numbers.map(n => n ** 2);
const adults = users.filter(user => user.age >= 18);

// Bad
const double = function(x) {
  return x * 2;
};
```

## Optional Chaining & Nullish Coalescing

### Optional Chaining
Safely access nested properties.

```javascript
// Good
const street = user?.address?.street;
const result = obj?.method?.();
const item = arr?.[index];

// With default values
const name = user?.profile?.name ?? 'Anonymous';

// Bad
const street = user && user.address && user.address.street;
```

### Nullish Coalescing
Default values for null/undefined only.

```javascript
// Good
const port = config.port ?? 3000;
const enabled = settings.enabled ?? true;
const count = value ?? 0;

// Different from OR operator
const value1 = 0 || 5;        // 5 (0 is falsy)
const value2 = 0 ?? 5;        // 0 (0 is not null/undefined)
```

## Async/Await

### Promise Handling
Clean asynchronous code.

```javascript
// Good
async function fetchUserData(id) {
  try {
    const user = await fetchUser(id);
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}

// Parallel execution
async function fetchAll() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),
    fetchPosts(),
    fetchComments()
  ]);
  return { users, posts, comments };
}

// Bad - promise chains
function fetchUserData(id) {
  return fetchUser(id)
    .then(user => fetchPosts(user.id)
      .then(posts => ({ user, posts })))
    .catch(error => {
      console.error('Failed:', error);
      throw error;
    });
}
```

## ES Modules

### Import/Export
Modern module syntax - always use named exports.

```javascript
// ✅ Good - Named exports only
export const API_URL = 'https://api.example.com';
export function fetchData() { /* ... */ }
export class User { /* ... */ }
export class App { /* ... */ }

// ❌ Bad - Default export (PROHIBITED)
// export default class App { /* ... */ }

// Import named exports
import { App } from './App';
import { API_URL, fetchData } from './api';
import * as utils from './utils';

// Dynamic imports
const module = await import('./heavy-module');

// Barrel exports for clean imports
export { UserService } from './UserService';
export { AuthService } from './AuthService';
export { validateEmail, validatePhone } from './validators';
```

## Map, Set, and WeakMap

### Modern Collections
Built-in data structures.

```javascript
// Map - key-value pairs with any key type
const map = new Map();
map.set(obj, 'value');
map.set('key', 42);
map.has(obj);  // true
map.get(obj);  // 'value'

// Set - unique values
const unique = new Set([1, 2, 2, 3, 3]);
console.log([...unique]);  // [1, 2, 3]

// WeakMap - garbage-collectable keys
const cache = new WeakMap();
cache.set(element, computeExpensive(element));
```

## Proxy and Reflect

### Metaprogramming
Intercept and customize operations.

```javascript
// Reactive object
const reactive = obj => new Proxy(obj, {
  set(target, key, value) {
    console.log(`Setting ${key} to ${value}`);
    return Reflect.set(target, key, value);
  },
  get(target, key) {
    console.log(`Getting ${key}`);
    return Reflect.get(target, key);
  }
});

const state = reactive({ count: 0 });
state.count++;  // Logs: Getting count, Setting count to 1
```

## Security Best Practices

✅ Secure data handling:
```javascript
// Good - input sanitization
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000);   // Limit length
};

// Good - secure object creation
export const createSecureUser = ({ name, email, role = 'user' }) => {
  // Validate inputs
  if (!name || typeof name !== 'string') {
    throw new Error('Valid name required');
  }
  
  if (!email || !email.includes('@')) {
    throw new Error('Valid email required');
  }
  
  return {
    name: sanitizeInput(name),
    email: email.toLowerCase().trim(),
    role: ['user', 'admin'].includes(role) ? role : 'user'
  };
};

// Bad - unvalidated input
export default function createUser(data) {
  return {
    name: data.name,    // No validation
    email: data.email,  // No sanitization
    role: data.role     // No role validation
  };
}
```

✅ Secure API calls:
```javascript
// Good - secure fetch with timeout and validation
export const secureApiCall = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    throw error;
  }
};

// Bad - insecure fetch
async function fetchData(url) {
  const response = await fetch(url); // No timeout, no validation
  return response.json(); // No error handling
}
```

✅ Prevent code injection:
```javascript
// Good - safe dynamic imports
export const loadModule = async (moduleName) => {
  const allowedModules = ['userModule', 'adminModule', 'guestModule'];
  
  if (!allowedModules.includes(moduleName)) {
    throw new Error('Module not allowed');
  }
  
  try {
    const module = await import(`./modules/${moduleName}.js`);
    return module;
  } catch (error) {
    throw new Error(`Failed to load module: ${moduleName}`);
  }
};

// Bad - dynamic imports without validation
const loadModule = async (name) => {
  return await import(`./modules/${name}.js`); // Code injection risk
};
```

## Best Practices Checklist

- [ ] Use const by default, let when needed, avoid var
- [ ] Prefer arrow functions for callbacks
- [ ] Use template literals for string concatenation
- [ ] Apply destructuring for cleaner code
- [ ] Use spread operator instead of Object.assign/Array.concat
- [ ] Apply optional chaining for safe property access
- [ ] Use nullish coalescing for defaults
- [ ] Prefer async/await over promise chains
- [ ] Use ES modules (import/export)
- [ ] Apply array methods (map, filter, reduce) over loops
- [ ] Use for...of for iteration, not for...in
- [ ] Validate and sanitize all user inputs
- [ ] Use secure API call patterns with timeouts
- [ ] Prevent code injection with allowlists
- [ ] Always use named exports (no default exports)