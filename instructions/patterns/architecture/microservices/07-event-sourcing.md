# Microservices - Event Sourcing

> イベントソーシングと分散トランザクション管理

## 概要

Event Sourcingは、アプリケーションの状態変更をイベントのシーケンスとして保存するパターンです。この手法はマイクロサービス環境での分散トランザクション管理と相性が良く、監査証跡と時間旅行デバッグを可能にします。

## 関連ファイル
- [トランザクションパターン](./05-transaction-patterns.md) - 基本的なトランザクションパターン
- [Sagaパターン](./06-saga-pattern.md) - Sagaパターンの実装詳細
- [トランザクションコーディネーション](./08-transaction-coordination.md) - 調整と復旧パターン

## Event Sourcing基礎

### 1. イベントストアの実装

```typescript
// shared/event-store/event-store.ts
export interface Event {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  data: any;
  metadata: EventMetadata;
  version: number;
  timestamp: Date;
}

export interface EventMetadata {
  userId?: string;
  correlationId?: string;
  causationId?: string;
  source: string;
  traceId?: string;
}

export interface EventStore {
  saveEvents(aggregateId: string, events: Event[], expectedVersion: number): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<Event[]>;
  getAllEvents(fromPosition?: number, maxCount?: number): Promise<Event[]>;
  subscribe(eventType: string, handler: EventHandler): Promise<void>;
}

export class PostgresEventStore implements EventStore {
  constructor(
    private database: Database,
    private eventBus: EventBus
  ) {}

  async saveEvents(
    aggregateId: string, 
    events: Event[], 
    expectedVersion: number
  ): Promise<void> {
    const client = await this.database.getClient();
    
    try {
      await client.query('BEGIN');
      
      // バージョンチェック
      const currentVersion = await this.getCurrentVersion(client, aggregateId);
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, but current version is ${currentVersion}`
        );
      }

      // イベントの保存
      for (const event of events) {
        await this.insertEvent(client, event);
      }
      
      await client.query('COMMIT');
      
      // イベントバスへの発行
      for (const event of events) {
        await this.eventBus.publish(event);
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<Event[]> {
    const query = `
      SELECT id, aggregate_id, aggregate_type, event_type, data, metadata, version, timestamp
      FROM events 
      WHERE aggregate_id = $1 AND version > $2
      ORDER BY version ASC
    `;
    
    const result = await this.database.query(query, [aggregateId, fromVersion]);
    
    return result.rows.map(row => ({
      id: row.id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: JSON.parse(row.data),
      metadata: JSON.parse(row.metadata),
      version: row.version,
      timestamp: row.timestamp
    }));
  }

  async getAllEvents(fromPosition = 0, maxCount = 1000): Promise<Event[]> {
    const query = `
      SELECT id, aggregate_id, aggregate_type, event_type, data, metadata, version, timestamp
      FROM events 
      WHERE position > $1
      ORDER BY position ASC
      LIMIT $2
    `;
    
    const result = await this.database.query(query, [fromPosition, maxCount]);
    
    return result.rows.map(row => ({
      id: row.id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: JSON.parse(row.data),
      metadata: JSON.parse(row.metadata),
      version: row.version,
      timestamp: row.timestamp
    }));
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    await this.eventBus.subscribe(eventType, handler);
  }

  private async getCurrentVersion(client: any, aggregateId: string): Promise<number> {
    const query = 'SELECT COALESCE(MAX(version), 0) as version FROM events WHERE aggregate_id = $1';
    const result = await client.query(query, [aggregateId]);
    return result.rows[0].version;
  }

  private async insertEvent(client: any, event: Event): Promise<void> {
    const query = `
      INSERT INTO events (id, aggregate_id, aggregate_type, event_type, data, metadata, version, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await client.query(query, [
      event.id,
      event.aggregateId,
      event.aggregateType,
      event.eventType,
      JSON.stringify(event.data),
      JSON.stringify(event.metadata),
      event.version,
      event.timestamp
    ]);
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
```

### 2. アグリゲートルートの実装

```typescript
// shared/domain/aggregate-root.ts
export abstract class AggregateRoot {
  private _id: string;
  private _version: number = 0;
  private _uncommittedEvents: Event[] = [];

  constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get uncommittedEvents(): Event[] {
    return this._uncommittedEvents;
  }

  protected applyEvent(event: Event): void {
    this.when(event);
    this._version++;
    this._uncommittedEvents.push(event);
  }

  public replayEvents(events: Event[]): void {
    events.forEach(event => {
      this.when(event);
      this._version++;
    });
  }

  public markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  protected abstract when(event: Event): void;

  protected createEvent(
    eventType: string,
    data: any,
    metadata: Partial<EventMetadata> = {}
  ): Event {
    return {
      id: crypto.randomUUID(),
      aggregateId: this._id,
      aggregateType: this.constructor.name,
      eventType,
      data,
      metadata: {
        source: this.constructor.name,
        ...metadata
      },
      version: this._version + 1,
      timestamp: new Date()
    };
  }
}

// 注文アグリゲートの実装
export class OrderAggregate extends AggregateRoot {
  private customerId: string;
  private items: OrderItem[];
  private status: OrderStatus;
  private totalAmount: number;
  private createdAt: Date;
  private confirmedAt?: Date;

  constructor(id: string) {
    super(id);
    this.status = OrderStatus.PENDING;
  }

  static create(
    customerId: string,
    items: OrderItem[],
    shippingAddress: Address
  ): OrderAggregate {
    const orderId = crypto.randomUUID();
    const order = new OrderAggregate(orderId);
    
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const event = order.createEvent('OrderCreated', {
      customerId,
      items,
      shippingAddress,
      totalAmount,
      createdAt: new Date()
    });

    order.applyEvent(event);
    return order;
  }

  reserveInventory(reservationId: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error(`Cannot reserve inventory for order in ${this.status} status`);
    }

    const event = this.createEvent('InventoryReserved', {
      reservationId,
      items: this.items
    });

    this.applyEvent(event);
  }

  processPayment(paymentId: string, amount: number): void {
    if (this.status !== OrderStatus.INVENTORY_RESERVED) {
      throw new Error(`Cannot process payment for order in ${this.status} status`);
    }

    if (amount !== this.totalAmount) {
      throw new Error(`Payment amount ${amount} does not match order total ${this.totalAmount}`);
    }

    const event = this.createEvent('PaymentProcessed', {
      paymentId,
      amount,
      processedAt: new Date()
    });

    this.applyEvent(event);
  }

  confirm(): void {
    if (this.status !== OrderStatus.PAYMENT_PROCESSED) {
      throw new Error(`Cannot confirm order in ${this.status} status`);
    }

    const event = this.createEvent('OrderConfirmed', {
      confirmedAt: new Date()
    });

    this.applyEvent(event);
  }

  cancel(reason: string): void {
    if (this.status === OrderStatus.CONFIRMED || this.status === OrderStatus.CANCELLED) {
      throw new Error(`Cannot cancel order in ${this.status} status`);
    }

    const event = this.createEvent('OrderCancelled', {
      reason,
      cancelledAt: new Date()
    });

    this.applyEvent(event);
  }

  protected when(event: Event): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.customerId = event.data.customerId;
        this.items = event.data.items;
        this.totalAmount = event.data.totalAmount;
        this.createdAt = new Date(event.data.createdAt);
        this.status = OrderStatus.PENDING;
        break;

      case 'InventoryReserved':
        this.status = OrderStatus.INVENTORY_RESERVED;
        break;

      case 'PaymentProcessed':
        this.status = OrderStatus.PAYMENT_PROCESSED;
        break;

      case 'OrderConfirmed':
        this.status = OrderStatus.CONFIRMED;
        this.confirmedAt = new Date(event.data.confirmedAt);
        break;

      case 'OrderCancelled':
        this.status = OrderStatus.CANCELLED;
        break;

      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  // Getters
  getCustomerId(): string {
    return this.customerId;
  }

  getItems(): OrderItem[] {
    return this.items;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getTotalAmount(): number {
    return this.totalAmount;
  }
}

export enum OrderStatus {
  PENDING = 'PENDING',
  INVENTORY_RESERVED = 'INVENTORY_RESERVED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}
```

### 3. リポジトリの実装

```typescript
// shared/repository/event-sourced-repository.ts
export abstract class EventSourcedRepository<T extends AggregateRoot> {
  constructor(
    protected eventStore: EventStore,
    protected snapshotStore?: SnapshotStore
  ) {}

  async save(aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.uncommittedEvents;
    if (uncommittedEvents.length === 0) {
      return;
    }

    await this.eventStore.saveEvents(
      aggregate.id,
      uncommittedEvents,
      aggregate.version - uncommittedEvents.length
    );

    aggregate.markEventsAsCommitted();

    // スナップショットの作成判定
    if (this.shouldCreateSnapshot(aggregate)) {
      await this.createSnapshot(aggregate);
    }
  }

  async findById(id: string): Promise<T | null> {
    let aggregate: T | null = null;
    let fromVersion = 0;

    // スナップショットからの復元を試みる
    if (this.snapshotStore) {
      const snapshot = await this.snapshotStore.getSnapshot(id);
      if (snapshot) {
        aggregate = this.createFromSnapshot(snapshot);
        fromVersion = snapshot.version;
      }
    }

    // イベントからの復元
    const events = await this.eventStore.getEvents(id, fromVersion);
    if (events.length === 0 && !aggregate) {
      return null;
    }

    if (!aggregate) {
      aggregate = this.createEmptyAggregate(id);
    }

    aggregate.replayEvents(events);
    return aggregate;
  }

  protected abstract createEmptyAggregate(id: string): T;
  protected abstract createFromSnapshot(snapshot: Snapshot): T;

  private shouldCreateSnapshot(aggregate: T): boolean {
    // 10個のイベントごとにスナップショットを作成
    return aggregate.version % 10 === 0;
  }

  private async createSnapshot(aggregate: T): Promise<void> {
    if (!this.snapshotStore) return;

    const snapshot: Snapshot = {
      aggregateId: aggregate.id,
      aggregateType: aggregate.constructor.name,
      version: aggregate.version,
      data: this.serializeAggregate(aggregate),
      timestamp: new Date()
    };

    await this.snapshotStore.saveSnapshot(snapshot);
  }

  protected abstract serializeAggregate(aggregate: T): any;
}

export class OrderRepository extends EventSourcedRepository<OrderAggregate> {
  protected createEmptyAggregate(id: string): OrderAggregate {
    return new OrderAggregate(id);
  }

  protected createFromSnapshot(snapshot: Snapshot): OrderAggregate {
    const order = new OrderAggregate(snapshot.aggregateId);
    // スナップショットデータからの復元ロジック
    return this.deserializeOrder(snapshot.data, order);
  }

  protected serializeAggregate(aggregate: OrderAggregate): any {
    return {
      customerId: aggregate.getCustomerId(),
      items: aggregate.getItems(),
      status: aggregate.getStatus(),
      totalAmount: aggregate.getTotalAmount()
    };
  }

  private deserializeOrder(data: any, order: OrderAggregate): OrderAggregate {
    // プライベートフィールドの設定ロジック
    return order;
  }
}

interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  timestamp: Date;
}

interface SnapshotStore {
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getSnapshot(aggregateId: string): Promise<Snapshot | null>;
}
```

### 4. プロジェクションの実装

```typescript
// shared/projections/projection-manager.ts
export interface Projection {
  name: string;
  handle(event: Event): Promise<void>;
  replay(fromPosition?: number): Promise<void>;
}

export class ProjectionManager {
  private projections = new Map<string, Projection>();
  private isRunning = false;

  constructor(
    private eventStore: EventStore,
    private checkpointStore: CheckpointStore
  ) {}

  registerProjection(projection: Projection): void {
    this.projections.set(projection.name, projection);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // 各プロジェクションを開始
    for (const projection of this.projections.values()) {
      this.startProjection(projection);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private async startProjection(projection: Projection): Promise<void> {
    const checkpoint = await this.checkpointStore.getCheckpoint(projection.name);
    let currentPosition = checkpoint?.position || 0;

    while (this.isRunning) {
      try {
        const events = await this.eventStore.getAllEvents(currentPosition, 100);
        
        if (events.length === 0) {
          // イベントがない場合は待機
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        for (const event of events) {
          await projection.handle(event);
          currentPosition = event.position;
          
          // チェックポイントの更新
          await this.checkpointStore.saveCheckpoint({
            projectionName: projection.name,
            position: currentPosition,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error(`Error in projection ${projection.name}:`, error);
        // エラー時は少し待機してリトライ
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// 注文一覧ビューのプロジェクション
export class OrderListProjection implements Projection {
  name = 'OrderList';

  constructor(private database: Database) {}

  async handle(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'OrderCreated':
        await this.handleOrderCreated(event);
        break;
      case 'OrderConfirmed':
        await this.handleOrderConfirmed(event);
        break;
      case 'OrderCancelled':
        await this.handleOrderCancelled(event);
        break;
    }
  }

  async replay(fromPosition = 0): Promise<void> {
    // ビューをクリアして再構築
    await this.database.query('DELETE FROM order_list_view');
    
    // イベントを再生
    const eventStore = new PostgresEventStore(this.database, null);
    const events = await eventStore.getAllEvents(fromPosition);
    
    for (const event of events) {
      await this.handle(event);
    }
  }

  private async handleOrderCreated(event: Event): Promise<void> {
    const query = `
      INSERT INTO order_list_view (order_id, customer_id, total_amount, status, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await this.database.query(query, [
      event.aggregateId,
      event.data.customerId,
      event.data.totalAmount,
      'PENDING',
      event.timestamp
    ]);
  }

  private async handleOrderConfirmed(event: Event): Promise<void> {
    const query = `
      UPDATE order_list_view 
      SET status = 'CONFIRMED', confirmed_at = $2
      WHERE order_id = $1
    `;
    
    await this.database.query(query, [
      event.aggregateId,
      event.data.confirmedAt
    ]);
  }

  private async handleOrderCancelled(event: Event): Promise<void> {
    const query = `
      UPDATE order_list_view 
      SET status = 'CANCELLED', cancelled_at = $2, cancellation_reason = $3
      WHERE order_id = $1
    `;
    
    await this.database.query(query, [
      event.aggregateId,
      event.data.cancelledAt,
      event.data.reason
    ]);
  }
}

interface Checkpoint {
  projectionName: string;
  position: number;
  timestamp: Date;
}

interface CheckpointStore {
  getCheckpoint(projectionName: string): Promise<Checkpoint | null>;
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
}
```

Event Sourcingはマイクロサービス環境での強力なパターンですが、適切な設計と実装が必要です。次は[トランザクションコーディネーション](./08-transaction-coordination.md)について学習しましょう。