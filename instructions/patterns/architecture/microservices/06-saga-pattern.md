# Microservices - Sagaパターン

> Sagaパターンの高度な実装とオーケストレーション

## 概要

Sagaパターンは、複数のサービスにまたがるビジネストランザクションを管理し、障害発生時には補償トランザクション（Compensation）を実行して整合性を保つ手法です。ここでは高度な実装パターンを詳しく説明します。

## 関連ファイル
- [トランザクションパターン](./05-transaction-patterns.md) - 基本的なトランザクションパターン
- [Event Sourcing](./07-event-sourcing.md) - イベントソーシングとトランザクション管理
- [トランザクションコーディネーション](./08-transaction-coordination.md) - 調整と復旧パターン

## 分散Sagaオーケストレーター

### 1. Sagaオーケストレーターの実装

```typescript
// shared/patterns/saga-orchestrator.ts
export class SagaOrchestrator {
  private activeSagas = new Map<string, SagaExecution>();
  
  constructor(
    private sagaRepository: SagaRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {
    this.subscribeToEvents();
  }

  async startSaga<T extends Saga>(sagaClass: new (...args: any[]) => T, ...args: any[]): Promise<string> {
    const saga = new sagaClass(...args);
    const sagaExecution: SagaExecution = {
      saga,
      status: SagaStatus.STARTED,
      startedAt: new Date(),
      currentStepIndex: 0
    };

    // Sagaの状態を永続化
    await this.sagaRepository.save({
      id: saga.sagaId,
      type: sagaClass.name,
      status: SagaStatus.STARTED,
      data: this.serializeSaga(saga),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.activeSagas.set(saga.sagaId, sagaExecution);

    // 非同期でSagaを実行
    this.executeSagaAsync(saga.sagaId);

    return saga.sagaId;
  }

  private async executeSagaAsync(sagaId: string): Promise<void> {
    const execution = this.activeSagas.get(sagaId);
    if (!execution) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    try {
      await execution.saga.execute();
      
      execution.status = SagaStatus.COMPLETED;
      execution.completedAt = new Date();
      
      await this.updateSagaStatus(sagaId, SagaStatus.COMPLETED);
      
      // 完了イベント発行
      await this.eventBus.publish(new SagaCompletedEvent(sagaId, execution.saga.constructor.name));
      
    } catch (error) {
      execution.status = SagaStatus.FAILED;
      execution.failedAt = new Date();
      execution.error = error.message;
      
      await this.updateSagaStatus(sagaId, SagaStatus.FAILED, error.message);
      
      // 失敗イベント発行
      await this.eventBus.publish(new SagaFailedEvent(sagaId, execution.saga.constructor.name, error.message));
      
    } finally {
      this.activeSagas.delete(sagaId);
    }
  }

  async getSagaStatus(sagaId: string): Promise<SagaExecutionStatus | null> {
    // メモリから取得を試行
    const execution = this.activeSagas.get(sagaId);
    if (execution) {
      return {
        id: sagaId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        failedAt: execution.failedAt,
        error: execution.error
      };
    }

    // 永続化ストレージから取得
    const sagaRecord = await this.sagaRepository.findById(sagaId);
    if (sagaRecord) {
      return {
        id: sagaRecord.id,
        status: sagaRecord.status,
        startedAt: sagaRecord.createdAt,
        completedAt: sagaRecord.completedAt,
        failedAt: sagaRecord.failedAt,
        error: sagaRecord.error
      };
    }

    return null;
  }

  private async updateSagaStatus(sagaId: string, status: SagaStatus, error?: string): Promise<void> {
    await this.sagaRepository.updateStatus(sagaId, status, error);
  }

  private serializeSaga(saga: Saga): string {
    // Sagaの状態をシリアライズ
    return JSON.stringify({
      type: saga.constructor.name,
      status: saga.status,
      executedStepCount: saga.executedSteps.length
    });
  }

  private subscribeToEvents(): void {
    // Sagaに関連するイベントを購読
    this.eventBus.subscribe('SagaStepCompleted', new SagaStepCompletedEventHandler());
    this.eventBus.subscribe('SagaStepFailed', new SagaStepFailedEventHandler());
  }
}

interface SagaExecution {
  saga: Saga;
  status: SagaStatus;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  currentStepIndex: number;
}

interface SagaExecutionStatus {
  id: string;
  status: SagaStatus;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}
```

### 2. イベント駆動Saga（コレオグラフィー）

```typescript
// shared/patterns/choreography-saga.ts
export class ChoreographySagaManager {
  constructor(
    private eventBus: EventBus,
    private sagaStateRepository: SagaStateRepository,
    private logger: Logger
  ) {
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // 注文作成イベントハンドラー
    this.eventBus.subscribe('OrderCreated', new OrderCreatedSagaHandler(
      this.sagaStateRepository,
      this.eventBus,
      this.logger
    ));

    // 在庫予約完了イベントハンドラー
    this.eventBus.subscribe('InventoryReserved', new InventoryReservedSagaHandler(
      this.sagaStateRepository,
      this.eventBus,
      this.logger
    ));

    // 決済完了イベントハンドラー
    this.eventBus.subscribe('PaymentProcessed', new PaymentProcessedSagaHandler(
      this.sagaStateRepository,
      this.eventBus,
      this.logger
    ));

    // 失敗イベントハンドラー
    this.eventBus.subscribe('PaymentFailed', new PaymentFailedSagaHandler(
      this.sagaStateRepository,
      this.eventBus,
      this.logger
    ));
  }
}

class OrderCreatedSagaHandler implements EventHandler<OrderCreatedEvent> {
  constructor(
    private sagaStateRepository: SagaStateRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    const sagaId = event.orderId; // 注文IDをSaga IDとして使用
    
    // Saga状態を初期化
    const sagaState: SagaState = {
      id: sagaId,
      orderId: event.orderId,
      customerId: event.customerId,
      status: 'ORDER_CREATED',
      steps: {
        orderCreated: true,
        inventoryReserved: false,
        paymentProcessed: false,
        orderConfirmed: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.sagaStateRepository.save(sagaState);

    // 次のステップ（在庫予約）を開始
    await this.eventBus.publish(new ReserveInventoryCommand(
      event.orderId,
      event.items
    ));

    this.logger.info('Order processing saga started', { sagaId, orderId: event.orderId });
  }
}

class InventoryReservedSagaHandler implements EventHandler<InventoryReservedEvent> {
  constructor(
    private sagaStateRepository: SagaStateRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async handle(event: InventoryReservedEvent): Promise<void> {
    const sagaState = await this.sagaStateRepository.findByOrderId(event.orderId);
    
    if (!sagaState) {
      this.logger.warn('Saga state not found for inventory reserved event', { 
        orderId: event.orderId 
      });
      return;
    }

    // Saga状態を更新
    sagaState.status = 'INVENTORY_RESERVED';
    sagaState.steps.inventoryReserved = true;
    sagaState.reservationId = event.reservationId;
    sagaState.updatedAt = new Date();

    await this.sagaStateRepository.save(sagaState);

    // 次のステップ（決済処理）を開始
    await this.eventBus.publish(new ProcessPaymentCommand(
      event.orderId,
      sagaState.customerId,
      event.totalAmount
    ));

    this.logger.info('Inventory reserved, payment processing started', { 
      sagaId: sagaState.id, 
      orderId: event.orderId 
    });
  }
}

class PaymentProcessedSagaHandler implements EventHandler<PaymentProcessedEvent> {
  constructor(
    private sagaStateRepository: SagaStateRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async handle(event: PaymentProcessedEvent): Promise<void> {
    const sagaState = await this.sagaStateRepository.findByOrderId(event.orderId);
    
    if (!sagaState) {
      this.logger.warn('Saga state not found for payment processed event', { 
        orderId: event.orderId 
      });
      return;
    }

    // Saga状態を更新
    sagaState.status = 'PAYMENT_PROCESSED';
    sagaState.steps.paymentProcessed = true;
    sagaState.paymentId = event.paymentId;
    sagaState.updatedAt = new Date();

    await this.sagaStateRepository.save(sagaState);

    // 最終ステップ（注文確定）を開始
    await this.eventBus.publish(new ConfirmOrderCommand(
      event.orderId
    ));

    this.logger.info('Payment processed, order confirmation started', { 
      sagaId: sagaState.id, 
      orderId: event.orderId 
    });
  }
}

class PaymentFailedSagaHandler implements EventHandler<PaymentFailedEvent> {
  constructor(
    private sagaStateRepository: SagaStateRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async handle(event: PaymentFailedEvent): Promise<void> {
    const sagaState = await this.sagaStateRepository.findByOrderId(event.orderId);
    
    if (!sagaState) {
      this.logger.warn('Saga state not found for payment failed event', { 
        orderId: event.orderId 
      });
      return;
    }

    // Saga状態を失敗として更新
    sagaState.status = 'FAILED';
    sagaState.error = event.error;
    sagaState.updatedAt = new Date();

    await this.sagaStateRepository.save(sagaState);

    // 補償処理開始
    await this.startCompensation(sagaState);

    this.logger.error('Payment failed, starting compensation', { 
      sagaId: sagaState.id, 
      orderId: event.orderId,
      error: event.error
    });
  }

  private async startCompensation(sagaState: SagaState): Promise<void> {
    // 在庫予約をキャンセル
    if (sagaState.steps.inventoryReserved && sagaState.reservationId) {
      await this.eventBus.publish(new CancelInventoryReservationCommand(
        sagaState.reservationId
      ));
    }

    // 注文をキャンセル
    if (sagaState.steps.orderCreated) {
      await this.eventBus.publish(new CancelOrderCommand(
        sagaState.orderId,
        'Payment failed'
      ));
    }
  }
}

interface SagaState {
  id: string;
  orderId: string;
  customerId: string;
  status: string;
  steps: {
    orderCreated: boolean;
    inventoryReserved: boolean;
    paymentProcessed: boolean;
    orderConfirmed: boolean;
  };
  reservationId?: string;
  paymentId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Sagaステップの高度な実装

```typescript
// 在庫予約ステップの高度な実装
class ReserveInventoryStep implements SagaStep {
  private reservationId?: string;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(
    private inventoryServiceClient: InventoryServiceClient,
    private items: OrderItem[]
  ) {}

  async execute(): Promise<void> {
    while (this.retryCount < this.maxRetries) {
      try {
        const reservationRequest = {
          items: this.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          timeoutMinutes: 15 // 15分間の予約
        };

        const reservation = await this.inventoryServiceClient.reserveItems(reservationRequest);
        
        if (!reservation.success) {
          throw new Error(`Inventory reservation failed: ${reservation.error}`);
        }

        this.reservationId = reservation.reservationId;
        return; // 成功
      } catch (error) {
        this.retryCount++;
        if (this.retryCount >= this.maxRetries) {
          throw error;
        }
        
        // 指数バックオフでリトライ
        const backoffMs = Math.pow(2, this.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  async compensate(): Promise<void> {
    if (this.reservationId) {
      // コンペンセーションでもリトライ
      let compensationRetries = 0;
      const maxCompensationRetries = 5;
      
      while (compensationRetries < maxCompensationRetries) {
        try {
          await this.inventoryServiceClient.cancelReservation(this.reservationId);
          return;
        } catch (error) {
          compensationRetries++;
          if (compensationRetries >= maxCompensationRetries) {
            // 補償失敗は重大な問題なのでアラート
            console.error('CRITICAL: Inventory reservation compensation failed', {
              reservationId: this.reservationId,
              error: error.message
            });
            // 監視システムへのアラート送信
            break;
          }
          
          const backoffMs = Math.pow(2, compensationRetries) * 2000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
  }

  getReservationId(): string | undefined {
    return this.reservationId;
  }
}

// 決済処理ステップの高度な実装
class ProcessPaymentStep implements SagaStep {
  private paymentId?: string;
  private paymentMethod: PaymentMethod;

  constructor(
    private paymentServiceClient: PaymentServiceClient,
    private command: CreateOrderCommand
  ) {
    this.paymentMethod = command.paymentMethod;
  }

  async execute(): Promise<void> {
    const totalAmount = this.command.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    );

    const paymentRequest = {
      customerId: this.command.customerId,
      amount: totalAmount,
      currency: 'USD',
      paymentMethod: this.paymentMethod,
      orderId: this.command.saga?.getOrder()?.id,
      idempotencyKey: crypto.randomUUID() // 冗等性キー
    };

    const payment = await this.paymentServiceClient.processPayment(paymentRequest);
    
    if (!payment.success) {
      throw new Error(`Payment processing failed: ${payment.error}`);
    }

    this.paymentId = payment.paymentId;

    // 決済結果の検証
    await this.verifyPayment(payment.paymentId);
  }

  async compensate(): Promise<void> {
    if (this.paymentId) {
      try {
        const refundResult = await this.paymentServiceClient.refundPayment({
          paymentId: this.paymentId,
          reason: 'Order cancellation due to saga failure',
          amount: 'full' // 全額返金
        });

        if (!refundResult.success) {
          throw new Error(`Refund failed: ${refundResult.error}`);
        }

        // 返金の確認
        await this.verifyRefund(refundResult.refundId);
      } catch (error) {
        console.error('Payment compensation failed:', error);
        // 金銭関連の補償失敗は手動介入が必要
        throw new CriticalCompensationError(
          'Payment refund failed - manual intervention required',
          { paymentId: this.paymentId, originalError: error.message }
        );
      }
    }
  }

  private async verifyPayment(paymentId: string): Promise<void> {
    // 決済処理の状態を確認
    const maxVerificationAttempts = 5;
    let attempts = 0;

    while (attempts < maxVerificationAttempts) {
      try {
        const status = await this.paymentServiceClient.getPaymentStatus(paymentId);
        
        if (status.status === 'COMPLETED') {
          return;
        } else if (status.status === 'FAILED') {
          throw new Error(`Payment verification failed: ${status.failureReason}`);
        }
        
        // 処理中の場合は待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        if (attempts >= maxVerificationAttempts - 1) {
          throw error;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Payment verification timed out');
  }

  private async verifyRefund(refundId: string): Promise<void> {
    // 返金処理の状態を確認
    const maxVerificationAttempts = 10;
    let attempts = 0;

    while (attempts < maxVerificationAttempts) {
      try {
        const status = await this.paymentServiceClient.getRefundStatus(refundId);
        
        if (status.status === 'COMPLETED') {
          return;
        } else if (status.status === 'FAILED') {
          throw new Error(`Refund verification failed: ${status.failureReason}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
      } catch (error) {
        if (attempts >= maxVerificationAttempts - 1) {
          throw error;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    throw new Error('Refund verification timed out');
  }

  getPaymentId(): string | undefined {
    return this.paymentId;
  }
}

class CriticalCompensationError extends Error {
  constructor(message: string, public details: Record<string, any>) {
    super(message);
    this.name = 'CriticalCompensationError';
  }
}
```

これらの高度なSagaパターン実装により、堅牢で信頼性の高い分散トランザクション管理を実現できます。次は[Event Sourcing](./07-event-sourcing.md)について学習しましょう。