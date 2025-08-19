# Event-Driven Architecture

Event-driven system design patterns.

## Event Design

### Event Structure
```typescript
interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  timestamp: Date;
  version: number;
  payload: any;
  metadata: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}

class OrderCreatedEvent implements DomainEvent {
  type = 'ORDER_CREATED';
  constructor(
    public id: string,
    public aggregateId: string,
    public payload: {
      customerId: string;
      items: OrderItem[];
      total: number;
    }
  ) {
    this.timestamp = new Date();
    this.version = 1;
  }
}
```

## Event Bus

### In-Memory Event Bus
```typescript
class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  subscribe(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }
  
  async publish(event: DomainEvent) {
    const handlers = this.handlers.get(event.type) || new Set();
    
    await Promise.all(
      Array.from(handlers).map(handler => 
        handler.handle(event).catch(error => 
          console.error(`Handler error: ${error}`)
        )
      )
    );
  }
}
```

### Message Broker Integration
```typescript
const { Kafka } = require('kafkajs');

class KafkaEventPublisher {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'app',
      brokers: ['localhost:9092']
    });
    this.producer = this.kafka.producer();
  }
  
  async publish(event: DomainEvent) {
    await this.producer.send({
      topic: event.type,
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          'correlation-id': event.metadata.correlationId
        }
      }]
    });
  }
}

class KafkaEventConsumer {
  async subscribe(topics: string[], handler: EventHandler) {
    const consumer = this.kafka.consumer({ groupId: 'app-group' });
    await consumer.subscribe({ topics });
    
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const event = JSON.parse(message.value.toString());
        await handler.handle(event);
      }
    });
  }
}
```

## Event Sourcing

### Event Store
```typescript
class EventStore {
  private events: DomainEvent[] = [];
  
  async append(event: DomainEvent) {
    await this.db.events.create({
      data: {
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
        timestamp: event.timestamp,
        version: event.version
      }
    });
    
    this.events.push(event);
    await this.eventBus.publish(event);
  }
  
  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    return this.db.events.findMany({
      where: { aggregateId },
      orderBy: { version: 'asc' }
    });
  }
  
  async replay(aggregateId: string): Promise<any> {
    const events = await this.getEvents(aggregateId);
    return events.reduce((state, event) => 
      this.applyEvent(state, event), {}
    );
  }
}
```

### Aggregate Reconstruction
```typescript
class Order {
  private id: string;
  private status: string;
  private items: OrderItem[] = [];
  private uncommittedEvents: DomainEvent[] = [];
  
  static async load(id: string, eventStore: EventStore) {
    const events = await eventStore.getEvents(id);
    const order = new Order();
    
    events.forEach(event => order.apply(event));
    return order;
  }
  
  apply(event: DomainEvent) {
    switch(event.type) {
      case 'ORDER_CREATED':
        this.id = event.aggregateId;
        this.status = 'PENDING';
        this.items = event.payload.items;
        break;
      case 'ORDER_CONFIRMED':
        this.status = 'CONFIRMED';
        break;
      case 'ORDER_CANCELLED':
        this.status = 'CANCELLED';
        break;
    }
  }
}
```

## CQRS

### Command Side
```typescript
class CommandHandler {
  constructor(
    private eventStore: EventStore,
    private repository: Repository
  ) {}
  
  async handle(command: CreateOrderCommand) {
    const order = Order.create(command);
    await this.eventStore.append(order.getUncommittedEvents());
    return order.id;
  }
}
```

### Query Side
```typescript
class ReadModelProjection {
  async handle(event: DomainEvent) {
    switch(event.type) {
      case 'ORDER_CREATED':
        await this.db.orderReadModel.create({
          data: {
            id: event.aggregateId,
            customerId: event.payload.customerId,
            total: event.payload.total,
            status: 'PENDING'
          }
        });
        break;
        
      case 'ORDER_CONFIRMED':
        await this.db.orderReadModel.update({
          where: { id: event.aggregateId },
          data: { status: 'CONFIRMED' }
        });
        break;
    }
  }
}
```

## Checklist
- [ ] Event design clarified
- [ ] Event Bus implemented
- [ ] Message broker selected
- [ ] Event Sourcing considered
- [ ] CQRS implemented
- [ ] Eventual consistency handled
- [ ] Event ordering guaranteed