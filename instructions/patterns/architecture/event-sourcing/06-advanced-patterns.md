# Advanced Event Sourcing Patterns

## Event Replay {#replay}

```typescript
export class EventReplayService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projections: Projection[]
  ) {}

  async replayAllEvents(): Promise<void> {
    let position = 0;
    const batchSize = 1000;
    let processedCount = 0;

    while (true) {
      const events = await this.eventStore.getAllEvents(position, batchSize);
      if (events.length === 0) break;

      for (const event of events) {
        await this.processEvent(event);
        processedCount++;
      }
      position = (events[events.length - 1] as any).id;
    }
  }

  async replayStream(streamId: string): Promise<void> {
    const events = await this.eventStore.getEvents(streamId);
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    for (const projection of this.projections) {
      if (projection.canHandle(event)) await projection.handle(event);
    }
  }
}
```

## Temporal Queries

```typescript
// src/application/services/TemporalQueryService.ts
export class TemporalQueryService {
  constructor(private readonly eventStore: EventStore) {}

  async getAggregateStateAtTime<T extends AggregateRoot>(
    aggregateId: string,
    pointInTime: Date,
    AggregateClass: new (id: string) => T
  ): Promise<T | null> {
    const events = await this.eventStore.getEvents(aggregateId);
    const relevantEvents = events.filter(e => e.occurredAt <= pointInTime);

    if (relevantEvents.length === 0) return null;

    const aggregate = new AggregateClass(aggregateId);
    aggregate.loadFromHistory(relevantEvents);
    return aggregate;
  }

  async auditChanges(
    aggregateId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{timestamp: Date; eventType: string; changes: any}>> {
    const events = await this.eventStore.getEvents(aggregateId);
    
    return events
      .filter(e => e.occurredAt >= fromDate && e.occurredAt <= toDate)
      .map(e => ({
        timestamp: e.occurredAt,
        eventType: e.eventType,
        changes: e.payload
      }));
  }
}
```

## Schema Evolution {#evolution}

```typescript
// src/infrastructure/eventstore/EventUpgrader.ts
export interface EventUpgrader {
  canUpgrade(event: DomainEvent): boolean;
  upgrade(event: DomainEvent): DomainEvent;
}

export class AccountCreatedEventV1ToV2Upgrader implements EventUpgrader {
  canUpgrade(event: DomainEvent): boolean {
    return event.eventType === 'AccountCreated' && event.eventVersion === 1;
  }

  upgrade(event: DomainEvent): DomainEvent {
    const upgradedPayload = {
      ...event.payload,
      kycStatus: 'PENDING', // Add new field
      holderName: event.payload.accountHolder, // Rename field
      accountHolder: undefined // Remove deprecated
    };

    return {
      ...event,
      eventVersion: 2,
      payload: upgradedPayload
    };
  }
}

export class EventUpgradeService {
  private upgraders: EventUpgrader[] = [
    new AccountCreatedEventV1ToV2Upgrader()
  ];

  upgradeEvent(event: DomainEvent): DomainEvent {
    let upgradedEvent = event;
    
    for (const upgrader of this.upgraders) {
      if (upgrader.canUpgrade(upgradedEvent)) {
        upgradedEvent = upgrader.upgrade(upgradedEvent);
      }
    }
    
    return upgradedEvent;
  }
}
```

## Testing Strategies {#testing}

```typescript
// tests/domain/Account.test.ts
describe('Account Aggregate', () => {
  it('should create account with initial balance', () => {
    const account = Account.create(
      'ACC-001', '123456789', 'John Doe',
      1000, 'USD', 'CHECKING'
    );

    expect(account.getBalance()).toBe(1000);
    
    const events = account.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('AccountCreated');
  });

  it('should reconstitute from events', () => {
    const events = [
      new AccountCreatedEvent('ACC-001', '123456789', 'John Doe', 1000, 'USD', 'CHECKING', {}),
      new MoneyDepositedEvent('ACC-001', 500, 'USD', 'ATM', 'REF-001', {})
    ];

    const account = Account.fromEvents('ACC-001', events);
    expect(account.getBalance()).toBe(1500);
    expect(account.getVersion()).toBe(2);
  });
});

// Test event store concurrency
describe('EventStore Concurrency', () => {
  it('should enforce optimistic locking', async () => {
    const streamId = 'test-stream';
    await eventStore.append(streamId, [event1]);
    
    await expect(
      eventStore.append(streamId, [event2], 0) // Wrong version
    ).rejects.toThrow(ConcurrencyError);
  });
});
```

## Performance Optimization {#optimization}

```yaml
optimization_strategies:
  snapshots:
    interval: 100 # Every 100 events
    storage: "Separate snapshot table"
  caching:
    - Event stream cache
    - Projection cache
    - Aggregate state cache
  partitioning:
    by_tenant: "tenant_id"
    by_date: "YYYY-MM"
    by_aggregate: "aggregate_type"
  indexing:
    - stream_id + version
    - aggregate_id
    - event_type
    - occurred_at
```

## Production Deployment

```yaml
deployment_checklist:
  infrastructure:
    - Event store database with replication
    - Message broker for event distribution
    - Projection databases
    - Monitoring and alerting
  operations:
    - Backup and restore procedures
    - Event replay runbooks
    - Projection rebuild processes
    - Performance monitoring
  security:
    - Event encryption at rest
    - Audit trail protection
    - Access control
    - PII handling
```

## Event Store Monitoring

```typescript
interface EventStoreMetrics {
  eventsPerSecond: number;
  averageEventSize: number;
  projectionLag: number;
  snapshotCount: number;
  errorRate: number;
}

class EventStoreMonitor {
  async collectMetrics(): Promise<EventStoreMetrics> {
    return {
      eventsPerSecond: await this.calculateEventRate(),
      averageEventSize: await this.calculateAverageSize(),
      projectionLag: await this.calculateProjectionLag(),
      snapshotCount: await this.countSnapshots(),
      errorRate: await this.calculateErrorRate()
    };
  }
  
  async alertOnThresholds(metrics: EventStoreMetrics): Promise<void> {
    if (metrics.projectionLag > 1000) {
      await this.sendAlert('High projection lag detected');
    }
    
    if (metrics.errorRate > 0.01) {
      await this.sendAlert('Elevated error rate in event store');
    }
  }
}
```