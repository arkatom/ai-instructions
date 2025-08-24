# Clean Architecture - テストユーティリティ

> テストヘルパーとCI/CD設定

## テストデータファクトリー

```typescript
// test-utils/factories.ts
export class TestDataFactory {
  static createUser(overrides: Partial<UserEntityProps> = {}): UserEntity {
    return new UserEntity({
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      ...overrides
    });
  }

  static createProduct(overrides: Partial<ProductEntityProps> = {}): ProductEntity {
    return new ProductEntity({
      id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Product',
      description: 'Test Description',
      price: 1000,
      currency: 'JPY',
      stockQuantity: 10,
      categoryId: 'test-category',
      isAvailable: true,
      ...overrides
    });
  }

  static createRegisterUserInput(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
    return {
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'John',
      lastName: 'Doe',
      ...overrides
    };
  }
}
```

## モックサービス

```typescript
// test-utils/mocks.ts
export class MockEmailService implements EmailService {
  private sentEmails: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sentEmails.push(message);
  }

  getSentEmails(): EmailMessage[] {
    return [...this.sentEmails];
  }

  reset(): void {
    this.sentEmails = [];
  }
}

export class InMemoryEventBus implements EventBus {
  private publishedEvents: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  reset(): void {
    this.publishedEvents = [];
  }
}
```

## テスト実行とCI/CD

### Jest設定

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts']
};
```