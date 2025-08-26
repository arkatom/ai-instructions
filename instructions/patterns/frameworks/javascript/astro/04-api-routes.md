# Astro APIルートとサーバー機能

## 🔍 検索APIエンドポイント

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
```

## 📧 ニュースレターAPI

```typescript
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

    // 要実装: データベース保存、メール送信、メーリングリストサービス連携

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
```

## 📰 RSSフィード

```typescript
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

## 🔐 認証と保護されたエンドポイント

```typescript
// src/pages/api/protected.ts
import type { APIRoute } from 'astro';
import jwt from 'jsonwebtoken';

export const GET: APIRoute = async ({ request }) => {
  // 要実装: JWT検証、認証チェック
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  // 要実装: トークン検証とユーザー情報取得
  
  return new Response(JSON.stringify({ user: {} }), {
    status: 200,
  });
};
```

## 💡 ベストプラクティス

```typescript
// 要実装: APIエンドポイントのベストプラクティス
// - エラーハンドリング
// - レート制限
// - キャッシング戦略
// - CORS設定
// - 入力検証
```