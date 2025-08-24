# Testing Strategies

## Unit Testing Command Handlers

```typescript
describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let repository: MockRepository;
  let eventBus: MockEventBus;

  beforeEach(() => {
    repository = new MockRepository();
    eventBus = new MockEventBus();
    handler = new CreateOrderHandler(repository, eventBus);
  });

  it('should create order and publish event', async () => {
    const command = new CreateOrderCommand({
      orderId: 'order-123',
      customerId: 'customer-456',
      items: [{ productId: 'prod-1', quantity: 2, price: 10 }]
    });

    await handler.handle(command);

    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].id).toBe('order-123');
    
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0].type).toBe('OrderCreated');
  });

  it('should validate command before processing', async () => {
    const invalidCommand = new CreateOrderCommand({
      orderId: 'order-123',
      customerId: '',  // Invalid
      items: []        // Invalid
    });

    await expect(handler.handle(invalidCommand))
      .rejects.toThrow(ValidationException);
  });
});
```

## Testing Query Handlers

```typescript
describe('OrderQueryHandler', () => {
  let handler: OrderQueryHandler;
  let readDb: MockDatabase;

  beforeEach(() => {
    readDb = new MockDatabase();
    handler = new OrderQueryHandler(readDb);
  });

  it('should return paginated results', async () => {
    readDb.setQueryResult([
      { id: '1', total: 100 },
      { id: '2', total: 200 }
    ]);

    const query = new GetOrdersQuery({
      page: 1,
      pageSize: 10,
      filter: { status: 'PENDING' }
    });

    const result = await handler.handle(query);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.page).toBe(1);
    expect(readDb.executedQueries[0]).toContain('LIMIT 10 OFFSET 0');
  });
});
```

## Integration Testing

```typescript
class CQRSIntegrationTest {
  private testContainer: TestContainer;

  async setup() {
    this.testContainer = await TestContainer.start({
      services: ['postgres', 'redis', 'eventstore'],
      seedData: './test/fixtures/seed.sql'
    });
  }

  async testCommandToQueryFlow() {
    // Execute command
    const command = new CreateOrderCommand({
      orderId: 'test-order',
      customerId: 'test-customer',
      items: [{ productId: 'p1', quantity: 1, price: 50 }]
    });

    await this.testContainer.commandBus.send(command);

    // Wait for projection
    await this.waitForProjection('test-order');

    // Query read model
    const query = new GetOrderByIdQuery('test-order');
    const result = await this.testContainer.queryBus.ask(query);

    expect(result).toMatchObject({
      id: 'test-order',
      customerId: 'test-customer',
      total: 50,
      status: 'PENDING'
    });
  }

  private async waitForProjection(aggregateId: string): Promise<void> {
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isProjected(aggregateId)) return;
      await this.delay(100);
    }
    throw new Error('Projection timeout');
  }
}
```

## Event Sourcing Testing

```typescript
describe('Event Sourced Aggregate', () => {
  it('should rebuild state from events', () => {
    const events = [
      new OrderCreatedEvent('order-1', 'customer-1'),
      new OrderItemAddedEvent('order-1', 'product-1', 2, 25),
      new OrderItemAddedEvent('order-1', 'product-2', 1, 30),
      new OrderConfirmedEvent('order-1')
    ];

    const order = Order.fromEvents('order-1', events);

    expect(order.getTotal()).toBe(80);
    expect(order.getStatus()).toBe('CONFIRMED');
    expect(order.getItemCount()).toBe(2);
  });

  it('should track uncommitted events', () => {
    const order = Order.create('order-1', 'customer-1');
    order.addItem('product-1', 2, 25);
    
    const uncommitted = order.getUncommittedEvents();
    
    expect(uncommitted).toHaveLength(2);
    expect(uncommitted[0].type).toBe('OrderCreated');
    expect(uncommitted[1].type).toBe('OrderItemAdded');
  });
});
```

## Projection Testing

```typescript
class ProjectionTestHelper {
  async testProjection(
    projection: Projection,
    scenario: TestScenario
  ): Promise<void> {
    // Setup initial state
    await this.setupReadModel(scenario.initialState);

    // Apply events
    for (const event of scenario.events) {
      await projection.handle(event);
    }

    // Verify final state
    const actualState = await this.getReadModelState();
    expect(actualState).toEqual(scenario.expectedState);
  }

  async testIdempotency(projection: Projection, event: DomainEvent): Promise<void> {
    // Apply event first time
    await projection.handle(event);
    const state1 = await this.getReadModelState();

    // Apply same event again
    await projection.handle(event);
    const state2 = await this.getReadModelState();

    // State should be unchanged
    expect(state2).toEqual(state1);
  }
}
```

## Performance Testing

```typescript
class CQRSPerformanceTest {
  async testQueryPerformance() {
    const queries = this.generateQueries(1000);
    const startTime = Date.now();

    await Promise.all(queries.map(q => this.queryBus.ask(q)));

    const duration = Date.now() - startTime;
    const qps = 1000 / (duration / 1000);

    expect(qps).toBeGreaterThan(100); // Minimum 100 queries per second
  }

  async testCommandThroughput() {
    const commands = this.generateCommands(100);
    const results = [];

    for (const command of commands) {
      const start = Date.now();
      await this.commandBus.send(command);
      results.push(Date.now() - start);
    }

    const p95 = this.calculatePercentile(results, 95);
    expect(p95).toBeLessThan(100); // 95% of commands complete within 100ms
  }
}
```

## Best Practices

1. **Test Isolation**: Test command and query sides independently
2. **Event Testing**: Verify correct events are generated
3. **Projection Testing**: Test idempotency and ordering
4. **Integration Tests**: Test full command-to-query flow
5. **Performance Tests**: Establish performance baselines
6. **Consistency Tests**: Verify eventual consistency behavior