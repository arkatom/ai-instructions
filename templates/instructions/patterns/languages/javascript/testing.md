# JavaScript Testing Patterns

## Unit Testing with Jest

### Basic Test Structure
Organize tests clearly and consistently.

```javascript
// Good
describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });
    
    it('should handle negative numbers', () => {
      expect(add(-1, -1)).toBe(-2);
    });
    
    it('should return NaN for non-numeric inputs', () => {
      expect(add('a', 'b')).toBeNaN();
    });
  });
});

// Test naming: should + expected behavior + condition
it('should throw error when dividing by zero', () => {
  expect(() => divide(10, 0)).toThrow('Division by zero');
});
```

### Mocking
Isolate units and control dependencies.

```javascript
// Good - Mock external dependencies
jest.mock('./api');
import { fetchUser } from './api';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should fetch and transform user data', async () => {
    const mockUser = { id: 1, name: 'Alice' };
    fetchUser.mockResolvedValue(mockUser);
    
    const result = await getUserProfile(1);
    
    expect(fetchUser).toHaveBeenCalledWith(1);
    expect(fetchUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ...mockUser,
      displayName: 'Alice'
    });
  });
});

// Spy on existing methods
const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
```

## React Testing

### Component Testing
Test components with React Testing Library.

```javascript
// Good - Test user behavior, not implementation
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('LoginForm', () => {
  it('should submit form with valid credentials', async () => {
    const handleSubmit = jest.fn();
    render(<LoginForm onSubmit={handleSubmit} />);
    
    const user = userEvent.setup();
    
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123'
      });
    });
  });
  
  it('should show error for invalid email', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.blur(emailInput);
    
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

### Custom Hooks Testing
Test hooks in isolation.

```javascript
// Good
import { renderHook, act } from '@testing-library/react';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());
    
    expect(result.current.count).toBe(0);
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
  
  it('should reset to initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    
    act(() => {
      result.current.increment();
      result.current.reset();
    });
    
    expect(result.current.count).toBe(10);
  });
});
```

## API Testing

### Mocking HTTP Requests
Test API calls without real network requests.

```javascript
// Good - MSW for API mocking
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users/:id', (req, res, ctx) => {
    return res(ctx.json({ id: req.params.id, name: 'Test User' }));
  }),
  
  rest.post('/api/users', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ id: 123, ...req.body }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('should fetch user data', async () => {
  const user = await fetchUser(1);
  expect(user).toEqual({ id: '1', name: 'Test User' });
});
```

## Integration Testing

### Database Testing
Test with real database interactions.

```javascript
// Good - Use test database
describe('UserRepository', () => {
  let db;
  
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  
  afterAll(async () => {
    await db.close();
  });
  
  beforeEach(async () => {
    await db.clean();
  });
  
  it('should create and retrieve user', async () => {
    const repo = new UserRepository(db);
    
    const created = await repo.create({
      name: 'Alice',
      email: 'alice@example.com'
    });
    
    const retrieved = await repo.findById(created.id);
    
    expect(retrieved).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com'
    });
  });
});
```

## E2E Testing

### Playwright/Cypress Tests
Test complete user flows.

```javascript
// Good - Playwright example
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should complete registration flow', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('[name="email"]', 'newuser@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.fill('[name="confirmPassword"]', 'SecurePass123!');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });
  
  test('should handle validation errors', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error')).toContainText('Invalid email');
  });
});
```

## Test Utilities

### Test Data Factories
Generate consistent test data.

```javascript
// Good
const createUser = (overrides = {}) => ({
  id: faker.datatype.uuid(),
  name: faker.name.fullName(),
  email: faker.internet.email(),
  createdAt: new Date(),
  ...overrides
});

const createPost = (overrides = {}) => ({
  id: faker.datatype.uuid(),
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(),
  authorId: overrides.authorId || createUser().id,
  ...overrides
});

// Usage
it('should display user posts', () => {
  const user = createUser();
  const posts = Array.from({ length: 5 }, () => 
    createPost({ authorId: user.id })
  );
  
  // Test logic...
});
```

### Custom Matchers
Create domain-specific assertions.

```javascript
// Good
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => 
        `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
});

// Usage
it('should generate random number in range', () => {
  const result = randomInRange(1, 10);
  expect(result).toBeWithinRange(1, 10);
});
```

## Performance Testing

### Benchmark Tests
Measure and assert performance.

```javascript
// Good
describe('Performance', () => {
  it('should process large dataset within time limit', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    
    const start = performance.now();
    const result = processArray(largeArray);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100); // 100ms limit
    expect(result).toHaveLength(10000);
  });
  
  it('should not exceed memory limit', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    processLargeData();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    expect(memoryIncrease).toBeLessThan(50); // 50MB limit
  });
});
```

## Best Practices Checklist

- [ ] Write tests before or alongside code (TDD/BDD)
- [ ] Test behavior, not implementation details
- [ ] Use descriptive test names
- [ ] Keep tests independent and isolated
- [ ] Mock external dependencies
- [ ] Use test data factories
- [ ] Clean up after tests (teardown)
- [ ] Test edge cases and error scenarios
- [ ] Maintain high code coverage (80%+)
- [ ] Run tests in CI/CD pipeline
- [ ] Use snapshot testing sparingly
- [ ] Keep tests fast and deterministic