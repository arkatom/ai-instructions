# Event Bus and Messaging

## In-Memory Event Bus

```typescript
export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export class InMemoryEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private middlewares: EventMiddleware[] = [];

  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.getEventType();
    const handlers = this.handlers.get(eventType) || new Set();
    
    // Apply middlewares
    let processedEvent = event;
    for (const middleware of this.middlewares) {
      processedEvent = await middleware.process(processedEvent);
    }
    
    // Execute handlers in parallel
    const promises = Array.from(handlers).map(handler => 
      this.safeHandle(handler, processedEvent)
    );
    
    await Promise.allSettled(promises);
  }

  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  private async safeHandle(handler: EventHandler<any>, event: DomainEvent): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(`Handler error for ${event.getEventType()}:`, error);
      // Implement retry logic, dead letter queue, etc.
    }
  }
}

export interface EventMiddleware {
  process(event: DomainEvent): Promise<DomainEvent>;
}
```

## Distributed Event Bus (Redis)

```typescript
export class RedisEventBus {
  private subscriber: Redis;
  private publisher: Redis;
  private handlers = new Map<string, Set<EventHandler<any>>>();

  constructor(redisConfig: RedisOptions) {
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);
    this.setupSubscriptions();
  }

  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
      this.subscriber.subscribe(`event:${eventType}`);
    }
    this.handlers.get(eventType)!.add(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.getEventType();
    const serializedEvent = JSON.stringify({
      eventId: event.eventId,
      eventType: eventType,
      eventData: event.getEventData(),
      aggregateId: event.aggregateId,
      aggregateVersion: event.aggregateVersion,
      occurredOn: event.occurredOn
    });
    
    await this.publisher.publish(`event:${eventType}`, serializedEvent);
  }

  private setupSubscriptions(): void {
    this.subscriber.on('message', async (channel: string, message: string) => {
      const eventType = channel.replace('event:', '');
      const handlers = this.handlers.get(eventType);
      
      if (!handlers) return;
      
      try {
        const eventData = JSON.parse(message);
        const event = this.deserializeEvent(eventData);
        
        const promises = Array.from(handlers).map(handler => handler.handle(event));
        await Promise.allSettled(promises);
      } catch (error) {
        console.error(`Event processing error:`, error);
      }
    });
  }

  private deserializeEvent(data: any): DomainEvent {
    // Event reconstruction logic
    const eventFactories: Record<string, (data: any) => DomainEvent> = {
      'UserRegistered': (d) => new UserRegisteredEvent(d.aggregateId, d.aggregateVersion, 
        d.eventData.email, d.eventData.firstName, d.eventData.lastName, d.eventData.registrationSource),
    };
    
    const factory = eventFactories[data.eventType];
    if (!factory) throw new Error(`Unknown event type: ${data.eventType}`);
    
    return factory(data);
  }
}
```

## Message Broker Integration

```typescript
export class KafkaEventBus {
  private producer: Producer;
  private consumer: Consumer;

  constructor(private kafka: Kafka) {
    this.producer = kafka.producer();
    this.consumer = kafka.consumer({ groupId: 'event-handlers' });
  }

  async initialize(): Promise<void> {
    await this.producer.connect();
    await this.consumer.connect();
  }

  async publish(event: DomainEvent): Promise<void> {
    const message = {
      key: event.aggregateId,
      value: JSON.stringify({
        eventId: event.eventId,
        eventType: event.getEventType(),
        eventData: event.getEventData(),
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        occurredOn: event.occurredOn
      }),
      headers: {
        eventType: event.getEventType(),
        aggregateId: event.aggregateId
      }
    };

    await this.producer.send({
      topic: 'domain-events',
      messages: [message]
    });
  }

  async subscribe(eventTypes: string[], handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    await this.consumer.subscribe({ topic: 'domain-events' });
    
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const eventType = message.headers?.eventType?.toString();
        
        if (!eventType || !eventTypes.includes(eventType)) {
          return;
        }
        
        try {
          const eventData = JSON.parse(message.value?.toString() || '{}');
          const event = this.deserializeEvent(eventData);
          await handler(event);
        } catch (error) {
          console.error('Message processing error:', error);
        }
      }
    });
  }

  private deserializeEvent(data: any): DomainEvent {
    // Same deserialization logic as Redis implementation
    const eventFactories: Record<string, (data: any) => DomainEvent> = {
      'UserRegistered': (d) => new UserRegisteredEvent(d.aggregateId, d.aggregateVersion, 
        d.eventData.email, d.eventData.firstName, d.eventData.lastName, d.eventData.registrationSource),
    };
    
    const factory = eventFactories[data.eventType];
    if (!factory) throw new Error(`Unknown event type: ${data.eventType}`);
    
    return factory(data);
  }
}
```

## Event Bus Patterns

```yaml
patterns:
  publish_subscribe:
    use_case: "One event, multiple handlers"
    implementation: "EventBus.subscribe(eventType, handler)"
    
  request_response:
    use_case: "Command with response"
    implementation: "CommandBus with correlation IDs"
    
  fan_out:
    use_case: "Broadcast to all instances"
    implementation: "Topic-based messaging"
    
  competing_consumers:
    use_case: "Load balancing"
    implementation: "Queue-based messaging with consumer groups"

middleware_patterns:
  logging:
    order: 1
    purpose: "Audit trail and debugging"
    
  validation:
    order: 2  
    purpose: "Event schema validation"
    
  enrichment:
    order: 3
    purpose: "Add metadata, correlationIds"
    
  filtering:
    order: 4
    purpose: "Conditional processing"
```