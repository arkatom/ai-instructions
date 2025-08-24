# Clean Architecture - Frameworks & Drivers層

> 外部フレームワークとドライバーによるインフラストラクチャ実装

## 概要

Frameworks & Drivers層は、Clean Architectureの最外層に位置し、データベース、Webサーバー、UI、外部APIなどの技術的詳細を実装します。この層の変更は内側の層に影響を与えないように設計する必要があります。

## Webフレームワーク実装

### Express.js アプリケーション

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
```

### FastAPIアプリケーション（Python例）

```python
# infrastructure/web/fastapi_app.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer
import uvicorn

class FastAPIApp:
    def __init__(
        self,
        user_controller: UserController,
        product_controller: ProductController,
        auth_service: AuthService,
        logger: Logger
    ):
        self.app = FastAPI(title="Clean Architecture API", version="1.0.0")
        self.user_controller = user_controller
        self.product_controller = product_controller
        self.auth_service = auth_service
        self.logger = logger
        
        self.setup_middleware()
        self.setup_routes()
        self.setup_exception_handlers()

    def setup_middleware(self):
        # CORS設定
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Gzip圧縮
        self.app.add_middleware(GZipMiddleware, minimum_size=1000)

    def setup_routes(self):
        # ユーザー関連
        @self.app.post("/api/v1/users/register", status_code=201)
        async def register_user(request: RegisterUserRequest):
            return await self.user_controller.register(request)

        @self.app.post("/api/v1/users/login")
        async def login_user(request: LoginRequest):
            return await self.user_controller.login(request)

        @self.app.get("/api/v1/users/{user_id}")
        async def get_user_profile(
            user_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            return await self.user_controller.get_profile(user_id, current_user)

        # 商品関連
        @self.app.get("/api/v1/products")
        async def list_products(page: int = 1, limit: int = 20):
            return await self.product_controller.list(page, limit)

        @self.app.post("/api/v1/products", status_code=201)
        async def create_product(
            request: CreateProductRequest,
            current_user: dict = Depends(self.require_admin)
        ):
            return await self.product_controller.create(request)

    def setup_exception_handlers(self):
        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(request, exc):
            self.logger.error(f"HTTP exception: {exc.detail}", extra={
                "path": str(request.url),
                "method": request.method,
                "status_code": exc.status_code
            })
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail}
            )

    async def get_current_user(self, token: str = Depends(HTTPBearer())):
        user = await self.auth_service.verify_token(token.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return user

    def start(self, port: int = 8000):
        uvicorn.run(self.app, host="0.0.0.0", port=port)
```

## データベース実装

### PostgreSQL接続とクエリ実行

```typescript
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
```

### MongoDB実装

```typescript
// infrastructure/database/mongodb-connection.ts
import { MongoClient, Db, Collection } from 'mongodb';

export class MongoDBConnection implements NoSQLDatabase {
  private client: MongoClient;
  private db: Db;

  constructor(private config: MongoConfig) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.config.uri, {
      maxPoolSize: this.config.maxPoolSize || 10,
      serverSelectionTimeoutMS: this.config.serverSelectionTimeout || 5000,
      socketTimeoutMS: this.config.socketTimeout || 45000,
    });

    await this.client.connect();
    this.db = this.client.db(this.config.database);
    
    console.log('Connected to MongoDB');
  }

  collection<T = any>(name: string): Collection<T> {
    return this.db.collection<T>(name);
  }

  async createIndexes(collectionName: string, indexes: IndexSpec[]): Promise<void> {
    const collection = this.collection(collectionName);
    
    for (const index of indexes) {
      await collection.createIndex(index.spec, index.options);
    }
  }

  async transaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    
    try {
      return await session.withTransaction(callback);
    } finally {
      await session.endSession();
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// MongoDBユーザーリポジトリ実装
export class MongoUserRepository implements UserRepository {
  constructor(
    private db: MongoDBConnection,
    private mapper: UserMapper
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    const collection = this.db.collection('users');
    const document = await collection.findOne({ _id: id });
    
    if (!document) {
      return null;
    }
    
    return this.mapper.toDomain(document);
  }

  async save(user: UserEntity): Promise<void> {
    const collection = this.db.collection('users');
    const document = this.mapper.toPersistence(user);
    
    await collection.replaceOne(
      { _id: user.id },
      { ...document, _id: user.id },
      { upsert: true }
    );
  }

  async findWithAggregation(pipeline: any[]): Promise<UserEntity[]> {
    const collection = this.db.collection('users');
    const cursor = collection.aggregate(pipeline);
    const documents = await cursor.toArray();
    
    return documents.map(doc => this.mapper.toDomain(doc));
  }
}
```

## 認証・認可サービス

### JWT認証サービス

```typescript
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
```

### パスワードハッシュ化サービス

```typescript
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
```

## キャッシュサービス

### Redis実装

```typescript
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

  // パターンマッチングによる一括削除
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // リスト操作
  async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => 
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return this.client.lpush(key, ...serializedValues);
  }

  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    const values = await this.client.lrange(key, start, stop);
    return values.map(v => {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    });
  }
}
```

## メッセージング

### RabbitMQイベントバス

```typescript
// infrastructure/messaging/rabbitmq-event-bus.ts
import amqp from 'amqplib';

export class RabbitMQEventBus implements EventBus {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private config: RabbitMQConfig) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.config.url);
    this.channel = await this.connection.createChannel();
    
    // エクスチェンジの作成
    await this.channel.assertExchange('events', 'topic', { durable: true });
    
    console.log('Connected to RabbitMQ');
  }

  async publish(event: DomainEvent): Promise<void> {
    const routingKey = event.type;
    const message = Buffer.from(JSON.stringify(event));
    
    await this.channel.publish('events', routingKey, message, {
      persistent: true,
      timestamp: Date.now(),
      messageId: generateId()
    });
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    const queueName = `${eventType}_queue`;
    
    // キューの作成
    await this.channel.assertQueue(queueName, { durable: true });
    
    // バインディング
    await this.channel.bindQueue(queueName, 'events', eventType);
    
    // コンシューマーの設定
    await this.channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await handler(event);
          
          this.channel.ack(msg);
        } catch (error) {
          console.error('Event handling error', error);
          this.channel.nack(msg, false, false); // デッドレターキューへ
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
```

## ロギング

### Winston Logger実装

```typescript
// infrastructure/services/winston-logger.service.ts
import winston from 'winston';

export class WinstonLogger implements Logger {
  private logger: winston.Logger;

  constructor(config: LoggerConfig) {
    this.logger = winston.createLogger({
      level: config.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}
```

## 設計原則

### 1. プラガビリティ
フレームワークは置き換え可能な部品として設計

### 2. 設定の外部化
環境変数や設定ファイルによる設定管理

### 3. グレースフルシャットダウン
適切なリソースクリーンアップ

### 4. エラー処理の統一
ロギングとモニタリングの一元化

### 5. パフォーマンス考慮
接続プーリング、キャッシング、圧縮などの最適化

Frameworks & Drivers層は、具体的な技術実装を担当しながらも、内側の層への影響を最小限に抑える重要な役割を果たします。