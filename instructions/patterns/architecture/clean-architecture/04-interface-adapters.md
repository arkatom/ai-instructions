# Clean Architecture - Interface Adapters層

> コントローラー、プレゼンター、ゲートウェイによる外部世界との橋渡し

## 概要

Interface Adapters層（インターフェースアダプタ層）は、Clean Architectureの第3層に位置し、外部からの入力を内部のユースケースが理解できる形式に変換し、内部のデータを外部が期待する形式に変換します。この層には、コントローラー、プレゼンター、ゲートウェイが含まれます。

## コントローラー設計

### HTTPコントローラーの実装

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
```

### GraphQLリゾルバー実装

```typescript
// adapters/controllers/graphql/user.resolver.ts
@Resolver(() => User)
export class UserResolver {
  constructor(
    private registerUserUseCase: RegisterUserUseCase,
    private getUserProfileUseCase: GetUserProfileUseCase,
    private updateUserProfileUseCase: UpdateUserProfileUseCase
  ) {}

  @Mutation(() => RegisterUserResponse)
  async registerUser(
    @Arg('input') input: RegisterUserInput
  ): Promise<RegisterUserResponse> {
    const result = await this.registerUserUseCase.execute(input);

    if (result.success) {
      return {
        success: true,
        userId: result.userId,
        message: 'User registered successfully'
      };
    }

    throw new UserInputError(result.error || 'Registration failed');
  }

  @Query(() => User)
  @UseMiddleware(AuthMiddleware)
  async getUserProfile(
    @Arg('userId') userId: string,
    @Ctx() context: GraphQLContext
  ): Promise<User> {
    // 認可チェック
    if (context.user.id !== userId && !context.user.isAdmin) {
      throw new ForbiddenError('Access denied');
    }

    const result = await this.getUserProfileUseCase.execute({ userId });

    if (result.success) {
      return result.user;
    }

    throw new ApolloError(result.error || 'User not found');
  }

  @Mutation(() => User)
  @UseMiddleware(AuthMiddleware)
  async updateUserProfile(
    @Arg('userId') userId: string,
    @Arg('input') input: UpdateUserProfileInput,
    @Ctx() context: GraphQLContext
  ): Promise<User> {
    // 認可チェック
    if (context.user.id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const result = await this.updateUserProfileUseCase.execute({
      userId,
      updates: input
    });

    if (result.success) {
      return result.user;
    }

    throw new UserInputError(result.error || 'Update failed');
  }
}
```

## プレゼンター設計

### ビューモデルの定義と変換

```typescript
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

  presentUserWithPermissions(user: UserEntity, permissions: Permission[]): UserWithPermissionsViewModel {
    return {
      ...this.presentUser(user),
      permissions: permissions.map(permission => ({
        id: permission.id,
        name: permission.name,
        scope: permission.scope,
        actions: permission.actions
      }))
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

export interface UserWithPermissionsViewModel extends UserViewModel {
  permissions: PermissionViewModel[];
}
```

### 商品プレゼンター

```typescript
// adapters/presenters/product.presenter.ts
export class ProductPresenter {
  presentProduct(product: ProductEntity, category?: CategoryEntity): ProductViewModel {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      formattedPrice: this.formatPrice(product.price, product.currency),
      stockQuantity: product.stockQuantity,
      isAvailable: product.isAvailable,
      category: category ? {
        id: category.id,
        name: category.name,
        slug: category.slug
      } : undefined,
      tags: product.tags,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };
  }

  presentProductList(
    products: ProductEntity[], 
    categories: Map<string, CategoryEntity>,
    pagination?: PaginationInfo
  ): ProductListViewModel {
    return {
      products: products.map(product => 
        this.presentProduct(product, categories.get(product.categoryId))
      ),
      pagination: pagination ? {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      } : undefined
    };
  }

  presentProductWithInventory(
    product: ProductEntity, 
    inventory: InventoryInfo
  ): ProductWithInventoryViewModel {
    return {
      ...this.presentProduct(product),
      inventory: {
        available: inventory.available,
        reserved: inventory.reserved,
        incoming: inventory.incoming,
        lastRestocked: inventory.lastRestocked?.toISOString()
      }
    };
  }

  private formatPrice(price: number, currency: string): string {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency
    }).format(price);
  }
}
```

## ゲートウェイ実装

### データベースリポジトリゲートウェイ

```typescript
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
```

### 外部APIゲートウェイ

```typescript
// adapters/gateways/external/payment-gateway.impl.ts
export class StripePaymentGateway implements PaymentGateway {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2022-11-15'
    });
  }

  async processPayment(request: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Stripeは最小通貨単位
        currency: request.currency.toLowerCase(),
        customer: request.customerId,
        payment_method: request.paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: request.returnUrl
      });

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentId: paymentIntent.id,
          status: 'completed'
        };
      }

      if (paymentIntent.status === 'requires_action') {
        return {
          success: false,
          paymentId: paymentIntent.id,
          status: 'requires_action',
          clientSecret: paymentIntent.client_secret
        };
      }

      return {
        success: false,
        error: 'Payment failed'
      };

    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) {
        return {
          success: false,
          error: error.message
        };
      }

      throw error;
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResponse> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed'
      };
    }
  }
}
```

## マッパー実装

### ドメインと永続化層のマッピング

```typescript
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

  toJSON(user: UserEntity): any {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString()
    };
  }
}
```

## 設計原則とベストプラクティス

### 1. 責任の分離
- コントローラー：リクエスト処理とレスポンス生成
- プレゼンター：データの表示形式変換
- ゲートウェイ：外部システムとのインターフェース

### 2. 依存性の逆転
```typescript
// 悪い例：具体実装に依存
class UserController {
  private userRepository = new PostgreSQLUserRepository();
}

// 良い例：抽象に依存
class UserController {
  constructor(private userRepository: UserRepository) {}
}
```

### 3. エラー処理の統一
```typescript
// 統一されたエラーレスポンス
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}
```

### 4. バリデーション戦略
```typescript
// 入力バリデーションはコントローラー層で実施
async register(request: HttpRequest): Promise<HttpResponse> {
  const validation = this.validateRegisterRequest(request.body);
  if (!validation.isValid) {
    return {
      statusCode: 400,
      body: { errors: validation.errors }
    };
  }
  
  // ユースケースの呼び出し
}
```

Interface Adapters層は、Clean Architectureにおける重要な変換層として、外部世界とビジネスロジックの間の適切な橋渡しを行います。