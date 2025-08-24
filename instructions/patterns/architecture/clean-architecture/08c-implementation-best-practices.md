# Clean Architecture - ベストプラクティス

> エラーハンドリング、ロギング、パフォーマンス監視

## エラーハンドリング戦略

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

## ロギング戦略

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

## パフォーマンス監視

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

## 実装チェックリスト

### 初期フェーズ
- [ ] TypeScript設定の最適化
- [ ] 環境変数とバリデーション
- [ ] 基本エンティティクラス
- [ ] ドメインイベント基盤

### コア層
- [ ] エンティティの実装
- [ ] ユースケースの実装
- [ ] インターフェース定義
- [ ] ドメインサービス

### インフラ層
- [ ] データベース接続
- [ ] リポジトリ実装
- [ ] 外部サービス統合
- [ ] マイグレーション管理

### API層
- [ ] コントローラー実装
- [ ] バリデーション
- [ ] エラーハンドリング
- [ ] 認証・認可

### 品質保証
- [ ] ユニットテスト
- [ ] 統合テスト
- [ ] E2Eテスト
- [ ] パフォーマンステスト