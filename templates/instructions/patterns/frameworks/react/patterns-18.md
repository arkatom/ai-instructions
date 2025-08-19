# React v18 Functional Programming Patterns

Modern purely functional React patterns leveraging React v18 concurrent features with absolute functional programming compliance.

## 🚨 FUNCTIONAL PROGRAMMING MANDATE

**ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:**
- All functions MUST be arrow functions
- Functional programming is MANDATORY, not optional
- Immutability is REQUIRED for all data structures
- Pure functions with no side effects are MANDATORY
- Functional components ONLY - no class components

## ❌ ABSOLUTELY FORBIDDEN

The following practices are **COMPLETELY BANNED** and will result in immediate rejection:

- ❌ **Function declarations** (`function name() {}`) - Use arrow functions ONLY
- ❌ **`any` type** - Use proper TypeScript typing
- ❌ **Type assertions** (`as Type`) - Use type guards instead
- ❌ **Class components** - Use functional components ONLY
- ❌ **Mutable state** - Use immutable state patterns
- ❌ **Side effects in render** - Keep components pure
- ❌ **Object-oriented patterns** - Use functional patterns only

## 🔧 FUNCTIONAL PRINCIPLES

### 1. Pure Functional Components
Components must be pure functions that render the same output for the same props.

### 2. Immutable State Management
All state updates must be immutable.

### 3. Functional Composition
Build complex UIs by composing simple functional components.

### 4. Side Effect Isolation
Use hooks to isolate side effects from pure component logic.

## React v18 Functional Concurrent Features

### Functional useTransition for Non-Urgent Updates
Mark state updates as non-urgent to keep UI responsive using pure functional patterns.

```jsx
const SearchComponent = () => {
  const [isPending, startTransition] = useTransition();
  const [searchResults, setSearchResults] = useState<readonly User[]>([]);
  const [query, setQuery] = useState('');
  
  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery); // Urgent update
    startTransition(() => {
      // Non-urgent update - won't block UI
      setSearchResults(performHeavySearch(newQuery));
    });
  }, []);
  
  const renderResults = useMemo(() => (
    <Results data={searchResults} />
  ), [searchResults]);
  
  return (
    <div>
      <input 
        value={query} 
        onChange={e => handleSearch(e.target.value)} 
      />
      {isPending ? <Spinner /> : renderResults}
    </div>
  );
};
```

### Functional useDeferredValue for Debounced Updates
Defer non-critical updates until more urgent ones complete using functional patterns.

```jsx
const SearchResults = () => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  
  const results = useMemo(() => 
    searchDatabase(deferredQuery), [deferredQuery]
  );
  
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);
  
  const renderResults = useMemo(() => 
    results.map(item => <Item key={item.id} {...item} />), 
    [results]
  );
  
  return (
    <div>
      <input value={query} onChange={handleQueryChange} />
      <div className={query !== deferredQuery ? 'dimmed' : ''}>
        {renderResults}
      </div>
    </div>
  );
};
```

### Functional Enhanced Suspense for Data Fetching
Use Suspense with concurrent features for better UX using functional patterns.

```jsx
const UserProfile = ({ userId }: { userId: string }) => {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserData userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  );
};

// Functional streaming SSR component
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

## Functional Server Components (Next.js 13+)

### Functional Server vs Client Components
Clear separation between server and client rendering using functional patterns.

```jsx
// Functional Server Component (no 'use client')
const HomePage = async () => {
  const posts = await fetchPosts(); // Direct DB/API calls
  
  const renderPosts = useMemo(() => 
    posts.map(post => <PostCard key={post.id} post={post} />), 
    [posts]
  );
  
  return (
    <div>
      <h1>Posts</h1>
      {renderPosts}
    </div>
  );
};

// Functional Client Component for interactivity
'use client';
const InteractiveButton = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);
  
  const handleClick = useCallback(() => {
    setCount(prevCount => prevCount + 1);
  }, []);
  
  return (
    <button onClick={handleClick}>
      {children} ({count})
    </button>
  );
};
```

## Functional Modern State Management (React v18)

### Functional useId for Stable IDs
Generate stable unique IDs for accessibility using functional patterns.

```jsx
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
```

### Functional useSyncExternalStore for External State
Safely sync with external stores using functional patterns.

```jsx
const useOnlineStatus = () => {
  return useSyncExternalStore(
    useCallback((callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    }, []),
    () => navigator.onLine,
    () => true // Server-side fallback
  );
};

const NetworkStatus = () => {
  const isOnline = useOnlineStatus();
  return <div>Status: {isOnline ? 'Online' : 'Offline'}</div>;
};
```

## Functional Compound Component Patterns

### Functional TypeScript Compound Components
Type-safe compound component patterns using functional approach.

```jsx
interface ToggleContextType {
  readonly on: boolean;
  readonly toggle: () => void;
}

const ToggleContext = createContext<ToggleContextType | null>(null);

const useToggle = (): ToggleContextType => {
  const context = useContext(ToggleContext);
  if (!context) {
    throw new Error('Toggle components must be used within Toggle');
  }
  return context;
};

interface ToggleProps {
  readonly children: React.ReactNode;
  readonly defaultOn?: boolean;
}

export const Toggle = ({ children, defaultOn = false }: ToggleProps) => {
  const [on, setOn] = useState(defaultOn);
  const toggle = useCallback(() => setOn(prev => !prev), []);
  
  const contextValue = useMemo(() => ({ on, toggle }), [on, toggle]);
  
  return (
    <ToggleContext.Provider value={contextValue}>
      {children}
    </ToggleContext.Provider>
  );
};

const ToggleButton = () => {
  const { on, toggle } = useToggle();
  return (
    <button onClick={toggle} aria-pressed={on}>
      {on ? 'ON' : 'OFF'}
    </button>
  );
};

const ToggleDisplay = () => {
  const { on } = useToggle();
  return <div>Status: {on ? 'Active' : 'Inactive'}</div>;
};

// Functional compound component assignment
Toggle.Button = ToggleButton;
Toggle.Display = ToggleDisplay;
```

## Functional Performance Optimization

### Functional React.memo with Custom Comparison
Optimize re-renders with custom comparison using functional patterns.

```jsx
interface UserCardProps {
  readonly user: User;
  readonly onEdit: (id: string) => void;
}

export const UserCard = memo<UserCardProps>(({ user, onEdit }) => {
  const handleEdit = useCallback(() => {
    onEdit(user.id);
  }, [user.id, onEdit]);
  
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={handleEdit}>Edit</button>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.onEdit === nextProps.onEdit
  );
});

const UserList = ({ users }: { readonly users: readonly User[] }) => {
  const handleEdit = useCallback((id: string) => {
    // Edit logic - pure functional implementation
  }, []);
  
  const renderUsers = useMemo(() =>
    users.map(user => (
      <UserCard key={user.id} user={user} onEdit={handleEdit} />
    )), [users, handleEdit]
  );
  
  return <div>{renderUsers}</div>;
};
```

### Functional Code Splitting with Concurrent Features
Lazy loading with better UX using functional patterns.

```jsx
const HeavyComponent = lazy(() => 
  import('./HeavyComponent').then(module => ({
    default: module.HeavyComponent
  }))
);

const App = () => {
  const [showHeavy, setShowHeavy] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const loadHeavyComponent = useCallback(() => {
    startTransition(() => {
      setShowHeavy(true);
    });
  }, []);
  
  const renderHeavyComponent = useMemo(() => (
    showHeavy && (
      <Suspense fallback={<ComponentSkeleton />}>
        <HeavyComponent />
      </Suspense>
    )
  ), [showHeavy]);
  
  return (
    <div>
      <button onClick={loadHeavyComponent} disabled={isPending}>
        {isPending ? 'Loading...' : 'Load Heavy Component'}
      </button>
      {renderHeavyComponent}
    </div>
  );
};
```

## Functional Module Best Practices

### Functional Named Exports Principle (with Exceptions)
Prefer named exports as a principle, allow default exports for specific cases.

```jsx
// ✅ Principle: Functional named exports
export const UserService = () => { /* ... */ };
export const AuthService = () => { /* ... */ };

// ✅ Exception: App components (main entry points)
const App = () => {
  return <div>Main App</div>;
};

export default App;

// ✅ Exception: Next.js page components  
const HomePage = () => {
  return <div>Home Page</div>;
};

export default HomePage;

// ✅ Exception: Components for dynamic imports
const LazyComponent = lazy(() => import('./ComponentRequiringDefault'));
```

## Functional Testing (React v18)

### Functional Testing Concurrent Features
Testing React v18 concurrent features and Suspense using functional patterns.

```jsx
import { render, screen, waitFor, act } from '@testing-library/react';

const testSearchComponent = () => {
  test('handles concurrent updates correctly', async () => {
    render(<SearchComponent />);
    
    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } });
    });
    
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
};

const testSuspenseComponent = () => {
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
};

// Export functional test suites
export { testSearchComponent, testSuspenseComponent };
```

## React v18 Functional Programming Checklist

### Mandatory Functional Concurrent Features
- [ ] Use useTransition for non-urgent updates with functional patterns
- [ ] Implement useDeferredValue for heavy computations functionally
- [ ] Leverage Suspense for data fetching with functional components
- [ ] Use useId for stable component IDs in functional components
- [ ] Implement useSyncExternalStore for external state functionally

### Functional Server Components
- [ ] Consider Server Components for static content with functional patterns
- [ ] Use 'use client' directive only when needed in functional components
- [ ] Clearly separate server and client boundaries functionally

### Functional Performance
- [ ] Memoize expensive computations with useMemo functionally
- [ ] Stabilize callbacks with useCallback in functional components
- [ ] Use React.memo for functional component optimization
- [ ] Implement code splitting with lazy() for functional components

### Mandatory Functional Code Quality
- [ ] ALL functions are arrow functions (FORBIDDEN: function declarations)
- [ ] Always use TypeScript for type safety in functional components
- [ ] Implement proper error boundaries functionally
- [ ] Write comprehensive tests for concurrent features functionally
- [ ] Follow functional naming conventions (PascalCase for components)
- [ ] Use ESLint rules for React hooks in functional components
- [ ] ALL data structures are immutable (MANDATORY)
- [ ] ALL components are pure functions (MANDATORY)

### Functional Architecture
- [ ] Replace any remaining class components with functional components
- [ ] Use functional composition over inheritance patterns
- [ ] Implement functional dependency injection in React
- [ ] Design purely functional component hierarchies
- [ ] Prefer named exports, use default exports for exceptions only

**Appropriate Score: 1/10** - This represents the absolute dedication to functional programming in React v18 with zero tolerance for imperative or object-oriented patterns.