# Clean Architecture - 依存性注入とコンテナ

> DIコンテナによる依存関係の管理と制御の逆転

## 概要

依存性注入（Dependency Injection）は、Clean Architectureにおいて依存性逆転原則を実現するための重要な仕組みです。DIコンテナを使用することで、各層の依存関係を適切に管理し、テスト可能で柔軟なアーキテクチャを構築できます。

## DIコンテナの基本実装

### シンプルなDIコンテナ

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
```

## 高度なDIコンテナ実装

### インターフェースベースの登録

```typescript
// advanced-container.ts
export class AdvancedDIContainer {
  private bindings = new Map<string, Binding>();
  private instances = new Map<string, any>();

  bind<T>(token: string): BindingBuilder<T> {
    return new BindingBuilder<T>(this, token);
  }

  bindInterface<T>(interfaceToken: string): InterfaceBindingBuilder<T> {
    return new InterfaceBindingBuilder<T>(this, interfaceToken);
  }

  get<T>(token: string): T {
    const binding = this.bindings.get(token);
    
    if (!binding) {
      throw new Error(`No binding found for token: ${token}`);
    }

    if (binding.scope === 'singleton' && this.instances.has(token)) {
      return this.instances.get(token);
    }

    const instance = this.createInstance<T>(binding);

    if (binding.scope === 'singleton') {
      this.instances.set(token, instance);
    }

    return instance;
  }

  private createInstance<T>(binding: Binding): T {
    if (binding.factory) {
      return binding.factory();
    }

    if (binding.constructor) {
      const dependencies = this.resolveDependencies(binding.dependencies);
      return new binding.constructor(...dependencies);
    }

    throw new Error('Invalid binding configuration');
  }

  private resolveDependencies(dependencies: string[]): any[] {
    return dependencies.map(dep => this.get(dep));
  }

  registerBinding(token: string, binding: Binding): void {
    this.bindings.set(token, binding);
  }
}

class BindingBuilder<T> {
  constructor(
    private container: AdvancedDIContainer,
    private token: string
  ) {}

  to(constructor: new (...args: any[]) => T): ScopeBuilder<T> {
    return new ScopeBuilder<T>(this.container, this.token, { constructor });
  }

  toFactory(factory: () => T): ScopeBuilder<T> {
    return new ScopeBuilder<T>(this.container, this.token, { factory });
  }
}

class ScopeBuilder<T> {
  constructor(
    private container: AdvancedDIContainer,
    private token: string,
    private binding: Partial<Binding>
  ) {}

  inSingletonScope(): DependencyBuilder<T> {
    this.binding.scope = 'singleton';
    return new DependencyBuilder<T>(this.container, this.token, this.binding);
  }

  inTransientScope(): DependencyBuilder<T> {
    this.binding.scope = 'transient';
    return new DependencyBuilder<T>(this.container, this.token, this.binding);
  }
}

class DependencyBuilder<T> {
  constructor(
    private container: AdvancedDIContainer,
    private token: string,
    private binding: Partial<Binding>
  ) {}

  withDependencies(...dependencies: string[]): void {
    this.binding.dependencies = dependencies;
    this.container.registerBinding(this.token, this.binding as Binding);
  }

  build(): void {
    this.container.registerBinding(this.token, this.binding as Binding);
  }
}

interface Binding {
  constructor?: new (...args: any[]) => any;
  factory?: () => any;
  scope: 'singleton' | 'transient';
  dependencies: string[];
}
```

### 設定ベースのコンテナ初期化

```typescript
// container-config.ts
export interface ContainerConfig {
  infrastructure: InfrastructureConfig;
  repositories: RepositoryConfig;
  useCases: UseCaseConfig;
  controllers: ControllerConfig;
}

export class ConfigurableContainer extends AdvancedDIContainer {
  async initializeFromConfig(config: ContainerConfig): Promise<void> {
    // インフラストラクチャ層
    this.registerInfrastructureFromConfig(config.infrastructure);
    
    // リポジトリ層
    this.registerRepositoriesFromConfig(config.repositories);
    
    // ユースケース層
    this.registerUseCasesFromConfig(config.useCases);
    
    // コントローラー層
    this.registerControllersFromConfig(config.controllers);
    
    // 初期化処理
    await this.initializeServices();
  }

  private registerInfrastructureFromConfig(config: InfrastructureConfig): void {
    // データベース
    if (config.database.type === 'postgresql') {
      this.bind<Database>('database')
        .toFactory(() => new PostgresConnection(config.database.postgres))
        .inSingletonScope()
        .build();
    } else if (config.database.type === 'mongodb') {
      this.bind<NoSQLDatabase>('database')
        .toFactory(() => new MongoDBConnection(config.database.mongodb))
        .inSingletonScope()
        .build();
    }

    // キャッシュ
    if (config.cache.enabled) {
      this.bind<CacheService>('cache')
        .to(RedisCacheService)
        .inSingletonScope()
        .withDependencies();
    } else {
      this.bind<CacheService>('cache')
        .to(InMemoryCacheService)
        .inSingletonScope()
        .build();
    }

    // 認証
    this.bind<AuthService>('authService')
      .toFactory(() => new JWTAuthService(config.auth.jwtSecret))
      .inSingletonScope()
      .build();

    // ロガー
    this.bind<Logger>('logger')
      .toFactory(() => new WinstonLogger(config.logging))
      .inSingletonScope()
      .build();
  }

  private async initializeServices(): Promise<void> {
    // データベース接続の初期化
    const database = this.get<Database>('database');
    if (typeof (database as any).connect === 'function') {
      await (database as any).connect();
    }

    // キャッシュ接続の初期化
    const cache = this.get<CacheService>('cache');
    if (typeof (cache as any).connect === 'function') {
      await (cache as any).connect();
    }

    // イベントバス接続の初期化
    const eventBus = this.get<EventBus>('eventBus');
    if (typeof (eventBus as any).connect === 'function') {
      await (eventBus as any).connect();
    }
  }
}
```

## デコレーターベースのDI（TypeScript）

### デコレーター定義

```typescript
// decorators/injectable.ts
import 'reflect-metadata';

const INJECTABLE_METADATA_KEY = Symbol('injectable');
const DEPENDENCIES_METADATA_KEY = Symbol('dependencies');

export function Injectable(token?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, token || constructor.name, constructor);
    return constructor;
  };
}

export function Inject(token: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata(DEPENDENCIES_METADATA_KEY, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(DEPENDENCIES_METADATA_KEY, existingTokens, target);
  };
}
```

### デコレーターを使用したサービス定義

```typescript
// services/decorated-services.ts
@Injectable('userService')
export class UserService {
  constructor(
    @Inject('userRepository') private userRepository: UserRepository,
    @Inject('passwordHasher') private passwordHasher: PasswordHasher,
    @Inject('logger') private logger: Logger
  ) {}

  async createUser(userData: CreateUserData): Promise<UserEntity> {
    // 実装
  }
}

@Injectable('orderService')
export class OrderService {
  constructor(
    @Inject('orderRepository') private orderRepository: OrderRepository,
    @Inject('userRepository') private userRepository: UserRepository,
    @Inject('productRepository') private productRepository: ProductRepository,
    @Inject('eventBus') private eventBus: EventBus
  ) {}

  async processOrder(orderData: ProcessOrderData): Promise<OrderEntity> {
    // 実装
  }
}
```

### リフレクションベースのコンテナ

```typescript
// reflection-container.ts
export class ReflectionContainer {
  private instances = new Map<string, any>();
  private constructors = new Map<string, new (...args: any[]) => any>();

  register<T>(constructor: new (...args: any[]) => T): void {
    const token = Reflect.getMetadata(INJECTABLE_METADATA_KEY, constructor);
    if (!token) {
      throw new Error(`Class ${constructor.name} is not marked as @Injectable`);
    }
    
    this.constructors.set(token, constructor);
  }

  get<T>(token: string): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const constructor = this.constructors.get(token);
    if (!constructor) {
      throw new Error(`No registration found for token: ${token}`);
    }

    const dependencies = this.resolveDependencies(constructor);
    const instance = new constructor(...dependencies);
    
    this.instances.set(token, instance);
    return instance;
  }

  private resolveDependencies(constructor: new (...args: any[]) => any): any[] {
    const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
    const dependencyTokens = Reflect.getMetadata(DEPENDENCIES_METADATA_KEY, constructor) || [];
    
    return paramTypes.map((type: any, index: number) => {
      const token = dependencyTokens[index];
      if (!token) {
        throw new Error(`No dependency token found for parameter ${index} of ${constructor.name}`);
      }
      
      return this.get(token);
    });
  }
}
```

## アプリケーション起動とライフサイクル管理

### アプリケーションクラス

```typescript
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
```

### エントリーポイント

```typescript
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

## テスト用DIコンテナ

### モックサービスの登録

```typescript
// test-container.ts
export class TestDIContainer extends DIContainer {
  registerTestServices(): void {
    // モックデータベース
    this.registerSingleton('database', () => new InMemoryDatabase());
    
    // モックキャッシュ
    this.registerSingleton('cache', () => new InMemoryCacheService());
    
    // モックメールサービス
    this.registerSingleton('emailService', () => new MockEmailService());
    
    // モックイベントバス
    this.registerSingleton('eventBus', () => new InMemoryEventBus());
    
    // テスト用ロガー
    this.registerSingleton('logger', () => new SilentLogger());
  }

  async reset(): Promise<void> {
    // テスト間でのリセット処理
    this.singletons.clear();
    await this.initialize();
  }
}
```

## ベストプラクティス

### 1. インターフェース駆動設計
```typescript
// インターフェースに依存
constructor(private userRepository: UserRepository) {}

// 具体実装に依存（避ける）
constructor(private userRepository: PostgreSQLUserRepository) {}
```

### 2. 循環依存の回避
```typescript
// 循環依存を検出する機能
private detectCircularDependency(token: string, chain: string[] = []): void {
  if (chain.includes(token)) {
    throw new Error(`Circular dependency detected: ${chain.join(' -> ')} -> ${token}`);
  }
}
```

### 3. 適切なスコープ管理
- シングルトン：状態を持たないサービス
- トランジェント：状態を持つオブジェクト

### 4. 設定の外部化
環境変数やファイルでの設定管理

依存性注入は、Clean Architectureの各層間の適切な結合を実現し、テスト可能で保守しやすいコードを書くための基盤技術です。