# Microservices - トランザクションパターン

> 基本的な分散トランザクションパターンの理解と実装

## 概要

分散システムにおけるトランザクション管理は、従来のACID特性を維持することが困難です。基本的な分散トランザクションパターンを理解し、適切な手法を選択することが重要です。

## 関連ファイル
- [Sagaパターン](./06-saga-pattern.md) - Sagaパターンの実装詳細
- [Event Sourcing](./07-event-sourcing.md) - イベントソーシングとトランザクション管理
- [トランザクションコーディネーション](./08-transaction-coordination.md) - 調整と復旧パターン

## Sagaパターンの実装

### 1. 基本Sagaフレームワーク

```typescript
// shared/patterns/saga.ts
export interface SagaStep {
  execute(): Promise<void>;
  compensate(): Promise<void>;
}

export abstract class Saga {
  protected steps: SagaStep[] = [];
  protected executedSteps: SagaStep[] = [];
  protected sagaId: string;
  protected status: SagaStatus = SagaStatus.STARTED;

  constructor() {
    this.sagaId = crypto.randomUUID();
  }

  async execute(): Promise<void> {
    this.status = SagaStatus.EXECUTING;
    
    try {
      for (const step of this.steps) {
        await this.executeStep(step);
        this.executedSteps.push(step);
      }
      
      this.status = SagaStatus.COMPLETED;
    } catch (error) {
      this.status = SagaStatus.COMPENSATING;
      await this.compensate();
      this.status = SagaStatus.FAILED;
      throw error;
    }
  }

  async compensate(): Promise<void> {
    // 実行済みステップを逆順で補償
    const stepsToCompensate = [...this.executedSteps].reverse();
    
    for (const step of stepsToCompensate) {
      try {
        await this.compensateStep(step);
      } catch (compensationError) {
        // 補償処理の失敗はログに記録して継続
        console.error('Compensation failed for step:', compensationError);
        // アラートやデッドレター処理なども考慮
      }
    }
    
    this.executedSteps = [];
  }

  private async executeStep(step: SagaStep): Promise<void> {
    try {
      await step.execute();
      this.logStepSuccess(step);
    } catch (error) {
      this.logStepFailure(step, error);
      throw error;
    }
  }

  private async compensateStep(step: SagaStep): Promise<void> {
    try {
      await step.compensate();
      this.logCompensationSuccess(step);
    } catch (error) {
      this.logCompensationFailure(step, error);
      throw error;
    }
  }

  private logStepSuccess(step: SagaStep): void {
    console.log(`Saga ${this.sagaId}: Step ${step.constructor.name} executed successfully`);
  }

  private logStepFailure(step: SagaStep, error: any): void {
    console.error(`Saga ${this.sagaId}: Step ${step.constructor.name} failed:`, error);
  }

  private logCompensationSuccess(step: SagaStep): void {
    console.log(`Saga ${this.sagaId}: Compensation for ${step.constructor.name} executed successfully`);
  }

  private logCompensationFailure(step: SagaStep, error: any): void {
    console.error(`Saga ${this.sagaId}: Compensation for ${step.constructor.name} failed:`, error);
  }
}

export enum SagaStatus {
  STARTED = 'STARTED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  FAILED = 'FAILED'
}
```

### 2. 注文処理Sagaの実装

```typescript
// services/order-service/src/sagas/create-order-saga.ts
export class CreateOrderSaga extends Saga {
  private order: Order;

  constructor(
    private orderRepository: OrderRepository,
    private userServiceClient: UserServiceClient,
    private inventoryServiceClient: InventoryServiceClient,
    private paymentServiceClient: PaymentServiceClient,
    private command: CreateOrderCommand
  ) {
    super();
    this.setupSteps();
  }

  private setupSteps(): void {
    this.steps = [
      new ValidateUserStep(this.userServiceClient, this.command.customerId),
      new CreateOrderStep(this.orderRepository, this.command),
      new ReserveInventoryStep(this.inventoryServiceClient, this.command.items),
      new ProcessPaymentStep(this.paymentServiceClient, this.command),
      new ConfirmOrderStep(this.orderRepository)
    ];
  }

  async execute(): Promise<Order> {
    await super.execute();
    return this.order;
  }

  setOrder(order: Order): void {
    this.order = order;
  }

  getOrder(): Order {
    return this.order;
  }
}

class ValidateUserStep implements SagaStep {
  constructor(
    private userServiceClient: UserServiceClient,
    private customerId: string
  ) {}

  async execute(): Promise<void> {
    const user = await this.userServiceClient.getUser(this.customerId);
    if (!user) {
      throw new Error(`User not found: ${this.customerId}`);
    }
    if (!user.isActive) {
      throw new Error(`User is not active: ${this.customerId}`);
    }
    if (user.accountStatus === 'SUSPENDED') {
      throw new Error(`User account is suspended: ${this.customerId}`);
    }
  }

  async compensate(): Promise<void> {
    // ユーザー検証は補償処理不要
  }
}

class CreateOrderStep implements SagaStep {
  private orderId?: string;

  constructor(
    private orderRepository: OrderRepository,
    private command: CreateOrderCommand
  ) {}

  async execute(): Promise<void> {
    const order = new Order({
      customerId: this.command.customerId,
      items: this.command.items,
      shippingAddress: this.command.shippingAddress,
      status: OrderStatus.PENDING
    });

    await this.orderRepository.save(order);
    this.orderId = order.id;
    
    // Sagaに注文を設定（他のステップで使用）
    if (this.command.saga) {
      this.command.saga.setOrder(order);
    }
  }

  async compensate(): Promise<void> {
    if (this.orderId) {
      await this.orderRepository.delete(this.orderId);
    }
  }

  getOrderId(): string | undefined {
    return this.orderId;
  }
}
```

### 3. 分散トランザクションの基本理念

```typescript
// shared/patterns/transaction-patterns.ts
export enum ConsistencyModel {
  EVENTUAL = 'EVENTUAL',
  STRONG = 'STRONG',
  WEAK = 'WEAK'
}

export interface TransactionCoordinator {
  begin(): Promise<string>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
  getStatus(transactionId: string): Promise<TransactionStatus>;
}

export enum TransactionStatus {
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ABORTED = 'ABORTED',
  PREPARING = 'PREPARING'
}

// 2フェーズコミットパターンの実装
export class TwoPhaseCommitCoordinator implements TransactionCoordinator {
  private transactions = new Map<string, TransactionContext>();
  private participants = new Map<string, Participant[]>();

  async begin(): Promise<string> {
    const transactionId = crypto.randomUUID();
    this.transactions.set(transactionId, {
      id: transactionId,
      status: TransactionStatus.ACTIVE,
      startTime: new Date()
    });
    return transactionId;
  }

  async commit(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const participants = this.participants.get(transactionId) || [];
    
    // Phase 1: Prepare
    transaction.status = TransactionStatus.PREPARING;
    const prepareResults = await Promise.all(
      participants.map(p => this.prepare(p, transactionId))
    );

    // すべての参加者が準備完了した場合のみコミット
    if (prepareResults.every(result => result === true)) {
      // Phase 2: Commit
      await Promise.all(
        participants.map(p => this.commitParticipant(p, transactionId))
      );
      transaction.status = TransactionStatus.COMMITTED;
    } else {
      // 一つでも準備に失敗した場合はロールバック
      await this.rollback(transactionId);
    }
  }

  async rollback(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const participants = this.participants.get(transactionId) || [];
    
    await Promise.all(
      participants.map(p => this.rollbackParticipant(p, transactionId))
    );
    
    transaction.status = TransactionStatus.ABORTED;
  }

  async getStatus(transactionId: string): Promise<TransactionStatus> {
    const transaction = this.transactions.get(transactionId);
    return transaction?.status || TransactionStatus.ABORTED;
  }

  registerParticipant(transactionId: string, participant: Participant): void {
    if (!this.participants.has(transactionId)) {
      this.participants.set(transactionId, []);
    }
    this.participants.get(transactionId)!.push(participant);
  }

  private async prepare(participant: Participant, transactionId: string): Promise<boolean> {
    try {
      return await participant.prepare(transactionId);
    } catch (error) {
      console.error(`Prepare failed for participant ${participant.name}:`, error);
      return false;
    }
  }

  private async commitParticipant(participant: Participant, transactionId: string): Promise<void> {
    try {
      await participant.commit(transactionId);
    } catch (error) {
      console.error(`Commit failed for participant ${participant.name}:`, error);
      // コミット段階での失敗は一貫性問題を引き起こす
    }
  }

  private async rollbackParticipant(participant: Participant, transactionId: string): Promise<void> {
    try {
      await participant.rollback(transactionId);
    } catch (error) {
      console.error(`Rollback failed for participant ${participant.name}:`, error);
    }
  }
}

interface TransactionContext {
  id: string;
  status: TransactionStatus;
  startTime: Date;
}

interface Participant {
  name: string;
  prepare(transactionId: string): Promise<boolean>;
  commit(transactionId: string): Promise<void>;
  rollback(transactionId: string): Promise<void>;
}
```

### 4. ベストプラクティス

```typescript
// 補償処理のガイドライン
class CompensationGuidelines {
  // 冗等性の確保
  static async idempotentCompensation(operation: () => Promise<void>): Promise<void> {
    const compensationId = crypto.randomUUID();
    
    try {
      await operation();
    } catch (error) {
      // 既に実行済みかチェック
      if (this.isAlreadyCompensated(compensationId)) {
        return; // 冗等性により成功とみなす
      }
      throw error;
    }
  }

  // 部分補償の処理
  static async partialCompensation(
    completedOperations: string[],
    compensationMap: Map<string, () => Promise<void>>
  ): Promise<void> {
    for (const operation of completedOperations.reverse()) {
      const compensationFn = compensationMap.get(operation);
      if (compensationFn) {
        try {
          await compensationFn();
        } catch (error) {
          // 補償失敗をログに記録し、手動介入をアラート
          console.error(`Compensation failed for operation: ${operation}`, error);
        }
      }
    }
  }

  private static isAlreadyCompensated(compensationId: string): boolean {
    // 補償実行歷のチェックロジック
    return false; // 実装例
  }
}
```

これらの基本的なトランザクションパターンを理解し、適切に実装することで、マイクロサービス間でのデータ一貫性を保ちながら、システムの可用性と拡張性を実現できます。次は[Sagaパターンの詳細](./06-saga-pattern.md)について学習しましょう。