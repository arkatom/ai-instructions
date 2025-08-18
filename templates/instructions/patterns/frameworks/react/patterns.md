# React Patterns

Modern React patterns with React 18+ features for concurrent, performant applications.

## React 18 Concurrent Features

### useTransition for Non-Urgent Updates
Mark state updates as non-urgent to keep UI responsive.

```jsx
// Good - React 18 concurrent features
const searchUsers = (query: string) => {
  const [isPending, startTransition] = useTransition();
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  
  const handleSearch = (newQuery: string) => {
    setQuery(newQuery); // Urgent update
    startTransition(() => {
      // Non-urgent update - won't block UI
      setSearchResults(performHeavySearch(newQuery));
    });
  };
  
  return (
    <div>
      <input value={query} onChange={e => handleSearch(e.target.value)} />
      {isPending ? <Spinner /> : <Results data={searchResults} />}
    </div>
  );
};

// Bad - blocking updates
const handleSearch = (query: string) => {
  setQuery(query);
  setSearchResults(performHeavySearch(query)); // Blocks UI
};
```

### useDeferredValue for Debounced Updates
Defer non-critical updates until more urgent ones complete.

```jsx
// Good - deferred rendering
const SearchResults = () => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => 
    searchDatabase(deferredQuery), [deferredQuery]
  );
  
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <div className={query !== deferredQuery ? 'dimmed' : ''}>
        {results.map(item => <Item key={item.id} {...item} />)}
      </div>
    </div>
  );
};
```

### Enhanced Suspense for Data Fetching
Use Suspense with concurrent features for better UX.

```jsx
// Good - React 18 Suspense patterns
const UserProfile = ({ userId }: { userId: string }) => {
  return (
    <Suspense 
      fallback={<ProfileSkeleton />}
      unstable_avoidThisFallback={true} // Prefer stale content
    >
      <UserData userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  );
};

// Streaming SSR component
const StreamingApp = () => {
  return (
    <html>
      <body>
        <Header />
        <Suspense fallback={<MainSkeleton />}>
          <MainContent />
        </Suspense>
        <Footer />
      </body>
    </html>
  );
};
```

## Server Components (Next.js 13+)

### Server vs Client Components
Clear separation between server and client rendering.

```jsx
// Good - Server Component (no 'use client')
// app/page.tsx - runs on server
const HomePage = async () => {
  const posts = await fetchPosts(); // Direct DB/API calls
  
  return (
    <div>
      <h1>Posts</h1>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

// Client Component for interactivity
'use client';
const InteractiveButton = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(c => c + 1)}>
      {children} ({count})
    </button>
  );
};

// Bad - mixing server logic in client component
'use client';
const BadComponent = () => {
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    // This should be done in Server Component
    fetchPosts().then(setPosts);
  }, []);
  
  return <div>...</div>;
};
```

## Modern State Management

### useId for Stable IDs
Generate stable unique IDs for accessibility.

```jsx
// Good - useId for form labels
const ContactForm = () => {
  const nameId = useId();
  const emailId = useId();
  
  return (
    <form>
      <label htmlFor={nameId}>Name</label>
      <input id={nameId} name="name" />
      
      <label htmlFor={emailId}>Email</label>
      <input id={emailId} name="email" type="email" />
    </form>
  );
};

// Bad - hardcoded IDs (SSR mismatch)
const BadForm = () => (
  <form>
    <label htmlFor="name">Name</label>
    <input id="name" name="name" />
  </form>
);
```

### useSyncExternalStore for External State
Safely sync with external stores.

```jsx
// Good - external store synchronization
const useOnlineStatus = () => {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
    () => navigator.onLine,
    () => true // Server-side fallback
  );
};

// Usage
const NetworkStatus = () => {
  const isOnline = useOnlineStatus();
  return <div>Status: {isOnline ? 'Online' : 'Offline'}</div>;
};
```

## Advanced Component Patterns

### Compound Components with TypeScript
Type-safe compound component patterns.

```jsx
// Good - modern compound components
interface ToggleContextType {
  on: boolean;
  toggle: () => void;
}

const ToggleContext = createContext<ToggleContextType | null>(null);

const useToggle = () => {
  const context = useContext(ToggleContext);
  if (!context) {
    throw new Error('Toggle components must be used within Toggle');
  }
  return context;
};

interface ToggleProps {
  children: React.ReactNode;
  defaultOn?: boolean;
}

export const Toggle = ({ children, defaultOn = false }: ToggleProps) => {
  const [on, setOn] = useState(defaultOn);
  const toggle = useCallback(() => setOn(prev => !prev), []);
  
  return (
    <ToggleContext.Provider value={{ on, toggle }}>
      {children}
    </ToggleContext.Provider>
  );
};

Toggle.Button = () => {
  const { on, toggle } = useToggle();
  return (
    <button onClick={toggle} aria-pressed={on}>
      {on ? 'ON' : 'OFF'}
    </button>
  );
};

Toggle.Display = () => {
  const { on } = useToggle();
  return <div>Status: {on ? 'Active' : 'Inactive'}</div>;
};
```

### Error Boundaries with Hooks
Modern error handling patterns.

```jsx
// Good - functional error boundary (using library like react-error-boundary)
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

const App = () => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error, errorInfo) => {
      console.error('Error caught:', error, errorInfo);
      // Send to error reporting service
    }}
  >
    <Header />
    <Main />
  </ErrorBoundary>
);

// Custom error hook
const useErrorHandler = () => {
  return useCallback((error: Error) => {
    console.error('Handled error:', error);
    // Report to service
  }, []);
};
```

## Performance Optimization

### React.memo with Comparison Function
Optimize re-renders with custom comparison.

```jsx
// Good - optimized memo
interface UserCardProps {
  user: User;
  onEdit: (id: string) => void;
}

export const UserCard = memo<UserCardProps>(({ user, onEdit }) => {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onEdit(user.id)}>Edit</button>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.onEdit === nextProps.onEdit
  );
});

// Better - use callback stabilization
const UserList = ({ users }: { users: User[] }) => {
  const handleEdit = useCallback((id: string) => {
    // Edit logic
  }, []);
  
  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} onEdit={handleEdit} />
      ))}
    </div>
  );
};
```

### Code Splitting with Concurrent Features
Lazy loading with better UX.

```jsx
// Good - concurrent code splitting
const HeavyComponent = lazy(() => 
  import('./HeavyComponent').then(module => ({
    default: module.HeavyComponent
  }))
);

const App = () => {
  const [showHeavy, setShowHeavy] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const loadHeavyComponent = () => {
    startTransition(() => {
      setShowHeavy(true);
    });
  };
  
  return (
    <div>
      <button onClick={loadHeavyComponent} disabled={isPending}>
        {isPending ? 'Loading...' : 'Load Heavy Component'}
      </button>
      
      {showHeavy && (
        <Suspense fallback={<ComponentSkeleton />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
};
```

## Testing Patterns

### Modern Testing with React 18
Testing concurrent features and Suspense.

```jsx
// Good - testing with concurrent features
import { render, screen, waitFor, act } from '@testing-library/react';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';

describe('SearchComponent', () => {
  test('handles concurrent updates correctly', async () => {
    render(<SearchComponent />);
    
    const input = screen.getByRole('textbox');
    
    // Simulate rapid typing
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } });
    });
    
    // Wait for deferred updates
    await waitFor(() => {
      expect(screen.getByText(/results for "test query"/i)).toBeInTheDocument();
    });
  });
  
  test('shows loading state during transition', async () => {
    render(<SearchComponent />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'slow query' } });
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});

// Testing Suspense boundaries
test('renders fallback during loading', async () => {
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <AsyncComponent />
    </Suspense>
  );
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('Loaded content')).toBeInTheDocument();
  });
});
```

## Best Practices Checklist

### React 18+ Features
- [ ] Use useTransition for non-urgent updates
- [ ] Implement useDeferredValue for heavy computations
- [ ] Leverage Suspense for data fetching
- [ ] Use useId for stable component IDs
- [ ] Implement useSyncExternalStore for external state
- [ ] Consider Server Components for static content
- [ ] Use 'use client' directive only when needed

### Performance
- [ ] Memoize expensive computations with useMemo
- [ ] Stabilize callbacks with useCallback
- [ ] Use React.memo for component optimization
- [ ] Implement code splitting with lazy()
- [ ] Profile with React DevTools Profiler
- [ ] Optimize bundle size and tree shaking

### Code Quality
- [ ] Always use TypeScript for type safety
- [ ] Implement proper error boundaries
- [ ] Write comprehensive tests for concurrent features
- [ ] Follow naming conventions (PascalCase for components)
- [ ] Use ESLint rules for React hooks
- [ ] Handle loading and error states consistently