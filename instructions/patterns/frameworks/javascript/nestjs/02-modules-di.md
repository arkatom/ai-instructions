# NestJS モジュール・依存性注入

モジュラーモノリス構造と高度な依存性注入パターン。

## 📦 モジュール設計

### 機能モジュール構造

```typescript
// user/user.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CqrsModule,
    UserEventModule
  ],
  controllers: [UserController],
  providers: [
    // ユースケース
    CreateUserUseCase,
    UpdateUserUseCase,
    GetUserUseCase,
    DeleteUserUseCase,
    
    // リポジトリ
    {
      provide: 'USER_REPOSITORY',
      useClass: TypeOrmUserRepository
    },
    
    // サービス
    UserService,
    UserValidationService,
    
    // イベントハンドラー
    UserCreatedHandler,
    UserUpdatedHandler,
    
    // マッパー
    UserMapper
  ],
  exports: [
    'USER_REPOSITORY',
    UserService
  ]
})
export class UserModule {}
```

### ルートモジュール構成

```typescript
// app.module.ts
@Module({
  imports: [
    // グローバル設定
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required()
      })
    }),
    
    // データベース
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        retryAttempts: 3,
        retryDelay: 3000
      }),
      inject: [ConfigService]
    }),
    
    // キャッシュ
    CacheModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        url: config.get('REDIS_URL'),
        ttl: 300 // 5分デフォルト
      }),
      inject: [ConfigService]
    }),
    
    // ビジネスモジュール
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

## 💉 依存性注入パターン

### カスタムプロバイダー

```typescript
// プロバイダー定義
export const DatabaseProvider = {
  provide: 'DATABASE_CONNECTION',
  useFactory: async (config: ConfigService) => {
    const connection = await createConnection({
      type: 'postgres',
      url: config.get('DATABASE_URL')
    });
    return connection;
  },
  inject: [ConfigService]
};

// トークンベースインジェクション
@Injectable()
export class UserService {
  constructor(
    @Inject('DATABASE_CONNECTION') private connection: Connection,
    @Inject('CACHE_MANAGER') private cache: Cache,
    @Inject('LOGGER') private logger: Logger
  ) {}
}
```

### 動的モジュール

```typescript
// shared/logger/logger.module.ts
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerOptions): DynamicModule {
    const providers = [
      {
        provide: 'LOGGER_OPTIONS',
        useValue: options
      },
      {
        provide: Logger,
        useFactory: (options: LoggerOptions) => {
          return new WinstonLogger(options);
        },
        inject: ['LOGGER_OPTIONS']
      }
    ];

    return {
      module: LoggerModule,
      global: options.isGlobal ?? false,
      providers,
      exports: [Logger]
    };
  }
}
```

### スコープ管理

```typescript
// リクエストスコープ
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  constructor(
    @Inject(REQUEST) private request: Request
  ) {}

  getUserId(): string {
    return this.request.user?.id;
  }
}

// トランジェントスコープ
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {
  private instanceId = Math.random();
  
  getInstanceId(): number {
    return this.instanceId;
  }
}
```

## 🔄 循環依存の解決

```typescript
// forward reference使用
@Module({
  imports: [forwardRef(() => ProductModule)],
  providers: [OrderService],
  exports: [OrderService]
})
export class OrderModule {}

@Injectable()
export class OrderService {
  constructor(
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService
  ) {}
}
```

## 🎯 ベストプラクティス

- **単一責任**: 各モジュールは単一の機能領域に集中
- **依存関係の明確化**: exports/importsで依存を明示
- **グローバルモジュールの制限**: 必要最小限に留める
- **インターフェース分離**: トークンベースの抽象化