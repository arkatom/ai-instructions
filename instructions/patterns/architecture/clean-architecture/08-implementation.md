# Clean Architecture - 実装ガイド

> プロジェクト構成から段階的実装まで、実践的な開発アプローチ

## 概要

Clean Architectureの実装は、適切なプロジェクト構成と段階的なアプローチによって成功します。このガイドでは、実際のプロジェクト立ち上げから完成まで、段階を追って実装方法を説明します。

## プロジェクト構成

### ディレクトリ構造

```
project/
├── src/
│   ├── core/                          # 内側の層
│   │   ├── entities/                  # エンティティ
│   │   │   ├── user.entity.ts
│   │   │   ├── product.entity.ts
│   │   │   └── order.entity.ts
│   │   ├── use-cases/                 # ユースケース
│   │   │   ├── user/
│   │   │   │   ├── register-user.use-case.ts
│   │   │   │   ├── login-user.use-case.ts
│   │   │   │   └── get-user-profile.use-case.ts
│   │   │   ├── product/
│   │   │   │   ├── create-product.use-case.ts
│   │   │   │   └── update-product.use-case.ts
│   │   │   └── order/
│   │   │       └── place-order.use-case.ts
│   │   └── interfaces/               # インターフェース定義
│   │       ├── repositories/
│   │       │   ├── user.repository.ts
│   │       │   └── product.repository.ts
│   │       └── services/
│   │           ├── auth.service.ts
│   │           └── email.service.ts
│   ├── adapters/                     # アダプタ層
│   │   ├── controllers/              # コントローラー
│   │   │   ├── user.controller.ts
│   │   │   └── product.controller.ts
│   │   ├── presenters/               # プレゼンター
│   │   │   ├── user.presenter.ts
│   │   │   └── product.presenter.ts
│   │   ├── gateways/                 # ゲートウェイ
│   │   │   ├── database/
│   │   │   │   ├── user-repository.impl.ts
│   │   │   │   └── product-repository.impl.ts
│   │   │   └── external/
│   │   │       └── payment-gateway.impl.ts
│   │   └── mappers/                  # マッパー
│   │       ├── user.mapper.ts
│   │       └── product.mapper.ts
│   ├── infrastructure/               # インフラ層
│   │   ├── web/
│   │   │   ├── express-app.ts
│   │   │   └── middleware/
│   │   ├── database/
│   │   │   └── postgres-connection.ts
│   │   ├── services/
│   │   │   ├── jwt-auth.service.ts
│   │   │   ├── bcrypt-password.service.ts
│   │   │   └── redis-cache.service.ts
│   │   └── messaging/
│   │       └── rabbitmq-event-bus.ts
│   ├── main/                         # メイン層
│   │   ├── container.ts              # DIコンテナ
│   │   ├── app.ts                    # アプリケーション
│   │   └── index.ts                  # エントリーポイント
│   └── shared/                       # 共通
│       ├── errors/
│       ├── types/
│       └── utils/
├── __tests__/                        # テスト
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                             # ドキュメント
├── migrations/                       # データベースマイグレーション
└── scripts/                          # ビルド・デプロイスクリプト
```

### パッケージ構成（package.json）

```json
{
  "name": "clean-architecture-api",
  "version": "1.0.0",
  "main": "dist/main/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev src/main/index.ts",
    "start": "node dist/main/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "pg": "^8.11.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "winston": "^3.8.2",
    "amqplib": "^0.10.3",
    "joi": "^17.9.1",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "typescript": "^5.0.4",
    "ts-node-dev": "^2.0.0",
    "@types/node": "^18.16.3",
    "@types/express": "^4.17.17",
    "@types/pg": "^8.6.6",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/bcrypt": "^5.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.1",
    "supertest": "^6.3.3",
    "eslint": "^8.40.0",
    "@typescript-eslint/parser": "^5.59.5",
    "@typescript-eslint/eslint-plugin": "^5.59.5",
    "prettier": "^2.8.8",
    "node-pg-migrate": "^6.2.2"
  }
}
```

## 段階的実装アプローチ

### Phase 1: 基盤設定

#### 1. TypeScript設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "baseUrl": "./src",
    "paths": {
      "@core/*": ["core/*"],
      "@adapters/*": ["adapters/*"],
      "@infrastructure/*": ["infrastructure/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

#### 2. 環境設定

```typescript
// src/shared/config/environment.ts
export interface Environment {
  NODE_ENV: string;
  PORT: number;
  
  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  
  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // External Services
  SENDGRID_API_KEY: string;
  RABBITMQ_URL: string;
}

export function validateEnvironment(): Environment {
  const requiredVars = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'REDIS_HOST', 'REDIS_PORT',
    'JWT_SECRET',
    'SENDGRID_API_KEY',
    'RABBITMQ_URL'
  ];

  const missing = requiredVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
    
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: parseInt(process.env.DB_PORT!),
    DB_NAME: process.env.DB_NAME!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    
    REDIS_HOST: process.env.REDIS_HOST!,
    REDIS_PORT: parseInt(process.env.REDIS_PORT!),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY!,
    RABBITMQ_URL: process.env.RABBITMQ_URL!
  };
}
```

### Phase 2: エンティティとドメインルール

#### 1. 基本エンティティの実装

```typescript
// src/core/entities/base.entity.ts
export abstract class BaseEntity {
  protected readonly _id: string;
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: string, createdAt?: Date, updatedAt?: Date) {
    this._id = id;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  protected updateTimestamp(): void {
    this._updatedAt = new Date();
  }

  equals(other: BaseEntity): boolean {
    return this._id === other._id;
  }
}
```

#### 2. ドメインイベント基盤

```typescript
// src/core/events/domain-event.ts
export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: any;
  readonly timestamp: Date;
  readonly version: number;
}

export abstract class AggregateRoot extends BaseEntity {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
```

### Phase 3: ユースケース実装

#### 1. インターフェース定義

```typescript
// src/core/interfaces/repositories/base.repository.ts
export interface BaseRepository<T extends BaseEntity> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// src/core/interfaces/use-cases/base.use-case.ts
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
```

#### 2. 共通レスポンス型

```typescript
// src/shared/types/response.types.ts
export interface UseCaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export class UseCaseResponseBuilder<T> {
  static success<T>(data?: T): UseCaseResponse<T> {
    return {
      success: true,
      data
    };
  }

  static failure<T>(error: string, errors?: ValidationError[]): UseCaseResponse<T> {
    return {
      success: false,
      error,
      errors
    };
  }
}
```

### Phase 4: インフラストラクチャ実装

#### 1. データベース基盤

```typescript
// src/infrastructure/database/database.interface.ts
export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}
```

#### 2. マイグレーション管理

```typescript
// src/infrastructure/database/migrator.ts
export class DatabaseMigrator {
  constructor(private db: DatabaseConnection) {}

  async run(): Promise<void> {
    await this.createMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = this.getPendingMigrations(appliedMigrations);

    for (const migration of pendingMigrations) {
      console.log(`Running migration: ${migration.name}`);
      
      await this.db.transaction(async (client) => {
        await migration.up(client);
        await this.recordMigration(migration.name);
      });
      
      console.log(`Completed migration: ${migration.name}`);
    }
  }

  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.db.query(sql);
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT name FROM migrations ORDER BY applied_at'
    );
    
    return result.rows.map(row => row.name);
  }

  private getPendingMigrations(applied: string[]): Migration[] {
    // ファイルシステムから移行ファイルを読み込み
    // applied配列と比較して未適用のものを返す
    return [];
  }

  private async recordMigration(name: string): Promise<void> {
    await this.db.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [name]
    );
  }
}

interface Migration {
  name: string;
  up(client: DatabaseClient): Promise<void>;
  down(client: DatabaseClient): Promise<void>;
}
```

### Phase 5: APIとミドルウェア

#### 1. APIレスポンス標準化

```typescript
// src/adapters/controllers/base.controller.ts
export interface HttpRequest {
  body: any;
  query: any;
  params: any;
  headers: any;
  user?: any;
}

export interface HttpResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

export abstract class BaseController {
  protected ok<T>(data?: T): HttpResponse {
    return {
      statusCode: 200,
      body: {
        success: true,
        data
      }
    };
  }

  protected created<T>(data?: T): HttpResponse {
    return {
      statusCode: 201,
      body: {
        success: true,
        data
      }
    };
  }

  protected badRequest(error: string, errors?: ValidationError[]): HttpResponse {
    return {
      statusCode: 400,
      body: {
        success: false,
        error,
        errors
      }
    };
  }

  protected unauthorized(error: string = 'Unauthorized'): HttpResponse {
    return {
      statusCode: 401,
      body: {
        success: false,
        error
      }
    };
  }

  protected forbidden(error: string = 'Forbidden'): HttpResponse {
    return {
      statusCode: 403,
      body: {
        success: false,
        error
      }
    };
  }

  protected notFound(error: string = 'Not Found'): HttpResponse {
    return {
      statusCode: 404,
      body: {
        success: false,
        error
      }
    };
  }

  protected serverError(error: string = 'Internal Server Error'): HttpResponse {
    return {
      statusCode: 500,
      body: {
        success: false,
        error
      }
    };
  }
}
```

#### 2. バリデーションミドルウェア

```typescript
// src/infrastructure/web/middleware/validation.middleware.ts
import Joi from 'joi';

export function validateRequest(schema: {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
}) {
  return (req: any, res: any, next: any) => {
    const errors: ValidationError[] = [];

    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(...formatJoiErrors(error, 'body'));
      }
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(...formatJoiErrors(error, 'query'));
      }
    }

    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(...formatJoiErrors(error, 'params'));
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }

    next();
  };
}

function formatJoiErrors(error: Joi.ValidationError, source: string): ValidationError[] {
  return error.details.map(detail => ({
    field: `${source}.${detail.path.join('.')}`,
    message: detail.message
  }));
}
```

### Phase 6: テスト基盤

#### 1. テストベースクラス

```typescript
// __tests__/utils/test-base.ts
export abstract class TestBase {
  protected container: TestDIContainer;

  beforeEach(async () => {
    this.container = new TestDIContainer();
    await this.container.initialize();
  });

  afterEach(async () => {
    await this.container.cleanup();
  });

  protected mockRepository<T>(repositoryName: string): jest.Mocked<T> {
    return this.container.get(repositoryName) as jest.Mocked<T>;
  }

  protected mockService<T>(serviceName: string): jest.Mocked<T> {
    return this.container.get(serviceName) as jest.Mocked<T>;
  }
}
```

#### 2. 統合テスト基盤

```typescript
// __tests__/utils/integration-test-base.ts
export abstract class IntegrationTestBase {
  protected app: Application;
  protected server: any;

  beforeAll(async () => {
    // テスト用データベースの準備
    await this.setupTestDatabase();
    
    // アプリケーションの起動
    this.app = new Application(new TestDIContainer());
    this.server = await this.app.start(0);
  });

  afterAll(async () => {
    await this.server.close();
    await this.cleanupTestDatabase();
  });

  beforeEach(async () => {
    await this.cleanDatabase();
  });

  protected async request() {
    return supertest(this.server);
  }

  private async setupTestDatabase(): Promise<void> {
    // テストデータベースのセットアップ
  }

  private async cleanupTestDatabase(): Promise<void> {
    // テストデータベースのクリーンアップ
  }

  private async cleanDatabase(): Promise<void> {
    // 各テスト前のデータクリーンアップ
  }
}
```

## 実装のベストプラクティス

### 1. エラーハンドリング戦略

```typescript
// src/shared/errors/application.errors.ts
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, public readonly field: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
```

### 2. ロギング戦略

```typescript
// src/shared/logger/logger.interface.ts
export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export class ContextualLogger implements Logger {
  constructor(
    private baseLogger: Logger,
    private context: Record<string, any>
  ) {}

  info(message: string, meta?: any): void {
    this.baseLogger.info(message, { ...this.context, ...meta });
  }

  error(message: string, meta?: any): void {
    this.baseLogger.error(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.baseLogger.warn(message, { ...this.context, ...meta });
  }

  debug(message: string, meta?: any): void {
    this.baseLogger.debug(message, { ...this.context, ...meta });
  }

  child(additionalContext: Record<string, any>): ContextualLogger {
    return new ContextualLogger(this.baseLogger, {
      ...this.context,
      ...additionalContext
    });
  }
}
```

### 3. パフォーマンス監視

```typescript
// src/shared/monitoring/performance.monitor.ts
export class PerformanceMonitor {
  static async measure<T>(
    name: string,
    operation: () => Promise<T>,
    logger: Logger
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      logger.info(`Operation completed: ${name}`, {
        duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error(`Operation failed: ${name}`, {
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  static measureSync<T>(
    name: string,
    operation: () => T,
    logger: Logger
  ): T {
    const start = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - start;
      
      logger.info(`Operation completed: ${name}`, {
        duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error(`Operation failed: ${name}`, {
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}
```

Clean Architectureの実装は段階的なアプローチにより、保守性とテスト可能性を確保しながら、スケーラブルなアプリケーションを構築できます。各フェーズで適切な基盤を構築することで、後の拡張や変更に柔軟に対応できるアーキテクチャを実現できます。