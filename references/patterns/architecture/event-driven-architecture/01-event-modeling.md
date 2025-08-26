# Event Modeling and Domain Events

## Base Event Implementation

```typescript
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventVersion: number;
  public readonly aggregateId: string;
  public readonly aggregateVersion: number;

  constructor(aggregateId: string, aggregateVersion: number, eventVersion: number = 1) {
    this.eventId = crypto.randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateVersion = aggregateVersion;
    this.eventVersion = eventVersion;
  }

  abstract getEventType(): string;
  abstract getEventData(): Record<string, any>;
}
```

## Domain Event Examples

```typescript
export class UserRegisteredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly registrationSource: string
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventType(): string { return 'UserRegistered'; }
  
  getEventData(): Record<string, any> {
    return {
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      registrationSource: this.registrationSource
    };
  }
}

export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly updatedFields: Record<string, any>,
    public readonly previousValues: Record<string, any>
  ) {
    super(aggregateId, aggregateVersion);
  }

  getEventType(): string { return 'UserProfileUpdated'; }
  
  getEventData(): Record<string, any> {
    return {
      updatedFields: this.updatedFields,
      previousValues: this.previousValues
    };
  }
}
```

## Event-Sourced Aggregate

```typescript
export class UserAggregate {
  private events: DomainEvent[] = [];
  private version: number = 0;

  constructor(
    public readonly id: string,
    private email: string,
    private firstName: string,
    private lastName: string,
    private isActive: boolean = true
  ) {}

  // Factory method
  static register(
    id: string, email: string, firstName: string,
    lastName: string, registrationSource: string
  ): UserAggregate {
    const user = new UserAggregate(id, email, firstName, lastName);
    user.addEvent(new UserRegisteredEvent(id, user.version + 1, email, firstName, lastName, registrationSource));
    user.version++;
    return user;
  }

  // Business methods
  updateProfile(email?: string, firstName?: string, lastName?: string): void {
    const previousValues: Record<string, any> = {};
    const updatedFields: Record<string, any> = {};

    if (email && email !== this.email) {
      previousValues.email = this.email;
      updatedFields.email = email;
      this.email = email;
    }
    
    if (firstName && firstName !== this.firstName) {
      previousValues.firstName = this.firstName;
      updatedFields.firstName = firstName;
      this.firstName = firstName;
    }

    if (lastName && lastName !== this.lastName) {
      previousValues.lastName = this.lastName;
      updatedFields.lastName = lastName;
      this.lastName = lastName;
    }

    if (Object.keys(updatedFields).length > 0) {
      this.addEvent(new UserProfileUpdatedEvent(this.id, this.version + 1, updatedFields, previousValues));
      this.version++;
    }
  }

  // Event management
  getUncommittedEvents(): DomainEvent[] { return [...this.events]; }
  markEventsAsCommitted(): void { this.events = []; }
  private addEvent(event: DomainEvent): void { this.events.push(event); }

  // Event sourcing reconstruction
  static fromHistory(id: string, events: DomainEvent[]): UserAggregate {
    const user = new UserAggregate(id, '', '', '');
    for (const event of events) {
      user.applyEvent(event);
    }
    return user;
  }

  private applyEvent(event: DomainEvent): void {
    const handlers: Record<string, (e: any) => void> = {
      'UserRegistered': (e) => this.applyUserRegisteredEvent(e),
      'UserProfileUpdated': (e) => this.applyUserProfileUpdatedEvent(e),
      'UserDeactivated': (e) => this.applyUserDeactivatedEvent(e)
    };

    const handler = handlers[event.getEventType()];
    if (handler) {
      handler(event);
      this.version = event.aggregateVersion;
    } else {
      throw new Error(`Unknown event type: ${event.getEventType()}`);
    }
  }

  private applyUserRegisteredEvent(event: UserRegisteredEvent): void {
    this.email = event.email;
    this.firstName = event.firstName;
    this.lastName = event.lastName;
    this.isActive = true;
  }

  private applyUserProfileUpdatedEvent(event: UserProfileUpdatedEvent): void {
    Object.assign(this, event.updatedFields);
  }

  private applyUserDeactivatedEvent(event: any): void {
    this.isActive = false;
  }
}
```

## Event Storming Patterns

```yaml
event_storming_process:
  discovery:
    - Identify domain events (orange stickies)
    - Find commands that trigger events (blue stickies)
    - Locate aggregates that handle commands (yellow stickies)
    
  modeling:
    - Group related events around aggregates
    - Define bounded contexts
    - Identify integration points
    
  implementation:
    - Create event classes with rich domain information
    - Implement aggregates with business logic
    - Design event handlers for side effects
```

## Event Design Guidelines

```typescript
interface EventDesignPrinciples {
  // Events should be
  immutable: true;
  pastTense: "Use past tense verbs (UserRegistered, not RegisterUser)";
  granular: "Capture intent and context, not just data changes";
  versioned: "Support schema evolution";
  
  // Avoid
  crud: "Don't just mirror database operations";
  generic: "Be specific to business domain";
  coupled: "Don't expose internal implementation details";
}
```

## Event Metadata

```typescript
interface EventMetadata {
  correlationId: string;    // Track related events
  causationId: string;      // What caused this event
  userId?: string;          // Who initiated the action
  timestamp: Date;          // When it occurred
  source: string;           // Which service/aggregate
  version: number;          // Schema version
}

class EnrichedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    aggregateVersion: number,
    public readonly metadata: EventMetadata
  ) {
    super(aggregateId, aggregateVersion);
  }
}
```