# Event Store Implementation

## Event Store Interface

```typescript
export interface EventStore {
  append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getSnapshot(streamId: string): Promise<AggregateSnapshot | null>;
  saveSnapshot(snapshot: AggregateSnapshot): Promise<void>;
  subscribe(handler: (event: DomainEvent) => void): void;
}

export interface AggregateSnapshot {
  streamId: string;
  version: number;
  data: any;
  timestamp: Date;
}
```

## MongoDB Implementation

```typescript
export class MongoEventStore implements EventStore {
  constructor(private db: Db) {}

  async append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Optimistic concurrency check
        if (expectedVersion !== undefined) {
          const currentVersion = await this.getCurrentVersion(streamId);
          if (currentVersion !== expectedVersion) {
            throw new ConcurrencyError(`Expected ${expectedVersion}, got ${currentVersion}`);
          }
        }

        // Insert events
        const eventDocs = events.map((event, index) => ({
          streamId,
          eventId: event.eventId,
          eventType: event.getEventType(),
          eventData: event.getEventData(),
          eventVersion: event.eventVersion,
          aggregateVersion: event.aggregateVersion + index,
          occurredOn: event.occurredOn,
          metadata: this.extractMetadata(event)
        }));

        await this.db.collection('events').insertMany(eventDocs, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  async getEvents(streamId: string, fromVersion: number = 0): Promise<DomainEvent[]> {
    const cursor = this.db.collection('events').find({
      streamId,
      aggregateVersion: { $gte: fromVersion }
    }).sort({ aggregateVersion: 1 });

    const events = [];
    await cursor.forEach(doc => {
      events.push(this.deserializeEvent(doc));
    });

    return events;
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    await this.db.collection('snapshots').replaceOne(
      { streamId: snapshot.streamId },
      snapshot,
      { upsert: true }
    );
  }

  async getSnapshot(streamId: string): Promise<AggregateSnapshot | null> {
    return await this.db.collection('snapshots').findOne({ streamId });
  }

  subscribe(handler: (event: DomainEvent) => void): void {
    const changeStream = this.db.collection('events').watch();
    changeStream.on('change', (change) => {
      if (change.operationType === 'insert') {
        const event = this.deserializeEvent(change.fullDocument);
        handler(event);
      }
    });
  }

  private async getCurrentVersion(streamId: string): Promise<number> {
    const result = await this.db.collection('events').findOne(
      { streamId },
      { sort: { aggregateVersion: -1 } }
    );
    return result?.aggregateVersion ?? -1;
  }

  private deserializeEvent(doc: any): DomainEvent {
    // Event reconstruction logic based on eventType
    const eventFactories: Record<string, (doc: any) => DomainEvent> = {
      'UserRegistered': (d) => new UserRegisteredEvent(d.streamId, d.aggregateVersion, 
        d.eventData.email, d.eventData.firstName, d.eventData.lastName, d.eventData.registrationSource),
      // Add other event types...
    };
    
    const factory = eventFactories[doc.eventType];
    if (!factory) throw new Error(`Unknown event type: ${doc.eventType}`);
    
    return factory(doc);
  }

  private extractMetadata(event: DomainEvent): any {
    return {
      timestamp: new Date(),
      version: event.eventVersion
    };
  }
}

class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
```

## Repository Pattern

```typescript
export class EventSourcedRepository<T> {
  constructor(
    private eventStore: EventStore,
    private aggregateFactory: (id: string, events: DomainEvent[]) => T
  ) {}

  async getById(id: string): Promise<T | null> {
    // Try snapshot first
    const snapshot = await this.eventStore.getSnapshot(id);
    const fromVersion = snapshot?.version ?? 0;
    
    // Get events after snapshot
    const events = await this.eventStore.getEvents(id, fromVersion);
    
    if (!snapshot && events.length === 0) {
      return null;
    }

    // Reconstruct aggregate
    let aggregate = snapshot 
      ? this.reconstructFromSnapshot(id, snapshot, events)
      : this.aggregateFactory(id, events);

    return aggregate;
  }

  async save(aggregate: any): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    
    if (events.length === 0) return;
    
    await this.eventStore.append(
      aggregate.id,
      events,
      aggregate.version - events.length
    );
    
    aggregate.markEventsAsCommitted();

    // Create snapshot if needed
    if (aggregate.version % 100 === 0) {
      await this.createSnapshot(aggregate);
    }
  }

  private reconstructFromSnapshot(id: string, snapshot: AggregateSnapshot, events: DomainEvent[]): T {
    // Implement snapshot-based reconstruction
    const aggregate = this.aggregateFactory(id, []);
    (aggregate as any).loadFromSnapshot(snapshot.data);
    
    // Apply events after snapshot
    events.forEach(event => (aggregate as any).applyEvent(event));
    
    return aggregate;
  }

  private async createSnapshot(aggregate: any): Promise<void> {
    const snapshot: AggregateSnapshot = {
      streamId: aggregate.id,
      version: aggregate.version,
      data: aggregate.toSnapshot(),
      timestamp: new Date()
    };
    
    await this.eventStore.saveSnapshot(snapshot);
  }
}
```

## Event Stream Partitioning

```yaml
partitioning_strategies:
  tenant_based:
    pattern: "{tenantId}_{aggregateType}_{aggregateId}"
    example: "acme_user_12345"
    
  temporal:
    pattern: "{aggregateType}_{year}_{month}_{aggregateId}"
    example: "order_2025_01_54321"
    
  hash_based:
    pattern: "{aggregateType}_{hash(aggregateId)}"
    shards: 16
    
performance_optimizations:
  indexes:
    - streamId + aggregateVersion
    - eventType + occurredOn  
    - aggregateId (for queries)
    
  caching:
    - Recent event streams
    - Aggregate snapshots
    - Event type mappings
```