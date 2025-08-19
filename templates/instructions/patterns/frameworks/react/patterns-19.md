# React 19 Patterns

Modern React patterns leveraging React 19's latest features and the use hook (React 19 specific).

## React 19 New Features

### use Hook - Promise/Context Integration
The new hook for directly "using" Promises, Contexts, and other resources.

```jsx
// Promise with use hook
const UserProfile = ({ userId }: { userId: string }) => {
  // Directly use a Promise
  const user = use(fetchUser(userId));
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};

// Automatically handled within Suspense boundaries
const App = () => (
  <Suspense fallback={<div>Loading user...</div>}>
    <UserProfile userId="123" />
  </Suspense>
);

// Conditional Promise usage
const ConditionalData = ({ shouldLoad, dataId }: { shouldLoad: boolean; dataId: string }) => {
  let data = null;
  
  if (shouldLoad) {
    // use hook can be used conditionally
    data = use(fetchData(dataId));
  }
  
  return (
    <div>
      {data ? <DataDisplay data={data} /> : <div>No data</div>}
    </div>
  );
};
```

### use with Context - Dynamic Context
Using the use hook as an alternative to useContext.

```jsx
const ThemeContext = createContext<'light' | 'dark'>('light');
const UserContext = createContext<User | null>(null);

const DynamicConsumer = ({ useTheme, useUser }: { useTheme: boolean; useUser: boolean }) => {
  // Conditionally use contexts
  const theme = useTheme ? use(ThemeContext) : 'light';
  const user = useUser ? use(UserContext) : null;
  
  return (
    <div className={`theme-${theme}`}>
      {user ? `Hello, ${user.name}` : 'Guest user'}
    </div>
  );
};

// Conditional context usage impossible with traditional useContext
const FlexibleComponent = ({ mode }: { mode: 'simple' | 'advanced' }) => {
  const baseTheme = use(ThemeContext);
  
  if (mode === 'simple') {
    return <div className={baseTheme}>Simple mode</div>;
  }
  
  // Only use UserContext in advanced mode
  const user = use(UserContext);
  return (
    <div className={baseTheme}>
      Advanced mode - {user?.name || 'Unknown'}
    </div>
  );
};
```

### use Hook with Data Fetching Integration
SWR/TanStack Query-like patterns with use hook.

```jsx
// Custom Promise factory
const createDataFetcher = (url: string) => {
  let promise: Promise<any> | null = null;
  
  return () => {
    if (!promise) {
      promise = fetch(url).then(res => res.json());
    }
    return promise;
  };
};

const PostList = () => {
  const getPosts = createDataFetcher('/api/posts');
  const posts = use(getPosts());
  
  return (
    <div>
      {posts.map((post: any) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
};

// Error handling with use
const SafeDataComponent = ({ dataUrl }: { dataUrl: string }) => {
  try {
    const data = use(fetch(dataUrl).then(r => r.json()));
    return <DataDisplay data={data} />;
  } catch (error) {
    if (error instanceof Promise) {
      // Still pending - Suspense will handle
      throw error;
    }
    // Actual error
    return <ErrorDisplay error={error} />;
  }
};
```

## React 19 Enhanced Concurrent Features

### useTransition with React 19 improvements
useTransition enhanced in React 19.

```jsx
const EnhancedSearch = () => {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  
  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    
    startTransition(() => {
      // React 19 automatically provides more efficient concurrent processing
      const results = use(searchAPI(newQuery));
      updateSearchResults(results);
    });
  };
  
  return (
    <div>
      <input 
        value={query} 
        onChange={e => handleSearch(e.target.value)}
        disabled={isPending}
      />
      {isPending && <SearchSpinner />}
    </div>
  );
};
```

### Suspense with Resource Loading
More flexible Suspense patterns in React 19.

```jsx
const ResourcefulComponent = ({ resourceId }: { resourceId: string }) => {
  // Fetch multiple resources concurrently
  const userData = use(fetchUser(resourceId));
  const userPosts = use(fetchUserPosts(resourceId));
  const userFollowers = use(fetchUserFollowers(resourceId));
  
  return (
    <div>
      <UserCard user={userData} />
      <PostGrid posts={userPosts} />
      <FollowersList followers={userFollowers} />
    </div>
  );
};

// Partial Suspense boundaries
const ProfilePage = ({ userId }: { userId: string }) => (
  <div>
    <Suspense fallback={<UserSkeleton />}>
      <BasicUserInfo userId={userId} />
    </Suspense>
    
    <Suspense fallback={<PostsSkeleton />}>
      <UserPosts userId={userId} />
    </Suspense>
    
    <Suspense fallback={<SocialSkeleton />}>
      <SocialConnections userId={userId} />
    </Suspense>
  </div>
);
```

## Form Handling (React 19)

### Actions with useFormStatus
React 19's new form handling capabilities.

```jsx
const ContactForm = () => {
  const submitAction = async (formData: FormData) => {
    'use server'; // Server action
    
    const name = formData.get('name');
    const email = formData.get('email');
    
    await submitContactForm({ name, email });
  };
  
  return (
    <form action={submitAction}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <SubmitButton />
    </form>
  );
};

const SubmitButton = () => {
  const { pending } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
};
```

### useOptimistic - Optimistic Updates
Optimistic UI update patterns.

```jsx
const TodoList = ({ todos }: { todos: Todo[] }) => {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );
  
  const handleAddTodo = async (text: string) => {
    const newTodo = { id: Date.now(), text, completed: false };
    
    // Optimistic update
    addOptimisticTodo(newTodo);
    
    try {
      await addTodoAPI(newTodo);
    } catch (error) {
      // Automatically rolls back on error
      console.error('Failed to add todo:', error);
    }
  };
  
  return (
    <div>
      {optimisticTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
      <AddTodoForm onAdd={handleAddTodo} />
    </div>
  );
};
```

## Error Boundaries (React 19)

### Enhanced Error Handling
More flexible error boundaries in React 19.

```jsx
const AsyncErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <div>
          <h2>Something went wrong</h2>
          <details>
            <summary>Details</summary>
            <pre>{error.message}</pre>
          </details>
          <button onClick={retry}>Retry</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        // React 19 also catches async errors
        console.error('Error caught:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Error handling combined with use
const RobustDataComponent = ({ dataId }: { dataId: string }) => {
  const fetchWithRetry = useCallback(async () => {
    const maxRetries = 3;
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fetchData(dataId);
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
    }
    throw lastError;
  }, [dataId]);
  
  const data = use(fetchWithRetry());
  
  return <DataDisplay data={data} />;
};
```

## Module Best Practices (React 19 Compatible)

### Named Exports Principle (React 19 Edition)
Realistic export strategy for React 19 environments.

```jsx
// ✅ Principle: Named exports (library components)
export const Button = ({ children, ...props }: ButtonProps) => (
  <button {...props}>{children}</button>
);

export const Input = ({ label, ...props }: InputProps) => (
  <div>
    <label>{label}</label>
    <input {...props} />
  </div>
);

// ✅ Exception 1: Next.js App Router pages
export default function HomePage() {
  return <div>Home Page</div>;
}

// ✅ Exception 2: Server actions
export default async function handleFormSubmit(formData: FormData) {
  'use server';
  // Server action processing
}

// ✅ Exception 3: Lazy loading targets
const HeavyChart = lazy(() => import('./HeavyChart')); // expects default export

// ✅ Exception 4: use hook with dynamic imports
const DynamicResourceUser = ({ resourceType }: { resourceType: string }) => {
  const getResource = useCallback(async () => {
    const module = await import(`./resources/${resourceType}`);
    return module.default; // default export needed
  }, [resourceType]);
  
  const resource = use(getResource());
  return <ResourceDisplay resource={resource} />;
};
```

## Testing (React 19)

### Testing use Hook
Testing React 19's use hook and new features.

```jsx
import { render, screen, waitFor } from '@testing-library/react';

describe('React 19 use hook', () => {
  test('correctly fetches data from Promise', async () => {
    const mockData = { id: 1, name: 'Test User' };
    const mockPromise = Promise.resolve(mockData);
    
    const TestComponent = () => {
      const data = use(mockPromise);
      return <div>{data.name}</div>;
    };
    
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <TestComponent />
      </Suspense>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });
  
  test('conditional use hook behavior', async () => {
    const TestComponent = ({ shouldLoad }: { shouldLoad: boolean }) => {
      if (shouldLoad) {
        const data = use(Promise.resolve('Loaded Data'));
        return <div>{data}</div>;
      }
      return <div>No Data</div>;
    };
    
    const { rerender } = render(
      <Suspense fallback={<div>Loading...</div>}>
        <TestComponent shouldLoad={false} />
      </Suspense>
    );
    
    expect(screen.getByText('No Data')).toBeInTheDocument();
    
    rerender(
      <Suspense fallback={<div>Loading...</div>}>
        <TestComponent shouldLoad={true} />
      </Suspense>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Loaded Data')).toBeInTheDocument();
    });
  });
});

// Testing form features
describe('React 19 Forms', () => {
  test('useFormStatus correctly shows form state', async () => {
    const mockSubmit = jest.fn();
    
    const TestForm = () => (
      <form action={mockSubmit}>
        <input name="test" />
        <SubmitButton />
      </form>
    );
    
    render(<TestForm />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(button).toBeDisabled();
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });
});
```

## React 19 Best Practices Checklist

### New Features
- [ ] Use use hook for Promise handling
- [ ] Leverage conditional hook usage with use
- [ ] Consider use for Context reading
- [ ] Implement useFormStatus for form handling
- [ ] Use useOptimistic for optimistic updates

### Performance
- [ ] Leverage use for concurrent resource fetching
- [ ] Properly split Suspense boundaries
- [ ] Handle async errors with error boundaries
- [ ] Use useTransition for heavy processing

### Code Quality
- [ ] Use TypeScript with use hook type-safely
- [ ] Implement comprehensive error handling
- [ ] Write comprehensive tests for new features
- [ ] Properly leverage server actions
- [ ] Implement optimistic updates for better UX

### Module Management
- [ ] Prefer named exports, use default exports when necessary
- [ ] Use default exports for server actions
- [ ] Choose appropriate export format for dynamic imports