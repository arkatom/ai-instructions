# Astro 基礎設定とIslands Architecture

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
```

## 📐 Base Layout Pattern

```astro
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
          <!-- Navigation content -->
          <slot name="header" />
        </nav>
      </header>
      
      <main class="flex-1">
        <slot />
      </main>
      
      <footer class="border-t py-6 md:py-0">
        <div class="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <slot name="footer" />
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
```

## 🎨 Global Styles

```css
/* src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 1.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 100% 50%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 1.2%;
    --secondary: 222.2 47.4% 11.2%;
    --secondary-foreground: 210 40% 98%;
    --muted: 223 47% 11%;
    --muted-foreground: 215.4 16.3% 56.9%;
    --accent: 216 34% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 210 40% 98%;
    --border: 216 34% 17%;
    --input: 216 34% 17%;
    --ring: 224 64% 33%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

## 💡 Hydration戦略

```typescript
// 要実装: クライアントディレクティブの選択基準
// client:load - 即座にロード
// client:idle - アイドル時にロード
// client:visible - 表示時にロード
// client:media - メディアクエリ一致時にロード
// client:only - クライアントのみでレンダリング
```