# CQRS Fundamentals

## Core Principles

CQRS (Command Query Responsibility Segregation) separates read and write operations into distinct models, optimizing each for its specific purpose.

### Key Benefits
- **Optimized Models**: Tailor data models for specific operations
- **Scalability**: Scale read and write sides independently
- **Performance**: Optimize queries without affecting writes
- **Flexibility**: Use different storage technologies per side
- **Simplicity**: Simpler models focused on single responsibilities

## Basic Implementation

```typescript
// Command Side - Write Model
interface Command {
  readonly type: string;
  readonly payload: any;
  readonly metadata: CommandMetadata;
}

interface CommandMetadata {
  readonly commandId: string;
  readonly correlationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

// Query Side - Read Model
interface Query {
  readonly type: string;
  readonly parameters: any;
  readonly metadata: QueryMetadata;
}

interface QueryMetadata {
  readonly queryId: string;
  readonly userId: string;
  readonly timestamp: Date;
}
```

## Command Side Implementation

```typescript
// Domain Model - Optimized for business logic
class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = 'PENDING';

  constructor(
    public readonly id: string,
    public readonly customerId: string
  ) {}

  addItem(productId: string, quantity: number, price: number): void {
    if (this.status !== 'PENDING') {
      throw new Error('Cannot modify confirmed order');
    }
    this.items.push(new OrderItem(productId, quantity, price));
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    this.status = 'CONFIRMED';
  }

  getTotal(): number {
    return this.items.reduce((sum, item) => sum + item.getSubtotal(), 0);
  }
}

// Command Handler
class CreateOrderHandler implements CommandHandler<CreateOrderCommand> {
  constructor(
    private repository: OrderRepository,
    private eventBus: EventBus
  ) {}

  async handle(command: CreateOrderCommand): Promise<void> {
    const order = new Order(command.orderId, command.customerId);
    
    for (const item of command.items) {
      order.addItem(item.productId, item.quantity, item.price);
    }
    
    await this.repository.save(order);
    
    await this.eventBus.publish(new OrderCreatedEvent(
      order.id,
      order.customerId,
      order.getTotal()
    ));
  }
}
```

## Query Side Implementation

```typescript
// Read Model - Optimized for queries
interface OrderReadModel {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItemView[];
  total: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Query Handler
class GetOrdersByCustomerHandler implements QueryHandler<GetOrdersByCustomerQuery> {
  constructor(private readDb: ReadDatabase) {}

  async handle(query: GetOrdersByCustomerQuery): Promise<OrderReadModel[]> {
    const sql = `
      SELECT o.*, c.name as customer_name,
             json_agg(oi.*) as items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = $1
        AND o.created_at >= $2
      GROUP BY o.id, c.name
      ORDER BY o.created_at DESC
    `;
    
    const result = await this.readDb.query(sql, [
      query.customerId,
      query.fromDate
    ]);
    
    return result.rows.map(this.mapToReadModel);
  }

  private mapToReadModel(row: any): OrderReadModel {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      items: row.items || [],
      total: row.total,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

## Synchronization Patterns

```typescript
class ProjectionManager {
  constructor(
    private eventStore: EventStore,
    private projections: Map<string, Projection>
  ) {}

  async project(event: DomainEvent): Promise<void> {
    const projections = this.getProjectionsForEvent(event.type);
    
    await Promise.all(
      projections.map(projection => 
        this.tryProject(projection, event)
      )
    );
  }

  private async tryProject(projection: Projection, event: DomainEvent): Promise<void> {
    try {
      await projection.handle(event);
    } catch (error) {
      console.error(`Projection ${projection.name} failed:`, error);
      // Implement retry logic or dead letter queue
    }
  }
}

// Event-driven synchronization
class OrderProjection implements Projection {
  name = 'OrderReadModel';

  constructor(private readDb: ReadDatabase) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'OrderCreated':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;
      case 'OrderItemAdded':
        await this.handleItemAdded(event as OrderItemAddedEvent);
        break;
      case 'OrderConfirmed':
        await this.handleOrderConfirmed(event as OrderConfirmedEvent);
        break;
    }
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.readDb.query(
      `INSERT INTO orders (id, customer_id, total, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.orderId, event.customerId, event.total, 'PENDING', event.timestamp]
    );
  }
}
```

## Architecture Patterns

### Simple CQRS
```yaml
architecture:
  write_side:
    - API receives commands
    - Command handlers execute business logic
    - Domain model enforces invariants
    - Changes persisted to write store
  
  read_side:
    - API receives queries
    - Query handlers fetch from read store
    - Read models optimized for queries
    - Eventually consistent with write side
```

### CQRS with Event Sourcing
```yaml
architecture:
  write_side:
    - Commands validated by aggregates
    - State changes recorded as events
    - Events persisted to event store
    - Current state rebuilt from events
  
  read_side:
    - Events projected to read models
    - Multiple projections possible
    - Rebuild projections from events
    - Optimized storage per projection
```

## Best Practices

1. **Command Design**: Commands should represent intentions, not data updates
2. **Query Optimization**: Design read models specifically for query requirements
3. **Consistency**: Define clear consistency boundaries and expectations
4. **Testing**: Test command and query sides independently
5. **Monitoring**: Track synchronization lag and projection health
6. **Error Handling**: Implement robust retry and compensation strategies