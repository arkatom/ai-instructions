# Nest.js エンタープライズパターン

エンタープライズグレードのNest.js実装パターン集。スケーラブルで保守性の高いシステム構築のための実用的なコード例。

## 🏗️ アーキテクチャパターン

### ドメイン駆動設計 + クリーンアーキテクチャ

```typescript
// src/modules/user/domain/user.entity.ts
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
    // Domain events could be published here
  }

  getId(): string {
    return this.id.value;
  }

  getEmail(): string {
    return this.email.value;
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

// src/modules/user/domain/value-objects/user-id.ts
export class UserId {
  constructor(public readonly value: string) {
    if (!value || value.length < 1) {
      throw new Error('User ID cannot be empty');
    }
  }

  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }

  static fromString(value: string): UserId {
    return new UserId(value);
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}

// src/modules/user/application/use-cases/create-user.use-case.ts
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    try {
      // Business logic validation
      const existingUser = await this.userRepository.findByEmail(command.email);
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      // Create domain entity
      const user = User.create(command.email, command.profile);
      
      // Persist
      await this.userRepository.save(user);
      
      // Publish domain event
      await this.eventBus.publish(
        new UserCreatedEvent(user.getId(), user.getEmail())
      );

      this.logger.log(`User created: ${user.getId()}`);

      return {
        success: true,
        userId: user.getId()
      };
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }
}
```

### モジュラーモノリス構造

```typescript
// src/modules/user/user.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CqrsModule,
    UserEventModule
  ],
  controllers: [UserController],
  providers: [
    // Use Cases
    CreateUserUseCase,
    UpdateUserUseCase,
    GetUserUseCase,
    DeleteUserUseCase,
    
    // Repositories
    {
      provide: 'USER_REPOSITORY',
      useClass: TypeOrmUserRepository
    },
    
    // Services
    UserService,
    UserValidationService,
    
    // Event Handlers
    UserCreatedHandler,
    UserUpdatedHandler,
    
    // Mappers
    UserMapper
  ],
  exports: [
    'USER_REPOSITORY',
    UserService
  ]
})
export class UserModule {}

// src/app.module.ts
@Module({
  imports: [
    // Core modules
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required()
      })
    }),
    
    // Database
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        retryAttempts: 3,
        retryDelay: 3000,
        maxQueryExecutionTime: 10000
      }),
      inject: [ConfigService]
    }),
    
    // Caching
    CacheModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        url: config.get('REDIS_URL'),
        ttl: 300 // 5 minutes default
      }),
      inject: [ConfigService]
    }),
    
    // Queue
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD')
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50
        }
      }),
      inject: [ConfigService]
    }),
    
    // Business modules
    UserModule,
    AuthModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    NotificationModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    }
  ]
})
export class AppModule {}
```

## 🔐 認証・認可システム

### JWT + Refresh Token パターン

```typescript
// src/modules/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService
  ) {}

  async login(credentials: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(credentials.email, credentials.password);
    
    const tokens = await this.generateTokens(user);
    
    // Store refresh token
    await this.cacheManager.set(
      `refresh_token:${user.id}`,
      tokens.refreshToken,
      this.configService.get('JWT_REFRESH_EXPIRATION')
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.configService.get('JWT_EXPIRATION')
    };
  }

  async refreshTokens(refreshToken: string): Promise<RefreshResult> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET')
      });

      const cachedToken = await this.cacheManager.get(`refresh_token:${payload.sub}`);
      if (cachedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userService.findById(payload.sub);
      const tokens = await this.generateTokens(user);

      // Update stored refresh token
      await this.cacheManager.set(
        `refresh_token:${user.id}`,
        tokens.refreshToken,
        this.configService.get('JWT_REFRESH_EXPIRATION')
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.configService.get('JWT_EXPIRATION')
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION')
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION')
      })
    ]);

    return { accessToken, refreshToken };
  }
}

// RBAC with Decorators
@SetMetadata('roles', ['admin', 'moderator'])
export const RequireRoles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

### 細かい権限制御

```typescript
// src/modules/auth/decorators/permissions.decorator.ts
export interface Permission {
  resource: string;
  action: string;
  condition?: (user: User, resource: any) => boolean;
}

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<Permission[]>('permissions', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!permissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    for (const permission of permissions) {
      const hasPermission = await this.permissionService.hasPermission(
        user,
        permission.resource,
        permission.action
      );

      if (!hasPermission) {
        return false;
      }

      // Check resource-specific conditions
      if (permission.condition) {
        const resource = await this.getResourceFromRequest(request, permission.resource);
        if (!permission.condition(user, resource)) {
          return false;
        }
      }
    }

    return true;
  }
}

// Usage in controller
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrderController {
  @Get(':id')
  @RequirePermissions({
    resource: 'order',
    action: 'read',
    condition: (user, order) => user.id === order.userId || user.roles.includes('admin')
  })
  async getOrder(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Post()
  @RequirePermissions({ resource: 'order', action: 'create' })
  async createOrder(@Body() orderData: CreateOrderDto, @CurrentUser() user: User) {
    return this.orderService.create(orderData, user);
  }
}
```

## 📊 データアクセス層

### Repository パターン with TypeORM

```typescript
// src/modules/user/infrastructure/user.repository.ts
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findMany(criteria: UserSearchCriteria): Promise<User[]>;
  delete(id: string): Promise<void>;
}

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly userMapper: UserMapper
  ) {}

  async save(user: User): Promise<void> {
    const entity = this.userMapper.toEntity(user);
    await this.userEntity.save(entity);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.userEntity.findOne({
      where: { id },
      relations: ['profile', 'roles']
    });

    return entity ? this.userMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.userEntity.findOne({
      where: { email },
      relations: ['profile', 'roles']
    });

    return entity ? this.userMapper.toDomain(entity) : null;
  }

  async findMany(criteria: UserSearchCriteria): Promise<User[]> {
    const query = this.userEntity.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.roles', 'roles');

    if (criteria.email) {
      query.andWhere('user.email ILIKE :email', { 
        email: `%${criteria.email}%` 
      });
    }

    if (criteria.roles?.length) {
      query.andWhere('roles.name IN (:...roles)', { 
        roles: criteria.roles 
      });
    }

    if (criteria.isActive !== undefined) {
      query.andWhere('user.isActive = :isActive', { 
        isActive: criteria.isActive 
      });
    }

    query.orderBy('user.createdAt', 'DESC')
         .limit(criteria.limit || 50)
         .offset(criteria.offset || 0);

    const entities = await query.getMany();
    return entities.map(entity => this.userMapper.toDomain(entity));
  }
}

// Optimized queries with caching
@Injectable()
export class CachedUserRepository implements UserRepository {
  constructor(
    private readonly baseRepository: TypeOrmUserRepository,
    private readonly cacheManager: Cache
  ) {}

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const user = await this.baseRepository.findById(id);
    if (user) {
      await this.cacheManager.set(cacheKey, user, 300); // 5 minutes
    }

    return user;
  }

  async save(user: User): Promise<void> {
    await this.baseRepository.save(user);
    
    // Invalidate cache
    const cacheKey = `user:${user.getId()}`;
    await this.cacheManager.del(cacheKey);
  }
}
```

### データベース最適化

```typescript
// src/modules/database/database.interceptor.ts
@Injectable()
export class DatabaseTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    const transactional = Reflect.getMetadata('transactional', handler);
    if (!transactional) {
      return next.handle();
    }

    return from(this.dataSource.transaction(async manager => {
      request.transactionManager = manager;
      return next.handle().toPromise();
    }));
  }
}

// Usage decorator
export const Transactional = () => SetMetadata('transactional', true);

@Controller('orders')
export class OrderController {
  @Post()
  @Transactional()
  async createOrder(@Body() orderData: CreateOrderDto) {
    // This method will run in a transaction
    return this.orderService.create(orderData);
  }
}

// Connection pooling optimization
export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Connection pool optimization
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  
  // Query optimization
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error'],
  maxQueryExecutionTime: 10000,
  
  // Migration settings
  migrationsRun: false,
  synchronize: false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}']
});
```

## 🔄 非同期処理・キューイング

### Bull Queue Integration

```typescript
// src/modules/queue/queue.module.ts
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD')
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      }),
      inject: [ConfigService]
    }),
    
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'image-processing' },
      { name: 'data-sync' },
      { name: 'notifications' }
    )
  ],
  providers: [
    EmailProcessor,
    ImageProcessor,
    DataSyncProcessor,
    NotificationProcessor
  ],
  exports: [BullModule]
})
export class QueueModule {}

// Email processing
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly userService: UserService
  ) {}

  @Process('send-welcome-email')
  async sendWelcomeEmail(job: Job<SendWelcomeEmailData>) {
    this.logger.log(`Processing welcome email for user: ${job.data.userId}`);
    
    try {
      const user = await this.userService.findById(job.data.userId);
      if (!user) {
        throw new Error('User not found');
      }

      await this.emailService.sendWelcomeEmail(user.email, {
        name: user.profile.firstName,
        activationLink: job.data.activationLink
      });

      this.logger.log(`Welcome email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
      throw error;
    }
  }

  @Process('send-batch-emails')
  async sendBatchEmails(job: Job<BatchEmailData>) {
    const { emails, template, data } = job.data;
    
    // Process in chunks to avoid overwhelming the email service
    const chunkSize = 100;
    const chunks = this.chunkArray(emails, chunkSize);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await Promise.all(
        chunk.map(email => 
          this.emailService.sendTemplatedEmail(email, template, data)
        )
      );
      
      // Update progress
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      job.progress(progress);
      
      // Brief pause between chunks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}: ${err.message}`);
  }
}

// Queue service for adding jobs
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('image-processing') private imageQueue: Queue,
    @InjectQueue('data-sync') private dataSyncQueue: Queue
  ) {}

  async addWelcomeEmailJob(userId: string, activationLink: string) {
    return this.emailQueue.add('send-welcome-email', {
      userId,
      activationLink
    }, {
      delay: 5000, // 5 second delay
      priority: 1
    });
  }

  async addImageProcessingJob(imageId: string, operations: ImageOperation[]) {
    return this.imageQueue.add('process-image', {
      imageId,
      operations
    }, {
      priority: 5,
      attempts: 5
    });
  }

  async scheduleDataSync(syncType: string, cronExpression: string) {
    return this.dataSyncQueue.add('sync-data', {
      syncType
    }, {
      repeat: { cron: cronExpression },
      jobId: `sync-${syncType}` // Prevent duplicates
    });
  }
}
```

### イベント駆動アーキテクチャ

```typescript
// Event-driven patterns
@Injectable()
export class OrderEventHandler {
  constructor(
    private readonly emailQueue: Queue,
    private readonly inventoryService: InventoryService,
    private readonly analyticsService: AnalyticsService,
    private readonly logger: Logger
  ) {}

  @EventsHandler(OrderCreatedEvent)
  async handleOrderCreated(event: OrderCreatedEvent) {
    const { orderId, userId, items } = event;

    // Run these operations in parallel
    await Promise.allSettled([
      // Send confirmation email
      this.emailQueue.add('send-order-confirmation', {
        orderId,
        userId
      }),
      
      // Update inventory
      this.inventoryService.reserveItems(items),
      
      // Track analytics
      this.analyticsService.trackEvent('order_created', {
        orderId,
        userId,
        value: event.totalAmount
      }),
      
      // Log for audit
      this.logger.log(`Order created: ${orderId} by user: ${userId}`)
    ]);
  }

  @EventsHandler(OrderPaidEvent)
  async handleOrderPaid(event: OrderPaidEvent) {
    const { orderId, paymentId } = event;

    await Promise.allSettled([
      // Fulfill order
      this.fulfillmentService.processOrder(orderId),
      
      // Send shipping notification
      this.emailQueue.add('send-shipping-notification', {
        orderId
      }),
      
      // Update financial records
      this.accountingService.recordRevenue(event.amount, paymentId)
    ]);
  }
}
```

## 🧪 テスト戦略

### 統合テスト

```typescript
// test/integration/user.integration.spec.ts
describe('User Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<UserEntity>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5433, // Test database port
          username: 'test',
          password: 'test',
          database: 'test_db',
          entities: [UserEntity, ProfileEntity],
          synchronize: true,
          dropSchema: true
        }),
        UserModule,
        AuthModule
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity)
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    await app.init();
  });

  afterEach(async () => {
    await userRepository.clear();
    await app.close();
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        profile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: userData.email,
        profile: userData.profile
      });

      // Verify user was actually created in database
      const createdUser = await userRepository.findOne({
        where: { email: userData.email }
      });
      expect(createdUser).toBeDefined();
    });

    it('should not create user with duplicate email', async () => {
      // Pre-create a user
      const existingUser = userRepository.create({
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      await userRepository.save(existingUser);

      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        profile: { firstName: 'John', lastName: 'Doe' }
      };

      await request(app.getHttpServer())
        .post('/users')
        .send(userData)
        .expect(409); // Conflict
    });
  });

  describe('GET /users/:id', () => {
    it('should return user when authenticated', async () => {
      // Create test user
      const user = userRepository.create({
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      await userRepository.save(user);

      // Generate JWT token
      const token = jwtService.sign({ sub: user.id, email: user.email });

      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email
      });
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/users/123')
        .expect(401);
    });
  });
});
```

### ユニットテスト with Mocking

```typescript
// src/modules/user/application/use-cases/create-user.use-case.spec.ts
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let eventBus: jest.Mocked<EventBus>;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        {
          provide: 'USER_REPOSITORY',
          useValue: {
            findByEmail: jest.fn(),
            save: jest.fn()
          }
        },
        {
          provide: EventBus,
          useValue: {
            publish: jest.fn()
          }
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn()
          }
        }
      ]
    }).compile();

    useCase = module.get<CreateUserUseCase>(CreateUserUseCase);
    userRepository = module.get('USER_REPOSITORY');
    eventBus = module.get(EventBus);
    logger = module.get(Logger);
  });

  describe('execute', () => {
    const validCommand: CreateUserCommand = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };

    it('should create user successfully', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.save.mockResolvedValue(undefined);
      eventBus.publish.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(validCommand);

      // Assert
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.any(User)
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(UserCreatedEvent)
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('User created:')
      );
    });

    it('should throw ConflictException when user already exists', async () => {
      // Arrange
      const existingUser = new User(/* ... */);
      userRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(useCase.execute(validCommand))
        .rejects
        .toThrow(ConflictException);
      
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(useCase.execute(validCommand))
        .rejects
        .toThrow('Database error');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create user:')
      );
    });
  });
});
```

### E2E テスト

```typescript
// test/e2e/user-workflow.e2e-spec.ts
describe('User Workflow (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
    .overrideProvider(ConfigService)
    .useValue({
      get: jest.fn((key: string) => {
        const config = {
          DATABASE_URL: 'postgresql://test:test@localhost:5433/test_db',
          JWT_SECRET: 'test-secret',
          JWT_EXPIRATION: '1h'
        };
        return config[key];
      })
    })
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete user journey', () => {
    let userId: string;
    let accessToken: string;

    it('should register a new user', async () => {
      const response = await request(server)
        .post('/auth/register')
        .send({
          email: 'e2e@example.com',
          password: 'SecurePass123!',
          profile: {
            firstName: 'E2E',
            lastName: 'Test'
          }
        })
        .expect(201);

      userId = response.body.user.id;
      expect(response.body.user.email).toBe('e2e@example.com');
    });

    it('should login with created user', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      accessToken = response.body.accessToken;
      expect(response.body.user.id).toBe(userId);
    });

    it('should access protected route with token', async () => {
      const response = await request(server)
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    it('should update user profile', async () => {
      const updatedProfile = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(server)
        .patch(`/users/${userId}/profile`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedProfile)
        .expect(200);

      expect(response.body.profile.firstName).toBe('Updated');
    });

    it('should refresh access token', async () => {
      // Wait a moment to ensure different token
      await new Promise(resolve => setTimeout(resolve, 1000));

      const loginResponse = await request(server)
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'SecurePass123!'
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.accessToken).not.toBe(accessToken);
    });
  });
});
```

## 🚀 パフォーマンス最適化

### キャッシュ戦略

```typescript
// Multi-level caching strategy
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly redisService: RedisService
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // L1: In-memory cache
    const memoryResult = await this.cacheManager.get<T>(key);
    if (memoryResult) {
      return memoryResult;
    }

    // L2: Redis cache
    const redisResult = await this.redisService.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      // Backfill L1 cache
      await this.cacheManager.set(key, parsed, 300);
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // Set in both caches
    await Promise.all([
      this.cacheManager.set(key, value, Math.min(ttl, 300)), // L1: shorter TTL
      this.redisService.setex(key, ttl, JSON.stringify(value)) // L2: longer TTL
    ]);
  }

  async invalidate(pattern: string): Promise<void> {
    // Invalidate both levels
    await Promise.all([
      this.cacheManager.reset(), // Simple approach for L1
      this.redisService.deletePattern(pattern) // Pattern-based for L2
    ]);
  }
}

// Cache decorator
export function Cacheable(ttl: number = 3600, keyGenerator?: (args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService = this.cacheService; // Assume injected
      
      const key = keyGenerator ? 
        keyGenerator(args) : 
        `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cacheService.get(key);
      if (cached) {
        return cached;
      }
      
      // Execute original method
      const result = await method.apply(this, args);
      
      // Cache the result
      await cacheService.set(key, result, ttl);
      
      return result;
    };
  };
}

// Usage
@Injectable()
export class UserService {
  constructor(private readonly cacheService: CacheService) {}

  @Cacheable(300, (args) => `user:${args[0]}`)
  async findById(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }
}
```

### 監視とメトリクス

```typescript
// src/modules/monitoring/monitoring.module.ts
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'nestjs_'
        }
      }
    })
  ],
  providers: [
    MetricsService,
    HealthService,
    PerformanceInterceptor
  ],
  exports: [MetricsService]
})
export class MonitoringModule {}

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  private readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
  });

  private readonly businessMetrics = new Counter({
    name: 'business_events_total',
    help: 'Total number of business events',
    labelNames: ['event_type', 'status']
  });

  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  observeHttpDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  trackBusinessEvent(eventType: string, status: 'success' | 'failure'): void {
    this.businessMetrics.inc({ event_type: eventType, status });
  }
}

// Performance interceptor
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, route } = request;
    
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const response = context.switchToHttp().getResponse();
        
        this.metricsService.incrementHttpRequests(method, route?.path || 'unknown', response.statusCode);
        this.metricsService.observeHttpDuration(method, route?.path || 'unknown', duration);
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        this.metricsService.incrementHttpRequests(method, route?.path || 'unknown', 500);
        this.metricsService.observeHttpDuration(method, route?.path || 'unknown', duration);
        throw error;
      })
    );
  }
}
```

## 🏗️ マイクロサービス連携

### Message Broker Integration

```typescript
// src/modules/messaging/messaging.module.ts
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get('RABBITMQ_URL')],
            queue: 'user_queue',
            queueOptions: {
              durable: true
            }
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'ORDER_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get('RABBITMQ_URL')],
            queue: 'order_queue',
            queueOptions: {
              durable: true
            }
          }
        }),
        inject: [ConfigService]
      }
    ])
  ],
  providers: [MessagingService],
  exports: [MessagingService, ClientsModule]
})
export class MessagingModule {}

@Injectable()
export class MessagingService {
  constructor(
    @Inject('USER_SERVICE') private userClient: ClientProxy,
    @Inject('ORDER_SERVICE') private orderClient: ClientProxy
  ) {}

  async onApplicationBootstrap() {
    await Promise.all([
      this.userClient.connect(),
      this.orderClient.connect()
    ]);
  }

  async getUserById(id: string): Promise<User> {
    return this.userClient
      .send<User>('get_user', { id })
      .pipe(
        timeout(5000),
        catchError(error => {
          throw new ServiceUnavailableException('User service unavailable');
        })
      )
      .toPromise();
  }

  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    return this.orderClient
      .send<Order>('create_order', orderData)
      .pipe(
        timeout(10000),
        retry(3),
        catchError(error => {
          throw new ServiceUnavailableException('Order service unavailable');
        })
      )
      .toPromise();
  }

  // Event publishing
  publishUserEvent(event: string, data: any): void {
    this.userClient.emit(event, data);
  }

  publishOrderEvent(event: string, data: any): void {
    this.orderClient.emit(event, data);
  }
}

// Circuit breaker pattern
@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, any>();

  async call<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options: {
      timeout: number;
      errorThresholdPercentage: number;
      resetTimeoutMs: number;
    } = {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeoutMs: 60000
    }
  ): Promise<T> {
    let circuit = this.circuits.get(serviceName);
    
    if (!circuit) {
      circuit = new CircuitBreaker(operation, options);
      this.circuits.set(serviceName, circuit);
    }

    return circuit.fire();
  }
}
```

## 📖 総合サンプル: Eコマースマイクロサービス

```typescript
// src/modules/ecommerce/ecommerce.controller.ts
@Controller('ecommerce')
@UseGuards(JwtAuthGuard)
export class EcommerceController {
  constructor(
    private readonly ecommerceService: EcommerceService,
    private readonly metricsService: MetricsService
  ) {}

  @Post('orders')
  @RequirePermissions({ resource: 'order', action: 'create' })
  @Transactional()
  async createOrder(
    @Body() orderData: CreateOrderDto,
    @CurrentUser() user: User
  ): Promise<OrderResponse> {
    const startTime = Date.now();
    
    try {
      const order = await this.ecommerceService.createOrder(orderData, user);
      
      this.metricsService.trackBusinessEvent('order_created', 'success');
      
      return {
        success: true,
        order: order.toSnapshot(),
        message: 'Order created successfully'
      };
    } catch (error) {
      this.metricsService.trackBusinessEvent('order_created', 'failure');
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.metricsService.observeHttpDuration('POST', '/ecommerce/orders', duration / 1000);
    }
  }

  @Get('orders/:id')
  @RequirePermissions({
    resource: 'order',
    action: 'read',
    condition: (user, order) => user.id === order.userId || user.roles.includes('admin')
  })
  @Cacheable(300)
  async getOrder(@Param('id') id: string): Promise<OrderResponse> {
    const order = await this.ecommerceService.getOrderById(id);
    return {
      success: true,
      order: order.toSnapshot()
    };
  }
}

@Injectable()
export class EcommerceService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly queueService: QueueService,
    private readonly eventBus: EventBus
  ) {}

  async createOrder(orderData: CreateOrderDto, user: User): Promise<Order> {
    // Validate products and availability
    const products = await this.productService.getProducts(
      orderData.items.map(item => item.productId)
    );
    
    const availability = await this.inventoryService.checkAvailability(
      orderData.items
    );
    
    if (!availability.available) {
      throw new BadRequestException('Some items are out of stock');
    }

    // Create order
    const order = Order.create({
      userId: user.id,
      items: orderData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: products.find(p => p.id === item.productId)?.price || 0
      })),
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress
    });

    // Save order
    await this.orderRepository.save(order);

    // Reserve inventory
    await this.inventoryService.reserveItems(orderData.items);

    // Queue payment processing
    await this.queueService.addPaymentProcessingJob(order.getId(), {
      amount: order.getTotalAmount(),
      currency: 'USD',
      paymentMethod: orderData.paymentMethod
    });

    // Publish domain event
    await this.eventBus.publish(
      new OrderCreatedEvent(
        order.getId(),
        user.id,
        order.getItems(),
        order.getTotalAmount()
      )
    );

    return order;
  }
}
```

このNest.jsエンタープライズパターン集は、実際のプロダクション環境で使用される堅牢で拡張性の高いアーキテクチャパターンを提供します。モジュラー設計、適切な抽象化、包括的なテスト戦略により、長期的な保守性と品質を保証します。