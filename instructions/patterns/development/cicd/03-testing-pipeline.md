# Testing Pipeline

## Test Strategy Matrix

```yaml
# .github/workflows/testing.yml
name: Testing Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests (Shard ${{ matrix.shard }}/4)
        run: npx jest --shard=${{ matrix.shard }}/4 --coverage
        env:
          CI: true
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unit-tests-shard-${{ matrix.shard }}

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install ${{ matrix.browser }}
      
      - name: Build application
        run: npm run build
      
      - name: Start application
        run: npm run start &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          BASE_URL: http://localhost:3000
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-results-${{ matrix.browser }}
          path: |
            test-results/
            playwright-report/
```

## Test Data Management

```javascript
// tests/fixtures/testData.js
class TestDataManager {
  constructor() {
    this.users = new Map();
    this.orders = new Map();
  }

  async createUser(userData = {}) {
    const user = {
      id: `user-${Date.now()}-${Math.random()}`,
      email: userData.email || `test-${Date.now()}@example.com`,
      name: userData.name || 'Test User',
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      ...userData
    };
    
    this.users.set(user.id, user);
    return user;
  }

  async cleanup() {
    // Clean up test data
    const userIds = Array.from(this.users.keys());
    const orderIds = Array.from(this.orders.keys());
    
    await Promise.all([
      this.deleteUsers(userIds),
      this.deleteOrders(orderIds)
    ]);
    
    this.users.clear();
    this.orders.clear();
  }

  async deleteUsers(userIds) {
    for (const id of userIds) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
    }
  }
}

// Global setup for test data
export const testDataManager = new TestDataManager();

beforeEach(async () => {
  await testDataManager.cleanup();
});

afterAll(async () => {
  await testDataManager.cleanup();
});
```

## Flaky Test Detection

```yaml
# .github/workflows/flaky-tests.yml
name: Flaky Test Detection

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  detect-flaky-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run tests multiple times
        run: |
          for i in {1..10}; do
            echo "Run $i"
            npm test -- --json --outputFile=test-results-$i.json || true
          done
      
      - name: Analyze flaky tests
        run: |
          python scripts/analyze-flaky-tests.py test-results-*.json > flaky-report.md
      
      - name: Create issue if flaky tests found
        if: steps.analyze.outputs.flaky_count > 0
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('flaky-report.md', 'utf8');
            
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Flaky Tests Detected',
              body: report,
              labels: ['bug', 'flaky-test']
            });
```

## Performance Testing Integration

```yaml
performance-tests:
  name: Performance Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Run Lighthouse CI
      run: |
        npm install -g @lhci/cli@0.12.x
        lhci autorun
      env:
        LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
    
    - name: Run load tests
      run: |
        docker run --rm -i grafana/k6 run - < tests/load/basic-load.js
    
    - name: Bundle size analysis
      run: |
        npm run build
        npx bundlesize
        
# tests/load/basic-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // Virtual Users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Less than 10% failure rate
  },
};

export default function () {
  const response = http.get('https://myapp.com/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

## Visual Regression Testing

```javascript
// tests/visual/visual.spec.js
import { test, expect } from '@playwright/test';

test('homepage visual regression', async ({ page }) => {
  await page.goto('/');
  
  // Wait for content to load
  await page.waitForSelector('[data-testid="main-content"]');
  
  // Hide dynamic content
  await page.addStyleTag({
    content: `
      .timestamp, .user-avatar, .live-data {
        visibility: hidden !important;
      }
    `
  });
  
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    threshold: 0.2
  });
});

test('responsive design regression', async ({ page }) => {
  const viewports = [
    { width: 375, height: 667 },   // Mobile
    { width: 768, height: 1024 },  // Tablet
    { width: 1920, height: 1080 }  // Desktop
  ];
  
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot(
      `homepage-${viewport.width}x${viewport.height}.png`
    );
  }
});
```

## Test Reporting Dashboard

```javascript
// scripts/generate-test-report.js
import fs from 'fs';
import path from 'path';

class TestReportGenerator {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, duration: 0 },
      integration: { passed: 0, failed: 0, duration: 0 },
      e2e: { passed: 0, failed: 0, duration: 0 }
    };
  }

  parseJestResults(filePath) {
    const results = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      passed: results.numPassedTests,
      failed: results.numFailedTests,
      duration: results.testResults.reduce((sum, test) => 
        sum + test.perfStats.runtime, 0
      )
    };
  }

  generateHTML() {
    const template = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Report</title></head>
        <body>
          <h1>Test Results Summary</h1>
          ${this.generateSummaryTable()}
          ${this.generateTrendChart()}
        </body>
      </html>
    `;
    return template;
  }

  generateSummaryTable() {
    const total = Object.values(this.results).reduce((acc, type) => ({
      passed: acc.passed + type.passed,
      failed: acc.failed + type.failed,
      duration: acc.duration + type.duration
    }), { passed: 0, failed: 0, duration: 0 });
    
    return `
      <table>
        <tr><th>Type</th><th>Passed</th><th>Failed</th><th>Duration</th></tr>
        ${Object.entries(this.results).map(([type, data]) => 
          `<tr><td>${type}</td><td>${data.passed}</td><td>${data.failed}</td><td>${data.duration}ms</td></tr>`
        ).join('')}
        <tr><th>Total</th><th>${total.passed}</th><th>${total.failed}</th><th>${total.duration}ms</th></tr>
      </table>
    `;
  }
}
```

## Best Practices

1. **Test Isolation**: Each test should be independent and idempotent
2. **Fast Feedback**: Run faster tests first, expensive tests last
3. **Parallel Execution**: Utilize test sharding and parallel jobs
4. **Stable Test Data**: Use factories and cleanup strategies
5. **Visual Testing**: Implement screenshot comparison for UI changes
6. **Performance Monitoring**: Include load and performance tests in CI
7. **Flaky Test Management**: Automatically detect and report unstable tests