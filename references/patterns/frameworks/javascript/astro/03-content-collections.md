# Astro コンテンツコレクション

## 📝 Content Collections設定

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

export const collections = {
  'blog': blogCollection,
  'docs': docsCollection,
  'authors': authorsCollection,
};
```

## 📚 コンテンツユーティリティ

```typescript
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

export async function getRelatedBlogPosts(
  currentPost: BlogPost, 
  limit: number = 3
): Promise<BlogPost[]> {
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

## 📖 動的ブログページ

```astro
// src/pages/blog/[...slug].astro
---
import { getCollection, type CollectionEntry } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
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
  datePublished: post.data.publishedDate.toISOString(),
  dateModified: (post.data.updatedDate || post.data.publishedDate).toISOString(),
};
---

<BaseLayout
  title={post.data.seo?.title || post.data.title}
  description={post.data.seo?.description || post.data.description}
  image={post.data.image.src}
  structuredData={structuredData}
>
  <article class="container mx-auto px-4 py-8 max-w-4xl">
    <!-- 要実装: ブログヘッダー、目次、関連記事 -->
    <div class="prose prose-gray dark:prose-invert max-w-none">
      <Content />
    </div>
  </article>
</BaseLayout>
```

## 💡 パフォーマンス最適化

```typescript
// 要実装: コンテンツキャッシュ戦略
// - ビルド時の事前レンダリング
// - 増分静的再生成（ISR）
// - エッジキャッシング
```