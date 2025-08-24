# Clean Architecture - テスト戦略

> 各層に適したテスト手法と実装パターン

## 概要

Clean Architectureでは、各層の責任が明確に分離されているため、それぞれに適したテスト戦略を適用できます。依存性注入により、モックやスタブを効果的に使用して、高速で信頼性の高いテストスイートを構築できます。

## テストピラミッド

### 1. ユニットテスト（基盤）
- エンティティのビジネスルール
- ユースケースのロジック
- ドメインサービス

### 2. 統合テスト（中間）
- リポジトリとデータベース
- 外部サービスとの連携
- メッセージングシステム

### 3. E2Eテスト（頂点）
- API全体のワークフロー
- ユーザーシナリオ

## エンティティのユニットテスト

### ユーザーエンティティのテスト

```typescript
// __tests__/entities/user.entity.test.ts
describe('UserEntity', () => {
  let user: UserEntity;

  beforeEach(() => {
    user = new UserEntity({
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe'
    });
  });

  describe('changeEmail', () => {
    it('should change email when valid', () => {
      const newEmail = 'new@example.com';
      
      user.changeEmail(newEmail);
      
      expect(user.email).toBe(newEmail);
      expect(user.updatedAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should throw error for invalid email format', () => {
      expect(() => {
        user.changeEmail('invalid-email');
      }).toThrow('Invalid email format');
    });

    it('should not change email when same as current', () => {
      const originalUpdatedAt = user.updatedAt;
      
      user.changeEmail(user.email);
      
      expect(user.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe('recordLoginAttempt', () => {
    it('should reset failed attempts on successful login', () => {
      // 失敗を記録
      user.recordLoginAttempt(false);
      user.recordLoginAttempt(false);
      
      // 成功を記録
      user.recordLoginAttempt(true);
      
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).toBeDefined();
    });

    it('should increment failed attempts on failed login', () => {
      user.recordLoginAttempt(false);
      
      expect(user.failedLoginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        user.recordLoginAttempt(false);
      }
      
      expect(user.isLocked()).toBe(true);
      expect(user.failedLoginAttempts).toBe(5);
    });
  });

  describe('isLocked', () => {
    it('should return false when not locked', () => {
      expect(user.isLocked()).toBe(false);
    });

    it('should return true when locked and within lock period', () => {
      // 5回失敗させてロック
      for (let i = 0; i < 5; i++) {
        user.recordLoginAttempt(false);
      }
      
      expect(user.isLocked()).toBe(true);
    });

    it('should unlock after lock period expires', () => {
      // プライベートプロパティにアクセスするためのテストユーティリティ
      const pastLockTime = new Date(Date.now() - 31 * 60 * 1000); // 31分前
      (user as any)._lockedUntil = pastLockTime;
      (user as any)._failedLoginAttempts = 5;
      
      expect(user.isLocked()).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
    });
  });
});
```

### 商品エンティティのテスト

```typescript
// __tests__/entities/product.entity.test.ts
describe('ProductEntity', () => {
  let product: ProductEntity;

  beforeEach(() => {
    product = new ProductEntity({
      id: 'product-123',
      name: 'Test Product',
      description: 'Test Description',
      price: 1000,
      currency: 'JPY',
      stockQuantity: 10,
      categoryId: 'category-123'
    });
  });

  describe('updatePrice', () => {
    it('should update price when within valid range', () => {
      product.updatePrice(1500); // 50%増加
      
      expect(product.price).toBe(1500);
    });

    it('should throw error when price is negative', () => {
      expect(() => {
        product.updatePrice(-100);
      }).toThrow('Price cannot be negative');
    });

    it('should throw error when price increase exceeds 100%', () => {
      expect(() => {
        product.updatePrice(2100); // 110%増加
      }).toThrow('Price increase cannot exceed 100%');
    });

    it('should throw error when price decrease exceeds 50%', () => {
      expect(() => {
        product.updatePrice(400); // 60%減少
      }).toThrow('Price decrease cannot exceed 50%');
    });
  });

  describe('stock management', () => {
    it('should add stock correctly', () => {
      product.addStock(5);
      
      expect(product.stockQuantity).toBe(15);
    });

    it('should remove stock correctly', () => {
      product.removeStock(3);
      
      expect(product.stockQuantity).toBe(7);
      expect(product.isAvailable).toBe(true);
    });

    it('should mark as unavailable when stock reaches zero', () => {
      product.removeStock(10);
      
      expect(product.stockQuantity).toBe(0);
      expect(product.isAvailable).toBe(false);
    });

    it('should throw error when removing more stock than available', () => {
      expect(() => {
        product.removeStock(15);
      }).toThrow('Insufficient stock');
    });
  });

  describe('canBePurchased', () => {
    it('should return true when product is available and has sufficient stock', () => {
      expect(product.canBePurchased(5)).toBe(true);
    });

    it('should return false when quantity is zero or negative', () => {
      expect(product.canBePurchased(0)).toBe(false);
      expect(product.canBePurchased(-1)).toBe(false);
    });

    it('should return false when insufficient stock', () => {
      expect(product.canBePurchased(15)).toBe(false);
    });

    it('should return false when product is not available', () => {
      (product as any)._isAvailable = false;
      
      expect(product.canBePurchased(5)).toBe(false);
    });
  });
});
```

## ユースケースのユニットテスト

### ユーザー登録ユースケース

```typescript
// __tests__/use-cases/register-user.test.ts
describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCaseImpl;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPasswordHasher: jest.Mocked<PasswordHasher>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn()
    };

    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn()
    };

    mockEmailService = {
      send: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    useCase = new RegisterUserUseCaseImpl(
      mockUserRepository,
      mockPasswordHasher,
      mockEmailService,
      mockLogger
    );
  });

  describe('execute', () => {
    const validInput: RegisterUserInput = {
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue('hashed-password');
      mockEmailService.send.mockResolvedValue(undefined);

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.any(UserEntity)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.objectContaining({ userId: result.userId })
      );
    });

    it('should reject invalid email format', async () => {
      const invalidInput = { ...validInput, email: 'invalid-email' };

      const result = await useCase.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should reject weak password', async () => {
      const weakPasswordInput = { ...validInput, password: 'weak' };

      const result = await useCase.execute(weakPasswordInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least 8 characters');
    });

    it('should reject existing user', async () => {
      const existingUser = new UserEntity({
        id: 'existing-user',
        email: validInput.email,
        passwordHash: 'hash',
        firstName: 'Existing',
        lastName: 'User'
      });

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
      expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    });

    it('should handle password hashing error', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockRejectedValue(new Error('Hashing failed'));

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed. Please try again.');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should continue even if welcome email fails', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue('hashed-password');
      mockEmailService.send.mockRejectedValue(new Error('Email failed'));

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
    });
  });
});
```

### 注文処理ユースケース

```typescript
// __tests__/use-cases/place-order.test.ts
describe('PlaceOrderUseCase', () => {
  let useCase: PlaceOrderUseCaseImpl;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockInventoryService: jest.Mocked<InventoryService>;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // モックの初期化...
    useCase = new PlaceOrderUseCaseImpl(
      mockUserRepository,
      mockProductRepository,
      mockOrderRepository,
      mockInventoryService,
      mockPaymentService,
      mockEventBus,
      mockLogger
    );
  });

  describe('execute', () => {
    const validInput: PlaceOrderInput = {
      userId: 'user-123',
      items: [
        { productId: 'product-123', quantity: 2 }
      ],
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        postalCode: '12345'
      },
      paymentMethod: {
        type: 'credit_card',
        cardId: 'card-123'
      }
    };

    it('should place order successfully', async () => {
      const mockUser = createMockUser('user-123');
      const mockProduct = createMockProduct('product-123', 1000, 'JPY', 10);
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockInventoryService.reserveItems.mockResolvedValue('reservation-123');
      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        paymentId: 'payment-123'
      });
      mockInventoryService.confirmReservation.mockResolvedValue(undefined);

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.totalAmount).toBe(2000); // 2 items × 1000 JPY
      
      expect(mockOrderRepository.save).toHaveBeenCalledWith(
        expect.any(OrderEntity)
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OrderPlaced',
          payload: expect.objectContaining({
            orderId: result.orderId,
            userId: 'user-123',
            totalAmount: 2000
          })
        })
      );
    });

    it('should reject invalid user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user');
      expect(mockProductRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle payment failure and release inventory', async () => {
      const mockUser = createMockUser('user-123');
      const mockProduct = createMockProduct('product-123', 1000, 'JPY', 10);
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockInventoryService.reserveItems.mockResolvedValue('reservation-123');
      mockPaymentService.processPayment.mockResolvedValue({
        success: false,
        error: 'Payment declined'
      });

      const result = await useCase.execute(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
      expect(mockInventoryService.releaseReservation).toHaveBeenCalledWith('reservation-123');
    });

    it('should handle mixed currencies error', async () => {
      const mockUser = createMockUser('user-123');
      const items = [
        { productId: 'product-123', quantity: 1 },
        { productId: 'product-456', quantity: 1 }
      ];
      
      const input = { ...validInput, items };
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockProductRepository.findById
        .mockResolvedValueOnce(createMockProduct('product-123', 1000, 'JPY', 10))
        .mockResolvedValueOnce(createMockProduct('product-456', 20, 'USD', 5));

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mixed currencies not supported');
    });
  });

  // ヘルパー関数
  function createMockUser(id: string): UserEntity {
    return new UserEntity({
      id,
      email: 'test@example.com',
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'User',
      isActive: true
    });
  }

  function createMockProduct(id: string, price: number, currency: string, stock: number): ProductEntity {
    return new ProductEntity({
      id,
      name: 'Test Product',
      description: 'Test Description',
      price,
      currency,
      stockQuantity: stock,
      categoryId: 'category-123',
      isAvailable: true
    });
  }
});
```

## リポジトリ統合テスト

### PostgreSQL リポジトリテスト

```typescript
// __tests__/repositories/user-repository.integration.test.ts
describe('UserRepositoryImpl Integration Tests', () => {
  let database: PostgresConnection;
  let repository: UserRepositoryImpl;
  let mapper: UserMapper;

  beforeAll(async () => {
    // テストデータベース接続
    database = new PostgresConnection({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'test_db',
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test'
    });

    mapper = new UserMapper();
    repository = new UserRepositoryImpl(database, mapper);

    // テストテーブル作成
    await setupTestTables();
  });

  beforeEach(async () => {
    // 各テスト前にテーブルをクリーンアップ
    await database.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await database.close();
  });

  describe('save and findById', () => {
    it('should save and retrieve user', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      const retrieved = await repository.findById('user-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('user-123');
      expect(retrieved!.email).toBe('test@example.com');
      expect(retrieved!.firstName).toBe('John');
    });

    it('should update existing user', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      // エンティティを更新
      user.changeEmail('updated@example.com');

      await repository.save(user);

      const retrieved = await repository.findById('user-123');

      expect(retrieved!.email).toBe('updated@example.com');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      const retrieved = await repository.findByEmail('test@example.com');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('user-123');
    });

    it('should return null for non-existent email', async () => {
      const retrieved = await repository.findByEmail('nonexistent@example.com');

      expect(retrieved).toBeNull();
    });
  });

  describe('findAll with criteria', () => {
    beforeEach(async () => {
      // テストデータの準備
      const users = [
        new UserEntity({
          id: 'user-1',
          email: 'user1@example.com',
          passwordHash: 'hash',
          firstName: 'User1',
          lastName: 'Test',
          isActive: true
        }),
        new UserEntity({
          id: 'user-2',
          email: 'user2@example.com',
          passwordHash: 'hash',
          firstName: 'User2',
          lastName: 'Test',
          isActive: false
        }),
        new UserEntity({
          id: 'user-3',
          email: 'user3@example.com',
          passwordHash: 'hash',
          firstName: 'User3',
          lastName: 'Test',
          isActive: true
        })
      ];

      for (const user of users) {
        await repository.save(user);
      }
    });

    it('should find all users', async () => {
      const users = await repository.findAll();

      expect(users).toHaveLength(3);
    });

    it('should filter by active status', async () => {
      const activeUsers = await repository.findAll({ isActive: true });

      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.every(user => user.isActive)).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const users = await repository.findAll({ limit: 2, offset: 1 });

      expect(users).toHaveLength(2);
    });
  });

  async function setupTestTables(): Promise<void> {
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP
      )
    `;

    await database.query(createUserTable);
  }
});
```

## E2Eテスト

### API統合テスト

```typescript
// __tests__/e2e/user-api.e2e.test.ts
describe('User API E2E Tests', () => {
  let app: Application;
  let server: any;
  let container: TestDIContainer;

  beforeAll(async () => {
    // テスト用DIコンテナを使用
    container = new TestDIContainer();
    await container.initialize();

    app = new Application(container);
    server = await app.start(0); // ランダムポート
  });

  afterAll(async () => {
    await server.close();
    await container.cleanup();
  });

  beforeEach(async () => {
    await container.reset();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User registered successfully',
        userId: expect.any(String)
      });
    });

    it('should reject invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'Doe'
      };

      await request(server)
        .post('/api/v1/users/register')
        .send(invalidData)
        .expect(400);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // 最初の登録
      await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      // 重複登録
      await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /api/v1/users/login', () => {
    beforeEach(async () => {
      // テストユーザーを作成
      await request(server)
        .post('/api/v1/users/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com'
        })
      });
    });

    it('should reject invalid credentials', async () => {
      await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // ユーザー登録とログイン
      const registerResponse = await request(server)
        .post('/api/v1/users/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        });

      userId = registerResponse.body.userId;

      const loginResponse = await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        });

      authToken = loginResponse.body.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should reject request without token', async () => {
      await request(server)
        .get(`/api/v1/users/${userId}`)
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(server)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
```

## テストユーティリティ

### テストデータファクトリー

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

### モックサービス

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

Clean Architectureにおけるテスト戦略は、各層の責任に応じた適切なテスト手法を適用することで、高品質で保守しやすいコードベースを実現します。