# Clean Architecture - 実装パターン集

> Uncle Bob's Clean Architectureの設計原則と実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **技術スタック**: TypeScript, Node.js, 依存性逆転原則

## 🎯 中核概念と設計原則

### 1. レイヤー構造と依存性ルール

```typescript
// core/entities/user.entity.ts
// エンティティ層 - 最も内側、ビジネスルールのみ
export class UserEntity {
  private readonly _id: string;
  private _email: string;
  private _passwordHash: string;
  private _firstName: string;
  private _lastName: string;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _lastLoginAt?: Date;
  private _failedLoginAttempts: number;
  private _lockedUntil?: Date;

  constructor(props: UserEntityProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._lastLoginAt = props.lastLoginAt;
    this._failedLoginAttempts = props.failedLoginAttempts ?? 0;
    this._lockedUntil = props.lockedUntil;
  }

  // ビジネスルール: メールアドレス変更
  changeEmail(newEmail: string): void {
    if (!this.isValidEmail(newEmail)) {
      throw new Error('Invalid email format');
    }
    
    if (this._email === newEmail) {
      return; // 変更なし
    }

    this._email = newEmail;
    this._updatedAt = new Date();
  }

  // ビジネスルール: ログイン試行
  recordLoginAttempt(success: boolean): void {
    if (success) {
      this._failedLoginAttempts = 0;
      this._lastLoginAt = new Date();
      this._lockedUntil = undefined;
    } else {
      this._failedLoginAttempts++;
      
      // 5回失敗でアカウントロック（30分）
      if (this._failedLoginAttempts >= 5) {
        const lockDuration = 30 * 60 * 1000; // 30分
        this._lockedUntil = new Date(Date.now() + lockDuration);
      }
    }
    
    this._updatedAt = new Date();
  }

  // ビジネスルール: アカウントロック確認
  isLocked(): boolean {
    if (!this._lockedUntil) {
      return false;
    }
    
    if (new Date() > this._lockedUntil) {
      this._lockedUntil = undefined;
      this._failedLoginAttempts = 0;
      return false;
    }
    
    return true;
  }

  // ビジネスルール: パスワード変更可能性
  canChangePassword(): boolean {
    return this._isActive && !this.isLocked();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Getters
  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get passwordHash(): string { return this._passwordHash; }
  get fullName(): string { return `${this._firstName} ${this._lastName}`; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }
  get failedLoginAttempts(): number { return this._failedLoginAttempts; }
}

interface UserEntityProps {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  failedLoginAttempts?: number;
  lockedUntil?: Date;
}

// core/entities/product.entity.ts
export class ProductEntity {
  private readonly _id: string;
  private _name: string;
  private _description: string;
  private _price: number;
  private _currency: string;
  private _stockQuantity: number;
  private _isAvailable: boolean;
  private _categoryId: string;
  private _tags: string[];
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ProductEntityProps) {
    this.validateProps(props);
    
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._price = props.price;
    this._currency = props.currency;
    this._stockQuantity = props.stockQuantity;
    this._isAvailable = props.isAvailable ?? true;
    this._categoryId = props.categoryId;
    this._tags = props.tags ?? [];
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ビジネスルール: 価格変更
  updatePrice(newPrice: number): void {
    if (newPrice < 0) {
      throw new Error('Price cannot be negative');
    }
    
    if (newPrice > this._price * 2) {
      throw new Error('Price increase cannot exceed 100%');
    }
    
    if (newPrice < this._price * 0.5) {
      throw new Error('Price decrease cannot exceed 50%');
    }
    
    this._price = newPrice;
    this._updatedAt = new Date();
  }

  // ビジネスルール: 在庫追加
  addStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    this._stockQuantity += quantity;
    this._updatedAt = new Date();
  }

  // ビジネスルール: 在庫減算
  removeStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    if (quantity > this._stockQuantity) {
      throw new Error('Insufficient stock');
    }
    
    this._stockQuantity -= quantity;
    
    // 在庫が0になったら利用不可にする
    if (this._stockQuantity === 0) {
      this._isAvailable = false;
    }
    
    this._updatedAt = new Date();
  }

  // ビジネスルール: 商品の購入可能性
  canBePurchased(quantity: number): boolean {
    return this._isAvailable && 
           this._stockQuantity >= quantity && 
           quantity > 0;
  }

  private validateProps(props: ProductEntityProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    
    if (props.price < 0) {
      throw new Error('Product price cannot be negative');
    }
    
    if (props.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
  }

  // Getters
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get price(): number { return this._price; }
  get currency(): string { return this._currency; }
  get stockQuantity(): number { return this._stockQuantity; }
  get isAvailable(): boolean { return this._isAvailable; }
  get categoryId(): string { return this._categoryId; }
  get tags(): string[] { return [...this._tags]; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}

interface ProductEntityProps {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  isAvailable?: boolean;
  categoryId: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 2. Use Case層（Application Business Rules）

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

### 3. Interface Adapters層

```typescript
// adapters/controllers/user.controller.ts
export class UserController {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private loginUserUseCase: LoginUserUseCase,
    private getUserProfileUseCase: GetUserProfileUseCase,
    private updateUserProfileUseCase: UpdateUserProfileUseCase
  ) {}

  async register(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { email, password, firstName, lastName } = request.body;

      const result = await this.registerUserUseCase.execute({
        email,
        password,
        firstName,
        lastName
      });

      if (result.success) {
        return {
          statusCode: 201,
          body: {
            message: 'User registered successfully',
            userId: result.userId
          }
        };
      }

      return {
        statusCode: 400,
        body: {
          error: result.error
        }
      };

    } catch (error) {
      return {
        statusCode: 500,
        body: {
          error: 'Internal server error'
        }
      };
    }
  }

  async login(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { email, password } = request.body;

      const result = await this.loginUserUseCase.execute({
        email,
        password
      });

      if (result.success) {
        return {
          statusCode: 200,
          body: {
            message: 'Login successful',
            token: result.token,
            user: result.user
          }
        };
      }

      return {
        statusCode: 401,
        body: {
          error: result.error || 'Invalid credentials'
        }
      };

    } catch (error) {
      return {
        statusCode: 500,
        body: {
          error: 'Internal server error'
        }
      };
    }
  }

  async getProfile(request: HttpRequest): Promise<HttpResponse> {
    try {
      const userId = request.params.userId;

      const result = await this.getUserProfileUseCase.execute({
        userId
      });

      if (result.success) {
        return {
          statusCode: 200,
          body: {
            user: result.user
          }
        };
      }

      return {
        statusCode: 404,
        body: {
          error: 'User not found'
        }
      };

    } catch (error) {
      return {
        statusCode: 500,
        body: {
          error: 'Internal server error'
        }
      };
    }
  }

  async updateProfile(request: HttpRequest): Promise<HttpResponse> {
    try {
      const userId = request.params.userId;
      const updates = request.body;

      const result = await this.updateUserProfileUseCase.execute({
        userId,
        updates
      });

      if (result.success) {
        return {
          statusCode: 200,
          body: {
            message: 'Profile updated successfully',
            user: result.user
          }
        };
      }

      return {
        statusCode: 400,
        body: {
          error: result.error
        }
      };

    } catch (error) {
      return {
        statusCode: 500,
        body: {
          error: 'Internal server error'
        }
      };
    }
  }
}

// adapters/presenters/user.presenter.ts
export class UserPresenter {
  presentUser(user: UserEntity): UserViewModel {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString()
    };
  }

  presentUserList(users: UserEntity[]): UserListViewModel {
    return {
      users: users.map(user => this.presentUser(user)),
      total: users.length
    };
  }

  presentUserProfile(user: UserEntity, stats?: UserStats): UserProfileViewModel {
    return {
      ...this.presentUser(user),
      stats: stats ? {
        totalOrders: stats.totalOrders,
        totalSpent: stats.totalSpent,
        memberSince: stats.memberSince,
        loyaltyPoints: stats.loyaltyPoints
      } : undefined
    };
  }
}

export interface UserViewModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserListViewModel {
  users: UserViewModel[];
  total: number;
}

export interface UserProfileViewModel extends UserViewModel {
  stats?: {
    totalOrders: number;
    totalSpent: number;
    memberSince: string;
    loyaltyPoints: number;
  };
}

// adapters/gateways/database/user-repository.impl.ts
export class UserRepositoryImpl implements UserRepository {
  constructor(
    private db: Database,
    private mapper: UserMapper
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapper.toDomain(result.rows[0]);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapper.toDomain(result.rows[0]);
  }

  async save(user: UserEntity): Promise<void> {
    const data = this.mapper.toPersistence(user);
    
    const query = `
      INSERT INTO users (
        id, email, password_hash, first_name, last_name,
        is_active, created_at, updated_at, last_login_at,
        failed_login_attempts, locked_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at,
        failed_login_attempts = EXCLUDED.failed_login_attempts,
        locked_until = EXCLUDED.locked_until
    `;
    
    await this.db.query(query, [
      data.id,
      data.email,
      data.passwordHash,
      data.firstName,
      data.lastName,
      data.isActive,
      data.createdAt,
      data.updatedAt,
      data.lastLoginAt,
      data.failedLoginAttempts,
      data.lockedUntil
    ]);
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async findAll(criteria?: FindUserCriteria): Promise<UserEntity[]> {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (criteria?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(criteria.isActive);
      paramIndex++;
    }
    
    if (criteria?.createdAfter) {
      query += ` AND created_at > $${paramIndex}`;
      params.push(criteria.createdAfter);
      paramIndex++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (criteria?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(criteria.limit);
      paramIndex++;
    }
    
    if (criteria?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(criteria.offset);
    }
    
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapper.toDomain(row));
  }
}

// adapters/mappers/user.mapper.ts
export class UserMapper {
  toDomain(raw: any): UserEntity {
    return new UserEntity({
      id: raw.id,
      email: raw.email,
      passwordHash: raw.password_hash,
      firstName: raw.first_name,
      lastName: raw.last_name,
      isActive: raw.is_active,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      lastLoginAt: raw.last_login_at,
      failedLoginAttempts: raw.failed_login_attempts,
      lockedUntil: raw.locked_until
    });
  }

  toPersistence(user: UserEntity): any {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil
    };
  }
}
```

### 4. Frameworks & Drivers層

```typescript
// infrastructure/web/express-app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

export class ExpressApp {
  private app: express.Application;

  constructor(
    private userController: UserController,
    private productController: ProductController,
    private orderController: OrderController,
    private authMiddleware: AuthMiddleware,
    private errorHandler: ErrorHandler,
    private logger: Logger
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // セキュリティ
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));

    // パフォーマンス
    this.app.use(compression());

    // ボディパーサー
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // レート制限
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 100, // リクエスト数制限
      message: 'Too many requests from this IP'
    });
    this.app.use('/api', limiter);

    // リクエストログ
    this.app.use((req, res, next) => {
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    const router = express.Router();

    // ユーザー関連
    router.post('/users/register', 
      this.adaptController(this.userController.register.bind(this.userController))
    );
    
    router.post('/users/login',
      this.adaptController(this.userController.login.bind(this.userController))
    );
    
    router.get('/users/:userId',
      this.authMiddleware.authenticate,
      this.adaptController(this.userController.getProfile.bind(this.userController))
    );
    
    router.put('/users/:userId',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeOwner,
      this.adaptController(this.userController.updateProfile.bind(this.userController))
    );

    // 商品関連
    router.get('/products',
      this.adaptController(this.productController.list.bind(this.productController))
    );
    
    router.get('/products/:productId',
      this.adaptController(this.productController.getById.bind(this.productController))
    );
    
    router.post('/products',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeAdmin,
      this.adaptController(this.productController.create.bind(this.productController))
    );
    
    router.put('/products/:productId',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeAdmin,
      this.adaptController(this.productController.update.bind(this.productController))
    );

    // 注文関連
    router.post('/orders',
      this.authMiddleware.authenticate,
      this.adaptController(this.orderController.place.bind(this.orderController))
    );
    
    router.get('/orders/:orderId',
      this.authMiddleware.authenticate,
      this.adaptController(this.orderController.getById.bind(this.orderController))
    );
    
    router.get('/users/:userId/orders',
      this.authMiddleware.authenticate,
      this.authMiddleware.authorizeOwner,
      this.adaptController(this.orderController.getUserOrders.bind(this.orderController))
    );

    this.app.use('/api/v1', router);

    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
  }

  private setupErrorHandling(): void {
    // 404ハンドラー
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });

    // エラーハンドラー
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.errorHandler.handle(err, req, res);
    });
  }

  private adaptController(controller: Function) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const httpRequest: HttpRequest = {
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers,
          user: (req as any).user
        };

        const httpResponse = await controller(httpRequest);

        res.status(httpResponse.statusCode).json(httpResponse.body);
      } catch (error) {
        next(error);
      }
    };
  }

  start(port: number): void {
    this.app.listen(port, () => {
      this.logger.info(`Server started on port ${port}`);
    });
  }
}

// infrastructure/database/postgres-connection.ts
import { Pool, PoolConfig } from 'pg';

export class PostgresConnection implements Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 2000,
    };

    this.pool = new Pool(poolConfig);

    // エラーハンドリング
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 5000) {
        console.warn('Slow query detected', { text, duration });
      }
      
      return {
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error('Query error', { text, params, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await callback({
        query: (text: string, params?: any[]) => client.query(text, params)
      });
      
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// infrastructure/services/jwt-auth.service.ts
import jwt from 'jsonwebtoken';

export class JWTAuthService implements AuthService {
  constructor(
    private secret: string,
    private expiresIn: string = '24h'
  ) {}

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'clean-architecture-app',
      audience: 'clean-architecture-users'
    });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'clean-architecture-app',
        audience: 'clean-architecture-users'
      }) as TokenPayload;
      
      return decoded;
    } catch (error) {
      return null;
    }
  }

  refreshToken(token: string): string | null {
    const payload = this.verifyToken(token);
    
    if (!payload) {
      return null;
    }
    
    // 新しいトークンを生成
    return this.generateToken({
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles
    });
  }
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

// infrastructure/services/bcrypt-password.service.ts
import bcrypt from 'bcrypt';

export class BcryptPasswordService implements PasswordHasher {
  private readonly saltRounds = 10;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

// infrastructure/services/redis-cache.service.ts
import Redis from 'ioredis';

export class RedisCacheService implements CacheService {
  private client: Redis;

  constructor(config: RedisConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('error', (error) => {
      console.error('Redis error', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    
    if (!value) {
      return null;
    }
    
    try {
      return JSON.parse(value);
    } catch {
      return value as any;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }
}
```

### 5. 依存性注入とコンテナ

```typescript
// main/container.ts
export class DIContainer {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();

  // インフラストラクチャ層の登録
  registerInfrastructure(): void {
    // データベース
    this.registerSingleton('database', () => 
      new PostgresConnection({
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT!),
        database: process.env.DB_NAME!,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!
      })
    );

    // キャッシュ
    this.registerSingleton('cache', () =>
      new RedisCacheService({
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!),
        password: process.env.REDIS_PASSWORD
      })
    );

    // 認証サービス
    this.registerSingleton('authService', () =>
      new JWTAuthService(process.env.JWT_SECRET!)
    );

    // パスワードサービス
    this.registerSingleton('passwordHasher', () =>
      new BcryptPasswordService()
    );

    // メールサービス
    this.registerSingleton('emailService', () =>
      new SendGridEmailService(process.env.SENDGRID_API_KEY!)
    );

    // イベントバス
    this.registerSingleton('eventBus', () =>
      new RabbitMQEventBus({
        url: process.env.RABBITMQ_URL!
      })
    );

    // ロガー
    this.registerSingleton('logger', () =>
      new WinstonLogger({
        level: process.env.LOG_LEVEL || 'info'
      })
    );
  }

  // リポジトリ層の登録
  registerRepositories(): void {
    this.registerSingleton('userRepository', () =>
      new UserRepositoryImpl(
        this.get('database'),
        new UserMapper()
      )
    );

    this.registerSingleton('productRepository', () =>
      new ProductRepositoryImpl(
        this.get('database'),
        new ProductMapper()
      )
    );

    this.registerSingleton('orderRepository', () =>
      new OrderRepositoryImpl(
        this.get('database'),
        new OrderMapper()
      )
    );

    this.registerSingleton('categoryRepository', () =>
      new CategoryRepositoryImpl(
        this.get('database'),
        new CategoryMapper()
      )
    );
  }

  // ユースケース層の登録
  registerUseCases(): void {
    // ユーザー関連
    this.register('registerUserUseCase', () =>
      new RegisterUserUseCaseImpl(
        this.get('userRepository'),
        this.get('passwordHasher'),
        this.get('emailService'),
        this.get('logger')
      )
    );

    this.register('loginUserUseCase', () =>
      new LoginUserUseCaseImpl(
        this.get('userRepository'),
        this.get('passwordHasher'),
        this.get('authService'),
        this.get('logger')
      )
    );

    this.register('getUserProfileUseCase', () =>
      new GetUserProfileUseCaseImpl(
        this.get('userRepository'),
        this.get('cache'),
        this.get('logger')
      )
    );

    // 商品関連
    this.register('createProductUseCase', () =>
      new CreateProductUseCaseImpl(
        this.get('productRepository'),
        this.get('categoryRepository'),
        this.get('eventBus'),
        this.get('logger')
      )
    );

    this.register('updateProductUseCase', () =>
      new UpdateProductUseCaseImpl(
        this.get('productRepository'),
        this.get('eventBus'),
        this.get('logger')
      )
    );

    // 注文関連
    this.register('placeOrderUseCase', () =>
      new PlaceOrderUseCaseImpl(
        this.get('userRepository'),
        this.get('productRepository'),
        this.get('orderRepository'),
        this.get('inventoryService'),
        this.get('paymentService'),
        this.get('eventBus'),
        this.get('logger')
      )
    );
  }

  // コントローラー層の登録
  registerControllers(): void {
    this.registerSingleton('userController', () =>
      new UserController(
        this.get('registerUserUseCase'),
        this.get('loginUserUseCase'),
        this.get('getUserProfileUseCase'),
        this.get('updateUserProfileUseCase')
      )
    );

    this.registerSingleton('productController', () =>
      new ProductController(
        this.get('createProductUseCase'),
        this.get('updateProductUseCase'),
        this.get('getProductUseCase'),
        this.get('listProductsUseCase')
      )
    );

    this.registerSingleton('orderController', () =>
      new OrderController(
        this.get('placeOrderUseCase'),
        this.get('getOrderUseCase'),
        this.get('getUserOrdersUseCase')
      )
    );
  }

  // ミドルウェアの登録
  registerMiddleware(): void {
    this.registerSingleton('authMiddleware', () =>
      new AuthMiddleware(
        this.get('authService'),
        this.get('userRepository')
      )
    );

    this.registerSingleton('errorHandler', () =>
      new ErrorHandler(this.get('logger'))
    );
  }

  // サービス登録メソッド
  register(name: string, factory: () => any): void {
    this.services.set(name, factory);
  }

  registerSingleton(name: string, factory: () => any): void {
    this.services.set(name, () => {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, factory());
      }
      return this.singletons.get(name);
    });
  }

  // サービス取得
  get<T>(name: string): T {
    const factory = this.services.get(name);
    
    if (!factory) {
      throw new Error(`Service not found: ${name}`);
    }
    
    return factory();
  }

  // 初期化
  async initialize(): Promise<void> {
    this.registerInfrastructure();
    this.registerRepositories();
    this.registerUseCases();
    this.registerControllers();
    this.registerMiddleware();
  }
}

// main/app.ts
export class Application {
  private container: DIContainer;
  private expressApp: ExpressApp;

  constructor() {
    this.container = new DIContainer();
  }

  async start(): Promise<void> {
    try {
      // 環境変数の検証
      this.validateEnvironment();

      // DIコンテナの初期化
      await this.container.initialize();

      // Expressアプリケーションの作成
      this.expressApp = new ExpressApp(
        this.container.get('userController'),
        this.container.get('productController'),
        this.container.get('orderController'),
        this.container.get('authMiddleware'),
        this.container.get('errorHandler'),
        this.container.get('logger')
      );

      // データベースマイグレーション
      await this.runMigrations();

      // サーバー起動
      const port = parseInt(process.env.PORT || '3000');
      this.expressApp.start(port);

      // グレースフルシャットダウン
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('Failed to start application', error);
      process.exit(1);
    }
  }

  private validateEnvironment(): void {
    const required = [
      'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
      'REDIS_HOST', 'REDIS_PORT',
      'JWT_SECRET',
      'SENDGRID_API_KEY',
      'RABBITMQ_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
  }

  private async runMigrations(): Promise<void> {
    const migrator = new DatabaseMigrator(this.container.get('database'));
    await migrator.run();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      try {
        // データベース接続を閉じる
        await this.container.get<Database>('database').close();
        
        // キャッシュ接続を閉じる
        await this.container.get<CacheService>('cache').close();
        
        // イベントバス接続を閉じる
        await this.container.get<EventBus>('eventBus').close();
        
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// main/index.ts
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// アプリケーション起動
const app = new Application();
app.start().catch(error => {
  console.error('Fatal error', error);
  process.exit(1);
});
```

このClean Architectureパターン集は以下の要素を包含しています：

1. **エンティティ層**: ビジネスルールとドメインロジック
2. **ユースケース層**: アプリケーション固有のビジネスルール
3. **インターフェースアダプター層**: コントローラー、プレゼンター、ゲートウェイ
4. **フレームワーク・ドライバー層**: 外部フレームワークとツール
5. **依存性注入**: DIコンテナによる依存関係の管理

これらのパターンにより、ビジネスロジックを外部の技術的詳細から独立させ、テスト可能で保守性の高いアーキテクチャを実現できます。