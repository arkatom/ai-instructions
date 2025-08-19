# TDD/BDD Patterns

Test-driven and behavior-driven development patterns.

## TDD (Test-Driven Development)

### Red-Green-Refactor Cycle
```typescript
// 1. RED: Write failing test
test('calculateTotal returns sum with tax', () => {
  expect(calculateTotal(100)).toBe(108);
});

// 2. GREEN: Make it pass with minimal code
const calculateTotal = (amount: number) => amount * 1.08;

// 3. REFACTOR: Improve the code
const TAX_RATE = 0.08;
const calculateTotal = (amount: number) => amount * (1 + TAX_RATE);
```

### Test-First Design
```typescript
describe('UserService', () => {
  test('creates user with valid email', async () => {
    const user = await createUser('test@example.com');
    expect(user.email).toBe('test@example.com');
    expect(user.id).toBeDefined();
  });
  
  test('rejects invalid email', async () => {
    await expect(createUser('invalid')).rejects.toThrow('Invalid email');
  });
});
```

## BDD (Behavior-Driven Development)

### Given-When-Then
```typescript
describe('Shopping Cart', () => {
  test('adds item to cart', () => {
    // Given: preconditions
    const cart = new Cart();
    const item = { id: '1', price: 100 };
    
    // When: action
    cart.add(item);
    
    // Then: expected outcome
    expect(cart.items).toContain(item);
    expect(cart.total).toBe(100);
  });
});
```

### User Story Driven
```typescript
// As a [role], I want [feature], so that [benefit]
describe('As a user, I want to filter products', () => {
  test('filters products by category', () => {
    const products = [
      { id: 1, category: 'electronics' },
      { id: 2, category: 'books' }
    ];
    
    const filtered = filterByCategory(products, 'books');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('books');
  });
});
```

## Test Strategy

### Test Pyramid
```typescript
// Unit Tests (70%)
test('utility function works', () => {
  expect(formatDate('2024-01-01')).toBe('Jan 1, 2024');
});

// Integration Tests (20%)
test('API endpoint returns data', async () => {
  const response = await request(app).get('/api/users');
  expect(response.status).toBe(200);
});

// E2E Tests (10%)
test('user can complete checkout', async () => {
  await page.goto('/shop');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  await expect(page).toHaveURL('/order-complete');
});
```

### Mocking Strategy
```typescript
jest.mock('./emailService');

test('sends welcome email on signup', async () => {
  const mockSend = jest.fn().mockResolvedValue(true);
  (emailService.send as jest.Mock) = mockSend;
  
  await userService.signup('test@example.com');
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ to: 'test@example.com' })
  );
});
```

## Best Practices

### AAA Pattern
```typescript
test('user authentication', () => {
  // Arrange: setup
  const credentials = { email: 'test@example.com', password: 'secure123' };
  
  // Act: execute
  const result = authenticate(credentials);
  
  // Assert: verify
  expect(result.success).toBe(true);
  expect(result.token).toBeDefined();
});
```

### F.I.R.S.T Principles
- **Fast**: Quick execution
- **Independent**: No dependencies
- **Repeatable**: Consistent results
- **Self-Validating**: Clear pass/fail
- **Timely**: Written just in time

## Checklist
- [ ] Test-first approach
- [ ] Red-Green-Refactor cycle
- [ ] BDD specifications
- [ ] Appropriate mocking
- [ ] Test pyramid adherence
- [ ] AAA pattern usage
- [ ] F.I.R.S.T principles