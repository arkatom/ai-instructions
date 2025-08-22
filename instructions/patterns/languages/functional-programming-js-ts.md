# Functional Programming in JavaScript & TypeScript

## 目次
1. [Core Functional Concepts](#core-functional-concepts)
2. [Higher-Order Functions](#higher-order-functions)
3. [Immutability Patterns](#immutability-patterns)
4. [Monads & Functors](#monads--functors)
5. [Advanced Composition](#advanced-composition)
6. [Type-Safe Functional Programming](#type-safe-functional-programming)
7. [Performance & Optimization](#performance--optimization)
8. [Real-World Applications](#real-world-applications)

## Core Functional Concepts

### 1. Pure Functions & Side Effects

```javascript
// Pure function examples
const add = (a, b) => a + b;
const multiply = (x, y) => x * y;
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

// Impure functions and their pure alternatives
// Impure: relies on external state
let counter = 0;
const impureIncrement = () => ++counter;

// Pure: returns new state
const pureIncrement = (count) => count + 1;

// Impure: modifies input
const impurePush = (arr, item) => {
  arr.push(item);
  return arr;
};

// Pure: returns new array
const purePush = (arr, item) => [...arr, item];

// Handling side effects with pure functions
const createEffectWrapper = (sideEffect) => {
  return (pureFunction) => {
    return (...args) => {
      const result = pureFunction(...args);
      sideEffect(result);
      return result;
    };
  };
};

const logEffect = createEffectWrapper(console.log);
const addWithLogging = logEffect(add);

const result = addWithLogging(2, 3); // Logs: 5, Returns: 5

// IO operations as pure functions
const createIO = (effect) => ({
  effect,
  map: (fn) => createIO(() => fn(effect())),
  flatMap: (fn) => createIO(() => fn(effect()).effect()),
  run: () => effect()
});

const readFile = (filename) => createIO(() => {
  // In real app, this would be async
  return `Contents of ${filename}`;
});

const processFile = (content) => content.toUpperCase();

const fileOperation = readFile('test.txt')
  .map(processFile)
  .map(content => `Processed: ${content}`);

console.log(fileOperation.run());
```

### 2. Function Composition

```javascript
// Basic composition
const compose = (...fns) => (value) => 
  fns.reduceRight((acc, fn) => fn(acc), value);

const pipe = (...fns) => (value) => 
  fns.reduce((acc, fn) => fn(acc), value);

// Utility functions
const trim = str => str.trim();
const toLowerCase = str => str.toLowerCase();
const removeSpaces = str => str.replace(/\s+/g, '');
const addPrefix = prefix => str => `${prefix}${str}`;

// Composed function
const normalizeString = pipe(
  trim,
  toLowerCase,
  removeSpaces,
  addPrefix('normalized_')
);

console.log(normalizeString('  Hello World  ')); // 'normalized_helloworld'

// Async composition
const composeAsync = (...fns) => (value) =>
  fns.reduceRight((acc, fn) => acc.then(fn), Promise.resolve(value));

const pipeAsync = (...fns) => (value) =>
  fns.reduce((acc, fn) => acc.then(fn), Promise.resolve(value));

// Async utility functions
const fetchUser = async (id) => ({ id, name: `User ${id}` });
const addTimestamp = async (user) => ({ ...user, timestamp: Date.now() });
const formatUser = async (user) => `${user.name} (${user.id}) - ${user.timestamp}`;

const processUser = pipeAsync(
  fetchUser,
  addTimestamp,
  formatUser
);

processUser(123).then(console.log);

// Point-free style composition
const words = str => str.split(' ');
const length = arr => arr.length;
const isEven = n => n % 2 === 0;

const hasEvenWordCount = pipe(words, length, isEven);

console.log(hasEvenWordCount('Hello world test')); // false
console.log(hasEvenWordCount('Hello world')); // true

// Composition with error handling
const safeCompose = (...fns) => (value) => {
  try {
    return fns.reduceRight((acc, fn) => {
      if (acc instanceof Error) return acc;
      try {
        return fn(acc);
      } catch (error) {
        return error;
      }
    }, value);
  } catch (error) {
    return error;
  }
};

const riskyFunction = (x) => {
  if (x < 0) throw new Error('Negative number');
  return x * 2;
};

const safeProcess = safeCompose(
  Math.sqrt,
  riskyFunction,
  Math.abs
);

console.log(safeProcess(-4)); // 4 (abs(-4) = 4, riskyFunction(4) = 8, sqrt(8) = 2.83...)
console.log(safeProcess(4));  // 2.83...
```

### 3. Currying & Partial Application

```javascript
// Manual currying
const manualCurry = (fn) => {
  const arity = fn.length;
  
  return function curried(...args) {
    if (args.length >= arity) {
      return fn.apply(this, args);
    } else {
      return function(...args2) {
        return curried.apply(this, args.concat(args2));
      };
    }
  };
};

// Auto-currying with TypeScript support
const curry = <T extends any[], R>(fn: (...args: T) => R) => {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args as T);
    } else {
      return (...args2: any[]) => curried(...args, ...args2);
    }
  };
};

// Practical currying examples
const add3 = (a, b, c) => a + b + c;
const curriedAdd3 = curry(add3);

const add1 = curriedAdd3(1);
const add1and2 = add1(2);
const result = add1and2(3); // 6

// Useful curried functions
const map = curry((fn, array) => array.map(fn));
const filter = curry((predicate, array) => array.filter(predicate));
const reduce = curry((reducer, initial, array) => array.reduce(reducer, initial));

const numbers = [1, 2, 3, 4, 5];

const double = x => x * 2;
const isEven = x => x % 2 === 0;
const sum = (acc, x) => acc + x;

const doubledNumbers = map(double)(numbers);
const evenNumbers = filter(isEven)(numbers);
const total = reduce(sum, 0)(numbers);

// Curried configuration functions
const createApiCall = curry((baseUrl, endpoint, options) => {
  return fetch(`${baseUrl}${endpoint}`, options);
});

const apiCall = createApiCall('https://api.example.com');
const getUsersCall = apiCall('/users');
const getPostsCall = apiCall('/posts');

// Partial application
const partial = (fn, ...presetArgs) => {
  return (...laterArgs) => fn(...presetArgs, ...laterArgs);
};

const greet = (greeting, name, punctuation) => 
  `${greeting}, ${name}${punctuation}`;

const sayHello = partial(greet, 'Hello');
const sayHelloJohn = partial(sayHello, 'John');

console.log(sayHelloJohn('!')); // 'Hello, John!'

// Placeholder partial application
const _ = Symbol('placeholder');

const partialWithPlaceholders = (fn, ...args) => {
  return (...remainingArgs) => {
    let argIndex = 0;
    const finalArgs = args.map(arg => 
      arg === _ ? remainingArgs[argIndex++] : arg
    );
    return fn(...finalArgs, ...remainingArgs.slice(argIndex));
  };
};

const divide = (a, b) => a / b;
const divideBy2 = partialWithPlaceholders(divide, _, 2);
const halveTen = partialWithPlaceholders(divide, 10, _);

console.log(divideBy2(10)); // 5
console.log(halveTen(2));   // 5
```

## Higher-Order Functions

### 1. Advanced Array Operations

```javascript
// Custom higher-order functions
const mapWithIndex = (fn) => (array) => 
  array.map((item, index) => fn(item, index));

const filterWithIndex = (predicate) => (array) =>
  array.filter((item, index) => predicate(item, index));

const takeWhile = (predicate) => (array) => {
  const result = [];
  for (const item of array) {
    if (predicate(item)) {
      result.push(item);
    } else {
      break;
    }
  }
  return result;
};

const dropWhile = (predicate) => (array) => {
  let dropping = true;
  return array.filter((item) => {
    if (dropping && predicate(item)) {
      return false;
    }
    dropping = false;
    return true;
  });
};

const chunk = (size) => (array) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const zip = (...arrays) => {
  const length = Math.min(...arrays.map(arr => arr.length));
  return Array.from({ length }, (_, i) => arrays.map(arr => arr[i]));
};

const zipWith = (fn) => (...arrays) => {
  const length = Math.min(...arrays.map(arr => arr.length));
  return Array.from({ length }, (_, i) => 
    fn(...arrays.map(arr => arr[i]))
  );
};

// Usage examples
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const doubled = mapWithIndex((value, index) => value * 2 + index)(numbers);
const evenPositions = filterWithIndex((value, index) => index % 2 === 0)(numbers);
const takeLessThan5 = takeWhile(x => x < 5)(numbers);
const dropLessThan5 = dropWhile(x => x < 5)(numbers);
const chunked = chunk(3)(numbers);

const names = ['Alice', 'Bob', 'Charlie'];
const ages = [25, 30, 35];
const zipped = zip(names, ages);
const combined = zipWith((name, age) => ({ name, age }))(names, ages);

console.log({ doubled, evenPositions, takeLessThan5, dropLessThan5, chunked, zipped, combined });

// Transducers for composable transformations
const transducer = {
  map: (fn) => (reducer) => (acc, value) => reducer(acc, fn(value)),
  filter: (predicate) => (reducer) => (acc, value) => 
    predicate(value) ? reducer(acc, value) : acc,
  take: (n) => (reducer) => {
    let taken = 0;
    return (acc, value) => {
      if (taken >= n) return acc;
      taken++;
      return reducer(acc, value);
    };
  }
};

const compose = (...transducers) => (reducer) =>
  transducers.reduceRight((acc, t) => t(acc), reducer);

const transduce = (transducer, reducer, initial, collection) =>
  collection.reduce(transducer(reducer), initial);

// Example usage
const xform = compose(
  transducer.map(x => x * 2),
  transducer.filter(x => x > 5),
  transducer.take(3)
);

const result = transduce(
  xform,
  (acc, value) => [...acc, value],
  [],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
);

console.log(result); // [6, 8, 10]
```

### 2. Function Decorators & Combinators

```javascript
// Function decorators
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

const debounce = (delay) => (fn) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const throttle = (limit) => (fn) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const once = (fn) => {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
};

const after = (count) => (fn) => {
  let calls = 0;
  return (...args) => {
    calls++;
    if (calls >= count) {
      return fn(...args);
    }
  };
};

const before = (count) => (fn) => {
  let calls = 0;
  return (...args) => {
    if (calls < count) {
      calls++;
      return fn(...args);
    }
  };
};

// Function combinators
const identity = x => x;
const constant = value => () => value;
const flip = fn => (a, b) => fn(b, a);
const negate = fn => (...args) => !fn(...args);

const and = (f, g) => (...args) => f(...args) && g(...args);
const or = (f, g) => (...args) => f(...args) || g(...args);

// Conditional combinators
const when = (predicate, fn) => (value) =>
  predicate(value) ? fn(value) : value;

const unless = (predicate, fn) => (value) =>
  predicate(value) ? value : fn(value);

const ifElse = (predicate, onTrue, onFalse) => (value) =>
  predicate(value) ? onTrue(value) : onFalse(value);

// Usage examples
const expensiveFibonacci = memoize((n) => {
  if (n <= 1) return n;
  return expensiveFibonacci(n - 1) + expensiveFibonacci(n - 2);
});

const debouncedSave = debounce(300)(data => console.log('Saving:', data));
const throttledScroll = throttle(100)(e => console.log('Scrolling:', e.target.scrollTop));

const initializeOnce = once(() => console.log('Initialized'));
const logAfter3Calls = after(3)((...args) => console.log('Called with:', args));
const logFirst3Calls = before(3)((...args) => console.log('Called with:', args));

// Predicate combinators
const isPositive = x => x > 0;
const isEven = x => x % 2 === 0;
const isOdd = negate(isEven);
const isPositiveAndEven = and(isPositive, isEven);
const isPositiveOrEven = or(isPositive, isEven);

const numbers = [-2, -1, 0, 1, 2, 3, 4];
console.log(numbers.filter(isPositiveAndEven)); // [2, 4]

// Conditional processing
const processPositive = when(isPositive, x => x * 2);
const processNonZero = unless(x => x === 0, x => x * 10);
const categorize = ifElse(
  isPositive,
  x => `positive: ${x}`,
  x => `non-positive: ${x}`
);

console.log(numbers.map(processPositive));   // [-2, -1, 0, 2, 4, 6, 8]
console.log(numbers.map(processNonZero));    // [-20, -10, 0, 10, 20, 30, 40]
console.log(numbers.map(categorize));        // ['non-positive: -2', ...]
```

### 3. Advanced Function Composition

```javascript
// Applicative functor for function composition
const ap = (fnArray, valueArray) =>
  fnArray.flatMap(fn => valueArray.map(fn));

// Lift functions to work with arrays
const lift2 = (fn) => (arr1, arr2) => 
  ap([fn.bind(null)].concat(arr1.map(curry(fn))), arr2);

const lift3 = (fn) => (arr1, arr2, arr3) => 
  ap(ap([fn.bind(null)].concat(arr1.map(curry(fn))), arr2), arr3);

// Usage with lifted functions
const add = (a, b) => a + b;
const multiply = (a, b, c) => a * b * c;

const liftedAdd = lift2(add);
const liftedMultiply = lift3(multiply);

console.log(liftedAdd([1, 2], [3, 4])); // [4, 5, 5, 6]
console.log(liftedMultiply([1, 2], [3, 4], [5, 6])); // [15, 18, 20, 24, ...]

// Monadic composition
const chain = (fn) => (m) => m.flatMap(fn);
const kleisli = (f, g) => (x) => chain(g)(f(x));

// Maybe monad for safe operations
class Maybe {
  constructor(value) {
    this.value = value;
  }
  
  static of(value) {
    return new Maybe(value);
  }
  
  static nothing() {
    return new Maybe(null);
  }
  
  isNothing() {
    return this.value === null || this.value === undefined;
  }
  
  map(fn) {
    return this.isNothing() ? Maybe.nothing() : Maybe.of(fn(this.value));
  }
  
  flatMap(fn) {
    return this.isNothing() ? Maybe.nothing() : fn(this.value);
  }
  
  filter(predicate) {
    return this.isNothing() || !predicate(this.value) ? 
      Maybe.nothing() : this;
  }
  
  getOrElse(defaultValue) {
    return this.isNothing() ? defaultValue : this.value;
  }
}

// Safe operations with Maybe
const safeDivide = (a, b) => 
  b === 0 ? Maybe.nothing() : Maybe.of(a / b);

const safeRoot = (x) => 
  x < 0 ? Maybe.nothing() : Maybe.of(Math.sqrt(x));

const safeParse = (str) => {
  try {
    return Maybe.of(JSON.parse(str));
  } catch {
    return Maybe.nothing();
  }
};

// Monadic composition
const safeCalculation = kleisli(
  x => safeDivide(x, 2),
  x => safeRoot(x)
);

console.log(safeCalculation(8).getOrElse(0)); // 2
console.log(safeCalculation(0).getOrElse(0)); // 0

// Pipeline with error handling
const processData = pipe(
  data => Maybe.of(data),
  m => m.filter(d => d.length > 0),
  m => m.map(d => d.trim()),
  m => m.flatMap(safeParse),
  m => m.map(obj => obj.value),
  m => m.filter(v => typeof v === 'number'),
  m => m.flatMap(v => safeDivide(v, 2))
);

const result1 = processData('{"value": 10}');
const result2 = processData('{"value": "invalid"}');
const result3 = processData('');

console.log(result1.getOrElse('error')); // 5
console.log(result2.getOrElse('error')); // 'error'
console.log(result3.getOrElse('error')); // 'error'
```

## Immutability Patterns

### 1. Immutable Data Structures

```javascript
// Immutable operations on objects
const setIn = (obj, path, value) => {
  const keys = path.split('.');
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  
  const [head, ...tail] = keys;
  return {
    ...obj,
    [head]: setIn(obj[head] || {}, tail.join('.'), value)
  };
};

const updateIn = (obj, path, updater) => {
  const keys = path.split('.');
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: updater(obj[keys[0]]) };
  }
  
  const [head, ...tail] = keys;
  return {
    ...obj,
    [head]: updateIn(obj[head] || {}, tail.join('.'), updater)
  };
};

const deleteIn = (obj, path) => {
  const keys = path.split('.');
  if (keys.length === 1) {
    const { [keys[0]]: deleted, ...rest } = obj;
    return rest;
  }
  
  const [head, ...tail] = keys;
  return {
    ...obj,
    [head]: deleteIn(obj[head] || {}, tail.join('.'))
  };
};

// Immutable array operations
const insertAt = (array, index, item) => [
  ...array.slice(0, index),
  item,
  ...array.slice(index)
];

const removeAt = (array, index) => [
  ...array.slice(0, index),
  ...array.slice(index + 1)
];

const updateAt = (array, index, updater) =>
  array.map((item, i) => i === index ? updater(item) : item);

const moveItem = (array, fromIndex, toIndex) => {
  const item = array[fromIndex];
  const withoutItem = removeAt(array, fromIndex);
  return insertAt(withoutItem, toIndex, item);
};

// Usage examples
const initialState = {
  user: {
    profile: {
      name: 'John',
      age: 30
    },
    preferences: {
      theme: 'dark'
    }
  },
  posts: [
    { id: 1, title: 'First Post' },
    { id: 2, title: 'Second Post' }
  ]
};

const updatedState = setIn(initialState, 'user.profile.age', 31);
const incrementedAge = updateIn(initialState, 'user.profile.age', age => age + 1);
const withoutTheme = deleteIn(initialState, 'user.preferences.theme');

const newPosts = insertAt(initialState.posts, 1, { id: 3, title: 'New Post' });
const withoutFirstPost = removeAt(initialState.posts, 0);
const updatedFirstPost = updateAt(initialState.posts, 0, post => ({ 
  ...post, 
  title: 'Updated First Post' 
}));

// Lens-based approach for complex updates
const lens = (getter, setter) => ({ get: getter, set: setter });

const prop = (key) => lens(
  obj => obj[key],
  (obj, value) => ({ ...obj, [key]: value })
);

const path = (...keys) => lens(
  obj => keys.reduce((acc, key) => acc?.[key], obj),
  (obj, value) => {
    if (keys.length === 1) {
      return { ...obj, [keys[0]]: value };
    }
    const [head, ...tail] = keys;
    return {
      ...obj,
      [head]: path(...tail).set(obj[head] || {}, value)
    };
  }
);

const over = (lens, fn) => (obj) => lens.set(obj, fn(lens.get(obj)));
const set = (lens, value) => (obj) => lens.set(obj, value);
const view = (lens) => (obj) => lens.get(obj);

// Usage with lenses
const userNameLens = path('user', 'profile', 'name');
const userAgeLens = path('user', 'profile', 'age');

const newState = pipe(
  over(userNameLens, name => name.toUpperCase()),
  over(userAgeLens, age => age + 1),
  set(path('user', 'preferences', 'theme'), 'light')
)(initialState);

console.log(view(userNameLens)(newState)); // 'JOHN'
console.log(view(userAgeLens)(newState));  // 31
```

### 2. Functional State Management

```javascript
// Reducer pattern for state management
const createReducer = (initialState, handlers) => {
  return (state = initialState, action) => {
    const handler = handlers[action.type];
    return handler ? handler(state, action) : state;
  };
};

// Action creators
const actionCreator = (type) => (payload) => ({ type, payload });

// State management with immutable updates
const userActions = {
  SET_NAME: 'SET_NAME',
  SET_AGE: 'SET_AGE',
  ADD_HOBBY: 'ADD_HOBBY',
  REMOVE_HOBBY: 'REMOVE_HOBBY',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES'
};

const setName = actionCreator(userActions.SET_NAME);
const setAge = actionCreator(userActions.SET_AGE);
const addHobby = actionCreator(userActions.ADD_HOBBY);
const removeHobby = actionCreator(userActions.REMOVE_HOBBY);
const updatePreferences = actionCreator(userActions.UPDATE_PREFERENCES);

const userReducer = createReducer({
  name: '',
  age: 0,
  hobbies: [],
  preferences: {}
}, {
  [userActions.SET_NAME]: (state, action) => ({
    ...state,
    name: action.payload
  }),
  
  [userActions.SET_AGE]: (state, action) => ({
    ...state,
    age: action.payload
  }),
  
  [userActions.ADD_HOBBY]: (state, action) => ({
    ...state,
    hobbies: [...state.hobbies, action.payload]
  }),
  
  [userActions.REMOVE_HOBBY]: (state, action) => ({
    ...state,
    hobbies: state.hobbies.filter(hobby => hobby !== action.payload)
  }),
  
  [userActions.UPDATE_PREFERENCES]: (state, action) => ({
    ...state,
    preferences: { ...state.preferences, ...action.payload }
  })
});

// Combine reducers
const combineReducers = (reducers) => {
  return (state = {}, action) => {
    return Object.keys(reducers).reduce((nextState, key) => {
      nextState[key] = reducers[key](state[key], action);
      return nextState;
    }, {});
  };
};

const rootReducer = combineReducers({
  user: userReducer,
  // Add more reducers here
});

// Simple state store
const createStore = (reducer, initialState) => {
  let state = initialState;
  const listeners = [];
  
  return {
    getState: () => state,
    
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach(listener => listener(state));
      return action;
    },
    
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }
  };
};

// Usage
const store = createStore(rootReducer, {});

const unsubscribe = store.subscribe(state => {
  console.log('State updated:', state);
});

store.dispatch(setName('Alice'));
store.dispatch(setAge(25));
store.dispatch(addHobby('reading'));
store.dispatch(addHobby('swimming'));
store.dispatch(updatePreferences({ theme: 'dark', language: 'en' }));

// Undo/Redo functionality
const createUndoableStore = (reducer, initialState) => {
  const undoableReducer = (state = { past: [], present: initialState, future: [] }, action) => {
    switch (action.type) {
      case 'UNDO':
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        return {
          past: state.past.slice(0, state.past.length - 1),
          present: previous,
          future: [state.present, ...state.future]
        };
        
      case 'REDO':
        if (state.future.length === 0) return state;
        const next = state.future[0];
        return {
          past: [...state.past, state.present],
          present: next,
          future: state.future.slice(1)
        };
        
      default:
        const newPresent = reducer(state.present, action);
        if (newPresent === state.present) return state;
        return {
          past: [...state.past, state.present],
          present: newPresent,
          future: []
        };
    }
  };
  
  return createStore(undoableReducer);
};

const undoableStore = createUndoableStore(userReducer, {
  name: '',
  age: 0,
  hobbies: [],
  preferences: {}
});

undoableStore.dispatch(setName('Bob'));
undoableStore.dispatch(setAge(30));
console.log(undoableStore.getState().present); // { name: 'Bob', age: 30, ... }

undoableStore.dispatch({ type: 'UNDO' });
console.log(undoableStore.getState().present); // { name: 'Bob', age: 0, ... }

undoableStore.dispatch({ type: 'REDO' });
console.log(undoableStore.getState().present); // { name: 'Bob', age: 30, ... }
```

## Monads & Functors

### 1. Maybe/Option Monad

```javascript
// Enhanced Maybe monad with TypeScript support
class Maybe<T> {
  private constructor(private value: T | null | undefined) {}
  
  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }
  
  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }
  
  static some<T>(value: T): Maybe<T> {
    if (value === null || value === undefined) {
      throw new Error('Cannot create Some with null or undefined');
    }
    return new Maybe(value);
  }
  
  static fromNullable<T>(value: T | null | undefined): Maybe<T> {
    return value === null || value === undefined ? Maybe.nothing() : Maybe.of(value);
  }
  
  isNothing(): boolean {
    return this.value === null || this.value === undefined;
  }
  
  isSome(): boolean {
    return !this.isNothing();
  }
  
  map<U>(fn: (value: T) => U): Maybe<U> {
    return this.isNothing() ? Maybe.nothing<U>() : Maybe.of(fn(this.value!));
  }
  
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return this.isNothing() ? Maybe.nothing<U>() : fn(this.value!);
  }
  
  filter(predicate: (value: T) => boolean): Maybe<T> {
    return this.isNothing() || !predicate(this.value!) ? 
      Maybe.nothing<T>() : this;
  }
  
  getOrElse(defaultValue: T): T {
    return this.isNothing() ? defaultValue : this.value!;
  }
  
  orElse(alternative: Maybe<T>): Maybe<T> {
    return this.isNothing() ? alternative : this;
  }
  
  fold<U>(onNothing: () => U, onSome: (value: T) => U): U {
    return this.isNothing() ? onNothing() : onSome(this.value!);
  }
  
  tap(fn: (value: T) => void): Maybe<T> {
    if (this.isSome()) {
      fn(this.value!);
    }
    return this;
  }
  
  toArray(): T[] {
    return this.isNothing() ? [] : [this.value!];
  }
  
  toString(): string {
    return this.isNothing() ? 'Nothing' : `Some(${this.value})`;
  }
}

// Helper functions for Maybe
const maybe = <T>(value: T | null | undefined): Maybe<T> => 
  Maybe.fromNullable(value);

const some = <T>(value: T): Maybe<T> => Maybe.some(value);
const nothing = <T>(): Maybe<T> => Maybe.nothing<T>();

// Safe operations with Maybe
const safeGet = <T, K extends keyof T>(obj: T, key: K): Maybe<T[K]> =>
  maybe(obj[key]);

const safeParse = (str: string): Maybe<any> => {
  try {
    return some(JSON.parse(str));
  } catch {
    return nothing();
  }
};

const safeParseInt = (str: string): Maybe<number> => {
  const num = parseInt(str, 10);
  return isNaN(num) ? nothing() : some(num);
};

const safeDivide = (a: number, b: number): Maybe<number> =>
  b === 0 ? nothing() : some(a / b);

// Example usage
interface User {
  id: number;
  profile?: {
    name?: string;
    email?: string;
    age?: string;
  };
}

const user: User = {
  id: 1,
  profile: {
    name: 'John',
    age: '25'
  }
};

const processUser = (user: User): Maybe<string> =>
  maybe(user.profile)
    .flatMap(profile => safeGet(profile, 'age'))
    .flatMap(safeParseInt)
    .filter(age => age >= 18)
    .map(age => `User is ${age} years old and can vote`);

console.log(processUser(user).getOrElse('Cannot determine voting eligibility'));
```

### 2. Either/Result Monad

```javascript
// Either monad for error handling
abstract class Either<L, R> {
  abstract isLeft(): boolean;
  abstract isRight(): boolean;
  abstract map<U>(fn: (value: R) => U): Either<L, U>;
  abstract mapLeft<U>(fn: (value: L) => U): Either<U, R>;
  abstract flatMap<U>(fn: (value: R) => Either<L, U>): Either<L, U>;
  abstract fold<U>(onLeft: (left: L) => U, onRight: (right: R) => U): U;
  abstract getOrElse(defaultValue: R): R;
  abstract swap(): Either<R, L>;
  
  static left<L, R>(value: L): Either<L, R> {
    return new Left(value);
  }
  
  static right<L, R>(value: R): Either<L, R> {
    return new Right(value);
  }
  
  static fromNullable<L, R>(value: R | null | undefined, leftValue: L): Either<L, R> {
    return value === null || value === undefined ? 
      Either.left(leftValue) : Either.right(value);
  }
  
  static tryCatch<L, R>(fn: () => R, onError: (error: Error) => L): Either<L, R> {
    try {
      return Either.right(fn());
    } catch (error) {
      return Either.left(onError(error as Error));
    }
  }
}

class Left<L, R> extends Either<L, R> {
  constructor(private value: L) {
    super();
  }
  
  isLeft(): boolean { return true; }
  isRight(): boolean { return false; }
  
  map<U>(_fn: (value: R) => U): Either<L, U> {
    return new Left<L, U>(this.value);
  }
  
  mapLeft<U>(fn: (value: L) => U): Either<U, R> {
    return new Left<U, R>(fn(this.value));
  }
  
  flatMap<U>(_fn: (value: R) => Either<L, U>): Either<L, U> {
    return new Left<L, U>(this.value);
  }
  
  fold<U>(onLeft: (left: L) => U, _onRight: (right: R) => U): U {
    return onLeft(this.value);
  }
  
  getOrElse(defaultValue: R): R {
    return defaultValue;
  }
  
  swap(): Either<R, L> {
    return new Right<R, L>(this.value);
  }
  
  toString(): string {
    return `Left(${this.value})`;
  }
}

class Right<L, R> extends Either<L, R> {
  constructor(private value: R) {
    super();
  }
  
  isLeft(): boolean { return false; }
  isRight(): boolean { return true; }
  
  map<U>(fn: (value: R) => U): Either<L, U> {
    return new Right<L, U>(fn(this.value));
  }
  
  mapLeft<U>(_fn: (value: L) => U): Either<U, R> {
    return new Right<U, R>(this.value);
  }
  
  flatMap<U>(fn: (value: R) => Either<L, U>): Either<L, U> {
    return fn(this.value);
  }
  
  fold<U>(_onLeft: (left: L) => U, onRight: (right: R) => U): U {
    return onRight(this.value);
  }
  
  getOrElse(_defaultValue: R): R {
    return this.value;
  }
  
  swap(): Either<R, L> {
    return new Left<R, L>(this.value);
  }
  
  toString(): string {
    return `Right(${this.value})`;
  }
}

// Helper functions
const left = <L, R>(value: L): Either<L, R> => Either.left(value);
const right = <L, R>(value: R): Either<L, R> => Either.right(value);

// Example with validation
type ValidationError = string;

const validateEmail = (email: string): Either<ValidationError, string> =>
  email.includes('@') ? right(email) : left('Invalid email format');

const validateAge = (age: number): Either<ValidationError, number> =>
  age >= 0 && age <= 150 ? right(age) : left('Invalid age');

const validateName = (name: string): Either<ValidationError, string> =>
  name.length >= 2 ? right(name) : left('Name too short');

// Applicative validation (collect all errors)
const validateUser = (name: string, email: string, age: number) => {
  const nameResult = validateName(name);
  const emailResult = validateEmail(email);
  const ageResult = validateAge(age);
  
  // Collect all validation errors
  const errors: string[] = [];
  if (nameResult.isLeft()) errors.push(nameResult.fold(err => err, () => ''));
  if (emailResult.isLeft()) errors.push(emailResult.fold(err => err, () => ''));
  if (ageResult.isLeft()) errors.push(ageResult.fold(err => err, () => ''));
  
  if (errors.length > 0) {
    return left<string[], { name: string; email: string; age: number }>(errors);
  }
  
  return right<string[], { name: string; email: string; age: number }>({
    name: nameResult.getOrElse(''),
    email: emailResult.getOrElse(''),
    age: ageResult.getOrElse(0)
  });
};

const userResult = validateUser('Jo', 'invalid-email', -5);
console.log(userResult.fold(
  errors => `Validation failed: ${errors.join(', ')}`,
  user => `Valid user: ${JSON.stringify(user)}`
));
```

### 3. IO Monad

```javascript
// IO monad for handling side effects
class IO<T> {
  constructor(private effect: () => T) {}
  
  static of<T>(value: T): IO<T> {
    return new IO(() => value);
  }
  
  static from<T>(effect: () => T): IO<T> {
    return new IO(effect);
  }
  
  map<U>(fn: (value: T) => U): IO<U> {
    return new IO(() => fn(this.effect()));
  }
  
  flatMap<U>(fn: (value: T) => IO<U>): IO<U> {
    return new IO(() => fn(this.effect()).run());
  }
  
  run(): T {
    return this.effect();
  }
  
  // Combine two IO operations
  zip<U>(other: IO<U>): IO<[T, U]> {
    return new IO(() => [this.run(), other.run()]);
  }
  
  // Run this IO, then run another IO with the result
  then<U>(fn: (value: T) => IO<U>): IO<U> {
    return this.flatMap(fn);
  }
  
  // Tap into the value without changing it (for side effects)
  tap(fn: (value: T) => void): IO<T> {
    return new IO(() => {
      const value = this.effect();
      fn(value);
      return value;
    });
  }
}

// IO helper functions
const io = <T>(effect: () => T): IO<T> => IO.from(effect);
const pure = <T>(value: T): IO<T> => IO.of(value);

// Example IO operations
const readFile = (filename: string): IO<string> =>
  io(() => {
    console.log(`Reading file: ${filename}`);
    return `Contents of ${filename}`;
  });

const writeFile = (filename: string, content: string): IO<void> =>
  io(() => {
    console.log(`Writing to file: ${filename}`);
    console.log(`Content: ${content}`);
  });

const log = (message: string): IO<void> =>
  io(() => console.log(message));

const getCurrentTime = (): IO<Date> =>
  io(() => new Date());

// Composing IO operations
const processFile = (filename: string) =>
  readFile(filename)
    .map(content => content.toUpperCase())
    .tap(content => console.log(`Processed content: ${content}`))
    .flatMap(content => writeFile(`processed_${filename}`, content));

const fileProcessingProgram = 
  log('Starting file processing')
    .then(() => getCurrentTime())
    .tap(time => console.log(`Started at: ${time}`))
    .then(() => processFile('data.txt'))
    .then(() => log('File processing completed'));

// Run the program
fileProcessingProgram.run();

// Async IO monad
class AsyncIO<T> {
  constructor(private effect: () => Promise<T>) {}
  
  static of<T>(value: T): AsyncIO<T> {
    return new AsyncIO(() => Promise.resolve(value));
  }
  
  static from<T>(effect: () => Promise<T>): AsyncIO<T> {
    return new AsyncIO(effect);
  }
  
  map<U>(fn: (value: T) => U): AsyncIO<U> {
    return new AsyncIO(async () => fn(await this.effect()));
  }
  
  flatMap<U>(fn: (value: T) => AsyncIO<U>): AsyncIO<U> {
    return new AsyncIO(async () => fn(await this.effect()).run());
  }
  
  async run(): Promise<T> {
    return this.effect();
  }
  
  zip<U>(other: AsyncIO<U>): AsyncIO<[T, U]> {
    return new AsyncIO(async () => Promise.all([this.run(), other.run()]));
  }
  
  then<U>(fn: (value: T) => AsyncIO<U>): AsyncIO<U> {
    return this.flatMap(fn);
  }
  
  tap(fn: (value: T) => void): AsyncIO<T> {
    return new AsyncIO(async () => {
      const value = await this.effect();
      fn(value);
      return value;
    });
  }
  
  catch<U>(fn: (error: Error) => AsyncIO<U>): AsyncIO<T | U> {
    return new AsyncIO(async () => {
      try {
        return await this.effect();
      } catch (error) {
        return fn(error as Error).run();
      }
    });
  }
}

// Async IO helper functions
const asyncIO = <T>(effect: () => Promise<T>): AsyncIO<T> => AsyncIO.from(effect);
const asyncPure = <T>(value: T): AsyncIO<T> => AsyncIO.of(value);

// Example async IO operations
const fetchData = (url: string): AsyncIO<any> =>
  asyncIO(async () => {
    const response = await fetch(url);
    return response.json();
  });

const saveToDatabase = (data: any): AsyncIO<void> =>
  asyncIO(async () => {
    console.log('Saving to database:', data);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
  });

const asyncLog = (message: string): AsyncIO<void> =>
  asyncIO(async () => console.log(message));

// Composing async IO operations
const dataProcessingProgram = 
  asyncLog('Starting data processing')
    .then(() => fetchData('/api/data'))
    .tap(data => console.log('Fetched data:', data))
    .map(data => ({ ...data, processed: true, timestamp: Date.now() }))
    .flatMap(saveToDatabase)
    .then(() => asyncLog('Data processing completed'))
    .catch(error => asyncLog(`Error: ${error.message}`));

// Run the async program
dataProcessingProgram.run().then(() => console.log('Program finished'));
```

## Type-Safe Functional Programming

### 1. Advanced TypeScript Patterns

```typescript
// Type-level programming for functional utilities
type Fn<A, B> = (a: A) => B;
type AsyncFn<A, B> = (a: A) => Promise<B>;

// Pipe function with proper typing
type PipeArgs<T extends ReadonlyArray<any>, R> = T extends readonly []
  ? []
  : T extends readonly [Fn<infer A, infer B>]
  ? [Fn<A, B>]
  : T extends readonly [Fn<infer A, infer B>, ...infer Rest]
  ? Rest extends ReadonlyArray<Fn<any, any>>
    ? [Fn<A, B>, ...PipeArgs<Rest, R>]
    : never
  : never;

type PipeReturn<T extends ReadonlyArray<any>> = T extends readonly []
  ? never
  : T extends readonly [Fn<any, infer B>]
  ? B
  : T extends readonly [Fn<any, any>, ...infer Rest]
  ? Rest extends ReadonlyArray<Fn<any, any>>
    ? PipeReturn<Rest>
    : never
  : never;

function pipe<T extends ReadonlyArray<Fn<any, any>>>(
  ...fns: T
): T extends readonly [Fn<infer A, any>, ...any[]]
  ? Fn<A, PipeReturn<T>>
  : never {
  return ((value: any) => fns.reduce((acc, fn) => fn(acc), value)) as any;
}

// Curry with proper TypeScript support
type Curry<T> = T extends (arg: infer A, ...args: infer B) => infer R
  ? B extends []
    ? (arg: A) => R
    : (arg: A) => Curry<(...args: B) => R>
  : never;

function curry<T extends (...args: any[]) => any>(fn: T): Curry<T> {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    } else {
      return (...args2: any[]) => curried(...args, ...args2);
    }
  } as Curry<T>;
}

// Type-safe array utilities
const map = <T, U>(fn: (value: T) => U) => (array: T[]): U[] =>
  array.map(fn);

const filter = <T>(predicate: (value: T) => boolean) => (array: T[]): T[] =>
  array.filter(predicate);

const reduce = <T, U>(reducer: (acc: U, value: T) => U, initial: U) => (array: T[]): U =>
  array.reduce(reducer, initial);

// Type-safe object utilities
type ObjectKeys<T> = keyof T;
type ObjectValues<T> = T[keyof T];
type ObjectEntries<T> = Array<[keyof T, T[keyof T]]>;

const keys = <T extends Record<string, any>>(obj: T): Array<keyof T> =>
  Object.keys(obj) as Array<keyof T>;

const values = <T extends Record<string, any>>(obj: T): Array<T[keyof T]> =>
  Object.values(obj);

const entries = <T extends Record<string, any>>(obj: T): ObjectEntries<T> =>
  Object.entries(obj) as ObjectEntries<T>;

const fromEntries = <K extends string, V>(entries: Array<[K, V]>): Record<K, V> =>
  Object.fromEntries(entries) as Record<K, V>;

// Type-safe property access
type Path<T, K extends keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? T[K] extends ReadonlyArray<any>
      ? K | `${K}.${number}` | `${K}.${number}.${Path<T[K][number], keyof T[K][number]>}`
      : K | `${K}.${Path<T[K], keyof T[K]>}`
    : K
  : never;

type PathValue<T, P extends Path<T, keyof T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Path<T[K], keyof T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

function get<T, P extends Path<T, keyof T>>(obj: T, path: P): PathValue<T, P> | undefined {
  const keys = path.split('.');
  let result: any = obj;
  
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) break;
  }
  
  return result;
}

// Usage examples with type safety
interface User {
  id: number;
  name: string;
  profile: {
    email: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
  posts: Array<{
    id: number;
    title: string;
    tags: string[];
  }>;
}

const user: User = {
  id: 1,
  name: 'John',
  profile: {
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  },
  posts: [
    { id: 1, title: 'First Post', tags: ['tech', 'js'] },
    { id: 2, title: 'Second Post', tags: ['functional', 'programming'] }
  ]
};

// Type-safe property access
const theme = get(user, 'profile.preferences.theme'); // 'light' | 'dark' | undefined
const firstPostTitle = get(user, 'posts.0.title'); // string | undefined

// Type-safe functional composition
const processUsers = pipe(
  filter((user: User) => user.posts.length > 0),
  map((user: User) => ({
    id: user.id,
    name: user.name,
    postCount: user.posts.length
  })),
  filter(userSummary => userSummary.postCount > 1)
);

const users: User[] = [user];
const activeUsers = processUsers(users);

// Type-safe currying
const addThreeNumbers = (a: number, b: number, c: number): number => a + b + c;
const curriedAdd = curry(addThreeNumbers);

const add5 = curriedAdd(5);
const add5And3 = add5(3);
const result = add5And3(2); // 10, fully type-safe

// Generic functor interface
interface Functor<T> {
  map<U>(fn: (value: T) => U): Functor<U>;
}

// Type-safe Maybe implementation
class TypedMaybe<T> implements Functor<T> {
  private constructor(private value: T | null | undefined) {}
  
  static of<T>(value: T): TypedMaybe<T> {
    return new TypedMaybe(value);
  }
  
  static nothing<T>(): TypedMaybe<T> {
    return new TypedMaybe<T>(null);
  }
  
  map<U>(fn: (value: T) => U): TypedMaybe<U> {
    return this.isNothing() ? TypedMaybe.nothing<U>() : TypedMaybe.of(fn(this.value!));
  }
  
  flatMap<U>(fn: (value: T) => TypedMaybe<U>): TypedMaybe<U> {
    return this.isNothing() ? TypedMaybe.nothing<U>() : fn(this.value!);
  }
  
  isNothing(): boolean {
    return this.value === null || this.value === undefined;
  }
  
  getOrElse<U>(defaultValue: U): T | U {
    return this.isNothing() ? defaultValue : this.value!;
  }
}

// Usage with type inference
const maybeNumber = TypedMaybe.of(42);
const maybeString = maybeNumber.map(n => n.toString()); // TypedMaybe<string>
const maybeLength = maybeString.map(s => s.length); // TypedMaybe<number>
```

### 2. Functional Error Handling

```typescript
// Result type with comprehensive error handling
type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

class ResultType<T, E = Error> {
  private constructor(private result: Result<T, E>) {}
  
  static ok<T, E = Error>(value: T): ResultType<T, E> {
    return new ResultType({ success: true, value });
  }
  
  static err<T, E = Error>(error: E): ResultType<T, E> {
    return new ResultType({ success: false, error });
  }
  
  static fromTryCatch<T, E = Error>(
    fn: () => T,
    errorMapper?: (error: unknown) => E
  ): ResultType<T, E> {
    try {
      return ResultType.ok(fn());
    } catch (error) {
      const mappedError = errorMapper ? errorMapper(error) : error as E;
      return ResultType.err(mappedError);
    }
  }
  
  static async fromAsyncTryCatch<T, E = Error>(
    fn: () => Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<ResultType<T, E>> {
    try {
      const value = await fn();
      return ResultType.ok(value);
    } catch (error) {
      const mappedError = errorMapper ? errorMapper(error) : error as E;
      return ResultType.err(mappedError);
    }
  }
  
  isOk(): this is ResultType<T, never> {
    return this.result.success;
  }
  
  isErr(): this is ResultType<never, E> {
    return !this.result.success;
  }
  
  map<U>(fn: (value: T) => U): ResultType<U, E> {
    return this.isOk() 
      ? ResultType.ok(fn(this.result.value))
      : ResultType.err(this.result.error);
  }
  
  mapErr<F>(fn: (error: E) => F): ResultType<T, F> {
    return this.isErr()
      ? ResultType.err(fn(this.result.error))
      : ResultType.ok(this.result.value);
  }
  
  flatMap<U, F>(fn: (value: T) => ResultType<U, F>): ResultType<U, E | F> {
    return this.isOk() 
      ? fn(this.result.value) as ResultType<U, E | F>
      : ResultType.err(this.result.error) as ResultType<U, E | F>;
  }
  
  fold<U>(onErr: (error: E) => U, onOk: (value: T) => U): U {
    return this.isOk() ? onOk(this.result.value) : onErr(this.result.error);
  }
  
  getOrElse(defaultValue: T): T {
    return this.isOk() ? this.result.value : defaultValue;
  }
  
  getOrThrow(): T {
    if (this.isOk()) {
      return this.result.value;
    }
    throw this.result.error;
  }
  
  // Combine multiple Results
  static combine<T1, T2, E>(
    r1: ResultType<T1, E>,
    r2: ResultType<T2, E>
  ): ResultType<[T1, T2], E> {
    if (r1.isOk() && r2.isOk()) {
      return ResultType.ok([r1.result.value, r2.result.value]);
    }
    
    const error = r1.isErr() ? r1.result.error : r2.result.error;
    return ResultType.err(error);
  }
  
  // Apply a function to multiple Results
  static apply<T1, T2, U, E>(
    fn: (a: T1, b: T2) => U,
    r1: ResultType<T1, E>,
    r2: ResultType<T2, E>
  ): ResultType<U, E> {
    return ResultType.combine(r1, r2).map(([a, b]) => fn(a, b));
  }
}

// Helper functions for Result
const ok = <T, E = Error>(value: T): ResultType<T, E> => ResultType.ok(value);
const err = <T, E = Error>(error: E): ResultType<T, E> => ResultType.err(error);

// Validation with Results
interface ValidationError {
  field: string;
  message: string;
}

const validateEmail = (email: string): ResultType<string, ValidationError> =>
  email.includes('@') 
    ? ok(email)
    : err({ field: 'email', message: 'Invalid email format' });

const validateAge = (age: number): ResultType<number, ValidationError> =>
  age >= 0 && age <= 150
    ? ok(age)
    : err({ field: 'age', message: 'Age must be between 0 and 150' });

const validateName = (name: string): ResultType<string, ValidationError> =>
  name.length >= 2
    ? ok(name)
    : err({ field: 'name', message: 'Name must be at least 2 characters' });

// Combine validations
const validateUserData = (name: string, email: string, age: number) => {
  const nameResult = validateName(name);
  const emailResult = validateEmail(email);
  const ageResult = validateAge(age);
  
  return ResultType.apply(
    (validName, validEmail, validAge) => ({
      name: validName,
      email: validEmail,
      age: validAge
    }),
    nameResult,
    ResultType.apply(
      (e, a) => ({ email: e, age: a }),
      emailResult,
      ageResult
    )
  );
};

// Async Result composition
const fetchUserProfile = async (id: number): Promise<ResultType<User, string>> => {
  return ResultType.fromAsyncTryCatch(
    async () => {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    (error) => `Failed to fetch user: ${error}`
  );
};

const processUserProfile = async (id: number) => {
  const userResult = await fetchUserProfile(id);
  
  return userResult
    .map(user => ({
      ...user,
      displayName: user.name.toUpperCase(),
      isActive: user.posts.length > 0
    }))
    .fold(
      error => console.error('Error:', error),
      processedUser => console.log('Processed user:', processedUser)
    );
};
```

## Performance & Optimization

### 1. Lazy Evaluation

```javascript
// Lazy evaluation with generators
function* lazyMap(iterable, fn) {
  for (const item of iterable) {
    yield fn(item);
  }
}

function* lazyFilter(iterable, predicate) {
  for (const item of iterable) {
    if (predicate(item)) {
      yield item;
    }
  }
}

function* lazyTake(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count >= n) break;
    yield item;
    count++;
  }
}

function* lazyDrop(iterable, n) {
  let count = 0;
  for (const item of iterable) {
    if (count >= n) {
      yield item;
    }
    count++;
  }
}

// Lazy sequence class
class LazySequence {
  constructor(iterable) {
    this.iterable = iterable;
  }
  
  static from(iterable) {
    return new LazySequence(iterable);
  }
  
  static range(start, end, step = 1) {
    return new LazySequence(function* () {
      for (let i = start; i < end; i += step) {
        yield i;
      }
    }());
  }
  
  static repeat(value, times = Infinity) {
    return new LazySequence(function* () {
      for (let i = 0; i < times; i++) {
        yield value;
      }
    }());
  }
  
  map(fn) {
    return new LazySequence(lazyMap(this.iterable, fn));
  }
  
  filter(predicate) {
    return new LazySequence(lazyFilter(this.iterable, predicate));
  }
  
  take(n) {
    return new LazySequence(lazyTake(this.iterable, n));
  }
  
  drop(n) {
    return new LazySequence(lazyDrop(this.iterable, n));
  }
  
  forEach(fn) {
    for (const item of this.iterable) {
      fn(item);
    }
  }
  
  reduce(reducer, initial) {
    let accumulator = initial;
    for (const item of this.iterable) {
      accumulator = reducer(accumulator, item);
    }
    return accumulator;
  }
  
  toArray() {
    return Array.from(this.iterable);
  }
  
  first() {
    for (const item of this.iterable) {
      return item;
    }
    return undefined;
  }
  
  // Memoized version
  memoize() {
    const cache = [];
    let iterator = null;
    
    return new LazySequence(function* () {
      let index = 0;
      
      while (true) {
        if (index < cache.length) {
          yield cache[index];
        } else {
          if (!iterator) {
            iterator = this.iterable[Symbol.iterator]();
          }
          
          const { value, done } = iterator.next();
          if (done) break;
          
          cache.push(value);
          yield value;
        }
        index++;
      }
    }.bind(this)());
  }
}

// Usage examples
const numbers = LazySequence.range(1, 1000000);

const processedNumbers = numbers
  .filter(n => n % 2 === 0)
  .map(n => n * n)
  .filter(n => n > 100)
  .take(10);

console.log(processedNumbers.toArray()); // Only processes what's needed

// Infinite sequences
const fibonacci = LazySequence.from(function* () {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}());

const first20Fibs = fibonacci.take(20).toArray();
console.log(first20Fibs);

// Lazy evaluation with promises
class AsyncLazySequence {
  constructor(asyncIterable) {
    this.asyncIterable = asyncIterable;
  }
  
  static from(asyncIterable) {
    return new AsyncLazySequence(asyncIterable);
  }
  
  async *map(fn) {
    for await (const item of this.asyncIterable) {
      yield await fn(item);
    }
  }
  
  async *filter(predicate) {
    for await (const item of this.asyncIterable) {
      if (await predicate(item)) {
        yield item;
      }
    }
  }
  
  async *take(n) {
    let count = 0;
    for await (const item of this.asyncIterable) {
      if (count >= n) break;
      yield item;
      count++;
    }
  }
  
  async toArray() {
    const result = [];
    for await (const item of this.asyncIterable) {
      result.push(item);
    }
    return result;
  }
  
  async forEach(fn) {
    for await (const item of this.asyncIterable) {
      await fn(item);
    }
  }
  
  async reduce(reducer, initial) {
    let accumulator = initial;
    for await (const item of this.asyncIterable) {
      accumulator = await reducer(accumulator, item);
    }
    return accumulator;
  }
}

// Async usage
async function* fetchPages() {
  let page = 1;
  while (page <= 10) {
    console.log(`Fetching page ${page}`);
    yield { page, data: `Data from page ${page}` };
    page++;
  }
}

const asyncData = new AsyncLazySequence(fetchPages());

// This will only fetch the first 3 pages
asyncData
  .filter(async (item) => item.page % 2 === 1)
  .take(3)
  .forEach(async (item) => {
    console.log('Processed:', item);
  });
```

### 2. Memoization Strategies

```javascript
// Advanced memoization with TTL and LRU eviction
class AdvancedMemoizer {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 60000; // 1 minute
    this.cache = new Map();
    this.accessOrder = new Map();
    this.timers = new Map();
  }
  
  memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
    return (...args) => {
      const key = keyGenerator(...args);
      
      if (this.cache.has(key)) {
        // Update access order for LRU
        this.updateAccessOrder(key);
        return this.cache.get(key).value;
      }
      
      const result = fn(...args);
      this.set(key, result);
      return result;
    };
  }
  
  set(key, value) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    // Clear existing timer if updating
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
    this.updateAccessOrder(key);
    
    // Set TTL timer
    if (this.ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, this.ttl);
      this.timers.set(key, timer);
    }
  }
  
  updateAccessOrder(key) {
    this.accessOrder.delete(key);
    this.accessOrder.set(key, Date.now());
  }
  
  evictOldest() {
    const oldestKey = this.accessOrder.keys().next().value;
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
  
  delete(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
  
  get stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Recursive memoization
const memoizeRecursive = (fn) => {
  const cache = new Map();
  
  const memoized = (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.call(null, memoized, ...args);
    cache.set(key, result);
    return result;
  };
  
  return memoized;
};

// Fibonacci with recursive memoization
const fibonacci = memoizeRecursive((fib, n) => {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

console.log(fibonacci(50)); // Much faster than naive recursion

// Async memoization
const memoizeAsync = (fn) => {
  const cache = new Map();
  const pending = new Map();
  
  return async (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    if (pending.has(key)) {
      return pending.get(key);
    }
    
    const promise = fn(...args);
    pending.set(key, promise);
    
    try {
      const result = await promise;
      cache.set(key, result);
      return result;
    } catch (error) {
      throw error;
    } finally {
      pending.delete(key);
    }
  };
};

// Usage examples
const memoizer = new AdvancedMemoizer({
  maxSize: 50,
  ttl: 30000 // 30 seconds
});

const expensiveFunction = memoizer.memoize((n) => {
  console.log(`Computing for ${n}`);
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) {
    result += Math.sqrt(i);
  }
  return result;
});

// Only computes once for each input
console.log(expensiveFunction(100));
console.log(expensiveFunction(100)); // Returns cached result

// Async memoization example
const fetchUser = memoizeAsync(async (id) => {
  console.log(`Fetching user ${id}`);
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

// Multiple calls with same ID will only make one request
Promise.all([
  fetchUser(1),
  fetchUser(1),
  fetchUser(1)
]).then(users => {
  console.log('All users:', users);
});
```

### 3. Transducers for Performance

```javascript
// Transducer implementation for efficient data processing
const transducer = {
  // Basic transducers
  map: (transform) => (reducer) => (acc, input) => 
    reducer(acc, transform(input)),
  
  filter: (predicate) => (reducer) => (acc, input) =>
    predicate(input) ? reducer(acc, input) : acc,
  
  take: (n) => (reducer) => {
    let taken = 0;
    return (acc, input) => {
      if (taken >= n) return acc;
      taken++;
      return reducer(acc, input);
    };
  },
  
  drop: (n) => (reducer) => {
    let dropped = 0;
    return (acc, input) => {
      if (dropped < n) {
        dropped++;
        return acc;
      }
      return reducer(acc, input);
    };
  },
  
  dedupe: () => (reducer) => {
    let last = Symbol('initial');
    return (acc, input) => {
      if (input === last) return acc;
      last = input;
      return reducer(acc, input);
    };
  },
  
  partition: (n) => (reducer) => {
    let buffer = [];
    return (acc, input) => {
      buffer.push(input);
      if (buffer.length >= n) {
        const result = reducer(acc, buffer);
        buffer = [];
        return result;
      }
      return acc;
    };
  },
  
  // Stateful transducers
  scan: (scanFn, initial) => (reducer) => {
    let state = initial;
    return (acc, input) => {
      state = scanFn(state, input);
      return reducer(acc, state);
    };
  },
  
  // Window operations
  window: (size) => (reducer) => {
    let buffer = [];
    return (acc, input) => {
      buffer.push(input);
      if (buffer.length > size) {
        buffer.shift();
      }
      if (buffer.length === size) {
        return reducer(acc, [...buffer]);
      }
      return acc;
    };
  }
};

// Compose transducers
const compose = (...transducers) => (reducer) =>
  transducers.reduceRight((acc, t) => t(acc), reducer);

// Transduce function
const transduce = (transducer, reducer, initial, collection) =>
  collection.reduce(transducer(reducer), initial);

// Into function for common collections
const into = (to, transducer, from) => {
  if (Array.isArray(to)) {
    return transduce(transducer, (acc, x) => (acc.push(x), acc), to, from);
  }
  if (to instanceof Set) {
    return transduce(transducer, (acc, x) => acc.add(x), to, from);
  }
  if (to instanceof Map) {
    return transduce(transducer, (acc, [k, v]) => acc.set(k, v), to, from);
  }
  throw new Error('Unsupported collection type');
};

// Performance comparison example
const largeArray = Array.from({ length: 1000000 }, (_, i) => i);

// Traditional chaining (creates intermediate arrays)
console.time('traditional');
const traditional = largeArray
  .filter(x => x % 2 === 0)
  .map(x => x * 2)
  .filter(x => x > 1000)
  .slice(0, 100);
console.timeEnd('traditional');

// Transducer approach (single pass)
console.time('transducer');
const xform = compose(
  transducer.filter(x => x % 2 === 0),
  transducer.map(x => x * 2),
  transducer.filter(x => x > 1000),
  transducer.take(100)
);

const transduced = into([], xform, largeArray);
console.timeEnd('transducer');

// Complex data processing pipeline
const processData = compose(
  transducer.filter(item => item.active),
  transducer.map(item => ({
    ...item,
    score: item.views * 0.1 + item.likes * 0.3 + item.shares * 0.6
  })),
  transducer.filter(item => item.score > 10),
  transducer.map(item => ({ id: item.id, score: item.score })),
  transducer.dedupe(),
  transducer.take(50)
);

const sampleData = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  active: Math.random() > 0.3,
  views: Math.floor(Math.random() * 1000),
  likes: Math.floor(Math.random() * 100),
  shares: Math.floor(Math.random() * 50)
}));

const topItems = into([], processData, sampleData);
console.log(`Processed ${sampleData.length} items, got ${topItems.length} results`);

// Async transducers
const asyncTransduce = async (transducer, reducer, initial, asyncIterable) => {
  let acc = initial;
  const xf = transducer(reducer);
  
  for await (const item of asyncIterable) {
    acc = xf(acc, item);
  }
  
  return acc;
};

// Async data processing
async function* generateAsyncData() {
  for (let i = 0; i < 1000; i++) {
    await new Promise(resolve => setTimeout(resolve, 1));
    yield { id: i, value: Math.random() };
  }
}

const asyncXform = compose(
  transducer.filter(item => item.value > 0.5),
  transducer.map(item => ({ ...item, doubled: item.value * 2 })),
  transducer.take(10)
);

asyncTransduce(
  asyncXform,
  (acc, item) => [...acc, item],
  [],
  generateAsyncData()
).then(result => {
  console.log('Async processing result:', result);
});
```

## Real-World Applications

### 1. Functional State Management System

```javascript
// Complete functional state management system
class FunctionalStore {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Set();
    this.middlewares = [];
    this.reducers = new Map();
  }
  
  // Add middleware
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }
  
  // Register reducer
  addReducer(name, reducer) {
    this.reducers.set(name, reducer);
    return this;
  }
  
  // Dispatch action through middleware chain
  dispatch(action) {
    const middlewareChain = this.middlewares.reduceRight(
      (next, middleware) => (action) => middleware(this, action, next),
      (action) => this.applyReducers(action)
    );
    
    return middlewareChain(action);
  }
  
  // Apply all reducers
  applyReducers(action) {
    const newState = {};
    
    for (const [name, reducer] of this.reducers.entries()) {
      newState[name] = reducer(this.state[name], action);
    }
    
    const hasChanged = !this.shallowEqual(this.state, newState);
    
    if (hasChanged) {
      this.state = newState;
      this.notifyListeners();
    }
    
    return action;
  }
  
  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  // Get current state
  getState() {
    return this.state;
  }
  
  // Select part of state
  select(selector) {
    return selector(this.state);
  }
  
  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }
  
  // Shallow equality check
  shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => obj1[key] === obj2[key]);
  }
}

// Middleware examples
const logger = (store, action, next) => {
  console.log('Dispatching:', action);
  const result = next(action);
  console.log('New state:', store.getState());
  return result;
};

const thunk = (store, action, next) => {
  if (typeof action === 'function') {
    return action(store.dispatch.bind(store), store.getState.bind(store));
  }
  return next(action);
};

const crashReporter = (store, action, next) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Store error:', error);
    throw error;
  }
};

// Action creators
const actionCreator = (type) => (payload) => ({ type, payload });

// Async action creator
const asyncActionCreator = (type) => (asyncFn) => async (dispatch, getState) => {
  dispatch({ type: `${type}_PENDING` });
  
  try {
    const result = await asyncFn();
    dispatch({ type: `${type}_FULFILLED`, payload: result });
    return result;
  } catch (error) {
    dispatch({ type: `${type}_REJECTED`, payload: error.message });
    throw error;
  }
};

// Reducers
const createAsyncReducer = (type, initialState = {}) => {
  return (state = initialState, action) => {
    switch (action.type) {
      case `${type}_PENDING`:
        return { ...state, loading: true, error: null };
        
      case `${type}_FULFILLED`:
        return { ...state, loading: false, data: action.payload, error: null };
        
      case `${type}_REJECTED`:
        return { ...state, loading: false, error: action.payload };
        
      default:
        return state;
    }
  };
};

const userReducer = (state = { list: [], selected: null }, action) => {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, list: action.payload };
      
    case 'ADD_USER':
      return { ...state, list: [...state.list, action.payload] };
      
    case 'SELECT_USER':
      return { ...state, selected: action.payload };
      
    case 'UPDATE_USER':
      return {
        ...state,
        list: state.list.map(user =>
          user.id === action.payload.id ? action.payload : user
        )
      };
      
    default:
      return state;
  }
};

// Setup store
const store = new FunctionalStore()
  .use(logger)
  .use(thunk)
  .use(crashReporter)
  .addReducer('users', userReducer)
  .addReducer('api', createAsyncReducer('FETCH_DATA'));

// Action creators
const setUsers = actionCreator('SET_USERS');
const addUser = actionCreator('ADD_USER');
const selectUser = actionCreator('SELECT_USER');
const updateUser = actionCreator('UPDATE_USER');
const fetchData = asyncActionCreator('FETCH_DATA');

// Usage
store.subscribe(state => {
  console.log('State changed:', state);
});

store.dispatch(setUsers([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
]));

store.dispatch(addUser({ id: 3, name: 'Charlie' }));

// Async action
store.dispatch(fetchData(async () => {
  const response = await fetch('/api/data');
  return response.json();
}));

// Selectors
const getUsers = (state) => state.users.list;
const getSelectedUser = (state) => state.users.selected;
const getUserById = (id) => (state) => 
  state.users.list.find(user => user.id === id);

const users = store.select(getUsers);
const selectedUser = store.select(getSelectedUser);
const specificUser = store.select(getUserById(2));
```

### 2. Functional Reactive Programming (FRP)

```javascript
// Observable implementation for FRP
class Observable {
  constructor(observer) {
    this.observer = observer;
  }
  
  static of(value) {
    return new Observable(subscriber => {
      subscriber.next(value);
      subscriber.complete();
    });
  }
  
  static from(iterable) {
    return new Observable(subscriber => {
      for (const item of iterable) {
        subscriber.next(item);
      }
      subscriber.complete();
    });
  }
  
  static fromEvent(target, eventName) {
    return new Observable(subscriber => {
      const handler = (event) => subscriber.next(event);
      target.addEventListener(eventName, handler);
      
      return () => target.removeEventListener(eventName, handler);
    });
  }
  
  static interval(ms) {
    return new Observable(subscriber => {
      const id = setInterval(() => {
        subscriber.next(Date.now());
      }, ms);
      
      return () => clearInterval(id);
    });
  }
  
  static merge(...observables) {
    return new Observable(subscriber => {
      const subscriptions = observables.map(obs => 
        obs.subscribe(subscriber)
      );
      
      return () => subscriptions.forEach(unsub => unsub());
    });
  }
  
  subscribe(observer) {
    const subscription = { unsubscribed: false };
    
    const subscriber = {
      next: (value) => {
        if (!subscription.unsubscribed && observer.next) {
          observer.next(value);
        }
      },
      error: (error) => {
        if (!subscription.unsubscribed && observer.error) {
          observer.error(error);
        }
      },
      complete: () => {
        if (!subscription.unsubscribed && observer.complete) {
          observer.complete();
        }
      }
    };
    
    const cleanup = this.observer(subscriber);
    
    return () => {
      subscription.unsubscribed = true;
      if (cleanup) cleanup();
    };
  }
  
  map(fn) {
    return new Observable(subscriber => {
      return this.subscribe({
        next: value => subscriber.next(fn(value)),
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
    });
  }
  
  filter(predicate) {
    return new Observable(subscriber => {
      return this.subscribe({
        next: value => {
          if (predicate(value)) {
            subscriber.next(value);
          }
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
    });
  }
  
  flatMap(fn) {
    return new Observable(subscriber => {
      let subscriptions = [];
      
      const mainSub = this.subscribe({
        next: value => {
          const innerObs = fn(value);
          const innerSub = innerObs.subscribe({
            next: innerValue => subscriber.next(innerValue),
            error: error => subscriber.error(error)
          });
          subscriptions.push(innerSub);
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
      
      return () => {
        mainSub();
        subscriptions.forEach(unsub => unsub());
      };
    });
  }
  
  debounce(ms) {
    return new Observable(subscriber => {
      let timeoutId;
      
      return this.subscribe({
        next: value => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            subscriber.next(value);
          }, ms);
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
    });
  }
  
  throttle(ms) {
    return new Observable(subscriber => {
      let lastEmit = 0;
      
      return this.subscribe({
        next: value => {
          const now = Date.now();
          if (now - lastEmit >= ms) {
            lastEmit = now;
            subscriber.next(value);
          }
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
    });
  }
  
  scan(reducer, seed) {
    return new Observable(subscriber => {
      let accumulator = seed;
      
      return this.subscribe({
        next: value => {
          accumulator = reducer(accumulator, value);
          subscriber.next(accumulator);
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
    });
  }
  
  take(count) {
    return new Observable(subscriber => {
      let taken = 0;
      
      const subscription = this.subscribe({
        next: value => {
          if (taken < count) {
            taken++;
            subscriber.next(value);
            
            if (taken === count) {
              subscriber.complete();
              subscription();
            }
          }
        },
        error: error => subscriber.error(error),
        complete: () => subscriber.complete()
      });
      
      return subscription;
    });
  }
  
  combineLatest(other) {
    return new Observable(subscriber => {
      let hasLeft = false;
      let hasRight = false;
      let leftValue;
      let rightValue;
      
      const emit = () => {
        if (hasLeft && hasRight) {
          subscriber.next([leftValue, rightValue]);
        }
      };
      
      const leftSub = this.subscribe({
        next: value => {
          hasLeft = true;
          leftValue = value;
          emit();
        },
        error: error => subscriber.error(error)
      });
      
      const rightSub = other.subscribe({
        next: value => {
          hasRight = true;
          rightValue = value;
          emit();
        },
        error: error => subscriber.error(error)
      });
      
      return () => {
        leftSub();
        rightSub();
      };
    });
  }
}

// FRP application example: Real-time search
const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');

const searchObservable = Observable.fromEvent(searchInput, 'input')
  .map(event => event.target.value)
  .filter(text => text.length > 2)
  .debounce(300)
  .flatMap(query => 
    Observable.from(
      fetch(`/api/search?q=${query}`)
        .then(response => response.json())
    )
  );

searchObservable.subscribe({
  next: results => {
    resultsContainer.innerHTML = results
      .map(item => `<div>${item.title}</div>`)
      .join('');
  },
  error: error => {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<div>Search failed</div>';
  }
});

// Mouse position tracking
const mousePosition = Observable.fromEvent(document, 'mousemove')
  .map(event => ({ x: event.clientX, y: event.clientY }))
  .throttle(16); // ~60fps

mousePosition.subscribe({
  next: position => {
    console.log(`Mouse at (${position.x}, ${position.y})`);
  }
});

// Combine multiple streams
const clicks = Observable.fromEvent(document, 'click');
const keyPresses = Observable.fromEvent(document, 'keypress');

const userInteractions = Observable.merge(
  clicks.map(() => ({ type: 'click', timestamp: Date.now() })),
  keyPresses.map(e => ({ type: 'keypress', key: e.key, timestamp: Date.now() }))
);

userInteractions
  .scan((acc, interaction) => [...acc, interaction].slice(-10), [])
  .subscribe({
    next: recentInteractions => {
      console.log('Recent interactions:', recentInteractions);
    }
  });

// Data flow with validation
const userInput = Observable.fromEvent(document.getElementById('user-form'), 'input')
  .map(event => ({
    field: event.target.name,
    value: event.target.value
  }))
  .scan((form, input) => ({ ...form, [input.field]: input.value }), {})
  .map(form => ({
    ...form,
    isValid: form.email?.includes('@') && form.name?.length > 2
  }));

userInput.subscribe({
  next: formState => {
    document.getElementById('submit-btn').disabled = !formState.isValid;
  }
});
```

## Summary

このドキュメントでは、JavaScript/TypeScriptにおける関数型プログラミングの包括的なパターンをカバーしました：

1. **Core Functional Concepts**: 純粋関数、関数合成、カリー化
2. **Higher-Order Functions**: 高階関数、デコレータ、コンビネータ
3. **Immutability Patterns**: 不変データ構造、関数型状態管理
4. **Monads & Functors**: Maybe、Either、IOモナド
5. **Type-Safe Functional Programming**: TypeScriptでの型安全な関数型プログラミング
6. **Performance & Optimization**: 遅延評価、メモ化、トランスデューサー
7. **Real-World Applications**: 関数型状態管理、リアクティブプログラミング

これらのパターンを活用することで、よりクリーンで保守性が高く、テストしやすいJavaScript/TypeScriptコードを書くことができます。