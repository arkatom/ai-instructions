# NestJS 基礎概念 - DDD & クリーンアーキテクチャ

ドメイン駆動設計とクリーンアーキテクチャの実装パターン。

## 🏗️ ドメイン駆動設計

### エンティティとValue Object

```typescript
// domain/user.entity.ts
export class User {
  constructor(
    private readonly id: UserId,
    private readonly email: Email,
    private readonly profile: UserProfile,
    private readonly createdAt: Date = new Date()
  ) {}

  static create(email: string, profile: UserProfileDto): User {
    const userId = UserId.generate();
    const userEmail = Email.create(email);
    const userProfile = UserProfile.create(profile);
    
    return new User(userId, userEmail, userProfile);
  }

  updateProfile(profileData: UserProfileDto): void {
    this.profile.update(profileData);
    // ドメインイベント発行
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.id.value,
      email: this.email.value,
      profile: this.profile.toSnapshot(),
      createdAt: this.createdAt
    };
  }
}

// value-objects/user-id.ts
export class UserId {
  constructor(public readonly value: string) {
    if (!value) throw new Error('User ID cannot be empty');
  }

  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}
```

### ユースケース層

```typescript
// application/use-cases/create-user.use-case.ts
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    // ビジネスルール検証
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // ドメインエンティティ作成
    const user = User.create(command.email, command.profile);
    
    // 永続化
    await this.userRepository.save(user);
    
    // ドメインイベント発行
    await this.eventBus.publish(
      new UserCreatedEvent(user.getId(), user.getEmail())
    );

    return { success: true, userId: user.getId() };
  }
}
```

## 🎯 クリーンアーキテクチャ

### レイヤー構造

```
src/
├── domain/           # エンティティ・Value Object・ドメインサービス
│   ├── entities/
│   ├── value-objects/
│   └── services/
├── application/      # ユースケース・アプリケーションサービス
│   ├── use-cases/
│   ├── dto/
│   └── ports/      # インターフェース定義
├── infrastructure/   # 実装詳細
│   ├── persistence/  # リポジトリ実装
│   ├── messaging/    # イベントバス実装
│   └── http/        # コントローラー
└── shared/          # 共通ユーティリティ
```

### リポジトリパターン

```typescript
// application/ports/user.repository.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// infrastructure/persistence/typeorm-user.repository.ts
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async save(user: User): Promise<void> {
    const entity = UserMapper.toPersistence(user);
    await this.repository.save(entity);
  }
}
```

## 🔄 イベント駆動設計

```typescript
// domain/events/user-created.event.ts
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredOn: Date = new Date()
  ) {}
}

// application/event-handlers/user-created.handler.ts
@EventsHandler(UserCreatedEvent)
export class UserCreatedHandler implements IEventHandler<UserCreatedEvent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    // 通知送信
    await this.notificationService.sendWelcomeEmail(event.email);
    
    // 分析イベント記録
    await this.analyticsService.trackUserSignup(event.userId);
  }
}
```

## 🎯 実装のポイント

- **ドメインロジック集約**: ビジネスルールをエンティティに集約
- **依存性の逆転**: 外部層がドメイン層に依存
- **テスト容易性**: モックしやすいインターフェース設計
- **イベント駆動**: 疎結合な非同期処理