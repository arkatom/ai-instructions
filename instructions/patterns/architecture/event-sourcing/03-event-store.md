# Event Store Implementation

## Event Store Interface

```typescript
// src/infrastructure/eventstore/EventStore.ts
export interface EventStore {
  // Write operations
  append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void>;
  
  // Read operations
  getEvents(
    streamId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<DomainEvent[]>;
  
  getAllEvents(
    fromPosition?: number,
    limit?: number
  ): Promise<DomainEvent[]>;
  
  // Stream operations
  getStreamVersion(streamId: string): Promise<number>;
  streamExists(streamId: string): Promise<boolean>;
  
  // Snapshot operations
  saveSnapshot(snapshot: AggregateSnapshot): Promise<void>;
  getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null>;
  
  // Subscription operations
  subscribe(
    fromPosition: number,
    handler: (event: DomainEvent) => Promise<void>
  ): EventSubscription;
}
```

## PostgreSQL Implementation

### Schema Design

```sql
-- Events table
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  stream_id VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stream_id, event_version)
);

-- Indexes for query performance
CREATE INDEX idx_events_stream_id ON events(stream_id);
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_occurred_at ON events(occurred_at);

-- Snapshots table
CREATE TABLE snapshots (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aggregate_id, version)
);

CREATE INDEX idx_snapshots_aggregate_id ON snapshots(aggregate_id);
```

### Core Operations

```typescript
class PostgreSQLEventStore implements EventStore {
  constructor(private readonly pool: Pool) {}

  async append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Optimistic concurrency control
      if (expectedVersion !== undefined) {
        const currentVersion = await this.getStreamVersion(streamId);
        if (currentVersion !== expectedVersion) {
          throw new ConcurrencyError(
            `Expected version ${expectedVersion} but current is ${currentVersion}`
          );
        }
      }

      // Append events with version increment
      let version = await this.getStreamVersion(streamId);
      
      for (const event of events) {
        version++;
        await this.insertEvent(client, streamId, event, version);
      }

      await client.query('COMMIT');
      
      // Notify subscribers
      await this.notifySubscribers(events);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertEvent(
    client: PoolClient,
    streamId: string,
    event: DomainEvent,
    version: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO events (
        stream_id, aggregate_id, aggregate_type,
        event_type, event_version, event_data,
        metadata, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        streamId,
        event.aggregateId,
        event.aggregateType,
        event.eventType,
        version,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata),
        event.occurredAt
      ]
    );
  }
}
```

## Snapshot Strategy

```typescript
interface SnapshotStrategy {
  shouldTakeSnapshot(version: number): boolean;
}

class IntervalSnapshotStrategy implements SnapshotStrategy {
  constructor(private readonly interval: number = 100) {}
  
  shouldTakeSnapshot(version: number): boolean {
    return version % this.interval === 0;
  }
}

class SnapshotManager {
  constructor(
    private readonly eventStore: EventStore,
    private readonly strategy: SnapshotStrategy
  ) {}
  
  async loadAggregate(aggregateId: string): Promise<{
    snapshot: AggregateSnapshot | null;
    events: DomainEvent[];
  }> {
    // Try to load from snapshot
    const snapshot = await this.eventStore.getSnapshot(aggregateId);
    
    // Load events after snapshot
    const fromVersion = snapshot ? snapshot.version + 1 : 1;
    const events = await this.eventStore.getEvents(
      aggregateId,
      fromVersion
    );
    
    return { snapshot, events };
  }
  
  async saveAggregate(
    aggregate: EventSourcedAggregate,
    events: DomainEvent[]
  ): Promise<void> {
    // Save events
    await this.eventStore.append(
      aggregate.getId(),
      events,
      aggregate.getVersion()
    );
    
    // Check if snapshot needed
    const newVersion = aggregate.getVersion() + events.length;
    if (this.strategy.shouldTakeSnapshot(newVersion)) {
      await this.createSnapshot(aggregate, newVersion);
    }
  }
  
  private async createSnapshot(
    aggregate: EventSourcedAggregate,
    version: number
  ): Promise<void> {
    const snapshot: AggregateSnapshot = {
      aggregateId: aggregate.getId(),
      aggregateType: aggregate.constructor.name,
      version,
      data: aggregate.toSnapshot(),
      createdAt: new Date()
    };
    
    await this.eventStore.saveSnapshot(snapshot);
  }
}
```

## Event Stream Patterns

```yaml
stream_patterns:
  single_stream_per_aggregate:
    structure: "{aggregateType}-{aggregateId}"
    example: "Account-12345"
    use_case: "Standard event sourcing"
    
  category_streams:
    structure: "{category}:{aggregateId}"
    example: "orders:12345"
    use_case: "Event categorization"
    
  partition_streams:
    structure: "{partition}/{aggregateType}/{aggregateId}"
    example: "tenant-1/Account/12345"
    use_case: "Multi-tenancy"
    
  global_stream:
    structure: "$all"
    use_case: "Global ordering, projections"
```

## Performance Optimizations

```typescript
class OptimizedEventStore extends PostgreSQLEventStore {
  private cache = new Map<string, DomainEvent[]>();
  
  async getEvents(streamId: string, fromVersion?: number, toVersion?: number): Promise<DomainEvent[]> {
    const cacheKey = `${streamId}:${fromVersion}:${toVersion}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    
    const events = await super.getEvents(streamId, fromVersion, toVersion);
    if (toVersion !== undefined) this.cache.set(cacheKey, events);
    
    return events;
  }
  
  async appendBatch(operations: Array<{streamId: string; events: DomainEvent[]; expectedVersion?: number}>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const op of operations) await this.appendToStream(client, op);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```