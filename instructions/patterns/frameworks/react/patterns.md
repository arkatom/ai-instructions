# Reactパターン

React 18+機能を活用した同期的で高性能なアプリケーションのモダンReactパターン。

## React 18 並行機能

### useTransition - 緊急でない更新
状態更新を緊急でないものとしてマークしてUIの応答性を保つ。

```jsx
// 良い例 - React 18 並行機能
const searchUsers = (query: string) => {
  const [isPending, startTransition] = useTransition();
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  
  const handleSearch = (newQuery: string) => {
    setQuery(newQuery); // 緊急更新
    startTransition(() => {
      // 緊急でない更新 - UIをブロックしない
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

// 悪い例 - ブロッキング更新
const handleSearch = (query: string) => {
  setQuery(query);
  setSearchResults(performHeavySearch(query)); // UIをブロック
};
```

### useDeferredValue - 遅延更新
より緊急な更新が完了するまで重要でない更新を遅延。

```jsx
// 良い例 - 遅延レンダリング
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

### 拡張Suspense - データフェッチング
より良いUXのため並行機能と組み合わせてSuspenseを使用。

```jsx
// 良い例 - React 18 Suspenseパターン
const UserProfile = ({ userId }: { userId: string }) => {
  return (
    <Suspense 
      fallback={<ProfileSkeleton />}
      unstable_avoidThisFallback={true} // 古いコンテンツを優先
    >
      <UserData userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  );
};

// ストリーミングSSRコンポーネント
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

## サーバーコンポーネント（Next.js 13+）

### サーバー vs クライアントコンポーネント
サーバーとクライアントレンダリングの明確な分離。

```jsx
// 良い例 - サーバーコンポーネント（'use client'なし）
// app/page.tsx - サーバーで実行
const HomePage = async () => {
  const posts = await fetchPosts(); // 直接DB/API呼び出し
  
  return (
    <div>
      <h1>投稿</h1>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

// インタラクティブ機能のクライアントコンポーネント
'use client';
const InteractiveButton = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(c => c + 1)}>
      {children} ({count})
    </button>
  );
};

// 悪い例 - クライアントコンポーネントでサーバーロジック混在
'use client';
const BadComponent = () => {
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    // これはサーバーコンポーネントで行うべき
    fetchPosts().then(setPosts);
  }, []);
  
  return <div>...</div>;
};
```

## モダン状態管理

### useId - 安定ID
アクセシビリティのための安定したユニークIDを生成。

```jsx
// 良い例 - フォームラベル用useId
const ContactForm = () => {
  const nameId = useId();
  const emailId = useId();
  
  return (
    <form>
      <label htmlFor={nameId}>名前</label>
      <input id={nameId} name="name" />
      
      <label htmlFor={emailId}>メール</label>
      <input id={emailId} name="email" type="email" />
    </form>
  );
};

// 悪い例 - ハードコードID（SSR不一致）
const BadForm = () => (
  <form>
    <label htmlFor="name">名前</label>
    <input id="name" name="name" />
  </form>
);
```

### useSyncExternalStore - 外部状態
外部ストアと安全に同期。

```jsx
// 良い例 - 外部ストア同期
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
    () => true // サーバーサイドフォールバック
  );
};

// 使用例
const NetworkStatus = () => {
  const isOnline = useOnlineStatus();
  return <div>状態: {isOnline ? 'オンライン' : 'オフライン'}</div>;
};
```

## 高度なコンポーネントパターン

### TypeScript複合コンポーネント
型安全な複合コンポーネントパターン。

```jsx
// 良い例 - モダン複合コンポーネント
interface ToggleContextType {
  on: boolean;
  toggle: () => void;
}

const ToggleContext = createContext<ToggleContextType | null>(null);

const useToggle = () => {
  const context = useContext(ToggleContext);
  if (!context) {
    throw new Error('Toggleコンポーネントは Toggle 内で使用してください');
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
      {on ? 'オン' : 'オフ'}
    </button>
  );
};

Toggle.Display = () => {
  const { on } = useToggle();
  return <div>状態: {on ? 'アクティブ' : '非アクティブ'}</div>;
};
```

### フック型エラーバウンダリ
モダンエラー処理パターン。

```jsx
// 良い例 - 関数型エラーバウンダリ（react-error-boundaryライブラリ使用）
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert">
    <h2>エラーが発生しました：</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>再試行</button>
  </div>
);

const App = () => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error, errorInfo) => {
      console.error('エラーキャッチ:', error, errorInfo);
      // エラー報告サービスに送信
    }}
  >
    <Header />
    <Main />
  </ErrorBoundary>
);

// カスタムエラーフック
const useErrorHandler = () => {
  return useCallback((error: Error) => {
    console.error('処理されたエラー:', error);
    // サービスに報告
  }, []);
};
```

## パフォーマンス最適化

### カスタム比較関数付きReact.memo
カスタム比較で再レンダリングを最適化。

```jsx
// 良い例 - 最適化memo
interface UserCardProps {
  user: User;
  onEdit: (id: string) => void;
}

export const UserCard = memo<UserCardProps>(({ user, onEdit }) => {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onEdit(user.id)}>編集</button>
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.onEdit === nextProps.onEdit
  );
});

// より良い - コールバック安定化使用
const UserList = ({ users }: { users: User[] }) => {
  const handleEdit = useCallback((id: string) => {
    // 編集ロジック
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

### 並行機能付きコード分割
より良いUXでの遅延読み込み。

```jsx
// 良い例 - 並行コード分割
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
        {isPending ? '読み込み中...' : '重いコンポーネントを読み込み'}
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

## テストパターン

### React 18対応モダンテスト
並行機能とSuspenseのテスト。

```jsx
// 良い例 - 並行機能テスト
import { render, screen, waitFor, act } from '@testing-library/react';

describe('SearchComponent', () => {
  test('並行更新を正しく処理', async () => {
    render(<SearchComponent />);
    
    const input = screen.getByRole('textbox');
    
    // 高速タイピングシミュレート
    await act(async () => {
      fireEvent.change(input, { target: { value: 'テストクエリ' } });
    });
    
    // 遅延更新を待機
    await waitFor(() => {
      expect(screen.getByText(/「テストクエリ」の結果/i)).toBeInTheDocument();
    });
  });
  
  test('トランジション中のローディング状態表示', async () => {
    render(<SearchComponent />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '重いクエリ' } });
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});

// Suspenseバウンダリのテスト
test('読み込み中にフォールバックレンダリング', async () => {
  render(
    <Suspense fallback={<div>読み込み中...</div>}>
      <AsyncComponent />
    </Suspense>
  );
  
  expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('読み込み済みコンテンツ')).toBeInTheDocument();
  });
});
```

## ベストプラクティスチェックリスト

### React 18+機能
- [ ] 緊急でない更新にuseTransitionを使用
- [ ] 重い計算にuseDeferredValueを実装
- [ ] データフェッチにSuspenseを活用
- [ ] 安定したコンポーネントIDにuseIdを使用
- [ ] 外部状態にuseSyncExternalStoreを実装
- [ ] 静的コンテンツにサーバーコンポーネントを検討
- [ ] 必要な場合のみ'use client'ディレクティブを使用

### パフォーマンス
- [ ] useMemoで高コスト計算をメモ化
- [ ] useCallbackでコールバックを安定化
- [ ] コンポーネント最適化にReact.memoを使用
- [ ] lazy()でコード分割を実装
- [ ] React DevTools Profilerでプロファイル
- [ ] バンドルサイズとtree shakingを最適化

### コード品質
- [ ] 型安全性のため常にTypeScriptを使用
- [ ] 適切なエラーバウンダリを実装
- [ ] 並行機能の包括的テストを記述
- [ ] 命名規則に従う（コンポーネントはPascalCase）
- [ ] ReactフックのESLintルールを使用
- [ ] ローディングとエラー状態を一貫して処理