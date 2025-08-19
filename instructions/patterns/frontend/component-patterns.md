# Component Design Patterns

Reusable component architecture patterns for modern frontend development.

## Component Organization

### Feature-Based Structure (推奨)
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

## Modern UI Libraries (2024)

### shadcn/ui Pattern (Copy & Paste UI)
```typescript
// コンポーネントをプロジェクトに直接コピー
// components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

### Radix UI Primitives (アクセシブルなプリミティブ)
```typescript
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';

// アクセシブルなダイアログ
<Dialog.Root>
  <Dialog.Trigger asChild>
    <button>開く</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
    <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <Dialog.Title>タイトル</Dialog.Title>
      <Dialog.Description>説明文</Dialog.Description>
      <Dialog.Close>閉じる</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Server Components Pattern (Next.js 14+)
```typescript
// app/products/page.tsx - Server Component
async function ProductsPage() {
  // サーバーサイドでデータ取得
  const products = await fetch('https://api.example.com/products', {
    cache: 'no-store' // または 'force-cache' でキャッシュ
  }).then(res => res.json());
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// components/ProductCard.tsx - Client Component
'use client';

import { useState } from 'react';

export function ProductCard({ product }) {
  const [liked, setLiked] = useState(false);
  
  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={() => setLiked(!liked)}>
        {liked ? '❤️' : '🤍'}
      </button>
    </div>
  );
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