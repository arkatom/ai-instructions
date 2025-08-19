# TDD/BDD

テスト駆動開発とビヘイビア駆動開発のパターン。

## TDD (Test-Driven Development)

### Red-Green-Refactor サイクル
```typescript
// 1. RED: 失敗するテストを書く
test('calculateTotal returns sum with tax', () => {
  expect(calculateTotal(100)).toBe(108);
});

// 2. GREEN: 最小限のコードで通す
const calculateTotal = (amount: number) => amount * 1.08;

// 3. REFACTOR: リファクタリング
const TAX_RATE = 0.08;
const calculateTotal = (amount: number) => amount * (1 + TAX_RATE);
```

### テストファースト設計
```typescript
// テストから仕様を定義
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
// Cucumber/Gherkin形式
describe('Shopping Cart', () => {
  test('adds item to cart', () => {
    // Given: 前提条件
    const cart = new Cart();
    const item = { id: '1', price: 100 };
    
    // When: アクション
    cart.add(item);
    
    // Then: 期待結果
    expect(cart.items).toContain(item);
    expect(cart.total).toBe(100);
  });
});
```

### ユーザーストーリー駆動
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

## テスト戦略

### テストピラミッド
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

### モック戦略
```typescript
// 外部依存のモック
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

## ベストプラクティス

### AAA パターン
```typescript
test('user authentication', () => {
  // Arrange: セットアップ
  const credentials = { email: 'test@example.com', password: 'secure123' };
  
  // Act: 実行
  const result = authenticate(credentials);
  
  // Assert: 検証
  expect(result.success).toBe(true);
  expect(result.token).toBeDefined();
});
```

### テストのF.I.R.S.T原則
- **Fast**: 高速実行
- **Independent**: 独立性
- **Repeatable**: 再現可能
- **Self-Validating**: 自己検証
- **Timely**: タイムリー

## チェックリスト
- [ ] テストファースト実践
- [ ] Red-Green-Refactor サイクル
- [ ] BDD形式で仕様記述
- [ ] 適切なモック使用
- [ ] テストピラミッド準拠
- [ ] AAA パターン適用
- [ ] F.I.R.S.T原則遵守