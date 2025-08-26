# Astro テスト戦略

## 🧪 Playwright E2Eテスト

### ブログ機能テスト

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
```

## 📱 PWA機能テスト

```typescript
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
```

## 📸 ビジュアルリグレッションテスト

```typescript
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
```

## ⚡ パフォーマンステスト

```typescript
test.describe('Performance', () => {
  test('homepage should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 seconds
  });

  test('should have good Lighthouse scores', async ({ page }) => {
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

## 🔧 テスト設定

```javascript
// playwright.config.js
module.exports = {
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
};
```

## 💡 テストベストプラクティス

```typescript
// 要実装: テスト戦略の最適化
// - コンポーネントテスト
// - APIテスト
// - アクセシビリティテスト
// - 国際化テスト
// - セキュリティテスト
```