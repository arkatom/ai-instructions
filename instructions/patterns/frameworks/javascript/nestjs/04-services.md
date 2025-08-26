# NestJS サービス層

ビジネスロジックとドメインサービスの実装パターン。

## 💼 ビジネスロジック実装

### 基本的なサービス

```typescript
// user/user.service.ts
@Injectable()
export class UserService {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // ビジネスルール検証
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // ドメインエンティティ作成
    const user = User.create(dto.email, {
      name: dto.name,
      role: dto.role
    });

    // 永続化
    await this.userRepository.save(user);

    // イベント発行
    await this.eventBus.publish(
      new UserCreatedEvent(user.getId(), user.getEmail())
    );

    this.logger.log(`User created: ${user.getId()}`);

    return user;
  }

  async findById(id: string): Promise<User> {
    // キャッシュ確認
    const cacheKey = `user:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // リポジトリから取得
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // キャッシュ保存
    await this.cacheManager.set(cacheKey, user, 300);

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // ドメインメソッド呼び出し
    if (dto.profile) {
      user.updateProfile(dto.profile);
    }

    if (dto.email && dto.email !== user.getEmail()) {
      await this.validateEmailUniqueness(dto.email);
      user.changeEmail(dto.email);
    }

    // 永続化
    await this.userRepository.save(user);

    // キャッシュ無効化
    await this.cacheManager.del(`user:${id}`);

    // イベント発行
    await this.eventBus.publish(
      new UserUpdatedEvent(user.getId(), dto)
    );

    return user;
  }

  private async validateEmailUniqueness(email: string): Promise<void> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
  }
}
```

### ドメインサービス

```typescript
// domain/services/user-verification.service.ts
@Injectable()
export class UserVerificationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  async initiateVerification(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified()) {
      throw new BadRequestException('User already verified');
    }

    const verificationToken = this.generateVerificationToken();
    user.setVerificationToken(verificationToken);

    await this.userRepository.save(user);

    // メール送信
    await this.emailService.sendVerificationEmail(
      user.getEmail(),
      verificationToken
    );
  }

  async verifyUser(token: string): Promise<void> {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isTokenExpired()) {
      throw new BadRequestException('Verification token expired');
    }

    user.verify();
    await this.userRepository.save(user);

    // 確認完了イベント
    await this.eventBus.publish(
      new UserVerifiedEvent(user.getId())
    );
  }

  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
```

## 🔄 トランザクション管理

```typescript
// services/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
    private readonly eventBus: EventBus
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 在庫確認
      await this.productService.checkAvailability(
        dto.items,
        queryRunner.manager
      );

      // 注文作成
      const order = Order.create({
        userId,
        items: dto.items,
        shippingAddress: dto.shippingAddress
      });

      await queryRunner.manager.save(order);

      // 在庫減少
      await this.productService.decrementStock(
        dto.items,
        queryRunner.manager
      );

      // 支払い処理
      const payment = await this.paymentService.processPayment(
        order,
        dto.paymentMethod
      );

      order.confirmPayment(payment);
      await queryRunner.manager.save(order);

      // コミット
      await queryRunner.commitTransaction();

      // イベント発行（トランザクション外）
      await this.eventBus.publish(
        new OrderCreatedEvent(order)
      );

      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

## 🎯 ベストプラクティス

- **単一責任原則**: 各サービスは特定のビジネス領域に集中
- **依存性の注入**: インターフェース経由の依存関係
- **イベント駆動**: 疎結合な非同期通信
- **エラーハンドリング**: 適切な例外処理とロギング