# Microservices - 分散トランザクション

> Sagaパターンによる一貫性管理と分散システムでのデータ整合性

## 概要

分散システムにおけるトランザクション管理は、従来のACID特性を維持することが困難です。Sagaパターンは、複数のサービスにまたがるビジネストランザクションを管理し、障害発生時には補償トランザクション（Compensation）を実行して整合性を保つ手法です。

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
        // 補償処理の失敗はログに記録して続行
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

class ReserveInventoryStep implements SagaStep {
  private reservationId?: string;

  constructor(
    private inventoryServiceClient: InventoryServiceClient,
    private items: OrderItem[]
  ) {}

  async execute(): Promise<void> {
    const reservationRequest = {
      items: this.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    };

    const reservation = await this.inventoryServiceClient.reserveItems(reservationRequest);
    
    if (!reservation.success) {
      throw new Error(`Inventory reservation failed: ${reservation.error}`);
    }

    this.reservationId = reservation.reservationId;
  }

  async compensate(): Promise<void> {
    if (this.reservationId) {
      await this.inventoryServiceClient.cancelReservation(this.reservationId);
    }
  }

  getReservationId(): string | undefined {
    return this.reservationId;
  }
}

class ProcessPaymentStep implements SagaStep {
  private paymentId?: string;

  constructor(
    private paymentServiceClient: PaymentServiceClient,
    private command: CreateOrderCommand
  ) {}

  async execute(): Promise<void> {
    const totalAmount = this.command.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    );

    const paymentRequest = {
      customerId: this.command.customerId,
      amount: totalAmount,
      currency: 'USD',
      paymentMethod: this.command.paymentMethod,
      orderId: this.command.saga?.getOrder()?.id
    };

    const payment = await this.paymentServiceClient.processPayment(paymentRequest);
    
    if (!payment.success) {
      throw new Error(`Payment processing failed: ${payment.error}`);
    }

    this.paymentId = payment.paymentId;
  }

  async compensate(): Promise<void> {
    if (this.paymentId) {
      await this.paymentServiceClient.refundPayment({
        paymentId: this.paymentId,
        reason: 'Order cancellation due to saga failure'
      });
    }
  }

  getPaymentId(): string | undefined {
    return this.paymentId;
  }
}

class ConfirmOrderStep implements SagaStep {
  constructor(
    private orderRepository: OrderRepository
  ) {}

  async execute(): Promise<void> {
    const order = this.command.saga?.getOrder();
    if (!order) {
      throw new Error('Order not found in saga context');
    }

    order.status = OrderStatus.CONFIRMED;
    order.confirmedAt = new Date();
    
    await this.orderRepository.save(order);
  }

  async compensate(): Promise<void> {
    const order = this.command.saga?.getOrder();
    if (!order) return;

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = 'Saga compensation';
    
    await this.orderRepository.save(order);
  }
}
```

### 3. 分散Sagaオーケストレーター

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

### 4. イベント駆動Saga（コレオグラフィー）

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

## 分散ロックとリーダー選出

### 1. 分散ロック実装

```typescript
// shared/infrastructure/distributed-lock.ts
export class DistributedLock {
  constructor(
    private redis: Redis,
    private lockKey: string,
    private ttl: number = 30000 // 30秒
  ) {}

  async acquire(): Promise<boolean> {
    const lockId = crypto.randomUUID();
    const result = await this.redis.set(
      this.lockKey,
      lockId,
      'PX', // TTLをミリ秒で設定
      this.ttl,
      'NX' // キーが存在しない場合のみ設定
    );

    if (result === 'OK') {
      // ロック取得成功
      this.scheduleRenewal(lockId);
      return true;
    }

    return false;
  }

  async release(): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, this.lockKey, this.lockId);
  }

  private scheduleRenewal(lockId: string): void {
    const renewInterval = this.ttl / 3; // TTLの1/3間隔で更新

    const renewal = setInterval(async () => {
      try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
          else
            return 0
          end
        `;

        const result = await this.redis.eval(script, 1, this.lockKey, lockId, this.ttl);
        
        if (result === 0) {
          // ロックが失われた
          clearInterval(renewal);
        }
      } catch (error) {
        clearInterval(renewal);
      }
    }, renewInterval);
  }
}
```

### 2. Saga実行におけるデッドロック検出

```typescript
// shared/patterns/deadlock-detector.ts
export class SagaDeadlockDetector {
  private dependencyGraph = new Map<string, Set<string>>();
  
  constructor(
    private sagaRepository: SagaRepository,
    private logger: Logger
  ) {}

  async detectDeadlock(): Promise<string[]> {
    await this.buildDependencyGraph();
    return this.findCycles();
  }

  private async buildDependencyGraph(): Promise<void> {
    this.dependencyGraph.clear();
    
    const activeSagas = await this.sagaRepository.findActiveSagas();
    
    for (const saga of activeSagas) {
      const dependencies = await this.getSagaDependencies(saga);
      this.dependencyGraph.set(saga.id, new Set(dependencies));
    }
  }

  private async getSagaDependencies(saga: SagaRecord): Promise<string[]> {
    const dependencies: string[] = [];
    
    // リソースロックに基づく依存関係を分析
    const lockedResources = await this.getLockedResources(saga.id);
    
    for (const resource of lockedResources) {
      const otherSagas = await this.getSagasWaitingForResource(resource, saga.id);
      dependencies.push(...otherSagas);
    }
    
    return dependencies;
  }

  private findCycles(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    for (const [sagaId] of this.dependencyGraph) {
      if (!visited.has(sagaId)) {
        this.findCyclesDFS(sagaId, visited, recursionStack, cycles, []);
      }
    }

    return cycles;
  }

  private findCyclesDFS(
    sagaId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    cycles: string[],
    currentPath: string[]
  ): boolean {
    visited.add(sagaId);
    recursionStack.add(sagaId);
    currentPath.push(sagaId);

    const dependencies = this.dependencyGraph.get(sagaId) || new Set();

    for (const dependentSaga of dependencies) {
      if (!visited.has(dependentSaga)) {
        if (this.findCyclesDFS(dependentSaga, visited, recursionStack, cycles, currentPath)) {
          return true;
        }
      } else if (recursionStack.has(dependentSaga)) {
        // サイクル検出
        const cycleStartIndex = currentPath.indexOf(dependentSaga);
        const cycle = currentPath.slice(cycleStartIndex).concat([dependentSaga]);
        cycles.push(cycle.join(' -> '));
        
        this.logger.warn('Deadlock detected', { cycle: cycle.join(' -> ') });
        return true;
      }
    }

    recursionStack.delete(sagaId);
    currentPath.pop();
    return false;
  }

  async resolveDeadlock(cycles: string[]): Promise<void> {
    for (const cycle of cycles) {
      const sagaIds = cycle.split(' -> ');
      
      // 最も優先度の低いSagaを中止
      const sagaToAbort = await this.selectSagaToAbort(sagaIds);
      
      if (sagaToAbort) {
        await this.abortSaga(sagaToAbort);
        this.logger.info('Saga aborted to resolve deadlock', { 
          abortedSaga: sagaToAbort,
          cycle 
        });
      }
    }
  }

  private async selectSagaToAbort(sagaIds: string[]): Promise<string | null> {
    const sagas = await Promise.all(
      sagaIds.map(id => this.sagaRepository.findById(id))
    );

    // 優先度が最も低く、実行時間が最も短いSagaを選択
    let selectedSaga: SagaRecord | null = null;
    let minPriority = Infinity;
    let minRuntime = Infinity;

    for (const saga of sagas) {
      if (!saga) continue;

      const runtime = Date.now() - saga.createdAt.getTime();
      const priority = saga.priority || 0;

      if (priority < minPriority || (priority === minPriority && runtime < minRuntime)) {
        minPriority = priority;
        minRuntime = runtime;
        selectedSaga = saga;
      }
    }

    return selectedSaga?.id || null;
  }

  private async abortSaga(sagaId: string): Promise<void> {
    // Sagaを中止し、補償処理を実行
    const saga = await this.sagaRepository.findById(sagaId);
    if (saga) {
      saga.status = SagaStatus.FAILED;
      saga.error = 'Aborted due to deadlock resolution';
      await this.sagaRepository.save(saga);
    }
  }
}
```

## 分散トランザクション監視

### 1. Sagaモニタリング

```typescript
// shared/monitoring/saga-monitor.ts
export class SagaMonitor {
  constructor(
    private sagaRepository: SagaRepository,
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.monitorSagaHealth();
      await this.detectStuckSagas();
      await this.collectMetrics();
    }, 30000); // 30秒間隔
  }

  private async monitorSagaHealth(): Promise<void> {
    const activeSagas = await this.sagaRepository.findActiveSagas();
    
    for (const saga of activeSagas) {
      const runtime = Date.now() - saga.createdAt.getTime();
      const maxExpectedRuntime = this.getMaxExpectedRuntime(saga.type);
      
      if (runtime > maxExpectedRuntime) {
        await this.alertManager.send({
          severity: 'warning',
          summary: `Long-running saga detected: ${saga.type}`,
          description: `Saga ${saga.id} has been running for ${runtime}ms`,
          saga: {
            id: saga.id,
            type: saga.type,
            runtime,
            status: saga.status
          }
        });
      }
    }
  }

  private async detectStuckSagas(): Promise<void> {
    const stuckSagas = await this.sagaRepository.findStuckSagas();
    
    for (const saga of stuckSagas) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `Stuck saga detected: ${saga.type}`,
        description: `Saga ${saga.id} appears to be stuck in ${saga.status} status`,
        saga: {
          id: saga.id,
          type: saga.type,
          status: saga.status,
          lastUpdated: saga.updatedAt
        }
      });
    }
  }

  private async collectMetrics(): Promise<void> {
    const metrics = await this.calculateSagaMetrics();
    
    this.metricsCollector.recordGauge('sagas_active_total', metrics.activeCount);
    this.metricsCollector.recordGauge('sagas_completed_total', metrics.completedCount);
    this.metricsCollector.recordGauge('sagas_failed_total', metrics.failedCount);
    this.metricsCollector.recordHistogram('saga_duration_seconds', metrics.averageDuration);
    this.metricsCollector.recordGauge('saga_success_rate', metrics.successRate);
  }

  private async calculateSagaMetrics(): Promise<SagaMetrics> {
    const stats = await this.sagaRepository.getStatistics();
    
    return {
      activeCount: stats.active,
      completedCount: stats.completed,
      failedCount: stats.failed,
      averageDuration: stats.averageDuration,
      successRate: stats.completed / (stats.completed + stats.failed)
    };
  }

  private getMaxExpectedRuntime(sagaType: string): number {
    const timeouts = {
      'CreateOrderSaga': 5 * 60 * 1000, // 5分
      'ProcessRefundSaga': 10 * 60 * 1000, // 10分
      'UserRegistrationSaga': 2 * 60 * 1000 // 2分
    };
    
    return timeouts[sagaType] || 5 * 60 * 1000; // デフォルト5分
  }
}

interface SagaMetrics {
  activeCount: number;
  completedCount: number;
  failedCount: number;
  averageDuration: number;
  successRate: number;
}
```

## ベストプラクティス

### 1. 補償処理の設計原則

```typescript
// 補償処理のガイドライン
class CompensationGuidelines {
  // 冪等性の確保
  static async idempotentCompensation(operation: () => Promise<void>): Promise<void> {
    const compensationId = crypto.randomUUID();
    
    try {
      await operation();
    } catch (error) {
      // 既に実行済みかチェック
      if (this.isAlreadyCompensated(compensationId)) {
        return; // 冪等性により成功とみなす
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
}
```

### 2. Saga設計パターン

- **Forward Recovery**: 失敗したステップをリトライして前進
- **Backward Recovery**: 補償処理による巻き戻し  
- **Mixed Recovery**: 状況に応じた柔軟な対応
- **Timeout Handling**: 長時間応答のないステップの処理
- **Human Intervention**: 自動回復不可能な場合の手動介入

分散トランザクション管理は複雑ですが、Sagaパターンの適切な実装により、マイクロサービス間でのデータ整合性を保ちながら、システムの可用性と拡張性を実現できます。