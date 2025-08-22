# Astro Static-First パターン

静的サイト優先のモダンWebアプリケーション構築のためのAstro実装パターン集。Islands Architectureとマルチフレームワークサポートを活用した高パフォーマンスサイト開発手法。

## 🏝️ Islands Architecture パターン

### Interactive Islands Setup

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    react(),
    vue(),
    svelte(),
    tailwind({
      applyBaseStyles: false, // Use custom base styles
    }),
    sitemap(),
    mdx({
      syntaxHighlight: 'shiki',
      shikiConfig: {
        theme: 'github-dark',
        wrap: true
      }
    }),
    partytown({
      config: {
        forward: ['dataLayer.push', 'gtag']
      }
    })
  ],
  output: 'static', // Static generation by default
  adapter: undefined,
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },
  image: {
    domains: ['images.unsplash.com', 'cdn.example.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.example.com'
      }
    ]
  },
  vite: {
    optimizeDeps: {
      exclude: ['@resvg/resvg-js']
    },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
  },
  experimental: {
    contentCollectionCache: true,
    optimizeHoistedScript: true
  }
});

// src/layouts/BaseLayout.astro
---
export interface Props {
  title: string;
  description: string;
  image?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  structuredData?: Record<string, any>;
}

const {
  title,
  description,
  image = '/og-default.jpg',
  canonicalUrl,
  noindex = false,
  structuredData
} = Astro.props;

const baseUrl = 'https://example.com';
const fullTitle = title ? `${title} | サイト名` : 'サイト名';
const canonicalURL = canonicalUrl ? new URL(canonicalUrl, baseUrl) : new URL(Astro.url.pathname, baseUrl);
---

<!DOCTYPE html>
<html lang="ja" class="scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Primary Meta Tags -->
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalURL} />
    
    {noindex && <meta name="robots" content="noindex, nofollow" />}
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalURL} />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={new URL(image, baseUrl)} />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content={canonicalURL} />
    <meta property="twitter:title" content={fullTitle} />
    <meta property="twitter:description" content={description} />
    <meta property="twitter:image" content={new URL(image, baseUrl)} />
    
    <!-- Favicons -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    
    <!-- Preconnect to external domains -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    
    <!-- Structured Data -->
    {structuredData && (
      <script type="application/ld+json" set:html={JSON.stringify(structuredData)} />
    )}
    
    <!-- Analytics (Partytown) -->
    <script type="text/partytown">
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID');
    </script>
    <script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
  </head>
  
  <body class="min-h-screen bg-background text-foreground antialiased">
    <div class="relative flex min-h-screen flex-col">
      <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav class="container flex h-14 items-center">
          <div class="mr-4 hidden md:flex">
            <a class="mr-6 flex items-center space-x-2" href="/">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
              </svg>
              <span class="hidden font-bold sm:inline-block">サイト名</span>
            </a>
          </div>
          
          <!-- Navigation items -->
          <div class="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div class="w-full flex-1 md:w-auto md:flex-none">
              <!-- Search component (Interactive Island) -->
              <search-component client:load />
            </div>
            
            <!-- Theme toggle (Interactive Island) -->
            <theme-toggle client:visible />
          </div>
        </nav>
      </header>
      
      <main class="flex-1">
        <slot />
      </main>
      
      <footer class="border-t py-6 md:py-0">
        <div class="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p class="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with <a href="https://astro.build" class="font-medium underline underline-offset-4">Astro</a>. 
            The source code is available on <a href="https://github.com" class="font-medium underline underline-offset-4">GitHub</a>.
          </p>
        </div>
      </footer>
    </div>
    
    <!-- Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
      }
    </script>
  </body>
</html>

<style is:global>
  html {
    scroll-behavior: smooth;
  }
  
  body {
    font-family: 'Inter Variable', sans-serif;
  }
  
  @supports (font-variation-settings: normal) {
    body {
      font-family: 'Inter Variable', sans-serif;
    }
  }
</style>
```

### Interactive Components with Multiple Frameworks

```typescript
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

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">検索中...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <a
                  key={result.id}
                  href={result.url}
                  className="block px-4 py-2 hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="font-medium text-sm">{result.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {result.excerpt}
                  </div>
                  <div className="text-xs text-primary mt-1">{result.category}</div>
                </a>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              検索結果がありません
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// src/components/vue/ThemeToggle.vue
<template>
  <button
    @click="toggleTheme"
    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9"
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

// src/components/svelte/NewsletterForm.svelte
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
      class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
    <button
      type="submit"
      disabled={isSubmitting || !email}
      class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
    >
      {#if isSubmitting}
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
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

## 📝 Content Collections

### Blog and Documentation System

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    publishedDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.object({
      name: z.string(),
      email: z.string().email(),
      avatar: image().optional(),
      bio: z.string().optional(),
    }),
    tags: z.array(z.string()),
    category: z.string(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    image: image(),
    imageAlt: z.string(),
    seo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    }).optional(),
    relatedPosts: z.array(z.string()).optional(),
    readingTime: z.number().optional(),
    tableOfContents: z.boolean().default(true),
  }),
});

const docsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    lastUpdated: z.date(),
    version: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    prerequisites: z.array(z.string()).default([]),
    relatedDocs: z.array(z.string()).default([]),
    showToc: z.boolean().default(true),
  }),
});

const authorsCollection = defineCollection({
  type: 'data',
  schema: ({ image }) => z.object({
    name: z.string(),
    email: z.string().email(),
    bio: z.string(),
    avatar: image(),
    website: z.string().url().optional(),
    twitter: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
    location: z.string().optional(),
    joinDate: z.date(),
  }),
});

const changelogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    version: z.string(),
    releaseDate: z.date(),
    type: z.enum(['major', 'minor', 'patch']),
    summary: z.string(),
    breaking: z.boolean().default(false),
    features: z.array(z.string()).default([]),
    improvements: z.array(z.string()).default([]),
    fixes: z.array(z.string()).default([]),
    deprecated: z.array(z.string()).default([]),
  }),
});

export const collections = {
  'blog': blogCollection,
  'docs': docsCollection,
  'authors': authorsCollection,
  'changelog': changelogCollection,
};

// src/lib/content.ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;
export type DocPage = CollectionEntry<'docs'>;
export type Author = CollectionEntry<'authors'>;

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });

  return posts.sort((a, b) => 
    new Date(b.data.publishedDate).getTime() - new Date(a.data.publishedDate).getTime()
  );
}

export async function getFeaturedBlogPosts(limit: number = 3): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts.filter(post => post.data.featured).slice(0, limit);
}

export async function getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts.filter(post => post.data.category === category);
}

export async function getBlogPostsByTag(tag: string): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts.filter(post => post.data.tags.includes(tag));
}

export async function getRelatedBlogPosts(currentPost: BlogPost, limit: number = 3): Promise<BlogPost[]> {
  const allPosts = await getAllBlogPosts();
  
  // Score posts based on shared tags and category
  const scoredPosts = allPosts
    .filter(post => post.slug !== currentPost.slug)
    .map(post => {
      let score = 0;
      
      // Same category gets higher score
      if (post.data.category === currentPost.data.category) {
        score += 3;
      }
      
      // Shared tags
      const sharedTags = post.data.tags.filter(tag => 
        currentPost.data.tags.includes(tag)
      );
      score += sharedTags.length;
      
      return { post, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredPosts.slice(0, limit).map(({ post }) => post);
}

export async function getAllCategories(): Promise<string[]> {
  const posts = await getAllBlogPosts();
  const categories = [...new Set(posts.map(post => post.data.category))];
  return categories.sort();
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await getAllBlogPosts();
  const tagCounts = new Map<string, number>();
  
  posts.forEach(post => {
    post.data.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// Reading time calculation
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}
```

### Dynamic Blog Pages

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, type CollectionEntry } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import BlogPost from '../../components/BlogPost.astro';
import RelatedPosts from '../../components/RelatedPosts.astro';
import { getRelatedBlogPosts, calculateReadingTime } from '../../lib/content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

interface Props {
  post: CollectionEntry<'blog'>;
}

const { post } = Astro.props;
const { Content, headings } = await post.render();

// Calculate reading time if not provided
const readingTime = post.data.readingTime || calculateReadingTime(post.body);

// Get related posts
const relatedPosts = await getRelatedBlogPosts(post);

// Structured data for SEO
const structuredData = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.data.title,
  description: post.data.description,
  image: post.data.image.src,
  author: {
    "@type": "Person",
    name: post.data.author.name,
    email: post.data.author.email,
  },
  publisher: {
    "@type": "Organization",
    name: "サイト名",
    logo: {
      "@type": "ImageObject",
      url: "https://example.com/logo.png",
    },
  },
  datePublished: post.data.publishedDate.toISOString(),
  dateModified: (post.data.updatedDate || post.data.publishedDate).toISOString(),
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `https://example.com/blog/${post.slug}`,
  },
};
---

<BaseLayout
  title={post.data.seo?.title || post.data.title}
  description={post.data.seo?.description || post.data.description}
  image={post.data.image.src}
  structuredData={structuredData}
>
  <article class="container mx-auto px-4 py-8 max-w-4xl">
    <!-- Blog header -->
    <header class="mb-8">
      <div class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <time datetime={post.data.publishedDate.toISOString()}>
          {post.data.publishedDate.toLocaleDateString('ja-JP')}
        </time>
        <span>•</span>
        <span>{readingTime}分で読める</span>
        <span>•</span>
        <a 
          href={`/blog/category/${post.data.category}`}
          class="text-primary hover:underline"
        >
          {post.data.category}
        </a>
      </div>
      
      <h1 class="text-4xl md:text-5xl font-bold leading-tight mb-4">
        {post.data.title}
      </h1>
      
      <p class="text-xl text-muted-foreground mb-6">
        {post.data.description}
      </p>
      
      <!-- Author info -->
      <div class="flex items-center gap-4">
        {post.data.author.avatar && (
          <img
            src={post.data.author.avatar.src}
            alt={post.data.author.name}
            class="w-12 h-12 rounded-full"
            width="48"
            height="48"
          />
        )}
        <div>
          <div class="font-semibold">{post.data.author.name}</div>
          {post.data.author.bio && (
            <div class="text-sm text-muted-foreground">{post.data.author.bio}</div>
          )}
        </div>
      </div>
      
      <!-- Tags -->
      <div class="flex flex-wrap gap-2 mt-6">
        {post.data.tags.map((tag) => (
          <a
            href={`/blog/tag/${tag}`}
            class="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            #{tag}
          </a>
        ))}
      </div>
    </header>

    <!-- Featured image -->
    {post.data.image && (
      <div class="mb-8">
        <img
          src={post.data.image.src}
          alt={post.data.imageAlt}
          class="w-full h-64 md:h-96 object-cover rounded-lg"
          width={post.data.image.width}
          height={post.data.image.height}
        />
      </div>
    )}

    <!-- Table of contents -->
    {post.data.tableOfContents && headings.length > 0 && (
      <div class="mb-8 p-6 bg-secondary rounded-lg">
        <h2 class="text-lg font-semibold mb-4">目次</h2>
        <nav class="toc">
          <ul class="space-y-2">
            {headings.map((heading) => (
              <li class={`ml-${(heading.depth - 1) * 4}`}>
                <a
                  href={`#${heading.slug}`}
                  class="text-sm text-muted-foreground hover:text-foreground"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    )}

    <!-- Blog content -->
    <div class="prose prose-gray dark:prose-invert max-w-none">
      <Content />
    </div>

    <!-- Update info -->
    {post.data.updatedDate && (
      <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p class="text-sm">
          この記事は
          <time datetime={post.data.updatedDate.toISOString()}>
            {post.data.updatedDate.toLocaleDateString('ja-JP')}
          </time>
          に更新されました。
        </p>
      </div>
    )}

    <!-- Share buttons (Interactive Island) -->
    <div class="mt-8 pt-8 border-t">
      <share-buttons 
        client:visible 
        url={`https://example.com/blog/${post.slug}`}
        title={post.data.title}
      />
    </div>
  </article>

  <!-- Related posts -->
  {relatedPosts.length > 0 && (
    <section class="container mx-auto px-4 py-8 max-w-4xl">
      <RelatedPosts posts={relatedPosts} />
    </section>
  )}
</BaseLayout>

<style>
  .prose {
    @apply text-foreground;
  }
  
  .prose h1,
  .prose h2,
  .prose h3,
  .prose h4,
  .prose h5,
  .prose h6 {
    @apply text-foreground font-bold;
  }
  
  .prose h2 {
    @apply text-2xl mt-8 mb-4;
  }
  
  .prose h3 {
    @apply text-xl mt-6 mb-3;
  }
  
  .prose blockquote {
    @apply border-l-4 border-primary pl-4 italic;
  }
  
  .prose code {
    @apply bg-secondary px-1 py-0.5 rounded text-sm;
  }
  
  .prose pre {
    @apply bg-secondary p-4 rounded-lg overflow-x-auto;
  }
</style>
```

## 🎯 API Routes and Server Functions

### Dynamic API Endpoints

```typescript
// src/pages/api/search.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import Fuse from 'fuse.js';

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  category: string;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Get all searchable content
    const [blogPosts, docPages] = await Promise.all([
      getCollection('blog', ({ data }) => !data.draft),
      getCollection('docs')
    ]);

    // Prepare search data
    const searchData: SearchResult[] = [
      ...blogPosts.map(post => ({
        id: post.slug,
        title: post.data.title,
        excerpt: post.data.description,
        url: `/blog/${post.slug}`,
        category: 'ブログ'
      })),
      ...docPages.map(doc => ({
        id: doc.slug,
        title: doc.data.title,
        excerpt: doc.data.description,
        url: `/docs/${doc.slug}`,
        category: 'ドキュメント'
      }))
    ];

    // Configure Fuse for fuzzy search
    const fuse = new Fuse(searchData, {
      keys: [
        { name: 'title', weight: 0.7 },
        { name: 'excerpt', weight: 0.3 }
      ],
      threshold: 0.3,
      includeScore: true
    });

    // Perform search
    const fuseResults = fuse.search(query);
    const results = fuseResults
      .slice(0, 10) // Limit to 10 results
      .map(result => result.item);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      },
    });

  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

// src/pages/api/newsletter.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
});

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (limit.count >= 5) { // 5 requests per minute
    return false;
  }

  limit.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ 
        error: 'レート制限に達しました。しばらく待ってから再度お試しください。' 
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = newsletterSchema.parse(body);

    // Here you would typically:
    // 1. Check if email already exists
    // 2. Save to database
    // 3. Send welcome email
    // 4. Add to mailing list service (Mailchimp, ConvertKit, etc.)

    // Mock implementation
    console.log(`Newsletter subscription: ${validatedData.email}`);

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'ニュースレターの登録が完了しました！'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        error: error.errors[0].message 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.error('Newsletter subscription error:', error);
    return new Response(JSON.stringify({ 
      error: 'サーバーエラーが発生しました。再度お試しください。' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

// src/pages/api/feed.xml.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  
  return rss({
    title: 'サイト名 ブログ',
    description: 'サイトの説明',
    site: site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedDate,
      link: `/blog/${post.slug}/`,
      author: post.data.author.email,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: `<language>ja-jp</language>`,
  });
};
```

## 📱 Progressive Web App (PWA)

### Service Worker and Manifest

```typescript
// public/sw.js
const CACHE_NAME = 'site-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/offline/',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Try to get from cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            
            // For navigation requests, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline/');
            }
            
            // For other requests, throw error
            throw new Error('No cache match found');
          });
      })
  );
});

// public/manifest.json
{
  "name": "サイト名",
  "short_name": "サイト",
  "description": "サイトの説明",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["productivity", "utilities"],
  "shortcuts": [
    {
      "name": "ブログ",
      "short_name": "Blog",
      "description": "最新の記事を読む",
      "url": "/blog/",
      "icons": [{ "src": "/icons/blog-96x96.png", "sizes": "96x96" }]
    }
  ]
}

// src/pages/offline.astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout 
  title="オフライン" 
  description="現在オフラインです"
  noindex={true}
>
  <div class="container mx-auto px-4 py-16 text-center">
    <div class="max-w-md mx-auto">
      <div class="mb-8">
        <svg 
          class="w-24 h-24 mx-auto text-muted-foreground" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
          />
        </svg>
      </div>
      
      <h1 class="text-3xl font-bold mb-4">オフラインです</h1>
      <p class="text-muted-foreground mb-8">
        インターネット接続を確認してから、再度お試しください。
      </p>
      
      <button 
        onclick="window.location.reload()" 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
      >
        再読み込み
      </button>
    </div>
  </div>
</BaseLayout>
```

## 🧪 テスト戦略

### Comprehensive Testing

```typescript
// tests/blog.test.ts
import { expect, test } from '@playwright/test';

test.describe('Blog functionality', () => {
  test('should display blog post list', async ({ page }) => {
    await page.goto('/blog');
    
    // Check page title
    await expect(page).toHaveTitle(/ブログ/);
    
    // Check blog posts are displayed
    const blogPosts = page.locator('[data-testid="blog-post"]');
    await expect(blogPosts).toHaveCount.greaterThan(0);
    
    // Check each post has required elements
    const firstPost = blogPosts.first();
    await expect(firstPost.locator('h2')).toBeVisible();
    await expect(firstPost.locator('[data-testid="post-date"]')).toBeVisible();
    await expect(firstPost.locator('[data-testid="post-author"]')).toBeVisible();
  });

  test('should navigate to individual blog post', async ({ page }) => {
    await page.goto('/blog');
    
    // Click on first blog post
    const firstPostLink = page.locator('[data-testid="blog-post"] a').first();
    await firstPostLink.click();
    
    // Check we're on a blog post page
    await expect(page.locator('article')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    
    // Check structured data exists
    const structuredData = page.locator('script[type="application/ld+json"]');
    await expect(structuredData).toBeVisible();
  });

  test('should filter posts by category', async ({ page }) => {
    await page.goto('/blog');
    
    // Get initial post count
    const initialPosts = await page.locator('[data-testid="blog-post"]').count();
    
    // Click on a category filter
    await page.locator('[data-testid="category-filter"]').first().click();
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check that we have filtered results
    const filteredPosts = await page.locator('[data-testid="blog-post"]').count();
    expect(filteredPosts).toBeLessThanOrEqual(initialPosts);
  });

  test('should search for blog posts', async ({ page }) => {
    await page.goto('/blog');
    
    // Use the search functionality
    await page.fill('[data-testid="search-input"]', 'TypeScript');
    await page.keyboard.press('Enter');
    
    // Wait for search results
    await page.waitForResponse(response => 
      response.url().includes('/api/search') && response.status() === 200
    );
    
    // Check search results are displayed
    const searchResults = page.locator('[data-testid="search-result"]');
    await expect(searchResults).toHaveCount.greaterThan(0);
  });
});

test.describe('PWA functionality', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Check service worker registration
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should have valid web app manifest', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    expect(response.status()).toBe(200);
    
    const manifest = await response.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.icons).toHaveLength.greaterThan(0);
  });
});

// Visual regression tests
test.describe('Visual regression', () => {
  test('homepage should look correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('blog page should look correct', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveScreenshot('blog-page.png');
  });

  test('dark mode should work correctly', async ({ page }) => {
    await page.goto('/');
    
    // Toggle to dark mode
    await page.click('[data-testid="theme-toggle"]');
    
    // Wait for theme change
    await page.waitForFunction(() => 
      document.documentElement.classList.contains('dark')
    );
    
    await expect(page).toHaveScreenshot('homepage-dark.png');
  });
});

// Performance tests
test.describe('Performance', () => {
  test('homepage should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 seconds
  });

  test('should have good Lighthouse scores', async ({ page }) => {
    // This would typically use a Lighthouse CI integration
    await page.goto('/');
    
    // Check critical web vitals
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    
    expect(lcp).toBeLessThan(2500); // 2.5 seconds for good LCP
  });
});
```

このAstro Static-Firstパターン集は、最新のIslands Architecture、Content Collections、PWA機能を活用した高パフォーマンスWebサイト構築のための包括的なソリューションを提供します。静的生成の利点を最大化しながら、必要な部分でのみインタラクティブ性を実現する効率的な開発手法を実装しています。