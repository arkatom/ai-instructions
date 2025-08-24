# Clean Architecture - 実装フェーズ4-6

> インフラストラクチャからテスト基盤まで

## Phase 4: インフラストラクチャ実装

### 1. データベース基盤

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

### 2. マイグレーション管理

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

## Phase 5: APIとミドルウェア

### 1. APIレスポンス標準化

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

### 2. バリデーションミドルウェア

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

## Phase 6: テスト基盤

### 1. テストベースクラス

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

### 2. 統合テスト基盤

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