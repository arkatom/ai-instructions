# Astro インタラクティブコンポーネント

## 🔍 React検索コンポーネント

```tsx
// src/components/react/SearchComponent.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  category: string;
}

export default function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setResults(data.results || []);
        setIsOpen(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm"
        />
        {query && (
          <button onClick={() => { setQuery(''); setIsOpen(false); }}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          {/* 要実装: 検索結果表示 */}
        </div>
      )}
    </div>
  );
}
```

## 🌙 Vueテーマトグル

```vue
<!-- src/components/vue/ThemeToggle.vue -->
<template>
  <button
    @click="toggleTheme"
    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
    aria-label="テーマを切り替え"
  >
    <Sun v-if="theme === 'light'" class="h-[1.2rem] w-[1.2rem]" />
    <Moon v-else class="h-[1.2rem] w-[1.2rem]" />
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Sun, Moon } from 'lucide-vue-next';

const theme = ref<'light' | 'dark'>('light');

const toggleTheme = () => {
  const newTheme = theme.value === 'light' ? 'dark' : 'light';
  theme.value = newTheme;
  
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  localStorage.setItem('theme', newTheme);
};

onMounted(() => {
  // Check for saved theme or default to light
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  theme.value = initialTheme;
  
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
});
</script>
```

## 📧 Svelteニュースレター

```svelte
<!-- src/components/svelte/NewsletterForm.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    subscribe: { email: string };
  }>();

  let email = '';
  let isSubmitting = false;
  let message = '';
  let messageType: 'success' | 'error' | '' = '';

  async function handleSubmit() {
    if (!email || isSubmitting) return;

    isSubmitting = true;
    message = '';

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        message = 'ニュースレターの登録が完了しました！';
        messageType = 'success';
        email = '';
        dispatch('subscribe', { email });
      } else {
        throw new Error('登録に失敗しました');
      }
    } catch (error) {
      message = 'エラーが発生しました。再度お試しください。';
      messageType = 'error';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="w-full max-w-sm space-y-2">
  <form on:submit|preventDefault={handleSubmit} class="flex space-x-2">
    <input
      type="email"
      bind:value={email}
      placeholder="メールアドレス"
      required
      disabled={isSubmitting}
      class="flex h-9 w-full rounded-md border"
    />
    <button type="submit" disabled={isSubmitting || !email}>
      {#if isSubmitting}
        登録中...
      {:else}
        登録
      {/if}
    </button>
  </form>

  {#if message}
    <p class="text-sm {messageType === 'success' ? 'text-green-600' : 'text-red-600'}">
      {message}
    </p>
  {/if}
</div>
```

## 🎬 コンポーネント使用法

```astro
// src/pages/index.astro
---
import Layout from '../layouts/BaseLayout.astro';
import SearchComponent from '../components/react/SearchComponent.tsx';
import ThemeToggle from '../components/vue/ThemeToggle.vue';
import NewsletterForm from '../components/svelte/NewsletterForm.svelte';
---

<Layout title="ホーム" description="サイトの説明">
  <section class="container">
    <!-- 即座にロード -->
    <SearchComponent client:load />
    
    <!-- ビューポート内で表示時にロード -->
    <ThemeToggle client:visible />
    
    <!-- ブラウザがアイドル時にロード -->
    <NewsletterForm client:idle />
  </section>
</Layout>
```

## 💡 Hydration戦略詳細

```typescript
// 要実装: パフォーマンス最適化のためのディレクティブ選択
// client:load - 高優先度、即座に必要
// client:idle - 低優先度、遅延可能
// client:visible - スクロール時表示
// client:media="(min-width: 768px)" - 条件付き
// client:only="react" - SSR無効化
```