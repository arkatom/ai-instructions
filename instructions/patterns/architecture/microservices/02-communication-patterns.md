# Microservices - 通信パターン

> 同期・非同期通信、イベント駆動アーキテクチャ、サービス間通信の実装パターン

## 概要

マイクロサービス間の通信は、システム全体の信頼性とパフォーマンスに大きく影響します。適切な通信パターンの選択により、疎結合でスケーラブルなシステムを構築できます。

## 同期通信パターン

### 1. HTTP/REST API

```typescript
// services/order-service/src/clients/user-service.client.ts
export class UserServiceClient {
  constructor(
    private httpClient: HttpClient,
    private serviceDiscovery: ServiceDiscovery,
    private circuitBreaker: CircuitBreaker,
    private retryPolicy: RetryPolicy
  ) {}

  async getUserById(userId: string): Promise<UserDetails | null> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        const serviceUrl = await this.serviceDiscovery.getServiceUrl('user-service');
        
        const response = await this.httpClient.get(`${serviceUrl}/users/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': this.generateCorrelationId(),
            'X-Service-Name': 'order-service'
          },
          timeout: 5000
        });

        if (response.status === 404) {
          return null;
        }

        return response.data;
      });
    });
  }

  async validateUser(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user !== null && user.isActive;
    } catch (error) {
      // フォールバック戦略：ユーザーが取得できない場合は有効とみなす
      this.logger.warn('User validation failed, assuming valid', { userId, error });
      return true;
    }
  }

  private generateCorrelationId(): string {
    return `order-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. gRPC通信

```typescript
// shared/proto/user.proto
syntax = "proto3";

package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc ValidateUser(ValidateUserRequest) returns (ValidateUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
}

message GetUserRequest {
  string user_id = 1;
}

message GetUserResponse {
  string user_id = 1;
  string email = 2;
  string first_name = 3;
  string last_name = 4;
  bool is_active = 5;
  int64 created_at = 6;
}

// services/user-service/src/grpc/user.service.ts
import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';

export class UserGrpcService {
  constructor(private userService: UserService) {}

  async getUser(
    call: ServerUnaryCall<GetUserRequest, GetUserResponse>,
    callback: sendUnaryData<GetUserResponse>
  ): Promise<void> {
    try {
      const { user_id } = call.request;
      
      const user = await this.userService.findById(user_id);
      
      if (!user) {
        const error = new Error('User not found');
        error.code = grpc.status.NOT_FOUND;
        return callback(error);
      }

      const response: GetUserResponse = {
        user_id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        is_active: user.isActive,
        created_at: user.createdAt.getTime()
      };

      callback(null, response);
    } catch (error) {
      callback(error);
    }
  }
}
```

### 3. GraphQL Federation

```typescript
// services/user-service/src/graphql/user.resolver.ts
import { Resolver, Query, Directive } from '@nestjs/graphql';

@Resolver('User')
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query()
  @Directive('@key(fields: "id")')
  async user(@Args('id') id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @ResolveField()
  async orders(@Parent() user: User): Promise<Order[]> {
    // 他のサービスからの情報は参照のみ
    return [];
  }
}

// services/order-service/src/graphql/order.resolver.ts
@Resolver('Order')
export class OrderResolver {
  constructor(private orderService: OrderService) {}

  @Query()
  async orders(@Args('userId') userId: string): Promise<Order[]> {
    return this.orderService.findByUserId(userId);
  }

  @ResolveField()
  async user(@Parent() order: Order): Promise<User> {
    // GraphQL Federationによる参照解決
    return { __typename: 'User', id: order.userId };
  }
}
```

## 非同期通信パターン

### 1. Event-Driven Architecture

```typescript
// shared/infrastructure/event-bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string, 
    handler: EventHandler<T>
  ): Promise<void>;
}

export class RabbitMQEventBus implements EventBus {
  constructor(
    private connection: Connection,
    private logger: Logger
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    const channel = await this.connection.createChannel();
    
    try {
      const exchange = 'domain_events';
      const routingKey = event.constructor.name;
      
      await channel.assertExchange(exchange, 'topic', { durable: true });
      
      const message = JSON.stringify({
        eventId: event.eventId,
        eventType: event.constructor.name,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        data: event
      });

      await channel.publish(
        exchange,
        routingKey,
        Buffer.from(message),
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: event.occurredOn.getTime(),
          headers: {
            'event-type': event.constructor.name,
            'aggregate-id': event.aggregateId
          }
        }
      );

      this.logger.info('Event published', {
        eventId: event.eventId,
        eventType: event.constructor.name,
        aggregateId: event.aggregateId
      });

    } finally {
      await channel.close();
    }
  }

  async subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<void> {
    const channel = await this.connection.createChannel();
    const exchange = 'domain_events';
    const queue = `${eventType}_handler_${crypto.randomUUID()}`;

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { 
      durable: true,
      exclusive: false,
      autoDelete: false 
    });

    await channel.bindQueue(queue, exchange, eventType);

    await channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const eventData = JSON.parse(msg.content.toString());
        const event = this.deserializeEvent<T>(eventData);

        await handler.handle(event);
        
        channel.ack(msg);
        
        this.logger.info('Event processed successfully', {
          eventId: eventData.eventId,
          eventType: eventData.eventType,
          handler: handler.constructor.name
        });

      } catch (error) {
        this.logger.error('Event processing failed', {
          error: error.message,
          eventType,
          handler: handler.constructor.name
        });

        // デッドレターキューに送信
        channel.nack(msg, false, false);
      }
    });
  }

  private deserializeEvent<T extends DomainEvent>(eventData: any): T {
    const eventClass = this.getEventClass(eventData.eventType);
    return Object.assign(new eventClass(), eventData.data);
  }

  private getEventClass(eventType: string): any {
    const eventClasses = {
      'UserCreatedEvent': UserCreatedEvent,
      'OrderCreatedEvent': OrderCreatedEvent,
      'PaymentProcessedEvent': PaymentProcessedEvent,
      'InventoryReservedEvent': InventoryReservedEvent
    };
    
    return eventClasses[eventType];
  }
}
```

### 2. イベントハンドラーの実装

```typescript
// services/notification-service/src/handlers/user-events.ts
export class UserCreatedEventHandler implements EventHandler<UserCreatedEvent> {
  constructor(
    private emailService: EmailService,
    private analyticsService: AnalyticsService,
    private logger: Logger
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    this.logger.info('Processing UserCreatedEvent', {
      eventId: event.eventId,
      userId: event.aggregateId,
      email: event.email
    });

    try {
      // 並列処理で複数のアクション実行
      await Promise.all([
        this.sendWelcomeEmail(event),
        this.trackUserRegistration(event),
        this.createUserProfile(event)
      ]);

    } catch (error) {
      this.logger.error('Failed to process UserCreatedEvent', {
        eventId: event.eventId,
        userId: event.aggregateId,
        error: error.message
      });
      throw error; // リトライするために再スロー
    }
  }

  private async sendWelcomeEmail(event: UserCreatedEvent): Promise<void> {
    await this.emailService.sendWelcomeEmail({
      to: event.email,
      userId: event.aggregateId,
      templateData: {
        firstName: event.firstName,
        welcomeMessage: 'Welcome to our platform!'
      }
    });
  }

  private async trackUserRegistration(event: UserCreatedEvent): Promise<void> {
    await this.analyticsService.track({
      event: 'user_registered',
      userId: event.aggregateId,
      properties: {
        email: event.email,
        registrationDate: event.occurredOn,
        source: 'web'
      }
    });
  }

  private async createUserProfile(event: UserCreatedEvent): Promise<void> {
    // プロファイルサービスにユーザー作成を通知
    await this.profileService.createProfile({
      userId: event.aggregateId,
      email: event.email,
      firstName: event.firstName,
      lastName: event.lastName
    });
  }
}

// services/order-service/src/handlers/inventory-events.ts
export class InventoryReservedEventHandler implements EventHandler<InventoryReservedEvent> {
  constructor(
    private orderService: OrderService,
    private paymentServiceClient: PaymentServiceClient,
    private inventoryServiceClient: InventoryServiceClient,
    private logger: Logger
  ) {}

  async handle(event: InventoryReservedEvent): Promise<void> {
    const { orderId, items, reservationId } = event;

    this.logger.info('Processing InventoryReservedEvent', {
      eventId: event.eventId,
      orderId,
      reservationId,
      items: items.length
    });

    try {
      // 注文ステータス更新
      await this.orderService.updateOrderStatus(orderId, 'INVENTORY_RESERVED');

      // 決済処理を開始
      const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      const paymentRequest = {
        orderId,
        amount: totalAmount,
        currency: 'USD',
        reservationId // 失敗時の在庫解放に必要
      };

      await this.paymentServiceClient.processPayment(paymentRequest);

      this.logger.info('Payment processing initiated', { orderId, paymentRequest });

    } catch (error) {
      this.logger.error('Failed to process InventoryReservedEvent', {
        eventId: event.eventId,
        orderId,
        error: error.message
      });

      // 在庫予約をキャンセル
      await this.inventoryServiceClient.cancelReservation(reservationId);
      await this.orderService.updateOrderStatus(orderId, 'FAILED');
      
      throw error;
    }
  }
}
```

## メッセージングパターン

### 1. Command Query Responsibility Segregation (CQRS)

```typescript
// shared/patterns/cqrs.ts
export interface Command {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: any;
}

export interface Query {
  readonly type: string;
  readonly parameters: any;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export interface QueryHandler<T extends Query, R> {
  handle(query: T): Promise<R>;
}

// services/order-service/src/commands/create-order.command.ts
export class CreateOrderCommand implements Command {
  readonly type = 'CreateOrder';
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      customerId: string;
      items: OrderItem[];
      shippingAddress: Address;
      paymentMethod: PaymentMethod;
    }
  ) {}
}

export class CreateOrderCommandHandler implements CommandHandler<CreateOrderCommand> {
  constructor(
    private orderRepository: OrderRepository,
    private orderSaga: OrderSaga,
    private eventBus: EventBus
  ) {}

  async handle(command: CreateOrderCommand): Promise<void> {
    // コマンドの実行はSagaに委託
    await this.orderSaga.execute(command);
  }
}

// services/order-service/src/queries/get-order.query.ts
export class GetOrderQuery implements Query {
  readonly type = 'GetOrder';
  
  constructor(
    readonly parameters: {
      orderId: string;
      includeItems?: boolean;
    }
  ) {}
}

export class GetOrderQueryHandler implements QueryHandler<GetOrderQuery, Order | null> {
  constructor(private orderReadModel: OrderReadModel) {}

  async handle(query: GetOrderQuery): Promise<Order | null> {
    const { orderId, includeItems = true } = query.parameters;
    
    const order = await this.orderReadModel.findById(orderId);
    
    if (!order) {
      return null;
    }

    if (includeItems) {
      order.items = await this.orderReadModel.getOrderItems(orderId);
    }

    return order;
  }
}
```

### 2. Event Sourcing

```typescript
// shared/patterns/event-sourcing.ts
export abstract class EventSourcedAggregate {
  private _version = 0;
  private _uncommittedEvents: DomainEvent[] = [];

  get version(): number {
    return this._version;
  }

  get uncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  protected addEvent(event: DomainEvent): void {
    this._uncommittedEvents.push(event);
  }

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
    this._version++;
  }

  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
      this._version++;
    }
  }

  protected abstract applyEvent(event: DomainEvent): void;
}

// services/order-service/src/domain/order.aggregate.ts
export class OrderAggregate extends EventSourcedAggregate {
  private _id: string;
  private _customerId: string;
  private _items: OrderItem[] = [];
  private _status: OrderStatus = OrderStatus.PENDING;
  private _totalAmount = 0;

  static create(command: CreateOrderCommand): OrderAggregate {
    const aggregate = new OrderAggregate();
    
    const event = new OrderCreatedEvent(
      command.aggregateId,
      command.payload.customerId,
      command.payload.items,
      command.payload.shippingAddress
    );

    aggregate.addEvent(event);
    aggregate.applyEvent(event);
    
    return aggregate;
  }

  confirmPayment(paymentId: string): void {
    if (this._status !== OrderStatus.PAYMENT_PENDING) {
      throw new Error('Order is not in payment pending status');
    }

    const event = new OrderPaymentConfirmedEvent(
      this._id,
      paymentId,
      this._totalAmount
    );

    this.addEvent(event);
    this.applyEvent(event);
  }

  protected applyEvent(event: DomainEvent): void {
    switch (event.constructor.name) {
      case 'OrderCreatedEvent':
        this.applyOrderCreatedEvent(event as OrderCreatedEvent);
        break;
      case 'OrderPaymentConfirmedEvent':
        this.applyOrderPaymentConfirmedEvent(event as OrderPaymentConfirmedEvent);
        break;
      // 他のイベントハンドラー
    }
  }

  private applyOrderCreatedEvent(event: OrderCreatedEvent): void {
    this._id = event.aggregateId;
    this._customerId = event.customerId;
    this._items = event.items;
    this._status = OrderStatus.PENDING;
    this._totalAmount = this.calculateTotalAmount(event.items);
  }

  private applyOrderPaymentConfirmedEvent(event: OrderPaymentConfirmedEvent): void {
    this._status = OrderStatus.CONFIRMED;
  }

  private calculateTotalAmount(items: OrderItem[]): number {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }
}
```

## 通信パターンの選択指針

### 1. 同期 vs 非同期の選択

```typescript
// 選択指針のマトリックス
interface CommunicationPatternMatrix {
  synchronous: {
    useCases: [
      'リアルタイムな応答が必要',
      'データの整合性が重要',
      'トランザクション境界内での処理',
      'ユーザー操作の即座のフィードバック'
    ];
    patterns: ['HTTP/REST', 'gRPC', 'GraphQL'];
    tradeoffs: {
      pros: ['即座のレスポンス', '理解しやすい', 'デバッグが容易'];
      cons: ['結合度が高い', '可用性の依存', 'チェーン障害のリスク'];
    };
  };
  
  asynchronous: {
    useCases: [
      'バックグラウンド処理',
      '複数サービスへの通知',
      '時間のかかる処理',
      'イベント駆動のワークフロー'
    ];
    patterns: ['Event Bus', 'Message Queue', 'Event Sourcing'];
    tradeoffs: {
      pros: ['疎結合', '高い可用性', 'スケーラビリティ'];
      cons: ['結果的一貫性', 'デバッグの複雑さ', '重複処理のリスク'];
    };
  };
}
```

### 2. プロトコルの選択指針

```typescript
// プロトコル選択の決定木
class ProtocolSelector {
  selectProtocol(requirements: CommunicationRequirements): Protocol {
    if (requirements.realtime && requirements.lowLatency) {
      return 'gRPC';
    }
    
    if (requirements.flexibility && requirements.schema_evolution) {
      return 'GraphQL';
    }
    
    if (requirements.simplicity && requirements.http_standard) {
      return 'HTTP/REST';
    }
    
    if (requirements.async && requirements.reliable_delivery) {
      return 'Message Queue';
    }
    
    if (requirements.event_driven && requirements.audit_trail) {
      return 'Event Sourcing';
    }
    
    return 'HTTP/REST'; // デフォルト
  }
}
```

## エラーハンドリングと復旧パターン

### 1. サーキットブレーカー

```typescript
// shared/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private lastFailureTime?: Date;
  private successCount = 0;

  constructor(
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      timeout: 60000,
      successThreshold: 3
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.options.timeout;
  }
}
```

### 2. リトライパターン

```typescript
// shared/resilience/retry-policy.ts
export class RetryPolicy {
  constructor(
    private options: RetryOptions = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 1;
    let lastError: Error;

    while (attempt <= this.options.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        if (attempt < this.options.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
        
        attempt++;
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    // 特定のエラータイプはリトライしない
    if (error.message.includes('ValidationError')) {
      return false;
    }

    if (error.message.includes('NotFound')) {
      return false;
    }

    return attempt < this.options.maxAttempts;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.options.baseDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.options.maxDelay);
    
    if (this.options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

適切な通信パターンの選択により、マイクロサービス間の効果的な連携と、システム全体の信頼性向上を実現できます。各パターンの特性を理解し、要件に応じた適切な選択を行いましょう。