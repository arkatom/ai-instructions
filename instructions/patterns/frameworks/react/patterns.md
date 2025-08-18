# Reactパターン

## コンポーネントパターン

### 複合コンポーネント
プロップドリリングなしでコンポーネント間で状態を共有。

```jsx
// 良い例
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
  return <button onClick={toggle}>{on ? 'オン' : 'オフ'}</button>;
};

// 悪い例 - プロップドリリング
function Toggle({ on, onToggle, buttonText }) {
  return <button onClick={onToggle}>{buttonText}</button>;
}
```

### レンダープロップ
関数を値とするプロップを使用してコンポーネント間でコードを共有。

```jsx
// 良い例
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

// 使用例
<MouseTracker render={({ x, y }) => <div>マウス位置: {x}, {y}</div>} />
```

## 状態管理

### カスタムフック
コンポーネントロジックを再利用可能な関数に抽出。

```jsx
// 良い例
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);
  
  return { count, increment, decrement, reset };
}

// 悪い例 - コンポーネント内にロジック
function Counter() {
  const [count, setCount] = useState(0);
  // UIとロジックが混在
  return <div>...</div>;
}
```

### グローバル状態のContext
Context APIを使用してコンポーネント間で状態を共有。

```jsx
// 良い例
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
  if (!context) throw new Error('useThemeはThemeProvider内で使用してください');
  return context;
}
```

## パフォーマンス最適化

### メモ化
不要な再レンダリングを防止。

```jsx
// 良い例
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* 複雑なレンダリング */}</div>;
});

function Parent() {
  const memoizedValue = useMemo(() => computeExpensive(data), [data]);
  const memoizedCallback = useCallback(() => doSomething(id), [id]);
  
  return <ExpensiveComponent data={memoizedValue} onClick={memoizedCallback} />;
}

// 悪い例 - 毎回再作成
function Parent() {
  const value = computeExpensive(data); // 毎レンダリング実行
  const callback = () => doSomething(id); // 毎回新しい関数
  
  return <ExpensiveComponent data={value} onClick={callback} />;
}
```

### コード分割
必要な時だけコンポーネントを読み込み。

```jsx
// 良い例
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}

// 悪い例 - 全て事前読み込み
import HeavyComponent from './HeavyComponent';
```

## フォーム処理

### 制御コンポーネント
Reactがフォームデータを制御。

```jsx
// 良い例
function Form() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // formDataを処理
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={formData.name} onChange={handleChange} />
      <input name="email" value={formData.email} onChange={handleChange} />
    </form>
  );
}
```

## エラー処理

### エラーバウンダリ
コンポーネントツリー内のJavaScriptエラーをキャッチ。

```jsx
// 良い例
class ErrorBoundary extends Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    console.error('エラーキャッチ:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>エラーが発生しました。</h1>;
    }
    return this.props.children;
  }
}

// 使用例
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

## ベストプラクティスチェックリスト

- [ ] 関数コンポーネントとフックを使用
- [ ] コンポーネントを小さく焦点を絞る
- [ ] 再利用可能なロジックはカスタムフックに抽出
- [ ] 高コストな計算をメモ化
- [ ] リストには適切なkeyプロップを使用
- [ ] ローディングとエラー状態を処理
- [ ] エラーバウンダリを実装
- [ ] TypeScriptで型安全性を確保
- [ ] 命名規則に従う（コンポーネントはPascalCase）
- [ ] React Testing Libraryでテスト