# Command Handlers

## コマンドハンドラー設計

### 基本構造
```typescript
interface Command {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: any;
  readonly metadata: CommandMetadata;
}

abstract class CommandHandler<T extends Command> {
  abstract handle(command: T): Promise<void>;
}
```

## 実装パターン

### シンプルなハンドラー
```typescript
class CreateOrderHandler extends CommandHandler<CreateOrderCommand> {
  constructor(
    private repository: OrderRepository,
    private eventBus: EventBus
  ) {}

  async handle(command: CreateOrderCommand): Promise<void> {
    // 1. ビジネスルール検証
    await this.validateBusinessRules(command);
    
    // 2. アグリゲート作成
    const order = Order.create(
      command.aggregateId,
      command.payload.customerId,
      command.payload.items
    );
    
    // 3. 永続化
    await this.repository.save(order);
    
    // 4. イベント発行
    await this.eventBus.publishAll(order.getUncommittedEvents());
  }
}
```

### トランザクション管理
```typescript
class TransactionalCommandHandler {
  async handle(command: Command): Promise<void> {
    const transaction = await this.db.beginTransaction();
    
    try {
      // ビジネスロジック実行
      await this.innerHandler.handle(command);
      
      // アウトボックスパターンでイベント保存
      await this.saveEventsToOutbox(command.events, transaction);
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

## バリデーション

### コマンド検証
```typescript
class ValidatingCommandHandler {
  private validator = new CommandValidator();
  
  async handle(command: Command): Promise<void> {
    // 構造検証
    const errors = await this.validator.validate(command);
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
    
    // ビジネスルール検証
    await this.validateBusinessRules(command);
    
    // 実行
    await this.innerHandler.handle(command);
  }
}
```

## イデンポテンシー

### 重複実行防止
```typescript
class IdempotentCommandHandler {
  async handle(command: Command): Promise<void> {
    const idempotencyKey = command.metadata.idempotencyKey;
    
    // 処理済みチェック
    const processed = await this.cache.get(idempotencyKey);
    if (processed) return;
    
    // 処理実行
    await this.innerHandler.handle(command);
    
    // 処理済みマーク（TTL付き）
    await this.cache.setex(idempotencyKey, 86400, '1');
  }
}
```

## Saga実装

### 分散トランザクション
```typescript
class OrderSaga {
  constructor(
    private commandBus: CommandBus,
    private eventStore: EventStore
  ) {}
  
  async handle(event: OrderCreatedEvent): Promise<void> {
    const sagaId = event.orderId;
    
    try {
      // 在庫予約
      await this.commandBus.send(new ReserveInventoryCommand(event.items));
      
      // 支払い処理
      await this.commandBus.send(new ProcessPaymentCommand(event.total));
      
      // 注文確定
      await this.commandBus.send(new ConfirmOrderCommand(event.orderId));
    } catch (error) {
      // 補償トランザクション
      await this.compensate(sagaId, error);
    }
  }
  
  private async compensate(sagaId: string, error: Error): Promise<void> {
    // ロールバック処理
    await this.commandBus.send(new CancelOrderCommand(sagaId));
  }
}
```

## 非同期処理

### メッセージキュー統合
```typescript
class AsyncCommandHandler {
  async handle(command: Command): Promise<void> {
    // 即座にキューへ送信
    await this.queue.send({
      topic: 'commands',
      key: command.aggregateId,
      value: JSON.stringify(command),
      headers: {
        'command-type': command.type,
        'correlation-id': command.metadata.correlationId
      }
    });
    
    // ACK返却（実際の処理は非同期）
  }
}
```

## エラーハンドリング

### リトライ戦略
```typescript
class RetryableCommandHandler {
  async handle(command: Command): Promise<void> {
    const maxRetries = 3;
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.innerHandler.handle(command);
        return;
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error)) throw error;
        await this.delay(Math.pow(2, i) * 1000); // 指数バックオフ
      }
    }
    
    throw lastError;
  }
}
```

## 監視とログ

```typescript
class MonitoredCommandHandler {
  async handle(command: Command): Promise<void> {
    const span = this.tracer.startSpan('command.handle');
    span.setTag('command.type', command.type);
    
    try {
      await this.innerHandler.handle(command);
      this.metrics.increment('commands.success', { type: command.type });
    } catch (error) {
      this.metrics.increment('commands.failure', { type: command.type });
      span.setTag('error', true);
      throw error;
    } finally {
      span.finish();
    }
  }
}
```

## ベストプラクティス

✅ **推奨**:
- 単一責任の原則
- イデンポテンシー保証
- 適切なトランザクション境界
- 包括的なエラーハンドリング
- 非同期処理の活用

❌ **避けるべき**:
- 同期的な外部API呼び出し
- トランザクション内でのイベント発行
- ビジネスロジックの漏洩
- 無制限のリトライ
- コマンド内での読み込み操作