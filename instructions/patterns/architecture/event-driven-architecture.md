# Event-Driven Architecture - 実装パターン集

> イベント駆動アーキテクチャの設計と実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **技術スタック**: Event Sourcing, CQRS, Message Brokers, Event Streaming

## 🎯 中核概念と設計原則

### 1. イベントストーミングとドメインモデリング

```typescript
// domain/events/base-event.ts
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventVersion: number;
  public readonly aggregateId: string;
  public readonly aggregateVersion: number;

  constructor(
    aggregateId: string,
    aggregateVersion: number,
    eventVersion: number = 1
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateVersion = aggregateVersion;
    this.eventVersion = eventVersion;
  }

  abstract getEventType(): string;
  abstract getEventData(): Record<string, any>;
}

// domain/events/user-events.ts
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly registrationSource: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventType(): string {
    return 'UserRegistered';
  }

  getEventData(): Record<string, any> {
    return {
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      registrationSource: this.registrationSource
    };
  }
}

export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly updatedFields: Record<string, any>,
    public readonly previousValues: Record<string, any>
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventType(): string {
    return 'UserProfileUpdated';
  }

  getEventData(): Record<string, any> {
    return {
      updatedFields: this.updatedFields,
      previousValues: this.previousValues
    };
  }
}

export class UserDeactivatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly reason: string,
    public readonly deactivatedBy: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventType(): string {
    return 'UserDeactivated';
  }

  getEventData(): Record<string, any> {
    return {
      reason: this.reason,
      deactivatedBy: this.deactivatedBy
    };
  }
}

// domain/aggregates/user-aggregate.ts
export class UserAggregate {
  private events: DomainEvent[] = [];
  private version: number = 0;

  constructor(
    public readonly id: string,
    private email: string,
    private firstName: string,
    private lastName: string,
    private isActive: boolean = true
  ) {}

  static register(
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    registrationSource: string
  ): UserAggregate {
    const user = new UserAggregate(id, email, firstName, lastName);
    
    user.addEvent(new UserRegisteredEvent(
      id,
      user.version + 1,
      email,
      firstName,
      lastName,
      registrationSource
    ));

    user.version++;
    return user;
  }

  updateProfile(
    email?: string,
    firstName?: string,
    lastName?: string
  ): void {
    const previousValues: Record<string, any> = {};
    const updatedFields: Record<string, any> = {};

    if (email && email !== this.email) {
      previousValues.email = this.email;
      updatedFields.email = email;
      this.email = email;
    }

    if (firstName && firstName !== this.firstName) {
      previousValues.firstName = this.firstName;
      updatedFields.firstName = firstName;
      this.firstName = firstName;
    }

    if (lastName && lastName !== this.lastName) {
      previousValues.lastName = this.lastName;
      updatedFields.lastName = lastName;
      this.lastName = lastName;
    }

    if (Object.keys(updatedFields).length > 0) {
      this.addEvent(new UserProfileUpdatedEvent(
        this.id,
        this.version + 1,
        updatedFields,
        previousValues
      ));
      this.version++;
    }
  }

  deactivate(reason: string, deactivatedBy: string): void {
    if (!this.isActive) {
      throw new Error('User is already deactivated');
    }

    this.isActive = false;
    
    this.addEvent(new UserDeactivatedEvent(
      this.id,
      this.version + 1,
      reason,
      deactivatedBy
    ));
    
    this.version++;
  }

  // イベント操作
  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  markEventsAsCommitted(): void {
    this.events = [];
  }

  private addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  // 状態復元（Event Sourcing）
  static fromHistory(id: string, events: DomainEvent[]): UserAggregate {
    const user = new UserAggregate(id, '', '', '');
    
    for (const event of events) {
      user.applyEvent(event);
    }
    
    return user;
  }

  private applyEvent(event: DomainEvent): void {
    switch (event.getEventType()) {
      case 'UserRegistered':
        this.applyUserRegisteredEvent(event as UserRegisteredEvent);
        break;
      case 'UserProfileUpdated':
        this.applyUserProfileUpdatedEvent(event as UserProfileUpdatedEvent);
        break;
      case 'UserDeactivated':
        this.applyUserDeactivatedEvent(event as UserDeactivatedEvent);
        break;
      default:
        throw new Error(`Unknown event type: ${event.getEventType()}`);
    }
    
    this.version = event.aggregateVersion;
  }

  private applyUserRegisteredEvent(event: UserRegisteredEvent): void {
    this.email = event.email;
    this.firstName = event.firstName;
    this.lastName = event.lastName;
    this.isActive = true;
  }

  private applyUserProfileUpdatedEvent(event: UserProfileUpdatedEvent): void {
    Object.assign(this, event.updatedFields);
  }

  private applyUserDeactivatedEvent(event: UserDeactivatedEvent): void {
    this.isActive = false;
  }
}
```

### 2. Event Store実装

```typescript
// infrastructure/event-store/event-store.ts
export interface EventStore {
  saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void>;
  
  getEvents(
    aggregateId: string,
    fromVersion?: number
  ): Promise<StoredEvent[]>;
  
  getAllEvents(
    fromPosition?: number,
    batchSize?: number
  ): Promise<StoredEvent[]>;
}

export interface StoredEvent {
  eventId: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  eventData: string;
  occurredOn: Date;
  position: number;
}

export class PostgreSQLEventStore implements EventStore {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  async saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 楽観的ロック - バージョンチェック
      const versionCheck = await client.query(
        'SELECT COALESCE(MAX(aggregate_version), 0) as current_version FROM events WHERE aggregate_id = $1',
        [aggregateId]
      );

      const currentVersion = versionCheck.rows[0].current_version;
      
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, but current version is ${currentVersion}`
        );
      }

      // イベント保存
      for (const event of events) {
        await client.query(`
          INSERT INTO events (
            event_id, aggregate_id, aggregate_version, event_type, 
            event_data, occurred_on
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          event.eventId,
          event.aggregateId,
          event.aggregateVersion,
          event.getEventType(),
          JSON.stringify(event.getEventData()),
          event.occurredOn
        ]);
      }

      await client.query('COMMIT');

      this.logger.info('Events saved successfully', {
        aggregateId,
        eventCount: events.length,
        newVersion: events[events.length - 1].aggregateVersion
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<StoredEvent[]> {
    const query = `
      SELECT 
        event_id, aggregate_id, aggregate_version, event_type,
        event_data, occurred_on, position
      FROM events 
      WHERE aggregate_id = $1 AND aggregate_version > $2
      ORDER BY aggregate_version ASC
    `;

    const result = await this.pool.query(query, [aggregateId, fromVersion]);
    
    return result.rows.map(row => ({
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      eventType: row.event_type,
      eventData: row.event_data,
      occurredOn: row.occurred_on,
      position: row.position
    }));
  }

  async getAllEvents(
    fromPosition: number = 0,
    batchSize: number = 1000
  ): Promise<StoredEvent[]> {
    const query = `
      SELECT 
        event_id, aggregate_id, aggregate_version, event_type,
        event_data, occurred_on, position
      FROM events 
      WHERE position > $1
      ORDER BY position ASC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [fromPosition, batchSize]);
    
    return result.rows.map(row => ({
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      eventType: row.event_type,
      eventData: row.event_data,
      occurredOn: row.occurred_on,
      position: row.position
    }));
  }
}

// infrastructure/event-store/event-store-repository.ts
export class EventSourcedRepository<T> {
  constructor(
    private eventStore: EventStore,
    private aggregateFactory: (id: string, events: DomainEvent[]) => T,
    private logger: Logger
  ) {}

  async load(aggregateId: string): Promise<T | null> {
    try {
      const storedEvents = await this.eventStore.getEvents(aggregateId);
      
      if (storedEvents.length === 0) {
        return null;
      }

      const domainEvents = storedEvents.map(stored => 
        this.deserializeEvent(stored)
      );

      const aggregate = this.aggregateFactory(aggregateId, domainEvents);
      
      this.logger.debug('Aggregate loaded from event store', {
        aggregateId,
        eventCount: domainEvents.length
      });

      return aggregate;

    } catch (error) {
      this.logger.error('Failed to load aggregate from event store', {
        aggregateId,
        error: error.message
      });
      throw error;
    }
  }

  async save(aggregate: any, expectedVersion: number): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    try {
      await this.eventStore.saveEvents(
        aggregate.id,
        uncommittedEvents,
        expectedVersion
      );

      aggregate.markEventsAsCommitted();

      this.logger.info('Aggregate saved to event store', {
        aggregateId: aggregate.id,
        eventCount: uncommittedEvents.length
      });

    } catch (error) {
      this.logger.error('Failed to save aggregate to event store', {
        aggregateId: aggregate.id,
        error: error.message
      });
      throw error;
    }
  }

  private deserializeEvent(stored: StoredEvent): DomainEvent {
    const eventData = JSON.parse(stored.eventData);
    
    // イベントタイプに基づいてファクトリーでデシリアライズ
    return EventFactory.createEvent(
      stored.eventType,
      stored.aggregateId,
      stored.aggregateVersion,
      eventData,
      stored.eventId,
      stored.occurredOn
    );
  }
}

// infrastructure/event-store/event-factory.ts
export class EventFactory {
  private static eventConstructors = new Map<string, any>();

  static registerEventType(eventType: string, constructor: any): void {
    this.eventConstructors.set(eventType, constructor);
  }

  static createEvent(
    eventType: string,
    aggregateId: string,
    aggregateVersion: number,
    eventData: Record<string, any>,
    eventId?: string,
    occurredOn?: Date
  ): DomainEvent {
    const EventConstructor = this.eventConstructors.get(eventType);
    
    if (!EventConstructor) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    const event = new EventConstructor(aggregateId, aggregateVersion, ...Object.values(eventData));
    
    if (eventId) {
      (event as any).eventId = eventId;
    }
    
    if (occurredOn) {
      (event as any).occurredOn = occurredOn;
    }

    return event;
  }
}

// イベントタイプ登録
EventFactory.registerEventType('UserRegistered', UserRegisteredEvent);
EventFactory.registerEventType('UserProfileUpdated', UserProfileUpdatedEvent);
EventFactory.registerEventType('UserDeactivated', UserDeactivatedEvent);
```

### 3. Event Bus とメッセージング

```typescript
// infrastructure/messaging/event-bus.ts
export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): Promise<void>;
  subscribeToAll(handler: EventHandler): Promise<void>;
}

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
  getHandlerName(): string;
  canHandle(eventType: string): boolean;
}

export class RabbitMQEventBus implements EventBus {
  private connection: Connection;
  private publishChannel: Channel;
  private deadLetterExchange = 'events.dlx';
  private eventExchange = 'events';

  constructor(
    private rabbitUrl: string,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitUrl);
    this.publishChannel = await this.connection.createChannel();

    // Exchange設定
    await this.publishChannel.assertExchange(this.eventExchange, 'topic', {
      durable: true
    });

    await this.publishChannel.assertExchange(this.deadLetterExchange, 'topic', {
      durable: true
    });
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const routingKey = this.getRoutingKey(event);
      const message = this.serializeEvent(event);

      try {
        const published = this.publishChannel.publish(
          this.eventExchange,
          routingKey,
          Buffer.from(message),
          {
            persistent: true,
            messageId: event.eventId,
            timestamp: event.occurredOn.getTime(),
            headers: {
              'event-type': event.getEventType(),
              'aggregate-id': event.aggregateId,
              'aggregate-version': event.aggregateVersion,
              'event-version': event.eventVersion
            }
          }
        );

        if (!published) {
          throw new Error('Failed to publish event to exchange');
        }

        this.logger.info('Event published', {
          eventId: event.eventId,
          eventType: event.getEventType(),
          aggregateId: event.aggregateId,
          routingKey
        });

      } catch (error) {
        this.logger.error('Failed to publish event', {
          eventId: event.eventId,
          eventType: event.getEventType(),
          error: error.message
        });
        throw error;
      }
    }
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    const channel = await this.connection.createChannel();
    const queueName = `${eventType}.${handler.getHandlerName()}`;
    const routingKey = this.getRoutingKeyPattern(eventType);

    // キュー設定（Dead Letter Queue付き）
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.deadLetterExchange,
        'x-dead-letter-routing-key': `${queueName}.failed`,
        'x-message-ttl': 24 * 60 * 60 * 1000, // 24時間
        'x-max-retries': 3
      }
    });

    await channel.bindQueue(queueName, this.eventExchange, routingKey);

    // Consumer設定
    await channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const event = this.deserializeEvent(msg.content.toString());
        
        if (!handler.canHandle(event.getEventType())) {
          channel.ack(msg);
          return;
        }

        await handler.handle(event);
        channel.ack(msg);

        this.logger.info('Event processed successfully', {
          eventId: event.eventId,
          eventType: event.getEventType(),
          handler: handler.getHandlerName()
        });

      } catch (error) {
        this.logger.error('Event processing failed', {
          messageId: msg.properties.messageId,
          handler: handler.getHandlerName(),
          error: error.message,
          retryCount: this.getRetryCount(msg)
        });

        const retryCount = this.getRetryCount(msg);
        const maxRetries = 3;

        if (retryCount < maxRetries) {
          // リトライ
          setTimeout(() => {
            channel.nack(msg, false, true);
          }, Math.pow(2, retryCount) * 1000); // 指数バックオフ
        } else {
          // Dead Letter Queueに送信
          channel.nack(msg, false, false);
        }
      }
    }, {
      noAck: false,
      prefetch: 1
    });

    this.logger.info('Subscribed to event', {
      eventType,
      handler: handler.getHandlerName(),
      queueName,
      routingKey
    });
  }

  async subscribeToAll(handler: EventHandler): Promise<void> {
    await this.subscribe('*', handler);
  }

  private getRoutingKey(event: DomainEvent): string {
    return `${event.getEventType()}.${event.aggregateId}`;
  }

  private getRoutingKeyPattern(eventType: string): string {
    return eventType === '*' ? '#' : `${eventType}.*`;
  }

  private serializeEvent(event: DomainEvent): string {
    return JSON.stringify({
      eventId: event.eventId,
      eventType: event.getEventType(),
      aggregateId: event.aggregateId,
      aggregateVersion: event.aggregateVersion,
      eventVersion: event.eventVersion,
      occurredOn: event.occurredOn,
      eventData: event.getEventData()
    });
  }

  private deserializeEvent(message: string): DomainEvent {
    const data = JSON.parse(message);
    
    return EventFactory.createEvent(
      data.eventType,
      data.aggregateId,
      data.aggregateVersion,
      data.eventData,
      data.eventId,
      new Date(data.occurredOn)
    );
  }

  private getRetryCount(msg: any): number {
    return msg.properties.headers?.['x-retry-count'] || 0;
  }
}

// infrastructure/messaging/kafka-event-streaming.ts
export class KafkaEventStreaming {
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;

  constructor(
    private kafka: Kafka,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    this.admin = this.kafka.admin();
    this.producer = this.kafka.producer({
      transactionTimeout: 30000,
      idempotent: true,
      maxInFlightRequests: 1
    });

    this.consumer = this.kafka.consumer({
      groupId: 'event-processors',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    await this.admin.createTopics({
      topics: [
        {
          topic: 'domain-events',
          numPartitions: 6,
          replicationFactor: 3,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7日間
            { name: 'cleanup.policy', value: 'delete' },
            { name: 'compression.type', value: 'snappy' }
          ]
        },
        {
          topic: 'projection-events',
          numPartitions: 3,
          replicationFactor: 3
        }
      ]
    });

    await this.producer.connect();
    await this.consumer.connect();
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    const messages = events.map(event => ({
      partition: this.getPartition(event.aggregateId),
      key: event.aggregateId,
      value: JSON.stringify({
        eventId: event.eventId,
        eventType: event.getEventType(),
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        occurredOn: event.occurredOn,
        eventData: event.getEventData()
      }),
      headers: {
        'event-type': event.getEventType(),
        'aggregate-type': 'User', // 動的に設定可能
        'event-version': event.eventVersion.toString()
      },
      timestamp: event.occurredOn.getTime().toString()
    }));

    try {
      const result = await this.producer.sendBatch({
        topicMessages: [{
          topic: 'domain-events',
          messages
        }]
      });

      this.logger.info('Events published to Kafka', {
        eventCount: events.length,
        partitions: result[0].partition,
        offsets: result.map(r => r.baseOffset)
      });

    } catch (error) {
      this.logger.error('Failed to publish events to Kafka', {
        eventCount: events.length,
        error: error.message
      });
      throw error;
    }
  }

  async subscribeToEvents(
    handlers: Map<string, EventHandler>,
    fromBeginning: boolean = false
  ): Promise<void> {
    await this.consumer.subscribe({
      topic: 'domain-events',
      fromBeginning
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value!.toString());
          const event = EventFactory.createEvent(
            eventData.eventType,
            eventData.aggregateId,
            eventData.aggregateVersion,
            eventData.eventData,
            eventData.eventId,
            new Date(eventData.occurredOn)
          );

          const handler = handlers.get(event.getEventType());
          if (handler) {
            await handler.handle(event);
            
            this.logger.info('Event processed from Kafka', {
              eventId: event.eventId,
              eventType: event.getEventType(),
              partition,
              offset: message.offset,
              handler: handler.getHandlerName()
            });
          }

        } catch (error) {
          this.logger.error('Failed to process Kafka message', {
            topic,
            partition,
            offset: message.offset,
            error: error.message
          });
          
          // エラーハンドリング（Dead Letter Topicなど）
          throw error;
        }
      },
      eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
        for (const message of batch.messages) {
          // バッチ処理ロジック
          resolveOffset(message.offset);
          await heartbeat();
        }
      }
    });
  }

  private getPartition(aggregateId: string): number {
    // 一貫したパーティショニング（同じアグリゲートIDは同じパーティション）
    return Math.abs(this.hashCode(aggregateId)) % 6;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash;
  }
}
```

### 4. CQRS（Command Query Responsibility Segregation）

```typescript
// application/commands/command-bus.ts
export interface Command {
  getCommandType(): string;
  getAggregateId(): string;
  validate(): void;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
  getCommandType(): string;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();

  registerHandler<T extends Command>(handler: CommandHandler<T>): void {
    this.handlers.set(handler.getCommandType(), handler);
  }

  async execute<T extends Command>(command: T): Promise<void> {
    command.validate();

    const handler = this.handlers.get(command.getCommandType());
    if (!handler) {
      throw new Error(`No handler registered for command: ${command.getCommandType()}`);
    }

    await handler.handle(command);
  }
}

// application/commands/user-commands.ts
export class RegisterUserCommand implements Command {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly registrationSource: string
  ) {}

  getCommandType(): string {
    return 'RegisterUser';
  }

  getAggregateId(): string {
    return this.userId;
  }

  validate(): void {
    if (!this.userId) throw new Error('User ID is required');
    if (!this.email) throw new Error('Email is required');
    if (!this.firstName) throw new Error('First name is required');
    if (!this.lastName) throw new Error('Last name is required');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error('Invalid email format');
    }
  }
}

export class UpdateUserProfileCommand implements Command {
  constructor(
    public readonly userId: string,
    public readonly email?: string,
    public readonly firstName?: string,
    public readonly lastName?: string
  ) {}

  getCommandType(): string {
    return 'UpdateUserProfile';
  }

  getAggregateId(): string {
    return this.userId;
  }

  validate(): void {
    if (!this.userId) throw new Error('User ID is required');
    
    if (this.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        throw new Error('Invalid email format');
      }
    }
  }
}

// application/handlers/user-command-handlers.ts
export class RegisterUserCommandHandler implements CommandHandler<RegisterUserCommand> {
  constructor(
    private userRepository: EventSourcedRepository<UserAggregate>,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  getCommandType(): string {
    return 'RegisterUser';
  }

  async handle(command: RegisterUserCommand): Promise<void> {
    this.logger.info('Processing RegisterUserCommand', {
      userId: command.userId,
      email: command.email
    });

    try {
      // 既存ユーザーチェック
      const existingUser = await this.userRepository.load(command.userId);
      if (existingUser) {
        throw new Error(`User already exists: ${command.userId}`);
      }

      // 新規ユーザー作成
      const user = UserAggregate.register(
        command.userId,
        command.email,
        command.firstName,
        command.lastName,
        command.registrationSource
      );

      // 保存
      await this.userRepository.save(user, 0);

      // イベント発行
      await this.eventBus.publish(user.getUncommittedEvents());

      this.logger.info('User registered successfully', {
        userId: command.userId,
        email: command.email
      });

    } catch (error) {
      this.logger.error('Failed to register user', {
        userId: command.userId,
        error: error.message
      });
      throw error;
    }
  }
}

export class UpdateUserProfileCommandHandler implements CommandHandler<UpdateUserProfileCommand> {
  constructor(
    private userRepository: EventSourcedRepository<UserAggregate>,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  getCommandType(): string {
    return 'UpdateUserProfile';
  }

  async handle(command: UpdateUserProfileCommand): Promise<void> {
    this.logger.info('Processing UpdateUserProfileCommand', {
      userId: command.userId
    });

    try {
      // ユーザー取得
      const user = await this.userRepository.load(command.userId);
      if (!user) {
        throw new Error(`User not found: ${command.userId}`);
      }

      const expectedVersion = user.version;

      // プロフィール更新
      user.updateProfile(
        command.email,
        command.firstName,
        command.lastName
      );

      // 保存
      await this.userRepository.save(user, expectedVersion);

      // イベント発行
      await this.eventBus.publish(user.getUncommittedEvents());

      this.logger.info('User profile updated successfully', {
        userId: command.userId
      });

    } catch (error) {
      this.logger.error('Failed to update user profile', {
        userId: command.userId,
        error: error.message
      });
      throw error;
    }
  }
}

// application/queries/query-bus.ts
export interface Query {
  getQueryType(): string;
}

export interface QueryHandler<T extends Query, R> {
  handle(query: T): Promise<R>;
  getQueryType(): string;
}

export class QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();

  registerHandler<T extends Query, R>(handler: QueryHandler<T, R>): void {
    this.handlers.set(handler.getQueryType(), handler);
  }

  async execute<T extends Query, R>(query: T): Promise<R> {
    const handler = this.handlers.get(query.getQueryType());
    if (!handler) {
      throw new Error(`No handler registered for query: ${query.getQueryType()}`);
    }

    return await handler.handle(query);
  }
}

// application/queries/user-queries.ts
export class GetUserByIdQuery implements Query {
  constructor(public readonly userId: string) {}

  getQueryType(): string {
    return 'GetUserById';
  }
}

export class GetUsersByEmailQuery implements Query {
  constructor(public readonly email: string) {}

  getQueryType(): string {
    return 'GetUsersByEmail';
  }
}

export class SearchUsersQuery implements Query {
  constructor(
    public readonly searchTerm: string,
    public readonly limit: number = 20,
    public readonly offset: number = 0
  ) {}

  getQueryType(): string {
    return 'SearchUsers';
  }
}

// infrastructure/read-models/user-read-model.ts
export interface UserReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isActive: boolean;
  registrationDate: Date;
  lastUpdated: Date;
  profileCompleteness: number;
}

export class UserQueryHandler implements 
  QueryHandler<GetUserByIdQuery, UserReadModel | null>,
  QueryHandler<GetUsersByEmailQuery, UserReadModel[]>,
  QueryHandler<SearchUsersQuery, { users: UserReadModel[]; total: number }> {

  constructor(
    private readModelDb: Pool,
    private logger: Logger
  ) {}

  getQueryType(): string {
    return 'UserQuery';
  }

  async handle(query: Query): Promise<any> {
    switch (query.getQueryType()) {
      case 'GetUserById':
        return this.handleGetUserById(query as GetUserByIdQuery);
      case 'GetUsersByEmail':
        return this.handleGetUsersByEmail(query as GetUsersByEmailQuery);
      case 'SearchUsers':
        return this.handleSearchUsers(query as SearchUsersQuery);
      default:
        throw new Error(`Unsupported query type: ${query.getQueryType()}`);
    }
  }

  private async handleGetUserById(query: GetUserByIdQuery): Promise<UserReadModel | null> {
    const result = await this.readModelDb.query(
      'SELECT * FROM user_read_model WHERE id = $1',
      [query.userId]
    );

    return result.rows.length > 0 ? this.mapToReadModel(result.rows[0]) : null;
  }

  private async handleGetUsersByEmail(query: GetUsersByEmailQuery): Promise<UserReadModel[]> {
    const result = await this.readModelDb.query(
      'SELECT * FROM user_read_model WHERE email ILIKE $1',
      [`%${query.email}%`]
    );

    return result.rows.map(row => this.mapToReadModel(row));
  }

  private async handleSearchUsers(query: SearchUsersQuery): Promise<{ users: UserReadModel[]; total: number }> {
    const searchCondition = `
      WHERE (
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        email ILIKE $1 OR
        full_name ILIKE $1
      ) AND is_active = true
    `;

    // 総数取得
    const countResult = await this.readModelDb.query(
      `SELECT COUNT(*) FROM user_read_model ${searchCondition}`,
      [`%${query.searchTerm}%`]
    );

    // データ取得
    const dataResult = await this.readModelDb.query(
      `SELECT * FROM user_read_model ${searchCondition} 
       ORDER BY last_updated DESC 
       LIMIT $2 OFFSET $3`,
      [`%${query.searchTerm}%`, query.limit, query.offset]
    );

    return {
      users: dataResult.rows.map(row => this.mapToReadModel(row)),
      total: parseInt(countResult.rows[0].count)
    };
  }

  private mapToReadModel(row: any): UserReadModel {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      isActive: row.is_active,
      registrationDate: row.registration_date,
      lastUpdated: row.last_updated,
      profileCompleteness: row.profile_completeness
    };
  }
}
```

### 5. Projection とRead Model更新

```typescript
// infrastructure/projections/user-projection.ts
export class UserProjectionHandler implements EventHandler {
  constructor(
    private readModelDb: Pool,
    private logger: Logger
  ) {}

  getHandlerName(): string {
    return 'UserProjectionHandler';
  }

  canHandle(eventType: string): boolean {
    return [
      'UserRegistered',
      'UserProfileUpdated',
      'UserDeactivated'
    ].includes(eventType);
  }

  async handle(event: DomainEvent): Promise<void> {
    switch (event.getEventType()) {
      case 'UserRegistered':
        await this.handleUserRegistered(event as UserRegisteredEvent);
        break;
      case 'UserProfileUpdated':
        await this.handleUserProfileUpdated(event as UserProfileUpdatedEvent);
        break;
      case 'UserDeactivated':
        await this.handleUserDeactivated(event as UserDeactivatedEvent);
        break;
    }
  }

  private async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO user_read_model (
          id, email, first_name, last_name, full_name, 
          is_active, registration_date, last_updated, profile_completeness
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        event.aggregateId,
        event.email,
        event.firstName,
        event.lastName,
        `${event.firstName} ${event.lastName}`,
        true,
        event.occurredOn,
        event.occurredOn,
        this.calculateProfileCompleteness({
          email: event.email,
          firstName: event.firstName,
          lastName: event.lastName
        })
      ]);

      await client.query('COMMIT');

      this.logger.info('User projection updated for UserRegistered', {
        userId: event.aggregateId,
        email: event.email
      });

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update user projection for UserRegistered', {
        userId: event.aggregateId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  private async handleUserProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      // 現在のデータを取得
      const currentUser = await client.query(
        'SELECT * FROM user_read_model WHERE id = $1',
        [event.aggregateId]
      );

      if (currentUser.rows.length === 0) {
        throw new Error(`User not found in read model: ${event.aggregateId}`);
      }

      const user = currentUser.rows[0];
      const updatedFields = event.updatedFields;

      // 更新対象フィールドを準備
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updatedFields.email) {
        updates.push(`email = $${paramIndex++}`);
        values.push(updatedFields.email);
      }

      if (updatedFields.firstName) {
        updates.push(`first_name = $${paramIndex++}`);
        values.push(updatedFields.firstName);
      }

      if (updatedFields.lastName) {
        updates.push(`last_name = $${paramIndex++}`);
        values.push(updatedFields.lastName);
      }

      if (updatedFields.firstName || updatedFields.lastName) {
        const firstName = updatedFields.firstName || user.first_name;
        const lastName = updatedFields.lastName || user.last_name;
        updates.push(`full_name = $${paramIndex++}`);
        values.push(`${firstName} ${lastName}`);
      }

      updates.push(`last_updated = $${paramIndex++}`);
      values.push(event.occurredOn);

      // プロフィール完成度を再計算
      const profileData = {
        email: updatedFields.email || user.email,
        firstName: updatedFields.firstName || user.first_name,
        lastName: updatedFields.lastName || user.last_name
      };

      updates.push(`profile_completeness = $${paramIndex++}`);
      values.push(this.calculateProfileCompleteness(profileData));

      values.push(event.aggregateId);

      await client.query(`
        UPDATE user_read_model 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
      `, values);

      await client.query('COMMIT');

      this.logger.info('User projection updated for UserProfileUpdated', {
        userId: event.aggregateId,
        updatedFields: Object.keys(updatedFields)
      });

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update user projection for UserProfileUpdated', {
        userId: event.aggregateId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  private async handleUserDeactivated(event: UserDeactivatedEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE user_read_model 
        SET is_active = false, last_updated = $1 
        WHERE id = $2
      `, [event.occurredOn, event.aggregateId]);

      await client.query('COMMIT');

      this.logger.info('User projection updated for UserDeactivated', {
        userId: event.aggregateId,
        reason: event.reason
      });

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to update user projection for UserDeactivated', {
        userId: event.aggregateId,
        error: error.message
      });
      throw error;
    } finally {
      client.release();
    }
  }

  private calculateProfileCompleteness(profile: any): number {
    const requiredFields = ['email', 'firstName', 'lastName'];
    const optionalFields = ['phoneNumber', 'address', 'birthDate', 'profilePicture'];
    
    let score = 0;
    
    // 必須フィールド (60%)
    const filledRequired = requiredFields.filter(field => 
      profile[field] && profile[field].trim() !== ''
    ).length;
    score += (filledRequired / requiredFields.length) * 60;
    
    // オプションフィールド (40%)
    const filledOptional = optionalFields.filter(field => 
      profile[field] && profile[field].trim() !== ''
    ).length;
    score += (filledOptional / optionalFields.length) * 40;
    
    return Math.round(score);
  }
}

// infrastructure/projections/analytics-projection.ts
export class AnalyticsProjectionHandler implements EventHandler {
  constructor(
    private analyticsDb: Pool,
    private logger: Logger
  ) {}

  getHandlerName(): string {
    return 'AnalyticsProjectionHandler';
  }

  canHandle(eventType: string): boolean {
    return true; // すべてのイベントを処理
  }

  async handle(event: DomainEvent): Promise<void> {
    await this.recordEventAnalytics(event);
    await this.updateAggregateMetrics(event);
  }

  private async recordEventAnalytics(event: DomainEvent): Promise<void> {
    try {
      await this.analyticsDb.query(`
        INSERT INTO event_analytics (
          event_id, event_type, aggregate_id, aggregate_type,
          occurred_on, date_bucket, hour_bucket
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        event.eventId,
        event.getEventType(),
        event.aggregateId,
        'User', // 動的に取得可能
        event.occurredOn,
        new Date(event.occurredOn.toDateString()), // 日単位
        new Date(event.occurredOn.getFullYear(), event.occurredOn.getMonth(), 
                 event.occurredOn.getDate(), event.occurredOn.getHours()) // 時間単位
      ]);

    } catch (error) {
      this.logger.error('Failed to record event analytics', {
        eventId: event.eventId,
        error: error.message
      });
    }
  }

  private async updateAggregateMetrics(event: DomainEvent): Promise<void> {
    const eventType = event.getEventType();
    const today = new Date(event.occurredOn.toDateString());

    try {
      await this.analyticsDb.query(`
        INSERT INTO daily_metrics (date, metric_name, metric_value)
        VALUES ($1, $2, 1)
        ON CONFLICT (date, metric_name) 
        DO UPDATE SET metric_value = daily_metrics.metric_value + 1
      `, [today, `${eventType}_count`]);

      // 特定イベントに対する追加メトリクス
      if (eventType === 'UserRegistered') {
        await this.analyticsDb.query(`
          INSERT INTO daily_metrics (date, metric_name, metric_value)
          VALUES ($1, 'total_users', 1)
          ON CONFLICT (date, metric_name) 
          DO UPDATE SET metric_value = daily_metrics.metric_value + 1
        `, [today]);
      }

    } catch (error) {
      this.logger.error('Failed to update aggregate metrics', {
        eventType,
        error: error.message
      });
    }
  }
}
```

### 6. Saga とプロセスマネージャー

```typescript
// application/sagas/user-onboarding-saga.ts
export class UserOnboardingSaga {
  private steps: SagaStep[] = [];
  private completedSteps: Set<string> = new Set();
  private state: 'STARTED' | 'COMPLETED' | 'FAILED' = 'STARTED';

  constructor(
    private sagaId: string,
    private userId: string,
    private emailService: EmailService,
    private notificationService: NotificationService,
    private analyticsService: AnalyticsService,
    private logger: Logger
  ) {
    this.initializeSteps();
  }

  private initializeSteps(): void {
    this.steps = [
      new SendWelcomeEmailStep(this.emailService, this.userId),
      new CreateUserPreferencesStep(this.userId),
      new SendPushNotificationStep(this.notificationService, this.userId),
      new TrackRegistrationAnalyticsStep(this.analyticsService, this.userId),
      new CompleteOnboardingStep(this.userId)
    ];
  }

  async handle(event: DomainEvent): Promise<void> {
    if (this.state !== 'STARTED') {
      return; // 既に完了または失敗している
    }

    try {
      switch (event.getEventType()) {
        case 'UserRegistered':
          await this.handleUserRegistered(event as UserRegisteredEvent);
          break;
        case 'WelcomeEmailSent':
          await this.handleWelcomeEmailSent();
          break;
        case 'UserPreferencesCreated':
          await this.handleUserPreferencesCreated();
          break;
        case 'PushNotificationSent':
          await this.handlePushNotificationSent();
          break;
        case 'RegistrationAnalyticsTracked':
          await this.handleRegistrationAnalyticsTracked();
          break;
      }

      await this.checkCompletion();

    } catch (error) {
      this.logger.error('Saga step failed', {
        sagaId: this.sagaId,
        userId: this.userId,
        eventType: event.getEventType(),
        error: error.message
      });

      this.state = 'FAILED';
      await this.compensate();
    }
  }

  private async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    this.logger.info('Starting user onboarding saga', {
      sagaId: this.sagaId,
      userId: this.userId
    });

    // ウェルカムメール送信を開始
    const emailStep = this.steps.find(s => s instanceof SendWelcomeEmailStep);
    if (emailStep) {
      await emailStep.execute();
    }
  }

  private async handleWelcomeEmailSent(): Promise<void> {
    this.completedSteps.add('welcome_email');
    
    // ユーザー設定作成とプッシュ通知を並行実行
    const preferencesStep = this.steps.find(s => s instanceof CreateUserPreferencesStep);
    const notificationStep = this.steps.find(s => s instanceof SendPushNotificationStep);

    await Promise.all([
      preferencesStep?.execute(),
      notificationStep?.execute()
    ]);
  }

  private async handleUserPreferencesCreated(): Promise<void> {
    this.completedSteps.add('user_preferences');
  }

  private async handlePushNotificationSent(): Promise<void> {
    this.completedSteps.add('push_notification');
    
    // アナリティクス追跡を実行
    const analyticsStep = this.steps.find(s => s instanceof TrackRegistrationAnalyticsStep);
    if (analyticsStep) {
      await analyticsStep.execute();
    }
  }

  private async handleRegistrationAnalyticsTracked(): Promise<void> {
    this.completedSteps.add('analytics_tracked');
  }

  private async checkCompletion(): Promise<void> {
    const requiredSteps = ['welcome_email', 'user_preferences', 'push_notification', 'analytics_tracked'];
    const allCompleted = requiredSteps.every(step => this.completedSteps.has(step));

    if (allCompleted) {
      const completionStep = this.steps.find(s => s instanceof CompleteOnboardingStep);
      if (completionStep) {
        await completionStep.execute();
      }
      
      this.state = 'COMPLETED';
      
      this.logger.info('User onboarding saga completed', {
        sagaId: this.sagaId,
        userId: this.userId,
        completedSteps: Array.from(this.completedSteps)
      });
    }
  }

  private async compensate(): Promise<void> {
    this.logger.info('Starting saga compensation', {
      sagaId: this.sagaId,
      userId: this.userId,
      completedSteps: Array.from(this.completedSteps)
    });

    // 完了したステップを逆順で補償
    for (const step of [...this.steps].reverse()) {
      try {
        await step.compensate();
      } catch (error) {
        this.logger.error('Compensation step failed', {
          sagaId: this.sagaId,
          stepType: step.constructor.name,
          error: error.message
        });
      }
    }
  }
}

interface SagaStep {
  execute(): Promise<void>;
  compensate(): Promise<void>;
}

class SendWelcomeEmailStep implements SagaStep {
  private emailSent = false;

  constructor(
    private emailService: EmailService,
    private userId: string
  ) {}

  async execute(): Promise<void> {
    await this.emailService.sendWelcomeEmail(this.userId);
    this.emailSent = true;
  }

  async compensate(): Promise<void> {
    if (this.emailSent) {
      // ウェルカムメールの補償処理（ログ記録など）
      console.log(`Compensating welcome email for user ${this.userId}`);
    }
  }
}

class CreateUserPreferencesStep implements SagaStep {
  private preferencesCreated = false;

  constructor(private userId: string) {}

  async execute(): Promise<void> {
    // ユーザー設定のデフォルト値を作成
    await this.createDefaultPreferences();
    this.preferencesCreated = true;
  }

  async compensate(): Promise<void> {
    if (this.preferencesCreated) {
      await this.deleteUserPreferences();
    }
  }

  private async createDefaultPreferences(): Promise<void> {
    // デフォルト設定作成のロジック
  }

  private async deleteUserPreferences(): Promise<void> {
    // ユーザー設定削除のロジック
  }
}

// application/process-managers/order-process-manager.ts
export class OrderProcessManager {
  private processId: string;
  private orderId: string;
  private customerId: string;
  private state: OrderProcessState;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(processId: string, orderId: string, customerId: string) {
    this.processId = processId;
    this.orderId = orderId;
    this.customerId = customerId;
    this.state = OrderProcessState.STARTED;
  }

  async handle(event: DomainEvent): Promise<DomainEvent[]> {
    const commandsToExecute: DomainEvent[] = [];

    switch (event.getEventType()) {
      case 'OrderCreated':
        commandsToExecute.push(...await this.handleOrderCreated(event));
        break;
      case 'PaymentProcessed':
        commandsToExecute.push(...await this.handlePaymentProcessed(event));
        break;
      case 'PaymentFailed':
        commandsToExecute.push(...await this.handlePaymentFailed(event));
        break;
      case 'InventoryReserved':
        commandsToExecute.push(...await this.handleInventoryReserved(event));
        break;
      case 'InventoryReservationFailed':
        commandsToExecute.push(...await this.handleInventoryReservationFailed(event));
        break;
      case 'OrderShipped':
        commandsToExecute.push(...await this.handleOrderShipped(event));
        break;
    }

    return commandsToExecute;
  }

  private async handleOrderCreated(event: DomainEvent): Promise<DomainEvent[]> {
    this.state = OrderProcessState.PAYMENT_PENDING;
    
    // 支払いタイムアウトを設定（15分）
    this.setTimeout('payment', 15 * 60 * 1000, async () => {
      await this.handlePaymentTimeout();
    });

    return [
      new ProcessPaymentCommand(this.orderId, this.customerId)
    ];
  }

  private async handlePaymentProcessed(event: DomainEvent): Promise<DomainEvent[]> {
    this.clearTimeout('payment');
    this.state = OrderProcessState.INVENTORY_PENDING;
    
    // 在庫予約タイムアウトを設定（5分）
    this.setTimeout('inventory', 5 * 60 * 1000, async () => {
      await this.handleInventoryTimeout();
    });

    return [
      new ReserveInventoryCommand(this.orderId)
    ];
  }

  private async handleInventoryReserved(event: DomainEvent): Promise<DomainEvent[]> {
    this.clearTimeout('inventory');
    this.state = OrderProcessState.FULFILLMENT_PENDING;

    return [
      new FulfillOrderCommand(this.orderId)
    ];
  }

  private async handlePaymentFailed(event: DomainEvent): Promise<DomainEvent[]> {
    this.clearTimeout('payment');
    this.state = OrderProcessState.FAILED;

    return [
      new CancelOrderCommand(this.orderId, 'Payment failed')
    ];
  }

  private async handleInventoryReservationFailed(event: DomainEvent): Promise<DomainEvent[]> {
    this.clearTimeout('inventory');
    this.state = OrderProcessState.FAILED;

    return [
      new RefundPaymentCommand(this.orderId),
      new CancelOrderCommand(this.orderId, 'Inventory not available')
    ];
  }

  private async handleOrderShipped(event: DomainEvent): Promise<DomainEvent[]> {
    this.state = OrderProcessState.COMPLETED;
    this.clearAllTimeouts();

    return [
      new SendOrderConfirmationCommand(this.orderId, this.customerId)
    ];
  }

  private setTimeout(name: string, delay: number, callback: () => Promise<void>): void {
    const timeout = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`Timeout callback failed for ${name}:`, error);
      }
    }, delay);

    this.timeouts.set(name, timeout);
  }

  private clearTimeout(name: string): void {
    const timeout = this.timeouts.get(name);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(name);
    }
  }

  private clearAllTimeouts(): void {
    for (const [name] of this.timeouts) {
      this.clearTimeout(name);
    }
  }

  private async handlePaymentTimeout(): Promise<void> {
    this.state = OrderProcessState.FAILED;
    // 支払いタイムアウト処理
  }

  private async handleInventoryTimeout(): Promise<void> {
    this.state = OrderProcessState.FAILED;
    // 在庫予約タイムアウト処理
  }
}

enum OrderProcessState {
  STARTED = 'STARTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  INVENTORY_PENDING = 'INVENTORY_PENDING',
  FULFILLMENT_PENDING = 'FULFILLMENT_PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
```

### 7. モニタリングと運用

```typescript
// infrastructure/monitoring/event-monitoring.ts
export class EventMonitoringService {
  private metrics: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor(
    private metricsCollector: MetricsCollector,
    private alertService: AlertService,
    private logger: Logger
  ) {}

  recordEventPublished(eventType: string, processingTime: number): void {
    this.metricsCollector.increment(`events.published.${eventType}.count`);
    this.metricsCollector.histogram(`events.published.${eventType}.duration`, processingTime);
  }

  recordEventProcessed(eventType: string, handlerName: string, processingTime: number): void {
    this.metricsCollector.increment(`events.processed.${eventType}.${handlerName}.count`);
    this.metricsCollector.histogram(`events.processed.${eventType}.${handlerName}.duration`, processingTime);
  }

  recordEventProcessingFailed(eventType: string, handlerName: string, error: Error): void {
    const errorKey = `${eventType}.${handlerName}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    this.metricsCollector.increment(`events.failed.${eventType}.${handlerName}.count`);

    // エラー率が閾値を超えた場合にアラート
    if (currentCount > 10) { // 10回以上のエラーでアラート
      this.alertService.sendAlert({
        severity: 'HIGH',
        message: `High error rate for event processing: ${errorKey}`,
        details: {
          eventType,
          handlerName,
          errorCount: currentCount,
          error: error.message
        }
      });
    }
  }

  getHealthStatus(): EventSystemHealth {
    const eventTypes = Array.from(this.metrics.keys());
    const recentErrors = Array.from(this.errorCounts.entries())
      .filter(([_, count]) => count > 0);

    return {
      status: recentErrors.length === 0 ? 'HEALTHY' : 'DEGRADED',
      processedEvents: Array.from(this.metrics.entries()),
      recentErrors,
      timestamp: new Date()
    };
  }
}

interface EventSystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  processedEvents: [string, number][];
  recentErrors: [string, number][];
  timestamp: Date;
}

// infrastructure/monitoring/saga-monitoring.ts
export class SagaMonitoringService {
  private activeSagas: Map<string, SagaStatus> = new Map();

  recordSagaStarted(sagaId: string, sagaType: string): void {
    this.activeSagas.set(sagaId, {
      id: sagaId,
      type: sagaType,
      status: 'RUNNING',
      startedAt: new Date(),
      steps: []
    });
  }

  recordSagaStepCompleted(sagaId: string, stepName: string): void {
    const saga = this.activeSagas.get(sagaId);
    if (saga) {
      saga.steps.push({
        name: stepName,
        status: 'COMPLETED',
        completedAt: new Date()
      });
    }
  }

  recordSagaCompleted(sagaId: string): void {
    const saga = this.activeSagas.get(sagaId);
    if (saga) {
      saga.status = 'COMPLETED';
      saga.completedAt = new Date();
    }
  }

  recordSagaFailed(sagaId: string, error: Error): void {
    const saga = this.activeSagas.get(sagaId);
    if (saga) {
      saga.status = 'FAILED';
      saga.error = error.message;
      saga.failedAt = new Date();
    }
  }

  getActiveSagas(): SagaStatus[] {
    return Array.from(this.activeSagas.values())
      .filter(saga => saga.status === 'RUNNING');
  }

  getSagaStatus(sagaId: string): SagaStatus | null {
    return this.activeSagas.get(sagaId) || null;
  }
}

interface SagaStatus {
  id: string;
  type: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  steps: SagaStepStatus[];
}

interface SagaStepStatus {
  name: string;
  status: 'COMPLETED' | 'FAILED';
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}
```

このEvent-Driven Architectureパターン集は以下の要素を包含しています：

1. **イベントストーミング**: ドメインイベントの設計とアグリゲート管理
2. **Event Store**: PostgreSQLベースのイベント永続化
3. **Event Bus**: RabbitMQとKafkaによるメッセージング
4. **CQRS**: コマンドとクエリの分離とハンドラーパターン
5. **Projection**: Read Model更新とアナリティクス
6. **Saga/Process Manager**: 複雑なビジネスプロセス管理
7. **モニタリング**: システム健全性とパフォーマンス監視

これらのパターンにより、スケーラブルで復元力の高いイベント駆動システムを構築できます。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Phase 3: Python Advanced Libraries - FastAPI production patterns document", "status": "completed", "id": "18"}, {"content": "Phase 3: SQLAlchemy 2.0 advanced ORM patterns document", "status": "completed", "id": "19"}, {"content": "Phase 3: Pydantic v2 data validation patterns document", "status": "completed", "id": "20"}, {"content": "Phase 3: Async Python concurrency patterns document", "status": "completed", "id": "21"}, {"content": "Phase 3: Pytest advanced testing patterns document", "status": "completed", "id": "22"}, {"content": "Phase 3: Celery distributed task patterns document", "status": "completed", "id": "23"}, {"content": "Phase 3: NumPy/Pandas data science patterns document", "status": "completed", "id": "24"}, {"content": "Phase 3: Django REST framework enterprise patterns document", "status": "completed", "id": "25"}, {"content": "Phase 4 - Architecture Pattern 1: Microservices Architecture", "status": "completed", "id": "26"}, {"content": "Phase 4 - Architecture Pattern 2: Event-Driven Architecture", "status": "completed", "id": "27"}, {"content": "Phase 4 - Architecture Pattern 3: CQRS (Command Query Responsibility Segregation)", "status": "in_progress", "id": "28"}, {"content": "Phase 4 - Architecture Pattern 4: Domain-Driven Design (DDD)", "status": "pending", "id": "29"}, {"content": "Phase 4 - Architecture Pattern 5: Clean Architecture", "status": "pending", "id": "30"}, {"content": "Phase 4 - Architecture Pattern 6: Hexagonal Architecture", "status": "pending", "id": "31"}, {"content": "Phase 4 - Architecture Pattern 7: Event Sourcing", "status": "pending", "id": "32"}, {"content": "Phase 4 - Architecture Pattern 8: API Gateway Patterns", "status": "pending", "id": "33"}, {"content": "Phase 5: Development Methodologies (3 documents)", "status": "pending", "id": "34"}]