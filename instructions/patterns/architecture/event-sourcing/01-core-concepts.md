# Event Sourcing Core Concepts

## Philosophy

```yaml
event_sourcing_principles:
  core_concept: "Store events, not state"
  
  fundamentals:
    - Events are immutable facts
    - State is derived from events
    - Complete audit trail
    - Time travel capability
    
  benefits:
    - Perfect audit log
    - Temporal queries
    - Event replay
    - Debugging capability
    - Integration flexibility
    
  challenges:
    - Storage requirements
    - Query complexity
    - Event schema evolution
    - Eventually consistent reads
```

## Implementation Guidelines

### When to Use Event Sourcing

```yaml
use_cases:
  perfect_fit:
    - Financial transactions
    - Audit-critical systems
    - Collaborative editing
    - Version control systems
    - Order management
    
  good_fit:
    - Complex domain logic
    - Multi-step workflows
    - Historical analysis needs
    - Debugging requirements
    
  avoid_when:
    - Simple CRUD operations
    - No audit requirements
    - Performance-critical reads
    - Team lacks experience
```

### Event Characteristics

```typescript
interface EventCharacteristics {
  // Events must be
  immutable: true;
  timestamped: true;
  uniquelyIdentified: true;
  domainSpecific: true;
  
  // Events should be
  granular: "Capture intent, not just data";
  named: "Past tense verb (OrderPlaced, not PlaceOrder)";
  contextual: "Include all relevant context";
  versioned: "Support schema evolution";
}
```

## Basic Event Structure

```typescript
// Core event interface
interface DomainEvent {
  // Identity
  eventId: string;
  aggregateId: string;
  
  // Type information
  eventType: string;
  eventVersion: number;
  
  // Temporal
  occurredAt: Date;
  recordedAt: Date;
  
  // Context
  metadata: EventMetadata;
  payload: any;
}

interface EventMetadata {
  // Correlation
  correlationId: string;
  causationId: string;
  
  // Actor
  userId?: string;
  tenantId?: string;
  
  // Request context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}
```

## Event Flow Architecture

```yaml
event_flow:
  1_command_received:
    - Validate command
    - Load aggregate
    - Execute business logic
    
  2_events_generated:
    - Create domain events
    - Add metadata
    - Validate invariants
    
  3_events_stored:
    - Persist to event store
    - Update aggregate version
    - Publish to event bus
    
  4_projections_updated:
    - Update read models
    - Update search indexes
    - Update analytics
    
  5_side_effects:
    - Send notifications
    - Trigger workflows
    - Update external systems
```

## State Reconstruction

```typescript
class EventSourcedAggregate {
  private version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];
  
  // Reconstruct from events
  loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event, false);
      this.version++;
    });
  }
  
  // Apply new event
  protected raiseEvent(event: DomainEvent): void {
    this.applyEvent(event, true);
    this.uncommittedEvents.push(event);
  }
  
  // Event application
  private applyEvent(event: DomainEvent, isNew: boolean): void {
    const handler = this.getEventHandler(event.eventType);
    if (handler) {
      handler.call(this, event);
    }
    
    if (isNew) {
      this.version++;
    }
  }
  
  // Get pending events
  getUncommittedEvents(): DomainEvent[] {
    return this.uncommittedEvents;
  }
  
  // Mark as committed
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }
  
  abstract getEventHandler(eventType: string): Function | undefined;
}
```

## Event Ordering Guarantees

```yaml
ordering_guarantees:
  aggregate_level:
    guarantee: "Total ordering within aggregate"
    implementation: "Version numbers, optimistic locking"
    
  stream_level:
    guarantee: "Ordered by sequence number"
    implementation: "Event store assigns sequence"
    
  global_level:
    guarantee: "Eventual consistency"
    implementation: "Timestamp-based ordering"
    
  partition_level:
    guarantee: "Ordering within partition"
    implementation: "Kafka-style partitioning"
```