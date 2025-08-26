# Event Modeling and Design

## Base Event Implementation

```typescript
// src/domain/events/BaseEvent.ts
export abstract class BaseEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public readonly metadata: EventMetadata;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly eventType: string,
    public readonly eventVersion: number,
    metadata: Partial<EventMetadata>
  ) {
    this.eventId = this.generateEventId();
    this.occurredAt = new Date();
    this.metadata = {
      correlationId: metadata.correlationId || this.generateId(),
      causationId: metadata.causationId || this.generateId(),
      timestamp: new Date(),
      ...metadata
    };
  }

  abstract get payload(): any;

  private generateEventId(): string {
    return `${this.aggregateType}-${this.eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Domain Event Examples

```typescript
// src/domain/events/AccountEvents.ts
export class AccountCreatedEvent extends BaseEvent {
  constructor(
    aggregateId: string,
    public readonly accountNumber: string,
    public readonly accountHolder: string,
    public readonly initialBalance: number,
    public readonly currency: string,
    public readonly accountType: 'CHECKING' | 'SAVINGS',
    metadata: Partial<EventMetadata>
  ) {
    super(aggregateId, 'Account', 'AccountCreated', 1, metadata);
  }

  get payload() {
    return {
      accountNumber: this.accountNumber,
      accountHolder: this.accountHolder,
      initialBalance: this.initialBalance,
      currency: this.currency,
      accountType: this.accountType
    };
  }
}

export class MoneyDepositedEvent extends BaseEvent {
  constructor(
    aggregateId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly source: string,
    public readonly reference: string,
    metadata: Partial<EventMetadata>
  ) {
    super(aggregateId, 'Account', 'MoneyDeposited', 1, metadata);
  }

  get payload() {
    return {
      amount: this.amount,
      currency: this.currency,
      source: this.source,
      reference: this.reference
    };
  }
}
```

## Event Naming Conventions

```yaml
naming_conventions:
  event_names:
    pattern: "PastTenseVerb"
    examples:
      - OrderPlaced (not PlaceOrder)
      - PaymentReceived (not ReceivePayment)
      - UserRegistered (not RegisterUser)
    
  aggregate_context:
    include_aggregate: true
    examples:
      - Account.MoneyDeposited
      - Order.ItemAdded
      - User.PasswordChanged
    
  versioning:
    strategy: "Semantic versioning"
    examples:
      - OrderPlacedV1
      - OrderPlacedV2
      - OrderPlaced_v2_1
```

## Event Metadata Patterns

```typescript
interface ExtendedMetadata extends EventMetadata {
  // Tracking
  correlationId: string;  // Track across services
  causationId: string;    // Direct cause
  conversationId?: string; // Long-running process
  
  // Actor information
  userId: string;
  userName?: string;
  userRoles?: string[];
  impersonatorId?: string;
  
  // Context
  tenantId?: string;
  organizationId?: string;
  departmentId?: string;
  
  // Request details
  ipAddress: string;
  userAgent: string;
  apiVersion?: string;
  clientId?: string;
  
  // Processing
  retryCount?: number;
  scheduledFor?: Date;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

class MetadataBuilder {
  private metadata: Partial<ExtendedMetadata> = {};
  
  withCorrelation(correlationId: string): this {
    this.metadata.correlationId = correlationId;
    return this;
  }
  
  withCausation(causationId: string): this {
    this.metadata.causationId = causationId;
    return this;
  }
  
  withUser(userId: string, userName?: string): this {
    this.metadata.userId = userId;
    this.metadata.userName = userName;
    return this;
  }
  
  withContext(context: Partial<ExtendedMetadata>): this {
    this.metadata = { ...this.metadata, ...context };
    return this;
  }
  
  build(): ExtendedMetadata {
    return {
      correlationId: this.metadata.correlationId || generateId(),
      causationId: this.metadata.causationId || generateId(),
      userId: this.metadata.userId || 'system',
      ipAddress: this.metadata.ipAddress || '0.0.0.0',
      userAgent: this.metadata.userAgent || 'system',
      timestamp: new Date(),
      ...this.metadata
    } as ExtendedMetadata;
  }
}
```

## Event Enrichment

```typescript
interface EventEnricher {
  enrich(event: DomainEvent): Promise<DomainEvent>;
}

class SecurityEnricher implements EventEnricher {
  async enrich(event: DomainEvent): Promise<DomainEvent> {
    const enrichedMetadata = {
      ...event.metadata,
      encryptedFields: await this.identifySensitiveData(event),
      dataClassification: this.classifyData(event),
      retentionPolicy: this.determineRetention(event)
    };
    
    return { ...event, metadata: enrichedMetadata };
  }
  
  private async identifySensitiveData(event: DomainEvent): Promise<string[]> {
    // Identify PII, PCI, etc.
    return [];
  }
  
  private classifyData(event: DomainEvent): string {
    // PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
    return 'INTERNAL';
  }
  
  private determineRetention(event: DomainEvent): number {
    // Days to retain
    return 2555; // 7 years default
  }
}
```

## Event Validation

```typescript
abstract class ValidatedEvent extends BaseEvent {
  constructor(...args: any[]) {
    super(...args);
    this.validate();
  }
  
  protected abstract validate(): void;
  
  protected assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new EventValidationError(message);
    }
  }
}

class TransferInitiatedEvent extends ValidatedEvent {
  constructor(
    aggregateId: string,
    public readonly fromAccount: string,
    public readonly toAccount: string,
    public readonly amount: number,
    public readonly currency: string,
    metadata: Partial<EventMetadata>
  ) {
    super(aggregateId, 'Transfer', 'TransferInitiated', 1, metadata);
  }
  
  protected validate(): void {
    this.assert(this.amount > 0, 'Amount must be positive');
    this.assert(this.fromAccount !== this.toAccount, 'Cannot transfer to same account');
    this.assert(this.currency.length === 3, 'Currency must be 3-letter code');
  }
  
  get payload() {
    return {
      fromAccount: this.fromAccount,
      toAccount: this.toAccount,
      amount: this.amount,
      currency: this.currency
    };
  }
}
```