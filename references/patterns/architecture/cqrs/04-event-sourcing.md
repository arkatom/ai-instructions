# CQRS with Event Sourcing

## Integration Architecture

```typescript
// CQRS+ES Command Flow
interface CQRSEventSourcedSystem {
  // Command side uses event sourcing
  commandBus: CommandBus;
  eventStore: EventStore;
  aggregateRepository: AggregateRepository;
  
  // Query side uses projections
  queryBus: QueryBus;
  projectionManager: ProjectionManager;
  readModelStore: ReadModelStore;
}

class EventSourcedCommandHandler<T extends Command> implements CommandHandler<T> {
  constructor(
    private repository: EventSourcedRepository,
    private eventBus: EventBus
  ) {}

  async handle(command: T): Promise<void> {
    // Load aggregate from event store
    const aggregate = await this.repository.load(command.aggregateId);
    
    // Execute command on aggregate
    const events = aggregate.execute(command);
    
    // Save events to event store
    await this.repository.save(aggregate);
    
    // Publish events for projections
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }
}
```

## Event-Driven Projections

```typescript
class ProjectionEngine {
  private projections: Map<string, Projection> = new Map();
  private checkpoints: Map<string, number> = new Map();

  async start(): Promise<void> {
    // Subscribe to event store
    const subscription = await this.eventStore.subscribeFromBeginning(
      async (event: DomainEvent) => {
        await this.projectEvent(event);
      }
    );
  }

  private async projectEvent(event: DomainEvent): Promise<void> {
    const relevantProjections = this.getRelevantProjections(event.type);
    
    for (const projection of relevantProjections) {
      try {
        await projection.handle(event);
        await this.updateCheckpoint(projection.name, event.position);
      } catch (error) {
        await this.handleProjectionError(projection, event, error);
      }
    }
  }

  private async handleProjectionError(
    projection: Projection,
    event: DomainEvent,
    error: Error
  ): Promise<void> {
    console.error(`Projection ${projection.name} failed:`, error);
    
    // Retry logic
    const retryCount = await this.getRetryCount(projection.name, event.id);
    
    if (retryCount < 3) {
      await this.scheduleRetry(projection, event, retryCount + 1);
    } else {
      await this.markAsFailed(projection.name, event);
    }
  }
}

// Projection implementation
class OrderSummaryProjection implements Projection {
  name = 'OrderSummary';
  
  constructor(private readDb: Database) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'OrderCreated':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;
      case 'OrderLineAdded':
        await this.handleOrderLineAdded(event as OrderLineAddedEvent);
        break;
      case 'OrderShipped':
        await this.handleOrderShipped(event as OrderShippedEvent);
        break;
    }
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.readDb.query(
      `INSERT INTO order_summaries (
        order_id, customer_id, status, created_at, total_amount
      ) VALUES ($1, $2, $3, $4, $5)`,
      [event.orderId, event.customerId, 'PENDING', event.timestamp, 0]
    );
  }

  private async handleOrderLineAdded(event: OrderLineAddedEvent): Promise<void> {
    await this.readDb.query(
      `UPDATE order_summaries 
       SET total_amount = total_amount + $1,
           updated_at = $2
       WHERE order_id = $3`,
      [event.lineTotal, event.timestamp, event.orderId]
    );
  }
}
```

## Aggregate Repository Pattern

```typescript
class EventSourcedRepository {
  constructor(
    private eventStore: EventStore,
    private snapshotStore: SnapshotStore
  ) {}

  async load(aggregateId: string): Promise<Aggregate> {
    // Try to load from snapshot
    const snapshot = await this.snapshotStore.getLatest(aggregateId);
    
    let aggregate: Aggregate;
    let fromVersion = 0;
    
    if (snapshot) {
      aggregate = this.hydrateFromSnapshot(snapshot);
      fromVersion = snapshot.version + 1;
    } else {
      aggregate = this.createNewAggregate(aggregateId);
    }
    
    // Load events after snapshot
    const events = await this.eventStore.getEvents(aggregateId, fromVersion);
    aggregate.loadFromHistory(events);
    
    return aggregate;
  }

  async save(aggregate: Aggregate): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }
    
    // Save events with optimistic concurrency
    await this.eventStore.appendToStream(
      aggregate.getId(),
      uncommittedEvents,
      aggregate.getOriginalVersion()
    );
    
    aggregate.markEventsAsCommitted();
    
    // Create snapshot if needed
    if (this.shouldSnapshot(aggregate)) {
      await this.snapshotStore.save({
        aggregateId: aggregate.getId(),
        version: aggregate.getVersion(),
        data: aggregate.getSnapshot(),
        timestamp: new Date()
      });
    }
  }

  private shouldSnapshot(aggregate: Aggregate): boolean {
    return aggregate.getVersion() % 10 === 0;
  }
}
```

## Command and Query Separation

```typescript
// Write side - Commands modify state
class OrderCommandService {
  constructor(
    private repository: EventSourcedRepository,
    private eventPublisher: EventPublisher
  ) {}

  async createOrder(command: CreateOrderCommand): Promise<void> {
    const order = Order.create(command);
    await this.repository.save(order);
    await this.eventPublisher.publishEvents(order.getUncommittedEvents());
  }

  async shipOrder(command: ShipOrderCommand): Promise<void> {
    const order = await this.repository.load(command.orderId);
    order.ship(command.shippingDetails);
    await this.repository.save(order);
    await this.eventPublisher.publishEvents(order.getUncommittedEvents());
  }
}

// Read side - Queries read from projections
class OrderQueryService {
  constructor(private readDb: Database) {}

  async getOrderSummary(orderId: string): Promise<OrderSummary> {
    const result = await this.readDb.query(
      'SELECT * FROM order_summaries WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0];
  }

  async getCustomerOrders(customerId: string): Promise<OrderSummary[]> {
    const result = await this.readDb.query(
      `SELECT * FROM order_summaries 
       WHERE customer_id = $1 
       ORDER BY created_at DESC`,
      [customerId]
    );
    return result.rows;
  }
}
```

## Eventual Consistency Management

```typescript
class ConsistencyManager {
  async waitForConsistency(
    aggregateId: string,
    expectedVersion: number,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentVersion = await this.getProjectedVersion(aggregateId);
      
      if (currentVersion >= expectedVersion) {
        return;
      }
      
      await this.delay(100);
    }
    
    throw new Error('Consistency timeout');
  }

  private async getProjectedVersion(aggregateId: string): Promise<number> {
    const result = await this.readDb.query(
      'SELECT version FROM projection_versions WHERE aggregate_id = $1',
      [aggregateId]
    );
    return result.rows[0]?.version || 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

1. **Event Design**: Design events to be immutable and self-contained
2. **Projection Idempotency**: Ensure projections can be replayed safely
3. **Consistency Boundaries**: Define clear consistency requirements
4. **Error Handling**: Implement robust error handling for projections
5. **Performance**: Use snapshots to optimize aggregate loading
6. **Testing**: Test command and query sides independently