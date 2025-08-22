# Svelte 5 高度なパターンと実践

## Runes システムと リアクティビティ

### 新しいRunes APIの活用

```typescript
// .svelte 5.0+ - Runes システム
<script lang="ts">
import { state, effect, derived, untrack } from 'svelte/store';

// State rune - 基本的なリアクティブ状態
let count = $state(0);
let name = $state('');

// Derived rune - 計算されたプロパティ
let doubled = $derived(count * 2);
let greeting = $derived(`Hello, ${name}!`);

// Effect rune - 副作用の管理
$effect(() => {
  console.log(`Count changed to: ${count}`);
  
  // クリーンアップ関数
  return () => {
    console.log('Effect cleanup');
  };
});

// 複雑な派生状態の例
interface User {
  id: number;
  name: string;
  email: string;
  preferences: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

let users = $state<User[]>([]);
let searchTerm = $state('');
let selectedTheme = $state<'light' | 'dark'>('light');

// 複数の状態に依存する派生状態
let filteredUsers = $derived(() => {
  return users
    .filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(user => user.preferences.theme === selectedTheme);
});

// 非同期効果の処理
let userData = $state<User | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

$effect(async () => {
  if (!searchTerm) return;
  
  loading = true;
  error = null;
  
  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    users = data.users;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  } finally {
    loading = false;
  }
});

// Untrack を使用したパフォーマンス最適化
let expensiveComputation = $derived(() => {
  // untrack で依存関係を除外
  const baseValue = untrack(() => count);
  
  // 重い計算処理
  return Array.from({ length: 1000 }, (_, i) => baseValue + i)
    .reduce((sum, val) => sum + val, 0);
});

// Custom rune の作成
function createCounter(initial = 0) {
  let value = $state(initial);
  
  return {
    get value() { return value; },
    increment() { value++; },
    decrement() { value--; },
    reset() { value = initial; }
  };
}

const counter = createCounter(10);
</script>

<!-- Template -->
<div class="app">
  <h1>Svelte 5 Runes Demo</h1>
  
  <section class="counter-section">
    <h2>Counter: {count}</h2>
    <p>Doubled: {doubled}</p>
    <button onclick={() => count++}>Increment</button>
    
    <h3>Custom Counter: {counter.value}</h3>
    <button onclick={counter.increment}>+</button>
    <button onclick={counter.decrement}>-</button>
    <button onclick={counter.reset}>Reset</button>
  </section>
  
  <section class="user-search">
    <h2>User Search</h2>
    <input 
      bind:value={searchTerm} 
      placeholder="Search users..."
      type="text"
    />
    
    <select bind:value={selectedTheme}>
      <option value="light">Light Theme</option>
      <option value="dark">Dark Theme</option>
    </select>
    
    {#if loading}
      <div class="loading">Searching...</div>
    {/if}
    
    {#if error}
      <div class="error">Error: {error}</div>
    {/if}
    
    <ul class="user-list">
      {#each filteredUsers as user (user.id)}
        <li class="user-item">
          <h3>{user.name}</h3>
          <p>{user.email}</p>
          <span class="theme-badge theme-{user.preferences.theme}">
            {user.preferences.theme}
          </span>
        </li>
      {/each}
    </ul>
  </section>
  
  <section class="performance">
    <h2>Expensive Computation</h2>
    <p>Result: {expensiveComputation}</p>
  </section>
</div>

<style>
  .app {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .counter-section, .user-search, .performance {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .user-list {
    list-style: none;
    padding: 0;
  }
  
  .user-item {
    padding: 1rem;
    margin: 0.5rem 0;
    background: #f5f5f5;
    border-radius: 4px;
  }
  
  .theme-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  .theme-light { background: #fff; color: #333; }
  .theme-dark { background: #333; color: #fff; }
  
  .loading { color: #007bff; }
  .error { color: #dc3545; }
</style>
```

### 高度なストア管理パターン

```typescript
// stores/advanced-store.ts
import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// 型安全なストアファクトリ
export function createTypedStore<T>(initial: T): {
  subscribe: Writable<T>['subscribe'];
  set: (value: T) => void;
  update: (updater: (value: T) => T) => void;
  reset: () => void;
} {
  const store = writable(initial);
  
  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    reset: () => store.set(initial)
  };
}

// 永続化ストア
export function createPersistedStore<T>(
  key: string, 
  initial: T,
  storage: Storage = localStorage
): Writable<T> {
  let data = initial;
  
  // 初期値をstorageから読み込み
  if (typeof window !== 'undefined') {
    const stored = storage.getItem(key);
    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch (e) {
        console.warn(`Failed to parse stored value for key "${key}":`, e);
      }
    }
  }
  
  const store = writable(data);
  
  // 変更を自動的に永続化
  store.subscribe(value => {
    if (typeof window !== 'undefined') {
      storage.setItem(key, JSON.stringify(value));
    }
  });
  
  return store;
}

// 非同期ストア
export function createAsyncStore<T>(
  fetcher: () => Promise<T>,
  initialValue?: T
) {
  const loading = writable(false);
  const error = writable<string | null>(null);
  const data = writable<T | undefined>(initialValue);
  
  async function load() {
    loading.set(true);
    error.set(null);
    
    try {
      const result = await fetcher();
      data.set(result);
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      loading.set(false);
    }
  }
  
  // 初回ロード
  load();
  
  return {
    subscribe: derived(
      [data, loading, error],
      ([$data, $loading, $error]) => ({
        data: $data,
        loading: $loading,
        error: $error
      })
    ).subscribe,
    reload: load,
    reset: () => {
      data.set(initialValue);
      error.set(null);
      loading.set(false);
    }
  };
}

// リアルタイムストア（WebSocket）
export function createRealtimeStore<T>(
  url: string,
  initialValue?: T
) {
  const data = writable<T | undefined>(initialValue);
  const connected = writable(false);
  const error = writable<string | null>(null);
  
  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  function connect() {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        connected.set(true);
        error.set(null);
        reconnectAttempts = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          data.set(parsedData);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };
      
      ws.onclose = () => {
        connected.set(false);
        
        // 自動再接続
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeout = window.setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, Math.pow(2, reconnectAttempts) * 1000);
        }
      };
      
      ws.onerror = () => {
        error.set('WebSocket connection error');
      };
    } catch (e) {
      error.set(e instanceof Error ? e.message : 'Connection failed');
    }
  }
  
  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
  }
  
  // 初回接続
  connect();
  
  return {
    subscribe: derived(
      [data, connected, error],
      ([$data, $connected, $error]) => ({
        data: $data,
        connected: $connected,
        error: $error
      })
    ).subscribe,
    send: (message: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
    reconnect: connect,
    disconnect
  };
}

// 複雑な状態管理のためのContext Store
export function createContextStore<T>(initialState: T) {
  const { subscribe, set, update } = writable(initialState);
  
  return {
    subscribe,
    actions: {
      // 型安全なアクション定義
      updateField: <K extends keyof T>(field: K, value: T[K]) => {
        update(state => ({ ...state, [field]: value }));
      },
      
      reset: () => set(initialState),
      
      // 部分更新
      patch: (updates: Partial<T>) => {
        update(state => ({ ...state, ...updates }));
      },
      
      // 配列操作（Tが配列型の場合）
      ...(Array.isArray(initialState) && {
        push: (item: T extends Array<infer U> ? U : never) => {
          update(state => Array.isArray(state) ? [...state, item] : state);
        },
        
        remove: (predicate: (item: T extends Array<infer U> ? U : never) => boolean) => {
          update(state => 
            Array.isArray(state) 
              ? state.filter(item => !predicate(item))
              : state
          );
        },
        
        update: (
          predicate: (item: T extends Array<infer U> ? U : never) => boolean,
          updater: (item: T extends Array<infer U> ? U : never) => T extends Array<infer U> ? U : never
        ) => {
          update(state =>
            Array.isArray(state)
              ? state.map(item => predicate(item) ? updater(item) : item)
              : state
          );
        }
      })
    }
  };
}
```

## 高度なコンポーネントパターン

### スロットとコンテキストAPI

```svelte
<!-- ParentComponent.svelte -->
<script lang="ts">
import { setContext, createEventDispatcher } from 'svelte';
import type { ComponentType } from 'svelte';

// コンテキストの型定義
interface TabContext {
  registerTab: (id: string, label: string) => void;
  unregisterTab: (id: string) => void;
  selectTab: (id: string) => void;
  selectedTab: string;
}

// イベントディスパッチャーの型定義
interface TabEvents {
  tabchange: { previousTab: string; currentTab: string };
  tabregister: { tabId: string; label: string };
}

const dispatch = createEventDispatcher<TabEvents>();

let selectedTab = $state('');
let registeredTabs = $state<Map<string, string>>(new Map());

// コンテキスト実装
const tabContext: TabContext = {
  registerTab: (id: string, label: string) => {
    registeredTabs.set(id, label);
    
    // 最初のタブを自動選択
    if (selectedTab === '' && registeredTabs.size === 1) {
      selectedTab = id;
    }
    
    dispatch('tabregister', { tabId: id, label });
  },
  
  unregisterTab: (id: string) => {
    registeredTabs.delete(id);
    if (selectedTab === id && registeredTabs.size > 0) {
      selectedTab = registeredTabs.keys().next().value;
    }
  },
  
  selectTab: (id: string) => {
    if (registeredTabs.has(id)) {
      const previousTab = selectedTab;
      selectedTab = id;
      dispatch('tabchange', { previousTab, currentTab: id });
    }
  },
  
  get selectedTab() { return selectedTab; }
};

setContext('tabs', tabContext);

// スロットプロップスの型定義
interface SlotProps {
  tabs: Array<{ id: string; label: string }>;
  selectedTab: string;
  selectTab: (id: string) => void;
}

$: tabsArray = Array.from(registeredTabs.entries()).map(([id, label]) => ({ id, label }));
</script>

<div class="tab-container">
  <!-- カスタマイズ可能なタブヘッダー -->
  <div class="tab-header">
    <slot name="header" tabs={tabsArray} {selectedTab} selectTab={tabContext.selectTab}>
      <!-- デフォルトヘッダー -->
      <div class="default-tabs">
        {#each tabsArray as tab (tab.id)}
          <button 
            class="tab-button"
            class:active={selectedTab === tab.id}
            onclick={() => tabContext.selectTab(tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </slot>
  </div>
  
  <!-- タブコンテンツ -->
  <div class="tab-content">
    <slot {selectedTab} tabs={tabsArray}></slot>
  </div>
  
  <!-- カスタマイズ可能なフッター -->
  <div class="tab-footer">
    <slot name="footer" tabs={tabsArray} {selectedTab}></slot>
  </div>
</div>

<style>
  .tab-container {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .tab-header {
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  
  .default-tabs {
    display: flex;
  }
  
  .tab-button {
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  
  .tab-button:hover {
    background: #e9ecef;
  }
  
  .tab-button.active {
    border-bottom-color: #007bff;
    background: white;
  }
  
  .tab-content {
    padding: 1rem;
    min-height: 200px;
  }
</style>
```

```svelte
<!-- TabPanel.svelte -->
<script lang="ts">
import { getContext, onMount, onDestroy } from 'svelte';

export let id: string;
export let label: string;

const tabContext = getContext<TabContext>('tabs');

onMount(() => {
  tabContext.registerTab(id, label);
});

onDestroy(() => {
  tabContext.unregisterTab(id);
});
</script>

{#if tabContext.selectedTab === id}
  <div class="tab-panel" role="tabpanel" aria-labelledby="tab-{id}">
    <slot></slot>
  </div>
{/if}

<style>
  .tab-panel {
    animation: fadeIn 0.2s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
```

### 高階コンポーネントとレンダープロップパターン

```typescript
// 高階コンポーネントの型定義
// types/component-types.ts
import type { ComponentType, SvelteComponent } from 'svelte';

export interface WithLoadingProps {
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
}

export type HOCProps<T> = T & WithLoadingProps;

// Higher-Order Component の実装
export function withLoading<T extends Record<string, any>>(
  Component: ComponentType<T>
) {
  return class WithLoadingComponent extends SvelteComponent<HOCProps<T>> {
    // 実装は通常のSvelteコンポーネントとして別ファイルで定義
  };
}
```

```svelte
<!-- WithLoading.svelte -->
<script lang="ts" generics="T extends Record<string, any>">
import type { ComponentType } from 'svelte';
import LoadingSpinner from './LoadingSpinner.svelte';
import ErrorMessage from './ErrorMessage.svelte';

interface Props {
  component: ComponentType<T>;
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  props: T;
}

let { component, loading = false, error = null, retry, props }: Props = $props();
</script>

{#if loading}
  <LoadingSpinner />
{:else if error}
  <ErrorMessage {error} {retry} />
{:else}
  <svelte:component this={component} {...props} />
{/if}
```

```svelte
<!-- DataProvider.svelte - レンダープロップパターン -->
<script lang="ts" generics="T">
interface DataProviderProps<T> {
  url: string;
  children: (data: {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
  }) => any;
}

let { url, children }: DataProviderProps<T> = $props();

let data = $state<T | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

async function fetchData() {
  loading = true;
  error = null;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    data = await response.json();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  } finally {
    loading = false;
  }
}

// 初回データ取得
$effect(() => {
  fetchData();
});

// URLが変更された時の再取得
$effect(() => {
  fetchData();
});
</script>

{@render children({ data, loading, error, refetch: fetchData })}
```

## パフォーマンス最適化パターン

### 仮想化とレンダリング最適化

```svelte
<!-- VirtualList.svelte -->
<script lang="ts" generics="T">
import { tick } from 'svelte';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => any;
  keyExtractor?: (item: T, index: number) => string | number;
  overscan?: number;
}

let {
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor = (_, index) => index,
  overscan = 5
}: VirtualListProps<T> = $props();

let scrollTop = $state(0);
let container: HTMLDivElement;

// 表示範囲の計算
const visibleRange = $derived(() => {
  const start = Math.floor(scrollTop / itemHeight);
  const end = Math.min(
    start + Math.ceil(containerHeight / itemHeight),
    items.length
  );
  
  return {
    start: Math.max(0, start - overscan),
    end: Math.min(items.length, end + overscan)
  };
});

// 表示するアイテムの計算
const visibleItems = $derived(() => {
  const { start, end } = visibleRange;
  return items.slice(start, end).map((item, index) => ({
    item,
    index: start + index,
    key: keyExtractor(item, start + index)
  }));
});

// 全体の高さとオフセット
const totalHeight = $derived(items.length * itemHeight);
const offsetY = $derived(visibleRange.start * itemHeight);

function handleScroll(event: Event) {
  const target = event.target as HTMLDivElement;
  scrollTop = target.scrollTop;
}

// スムーズスクロール
export function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
  if (container) {
    container.scrollTo({
      top: index * itemHeight,
      behavior
    });
  }
}
</script>

<div
  bind:this={container}
  class="virtual-list-container"
  style="height: {containerHeight}px; overflow-y: auto;"
  onscroll={handleScroll}
>
  <div class="virtual-list-spacer" style="height: {totalHeight}px; position: relative;">
    <div style="transform: translateY({offsetY}px);">
      {#each visibleItems as { item, index, key } (key)}
        <div class="virtual-list-item" style="height: {itemHeight}px;">
          {@render renderItem(item, index)}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-list-container {
    will-change: scroll-position;
  }
  
  .virtual-list-item {
    overflow: hidden;
  }
</style>
```

### アクション（Actions）とディレクティブ

```typescript
// actions/performance-actions.ts
import type { Action } from 'svelte/action';

// 遅延読み込みアクション
export const lazyLoad: Action<HTMLImageElement, string> = (element, src) => {
  const observer = new IntersectionObserver((entries) => {
    const [entry] = entries;
    
    if (entry.isIntersecting) {
      element.src = src;
      element.classList.add('loaded');
      observer.disconnect();
    }
  });
  
  observer.observe(element);
  
  return {
    destroy() {
      observer.disconnect();
    }
  };
};

// クリック外側検出アクション
export const clickOutside: Action<HTMLElement, () => void> = (element, callback) => {
  function handleClick(event: MouseEvent) {
    if (!element.contains(event.target as Node)) {
      callback();
    }
  }
  
  document.addEventListener('click', handleClick);
  
  return {
    destroy() {
      document.removeEventListener('click', handleClick);
    }
  };
};

// 自動リサイズアクション
export const autoResize: Action<HTMLTextAreaElement> = (element) => {
  function resize() {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }
  
  element.addEventListener('input', resize);
  
  // 初期サイズ調整
  resize();
  
  return {
    destroy() {
      element.removeEventListener('input', resize);
    }
  };
};

// 長押し検出アクション
export const longPress: Action<HTMLElement, {
  duration?: number;
  callback: () => void;
}> = (element, { duration = 500, callback }) => {
  let timer: number | null = null;
  
  function start() {
    timer = window.setTimeout(callback, duration);
  }
  
  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', cancel);
  element.addEventListener('mouseleave', cancel);
  element.addEventListener('touchstart', start);
  element.addEventListener('touchend', cancel);
  
  return {
    update(newConfig) {
      duration = newConfig.duration ?? 500;
      callback = newConfig.callback;
    },
    destroy() {
      cancel();
      element.removeEventListener('mousedown', start);
      element.removeEventListener('mouseup', cancel);
      element.removeEventListener('mouseleave', cancel);
      element.removeEventListener('touchstart', start);
      element.removeEventListener('touchend', cancel);
    }
  };
};

// パフォーマンス監視アクション
export const performanceMonitor: Action<HTMLElement, {
  threshold?: number;
  onSlowRender?: (duration: number) => void;
}> = (element, { threshold = 16, onSlowRender }) => {
  let renderStart: number;
  
  const observer = new MutationObserver(() => {
    const renderEnd = performance.now();
    const duration = renderEnd - renderStart;
    
    if (duration > threshold && onSlowRender) {
      onSlowRender(duration);
    }
  });
  
  function startMonitoring() {
    renderStart = performance.now();
  }
  
  observer.observe(element, {
    childList: true,
    subtree: true,
    attributes: true
  });
  
  element.addEventListener('DOMNodeInserted', startMonitoring);
  
  return {
    destroy() {
      observer.disconnect();
      element.removeEventListener('DOMNodeInserted', startMonitoring);
    }
  };
};
```

## テスト戦略とCI/CD統合

### 包括的テストセットアップ

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
});
```

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// WebSocket のモック
global.WebSocket = vi.fn(() => ({
  close: vi.fn(),
  send: vi.fn(),
  readyState: WebSocket.OPEN,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));

// IntersectionObserver のモック
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn()
}));

// ResizeObserver のモック
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn()
}));
```

```typescript
// src/lib/components/__tests__/UserList.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import UserList from '../UserList.svelte';
import type { User } from '$lib/types';

// モックデータ
const mockUsers: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', active: true },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', active: false },
];

// API モック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('UserList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ユーザーリストを正しく表示する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers })
    });

    render(UserList);

    // ローディング状態の確認
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // データ読み込み完了まで待機
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // 全ユーザーが表示されていることを確認
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('検索フィルターが正しく動作する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers })
    });

    render(UserList);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // 検索入力
    const searchInput = screen.getByPlaceholderText('Search users...');
    await fireEvent.input(searchInput, { target: { value: 'John' } });

    // フィルタリング結果の確認
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('エラー状態を正しく処理する', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(UserList);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('ユーザー選択イベントが発火される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: mockUsers })
    });

    const { component } = render(UserList);
    const selectHandler = vi.fn();
    
    component.$on('userselect', selectHandler);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // ユーザークリック
    await fireEvent.click(screen.getByText('John Doe'));

    expect(selectHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ id: '1' })
      })
    );
  });
});
```

### Playwright E2Eテスト

```typescript
// e2e/user-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  test('ユーザー一覧の表示と検索', async ({ page }) => {
    // ページタイトルの確認
    await expect(page).toHaveTitle(/User Management/);

    // ユーザーリストの読み込み待機
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();

    // 初期ユーザー数の確認
    const userItems = page.locator('[data-testid="user-item"]');
    const initialCount = await userItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // 検索機能のテスト
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('John');

    // フィルタリング結果の確認
    await expect(userItems).toHaveCount(1);
    await expect(page.locator('text=John Doe')).toBeVisible();
  });

  test('ユーザー詳細ページへの遷移', async ({ page }) => {
    await page.locator('[data-testid="user-item"]').first().click();
    
    // 詳細ページに遷移したことを確認
    await expect(page).toHaveURL(/\/users\/\w+/);
    await expect(page.locator('[data-testid="user-detail"]')).toBeVisible();
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    // モバイル用レイアウトの確認
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    // タブレット用レイアウトの確認
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
  });

  test('アクセシビリティの確認', async ({ page }) => {
    // キーボードナビゲーションのテスト
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="user-item"]').first()).toBeFocused();

    // ARIAラベルの確認
    await expect(page.locator('[aria-label="User list"]')).toBeVisible();
    await expect(page.locator('[role="main"]')).toBeVisible();
  });
});
```

## ベストプラクティス

1. **Runes System**: Svelte 5の新しいリアクティビティシステムを最大限活用
2. **型安全性**: TypeScriptとGenericsで厳密な型付け
3. **パフォーマンス**: 仮想化、遅延読み込み、メモ化の適切な使用
4. **アクセシビリティ**: ARIA属性、キーボードナビゲーション、スクリーンリーダー対応
5. **テスト**: 単体テスト、統合テスト、E2Eテストの包括的カバレッジ
6. **状態管理**: コンテキストAPI、カスタムストア、永続化の適切な使い分け
7. **コンポーネント設計**: 再利用性、カスタマイズ性、保守性を重視
8. **ビルド最適化**: Tree-shaking、コード分割、バンドルサイズ最小化
9. **開発体験**: HMR、TypeScript、ESLint、Prettierの統合
10. **本番運用**: エラーハンドリング、パフォーマンス監視、ログ収集