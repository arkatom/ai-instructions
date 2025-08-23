# Consistency Patterns

## Eventual Consistency

```typescript
class EventualConsistencyManager {
  constructor(
    private eventBus: EventBus,
    private projectionTracker: ProjectionTracker
  ) {}

  async waitForConsistency(
    aggregateId: string,
    eventId: string,
    timeout: number = 5000
  ): Promise<boolean> {
    const deadline = Date.now() + timeout;
    
    while (Date.now() < deadline) {
      if (await this.isProjected(aggregateId, eventId)) {
        return true;
      }
      await this.delay(100);
    }
    
    return false;
  }

  private async isProjected(aggregateId: string, eventId: string): Promise<boolean> {
    const status = await this.projectionTracker.getStatus(aggregateId);
    return status.lastProcessedEventId >= eventId;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Consistency boundary enforcement
class ConsistencyBoundary {
  constructor(
    private strongConsistencyAggregates: Set<string>,
    private eventualConsistencyTimeout: number = 5000
  ) {}

  async enforceConsistency(
    aggregateId: string,
    operation: () => Promise<void>
  ): Promise<void> {
    if (this.requiresStrongConsistency(aggregateId)) {
      await this.enforceStrongConsistency(operation);
    } else {
      await this.enforceEventualConsistency(operation);
    }
  }

  private requiresStrongConsistency(aggregateId: string): boolean {
    return this.strongConsistencyAggregates.has(aggregateId);
  }

  private async enforceStrongConsistency(operation: () => Promise<void>): Promise<void> {
    // Use distributed lock for strong consistency
    const lock = await this.acquireLock();
    try {
      await operation();
      await this.waitForAllProjections();
    } finally {
      await lock.release();
    }
  }

  private async enforceEventualConsistency(operation: () => Promise<void>): Promise<void> {
    await operation();
    // Don't wait for projections
  }
}
```

## Saga Pattern for Consistency

```typescript
abstract class Saga {
  protected steps: SagaStep[] = [];
  protected compensations: CompensationStep[] = [];

  async execute(context: SagaContext): Promise<void> {
    const executedSteps: SagaStep[] = [];

    try {
      for (const step of this.steps) {
        await step.execute(context);
        executedSteps.push(step);
      }
    } catch (error) {
      // Compensate in reverse order
      await this.compensate(executedSteps.reverse(), context);
      throw error;
    }
  }

  private async compensate(steps: SagaStep[], context: SagaContext): Promise<void> {
    for (const step of steps) {
      try {
        await step.compensate(context);
      } catch (error) {
        console.error('Compensation failed:', error);
        // Log to compensation failure queue
      }
    }
  }
}

// Cross-aggregate consistency saga
class OrderFulfillmentSaga extends Saga {
  constructor(
    private orderService: OrderService,
    private inventoryService: InventoryService,
    private paymentService: PaymentService
  ) {
    super();
    this.initializeSteps();
  }

  private initializeSteps(): void {
    this.steps = [
      {
        name: 'ReserveInventory',
        execute: async (ctx) => {
          ctx.reservationId = await this.inventoryService.reserve(ctx.items);
        },
        compensate: async (ctx) => {
          await this.inventoryService.cancelReservation(ctx.reservationId);
        }
      },
      {
        name: 'ProcessPayment',
        execute: async (ctx) => {
          ctx.paymentId = await this.paymentService.charge(ctx.amount);
        },
        compensate: async (ctx) => {
          await this.paymentService.refund(ctx.paymentId);
        }
      },
      {
        name: 'ConfirmOrder',
        execute: async (ctx) => {
          await this.orderService.confirm(ctx.orderId);
        },
        compensate: async (ctx) => {
          await this.orderService.cancel(ctx.orderId);
        }
      }
    ];
  }
}
```

## Read After Write Consistency

```typescript
class ReadAfterWriteConsistency {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
    private consistencyTracker: ConsistencyTracker
  ) {}

  async executeWithReadAfterWrite<T>(
    command: Command,
    query: Query
  ): Promise<T> {
    // Execute command
    await this.commandBus.send(command);
    
    // Get version/timestamp from command execution
    const writeVersion = await this.getWriteVersion(command);
    
    // Wait for read model to catch up
    await this.waitForReadModelSync(writeVersion);
    
    // Execute query
    return this.queryBus.ask<Query, T>(query);
  }

  private async getWriteVersion(command: Command): Promise<number> {
    return this.consistencyTracker.getLatestVersion(command.aggregateId);
  }

  private async waitForReadModelSync(targetVersion: number): Promise<void> {
    const maxRetries = 50;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      const currentVersion = await this.consistencyTracker.getReadModelVersion();
      
      if (currentVersion >= targetVersion) {
        return;
      }
      
      await this.delay(retryDelay);
    }

    throw new Error('Read model sync timeout');
  }
}
```

## Conflict Resolution

```typescript
class ConflictResolver {
  async resolve(conflicts: Conflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  private async resolveConflict(conflict: Conflict): Promise<Resolution> {
    switch (conflict.type) {
      case 'CONCURRENT_UPDATE':
        return this.resolveConcurrentUpdate(conflict);
      case 'DUPLICATE_EVENT':
        return this.resolveDuplicateEvent(conflict);
      case 'OUT_OF_ORDER':
        return this.resolveOutOfOrder(conflict);
      default:
        return this.defaultResolution(conflict);
    }
  }

  private resolveConcurrentUpdate(conflict: Conflict): Resolution {
    // Last-write-wins strategy
    const events = conflict.events.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    return {
      type: 'ACCEPT_LATEST',
      acceptedEvent: events[0],
      rejectedEvents: events.slice(1)
    };
  }

  private resolveDuplicateEvent(conflict: Conflict): Resolution {
    // Idempotency check
    return {
      type: 'IGNORE_DUPLICATE',
      acceptedEvent: conflict.events[0],
      rejectedEvents: conflict.events.slice(1)
    };
  }
}
```

## Consistency Monitoring

```typescript
class ConsistencyMonitor {
  private metrics: MetricsCollector;
  
  async checkConsistency(): Promise<ConsistencyReport> {
    const checks = await Promise.all([
      this.checkProjectionLag(),
      this.checkEventOrder(),
      this.checkDataIntegrity()
    ]);

    return {
      timestamp: new Date(),
      projectionLag: checks[0],
      eventOrdering: checks[1],
      dataIntegrity: checks[2],
      overallHealth: this.calculateHealth(checks)
    };
  }

  private async checkProjectionLag(): Promise<LagReport> {
    const writeHead = await this.getWriteHead();
    const readHead = await this.getReadHead();
    const lag = writeHead - readHead;

    this.metrics.gauge('consistency.projection.lag', lag);

    return {
      writePosition: writeHead,
      readPosition: readHead,
      lagInEvents: lag,
      isAcceptable: lag < 100
    };
  }
}
```

## Best Practices

1. **Define Boundaries**: Clearly define consistency boundaries
2. **Choose Strategy**: Select appropriate consistency model per use case
3. **Monitor Lag**: Track and alert on consistency lag
4. **Implement Compensation**: Design compensation logic for failures
5. **Test Scenarios**: Test various consistency failure scenarios
6. **Document Trade-offs**: Document consistency trade-offs clearly