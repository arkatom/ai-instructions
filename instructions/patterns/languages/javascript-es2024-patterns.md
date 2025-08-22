# JavaScript ES2024 Modern Patterns

## 目次
1. [ES2024 New Features](#es2024-new-features)
2. [Modern JavaScript Patterns](#modern-javascript-patterns)
3. [Advanced Array & Object Patterns](#advanced-array--object-patterns)
4. [Iterator & Generator Patterns](#iterator--generator-patterns)
5. [Module & Import Patterns](#module--import-patterns)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Performance Optimization](#performance-optimization)
8. [Modern DOM Patterns](#modern-dom-patterns)

## ES2024 New Features

### 1. Object.groupBy() and Map.groupBy()

```javascript
// Object.groupBy() - Group array elements by a key function
const products = [
  { id: 1, category: 'electronics', price: 100 },
  { id: 2, category: 'books', price: 20 },
  { id: 3, category: 'electronics', price: 200 },
  { id: 4, category: 'books', price: 15 }
];

// Group by category
const groupedByCategory = Object.groupBy(products, product => product.category);
console.log(groupedByCategory);
// {
//   electronics: [{ id: 1, category: 'electronics', price: 100 }, { id: 3, category: 'electronics', price: 200 }],
//   books: [{ id: 2, category: 'books', price: 20 }, { id: 4, category: 'books', price: 15 }]
// }

// Group by price range
const groupedByPriceRange = Object.groupBy(products, product => {
  if (product.price < 50) return 'cheap';
  if (product.price < 150) return 'medium';
  return 'expensive';
});

// Map.groupBy() - Returns a Map instead of object
const mapGrouped = Map.groupBy(products, product => product.category);
console.log(mapGrouped.get('electronics'));

// Advanced grouping patterns
class ProductAnalyzer {
  static groupByMultipleKeys(products, keyFunctions) {
    return keyFunctions.reduce((acc, keyFn, index) => {
      const key = `group_${index}`;
      acc[key] = Object.groupBy(products, keyFn);
      return acc;
    }, {});
  }

  static nestedGroupBy(products, primaryKey, secondaryKey) {
    const primaryGroups = Object.groupBy(products, primaryKey);
    
    return Object.fromEntries(
      Object.entries(primaryGroups).map(([key, items]) => [
        key,
        Object.groupBy(items, secondaryKey)
      ])
    );
  }
}

// Usage
const multipleGroups = ProductAnalyzer.groupByMultipleKeys(products, [
  p => p.category,
  p => p.price > 50 ? 'expensive' : 'cheap'
]);

const nestedGroups = ProductAnalyzer.nestedGroupBy(
  products,
  p => p.category,
  p => p.price > 50 ? 'expensive' : 'cheap'
);
```

### 2. Promise.withResolvers()

```javascript
// Promise.withResolvers() - Returns promise with external resolve/reject
function createManualPromise() {
  const { promise, resolve, reject } = Promise.withResolvers();
  
  // Can resolve/reject from outside
  setTimeout(() => {
    resolve('Resolved after 1 second');
  }, 1000);
  
  return { promise, resolve, reject };
}

// Advanced usage patterns
class EventDrivenPromise {
  constructor() {
    const { promise, resolve, reject } = Promise.withResolvers();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
    this.listeners = new Set();
  }

  onResolve(callback) {
    this.listeners.add(callback);
    this.promise.then(callback);
    return this;
  }

  onReject(callback) {
    this.promise.catch(callback);
    return this;
  }

  resolveWith(value) {
    this.listeners.forEach(listener => listener(value));
    this.resolve(value);
  }

  rejectWith(error) {
    this.reject(error);
  }
}

// Request queue with external control
class RequestQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(requestFn) {
    const { promise, resolve, reject } = Promise.withResolvers();
    
    this.queue.push({
      requestFn,
      resolve,
      reject
    });

    this.processQueue();
    return promise;
  }

  async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { requestFn, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}

// Usage
const queue = new RequestQueue(2);

queue.add(() => fetch('/api/data1')).then(response => console.log('Data 1'));
queue.add(() => fetch('/api/data2')).then(response => console.log('Data 2'));
queue.add(() => fetch('/api/data3')).then(response => console.log('Data 3'));
```

### 3. ArrayBuffer Transfer and Resizing

```javascript
// ArrayBuffer transfer for zero-copy operations
function transferArrayBuffer(buffer, newLength) {
  // Transfer ownership to avoid copying
  const newBuffer = buffer.transfer(newLength);
  // Original buffer is now detached
  console.log(buffer.detached); // true
  return newBuffer;
}

// Resizable ArrayBuffer
function createResizableBuffer(initialSize, maxSize) {
  const buffer = new ArrayBuffer(initialSize, { maxByteLength: maxSize });
  
  return {
    buffer,
    resize(newSize) {
      if (newSize <= maxSize) {
        buffer.resize(newSize);
      } else {
        throw new Error('Cannot resize beyond max size');
      }
    },
    get size() {
      return buffer.byteLength;
    },
    get maxSize() {
      return buffer.maxByteLength;
    }
  };
}

// Advanced binary data handling
class BinaryDataManager {
  constructor(initialSize = 1024, maxSize = 1024 * 1024) {
    this.buffer = new ArrayBuffer(initialSize, { maxByteLength: maxSize });
    this.view = new DataView(this.buffer);
    this.position = 0;
  }

  ensureCapacity(additionalBytes) {
    const requiredSize = this.position + additionalBytes;
    if (requiredSize > this.buffer.byteLength) {
      const newSize = Math.min(
        Math.max(this.buffer.byteLength * 2, requiredSize),
        this.buffer.maxByteLength
      );
      this.buffer.resize(newSize);
      this.view = new DataView(this.buffer);
    }
  }

  writeInt32(value) {
    this.ensureCapacity(4);
    this.view.setInt32(this.position, value, true);
    this.position += 4;
  }

  writeString(str) {
    const encoded = new TextEncoder().encode(str);
    this.ensureCapacity(4 + encoded.length);
    this.writeInt32(encoded.length);
    
    const uint8View = new Uint8Array(this.buffer, this.position, encoded.length);
    uint8View.set(encoded);
    this.position += encoded.length;
  }

  readInt32() {
    const value = this.view.getInt32(this.position, true);
    this.position += 4;
    return value;
  }

  readString() {
    const length = this.readInt32();
    const uint8View = new Uint8Array(this.buffer, this.position, length);
    const str = new TextDecoder().decode(uint8View);
    this.position += length;
    return str;
  }

  transferTo(newLength) {
    const newBuffer = this.buffer.transfer(newLength);
    this.buffer = newBuffer;
    this.view = new DataView(this.buffer);
    return this;
  }
}

// Usage
const dataManager = new BinaryDataManager();
dataManager.writeString('Hello World');
dataManager.writeInt32(42);

// Reset position to read
dataManager.position = 0;
console.log(dataManager.readString()); // 'Hello World'
console.log(dataManager.readInt32()); // 42
```

### 4. Temporal API Patterns (Proposed)

```javascript
// Modern date/time handling with Temporal API
// Note: This is a Stage 3 proposal, may change

import { Temporal } from '@js-temporal/polyfill';

class ModernDateUtils {
  // Create precise timestamps
  static now() {
    return Temporal.Now.instant();
  }

  static todayIn(timeZone) {
    return Temporal.Now.plainDateISO(timeZone);
  }

  // Date arithmetic that actually works
  static addBusinessDays(date, days) {
    let result = date;
    let addedDays = 0;
    
    while (addedDays < days) {
      result = result.add({ days: 1 });
      
      // Skip weekends
      if (result.dayOfWeek < 6) {
        addedDays++;
      }
    }
    
    return result;
  }

  // Time zone conversions
  static convertTimeZone(dateTime, fromZone, toZone) {
    const zonedDateTime = dateTime.toZonedDateTime(fromZone);
    return zonedDateTime.withTimeZone(toZone);
  }

  // Duration calculations
  static getTimeBetween(start, end) {
    return end.since(start);
  }

  // Meeting scheduler
  static findMeetingSlots(participants, duration, startDate, endDate) {
    const slots = [];
    let current = startDate;
    
    while (Temporal.PlainDate.compare(current, endDate) <= 0) {
      const workStart = current.toPlainDateTime('09:00');
      const workEnd = current.toPlainDateTime('17:00');
      
      // Check if all participants are available
      const isAvailable = participants.every(participant => 
        this.isAvailable(participant, workStart, duration)
      );
      
      if (isAvailable) {
        slots.push({
          start: workStart,
          end: workStart.add(duration),
          participants
        });
      }
      
      current = current.add({ days: 1 });
    }
    
    return slots;
  }

  static isAvailable(participant, startTime, duration) {
    // Implementation would check participant's calendar
    return true;
  }
}

// Usage
const now = ModernDateUtils.now();
const today = ModernDateUtils.todayIn('Asia/Tokyo');
const nextWeek = today.add({ weeks: 1 });

const meeting = {
  start: today.toPlainDateTime('14:00'),
  duration: Temporal.Duration.from({ hours: 1 })
};

const utcTime = ModernDateUtils.convertTimeZone(
  meeting.start,
  'Asia/Tokyo',
  'UTC'
);
```

## Modern JavaScript Patterns

### 1. Advanced Destructuring Patterns

```javascript
// Deep destructuring with defaults and renaming
const config = {
  api: {
    endpoints: {
      users: '/api/users',
      posts: '/api/posts'
    },
    timeout: 5000
  },
  ui: {
    theme: 'dark',
    features: ['search', 'filter']
  }
};

// Extract nested values with defaults
const {
  api: {
    endpoints: { users: usersEndpoint = '/default/users' } = {},
    timeout = 3000
  } = {},
  ui: {
    theme = 'light',
    features = []
  } = {}
} = config;

// Array destructuring with rest patterns
function processItems([first, second, ...rest]) {
  return {
    primary: first,
    secondary: second,
    remaining: rest,
    total: rest.length + 2
  };
}

// Parameter destructuring with validation
function createUser({
  name,
  email,
  age = 18,
  preferences: {
    theme = 'light',
    notifications = true
  } = {}
} = {}) {
  if (!name || !email) {
    throw new Error('Name and email are required');
  }

  return {
    id: crypto.randomUUID(),
    name,
    email,
    age,
    preferences: { theme, notifications },
    createdAt: new Date()
  };
}

// Dynamic destructuring
function dynamicExtract(obj, paths) {
  return paths.reduce((acc, path) => {
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    
    acc[path] = value;
    return acc;
  }, {});
}

// Usage
const userData = {
  profile: {
    personal: { name: 'John', age: 30 },
    contact: { email: 'john@example.com' }
  }
};

const extracted = dynamicExtract(userData, [
  'profile.personal.name',
  'profile.contact.email',
  'profile.preferences.theme'
]);
// { 'profile.personal.name': 'John', 'profile.contact.email': 'john@example.com', 'profile.preferences.theme': undefined }
```

### 2. Advanced Function Patterns

```javascript
// Higher-order function patterns
const pipe = (...fns) => (value) => fns.reduce((acc, fn) => fn(acc), value);
const compose = (...fns) => (value) => fns.reduceRight((acc, fn) => fn(acc), value);

// Currying with multiple arguments
const curry = (fn) => {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return function(...args2) {
        return curried.apply(this, args.concat(args2));
      };
    }
  };
};

// Partial application
const partial = (fn, ...presetArgs) => {
  return (...laterArgs) => fn(...presetArgs, ...laterArgs);
};

// Memoization with TTL
const memoizeWithTTL = (fn, ttl = 60000) => {
  const cache = new Map();
  
  return (...args) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }
    
    const result = fn(...args);
    cache.set(key, {
      value: result,
      timestamp: Date.now()
    });
    
    return result;
  };
};

// Function composition with error handling
const safeCompose = (...fns) => {
  return (value) => {
    try {
      return fns.reduceRight((acc, fn) => {
        if (typeof fn !== 'function') {
          throw new Error('All arguments must be functions');
        }
        return fn(acc);
      }, value);
    } catch (error) {
      console.error('Composition error:', error);
      return value; // Return original value on error
    }
  };
};

// Retry mechanism
const retry = (fn, attempts = 3, delay = 1000) => {
  return async (...args) => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        if (i === attempts - 1) throw error;
        
        await new Promise(resolve => 
          setTimeout(resolve, delay * Math.pow(2, i))
        );
      }
    }
  };
};

// Function decorators
const logged = (fn) => {
  return function(...args) {
    console.log(`Calling ${fn.name} with args:`, args);
    const result = fn.apply(this, args);
    console.log(`${fn.name} returned:`, result);
    return result;
  };
};

const timed = (fn) => {
  return function(...args) {
    const start = performance.now();
    const result = fn.apply(this, args);
    const end = performance.now();
    console.log(`${fn.name} took ${end - start} milliseconds`);
    return result;
  };
};

// Usage examples
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;
const square = (x) => x * x;

const curriedAdd = curry(add);
const add5 = curriedAdd(5);
console.log(add5(3)); // 8

const calculate = pipe(
  (x) => x + 1,
  (x) => x * 2,
  square
);

console.log(calculate(3)); // 64

const expensiveFunction = memoizeWithTTL((n) => {
  return fibonacci(n); // Expensive computation
}, 5000);

const retryableFetch = retry(fetch, 3, 1000);
```

### 3. Modern Class Patterns

```javascript
// Private fields and methods
class ModernBankAccount {
  // Private fields
  #balance = 0;
  #accountNumber;
  #transactions = [];
  
  // Static private field
  static #nextAccountNumber = 1000;
  
  constructor(initialBalance = 0) {
    this.#balance = initialBalance;
    this.#accountNumber = ModernBankAccount.#generateAccountNumber();
    this.#recordTransaction('initial_deposit', initialBalance);
  }
  
  // Private method
  #recordTransaction(type, amount) {
    this.#transactions.push({
      id: crypto.randomUUID(),
      type,
      amount,
      balance: this.#balance,
      timestamp: new Date()
    });
  }
  
  // Static private method
  static #generateAccountNumber() {
    return this.#nextAccountNumber++;
  }
  
  // Public methods
  deposit(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    this.#balance += amount;
    this.#recordTransaction('deposit', amount);
    return this.#balance;
  }
  
  withdraw(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    
    if (amount > this.#balance) {
      throw new Error('Insufficient funds');
    }
    
    this.#balance -= amount;
    this.#recordTransaction('withdrawal', -amount);
    return this.#balance;
  }
  
  // Getter for read-only access
  get balance() {
    return this.#balance;
  }
  
  get accountNumber() {
    return this.#accountNumber;
  }
  
  get transactionHistory() {
    return [...this.#transactions]; // Return copy
  }
}

// Class decorators (experimental)
function sealed(constructor) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

function logged(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args) {
    console.log(`Calling ${propertyKey} with:`, args);
    const result = originalMethod.apply(this, args);
    console.log(`${propertyKey} returned:`, result);
    return result;
  };
  
  return descriptor;
}

// Mixins pattern
const TimestampMixin = (superclass) => class extends superclass {
  constructor(...args) {
    super(...args);
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  
  touch() {
    this.updatedAt = new Date();
  }
};

const ValidationMixin = (superclass) => class extends superclass {
  validate() {
    // Override in subclass
    throw new Error('validate() must be implemented');
  }
  
  isValid() {
    try {
      this.validate();
      return true;
    } catch {
      return false;
    }
  }
};

// Using mixins
class User extends ValidationMixin(TimestampMixin(Object)) {
  constructor(name, email) {
    super();
    this.name = name;
    this.email = email;
  }
  
  validate() {
    if (!this.name || this.name.length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    
    if (!this.email || !this.email.includes('@')) {
      throw new Error('Valid email required');
    }
  }
}

// Abstract base class pattern
class AbstractShape {
  constructor() {
    if (new.target === AbstractShape) {
      throw new Error('Cannot instantiate abstract class');
    }
  }
  
  // Abstract method
  area() {
    throw new Error('area() must be implemented by subclass');
  }
  
  // Concrete method
  describe() {
    return `This shape has an area of ${this.area()}`;
  }
}

class Circle extends AbstractShape {
  constructor(radius) {
    super();
    this.radius = radius;
  }
  
  area() {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle extends AbstractShape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }
  
  area() {
    return this.width * this.height;
  }
}
```

## Advanced Array & Object Patterns

### 1. Array Enhancement Patterns

```javascript
// Custom array methods
Array.prototype.groupBy = function(keyFn) {
  return this.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
};

Array.prototype.unique = function(keyFn) {
  if (!keyFn) return [...new Set(this)];
  
  const seen = new Set();
  return this.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

Array.prototype.chunk = function(size) {
  const chunks = [];
  for (let i = 0; i < this.length; i += size) {
    chunks.push(this.slice(i, i + size));
  }
  return chunks;
};

Array.prototype.asyncMap = async function(asyncFn) {
  const promises = this.map(asyncFn);
  return Promise.all(promises);
};

Array.prototype.asyncFilter = async function(asyncPredicate) {
  const results = await this.asyncMap(asyncPredicate);
  return this.filter((_, index) => results[index]);
};

// Advanced array operations
class ArrayUtils {
  static zip(...arrays) {
    const length = Math.min(...arrays.map(arr => arr.length));
    return Array.from({ length }, (_, i) => arrays.map(arr => arr[i]));
  }
  
  static partition(array, predicate) {
    return array.reduce(
      ([pass, fail], item) => 
        predicate(item) ? [[...pass, item], fail] : [pass, [...fail, item]],
      [[], []]
    );
  }
  
  static intersection(...arrays) {
    if (arrays.length === 0) return [];
    
    return arrays.reduce((acc, current) => 
      acc.filter(item => current.includes(item))
    );
  }
  
  static difference(array1, array2) {
    return array1.filter(item => !array2.includes(item));
  }
  
  static symmetricDifference(array1, array2) {
    return [
      ...this.difference(array1, array2),
      ...this.difference(array2, array1)
    ];
  }
  
  static flatten(array, depth = Infinity) {
    return depth > 0 
      ? array.reduce((acc, val) => 
          acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val), [])
      : array.slice();
  }
  
  static sample(array, count = 1) {
    const shuffled = array.slice().sort(() => 0.5 - Math.random());
    return count === 1 ? shuffled[0] : shuffled.slice(0, count);
  }
  
  static shuffle(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// Usage examples
const data = [
  { id: 1, category: 'A', value: 10 },
  { id: 2, category: 'B', value: 20 },
  { id: 3, category: 'A', value: 15 },
  { id: 4, category: 'C', value: 25 }
];

const grouped = data.groupBy(item => item.category);
const unique = data.unique(item => item.category);
const chunks = data.chunk(2);

const [highValue, lowValue] = ArrayUtils.partition(
  data, 
  item => item.value >= 20
);

const array1 = [1, 2, 3, 4];
const array2 = [3, 4, 5, 6];
const intersect = ArrayUtils.intersection(array1, array2); // [3, 4]
const diff = ArrayUtils.difference(array1, array2); // [1, 2]
```

### 2. Object Enhancement Patterns

```javascript
// Deep object operations
class ObjectUtils {
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (obj instanceof Set) return new Set([...obj].map(item => this.deepClone(item)));
    if (obj instanceof Map) {
      return new Map([...obj].map(([key, value]) => [key, this.deepClone(value)]));
    }
    
    const cloned = {};
    Object.getOwnPropertyNames(obj).forEach(key => {
      cloned[key] = this.deepClone(obj[key]);
    });
    
    return cloned;
  }
  
  static deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    
    return this.deepMerge(target, ...sources);
  }
  
  static deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => 
      keys2.includes(key) && this.deepEqual(obj1[key], obj2[key])
    );
  }
  
  static get(obj, path, defaultValue) {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      result = result?.[key];
      if (result === undefined) return defaultValue;
    }
    
    return result;
  }
  
  static set(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;
    
    for (const key of keys) {
      if (!(key in current) || !this.isObject(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    return obj;
  }
  
  static omit(obj, keys) {
    const keysToOmit = new Set(Array.isArray(keys) ? keys : [keys]);
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) => !keysToOmit.has(key))
    );
  }
  
  static pick(obj, keys) {
    const keysToPick = new Set(Array.isArray(keys) ? keys : [keys]);
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) => keysToPick.has(key))
    );
  }
  
  static transform(obj, transformer) {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const transformed = transformer(value, key, obj);
      if (transformed !== undefined) {
        result[key] = transformed;
      }
    }
    
    return result;
  }
  
  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

// Proxy-based reactive objects
function createReactiveObject(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      
      if (oldValue !== value) {
        onChange(prop, value, oldValue);
      }
      
      return true;
    },
    
    get(obj, prop) {
      const value = obj[prop];
      
      // If the value is an object, make it reactive too
      if (typeof value === 'object' && value !== null) {
        return createReactiveObject(value, onChange);
      }
      
      return value;
    }
  });
}

// Usage
const state = createReactiveObject({
  user: { name: 'John', age: 30 },
  settings: { theme: 'dark' }
}, (prop, newValue, oldValue) => {
  console.log(`Property ${prop} changed from ${oldValue} to ${newValue}`);
});

// Immutable object helper
class ImmutableHelper {
  static updateIn(obj, path, updater) {
    const keys = path.split('.');
    
    function updateRecursive(current, keyIndex) {
      if (keyIndex >= keys.length) {
        return typeof updater === 'function' ? updater(current) : updater;
      }
      
      const key = keys[keyIndex];
      const currentValue = current[key];
      
      return {
        ...current,
        [key]: updateRecursive(currentValue, keyIndex + 1)
      };
    }
    
    return updateRecursive(obj, 0);
  }
  
  static deleteIn(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    if (keys.length === 0) {
      const { [lastKey]: deleted, ...rest } = obj;
      return rest;
    }
    
    const parentPath = keys.join('.');
    return this.updateIn(obj, parentPath, parent => {
      const { [lastKey]: deleted, ...rest } = parent;
      return rest;
    });
  }
}

// Usage
const user = {
  profile: {
    personal: { name: 'John', age: 30 },
    settings: { theme: 'dark', notifications: true }
  }
};

const updatedUser = ImmutableHelper.updateIn(
  user,
  'profile.personal.age',
  age => age + 1
);

const withoutNotifications = ImmutableHelper.deleteIn(
  user,
  'profile.settings.notifications'
);
```

## Iterator & Generator Patterns

### 1. Custom Iterators

```javascript
// Custom iterator for data structures
class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }
  
  add(value) {
    const node = { value, next: null };
    
    if (!this.head) {
      this.head = node;
    } else {
      let current = this.head;
      while (current.next) {
        current = current.next;
      }
      current.next = node;
    }
    
    this.size++;
  }
  
  // Make it iterable
  [Symbol.iterator]() {
    let current = this.head;
    
    return {
      next() {
        if (current) {
          const value = current.value;
          current = current.next;
          return { value, done: false };
        }
        return { done: true };
      }
    };
  }
  
  // Reverse iterator
  *reverseIterator() {
    const values = [];
    for (const value of this) {
      values.push(value);
    }
    
    for (let i = values.length - 1; i >= 0; i--) {
      yield values[i];
    }
  }
}

// Range iterator
class Range {
  constructor(start, end, step = 1) {
    this.start = start;
    this.end = end;
    this.step = step;
  }
  
  *[Symbol.iterator]() {
    let current = this.start;
    
    if (this.step > 0) {
      while (current < this.end) {
        yield current;
        current += this.step;
      }
    } else {
      while (current > this.end) {
        yield current;
        current += this.step;
      }
    }
  }
  
  *map(fn) {
    for (const value of this) {
      yield fn(value);
    }
  }
  
  *filter(predicate) {
    for (const value of this) {
      if (predicate(value)) {
        yield value;
      }
    }
  }
  
  toArray() {
    return [...this];
  }
}

// Usage
const range = new Range(1, 10, 2);
const squares = range.map(x => x * x);
const evenSquares = squares.filter(x => x % 2 === 0);

console.log([...evenSquares]); // [4, 16, 36]

// Infinite iterators
function* fibonacci() {
  let a = 0, b = 1;
  
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

function* primes() {
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  };
  
  let num = 2;
  while (true) {
    if (isPrime(num)) {
      yield num;
    }
    num++;
  }
}

// Take first n elements from infinite iterator
function* take(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count >= n) break;
    yield item;
    count++;
  }
}

// Usage
const first10Fibs = [...take(fibonacci(), 10)];
const first10Primes = [...take(primes(), 10)];

console.log(first10Fibs); // [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
console.log(first10Primes); // [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
```

### 2. Advanced Generator Patterns

```javascript
// Generator for async operations
async function* asyncGenerator(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      yield { url, data, error: null };
    } catch (error) {
      yield { url, data: null, error };
    }
  }
}

// Parallel async generator
async function* parallelAsyncGenerator(urls, concurrency = 3) {
  const chunks = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        return { url, data, error: null };
      } catch (error) {
        return { url, data: null, error };
      }
    });
    
    const results = await Promise.all(promises);
    for (const result of results) {
      yield result;
    }
  }
}

// Cancellable generator
function createCancellableGenerator(generatorFn) {
  let cancelled = false;
  
  const generator = generatorFn();
  
  return {
    next() {
      if (cancelled) {
        return { done: true };
      }
      return generator.next();
    },
    
    cancel() {
      cancelled = true;
      if (generator.return) {
        generator.return();
      }
    },
    
    [Symbol.iterator]() {
      return this;
    }
  };
}

// State machine with generators
function* stateMachine(initialState, transitions) {
  let currentState = initialState;
  
  while (true) {
    const input = yield currentState;
    
    if (transitions[currentState] && transitions[currentState][input]) {
      currentState = transitions[currentState][input];
    }
  }
}

// Usage
const trafficLightTransitions = {
  red: { next: 'green' },
  green: { next: 'yellow' },
  yellow: { next: 'red' }
};

const trafficLight = stateMachine('red', trafficLightTransitions);

console.log(trafficLight.next().value); // 'red'
console.log(trafficLight.next('next').value); // 'green'
console.log(trafficLight.next('next').value); // 'yellow'
console.log(trafficLight.next('next').value); // 'red'

// Pipeline generator
function* pipeline(source, ...transforms) {
  for (const item of source) {
    let result = item;
    
    for (const transform of transforms) {
      if (typeof transform === 'function') {
        result = transform(result);
      } else if (transform && typeof transform.next === 'function') {
        result = yield* transform(result);
      }
      
      if (result === undefined) break;
    }
    
    if (result !== undefined) {
      yield result;
    }
  }
}

// Transform functions for pipeline
const double = x => x * 2;
const filterEven = function*(x) {
  if (x % 2 === 0) yield x;
};
const addTimestamp = x => ({ value: x, timestamp: Date.now() });

// Usage
const numbers = [1, 2, 3, 4, 5, 6];
const processed = pipeline(numbers, double, filterEven, addTimestamp);

console.log([...processed]);
// [
//   { value: 4, timestamp: ... },
//   { value: 8, timestamp: ... },
//   { value: 12, timestamp: ... }
// ]
```

## Module & Import Patterns

### 1. Dynamic Imports

```javascript
// Conditional module loading
async function loadFeature(featureName) {
  const featureMap = {
    analytics: () => import('./features/analytics.js'),
    charts: () => import('./features/charts.js'),
    dashboard: () => import('./features/dashboard.js')
  };
  
  if (!featureMap[featureName]) {
    throw new Error(`Unknown feature: ${featureName}`);
  }
  
  const module = await featureMap[featureName]();
  return module.default || module;
}

// Plugin system with dynamic imports
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.loadedPlugins = new Set();
  }
  
  register(name, path) {
    this.plugins.set(name, { path, loaded: false });
  }
  
  async load(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not registered`);
    }
    
    if (this.loadedPlugins.has(name)) {
      return this.loadedPlugins.get(name);
    }
    
    try {
      const module = await import(plugin.path);
      const instance = new module.default();
      
      this.loadedPlugins.set(name, instance);
      plugin.loaded = true;
      
      return instance;
    } catch (error) {
      throw new Error(`Failed to load plugin ${name}: ${error.message}`);
    }
  }
  
  async loadAll() {
    const promises = Array.from(this.plugins.keys()).map(name => this.load(name));
    return Promise.all(promises);
  }
  
  unload(name) {
    this.loadedPlugins.delete(name);
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.loaded = false;
    }
  }
}

// Code splitting with route-based loading
class RouteManager {
  constructor() {
    this.routes = new Map();
    this.cache = new Map();
  }
  
  register(pattern, loader) {
    this.routes.set(pattern, loader);
  }
  
  async navigate(path) {
    for (const [pattern, loader] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        return this.loadRoute(pattern, loader, match.params);
      }
    }
    
    throw new Error(`No route found for ${path}`);
  }
  
  async loadRoute(pattern, loader, params) {
    if (this.cache.has(pattern)) {
      const component = this.cache.get(pattern);
      return component.render(params);
    }
    
    const module = await loader();
    const component = new module.default();
    
    this.cache.set(pattern, component);
    return component.render(params);
  }
  
  matchRoute(pattern, path) {
    // Simple pattern matching - in real app use a proper router
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return { params };
  }
}

// Usage
const routeManager = new RouteManager();

routeManager.register('/users/:id', () => import('./pages/UserProfile.js'));
routeManager.register('/products/:category', () => import('./pages/ProductList.js'));
routeManager.register('/dashboard', () => import('./pages/Dashboard.js'));

// Preloading strategies
class ModulePreloader {
  constructor() {
    this.preloadCache = new Map();
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this));
  }
  
  // Preload on hover
  preloadOnHover(element, moduleLoader) {
    let timeoutId;
    
    element.addEventListener('mouseenter', () => {
      timeoutId = setTimeout(() => {
        this.preload(moduleLoader);
      }, 100); // Delay to avoid unnecessary loads
    });
    
    element.addEventListener('mouseleave', () => {
      clearTimeout(timeoutId);
    });
  }
  
  // Preload on visibility
  preloadOnVisible(element, moduleLoader) {
    element.dataset.moduleLoader = moduleLoader.toString();
    this.observer.observe(element);
  }
  
  // Preload with priority
  async preload(moduleLoader, priority = 'low') {
    const key = moduleLoader.toString();
    
    if (this.preloadCache.has(key)) {
      return this.preloadCache.get(key);
    }
    
    const modulePromise = moduleLoader();
    this.preloadCache.set(key, modulePromise);
    
    // Add priority hints for supported browsers
    if ('scheduler' in window && 'postTask' in scheduler) {
      return scheduler.postTask(() => modulePromise, { priority });
    }
    
    return modulePromise;
  }
  
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const moduleLoader = new Function('return ' + entry.target.dataset.moduleLoader)();
        this.preload(moduleLoader);
        this.observer.unobserve(entry.target);
      }
    });
  }
}
```

### 2. Module Federation & Microfrontends

```javascript
// Module federation helper
class ModuleFederation {
  constructor() {
    this.remotes = new Map();
    this.exposedModules = new Map();
  }
  
  // Register remote application
  addRemote(name, url) {
    this.remotes.set(name, {
      url,
      loaded: false,
      container: null
    });
  }
  
  // Load remote container
  async loadRemote(remoteName) {
    const remote = this.remotes.get(remoteName);
    if (!remote) {
      throw new Error(`Remote ${remoteName} not registered`);
    }
    
    if (remote.loaded) {
      return remote.container;
    }
    
    // Load remote container script
    await this.loadScript(remote.url);
    
    // Initialize container
    const container = window[remoteName];
    await container.init(__webpack_share_scopes__.default);
    
    remote.container = container;
    remote.loaded = true;
    
    return container;
  }
  
  // Get module from remote
  async getModule(remoteName, moduleName) {
    const container = await this.loadRemote(remoteName);
    const factory = await container.get(moduleName);
    return factory();
  }
  
  // Expose local module
  expose(name, moduleFactory) {
    this.exposedModules.set(name, moduleFactory);
  }
  
  // Get exposed module
  get(name) {
    const factory = this.exposedModules.get(name);
    if (!factory) {
      throw new Error(`Module ${name} not exposed`);
    }
    return factory();
  }
  
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

// Microfrontend orchestrator
class MicrofrontendOrchestrator {
  constructor() {
    this.microfrontends = new Map();
    this.eventBus = new EventTarget();
  }
  
  register(name, config) {
    this.microfrontends.set(name, {
      ...config,
      mounted: false,
      instance: null
    });
  }
  
  async mount(name, container) {
    const mf = this.microfrontends.get(name);
    if (!mf) {
      throw new Error(`Microfrontend ${name} not registered`);
    }
    
    if (mf.mounted) {
      return mf.instance;
    }
    
    // Load microfrontend module
    const module = await import(mf.entry);
    const instance = new module.default({
      container,
      eventBus: this.eventBus,
      props: mf.props || {}
    });
    
    // Mount the microfrontend
    await instance.mount();
    
    mf.instance = instance;
    mf.mounted = true;
    
    // Emit mount event
    this.eventBus.dispatchEvent(new CustomEvent('microfrontend:mounted', {
      detail: { name, instance }
    }));
    
    return instance;
  }
  
  async unmount(name) {
    const mf = this.microfrontends.get(name);
    if (!mf || !mf.mounted) {
      return;
    }
    
    await mf.instance.unmount();
    mf.mounted = false;
    mf.instance = null;
    
    this.eventBus.dispatchEvent(new CustomEvent('microfrontend:unmounted', {
      detail: { name }
    }));
  }
  
  // Communication between microfrontends
  broadcast(event, data) {
    this.eventBus.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
  
  subscribe(event, handler) {
    this.eventBus.addEventListener(event, handler);
    
    return () => {
      this.eventBus.removeEventListener(event, handler);
    };
  }
}

// Usage
const federation = new ModuleFederation();
federation.addRemote('shell', 'http://localhost:3001/remoteEntry.js');
federation.addRemote('products', 'http://localhost:3002/remoteEntry.js');

const orchestrator = new MicrofrontendOrchestrator();

orchestrator.register('header', {
  entry: 'http://localhost:3001/header.js',
  props: { theme: 'dark' }
});

orchestrator.register('dashboard', {
  entry: 'http://localhost:3002/dashboard.js',
  props: { userId: '123' }
});

// Mount microfrontends
async function initializeApp() {
  const headerContainer = document.getElementById('header');
  const dashboardContainer = document.getElementById('dashboard');
  
  await orchestrator.mount('header', headerContainer);
  await orchestrator.mount('dashboard', dashboardContainer);
  
  // Set up communication
  orchestrator.subscribe('user:logout', () => {
    window.location.href = '/login';
  });
}
```

## Error Handling Patterns

### 1. Advanced Error Handling

```javascript
// Custom error classes with context
class AppError extends Error {
  constructor(message, code, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(field, value, message) {
    super(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR', 400);
    this.field = field;
    this.value = value;
  }
}

class NetworkError extends AppError {
  constructor(url, statusCode, message) {
    super(`Network request failed: ${message}`, 'NETWORK_ERROR', statusCode);
    this.url = url;
  }
}

class BusinessLogicError extends AppError {
  constructor(operation, context, message) {
    super(`Business logic error in ${operation}: ${message}`, 'BUSINESS_ERROR', 422);
    this.operation = operation;
    this.context = context;
  }
}

// Result pattern for error handling
class Result {
  constructor(success, value, error) {
    this.success = success;
    this.value = value;
    this.error = error;
  }
  
  static ok(value) {
    return new Result(true, value, null);
  }
  
  static err(error) {
    return new Result(false, null, error);
  }
  
  isOk() {
    return this.success;
  }
  
  isErr() {
    return !this.success;
  }
  
  map(fn) {
    if (this.isOk()) {
      try {
        return Result.ok(fn(this.value));
      } catch (error) {
        return Result.err(error);
      }
    }
    return this;
  }
  
  flatMap(fn) {
    if (this.isOk()) {
      try {
        return fn(this.value);
      } catch (error) {
        return Result.err(error);
      }
    }
    return this;
  }
  
  mapError(fn) {
    if (this.isErr()) {
      return Result.err(fn(this.error));
    }
    return this;
  }
  
  unwrap() {
    if (this.isOk()) {
      return this.value;
    }
    throw this.error;
  }
  
  unwrapOr(defaultValue) {
    return this.isOk() ? this.value : defaultValue;
  }
  
  match(okFn, errFn) {
    return this.isOk() ? okFn(this.value) : errFn(this.error);
  }
}

// Safe function wrapper
function safe(fn) {
  return (...args) => {
    try {
      const result = fn(...args);
      
      // Handle promises
      if (result && typeof result.then === 'function') {
        return result
          .then(value => Result.ok(value))
          .catch(error => Result.err(error));
      }
      
      return Result.ok(result);
    } catch (error) {
      return Result.err(error);
    }
  };
}

// Error boundary for async operations
class AsyncErrorBoundary {
  constructor() {
    this.errorHandlers = new Map();
    this.fallbackHandler = null;
  }
  
  addHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }
  
  setFallback(handler) {
    this.fallbackHandler = handler;
  }
  
  async execute(asyncFn) {
    try {
      return await asyncFn();
    } catch (error) {
      const handler = this.errorHandlers.get(error.constructor) 
        || this.errorHandlers.get(error.name)
        || this.fallbackHandler;
      
      if (handler) {
        return handler(error);
      }
      
      throw error;
    }
  }
  
  wrap(asyncFn) {
    return (...args) => this.execute(() => asyncFn(...args));
  }
}

// Circuit breaker pattern
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Usage examples
const errorBoundary = new AsyncErrorBoundary();

errorBoundary.addHandler(NetworkError, (error) => {
  console.log('Network error occurred:', error.message);
  return { error: 'Network unavailable' };
});

errorBoundary.addHandler(ValidationError, (error) => {
  console.log('Validation error:', error.field, error.message);
  return { error: `Invalid ${error.field}` };
});

const safeApiCall = errorBoundary.wrap(async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new NetworkError(url, response.status, response.statusText);
  }
  return response.json();
});

// Circuit breaker usage
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000
});

const protectedApiCall = (url) => circuitBreaker.execute(() => fetch(url));

// Result pattern usage
const validateUser = safe((user) => {
  if (!user.email) {
    throw new ValidationError('email', user.email, 'Email is required');
  }
  if (!user.name) {
    throw new ValidationError('name', user.name, 'Name is required');
  }
  return user;
});

const result = validateUser({ name: 'John' });
result.match(
  (user) => console.log('Valid user:', user),
  (error) => console.log('Validation failed:', error.message)
);
```

### 2. Global Error Handling

```javascript
// Global error handler
class GlobalErrorHandler {
  constructor() {
    this.handlers = [];
    this.setupHandlers();
  }
  
  setupHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandledrejection');
      event.preventDefault();
    });
    
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'javascript');
    });
    
    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError(new Error(`Resource failed to load: ${event.target.src || event.target.href}`), 'resource');
      }
    }, true);
  }
  
  addHandler(handler) {
    this.handlers.push(handler);
  }
  
  removeHandler(handler) {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }
  
  handleError(error, type) {
    const errorInfo = {
      error,
      type,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId()
    };
    
    // Execute all handlers
    this.handlers.forEach(handler => {
      try {
        handler(errorInfo);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }
  
  getCurrentUserId() {
    // Implementation depends on your auth system
    return localStorage.getItem('userId') || 'anonymous';
  }
  
  getSessionId() {
    // Implementation depends on your session management
    return sessionStorage.getItem('sessionId') || 'no-session';
  }
}

// Error reporting service
class ErrorReporter {
  constructor(apiEndpoint, apiKey) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.maxRetries = 3;
    
    this.setupNetworkHandlers();
  }
  
  setupNetworkHandlers() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  report(errorInfo) {
    const report = {
      ...errorInfo,
      stackTrace: errorInfo.error?.stack,
      message: errorInfo.error?.message,
      retryCount: 0
    };
    
    if (this.isOnline) {
      this.sendReport(report);
    } else {
      this.queue.push(report);
    }
  }
  
  async sendReport(report) {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(report)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send error report:', error);
      
      if (report.retryCount < this.maxRetries) {
        report.retryCount++;
        this.queue.push(report);
      }
    }
  }
  
  flushQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const report = this.queue.shift();
      this.sendReport(report);
    }
  }
}

// User notification service
class UserNotificationService {
  constructor() {
    this.notificationContainer = this.createNotificationContainer();
  }
  
  createNotificationContainer() {
    let container = document.getElementById('error-notifications');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'error-notifications';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }
    
    return container;
  }
  
  showNotification(errorInfo) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      background: #ff6b6b;
      color: white;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      animation: slideIn 0.3s ease;
    `;
    
    const message = this.getUserFriendlyMessage(errorInfo);
    notification.innerHTML = `
      <div style="font-weight: bold;">Something went wrong</div>
      <div style="font-size: 14px; margin-top: 4px;">${message}</div>
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: white;
        float: right;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
        margin-top: -20px;
      ">×</button>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
  
  getUserFriendlyMessage(errorInfo) {
    const { error, type } = errorInfo;
    
    if (type === 'network') {
      return 'Please check your internet connection and try again.';
    }
    
    if (error instanceof ValidationError) {
      return error.message;
    }
    
    if (error instanceof NetworkError) {
      return 'Unable to connect to our servers. Please try again later.';
    }
    
    return 'An unexpected error occurred. Our team has been notified.';
  }
}

// Setup global error handling
const globalErrorHandler = new GlobalErrorHandler();
const errorReporter = new ErrorReporter('/api/errors', 'your-api-key');
const notificationService = new UserNotificationService();

globalErrorHandler.addHandler((errorInfo) => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Global error:', errorInfo);
  }
  
  // Report to service
  errorReporter.report(errorInfo);
  
  // Show user notification for operational errors
  if (errorInfo.error?.isOperational !== false) {
    notificationService.showNotification(errorInfo);
  }
});
```

## Performance Optimization

### 1. Memory Management

```javascript
// WeakMap for memory-efficient caching
class WeakCache {
  constructor() {
    this.cache = new WeakMap();
  }
  
  get(key) {
    return this.cache.get(key);
  }
  
  set(key, value) {
    this.cache.set(key, value);
    return this;
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  delete(key) {
    return this.cache.delete(key);
  }
  
  // Get or compute pattern
  getOrCompute(key, computeFn) {
    if (this.has(key)) {
      return this.get(key);
    }
    
    const value = computeFn(key);
    this.set(key, value);
    return value;
  }
}

// Object pool for frequent allocations
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    return this.createFn();
  }
  
  release(obj) {
    if (this.resetFn) {
      this.resetFn(obj);
    }
    
    this.pool.push(obj);
  }
  
  clear() {
    this.pool.length = 0;
  }
  
  get size() {
    return this.pool.length;
  }
}

// Usage
const vectorPool = new ObjectPool(
  () => ({ x: 0, y: 0, z: 0 }),
  (vector) => {
    vector.x = 0;
    vector.y = 0;
    vector.z = 0;
  }
);

function calculateDistance(pos1, pos2) {
  const diff = vectorPool.acquire();
  
  diff.x = pos2.x - pos1.x;
  diff.y = pos2.y - pos1.y;
  diff.z = pos2.z - pos1.z;
  
  const distance = Math.sqrt(diff.x ** 2 + diff.y ** 2 + diff.z ** 2);
  
  vectorPool.release(diff);
  return distance;
}

// Memory leak detection
class MemoryMonitor {
  constructor() {
    this.measurements = [];
    this.thresholds = {
      warning: 50 * 1024 * 1024, // 50MB
      critical: 100 * 1024 * 1024 // 100MB
    };
  }
  
  measure() {
    if (!performance.memory) {
      console.warn('performance.memory not available');
      return null;
    }
    
    const measurement = {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };
    
    this.measurements.push(measurement);
    
    // Keep only last 100 measurements
    if (this.measurements.length > 100) {
      this.measurements.shift();
    }
    
    this.checkThresholds(measurement);
    return measurement;
  }
  
  checkThresholds(measurement) {
    if (measurement.usedJSHeapSize > this.thresholds.critical) {
      console.error('Critical memory usage detected:', measurement);
    } else if (measurement.usedJSHeapSize > this.thresholds.warning) {
      console.warn('High memory usage detected:', measurement);
    }
  }
  
  getMemoryTrend() {
    if (this.measurements.length < 2) {
      return 'insufficient-data';
    }
    
    const recent = this.measurements.slice(-10);
    const trend = recent.reduce((acc, measurement, index) => {
      if (index === 0) return acc;
      
      const prev = recent[index - 1];
      const change = measurement.usedJSHeapSize - prev.usedJSHeapSize;
      return acc + change;
    }, 0);
    
    if (trend > 1024 * 1024) return 'increasing'; // 1MB increase
    if (trend < -1024 * 1024) return 'decreasing'; // 1MB decrease
    return 'stable';
  }
  
  startMonitoring(interval = 10000) {
    return setInterval(() => {
      this.measure();
    }, interval);
  }
}

// Garbage collection optimization
class GCOptimizer {
  constructor() {
    this.references = new Set();
    this.cleanupTasks = [];
  }
  
  // Track objects that need cleanup
  track(obj, cleanupFn) {
    this.references.add(obj);
    
    if (cleanupFn) {
      this.cleanupTasks.push({ obj, cleanupFn });
    }
  }
  
  // Manual cleanup
  cleanup() {
    this.cleanupTasks.forEach(({ obj, cleanupFn }) => {
      try {
        cleanupFn(obj);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    
    this.references.clear();
    this.cleanupTasks.length = 0;
    
    // Suggest garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }
  
  // Auto cleanup on page unload
  setupAutoCleanup() {
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }
}

const memoryMonitor = new MemoryMonitor();
const gcOptimizer = new GCOptimizer();

// Start monitoring
const monitoringInterval = memoryMonitor.startMonitoring();
gcOptimizer.setupAutoCleanup();
```

### 2. Performance Optimization Patterns

```javascript
// Debounce and throttle utilities
function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

function throttle(func, limit) {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Advanced throttle with leading and trailing options
function advancedThrottle(func, delay, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastCallTime = 0;
  let timeoutId = null;
  let lastArgs = null;
  
  return function(...args) {
    const now = Date.now();
    
    if (!lastCallTime && !leading) {
      lastCallTime = now;
    }
    
    const remaining = delay - (now - lastCallTime);
    lastArgs = args;
    
    if (remaining <= 0 || remaining > delay) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      lastCallTime = now;
      func.apply(this, args);
    } else if (!timeoutId && trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = leading ? 0 : Date.now();
        timeoutId = null;
        func.apply(this, lastArgs);
      }, remaining);
    }
  };
}

// Batch operations for performance
class BatchProcessor {
  constructor(processFn, options = {}) {
    this.processFn = processFn;
    this.batchSize = options.batchSize || 100;
    this.delay = options.delay || 16; // ~60fps
    this.queue = [];
    this.processing = false;
  }
  
  add(item) {
    this.queue.push(item);
    
    if (!this.processing) {
      this.scheduleProcessing();
    }
  }
  
  addMany(items) {
    this.queue.push(...items);
    
    if (!this.processing) {
      this.scheduleProcessing();
    }
  }
  
  scheduleProcessing() {
    this.processing = true;
    
    const processNextBatch = () => {
      if (this.queue.length === 0) {
        this.processing = false;
        return;
      }
      
      const batch = this.queue.splice(0, this.batchSize);
      
      try {
        this.processFn(batch);
      } catch (error) {
        console.error('Batch processing error:', error);
      }
      
      // Schedule next batch
      setTimeout(processNextBatch, this.delay);
    };
    
    setTimeout(processNextBatch, this.delay);
  }
  
  clear() {
    this.queue.length = 0;
  }
  
  get queueLength() {
    return this.queue.length;
  }
}

// Virtual scrolling for large lists
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5;
    this.renderItem = options.renderItem || ((item, index) => `<div>${item}</div>`);
    
    this.items = [];
    this.visibleItems = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.setupContainer();
    this.setupScrollListener();
  }
  
  setupContainer() {
    this.container.style.overflowY = 'auto';
    this.containerHeight = this.container.clientHeight;
    
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'relative';
    this.container.appendChild(this.viewport);
  }
  
  setupScrollListener() {
    const throttledUpdate = throttle(() => {
      this.scrollTop = this.container.scrollTop;
      this.updateVisibleItems();
    }, 16);
    
    this.container.addEventListener('scroll', throttledUpdate);
  }
  
  setItems(items) {
    this.items = items;
    this.updateContainerHeight();
    this.updateVisibleItems();
  }
  
  updateContainerHeight() {
    const totalHeight = this.items.length * this.itemHeight;
    this.viewport.style.height = `${totalHeight}px`;
  }
  
  updateVisibleItems() {
    const startIndex = Math.max(0, 
      Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize
    );
    
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const endIndex = Math.min(this.items.length - 1, 
      startIndex + visibleCount + this.bufferSize * 2
    );
    
    this.visibleItems = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      this.visibleItems.push({
        index: i,
        item: this.items[i],
        top: i * this.itemHeight
      });
    }
    
    this.render();
  }
  
  render() {
    this.viewport.innerHTML = this.visibleItems
      .map(({ item, index, top }) => {
        return `
          <div style="
            position: absolute;
            top: ${top}px;
            height: ${this.itemHeight}px;
            width: 100%;
          ">
            ${this.renderItem(item, index)}
          </div>
        `;
      })
      .join('');
  }
}

// Intersection Observer for lazy loading
class LazyLoader {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.1;
    this.rootMargin = options.rootMargin || '50px';
    this.loadCallback = options.loadCallback || (() => {});
    
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        threshold: this.threshold,
        rootMargin: this.rootMargin
      }
    );
    
    this.loadingElements = new Set();
  }
  
  observe(element) {
    this.observer.observe(element);
  }
  
  unobserve(element) {
    this.observer.unobserve(element);
    this.loadingElements.delete(element);
  }
  
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && !this.loadingElements.has(entry.target)) {
        this.loadingElements.add(entry.target);
        this.loadCallback(entry.target);
      }
    });
  }
  
  disconnect() {
    this.observer.disconnect();
    this.loadingElements.clear();
  }
}

// Usage examples
const batchProcessor = new BatchProcessor(
  (items) => {
    console.log('Processing batch of', items.length, 'items');
    // Process items
  },
  { batchSize: 50, delay: 10 }
);

// Add items to batch
for (let i = 0; i < 1000; i++) {
  batchProcessor.add({ id: i, data: `item-${i}` });
}

// Virtual list usage
const virtualList = new VirtualList(document.getElementById('list-container'), {
  itemHeight: 60,
  renderItem: (item, index) => `
    <div style="padding: 10px; border-bottom: 1px solid #eee;">
      <strong>${item.name}</strong>
      <div>${item.description}</div>
    </div>
  `
});

virtualList.setItems(Array.from({ length: 10000 }, (_, i) => ({
  name: `Item ${i}`,
  description: `Description for item ${i}`
})));

// Lazy loading usage
const lazyLoader = new LazyLoader({
  loadCallback: (element) => {
    const src = element.dataset.src;
    if (src) {
      element.src = src;
      element.classList.add('loaded');
    }
  }
});

document.querySelectorAll('img[data-src]').forEach(img => {
  lazyLoader.observe(img);
});
```

## Modern DOM Patterns

### 1. Custom Elements

```javascript
// Base custom element class
class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._connected = false;
    this._props = {};
    this._listeners = new Map();
  }
  
  connectedCallback() {
    if (!this._connected) {
      this.setup();
      this.render();
      this.bindEvents();
      this._connected = true;
    }
  }
  
  disconnectedCallback() {
    this.cleanup();
    this._connected = false;
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._props[name] = newValue;
      if (this._connected) {
        this.render();
      }
    }
  }
  
  setup() {
    // Override in subclass
  }
  
  render() {
    // Override in subclass
  }
  
  bindEvents() {
    // Override in subclass
  }
  
  cleanup() {
    this._listeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this._listeners.clear();
  }
  
  addEventListener(element, event, handler) {
    if (!this._listeners.has(element)) {
      this._listeners.set(element, []);
    }
    
    this._listeners.get(element).push({ event, handler });
    element.addEventListener(event, handler);
  }
  
  emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    }));
  }
  
  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }
  
  $$(selector) {
    return this.shadowRoot.querySelectorAll(selector);
  }
}

// Advanced custom element example
class SmartButton extends BaseElement {
  static get observedAttributes() {
    return ['label', 'variant', 'disabled', 'loading'];
  }
  
  setup() {
    this.clickCount = 0;
    this.lastClickTime = 0;
  }
  
  render() {
    const label = this.getAttribute('label') || 'Button';
    const variant = this.getAttribute('variant') || 'primary';
    const disabled = this.hasAttribute('disabled');
    const loading = this.hasAttribute('loading');
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
        }
        
        button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .primary {
          background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .secondary {
          background: #f8f9fa;
          color: #495057;
          border: 1px solid #dee2e6;
        }
        
        .danger {
          background: linear-gradient(45deg, #ff6b6b 0%, #ee5a52 100%);
          color: white;
        }
        
        .loading {
          pointer-events: none;
        }
        
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .ripple {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: scale(0);
          animation: ripple-animation 0.6s linear;
          pointer-events: none;
        }
        
        @keyframes ripple-animation {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      </style>
      
      <button class="${variant} ${loading ? 'loading' : ''}" ${disabled ? 'disabled' : ''}>
        ${loading ? '<span class="spinner"></span>' : ''}
        ${label}
      </button>
    `;
  }
  
  bindEvents() {
    const button = this.$('button');
    
    this.addEventListener(button, 'click', (e) => {
      if (this.hasAttribute('loading') || this.hasAttribute('disabled')) {
        return;
      }
      
      this.createRipple(e);
      this.handleClick(e);
    });
  }
  
  createRipple(e) {
    const button = this.$('button');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
    `;
    
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
  
  handleClick(e) {
    this.clickCount++;
    this.lastClickTime = Date.now();
    
    // Emit custom event
    this.emit('smart-click', {
      clickCount: this.clickCount,
      timestamp: this.lastClickTime,
      coordinates: {
        x: e.clientX,
        y: e.clientY
      }
    });
    
    // Double-click detection
    if (this.clickCount >= 2 && Date.now() - this.lastClickTime < 500) {
      this.emit('smart-double-click', {
        clickCount: this.clickCount
      });
    }
  }
  
  // Public API
  setLoading(loading) {
    if (loading) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
    }
  }
  
  setDisabled(disabled) {
    if (disabled) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }
}

customElements.define('smart-button', SmartButton);

// Form validation custom element
class ValidatedInput extends BaseElement {
  static get observedAttributes() {
    return ['value', 'required', 'pattern', 'min-length', 'max-length', 'type'];
  }
  
  setup() {
    this.validators = [];
    this.errors = [];
    this.touched = false;
  }
  
  render() {
    const type = this.getAttribute('type') || 'text';
    const value = this.getAttribute('value') || '';
    const required = this.hasAttribute('required');
    const placeholder = this.getAttribute('placeholder') || '';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin-bottom: 16px;
        }
        
        .input-group {
          position: relative;
        }
        
        input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 6px;
          font-size: 16px;
          transition: border-color 0.2s ease;
          box-sizing: border-box;
        }
        
        input:focus {
          outline: none;
          border-color: #667eea;
        }
        
        input.error {
          border-color: #ff6b6b;
        }
        
        input.valid {
          border-color: #51cf66;
        }
        
        .error-message {
          color: #ff6b6b;
          font-size: 14px;
          margin-top: 4px;
          display: none;
        }
        
        .error-message.show {
          display: block;
        }
        
        .valid-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #51cf66;
          display: none;
        }
        
        .valid-icon.show {
          display: block;
        }
      </style>
      
      <div class="input-group">
        <input 
          type="${type}" 
          value="${value}" 
          placeholder="${placeholder}"
          ${required ? 'required' : ''}
        />
        <span class="valid-icon">✓</span>
      </div>
      <div class="error-message"></div>
    `;
  }
  
  bindEvents() {
    const input = this.$('input');
    
    this.addEventListener(input, 'input', (e) => {
      this.setAttribute('value', e.target.value);
      this.validate();
      this.emit('input', { value: e.target.value });
    });
    
    this.addEventListener(input, 'blur', () => {
      this.touched = true;
      this.validate();
      this.updateUI();
    });
    
    this.addEventListener(input, 'focus', () => {
      this.emit('focus');
    });
  }
  
  validate() {
    this.errors = [];
    const value = this.getAttribute('value') || '';
    
    // Required validation
    if (this.hasAttribute('required') && !value.trim()) {
      this.errors.push('This field is required');
    }
    
    // Pattern validation
    const pattern = this.getAttribute('pattern');
    if (pattern && value && !new RegExp(pattern).test(value)) {
      this.errors.push('Invalid format');
    }
    
    // Length validation
    const minLength = parseInt(this.getAttribute('min-length'));
    if (minLength && value.length < minLength) {
      this.errors.push(`Minimum ${minLength} characters required`);
    }
    
    const maxLength = parseInt(this.getAttribute('max-length'));
    if (maxLength && value.length > maxLength) {
      this.errors.push(`Maximum ${maxLength} characters allowed`);
    }
    
    // Custom validators
    this.validators.forEach(validator => {
      const result = validator(value);
      if (result !== true) {
        this.errors.push(result);
      }
    });
    
    this.emit('validate', {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      value
    });
    
    return this.errors.length === 0;
  }
  
  updateUI() {
    const input = this.$('input');
    const errorMessage = this.$('.error-message');
    const validIcon = this.$('.valid-icon');
    
    input.classList.remove('error', 'valid');
    errorMessage.classList.remove('show');
    validIcon.classList.remove('show');
    
    if (this.touched) {
      if (this.errors.length > 0) {
        input.classList.add('error');
        errorMessage.textContent = this.errors[0];
        errorMessage.classList.add('show');
      } else if (this.getAttribute('value')) {
        input.classList.add('valid');
        validIcon.classList.add('show');
      }
    }
  }
  
  // Public API
  addValidator(validator) {
    this.validators.push(validator);
  }
  
  removeValidator(validator) {
    const index = this.validators.indexOf(validator);
    if (index > -1) {
      this.validators.splice(index, 1);
    }
  }
  
  isValid() {
    return this.validate();
  }
  
  getValue() {
    return this.getAttribute('value') || '';
  }
  
  setValue(value) {
    this.setAttribute('value', value);
    this.$('input').value = value;
  }
}

customElements.define('validated-input', ValidatedInput);

// Usage
const button = document.querySelector('smart-button');
button.addEventListener('smart-click', (e) => {
  console.log('Button clicked:', e.detail);
});

const input = document.querySelector('validated-input');
input.addValidator((value) => {
  if (value.includes('test')) {
    return 'Value cannot contain "test"';
  }
  return true;
});
```

### 2. Modern DOM Manipulation

```javascript
// Enhanced DOM utilities
class DOMUtils {
  // Efficient element creation
  static create(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'data' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }
  
  // Template-based element creation
  static template(strings, ...values) {
    const html = strings.reduce((acc, string, i) => {
      return acc + string + (values[i] || '');
    }, '');
    
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }
  
  // Batch DOM operations
  static batch(operations) {
    const fragment = document.createDocumentFragment();
    
    operations.forEach(operation => {
      if (typeof operation === 'function') {
        operation(fragment);
      } else if (operation instanceof Node) {
        fragment.appendChild(operation);
      }
    });
    
    return fragment;
  }
  
  // Efficient attribute setting
  static setAttributes(element, attributes) {
    const fragment = document.createDocumentFragment();
    element.parentNode?.replaceChild(fragment, element);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    fragment.parentNode?.replaceChild(element, fragment);
  }
  
  // CSS animation utilities
  static animate(element, keyframes, options = {}) {
    return new Promise((resolve, reject) => {
      const animation = element.animate(keyframes, {
        duration: 300,
        easing: 'ease',
        fill: 'forwards',
        ...options
      });
      
      animation.addEventListener('finish', () => resolve(animation));
      animation.addEventListener('cancel', () => reject(new Error('Animation cancelled')));
    });
  }
  
  // Intersection observer wrapper
  static onVisible(element, callback, options = {}) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, options);
    
    observer.observe(element);
    return observer;
  }
  
  // Resize observer wrapper
  static onResize(element, callback) {
    const observer = new ResizeObserver(entries => {
      entries.forEach(entry => {
        callback(entry.target, entry.contentRect);
      });
    });
    
    observer.observe(element);
    return observer;
  }
  
  // Mutation observer wrapper
  static onChange(element, callback, options = {}) {
    const observer = new MutationObserver(mutations => {
      callback(mutations, element);
    });
    
    observer.observe(element, {
      childList: true,
      attributes: true,
      subtree: true,
      ...options
    });
    
    return observer;
  }
}

// Component system
class Component {
  constructor(element) {
    this.element = element;
    this.state = {};
    this.listeners = new Map();
    this.children = new Set();
    this.parent = null;
    
    this.init();
  }
  
  init() {
    this.render();
    this.bindEvents();
  }
  
  render() {
    // Override in subclass
  }
  
  bindEvents() {
    // Override in subclass
  }
  
  setState(newState) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    this.onStateChange(this.state, prevState);
    this.render();
  }
  
  onStateChange(newState, prevState) {
    // Override in subclass
  }
  
  addChild(child) {
    this.children.add(child);
    child.parent = this;
  }
  
  removeChild(child) {
    this.children.delete(child);
    child.parent = null;
  }
  
  emit(eventName, data) {
    const event = new CustomEvent(eventName, {
      detail: data,
      bubbles: true,
      cancelable: true
    });
    
    this.element.dispatchEvent(event);
  }
  
  on(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    
    this.listeners.get(eventName).add(handler);
    this.element.addEventListener(eventName, handler);
  }
  
  off(eventName, handler) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(handler);
      this.element.removeEventListener(eventName, handler);
    }
  }
  
  destroy() {
    // Remove all event listeners
    this.listeners.forEach((handlers, eventName) => {
      handlers.forEach(handler => {
        this.element.removeEventListener(eventName, handler);
      });
    });
    
    // Destroy children
    this.children.forEach(child => {
      child.destroy();
    });
    
    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }
    
    // Clean up element
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

// Usage examples
const button = DOMUtils.create('button', {
  className: 'btn btn-primary',
  textContent: 'Click me',
  style: { padding: '10px 20px' },
  data: { action: 'submit' },
  onclick: () => console.log('Clicked!')
});

const card = DOMUtils.template`
  <div class="card">
    <h3>${'Dynamic Title'}</h3>
    <p>${'Dynamic content'}</p>
  </div>
`;

// Batch operations for performance
const list = document.getElementById('list');
const fragment = DOMUtils.batch([
  () => DOMUtils.create('li', { textContent: 'Item 1' }),
  () => DOMUtils.create('li', { textContent: 'Item 2' }),
  () => DOMUtils.create('li', { textContent: 'Item 3' })
]);

list.appendChild(fragment);

// Animation example
DOMUtils.animate(button, [
  { transform: 'translateX(0px)' },
  { transform: 'translateX(100px)' }
], { duration: 500 }).then(() => {
  console.log('Animation complete');
});

// Observer examples
DOMUtils.onVisible(card, (element) => {
  console.log('Card became visible');
});

DOMUtils.onResize(document.body, (element, rect) => {
  console.log('Body resized:', rect);
});

DOMUtils.onChange(list, (mutations) => {
  console.log('List changed:', mutations);
});
```

## Summary

このドキュメントでは、JavaScript ES2024の最新機能と現代的なパターンを包括的にカバーしました：

1. **ES2024 New Features**: Object.groupBy(), Promise.withResolvers(), ArrayBuffer Transfer, Temporal API
2. **Modern JavaScript Patterns**: 高度な分割代入、関数パターン、モダンクラス
3. **Advanced Array & Object Patterns**: 配列・オブジェクトの拡張メソッド、プロキシーベースのリアクティブオブジェクト
4. **Iterator & Generator Patterns**: カスタムイテレータ、高度なジェネレータパターン
5. **Module & Import Patterns**: 動的インポート、モジュールフェデレーション、マイクロフロントエンド
6. **Error Handling Patterns**: 高度なエラーハンドリング、Result パターン、サーキットブレーカー
7. **Performance Optimization**: メモリ管理、パフォーマンス最適化パターン
8. **Modern DOM Patterns**: カスタムエレメント、モダンDOM操作

これらのパターンを活用することで、より効率的で保守性の高いモダンなJavaScriptアプリケーションを構築できます。