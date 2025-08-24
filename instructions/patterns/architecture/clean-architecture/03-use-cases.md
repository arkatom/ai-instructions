# Clean Architecture - Use Cases層

> アプリケーション固有のビジネスルールとユースケースの実装

## 概要

Use Cases層（アプリケーションビジネスルール層）は、Clean Architectureの第2層に位置し、アプリケーション固有のビジネスルールを実装します。この層では、エンティティを使用して特定のユースケースを実現し、システムの振る舞いを定義します。

## 基本構造

### ユースケースインターフェース設計

```typescript
// core/use-cases/user/register-user.use-case.ts
export interface RegisterUserUseCase {
  execute(input: RegisterUserInput): Promise<RegisterUserOutput>;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisterUserOutput {
  success: boolean;
  userId?: string;
  error?: string;
}
```

### ユーザー登録ユースケース実装

```typescript
export class RegisterUserUseCaseImpl implements RegisterUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordHasher: PasswordHasher,
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    try {
      // 入力検証
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // 既存ユーザーチェック
      const existingUser = await this.userRepository.findByEmail(input.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // パスワードハッシュ化
      const passwordHash = await this.passwordHasher.hash(input.password);

      // ユーザーエンティティ作成
      const user = new UserEntity({
        id: this.generateUserId(),
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName
      });

      // 永続化
      await this.userRepository.save(user);

      // ウェルカムメール送信（非同期）
      this.sendWelcomeEmail(user).catch(error => {
        this.logger.error('Failed to send welcome email', { error, userId: user.id });
      });

      this.logger.info('User registered successfully', { userId: user.id });

      return {
        success: true,
        userId: user.id
      };

    } catch (error) {
      this.logger.error('User registration failed', { error, input });
      
      return {
        success: false,
        error: 'Registration failed. Please try again.'
      };
    }
  }

  private validateInput(input: RegisterUserInput): { isValid: boolean; error?: string } {
    if (!this.isValidEmail(input.email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    if (!this.isStrongPassword(input.password)) {
      return { isValid: false, error: 'Password must be at least 8 characters with uppercase, lowercase, and number' };
    }

    if (!input.firstName || input.firstName.trim().length === 0) {
      return { isValid: false, error: 'First name is required' };
    }

    if (!input.lastName || input.lastName.trim().length === 0) {
      return { isValid: false, error: 'Last name is required' };
    }

    return { isValid: true };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isStrongPassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendWelcomeEmail(user: UserEntity): Promise<void> {
    await this.emailService.send({
      to: user.email,
      subject: 'Welcome to Our Platform',
      template: 'welcome',
      data: {
        firstName: user.firstName,
        email: user.email
      }
    });
  }
}
```

### 商品作成ユースケース

```typescript
// core/use-cases/product/create-product.use-case.ts
export interface CreateProductUseCase {
  execute(input: CreateProductInput): Promise<CreateProductOutput>;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  categoryId: string;
  tags?: string[];
}

export interface CreateProductOutput {
  success: boolean;
  productId?: string;
  error?: string;
}

export class CreateProductUseCaseImpl implements CreateProductUseCase {
  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async execute(input: CreateProductInput): Promise<CreateProductOutput> {
    try {
      // カテゴリー存在確認
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        return {
          success: false,
          error: 'Category not found'
        };
      }

      // 製品エンティティ作成
      const product = new ProductEntity({
        id: this.generateProductId(),
        name: input.name,
        description: input.description,
        price: input.price,
        currency: input.currency,
        stockQuantity: input.stockQuantity,
        categoryId: input.categoryId,
        tags: input.tags
      });

      // 永続化
      await this.productRepository.save(product);

      // イベント発行
      await this.eventBus.publish({
        type: 'ProductCreated',
        payload: {
          productId: product.id,
          name: product.name,
          price: product.price,
          categoryId: product.categoryId
        },
        timestamp: new Date()
      });

      this.logger.info('Product created successfully', { productId: product.id });

      return {
        success: true,
        productId: product.id
      };

    } catch (error) {
      this.logger.error('Product creation failed', { error, input });
      
      return {
        success: false,
        error: 'Product creation failed. Please try again.'
      };
    }
  }

  private generateProductId(): string {
    return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 複雑な注文処理ユースケース

```typescript
// core/use-cases/order/place-order.use-case.ts
export interface PlaceOrderUseCase {
  execute(input: PlaceOrderInput): Promise<PlaceOrderOutput>;
}

export interface PlaceOrderInput {
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface PlaceOrderOutput {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  error?: string;
}

export class PlaceOrderUseCaseImpl implements PlaceOrderUseCase {
  constructor(
    private userRepository: UserRepository,
    private productRepository: ProductRepository,
    private orderRepository: OrderRepository,
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    try {
      // ユーザー検証
      const user = await this.userRepository.findById(input.userId);
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Invalid user'
        };
      }

      // 注文アイテムの検証と価格計算
      const orderDetails = await this.validateAndCalculateOrder(input.items);
      if (!orderDetails.isValid) {
        return {
          success: false,
          error: orderDetails.error
        };
      }

      // 在庫予約
      const reservationId = await this.inventoryService.reserveItems(input.items);
      if (!reservationId) {
        return {
          success: false,
          error: 'Insufficient inventory'
        };
      }

      try {
        // 支払い処理
        const paymentResult = await this.paymentService.processPayment({
          userId: input.userId,
          amount: orderDetails.totalAmount,
          currency: orderDetails.currency,
          method: input.paymentMethod
        });

        if (!paymentResult.success) {
          await this.inventoryService.releaseReservation(reservationId);
          return {
            success: false,
            error: 'Payment failed'
          };
        }

        // 注文作成
        const order = new OrderEntity({
          id: this.generateOrderId(),
          userId: input.userId,
          items: orderDetails.items,
          totalAmount: orderDetails.totalAmount,
          currency: orderDetails.currency,
          shippingAddress: input.shippingAddress,
          paymentId: paymentResult.paymentId,
          status: 'CONFIRMED'
        });

        // 永続化
        await this.orderRepository.save(order);

        // 在庫確定
        await this.inventoryService.confirmReservation(reservationId, order.id);

        // イベント発行
        await this.eventBus.publish({
          type: 'OrderPlaced',
          payload: {
            orderId: order.id,
            userId: order.userId,
            totalAmount: order.totalAmount,
            itemCount: order.items.length
          },
          timestamp: new Date()
        });

        this.logger.info('Order placed successfully', { orderId: order.id });

        return {
          success: true,
          orderId: order.id,
          totalAmount: order.totalAmount
        };

      } catch (error) {
        // 在庫予約解放
        await this.inventoryService.releaseReservation(reservationId);
        throw error;
      }

    } catch (error) {
      this.logger.error('Order placement failed', { error, input });
      
      return {
        success: false,
        error: 'Order placement failed. Please try again.'
      };
    }
  }

  private async validateAndCalculateOrder(items: OrderItem[]): Promise<{
    isValid: boolean;
    items?: EnrichedOrderItem[];
    totalAmount?: number;
    currency?: string;
    error?: string;
  }> {
    const enrichedItems: EnrichedOrderItem[] = [];
    let totalAmount = 0;
    let currency: string | null = null;

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      
      if (!product) {
        return {
          isValid: false,
          error: `Product not found: ${item.productId}`
        };
      }

      if (!product.canBePurchased(item.quantity)) {
        return {
          isValid: false,
          error: `Product unavailable or insufficient stock: ${product.name}`
        };
      }

      if (currency && currency !== product.currency) {
        return {
          isValid: false,
          error: 'Mixed currencies not supported'
        };
      }

      currency = product.currency;
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      enrichedItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      });
    }

    return {
      isValid: true,
      items: enrichedItems,
      totalAmount,
      currency: currency!
    };
  }

  private generateOrderId(): string {
    return `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface EnrichedOrderItem extends OrderItem {
  productName: string;
  unitPrice: number;
  totalPrice: number;
}
```

## ユースケース設計の重要原則

### 1. 単一責任の原則
- 各ユースケースは1つの明確なビジネス機能を実現
- 複雑な処理は複数のユースケースに分割

### 2. 依存性の逆転
- インターフェース経由でリポジトリや外部サービスに依存
- 具体実装への直接依存を避ける

### 3. エラーハンドリング
- ビジネス例外と技術例外を明確に区別
- ユーザーフレンドリーなエラーメッセージを提供

### 4. トランザクション管理
- 複数の操作を含む場合は適切にトランザクション境界を設定
- 失敗時のロールバック戦略を実装

### 5. イベント駆動設計
- 重要なビジネスイベントを適切に発行
- 疎結合なシステム間連携を実現

## ベストプラクティス

### 入力検証
```typescript
private validateInput(input: any): ValidationResult {
  const errors: string[] = [];
  
  if (!input.email) {
    errors.push('Email is required');
  }
  
  if (!this.isValidEmail(input.email)) {
    errors.push('Invalid email format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 非同期処理
```typescript
// メール送信は失敗してもメインフローに影響しない
this.sendWelcomeEmail(user).catch(error => {
  this.logger.error('Failed to send welcome email', { error, userId: user.id });
});
```

### リソース管理
```typescript
// リソース確保後は必ずクリーンアップ
try {
  const reservationId = await this.inventoryService.reserveItems(items);
  // ... 処理
} catch (error) {
  await this.inventoryService.releaseReservation(reservationId);
  throw error;
}
```

Use Cases層は、アプリケーションの中核となるビジネスロジックを実装し、エンティティと外部世界の橋渡しを行う重要な層です。適切に設計されたユースケースは、システムの理解可能性と保守性を大幅に向上させます。