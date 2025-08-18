# React Patterns

## Component Patterns

### Compound Components
Share state between components without prop drilling.

```jsx
// Good
function Toggle({ children }) {
  const [on, setOn] = useState(false);
  const toggle = () => setOn(!on);
  
  return (
    <ToggleContext.Provider value={{ on, toggle }}>
      {children}
    </ToggleContext.Provider>
  );
}

Toggle.Button = function ToggleButton() {
  const { on, toggle } = useContext(ToggleContext);
  return <button onClick={toggle}>{on ? 'ON' : 'OFF'}</button>;
};

// Bad - prop drilling
function Toggle({ on, onToggle, buttonText }) {
  return <button onClick={onToggle}>{buttonText}</button>;
}
```

### Render Props
Share code between components using a prop whose value is a function.

```jsx
// Good
function MouseTracker({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return render(position);
}

// Usage
<MouseTracker render={({ x, y }) => <div>Mouse at {x}, {y}</div>} />
```

## State Management

### Custom Hooks
Extract component logic into reusable functions.

```jsx
// Good
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);
  
  return { count, increment, decrement, reset };
}

// Bad - logic in component
function Counter() {
  const [count, setCount] = useState(0);
  // Logic mixed with UI
  return <div>...</div>;
}
```

### Context for Global State
Use Context API for cross-component state sharing.

```jsx
// Good
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Performance Optimization

### Memoization
Prevent unnecessary re-renders.

```jsx
// Good
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>;
});

function Parent() {
  const memoizedValue = useMemo(() => computeExpensive(data), [data]);
  const memoizedCallback = useCallback(() => doSomething(id), [id]);
  
  return <ExpensiveComponent data={memoizedValue} onClick={memoizedCallback} />;
}

// Bad - recreating on every render
function Parent() {
  const value = computeExpensive(data); // Runs every render
  const callback = () => doSomething(id); // New function every render
  
  return <ExpensiveComponent data={value} onClick={callback} />;
}
```

### Code Splitting
Load components only when needed.

```jsx
// Good
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}

// Bad - loading everything upfront
import HeavyComponent from './HeavyComponent';
```

## Form Handling

### Controlled Components
React controls form data.

```jsx
// Good
function Form() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Process formData
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={formData.name} onChange={handleChange} />
      <input name="email" value={formData.email} onChange={handleChange} />
    </form>
  );
}
```

## Error Handling

### Error Boundaries
Catch JavaScript errors in component tree.

```jsx
// Good
class ErrorBoundary extends Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    console.error('Error caught:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

## Best Practices Checklist

- [ ] Use functional components with hooks
- [ ] Keep components small and focused
- [ ] Extract custom hooks for reusable logic
- [ ] Memoize expensive computations
- [ ] Use proper key props in lists
- [ ] Handle loading and error states
- [ ] Implement error boundaries
- [ ] Use TypeScript for type safety
- [ ] Follow naming conventions (PascalCase for components)
- [ ] Test components with React Testing Library