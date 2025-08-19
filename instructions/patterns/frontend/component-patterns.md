# Component Design Patterns

Reusable component architecture patterns for modern frontend development.

## Component Organization

### Atomic Design
```
atoms/
  Button.tsx
  Input.tsx
  Label.tsx

molecules/
  FormField.tsx
  SearchBar.tsx
  Card.tsx

organisms/
  Header.tsx
  LoginForm.tsx
  ProductList.tsx

templates/
  PageLayout.tsx
  DashboardTemplate.tsx

pages/
  HomePage.tsx
  ProfilePage.tsx
```

### Feature-Based Structure
```
features/
  auth/
    components/
      LoginForm.tsx
      RegisterForm.tsx
    hooks/
      useAuth.ts
    services/
      authService.ts
  
  products/
    components/
      ProductCard.tsx
      ProductList.tsx
    hooks/
      useProducts.ts
```

## Composition Patterns

### Compound Components
```typescript
// Compound component pattern
interface TabsComposition {
  List: typeof TabsList;
  Tab: typeof TabsTab;
  Panels: typeof TabsPanels;
  Panel: typeof TabsPanel;
}

const Tabs: React.FC<TabsProps> & TabsComposition = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

// Usage
<Tabs>
  <Tabs.List>
    <Tabs.Tab>Profile</Tabs.Tab>
    <Tabs.Tab>Settings</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panels>
    <Tabs.Panel>Profile content</Tabs.Panel>
    <Tabs.Panel>Settings content</Tabs.Panel>
  </Tabs.Panels>
</Tabs>
```

### Render Props
```typescript
interface DataFetcherProps<T> {
  url: string;
  children: (data: T | null, loading: boolean, error: Error | null) => React.ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);
  
  return <>{children(data, loading, error)}</>;
}
```

## Props Patterns

### Discriminated Unions
```typescript
type ButtonProps = 
  | { variant: 'link'; href: string; onClick?: never }
  | { variant: 'button'; onClick: () => void; href?: never };

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>Link</a>;
  }
  return <button onClick={props.onClick}>Button</button>;
}
```

### Prop Spreading & Rest
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

function Button({ variant = 'primary', size = 'md', ...rest }: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant} btn-${size}`}
      {...rest}
    />
  );
}
```

## State Management Patterns

### Local State Lifting
```typescript
// Parent manages shared state
function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  
  const addTodo = (text: string) => {
    setTodos([...todos, { id: Date.now(), text, done: false }]);
  };
  
  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    ));
  };
  
  return (
    <>
      <TodoInput onAdd={addTodo} />
      <TodoList todos={todos} onToggle={toggleTodo} />
    </>
  );
}
```

### Controlled vs Uncontrolled
```typescript
// Controlled component
function ControlledInput() {
  const [value, setValue] = useState('');
  
  return (
    <input 
      value={value} 
      onChange={e => setValue(e.target.value)} 
    />
  );
}

// Uncontrolled component
function UncontrolledInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = () => {
    console.log(inputRef.current?.value);
  };
  
  return <input ref={inputRef} />;
}
```

## Higher-Order Components

### HOC Pattern
```typescript
function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    const { user } = useAuth();
    
    if (!user) {
      return <Navigate to="/login" />;
    }
    
    return <Component {...props} />;
  };
}

// Usage
const ProtectedProfile = withAuth(Profile);
```

## Polymorphic Components

### As Prop Pattern
```typescript
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<E>;

function Box<E extends React.ElementType = 'div'>({
  as,
  children,
  ...props
}: PolymorphicProps<E>) {
  const Component = as || 'div';
  return <Component {...props}>{children}</Component>;
}

// Usage
<Box as="section" className="container">
  <Box as="h1">Title</Box>
</Box>
```

## Error Boundaries

### Error Handling Pattern
```typescript
class ErrorBoundary extends React.Component<
  { fallback: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

## Checklist
- [ ] Choose component structure
- [ ] Implement composition patterns
- [ ] Define prop interfaces
- [ ] Handle component state
- [ ] Add error boundaries
- [ ] Create reusable components
- [ ] Document component API