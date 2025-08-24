# ドメインイベント

## ドメインイベント基本実装

### イベント基底クラス

```typescript
// shared/domain/events/domain-event.ts
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;
  public readonly eventVersion: number;

  constructor() {
    this.occurredOn = new Date();
    this.eventId = generateEventId();
    this.eventVersion = 1;
  }

  abstract get aggregateId(): string;
  abstract get eventName(): string;
  abstract get eventData(): any;
}

// shared/domain/events/event-handler.ts
export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventSubscriber {
  subscribedTo(): string[];
  handle(event: DomainEvent): Promise<void>;
}
```

### 具体的なドメインイベント

```typescript
// catalog/domain/events/product-events.ts
export class ProductCreatedEvent extends DomainEvent {
  constructor(
    private readonly productId: ProductId,
    private readonly productName: ProductName,
    private readonly categoryId: CategoryId,
    private readonly brandId: BrandId,
    private readonly sku: SKU
  ) {
    super();
  }

  get aggregateId(): string {
    return this.productId.value;
  }

  get eventName(): string {
    return 'ProductCreated';
  }

  get eventData(): any {
    return {
      productId: this.productId.value,
      productName: this.productName.value,
      categoryId: this.categoryId.value,
      brandId: this.brandId.value,
      sku: this.sku.value
    };
  }
}

export class ProductPriceChangedEvent extends DomainEvent {
  constructor(
    private readonly productId: ProductId,
    private readonly oldPrice: Price | null,
    private readonly newPrice: Price,
    private readonly reason: string,
    private readonly changedBy: string
  ) {
    super();
  }

  get aggregateId(): string {
    return this.productId.value;
  }

  get eventName(): string {
    return 'ProductPriceChanged';
  }

  get eventData(): any {
    return {
      productId: this.productId.value,
      oldPrice: this.oldPrice ? {
        amount: this.oldPrice.amount,
        currency: this.oldPrice.currency.code
      } : null,
      newPrice: {
        amount: this.newPrice.amount,
        currency: this.newPrice.currency.code
      },
      reason: this.reason,
      changedBy: this.changedBy
    };
  }
}
```

## イベントバス実装

```typescript
// shared/infrastructure/events/event-bus.ts
export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(subscriber: EventSubscriber): void;
}

export class InMemoryEventBus implements EventBus {
  private subscribers = new Map<string, EventSubscriber[]>();

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const eventSubscribers = this.subscribers.get(event.eventName) || [];
      
      await Promise.all(
        eventSubscribers.map(subscriber =>
          subscriber.handle(event).catch(error =>
            console.error(`Error handling event ${event.eventName}:`, error)
          )
        )
      );
    }
  }

  subscribe(subscriber: EventSubscriber): void {
    const events = subscriber.subscribedTo();
    
    for (const eventName of events) {
      if (!this.subscribers.has(eventName)) {
        this.subscribers.set(eventName, []);
      }
      
      this.subscribers.get(eventName)!.push(subscriber);
    }
  }
}

// shared/infrastructure/events/rabbitmq-event-bus.ts
export class RabbitMQEventBus implements EventBus {
  private connection: Connection;
  private channel: Channel;

  constructor(
    private connectionUrl: string,
    private exchangeName: string = 'domain-events'
  ) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.connectionUrl);
    this.channel = await this.connection.createChannel();
    
    await this.channel.assertExchange(this.exchangeName, 'topic', {
      durable: true
    });
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const routingKey = `${event.aggregateId}.${event.eventName}`;
      const message = Buffer.from(JSON.stringify({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        eventData: event.eventData,
        eventVersion: event.eventVersion
      }));

      this.channel.publish(
        this.exchangeName,
        routingKey,
        message,
        { persistent: true }
      );
    }
  }

  async subscribe(subscriber: EventSubscriber): Promise<void> {
    const queueName = `${subscriber.constructor.name}-queue`;
    
    await this.channel.assertQueue(queueName, {
      durable: true,
      exclusive: false
    });

    // 購読するイベントごとにバインディング
    for (const eventName of subscriber.subscribedTo()) {
      await this.channel.bindQueue(
        queueName,
        this.exchangeName,
        `*.${eventName}`
      );
    }

    // メッセージ消費
    await this.channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const eventData = JSON.parse(msg.content.toString());
          const event = this.reconstructEvent(eventData);
          
          await subscriber.handle(event);
          
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          this.channel.nack(msg, false, true); // 再キュー
        }
      }
    });
  }
}
```

## イベントハンドラー実装

```typescript
// order/application/event-handlers/product-price-changed-handler.ts
export class ProductPriceChangedHandler implements EventSubscriber {
  constructor(
    private orderRepository: OrderRepository,
    private notificationService: NotificationService
  ) {}

  subscribedTo(): string[] {
    return ['ProductPriceChanged'];
  }

  async handle(event: DomainEvent): Promise<void> {
    if (!(event instanceof ProductPriceChangedEvent)) return;

    // 影響を受ける未確定注文を検索
    const pendingOrders = await this.orderRepository.findPendingOrdersWithProduct(
      ProductId.create(event.aggregateId)
    );

    for (const order of pendingOrders) {
      // 価格更新の通知
      await this.notificationService.notifyPriceChange(
        order.customerId,
        event.aggregateId,
        event.eventData.oldPrice,
        event.eventData.newPrice
      );
    }
  }
}