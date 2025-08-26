# Vite テストと品質保証

## 🧪 Vitest設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts'],
      thresholds: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 },
      },
    },
    
    threads: true,
    maxThreads: 4,
    isolate: true,
  },
  
  resolve: {
    alias: {
      '@': './src',
      '@test': './src/test',
    },
  },
});
```

## 🔧 テストセットアップ

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

beforeAll(() => {
  // ResizeObserver, IntersectionObserverのモック
  global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  global.fetch = vi.fn();
  
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

afterAll(() => vi.clearAllMocks());
```

## 📝 コンポーネントテスト

```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
  
  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
  
  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

// スナップショットテスト例
describe('Button Snapshots', () => {
  it('matches snapshot for default button', () => {
    const { container } = render(<Button>Default</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

## 🔄 フックテスト

```typescript
// src/hooks/__tests__/useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCounter } from '../useCounter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });
  
  it('increments count', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
  
  it('resets count', () => {
    const { result } = renderHook(() => useCounter(10));
    
    act(() => {
      result.current.increment();
      result.current.reset();
    });
    
    expect(result.current.count).toBe(10);
  });
});
```

## 🌐 APIテスト

```typescript
// src/api/__tests__/userService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from '../userService';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('userService', () => {
  beforeEach(() => mockFetch.mockReset());
  
  it('fetches user successfully', async () => {
    const mockUser = { id: 1, name: 'John Doe' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(mockUser),
    });
    
    const result = await userService.getUser(1);
    
    expect(mockFetch).toHaveBeenCalledWith('/api/users/1');
    expect(result).toEqual(mockUser);
  });
  
  it('handles API errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(userService.getUser(1)).rejects.toThrow('Network error');
  });
});
```

## 🎭 E2Eテスト設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});

// e2e/example.spec.ts
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/My App/);
  await expect(page.locator('h1')).toContainText('Welcome');
});

test('user can navigate to about page', async ({ page }) => {
  await page.goto('/');
  await page.click('text=About');
  await expect(page).toHaveURL('/about');
});
```

## 🔍 ビジュアルリグレッション

```typescript
// src/test/visual/component.visual.test.tsx
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('button variants', async ({ page }) => {
    await page.goto('/storybook/?path=/story/button--all-variants');
    await expect(page).toHaveScreenshot('button-variants.png');
  });
  
  test('responsive layouts', async ({ page }) => {
    await page.goto('/');
    
    // デスクトップ
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page).toHaveScreenshot('desktop-layout.png');
    
    // モバイル
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('mobile-layout.png');
  });
});
```

## ⚡ パフォーマンステスト

```typescript
// src/test/performance/lighthouse.test.ts
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('Performance Tests', () => {
  test('lighthouse audit for homepage', async ({ page }) => {
    await page.goto('/');
    
    await playAudit({
      page,
      port: 9222,
      thresholds: {
        performance: 90,
        accessibility: 90,
        'best-practices': 90,
        seo: 90,
      },
    });
  });
  
  test('bundle size limits', async ({ page }) => {
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0];
    });
    
    expect(performanceEntries.transferSize).toBeLessThan(1024 * 1024);
  });
});
```

## 🛡️ セキュリティテスト

```typescript
// src/test/security/xss.test.ts
import { test, expect } from '@playwright/test';

test.describe('XSS Protection', () => {
  test('prevents script injection in user input', async ({ page }) => {
    await page.goto('/profile');
    
    const maliciousScript = '<script>alert("xss")</script>';
    await page.fill('[data-testid="name-input"]', maliciousScript);
    await page.click('[data-testid="save-button"]');
    
    const nameDisplay = await page.locator('[data-testid="name-display"]').textContent();
    expect(nameDisplay).not.toContain('<script>');
    expect(nameDisplay).toBe(maliciousScript);
  });
});
```

## 💡 実装指針

```typescript
// テスト戦略:
// - テストピラミッド実装
// - モック・スタブ活用
// - CI連携自動化
// - パフォーマンステスト自動化
```