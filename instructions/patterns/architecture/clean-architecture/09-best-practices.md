# Clean Architecture - ベストプラクティス

> 実践的なガイドラインと回避すべきアンチパターン

## 概要

Clean Architectureの成功は、適切な設計原則の適用と実践的なベストプラクティスの採用にかかっています。このガイドでは、長期間の開発とメンテナンスを通して学んだ重要なプラクティスとアンチパターンの回避方法を説明します。

## 設計原則のベストプラクティス

### 1. 依存性ルールの厳格な遵守

#### 良い例：インターフェースを通じた依存

```typescript
// ✅ 良い例：ユースケースがインターフェースに依存
export class RegisterUserUseCaseImpl implements RegisterUserUseCase {
  constructor(
    private userRepository: UserRepository,      // インターフェース
    private passwordHasher: PasswordHasher,      // インターフェース
    private emailService: EmailService          // インターフェース
  ) {}
}

// ✅ インターフェースは内側の層で定義
export interface UserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
}
```

#### 悪い例：具象クラスへの直接依存

```typescript
// ❌ 悪い例：ユースケースが具象実装に依存
import { PostgreSQLUserRepository } from '../../../infrastructure/database';

export class RegisterUserUseCaseImpl implements RegisterUserUseCase {
  constructor(
    private userRepository: PostgreSQLUserRepository  // ❌ 具象実装に依存
  ) {}
}
```

### 2. 単一責任原則の適用

#### エンティティの責任範囲

```typescript
// ✅ 良い例：明確な責任分離
export class UserEntity {
  // ユーザーのビジネスルールのみ実装
  changeEmail(newEmail: string): void { /* ... */ }
  recordLoginAttempt(success: boolean): void { /* ... */ }
  isLocked(): boolean { /* ... */ }
  
  // ❌ 永続化ロジックは含まない
  // save(): Promise<void> { /* ... */ }
  
  // ❌ プレゼンテーションロジックは含まない
  // toJSON(): any { /* ... */ }
}

// ✅ 永続化はリポジトリが担当
export class UserRepositoryImpl implements UserRepository {
  async save(user: UserEntity): Promise<void> { /* ... */ }
}

// ✅ プレゼンテーションはプレゼンターが担当
export class UserPresenter {
  present(user: UserEntity): UserViewModel { /* ... */ }
}
```

#### ユースケースの粒度管理

```typescript
// ✅ 良い例：単一の責任を持つユースケース
export class RegisterUserUseCase {
  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    // ユーザー登録のみに集中
  }
}

export class LoginUserUseCase {
  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    // ログインのみに集中
  }
}

// ❌ 悪い例：複数の責任を持つユースケース
export class UserManagementUseCase {
  async registerUser(input: any): Promise<any> { /* ... */ }
  async loginUser(input: any): Promise<any> { /* ... */ }
  async updateProfile(input: any): Promise<any> { /* ... */ }
  async deleteUser(input: any): Promise<any> { /* ... */ }
  // 複数の責任が混在している
}
```

## エンティティ設計のベストプラクティス

### 1. 不変性の確保

```typescript
// ✅ 良い例：イミュータブルなプロパティ
export class UserEntity {
  private readonly _id: string;           // 変更不可
  private _email: string;                 // 制御された変更のみ
  private readonly _createdAt: Date;      // 変更不可
  
  constructor(props: UserEntityProps) {
    this._id = props.id;
    this._email = props.email;
    this._createdAt = props.createdAt || new Date();
  }

  // ✅ ビジネスルールを通じた変更
  changeEmail(newEmail: string): void {
    this.validateEmail(newEmail);
    this._email = newEmail;
    this.updateTimestamp();
  }

  // ✅ 読み取り専用アクセス
  get id(): string { return this._id; }
  get email(): string { return this._email; }
}
```

### 2. ビジネスルールの集約

```typescript
// ✅ 良い例：ビジネスルールの一元化
export class ProductEntity {
  updatePrice(newPrice: number): void {
    this.validatePriceChange(newPrice);
    this.applyPriceChange(newPrice);
    this.recordPriceHistory(this._price, newPrice);
  }

  private validatePriceChange(newPrice: number): void {
    if (newPrice < 0) {
      throw new InvalidPriceError('Price cannot be negative');
    }
    
    const changeRatio = newPrice / this._price;
    if (changeRatio > 2.0) {
      throw new InvalidPriceError('Price increase cannot exceed 100%');
    }
    
    if (changeRatio < 0.5) {
      throw new InvalidPriceError('Price decrease cannot exceed 50%');
    }
  }

  canBePurchased(quantity: number): boolean {
    return this.isActive() && 
           this.hasAvailableStock(quantity) && 
           this.isNotDiscontinued() &&
           quantity > 0;
  }
}
```

### 3. ドメインイベントの活用

```typescript
// ✅ 良い例：重要なビジネスイベントの記録
export class OrderEntity extends AggregateRoot {
  confirmOrder(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new InvalidOrderStateError('Order is not in pending state');
    }

    this._status = OrderStatus.CONFIRMED;
    this._confirmedAt = new Date();

    // ドメインイベント発行
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this._id,
      userId: this._userId,
      totalAmount: this._totalAmount,
      confirmedAt: this._confirmedAt
    }));
  }

  cancel(reason: string): void {
    if (!this.canBeCancelled()) {
      throw new InvalidOrderStateError('Order cannot be cancelled');
    }

    this._status = OrderStatus.CANCELLED;
    this._cancelledAt = new Date();
    this._cancellationReason = reason;

    // ドメインイベント発行
    this.addDomainEvent(new OrderCancelledEvent({
      orderId: this._id,
      reason,
      cancelledAt: this._cancelledAt
    }));
  }
}
```

## ユースケース設計のベストプラクティス

### 1. 入力検証の統一

```typescript
// ✅ 良い例：統一された入力検証パターン
export class RegisterUserUseCaseImpl implements RegisterUserUseCase {
  async execute(input: RegisterUserInput): Promise<UseCaseResponse<RegisterUserOutput>> {
    // 1. 入力検証
    const validationResult = this.validateInput(input);
    if (!validationResult.isValid) {
      return UseCaseResponseBuilder.failure(
        'Validation failed',
        validationResult.errors
      );
    }

    try {
      // 2. ビジネスロジック実行
      const result = await this.performRegistration(input);
      
      // 3. 成功レスポンス
      return UseCaseResponseBuilder.success(result);
      
    } catch (error) {
      // 4. エラーハンドリング
      return this.handleError(error);
    }
  }

  private validateInput(input: RegisterUserInput): ValidationResult {
    const validator = new InputValidator()
      .required('email', input.email)
      .email('email', input.email)
      .required('password', input.password)
      .minLength('password', input.password, 8)
      .required('firstName', input.firstName)
      .required('lastName', input.lastName);

    return validator.validate();
  }

  private handleError(error: unknown): UseCaseResponse<RegisterUserOutput> {
    if (error instanceof DomainError) {
      return UseCaseResponseBuilder.failure(error.message);
    }

    this.logger.error('Unexpected error in RegisterUserUseCase', { error });
    return UseCaseResponseBuilder.failure('An unexpected error occurred');
  }
}
```

### 2. トランザクション管理

```typescript
// ✅ 良い例：適切なトランザクション境界
export class PlaceOrderUseCaseImpl implements PlaceOrderUseCase {
  async execute(input: PlaceOrderInput): Promise<UseCaseResponse<PlaceOrderOutput>> {
    return await this.transactionManager.runInTransaction(async (tx) => {
      // 1. 在庫予約
      const reservation = await this.inventoryService.reserveItems(input.items, tx);
      
      try {
        // 2. 支払い処理
        const payment = await this.paymentService.processPayment(input.payment, tx);
        
        // 3. 注文作成
        const order = this.createOrder(input, payment);
        await this.orderRepository.save(order, tx);
        
        // 4. 在庫確定
        await this.inventoryService.confirmReservation(reservation.id, tx);
        
        // 5. イベント発行（トランザクション後）
        tx.afterCommit(() => {
          this.eventBus.publish(new OrderPlacedEvent(order));
        });
        
        return UseCaseResponseBuilder.success({
          orderId: order.id,
          totalAmount: order.totalAmount
        });
        
      } catch (error) {
        // 支払いまたは注文作成失敗時の在庫予約解放
        await this.inventoryService.releaseReservation(reservation.id, tx);
        throw error;
      }
    });
  }
}
```

## リポジトリ実装のベストプラクティス

### 1. クエリの最適化

```typescript
// ✅ 良い例：効率的なクエリ実装
export class ProductRepositoryImpl implements ProductRepository {
  async findByCategoryWithStats(categoryId: string): Promise<ProductWithStats[]> {
    // ✅ 単一クエリでの効率的なデータ取得
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(os.total_sold, 0) as total_sold,
        COALESCE(r.avg_rating, 0) as avg_rating,
        COALESCE(r.review_count, 0) as review_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as total_sold
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'COMPLETED'
        GROUP BY product_id
      ) os ON p.id = os.product_id
      LEFT JOIN (
        SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM product_reviews
        GROUP BY product_id
      ) r ON p.id = r.product_id
      WHERE p.category_id = $1 AND p.is_active = true
      ORDER BY p.name
    `;

    const result = await this.db.query(query, [categoryId]);
    return result.rows.map(row => this.mapToProductWithStats(row));
  }

  // ✅ バッチ操作の実装
  async saveMultiple(products: ProductEntity[]): Promise<void> {
    if (products.length === 0) return;

    const values = products.map(product => this.mapper.toPersistence(product));
    const placeholders = values.map((_, index) => {
      const base = index * 6; // 6 columns
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    }).join(', ');

    const query = `
      INSERT INTO products (id, name, description, price, currency, category_id)
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        updated_at = CURRENT_TIMESTAMP
    `;

    const flatValues = values.flatMap(v => [v.id, v.name, v.description, v.price, v.currency, v.categoryId]);
    await this.db.query(query, flatValues);
  }
}
```

### 2. キャッシュ戦略

```typescript
// ✅ 良い例：適切なキャッシュ統合
export class CachedUserRepository implements UserRepository {
  constructor(
    private baseRepository: UserRepository,
    private cache: CacheService,
    private logger: Logger
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    const cacheKey = `user:${id}`;
    
    // キャッシュから取得試行
    const cached = await this.cache.get<UserData>(cacheKey);
    if (cached) {
      this.logger.debug('User found in cache', { userId: id });
      return this.mapper.toDomain(cached);
    }

    // データベースから取得
    const user = await this.baseRepository.findById(id);
    if (user) {
      // キャッシュに保存（15分TTL）
      await this.cache.set(cacheKey, this.mapper.toPersistence(user), 900);
    }

    return user;
  }

  async save(user: UserEntity): Promise<void> {
    await this.baseRepository.save(user);
    
    // キャッシュ更新
    const cacheKey = `user:${user.id}`;
    await this.cache.set(cacheKey, this.mapper.toPersistence(user), 900);
    
    // 関連キャッシュの無効化
    await this.cache.delete(`user_profile:${user.id}`);
  }
}
```

## テスト戦略のベストプラクティス

### 1. テストの構造化

```typescript
// ✅ 良い例：構造化されたテスト
describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCaseImpl;
  let dependencies: MockDependencies;

  beforeEach(() => {
    dependencies = createMockDependencies();
    useCase = new RegisterUserUseCaseImpl(
      dependencies.userRepository,
      dependencies.passwordHasher,
      dependencies.emailService,
      dependencies.logger
    );
  });

  describe('when input is valid', () => {
    const validInput: RegisterUserInput = {
      email: 'test@example.com',
      password: 'SecurePassword123',
      firstName: 'John',
      lastName: 'Doe'
    };

    describe('and user does not exist', () => {
      beforeEach(() => {
        dependencies.userRepository.findByEmail.mockResolvedValue(null);
        dependencies.passwordHasher.hash.mockResolvedValue('hashed-password');
      });

      it('should register user successfully', async () => {
        const result = await useCase.execute(validInput);

        expect(result.success).toBe(true);
        expect(result.data?.userId).toBeDefined();
        expect(dependencies.userRepository.save).toHaveBeenCalledWith(
          expect.any(UserEntity)
        );
      });

      it('should send welcome email', async () => {
        await useCase.execute(validInput);

        expect(dependencies.emailService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: validInput.email,
            template: 'welcome'
          })
        );
      });
    });

    describe('and user already exists', () => {
      beforeEach(() => {
        const existingUser = TestDataFactory.createUser({ email: validInput.email });
        dependencies.userRepository.findByEmail.mockResolvedValue(existingUser);
      });

      it('should return failure with appropriate error', async () => {
        const result = await useCase.execute(validInput);

        expect(result.success).toBe(false);
        expect(result.error).toBe('User with this email already exists');
        expect(dependencies.userRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('when input is invalid', () => {
    const testCases = [
      {
        description: 'missing email',
        input: { email: '', password: 'Password123', firstName: 'John', lastName: 'Doe' },
        expectedError: 'Email is required'
      },
      {
        description: 'invalid email format',
        input: { email: 'invalid-email', password: 'Password123', firstName: 'John', lastName: 'Doe' },
        expectedError: 'Invalid email format'
      },
      {
        description: 'weak password',
        input: { email: 'test@example.com', password: 'weak', firstName: 'John', lastName: 'Doe' },
        expectedError: 'Password must be at least 8 characters'
      }
    ];

    testCases.forEach(({ description, input, expectedError }) => {
      it(`should reject ${description}`, async () => {
        const result = await useCase.execute(input as RegisterUserInput);

        expect(result.success).toBe(false);
        expect(result.error).toContain(expectedError);
      });
    });
  });
});
```

### 2. 統合テストの実装

```typescript
// ✅ 良い例：実用的な統合テスト
describe('User Registration Integration', () => {
  let app: TestApplication;

  beforeEach(async () => {
    app = new TestApplication();
    await app.start();
  });

  afterEach(async () => {
    await app.cleanup();
  });

  it('should complete full registration workflow', async () => {
    const userData = {
      email: 'integration@example.com',
      password: 'SecurePassword123',
      firstName: 'Integration',
      lastName: 'Test'
    };

    // 1. ユーザー登録
    const registerResponse = await app.request()
      .post('/api/users/register')
      .send(userData)
      .expect(201);

    const { userId } = registerResponse.body.data;

    // 2. データベース確認
    const savedUser = await app.database.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    expect(savedUser.rows).toHaveLength(1);
    expect(savedUser.rows[0].email).toBe(userData.email);

    // 3. ウェルカムメール送信確認
    const sentEmails = app.mockEmailService.getSentEmails();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(userData.email);

    // 4. ログイン可能確認
    const loginResponse = await app.request()
      .post('/api/users/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(200);

    expect(loginResponse.body.data.token).toBeDefined();
  });
});
```

## パフォーマンスのベストプラクティス

### 1. 非同期処理の最適化

```typescript
// ✅ 良い例：並列処理の活用
export class OrderSummaryService {
  async generateOrderSummary(orderId: string): Promise<OrderSummary> {
    // 独立した処理を並列実行
    const [order, items, user, shipping] = await Promise.all([
      this.orderRepository.findById(orderId),
      this.orderItemRepository.findByOrderId(orderId),
      this.getUserInfo(orderId),
      this.getShippingInfo(orderId)
    ]);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    return this.buildOrderSummary(order, items, user, shipping);
  }

  private async getUserInfo(orderId: string): Promise<UserInfo> {
    const order = await this.orderRepository.findById(orderId);
    return this.userRepository.findById(order!.userId);
  }

  private async getShippingInfo(orderId: string): Promise<ShippingInfo> {
    return this.shippingService.getShippingInfo(orderId);
  }
}
```

### 2. メモリ効率の向上

```typescript
// ✅ 良い例：ストリーミング処理
export class LargeDataExporter {
  async exportUserData(filter: UserFilter): Promise<void> {
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // バッチ単位でデータを処理
      const users = await this.userRepository.findWithPagination({
        ...filter,
        limit: batchSize,
        offset
      });

      if (users.length === 0) {
        hasMore = false;
        continue;
      }

      // ストリーミングで出力
      await this.exportBatch(users);

      offset += batchSize;
      hasMore = users.length === batchSize;
    }
  }

  private async exportBatch(users: UserEntity[]): Promise<void> {
    const data = users.map(user => this.presenter.presentForExport(user));
    await this.fileWriter.writeChunk(data);
    
    // メモリ解放のためのヒント
    users.length = 0;
  }
}
```

## よくあるアンチパターンと対策

### 1. 神クラス（God Class）

```typescript
// ❌ アンチパターン：神クラス
export class UserService {
  // 100以上のメソッドを持つクラス
  async registerUser(data: any): Promise<any> { /* ... */ }
  async loginUser(data: any): Promise<any> { /* ... */ }
  async updateProfile(data: any): Promise<any> { /* ... */ }
  async deleteUser(data: any): Promise<any> { /* ... */ }
  async sendEmail(data: any): Promise<any> { /* ... */ }
  async validatePassword(data: any): Promise<any> { /* ... */ }
  async generateReport(data: any): Promise<any> { /* ... */ }
  // ... 無数のメソッド
}

// ✅ 改善：責任の分割
export class RegisterUserUseCase { /* ... */ }
export class LoginUserUseCase { /* ... */ }
export class UpdateUserProfileUseCase { /* ... */ }
export class UserEmailService { /* ... */ }
export class UserReportService { /* ... */ }
```

### 2. 循環依存

```typescript
// ❌ アンチパターン：循環依存
// user.service.ts
import { OrderService } from './order.service';

export class UserService {
  constructor(private orderService: OrderService) {}
}

// order.service.ts
import { UserService } from './user.service';

export class OrderService {
  constructor(private userService: UserService) {}
}

// ✅ 改善：依存の整理
// 共通のインターフェースを導入
export interface UserProvider {
  findById(id: string): Promise<UserEntity | null>;
}

export class OrderService {
  constructor(private userProvider: UserProvider) {}
}
```

### 3. 貧弱なドメインモデル

```typescript
// ❌ アンチパターン：貧弱なドメインモデル
export class User {
  id: string;
  email: string;
  password: string;
  // ただのデータホルダー
}

export class UserService {
  // すべてのビジネスロジックがサービスに集中
  isValidUser(user: User): boolean { /* ... */ }
  canChangePassword(user: User): boolean { /* ... */ }
  lockUser(user: User): void { /* ... */ }
}

// ✅ 改善：リッチドメインモデル
export class UserEntity {
  // ビジネスルールをエンティティ内に実装
  isValid(): boolean { /* ... */ }
  canChangePassword(): boolean { /* ... */ }
  lock(): void { /* ... */ }
  
  // カプセル化されたデータ
  private _id: string;
  private _email: string;
  private _passwordHash: string;
}
```

## まとめ

Clean Architectureの成功は、以下の要素の適切な組み合わせにかかっています：

1. **明確な責任分離**：各層とクラスが単一の責任を持つ
2. **適切な抽象化**：インターフェースを通じた疎結合
3. **ドメイン中心設計**：ビジネスロジックの中核化
4. **テスト可能性**：依存性注入による高いテスタビリティ
5. **段階的実装**：漸進的な機能追加と改善

これらのベストプラクティスを適用することで、長期的に保守可能で拡張性の高いアプリケーションを構築できます。