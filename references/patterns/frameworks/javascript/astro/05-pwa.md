# Astro Progressive Web App (PWA)

## 🔧 Service Worker実装

```javascript
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
```

## 📱 マニフェスト設定

```json
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
```

## 🚫 オフラインページ

```astro
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
        class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors"
      >
        再読み込み
      </button>
    </div>
  </div>
</BaseLayout>
```

## 🔔 インストールプロンプト

```typescript
// src/components/InstallPrompt.tsx
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 p-4 bg-primary text-primary-foreground rounded-lg shadow-lg md:max-w-sm">
      <p className="mb-2">アプリをインストールして、より快適にご利用ください</p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="flex-1 bg-white text-primary rounded px-3 py-1">
          インストール
        </button>
        <button onClick={() => setShowPrompt(false)} className="px-3 py-1">
          閉じる
        </button>
      </div>
    </div>
  );
}
```

## 💡 PWA最適化

```typescript
// 要実装: PWA最適化戦略
// - アセットプリキャッシング
// - バックグラウンド同期
// - プッシュ通知
// - オフラインファースト戦略
```