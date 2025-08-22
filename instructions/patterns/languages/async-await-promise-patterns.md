# Async/Await & Promise Patterns

## 目次
1. [Advanced Promise Patterns](#advanced-promise-patterns)
2. [Async/Await Best Practices](#asyncawait-best-practices)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Concurrency & Parallelism](#concurrency--parallelism)
5. [Promise Utilities](#promise-utilities)
6. [Streaming & Generators](#streaming--generators)
7. [Performance Optimization](#performance-optimization)
8. [Real-World Patterns](#real-world-patterns)

## Advanced Promise Patterns

### 1. Promise Combinators

```javascript
// Promise.all with error handling per promise
async function allSettledWithDetails(promises) {
  const results = await Promise.allSettled(promises);
  
  return {
    fulfilled: results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value),
    rejected: results
      .filter(result => result.status === 'rejected')
      .map(result => result.reason),
    success: results.every(result => result.status === 'fulfilled'),
    count: {
      total: results.length,
      fulfilled: results.filter(r => r.status === 'fulfilled').length,
      rejected: results.filter(r => r.status === 'rejected').length
    }
  };
}

// Promise.race with timeout
function raceWithTimeout(promises, timeoutMs, timeoutValue) {
  const timeout = new Promise(resolve => 
    setTimeout(() => resolve(timeoutValue), timeoutMs)
  );
  
  return Promise.race([...promises, timeout]);
}

// Promise.any with detailed error
async function anyWithDetails(promises) {
  try {
    const result = await Promise.any(promises);
    return { success: true, value: result };
  } catch (aggregateError) {
    return {
      success: false,
      errors: aggregateError.errors,
      message: 'All promises rejected'
    };
  }
}

// Sequential processing with Promise.reduce equivalent
async function promiseReduce(array, reducerFn, initialValue) {
  let accumulator = initialValue;
  
  for (const item of array) {
    accumulator = await reducerFn(accumulator, item);
  }
  
  return accumulator;
}

// Conditional Promise execution
async function conditionalPromise(condition, promiseFn, fallbackValue) {
  if (await condition()) {
    return promiseFn();
  }
  return fallbackValue;
}

// Promise pipeline
function promisePipe(...fns) {
  return (value) => fns.reduce((promise, fn) => promise.then(fn), Promise.resolve(value));
}

// Usage examples
const fetchOperations = [
  fetch('/api/users'),
  fetch('/api/posts'),
  fetch('/api/comments')
];

const results = await allSettledWithDetails(fetchOperations);
console.log(`${results.count.fulfilled}/${results.count.total} requests succeeded`);

const fastestResponse = await raceWithTimeout(
  fetchOperations,
  5000,
  { error: 'Timeout after 5 seconds' }
);

const pipeline = promisePipe(
  (data) => fetch('/api/process', { method: 'POST', body: JSON.stringify(data) }),
  (response) => response.json(),
  (data) => ({ ...data, timestamp: Date.now() })
);

const processedData = await pipeline({ input: 'test' });
```

### 2. Promise State Management

```javascript
// Promise with state tracking
class StatefulPromise {
  constructor(executor) {
    this.state = 'pending';
    this.value = undefined;
    this.reason = undefined;
    this.startTime = Date.now();
    this.endTime = null;
    
    this.promise = new Promise((resolve, reject) => {
      const wrappedResolve = (value) => {
        this.state = 'fulfilled';
        this.value = value;
        this.endTime = Date.now();
        resolve(value);
      };
      
      const wrappedReject = (reason) => {
        this.state = 'rejected';
        this.reason = reason;
        this.endTime = Date.now();
        reject(reason);
      };
      
      executor(wrappedResolve, wrappedReject);
    });
  }
  
  get duration() {
    return this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime;
  }
  
  get isPending() {
    return this.state === 'pending';
  }
  
  get isFulfilled() {
    return this.state === 'fulfilled';
  }
  
  get isRejected() {
    return this.state === 'rejected';
  }
  
  get isSettled() {
    return this.state !== 'pending';
  }
  
  then(onFulfilled, onRejected) {
    return this.promise.then(onFulfilled, onRejected);
  }
  
  catch(onRejected) {
    return this.promise.catch(onRejected);
  }
  
  finally(onFinally) {
    return this.promise.finally(onFinally);
  }
}

// Promise pool with concurrency control
class PromisePool {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(promiseFactory) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        promiseFactory,
        resolve,
        reject
      });
      
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const { promiseFactory, resolve, reject } = this.queue.shift();
    
    try {
      const result = await promiseFactory();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
  
  async addMultiple(promiseFactories) {
    const promises = promiseFactories.map(factory => this.add(factory));
    return Promise.allSettled(promises);
  }
  
  get stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      capacity: this.concurrency
    };
  }
}

// Cancellable promise
class CancellablePromise {
  constructor(executor) {
    this.cancelled = false;
    this.cancelCallbacks = [];
    
    this.promise = new Promise((resolve, reject) => {
      const wrappedResolve = (value) => {
        if (!this.cancelled) {
          resolve(value);
        }
      };
      
      const wrappedReject = (reason) => {
        if (!this.cancelled) {
          reject(reason);
        }
      };
      
      const cancel = () => {
        this.cancelled = true;
        this.cancelCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('Cancel callback error:', error);
          }
        });
        reject(new Error('Promise cancelled'));
      };
      
      executor(wrappedResolve, wrappedReject, cancel);
    });
  }
  
  cancel() {
    if (!this.cancelled) {
      this.cancelled = true;
      this.cancelCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Cancel callback error:', error);
        }
      });
    }
  }
  
  onCancel(callback) {
    this.cancelCallbacks.push(callback);
  }
  
  then(onFulfilled, onRejected) {
    return this.promise.then(onFulfilled, onRejected);
  }
  
  catch(onRejected) {
    return this.promise.catch(onRejected);
  }
  
  finally(onFinally) {
    return this.promise.finally(onFinally);
  }
}

// Usage
const pool = new PromisePool(2);

const tasks = Array.from({ length: 10 }, (_, i) => 
  () => new Promise(resolve => 
    setTimeout(() => resolve(`Task ${i} completed`), Math.random() * 1000)
  )
);

pool.addMultiple(tasks).then(results => {
  console.log('All tasks completed:', results);
});

// Cancellable fetch
const cancellableFetch = new CancellablePromise((resolve, reject, cancel) => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(response => response.json())
    .then(resolve)
    .catch(reject);
  
  // Set up cancellation
  cancel.onCancel = () => controller.abort();
});

// Cancel after 5 seconds
setTimeout(() => cancellableFetch.cancel(), 5000);
```

### 3. Promise Memoization

```javascript
// Promise memoization with TTL
class PromiseCache {
  constructor() {
    this.cache = new Map();
  }
  
  memoize(fn, options = {}) {
    const { 
      ttl = 60000, // 1 minute default TTL
      keyGenerator = (...args) => JSON.stringify(args),
      maxSize = 100
    } = options;
    
    return (...args) => {
      const key = keyGenerator(...args);
      const now = Date.now();
      
      // Check if cached and not expired
      if (this.cache.has(key)) {
        const cached = this.cache.get(key);
        if (now - cached.timestamp < ttl) {
          return cached.promise;
        } else {
          this.cache.delete(key);
        }
      }
      
      // Clean old entries if cache is full
      if (this.cache.size >= maxSize) {
        this.cleanup(now, ttl);
      }
      
      // Create new cached promise
      const promise = fn(...args).catch(error => {
        // Remove failed promises from cache
        this.cache.delete(key);
        throw error;
      });
      
      this.cache.set(key, {
        promise,
        timestamp: now
      });
      
      return promise;
    };
  }
  
  cleanup(now, ttl) {
    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp >= ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
  
  get size() {
    return this.cache.size;
  }
}

// Usage
const cache = new PromiseCache();

const cachedFetch = cache.memoize(
  async (url) => {
    const response = await fetch(url);
    return response.json();
  },
  { 
    ttl: 30000, // 30 seconds
    keyGenerator: (url) => url // Simple key generator
  }
);

// These will use cached results if called within 30 seconds
const data1 = await cachedFetch('/api/users');
const data2 = await cachedFetch('/api/users'); // Returns cached promise

// Promise-based retry with exponential backoff
async function retryWithBackoff(
  promiseFn,
  maxRetries = 3,
  baseDelay = 1000,
  backoffFactor = 2
) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await promiseFn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(backoffFactor, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Memoized retry function
const cachedRetryFetch = cache.memoize(
  (url) => retryWithBackoff(() => fetch(url).then(r => r.json())),
  { ttl: 60000 }
);
```

## Async/Await Best Practices

### 1. Error Handling Patterns

```javascript
// Safe async wrapper
function safeAsync(asyncFn) {
  return async (...args) => {
    try {
      const result = await asyncFn(...args);
      return [null, result];
    } catch (error) {
      return [error, null];
    }
  };
}

// Multiple error handling strategies
class AsyncErrorHandler {
  static async withRetry(asyncFn, options = {}) {
    const { 
      maxRetries = 3, 
      delay = 1000,
      shouldRetry = () => true 
    } = options;
    
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries || !shouldRetry(error, i)) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    throw lastError;
  }
  
  static async withFallback(asyncFn, fallbackFn) {
    try {
      return await asyncFn();
    } catch (error) {
      console.warn('Primary function failed, using fallback:', error.message);
      return await fallbackFn(error);
    }
  }
  
  static async withTimeout(asyncFn, timeoutMs, timeoutMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    
    return Promise.race([asyncFn(), timeoutPromise]);
  }
  
  static async withCircuitBreaker(asyncFn, options = {}) {
    const { 
      failureThreshold = 5,
      resetTimeout = 60000,
      monitorPeriod = 10000 
    } = options;
    
    if (!this.circuitState) {
      this.circuitState = {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0
      };
    }
    
    const state = this.circuitState;
    
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (state.state === 'OPEN') {
      if (Date.now() - state.lastFailureTime >= resetTimeout) {
        state.state = 'HALF_OPEN';
        state.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await asyncFn();
      
      // Success - handle state transitions
      if (state.state === 'HALF_OPEN') {
        state.successCount++;
        if (state.successCount >= 3) {
          state.state = 'CLOSED';
          state.failureCount = 0;
        }
      } else {
        state.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      // Failure - increment failure count and possibly open circuit
      state.failureCount++;
      state.lastFailureTime = Date.now();
      
      if (state.failureCount >= failureThreshold) {
        state.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

// Usage examples
const safeApiCall = safeAsync(async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
});

// Using safe wrapper
const [error, data] = await safeApiCall('/api/users');
if (error) {
  console.error('API call failed:', error.message);
} else {
  console.log('Data received:', data);
}

// Using error handler with retry
const userData = await AsyncErrorHandler.withRetry(
  () => fetch('/api/users').then(r => r.json()),
  {
    maxRetries: 3,
    delay: 1000,
    shouldRetry: (error, attempt) => {
      // Retry on network errors but not on 4xx errors
      return !error.message.includes('4');
    }
  }
);

// Using error handler with fallback
const config = await AsyncErrorHandler.withFallback(
  () => fetch('/api/config').then(r => r.json()),
  () => ({ theme: 'default', language: 'en' }) // Fallback config
);

// Using error handler with timeout
const quickData = await AsyncErrorHandler.withTimeout(
  () => fetch('/api/slow-endpoint').then(r => r.json()),
  5000, // 5 second timeout
  'Data fetch timed out'
);
```

### 2. Advanced Async Patterns

```javascript
// Async queue with priority
class PriorityAsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  add(asyncFn, priority = 0) {
    return new Promise((resolve, reject) => {
      const task = {
        asyncFn,
        priority,
        resolve,
        reject,
        id: Date.now() + Math.random()
      };
      
      // Insert task based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }
      
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const task = this.queue.shift();
    
    try {
      const result = await task.asyncFn();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
  
  clear() {
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
  
  get stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      capacity: this.concurrency
    };
  }
}

// Async pipeline with error recovery
class AsyncPipeline {
  constructor() {
    this.steps = [];
  }
  
  add(stepFn, options = {}) {
    this.steps.push({
      fn: stepFn,
      name: options.name || `Step ${this.steps.length + 1}`,
      retry: options.retry || 0,
      timeout: options.timeout,
      fallback: options.fallback,
      skipOnError: options.skipOnError || false
    });
    return this;
  }
  
  async execute(initialValue, context = {}) {
    let value = initialValue;
    const results = [];
    
    for (const [index, step] of this.steps.entries()) {
      try {
        const stepValue = await this.executeStep(step, value, context);
        value = stepValue;
        results.push({
          step: step.name,
          success: true,
          value: stepValue,
          index
        });
      } catch (error) {
        const result = {
          step: step.name,
          success: false,
          error: error.message,
          index
        };
        
        results.push(result);
        
        if (step.fallback) {
          try {
            value = await step.fallback(error, value, context);
            result.fallbackUsed = true;
            result.value = value;
          } catch (fallbackError) {
            if (!step.skipOnError) {
              throw new Error(`Pipeline failed at step ${step.name}: ${fallbackError.message}`);
            }
          }
        } else if (!step.skipOnError) {
          throw new Error(`Pipeline failed at step ${step.name}: ${error.message}`);
        }
      }
    }
    
    return {
      value,
      results,
      success: results.every(r => r.success || r.fallbackUsed)
    };
  }
  
  async executeStep(step, value, context) {
    let result;
    
    const executeOnce = async () => {
      if (step.timeout) {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Step timeout')), step.timeout);
        });
        return Promise.race([step.fn(value, context), timeoutPromise]);
      }
      return step.fn(value, context);
    };
    
    // Retry logic
    for (let attempt = 0; attempt <= step.retry; attempt++) {
      try {
        result = await executeOnce();
        break;
      } catch (error) {
        if (attempt === step.retry) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    return result;
  }
}

// Async resource manager
class AsyncResourceManager {
  constructor() {
    this.resources = new Map();
    this.cleanupCallbacks = new Map();
  }
  
  async acquire(key, factory, options = {}) {
    if (this.resources.has(key)) {
      return this.resources.get(key);
    }
    
    const resource = await factory();
    this.resources.set(key, resource);
    
    if (options.cleanup) {
      this.cleanupCallbacks.set(key, options.cleanup);
    }
    
    if (options.ttl) {
      setTimeout(() => {
        this.release(key);
      }, options.ttl);
    }
    
    return resource;
  }
  
  async release(key) {
    const resource = this.resources.get(key);
    if (!resource) {
      return;
    }
    
    const cleanup = this.cleanupCallbacks.get(key);
    if (cleanup) {
      try {
        await cleanup(resource);
      } catch (error) {
        console.error(`Cleanup error for resource ${key}:`, error);
      }
    }
    
    this.resources.delete(key);
    this.cleanupCallbacks.delete(key);
  }
  
  async releaseAll() {
    const keys = Array.from(this.resources.keys());
    await Promise.allSettled(keys.map(key => this.release(key)));
  }
  
  has(key) {
    return this.resources.has(key);
  }
  
  get(key) {
    return this.resources.get(key);
  }
}

// Usage examples
const priorityQueue = new PriorityAsyncQueue(2);

// High priority task
priorityQueue.add(
  () => fetch('/api/critical').then(r => r.json()),
  10
);

// Low priority task
priorityQueue.add(
  () => fetch('/api/background').then(r => r.json()),
  1
);

// Pipeline example
const dataPipeline = new AsyncPipeline()
  .add(
    async (data) => {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    { name: 'Validation', timeout: 5000, retry: 2 }
  )
  .add(
    async (data) => {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response.json();
    },
    {
      name: 'Processing',
      fallback: async (error, data) => {
        console.warn('Processing failed, using fallback');
        return { ...data, processed: false };
      }
    }
  )
  .add(
    async (data) => {
      await fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return data;
    },
    { name: 'Save', retry: 3 }
  );

const result = await dataPipeline.execute({ input: 'test data' });

// Resource manager example
const resourceManager = new AsyncResourceManager();

const dbConnection = await resourceManager.acquire(
  'database',
  async () => {
    console.log('Creating database connection');
    return { connected: true, id: Date.now() };
  },
  {
    ttl: 60000, // Auto-release after 1 minute
    cleanup: async (connection) => {
      console.log('Closing database connection');
      connection.connected = false;
    }
  }
);
```

## Concurrency & Parallelism

### 1. Advanced Concurrency Patterns

```javascript
// Semaphore for controlling concurrent access
class Semaphore {
  constructor(capacity) {
    this.capacity = capacity;
    this.current = 0;
    this.queue = [];
  }
  
  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.capacity) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.current--;
    }
  }
  
  async use(asyncFn) {
    await this.acquire();
    try {
      return await asyncFn();
    } finally {
      this.release();
    }
  }
  
  get available() {
    return this.capacity - this.current;
  }
  
  get waiting() {
    return this.queue.length;
  }
}

// Worker pool for CPU-intensive tasks
class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript);
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }
  
  async execute(data, transferables = []) {
    return new Promise((resolve, reject) => {
      const task = { data, transferables, resolve, reject };
      
      if (this.availableWorkers.length > 0) {
        this.assignTask(task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }
  
  assignTask(task) {
    const worker = this.availableWorkers.pop();
    const messageId = Date.now() + Math.random();
    
    const handleMessage = (event) => {
      if (event.data.id === messageId) {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        
        this.availableWorkers.push(worker);
        
        if (event.data.error) {
          task.reject(new Error(event.data.error));
        } else {
          task.resolve(event.data.result);
        }
        
        // Process next task if any
        if (this.taskQueue.length > 0) {
          this.assignTask(this.taskQueue.shift());
        }
      }
    };
    
    const handleError = (error) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      
      this.availableWorkers.push(worker);
      task.reject(error);
    };
    
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    
    worker.postMessage({
      id: messageId,
      data: task.data
    }, task.transferables);
  }
  
  terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }
  
  get stats() {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      busy: this.workers.length - this.availableWorkers.length,
      queued: this.taskQueue.length
    };
  }
}

// Batch processor with concurrency control
class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.concurrency = options.concurrency || 3;
    this.delay = options.delay || 0;
    this.semaphore = new Semaphore(this.concurrency);
  }
  
  async process(items, processor) {
    const batches = this.createBatches(items);
    const results = [];
    
    const processBatch = async (batch, index) => {
      return this.semaphore.use(async () => {
        if (this.delay > 0 && index > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
        
        return processor(batch, index);
      });
    };
    
    // Process batches with controlled concurrency
    const promises = batches.map(processBatch);
    const batchResults = await Promise.allSettled(promises);
    
    // Flatten results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (Array.isArray(result.value)) {
          results.push(...result.value);
        } else {
          results.push(result.value);
        }
      } else {
        console.error(`Batch ${index} failed:`, result.reason);
      }
    });
    
    return results;
  }
  
  createBatches(items) {
    const batches = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }
    return batches;
  }
}

// Async iterator with concurrency
class ConcurrentAsyncIterator {
  constructor(iterator, concurrency = 3) {
    this.iterator = iterator;
    this.semaphore = new Semaphore(concurrency);
  }
  
  async *map(asyncMapper) {
    const promises = new Map();
    let done = false;
    
    while (!done || promises.size > 0) {
      // Fill up to concurrency limit
      while (promises.size < this.semaphore.capacity && !done) {
        const { value, done: iterDone } = await this.iterator.next();
        done = iterDone;
        
        if (!done) {
          const promise = this.semaphore.use(() => asyncMapper(value));
          promises.set(promise, value);
        }
      }
      
      if (promises.size > 0) {
        // Wait for the first promise to complete
        const completedPromise = await Promise.race(promises.keys());
        const result = await completedPromise;
        
        promises.delete(completedPromise);
        yield result;
      }
    }
  }
  
  async *filter(asyncPredicate) {
    const promises = new Map();
    let done = false;
    
    while (!done || promises.size > 0) {
      while (promises.size < this.semaphore.capacity && !done) {
        const { value, done: iterDone } = await this.iterator.next();
        done = iterDone;
        
        if (!done) {
          const promise = this.semaphore.use(async () => {
            const shouldInclude = await asyncPredicate(value);
            return { value, shouldInclude };
          });
          promises.set(promise, value);
        }
      }
      
      if (promises.size > 0) {
        const completedPromise = await Promise.race(promises.keys());
        const { value, shouldInclude } = await completedPromise;
        
        promises.delete(completedPromise);
        
        if (shouldInclude) {
          yield value;
        }
      }
    }
  }
}

// Usage examples
const semaphore = new Semaphore(3);

// Concurrent API calls with semaphore
const urls = Array.from({ length: 10 }, (_, i) => `/api/data/${i}`);

const results = await Promise.all(
  urls.map(url => 
    semaphore.use(async () => {
      const response = await fetch(url);
      return response.json();
    })
  )
);

// Worker pool usage (assuming worker.js exists)
const workerPool = new WorkerPool('./worker.js', 4);

const heavyComputationResult = await workerPool.execute({
  operation: 'fibonacci',
  number: 40
});

// Batch processing
const batchProcessor = new BatchProcessor({
  batchSize: 5,
  concurrency: 2,
  delay: 100
});

const items = Array.from({ length: 100 }, (_, i) => i);

const processedItems = await batchProcessor.process(
  items,
  async (batch) => {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    return batch.map(item => item * 2);
  }
);

// Concurrent async iterator
async function* generateNumbers() {
  for (let i = 0; i < 10; i++) {
    yield i;
  }
}

const concurrentIterator = new ConcurrentAsyncIterator(generateNumbers(), 3);

const squaredNumbers = [];
for await (const squared of concurrentIterator.map(async (n) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return n * n;
})) {
  squaredNumbers.push(squared);
}
```

### 2. Parallel Processing Patterns

```javascript
// MapReduce implementation for JavaScript
class MapReduce {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.concurrency = options.concurrency || navigator.hardwareConcurrency || 4;
  }
  
  async execute(data, mapFn, reduceFn, initialValue) {
    // Split data into chunks
    const chunks = this.createChunks(data);
    
    // Map phase - process chunks in parallel
    const mapResults = await this.parallelMap(chunks, mapFn);
    
    // Reduce phase - combine results
    return this.reduce(mapResults, reduceFn, initialValue);
  }
  
  createChunks(data) {
    const chunks = [];
    for (let i = 0; i < data.length; i += this.chunkSize) {
      chunks.push(data.slice(i, i + this.chunkSize));
    }
    return chunks;
  }
  
  async parallelMap(chunks, mapFn) {
    const semaphore = new Semaphore(this.concurrency);
    
    const promises = chunks.map((chunk, index) =>
      semaphore.use(async () => {
        return mapFn(chunk, index);
      })
    );
    
    return Promise.all(promises);
  }
  
  reduce(results, reduceFn, initialValue) {
    return results.reduce(reduceFn, initialValue);
  }
}

// Parallel pipeline processor
class ParallelPipeline {
  constructor(concurrency = 3) {
    this.stages = [];
    this.concurrency = concurrency;
  }
  
  addStage(processor, options = {}) {
    this.stages.push({
      processor,
      buffer: [],
      batchSize: options.batchSize || 1,
      delay: options.delay || 0
    });
    return this;
  }
  
  async process(items) {
    let currentData = items;
    
    for (const [index, stage] of this.stages.entries()) {
      currentData = await this.processStage(currentData, stage, index);
    }
    
    return currentData;
  }
  
  async processStage(items, stage, stageIndex) {
    const semaphore = new Semaphore(this.concurrency);
    const results = [];
    
    // Create batches based on stage configuration
    const batches = [];
    for (let i = 0; i < items.length; i += stage.batchSize) {
      batches.push(items.slice(i, i + stage.batchSize));
    }
    
    const processBatch = async (batch, batchIndex) => {
      return semaphore.use(async () => {
        if (stage.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, stage.delay));
        }
        
        return stage.processor(batch, {
          stageIndex,
          batchIndex,
          totalBatches: batches.length
        });
      });
    };
    
    const batchPromises = batches.map(processBatch);
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results
    batchResults.forEach(result => {
      if (Array.isArray(result)) {
        results.push(...result);
      } else {
        results.push(result);
      }
    });
    
    return results;
  }
}

// Streaming parallel processor
class StreamingParallelProcessor {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 3;
    this.bufferSize = options.bufferSize || 10;
    this.semaphore = new Semaphore(this.concurrency);
  }
  
  async *process(asyncIterable, processor) {
    const buffer = [];
    const promises = new Map();
    
    for await (const item of asyncIterable) {
      // Process item
      const promise = this.semaphore.use(() => processor(item));
      promises.set(promise, item);
      
      // Yield completed results
      while (promises.size >= this.bufferSize || promises.size > 0) {
        const completedPromise = await Promise.race(promises.keys());
        const result = await completedPromise;
        
        promises.delete(completedPromise);
        yield result;
        
        if (promises.size < this.bufferSize) {
          break;
        }
      }
    }
    
    // Yield remaining results
    while (promises.size > 0) {
      const completedPromise = await Promise.race(promises.keys());
      const result = await completedPromise;
      
      promises.delete(completedPromise);
      yield result;
    }
  }
}

// Fork-join pattern
class ForkJoin {
  static async fork(tasks, concurrency = Infinity) {
    if (concurrency === Infinity) {
      return Promise.all(tasks.map(task => task()));
    }
    
    const semaphore = new Semaphore(concurrency);
    const promises = tasks.map(task => 
      semaphore.use(() => task())
    );
    
    return Promise.all(promises);
  }
  
  static async forkMap(items, asyncMapper, concurrency = Infinity) {
    const tasks = items.map(item => () => asyncMapper(item));
    return this.fork(tasks, concurrency);
  }
  
  static async forkFilter(items, asyncPredicate, concurrency = Infinity) {
    const tasks = items.map(item => async () => {
      const shouldInclude = await asyncPredicate(item);
      return shouldInclude ? item : null;
    });
    
    const results = await this.fork(tasks, concurrency);
    return results.filter(result => result !== null);
  }
  
  static async forkReduce(items, asyncReducer, initialValue, concurrency = Infinity) {
    // Parallel map then sequential reduce
    const mapped = await this.forkMap(items, async (item) => item, concurrency);
    
    let accumulator = initialValue;
    for (const item of mapped) {
      accumulator = await asyncReducer(accumulator, item);
    }
    
    return accumulator;
  }
}

// Usage examples
const mapReduce = new MapReduce({ chunkSize: 100, concurrency: 4 });

const largeArray = Array.from({ length: 10000 }, (_, i) => i);

const sum = await mapReduce.execute(
  largeArray,
  // Map function - sum each chunk
  (chunk) => chunk.reduce((sum, n) => sum + n, 0),
  // Reduce function - sum all chunk sums
  (acc, chunkSum) => acc + chunkSum,
  0
);

// Parallel pipeline
const pipeline = new ParallelPipeline(3)
  .addStage(
    async (batch) => {
      // Simulate data fetching
      await new Promise(resolve => setTimeout(resolve, 100));
      return batch.map(item => ({ ...item, fetched: true }));
    },
    { batchSize: 5 }
  )
  .addStage(
    async (batch) => {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 50));
      return batch.map(item => ({ ...item, processed: true }));
    },
    { batchSize: 3 }
  );

const inputData = Array.from({ length: 20 }, (_, i) => ({ id: i }));
const processedData = await pipeline.process(inputData);

// Fork-join usage
const urls = ['/api/users', '/api/posts', '/api/comments'];

const [users, posts, comments] = await ForkJoin.fork([
  () => fetch('/api/users').then(r => r.json()),
  () => fetch('/api/posts').then(r => r.json()),
  () => fetch('/api/comments').then(r => r.json())
], 2); // Limit to 2 concurrent requests

// Parallel map with limited concurrency
const processedUsers = await ForkJoin.forkMap(
  users,
  async (user) => {
    const profile = await fetch(`/api/profiles/${user.id}`).then(r => r.json());
    return { ...user, profile };
  },
  3
);
```

## Promise Utilities

### 1. Custom Promise Utilities

```javascript
// Promise utilities class
class PromiseUtils {
  // Promise.allSettled with timeout
  static async allSettledWithTimeout(promises, timeoutMs) {
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
    });
    
    const promisesWithTimeout = promises.map(promise => 
      Promise.race([promise, timeoutPromise])
        .then(result => 
          result && result.status === 'timeout' 
            ? { status: 'rejected', reason: new Error('Timeout') }
            : { status: 'fulfilled', value: result }
        )
        .catch(reason => ({ status: 'rejected', reason }))
    );
    
    return Promise.all(promisesWithTimeout);
  }
  
  // Promise.some - resolves when n promises resolve
  static async some(promises, count) {
    if (count <= 0) return [];
    if (count >= promises.length) return Promise.all(promises);
    
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let completed = 0;
      
      promises.forEach((promise, index) => {
        Promise.resolve(promise)
          .then(value => {
            results[index] = value;
            completed++;
            
            if (results.filter(r => r !== undefined).length >= count) {
              resolve(results.filter(r => r !== undefined).slice(0, count));
            }
          })
          .catch(error => {
            errors[index] = error;
            completed++;
            
            if (completed === promises.length && results.filter(r => r !== undefined).length < count) {
              reject(new AggregateError(errors, `Only ${results.filter(r => r !== undefined).length} promises resolved, needed ${count}`));
            }
          });
      });
    });
  }
  
  // Promise.map with concurrency limit
  static async map(items, mapper, options = {}) {
    const { concurrency = Infinity, preserveOrder = true } = options;
    
    if (concurrency === Infinity) {
      const promises = items.map(mapper);
      return Promise.all(promises);
    }
    
    const semaphore = new Semaphore(concurrency);
    const promises = items.map((item, index) => 
      semaphore.use(async () => {
        const result = await mapper(item, index);
        return preserveOrder ? { result, index } : result;
      })
    );
    
    const results = await Promise.all(promises);
    
    if (preserveOrder) {
      return results
        .sort((a, b) => a.index - b.index)
        .map(item => item.result);
    }
    
    return results;
  }
  
  // Promise.filter with concurrency limit
  static async filter(items, predicate, options = {}) {
    const { concurrency = Infinity } = options;
    
    const mapped = await this.map(
      items,
      async (item, index) => {
        const shouldInclude = await predicate(item, index);
        return { item, shouldInclude };
      },
      { concurrency }
    );
    
    return mapped
      .filter(({ shouldInclude }) => shouldInclude)
      .map(({ item }) => item);
  }
  
  // Promise.reduce - sequential processing
  static async reduce(items, reducer, initialValue) {
    let accumulator = initialValue;
    
    for (const [index, item] of items.entries()) {
      accumulator = await reducer(accumulator, item, index);
    }
    
    return accumulator;
  }
  
  // Promise.each - sequential iteration
  static async each(items, iterator) {
    const results = [];
    
    for (const [index, item] of items.entries()) {
      const result = await iterator(item, index);
      results.push(result);
    }
    
    return results;
  }
  
  // Promise with progress tracking
  static withProgress(promises, onProgress) {
    let completed = 0;
    const total = promises.length;
    
    const wrappedPromises = promises.map((promise, index) => 
      Promise.resolve(promise)
        .then(result => {
          completed++;
          onProgress({
            completed,
            total,
            percentage: Math.round((completed / total) * 100),
            index
          });
          return result;
        })
        .catch(error => {
          completed++;
          onProgress({
            completed,
            total,
            percentage: Math.round((completed / total) * 100),
            index,
            error
          });
          throw error;
        })
    );
    
    return Promise.allSettled(wrappedPromises);
  }
  
  // Promise.props - resolve object properties
  static async props(obj) {
    const keys = Object.keys(obj);
    const promises = keys.map(key => Promise.resolve(obj[key]));
    const results = await Promise.all(promises);
    
    return keys.reduce((resolved, key, index) => {
      resolved[key] = results[index];
      return resolved;
    }, {});
  }
  
  // Debounced promise
  static debounce(promiseFn, delay) {
    let timeoutId;
    let latestResolve;
    let latestReject;
    
    return (...args) => {
      return new Promise((resolve, reject) => {
        latestResolve = resolve;
        latestReject = reject;
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            const result = await promiseFn(...args);
            latestResolve(result);
          } catch (error) {
            latestReject(error);
          }
        }, delay);
      });
    };
  }
  
  // Promise.series - run promises in series
  static async series(promiseFactories) {
    const results = [];
    
    for (const factory of promiseFactories) {
      const result = await factory();
      results.push(result);
    }
    
    return results;
  }
  
  // Promise.waterfall - pass result to next promise
  static async waterfall(promiseFactories, initialValue) {
    let result = initialValue;
    
    for (const factory of promiseFactories) {
      result = await factory(result);
    }
    
    return result;
  }
}

// Usage examples
const urls = ['/api/users', '/api/posts', '/api/comments', '/api/tags'];

// Some - wait for first 2 to complete
const firstTwo = await PromiseUtils.some(
  urls.map(url => fetch(url).then(r => r.json())),
  2
);

// Map with concurrency limit
const userData = await PromiseUtils.map(
  [1, 2, 3, 4, 5],
  async (id) => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  },
  { concurrency: 2 }
);

// Filter with async predicate
const activeUsers = await PromiseUtils.filter(
  userData,
  async (user) => {
    const status = await fetch(`/api/users/${user.id}/status`);
    const { active } = await status.json();
    return active;
  },
  { concurrency: 3 }
);

// Promise props
const apiData = await PromiseUtils.props({
  users: fetch('/api/users').then(r => r.json()),
  posts: fetch('/api/posts').then(r => r.json()),
  config: fetch('/api/config').then(r => r.json())
});

// Progress tracking
const downloads = urls.map(url => fetch(url));

await PromiseUtils.withProgress(downloads, (progress) => {
  console.log(`Download progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
});

// Debounced API call
const debouncedSearch = PromiseUtils.debounce(
  async (query) => {
    const response = await fetch(`/api/search?q=${query}`);
    return response.json();
  },
  300
);

// Multiple rapid calls will be debounced
debouncedSearch('javascript');
debouncedSearch('javascript promises'); // Only this will execute

// Waterfall processing
const processedData = await PromiseUtils.waterfall([
  (data) => fetch('/api/validate', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  (validatedData) => fetch('/api/enrich', { method: 'POST', body: JSON.stringify(validatedData) }).then(r => r.json()),
  (enrichedData) => fetch('/api/save', { method: 'POST', body: JSON.stringify(enrichedData) }).then(r => r.json())
], { input: 'raw data' });
```

### 2. Advanced Promise Patterns

```javascript
// Promise-based event emitter
class AsyncEventEmitter {
  constructor() {
    this.listeners = new Map();
  }
  
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
  }
  
  off(event, listener) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }
  
  once(event) {
    return new Promise(resolve => {
      const listener = (data) => {
        this.off(event, listener);
        resolve(data);
      };
      this.on(event, listener);
    });
  }
  
  async emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return [];
    
    const promises = Array.from(eventListeners).map(listener => 
      Promise.resolve(listener(data))
    );
    
    return Promise.allSettled(promises);
  }
  
  async waitFor(event, predicate, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(event, listener);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);
      
      const listener = (data) => {
        if (!predicate || predicate(data)) {
          clearTimeout(timeoutId);
          this.off(event, listener);
          resolve(data);
        }
      };
      
      this.on(event, listener);
    });
  }
  
  async *iterate(event) {
    const queue = [];
    let resolve;
    let promise = new Promise(r => resolve = r);
    
    const listener = (data) => {
      queue.push(data);
      resolve();
      promise = new Promise(r => resolve = r);
    };
    
    this.on(event, listener);
    
    try {
      while (true) {
        if (queue.length === 0) {
          await promise;
        }
        
        while (queue.length > 0) {
          yield queue.shift();
        }
      }
    } finally {
      this.off(event, listener);
    }
  }
}

// Promise-based state machine
class AsyncStateMachine {
  constructor(states, initialState) {
    this.states = states;
    this.currentState = initialState;
    this.eventEmitter = new AsyncEventEmitter();
    this.transitionQueue = [];
    this.isTransitioning = false;
  }
  
  async transition(event, data) {
    return new Promise((resolve, reject) => {
      this.transitionQueue.push({ event, data, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.isTransitioning || this.transitionQueue.length === 0) {
      return;
    }
    
    this.isTransitioning = true;
    
    while (this.transitionQueue.length > 0) {
      const { event, data, resolve, reject } = this.transitionQueue.shift();
      
      try {
        const currentStateConfig = this.states[this.currentState];
        if (!currentStateConfig || !currentStateConfig.transitions[event]) {
          throw new Error(`Invalid transition: ${this.currentState} -> ${event}`);
        }
        
        const transition = currentStateConfig.transitions[event];
        const nextState = typeof transition === 'string' ? transition : transition.target;
        
        // Execute exit handler
        if (currentStateConfig.onExit) {
          await currentStateConfig.onExit(event, data);
        }
        
        // Execute transition handler
        if (typeof transition === 'object' && transition.action) {
          await transition.action(data);
        }
        
        // Change state
        const previousState = this.currentState;
        this.currentState = nextState;
        
        // Execute entry handler
        const nextStateConfig = this.states[nextState];
        if (nextStateConfig && nextStateConfig.onEnter) {
          await nextStateConfig.onEnter(event, data);
        }
        
        // Emit state change event
        this.eventEmitter.emit('stateChange', {
          from: previousState,
          to: nextState,
          event,
          data
        });
        
        resolve(nextState);
      } catch (error) {
        reject(error);
      }
    }
    
    this.isTransitioning = false;
  }
  
  getState() {
    return this.currentState;
  }
  
  can(event) {
    const currentStateConfig = this.states[this.currentState];
    return currentStateConfig && currentStateConfig.transitions[event] !== undefined;
  }
  
  onStateChange(listener) {
    this.eventEmitter.on('stateChange', listener);
  }
  
  offStateChange(listener) {
    this.eventEmitter.off('stateChange', listener);
  }
}

// Promise-based resource loader
class AsyncResourceLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }
  
  async load(key, loader, options = {}) {
    const { cache = true, force = false } = options;
    
    // Return cached resource if available and not forced
    if (!force && cache && this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Return existing loading promise if in progress
    if (this.loading.has(key)) {
      return this.loading.get(key);
    }
    
    // Start loading
    const loadingPromise = this.performLoad(key, loader, options);
    this.loading.set(key, loadingPromise);
    
    try {
      const resource = await loadingPromise;
      
      if (cache) {
        this.cache.set(key, resource);
      }
      
      return resource;
    } finally {
      this.loading.delete(key);
    }
  }
  
  async performLoad(key, loader, options) {
    const { timeout, retry = 0 } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        let loadPromise = loader(key);
        
        if (timeout) {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout loading resource: ${key}`)), timeout);
          });
          loadPromise = Promise.race([loadPromise, timeoutPromise]);
        }
        
        return await loadPromise;
      } catch (error) {
        lastError = error;
        
        if (attempt < retry) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }
  
  async loadMultiple(resources, options = {}) {
    const { concurrency = 3 } = options;
    
    const entries = Array.isArray(resources) 
      ? resources.map(key => [key, key])
      : Object.entries(resources);
    
    const semaphore = new Semaphore(concurrency);
    
    const promises = entries.map(([key, loader]) =>
      semaphore.use(() => this.load(key, 
        typeof loader === 'function' ? loader : () => loader,
        options
      ))
    );
    
    const results = await Promise.allSettled(promises);
    
    return entries.reduce((acc, [key], index) => {
      const result = results[index];
      acc[key] = result.status === 'fulfilled' ? result.value : result.reason;
      return acc;
    }, {});
  }
  
  invalidate(key) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  get stats() {
    return {
      cached: this.cache.size,
      loading: this.loading.size
    };
  }
}

// Usage examples
const eventEmitter = new AsyncEventEmitter();

// Wait for specific event
const userData = await eventEmitter.waitFor('userLoaded', 
  (data) => data.userId === '123'
);

// Iterate over events
for await (const logEntry of eventEmitter.iterate('log')) {
  console.log('Log entry:', logEntry);
  
  if (logEntry.level === 'error') {
    break;
  }
}

// State machine for user authentication
const authStates = {
  idle: {
    transitions: {
      login: 'authenticating'
    }
  },
  authenticating: {
    transitions: {
      success: 'authenticated',
      failure: 'idle'
    },
    onEnter: async (event, credentials) => {
      console.log('Authenticating user...');
      // Perform authentication
    }
  },
  authenticated: {
    transitions: {
      logout: 'idle',
      refresh: 'refreshing'
    },
    onEnter: async () => {
      console.log('User authenticated');
    }
  },
  refreshing: {
    transitions: {
      success: 'authenticated',
      failure: 'idle'
    }
  }
};

const authMachine = new AsyncStateMachine(authStates, 'idle');

authMachine.onStateChange(({ from, to, event }) => {
  console.log(`Auth state: ${from} -> ${to} (${event})`);
});

await authMachine.transition('login', { username: 'user', password: 'pass' });

// Resource loader
const resourceLoader = new AsyncResourceLoader();

const config = await resourceLoader.load('config', 
  async () => {
    const response = await fetch('/api/config');
    return response.json();
  },
  { cache: true, timeout: 5000, retry: 2 }
);

const multipleResources = await resourceLoader.loadMultiple({
  users: async () => fetch('/api/users').then(r => r.json()),
  posts: async () => fetch('/api/posts').then(r => r.json()),
  settings: async () => fetch('/api/settings').then(r => r.json())
}, { concurrency: 2 });
```

## Streaming & Generators

### 1. Async Generators for Streaming

```javascript
// Async generator for paginated API data
async function* fetchPaginatedData(baseUrl, pageSize = 10) {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await fetch(`${baseUrl}?page=${page}&limit=${pageSize}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      for (const item of data.items) {
        yield item;
      }
      
      hasMore = data.hasMore;
      page++;
      
      // Add delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }
}

// Transform async generator
async function* transformStream(source, transformer) {
  for await (const item of source) {
    try {
      const transformed = await transformer(item);
      if (transformed !== undefined) {
        yield transformed;
      }
    } catch (error) {
      console.error('Transform error:', error);
      // Continue processing other items
    }
  }
}

// Filter async generator
async function* filterStream(source, predicate) {
  for await (const item of source) {
    try {
      const shouldInclude = await predicate(item);
      if (shouldInclude) {
        yield item;
      }
    } catch (error) {
      console.error('Filter error:', error);
    }
  }
}

// Batch async generator
async function* batchStream(source, batchSize) {
  let batch = [];
  
  for await (const item of source) {
    batch.push(item);
    
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  
  // Yield remaining items
  if (batch.length > 0) {
    yield batch;
  }
}

// Buffer async generator
async function* bufferStream(source, bufferSize = 10) {
  const buffer = [];
  let done = false;
  
  const iterator = source[Symbol.asyncIterator]();
  
  // Fill initial buffer
  while (buffer.length < bufferSize && !done) {
    const { value, done: iterDone } = await iterator.next();
    done = iterDone;
    
    if (!done) {
      buffer.push(value);
    }
  }
  
  while (buffer.length > 0) {
    yield buffer.shift();
    
    // Refill buffer
    if (!done && buffer.length < bufferSize / 2) {
      while (buffer.length < bufferSize && !done) {
        const { value, done: iterDone } = await iterator.next();
        done = iterDone;
        
        if (!done) {
          buffer.push(value);
        }
      }
    }
  }
}

// Merge multiple async generators
async function* mergeStreams(...sources) {
  const iterators = sources.map(source => source[Symbol.asyncIterator]());
  const promises = new Map();
  
  // Initialize promises
  iterators.forEach((iterator, index) => {
    promises.set(index, iterator.next());
  });
  
  while (promises.size > 0) {
    // Wait for the first to complete
    const completedPromises = Array.from(promises.entries());
    const { value: [index, result] } = await Promise.race(
      completedPromises.map(([i, promise]) => 
        promise.then(result => ({ value: [i, result] }))
      )
    );
    
    if (!result.done) {
      yield result.value;
      // Get next value from this iterator
      promises.set(index, iterators[index].next());
    } else {
      // This iterator is done
      promises.delete(index);
    }
  }
}

// Concurrent processing of async generator
async function* concurrentMap(source, mapper, concurrency = 3) {
  const semaphore = new Semaphore(concurrency);
  const promises = new Map();
  const iterator = source[Symbol.asyncIterator]();
  let done = false;
  let nextIndex = 0;
  
  while (!done || promises.size > 0) {
    // Fill up to concurrency limit
    while (promises.size < concurrency && !done) {
      const { value, done: iterDone } = await iterator.next();
      done = iterDone;
      
      if (!done) {
        const index = nextIndex++;
        const promise = semaphore.use(() => mapper(value));
        promises.set(promise, { index, value });
      }
    }
    
    if (promises.size > 0) {
      // Wait for the first to complete
      const completedPromise = await Promise.race(promises.keys());
      const result = await completedPromise;
      const { index } = promises.get(completedPromise);
      
      promises.delete(completedPromise);
      yield result;
    }
  }
}

// Usage examples
async function streamExample() {
  // Fetch paginated data
  const dataStream = fetchPaginatedData('/api/users', 20);
  
  // Transform and filter
  const processedStream = transformStream(
    filterStream(dataStream, user => user.active),
    async (user) => {
      const profile = await fetch(`/api/profiles/${user.id}`).then(r => r.json());
      return { ...user, profile };
    }
  );
  
  // Process in batches
  const batchedStream = batchStream(processedStream, 5);
  
  for await (const batch of batchedStream) {
    console.log(`Processing batch of ${batch.length} users`);
    
    // Process batch
    await Promise.all(batch.map(async (user) => {
      // Save to database
      await fetch('/api/users/save', {
        method: 'POST',
        body: JSON.stringify(user)
      });
    }));
  }
}

// Merge multiple data sources
async function mergeExample() {
  const usersStream = fetchPaginatedData('/api/users');
  const postsStream = fetchPaginatedData('/api/posts');
  const commentsStream = fetchPaginatedData('/api/comments');
  
  const mergedStream = mergeStreams(usersStream, postsStream, commentsStream);
  
  for await (const item of mergedStream) {
    console.log('Received item:', item.type, item.id);
  }
}

// Concurrent processing
async function concurrentExample() {
  const dataStream = fetchPaginatedData('/api/items');
  
  const enrichedStream = concurrentMap(
    dataStream,
    async (item) => {
      const details = await fetch(`/api/items/${item.id}/details`).then(r => r.json());
      return { ...item, details };
    },
    5 // Process 5 items concurrently
  );
  
  for await (const enrichedItem of enrichedStream) {
    console.log('Enriched item:', enrichedItem);
  }
}
```

### 2. Stream Processing Utilities

```javascript
// Stream processor class
class StreamProcessor {
  constructor() {
    this.processors = [];
  }
  
  map(mapper) {
    this.processors.push({
      type: 'map',
      fn: mapper
    });
    return this;
  }
  
  filter(predicate) {
    this.processors.push({
      type: 'filter',
      fn: predicate
    });
    return this;
  }
  
  flatMap(mapper) {
    this.processors.push({
      type: 'flatMap',
      fn: mapper
    });
    return this;
  }
  
  take(count) {
    this.processors.push({
      type: 'take',
      count
    });
    return this;
  }
  
  skip(count) {
    this.processors.push({
      type: 'skip',
      count
    });
    return this;
  }
  
  batch(size) {
    this.processors.push({
      type: 'batch',
      size
    });
    return this;
  }
  
  debounce(delay) {
    this.processors.push({
      type: 'debounce',
      delay
    });
    return this;
  }
  
  throttle(interval) {
    this.processors.push({
      type: 'throttle',
      interval
    });
    return this;
  }
  
  async *process(source) {
    let stream = source;
    
    for (const processor of this.processors) {
      stream = this.applyProcessor(stream, processor);
    }
    
    for await (const item of stream) {
      yield item;
    }
  }
  
  async *applyProcessor(source, processor) {
    switch (processor.type) {
      case 'map':
        for await (const item of source) {
          const mapped = await processor.fn(item);
          yield mapped;
        }
        break;
        
      case 'filter':
        for await (const item of source) {
          const shouldInclude = await processor.fn(item);
          if (shouldInclude) {
            yield item;
          }
        }
        break;
        
      case 'flatMap':
        for await (const item of source) {
          const mapped = await processor.fn(item);
          if (Symbol.asyncIterator in mapped) {
            for await (const subItem of mapped) {
              yield subItem;
            }
          } else if (Array.isArray(mapped)) {
            for (const subItem of mapped) {
              yield subItem;
            }
          } else {
            yield mapped;
          }
        }
        break;
        
      case 'take':
        let taken = 0;
        for await (const item of source) {
          if (taken >= processor.count) break;
          yield item;
          taken++;
        }
        break;
        
      case 'skip':
        let skipped = 0;
        for await (const item of source) {
          if (skipped < processor.count) {
            skipped++;
            continue;
          }
          yield item;
        }
        break;
        
      case 'batch':
        let batch = [];
        for await (const item of source) {
          batch.push(item);
          if (batch.length >= processor.size) {
            yield batch;
            batch = [];
          }
        }
        if (batch.length > 0) {
          yield batch;
        }
        break;
        
      case 'debounce':
        let lastItem;
        let timeoutId;
        
        for await (const item of source) {
          lastItem = item;
          clearTimeout(timeoutId);
          
          await new Promise(resolve => {
            timeoutId = setTimeout(() => {
              resolve();
            }, processor.delay);
          });
          
          if (item === lastItem) {
            yield item;
          }
        }
        break;
        
      case 'throttle':
        let lastEmitTime = 0;
        
        for await (const item of source) {
          const now = Date.now();
          if (now - lastEmitTime >= processor.interval) {
            yield item;
            lastEmitTime = now;
          }
        }
        break;
    }
  }
  
  async collect(source) {
    const results = [];
    for await (const item of this.process(source)) {
      results.push(item);
    }
    return results;
  }
  
  async reduce(source, reducer, initialValue) {
    let accumulator = initialValue;
    for await (const item of this.process(source)) {
      accumulator = await reducer(accumulator, item);
    }
    return accumulator;
  }
  
  async forEach(source, iterator) {
    for await (const item of this.process(source)) {
      await iterator(item);
    }
  }
}

// Observable-like stream
class ObservableStream {
  constructor(source) {
    this.source = source;
    this.observers = new Set();
  }
  
  subscribe(observer) {
    this.observers.add(observer);
    
    // Start processing if this is the first observer
    if (this.observers.size === 1) {
      this.start();
    }
    
    return () => {
      this.observers.delete(observer);
      if (this.observers.size === 0) {
        this.stop();
      }
    };
  }
  
  async start() {
    try {
      for await (const item of this.source) {
        this.observers.forEach(observer => {
          try {
            observer.next(item);
          } catch (error) {
            console.error('Observer error:', error);
          }
        });
      }
      
      this.observers.forEach(observer => {
        if (observer.complete) {
          observer.complete();
        }
      });
    } catch (error) {
      this.observers.forEach(observer => {
        if (observer.error) {
          observer.error(error);
        }
      });
    }
  }
  
  stop() {
    // Implement cancellation logic if needed
  }
  
  map(mapper) {
    return new ObservableStream(transformStream(this.source, mapper));
  }
  
  filter(predicate) {
    return new ObservableStream(filterStream(this.source, predicate));
  }
  
  take(count) {
    return new ObservableStream(this.takeStream(count));
  }
  
  async *takeStream(count) {
    let taken = 0;
    for await (const item of this.source) {
      if (taken >= count) break;
      yield item;
      taken++;
    }
  }
}

// Stream from events
function fromEvents(target, eventName) {
  return new ReadableStream({
    start(controller) {
      const handler = (event) => {
        controller.enqueue(event);
      };
      
      target.addEventListener(eventName, handler);
      
      return () => {
        target.removeEventListener(eventName, handler);
      };
    }
  });
}

// Stream from promise
function fromPromise(promise) {
  return new ReadableStream({
    start(controller) {
      promise
        .then(value => {
          controller.enqueue(value);
          controller.close();
        })
        .catch(error => {
          controller.error(error);
        });
    }
  });
}

// Usage examples
async function streamProcessingExample() {
  const dataStream = fetchPaginatedData('/api/users');
  
  const processor = new StreamProcessor()
    .filter(user => user.active)
    .map(async (user) => {
      const profile = await fetch(`/api/profiles/${user.id}`).then(r => r.json());
      return { ...user, profile };
    })
    .batch(10)
    .take(100);
  
  const batches = await processor.collect(dataStream);
  console.log(`Collected ${batches.length} batches`);
  
  // Process with forEach
  await processor.forEach(dataStream, async (batch) => {
    console.log(`Processing batch of ${batch.length} items`);
    // Process batch
  });
  
  // Reduce to summary
  const summary = await processor.reduce(
    dataStream,
    (acc, batch) => ({
      totalBatches: acc.totalBatches + 1,
      totalItems: acc.totalItems + batch.length
    }),
    { totalBatches: 0, totalItems: 0 }
  );
}

// Observable example
async function observableExample() {
  const dataStream = fetchPaginatedData('/api/realtime-data');
  const observable = new ObservableStream(dataStream);
  
  const filteredObservable = observable
    .filter(item => item.priority === 'high')
    .map(item => ({ ...item, processed: Date.now() }))
    .take(50);
  
  const unsubscribe = filteredObservable.subscribe({
    next: (item) => {
      console.log('Received high priority item:', item);
    },
    error: (error) => {
      console.error('Stream error:', error);
    },
    complete: () => {
      console.log('Stream completed');
    }
  });
  
  // Unsubscribe after 30 seconds
  setTimeout(unsubscribe, 30000);
}
```

## Real-World Patterns

### 1. API Client with Advanced Features

```javascript
// Advanced API client with retry, caching, and concurrent request limiting
class AdvancedApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 30000;
    this.retryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      ...options.retry
    };
    
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.maxConcurrentRequests = options.maxConcurrentRequests || 10;
    this.semaphore = new Semaphore(this.maxConcurrentRequests);
    
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
  }
  
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }
  
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }
  
  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor);
  }
  
  async request(config) {
    return this.semaphore.use(async () => {
      // Apply request interceptors
      let requestConfig = { ...config };
      for (const interceptor of this.interceptors.request) {
        requestConfig = await interceptor(requestConfig);
      }
      
      const cacheKey = this.getCacheKey(requestConfig);
      
      // Check cache for GET requests
      if (requestConfig.method === 'GET' && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          return cached.data;
        } else {
          this.cache.delete(cacheKey);
        }
      }
      
      try {
        const response = await this.performRequest(requestConfig);
        
        // Cache successful GET responses
        if (requestConfig.method === 'GET' && response.ok) {
          const data = await response.clone().json();
          this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
        }
        
        // Apply response interceptors
        let finalResponse = response;
        for (const interceptor of this.interceptors.response) {
          finalResponse = await interceptor(finalResponse);
        }
        
        return finalResponse;
      } catch (error) {
        // Apply error interceptors
        let finalError = error;
        for (const interceptor of this.interceptors.error) {
          finalError = await interceptor(finalError, requestConfig);
        }
        throw finalError;
      }
    });
  }
  
  async performRequest(config) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(this.buildUrl(config.url), {
          method: config.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.defaultHeaders,
            ...config.headers
          },
          body: config.data ? JSON.stringify(config.data) : undefined,
          signal: controller.signal,
          ...config.fetchOptions
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryOptions.maxRetries && this.shouldRetry(error)) {
          const delay = Math.min(
            this.retryOptions.baseDelay * Math.pow(this.retryOptions.backoffFactor, attempt),
            this.retryOptions.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  shouldRetry(error) {
    // Retry on network errors, timeouts, and 5xx status codes
    return error.name === 'AbortError' || 
           error.message.includes('Failed to fetch') ||
           (error.message.includes('HTTP 5') && !error.message.includes('HTTP 4'));
  }
  
  getCacheKey(config) {
    return `${config.method || 'GET'}:${this.buildUrl(config.url)}:${JSON.stringify(config.params || {})}`;
  }
  
  buildUrl(path) {
    if (path.startsWith('http')) {
      return path;
    }
    return `${this.baseUrl}${path}`;
  }
  
  async get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' });
  }
  
  async post(url, data, config = {}) {
    return this.request({ ...config, url, method: 'POST', data });
  }
  
  async put(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PUT', data });
  }
  
  async patch(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PATCH', data });
  }
  
  async delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' });
  }
  
  clearCache() {
    this.cache.clear();
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Usage
const apiClient = new AdvancedApiClient({
  baseUrl: 'https://api.example.com',
  timeout: 10000,
  maxConcurrentRequests: 5,
  retry: {
    maxRetries: 2,
    baseDelay: 500
  }
});

// Add authentication interceptor
apiClient.addRequestInterceptor(async (config) => {
  const token = await getAuthToken();
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${token}`
    }
  };
});

// Add response transformation interceptor
apiClient.addResponseInterceptor(async (response) => {
  return response.json();
});

// Add error handling interceptor
apiClient.addErrorInterceptor(async (error, config) => {
  if (error.message.includes('HTTP 401')) {
    await refreshAuthToken();
    return apiClient.request(config); // Retry with new token
  }
  throw error;
});

const users = await apiClient.get('/users');
```

### 2. Background Task Manager

```javascript
// Background task manager with queues and scheduling
class BackgroundTaskManager {
  constructor(options = {}) {
    this.queues = new Map();
    this.running = new Map();
    this.completed = new Map();
    this.failed = new Map();
    this.maxRetries = options.maxRetries || 3;
    this.defaultPriority = options.defaultPriority || 0;
    this.persistence = options.persistence; // Optional persistence layer
    
    this.isProcessing = false;
    this.scheduledTasks = new Map();
  }
  
  // Add a task to a specific queue
  addTask(queueName, taskFn, options = {}) {
    const task = {
      id: options.id || this.generateTaskId(),
      fn: taskFn,
      priority: options.priority || this.defaultPriority,
      retries: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      delay: options.delay || 0,
      createdAt: Date.now(),
      metadata: options.metadata || {}
    };
    
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    
    const queue = this.queues.get(queueName);
    
    // Insert task based on priority (higher priority first)
    const insertIndex = queue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      queue.push(task);
    } else {
      queue.splice(insertIndex, 0, task);
    }
    
    this.startProcessing();
    
    if (this.persistence) {
      this.persistence.saveTask(queueName, task);
    }
    
    return task.id;
  }
  
  // Schedule a task to run at a specific time
  scheduleTask(queueName, taskFn, scheduleTime, options = {}) {
    const delay = scheduleTime instanceof Date ? 
      scheduleTime.getTime() - Date.now() : 
      scheduleTime;
    
    if (delay <= 0) {
      return this.addTask(queueName, taskFn, options);
    }
    
    const taskId = options.id || this.generateTaskId();
    const timeoutId = setTimeout(() => {
      this.scheduledTasks.delete(taskId);
      this.addTask(queueName, taskFn, { ...options, id: taskId });
    }, delay);
    
    this.scheduledTasks.set(taskId, {
      timeoutId,
      queueName,
      taskFn,
      options,
      scheduleTime: Date.now() + delay
    });
    
    return taskId;
  }
  
  // Schedule a recurring task
  scheduleRecurring(queueName, taskFn, interval, options = {}) {
    const taskId = options.id || this.generateTaskId();
    let isActive = true;
    
    const runTask = async () => {
      if (!isActive) return;
      
      try {
        await this.addTaskAndWait(queueName, taskFn, options);
      } catch (error) {
        console.error(`Recurring task ${taskId} failed:`, error);
      }
      
      if (isActive) {
        setTimeout(runTask, interval);
      }
    };
    
    setTimeout(runTask, interval);
    
    return {
      id: taskId,
      stop: () => { isActive = false; }
    };
  }
  
  async addTaskAndWait(queueName, taskFn, options = {}) {
    return new Promise((resolve, reject) => {
      const taskId = this.addTask(queueName, taskFn, {
        ...options,
        onComplete: resolve,
        onError: reject
      });
    });
  }
  
  async startProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this.hasTasksToProcess()) {
      const { queueName, task } = this.getNextTask();
      if (!task) break;
      
      this.running.set(task.id, {
        ...task,
        queueName,
        startedAt: Date.now()
      });
      
      try {
        if (task.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, task.delay));
        }
        
        const result = await task.fn();
        
        this.completed.set(task.id, {
          ...task,
          result,
          completedAt: Date.now()
        });
        
        if (task.onComplete) {
          task.onComplete(result);
        }
        
        if (this.persistence) {
          this.persistence.markCompleted(task.id, result);
        }
      } catch (error) {
        task.retries++;
        
        if (task.retries < task.maxRetries) {
          // Retry with exponential backoff
          const retryDelay = Math.pow(2, task.retries) * 1000;
          task.delay = retryDelay;
          
          // Add back to queue
          const queue = this.queues.get(queueName);
          queue.unshift(task);
        } else {
          // Max retries reached
          this.failed.set(task.id, {
            ...task,
            error,
            failedAt: Date.now()
          });
          
          if (task.onError) {
            task.onError(error);
          }
          
          if (this.persistence) {
            this.persistence.markFailed(task.id, error);
          }
        }
      } finally {
        this.running.delete(task.id);
      }
    }
    
    this.isProcessing = false;
  }
  
  hasTasksToProcess() {
    return Array.from(this.queues.values()).some(queue => queue.length > 0);
  }
  
  getNextTask() {
    let highestPriority = -Infinity;
    let selectedQueue = null;
    let selectedQueueName = null;
    
    for (const [queueName, queue] of this.queues.entries()) {
      if (queue.length > 0 && queue[0].priority > highestPriority) {
        highestPriority = queue[0].priority;
        selectedQueue = queue;
        selectedQueueName = queueName;
      }
    }
    
    if (selectedQueue) {
      const task = selectedQueue.shift();
      return { queueName: selectedQueueName, task };
    }
    
    return { queueName: null, task: null };
  }
  
  cancelTask(taskId) {
    // Check scheduled tasks
    if (this.scheduledTasks.has(taskId)) {
      const scheduled = this.scheduledTasks.get(taskId);
      clearTimeout(scheduled.timeoutId);
      this.scheduledTasks.delete(taskId);
      return true;
    }
    
    // Check queues
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(task => task.id === taskId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    
    return false;
  }
  
  getQueueStats(queueName) {
    const queue = this.queues.get(queueName) || [];
    const running = Array.from(this.running.values()).filter(t => t.queueName === queueName);
    const completed = Array.from(this.completed.values()).filter(t => t.queueName === queueName);
    const failed = Array.from(this.failed.values()).filter(t => t.queueName === queueName);
    
    return {
      pending: queue.length,
      running: running.length,
      completed: completed.length,
      failed: failed.length,
      totalProcessed: completed.length + failed.length
    };
  }
  
  getAllStats() {
    const stats = {};
    for (const queueName of this.queues.keys()) {
      stats[queueName] = this.getQueueStats(queueName);
    }
    return stats;
  }
  
  clearQueue(queueName) {
    if (this.queues.has(queueName)) {
      this.queues.get(queueName).length = 0;
    }
  }
  
  clearCompleted() {
    this.completed.clear();
  }
  
  clearFailed() {
    this.failed.clear();
  }
  
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage
const taskManager = new BackgroundTaskManager({
  maxRetries: 2,
  defaultPriority: 1
});

// Add immediate tasks
const taskId1 = taskManager.addTask('email', async () => {
  await sendEmail('user@example.com', 'Welcome!');
}, { priority: 5 });

const taskId2 = taskManager.addTask('data-processing', async () => {
  await processLargeDataset();
}, { priority: 1 });

// Schedule a task for later
const scheduledTaskId = taskManager.scheduleTask('cleanup', async () => {
  await cleanupTempFiles();
}, new Date(Date.now() + 60000)); // 1 minute from now

// Schedule a recurring task
const recurringTask = taskManager.scheduleRecurring('health-check', async () => {
  await performHealthCheck();
}, 30000); // Every 30 seconds

// Wait for a specific task to complete
try {
  const result = await taskManager.addTaskAndWait('api-sync', async () => {
    return await syncWithExternalAPI();
  });
  console.log('Sync completed:', result);
} catch (error) {
  console.error('Sync failed:', error);
}

// Monitor queue stats
setInterval(() => {
  const stats = taskManager.getAllStats();
  console.log('Queue stats:', stats);
}, 10000);

// Stop recurring task when needed
setTimeout(() => {
  recurringTask.stop();
}, 300000); // Stop after 5 minutes
```

## Summary

このドキュメントでは、JavaScript/TypeScriptの非同期プログラミングパターンを網羅的にカバーしました：

1. **Advanced Promise Patterns**: 高度なPromiseコンビネータ、状態管理、メモ化
2. **Async/Await Best Practices**: エラーハンドリング、高度な非同期パターン
3. **Concurrency & Parallelism**: セマフォ、ワーカープール、並列処理
4. **Promise Utilities**: カスタムPromiseユーティリティ、高度なパターン
5. **Streaming & Generators**: 非同期ジェネレータ、ストリーム処理
6. **Real-World Patterns**: 実用的なAPIクライアント、バックグラウンドタスクマネージャー

これらのパターンを活用することで、スケーラブルで信頼性の高い非同期JavaScriptアプリケーションを構築できます。