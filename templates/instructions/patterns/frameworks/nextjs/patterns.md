# Next.js Patterns

Full-stack React patterns with App Router (Next.js 13+).

## App Router Structure

### Directory Layout
```
app/
├── layout.tsx          # Root layout
├── page.tsx           # Home page
├── api/               # API routes
│   └── users/
│       └── route.ts
├── (auth)/            # Route groups
│   ├── login/
│   └── register/
└── dashboard/
    ├── layout.tsx     # Nested layout
    └── page.tsx
```

## Server Components

### Data Fetching
```tsx
// app/products/page.tsx - Server component by default
async function ProductsPage() {
  const products = await prisma.product.findMany();
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### Streaming SSR
```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<ProductsSkeleton />}>
        <Products />
      </Suspense>
    </>
  );
}

async function Products() {
  const products = await fetchProducts();
  return <ProductList products={products} />;
}
```

## Client Components

### Interactive Features
```tsx
'use client';

import { useState } from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

## Route Handlers

### API Routes
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const users = await getUsers();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await createUser(body);
  return NextResponse.json(user, { status: 201 });
}
```

## Server Actions

### Form Handling
```tsx
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title');
  const content = formData.get('content');
  
  await prisma.post.create({
    data: { title, content }
  });
  
  revalidatePath('/posts');
}

// Usage in component
export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Performance

### Image Optimization
```tsx
import Image from 'next/image';

export function ProductImage({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={500}
      height={300}
      loading="lazy"
      placeholder="blur"
    />
  );
}
```

### Font Optimization
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function Layout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

## Caching

### Data Cache
```typescript
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache', // Default
  // cache: 'no-store',  // Disable cache
  // next: { revalidate: 60 } // Revalidate after 60s
});
```

## Checklist
- [ ] App Router used
- [ ] Server/Client separation
- [ ] Server Actions utilized
- [ ] Images optimized
- [ ] Fonts optimized
- [ ] Caching strategy
- [ ] Streaming SSR implemented
