# Clean Architecture - 実装フェーズ1-3

> 基盤設定からユースケース実装まで

## Phase 1: 基盤設定

### 1. TypeScript設定

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

### 2. 環境設定

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

## Phase 2: エンティティとドメインルール

### 1. 基本エンティティの実装

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

### 2. ドメインイベント基盤

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

## Phase 3: ユースケース実装

### 1. インターフェース定義

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

### 2. 共通レスポンス型

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