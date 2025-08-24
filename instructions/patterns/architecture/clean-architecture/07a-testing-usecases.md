# Clean Architecture - ユースケーステスト

> ビジネスロジック層の単体テスト実装

## ユーザー登録ユースケース

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

## 注文処理ユースケース

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