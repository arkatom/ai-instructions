# JavaScript Performance Optimization

## Code Optimization

### Avoid Memory Leaks
Prevent memory issues by proper cleanup.

```javascript
// Good
class EventManager {
  constructor() {
    this.listeners = new WeakMap();
  }
  
  addEventListener(element, callback) {
    const controller = new AbortController();
    element.addEventListener('click', callback, { signal: controller.signal });
    this.listeners.set(element, controller);
  }
  
  removeEventListener(element) {
    const controller = this.listeners.get(element);
    controller?.abort();
    this.listeners.delete(element);
  }
  
  cleanup() {
    // WeakMap allows garbage collection
  }
}

// Bad - memory leak
const handlers = [];
element.addEventListener('click', handler);
handlers.push(handler); // Never cleaned up
```

### Debounce and Throttle
Control function execution frequency.

```javascript
// Good - Debounce for search input
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const search = debounce(async (query) => {
  const results = await searchAPI(query);
  displayResults(results);
}, 300);

// Throttle for scroll events
const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const handleScroll = throttle(() => {
  updateScrollPosition();
}, 100);
```

## React Performance

### Memoization
Prevent unnecessary re-renders and recalculations.

```javascript
// Good
import { memo, useMemo, useCallback } from 'react';

const ExpensiveList = memo(({ items, onItemClick }) => {
  const sortedItems = useMemo(
    () => items.sort((a, b) => b.priority - a.priority),
    [items]
  );
  
  const handleClick = useCallback((id) => {
    onItemClick(id);
  }, [onItemClick]);
  
  return sortedItems.map(item => (
    <Item key={item.id} {...item} onClick={handleClick} />
  ));
});

// Bad - recreates on every render
const ExpensiveList = ({ items, onItemClick }) => {
  const sortedItems = items.sort((a, b) => b.priority - a.priority);
  
  return sortedItems.map(item => (
    <Item 
      key={item.id} 
      {...item} 
      onClick={() => onItemClick(item.id)} 
    />
  ));
};
```

### Virtualization
Render only visible items for large lists.

```javascript
// Good - React Window
import { FixedSizeList } from 'react-window';

const VirtualList = ({ items }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};

// Bad - rendering 10000 items
const List = ({ items }) => (
  <div>
    {items.map(item => <Item key={item.id} {...item} />)}
  </div>
);
```

## Bundle Optimization

### Code Splitting
Load code only when needed.

```javascript
// Good - Dynamic imports
const loadHeavyComponent = () => import('./HeavyComponent');

// Route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard'))
  },
  {
    path: '/analytics',
    component: lazy(() => import('./pages/Analytics'))
  }
];

// Conditional loading
if (userWantsAdvancedFeatures) {
  const { AdvancedEditor } = await import('./AdvancedEditor');
  renderEditor(AdvancedEditor);
}
```

### Tree Shaking
Remove unused code from bundles.

```javascript
// Good - Named exports for tree shaking
export { formatDate } from './formatters';
export { validateEmail } from './validators';

// Import only what's needed
import { formatDate } from './utils';

// Bad - Default export of everything
export default {
  formatDate,
  formatTime,
  validateEmail,
  validatePhone
};

import utils from './utils'; // Imports everything
```

## Async Operations

### Batch API Calls
Reduce network overhead.

```javascript
// Good - Batch requests
class BatchLoader {
  constructor(batchFn, delay = 10) {
    this.batchFn = batchFn;
    this.delay = delay;
    this.queue = [];
    this.timer = null;
  }
  
  load(id) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, resolve, reject });
      
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delay);
      }
    });
  }
  
  async flush() {
    const batch = this.queue.splice(0);
    this.timer = null;
    
    const ids = batch.map(item => item.id);
    const results = await this.batchFn(ids);
    
    batch.forEach((item, index) => {
      item.resolve(results[index]);
    });
  }
}

const userLoader = new BatchLoader(ids => fetchUsers(ids));
```

### Request Cancellation
Cancel outdated requests.

```javascript
// Good
const fetchWithCancel = (url) => {
  const controller = new AbortController();
  
  const promise = fetch(url, { signal: controller.signal })
    .then(res => res.json());
  
  promise.cancel = () => controller.abort();
  
  return promise;
};

// Usage in React
useEffect(() => {
  const request = fetchWithCancel('/api/data');
  
  request.then(setData).catch(err => {
    if (err.name !== 'AbortError') {
      setError(err);
    }
  });
  
  return () => request.cancel();
}, []);
```

## Caching Strategies

### Memoization Cache
Cache expensive computations.

```javascript
// Good
const memoize = (fn) => {
  const cache = new Map();
  
  return (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // LRU cache - limit size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
};

const expensiveCalculation = memoize((n) => {
  // Complex calculation
  return fibonacci(n);
});
```

### Service Worker Cache
Cache assets and API responses.

```javascript
// Good - Cache strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Cache hit - return response
      if (response) {
        return response;
      }
      
      // Clone the request
      const fetchRequest = event.request.clone();
      
      return fetch(fetchRequest).then(response => {
        // Check valid response
        if (!response || response.status !== 200) {
          return response;
        }
        
        // Clone the response
        const responseToCache = response.clone();
        
        caches.open('v1').then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});
```

## DOM Optimization

### Batch DOM Updates
Minimize reflows and repaints.

```javascript
// Good - Document fragment
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name;
  fragment.appendChild(li);
});
list.appendChild(fragment);

// Use requestAnimationFrame
const updatePositions = () => {
  requestAnimationFrame(() => {
    elements.forEach(el => {
      el.style.transform = `translateX(${el.dataset.x}px)`;
    });
  });
};

// Bad - Multiple reflows
items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name;
  list.appendChild(li); // Triggers reflow each time
});
```

## Web Workers

### Offload Heavy Computations
Run expensive operations in background.

```javascript
// Good - Worker for heavy processing
// worker.js
self.addEventListener('message', (e) => {
  const { data, type } = e.data;
  
  if (type === 'PROCESS_DATA') {
    const result = heavyProcessing(data);
    self.postMessage({ type: 'RESULT', result });
  }
});

// main.js
const worker = new Worker('worker.js');

worker.postMessage({ type: 'PROCESS_DATA', data: largeDataset });

worker.addEventListener('message', (e) => {
  if (e.data.type === 'RESULT') {
    displayResults(e.data.result);
  }
});
```

## Best Practices Checklist

- [ ] Use production builds (minified, optimized)
- [ ] Enable gzip/brotli compression
- [ ] Implement lazy loading for images and components
- [ ] Use CDN for static assets
- [ ] Optimize images (WebP, responsive sizes)
- [ ] Minimize bundle size with tree shaking
- [ ] Implement code splitting
- [ ] Cache API responses appropriately
- [ ] Debounce/throttle expensive operations
- [ ] Use Web Workers for heavy computations
- [ ] Monitor performance with Lighthouse
- [ ] Set performance budgets