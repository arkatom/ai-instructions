# Event Sourcing Patterns

## Core Concepts

### Event Sourcing Philosophy
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

## Event Modeling

### Event Design
```typescript
// src/domain/events/BaseEvent.ts
export interface DomainEvent {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  metadata: EventMetadata;
  payload: any;
}

export interface EventMetadata {
  correlationId: string;
  causationId: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export abstract class BaseEvent implements DomainEvent {
  public readonly occurredAt: Date;
  public readonly metadata: EventMetadata;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly eventType: string,
    public readonly eventVersion: number,
    metadata: Partial<EventMetadata>
  ) {
    this.occurredAt = new Date();
    this.metadata = {
      correlationId: metadata.correlationId || this.generateId(),
      causationId: metadata.causationId || this.generateId(),
      timestamp: new Date(),
      ...metadata
    };
  }

  abstract get payload(): any;

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Domain Events
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
    super(
      aggregateId,
      'Account',
      'AccountCreated',
      1,
      metadata
    );
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
    super(
      aggregateId,
      'Account',
      'MoneyDeposited',
      1,
      metadata
    );
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

export class MoneyWithdrawnEvent extends BaseEvent {
  constructor(
    aggregateId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly reason: string,
    public readonly reference: string,
    metadata: Partial<EventMetadata>
  ) {
    super(
      aggregateId,
      'Account',
      'MoneyWithdrawn',
      1,
      metadata
    );
  }

  get payload() {
    return {
      amount: this.amount,
      currency: this.currency,
      reason: this.reason,
      reference: this.reference
    };
  }
}

export class AccountFrozenEvent extends BaseEvent {
  constructor(
    aggregateId: string,
    public readonly reason: string,
    public readonly frozenBy: string,
    public readonly frozenUntil?: Date,
    metadata: Partial<EventMetadata>
  ) {
    super(
      aggregateId,
      'Account',
      'AccountFrozen',
      1,
      metadata
    );
  }

  get payload() {
    return {
      reason: this.reason,
      frozenBy: this.frozenBy,
      frozenUntil: this.frozenUntil
    };
  }
}

export class AccountClosedEvent extends BaseEvent {
  constructor(
    aggregateId: string,
    public readonly closureReason: string,
    public readonly closedBy: string,
    public readonly finalBalance: number,
    metadata: Partial<EventMetadata>
  ) {
    super(
      aggregateId,
      'Account',
      'AccountClosed',
      1,
      metadata
    );
  }

  get payload() {
    return {
      closureReason: this.closureReason,
      closedBy: this.closedBy,
      finalBalance: this.finalBalance
    };
  }
}
```

## Event Store

### Event Store Interface
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

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  data: any;
  version: number;
  createdAt: Date;
}

export interface EventSubscription {
  unsubscribe(): void;
}
```

### PostgreSQL Event Store Implementation
```typescript
// src/infrastructure/eventstore/PostgreSQLEventStore.ts
import { Pool, PoolClient } from 'pg';
import { EventStore, DomainEvent, AggregateSnapshot } from './EventStore';

export class PostgreSQLEventStore implements EventStore {
  private subscriptions = new Map<string, EventHandler[]>();

  constructor(private readonly pool: Pool) {
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events (
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

      CREATE INDEX IF NOT EXISTS idx_events_stream_id 
        ON events(stream_id);
      CREATE INDEX IF NOT EXISTS idx_events_aggregate_id 
        ON events(aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_events_event_type 
        ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_occurred_at 
        ON events(occurred_at);

      CREATE TABLE IF NOT EXISTS snapshots (
        id BIGSERIAL PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(aggregate_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id 
        ON snapshots(aggregate_id);
    `);
  }

  async append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check expected version
      if (expectedVersion !== undefined) {
        const result = await client.query(
          `SELECT MAX(event_version) as version 
           FROM events 
           WHERE stream_id = $1`,
          [streamId]
        );
        
        const currentVersion = result.rows[0].version || 0;
        if (currentVersion !== expectedVersion) {
          throw new ConcurrencyError(
            `Expected version ${expectedVersion} but current version is ${currentVersion}`
          );
        }
      }

      // Get current version
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(event_version), 0) as version 
         FROM events 
         WHERE stream_id = $1`,
        [streamId]
      );
      
      let currentVersion = versionResult.rows[0].version;

      // Insert events
      for (const event of events) {
        currentVersion++;
        
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
            currentVersion,
            JSON.stringify(event.payload),
            JSON.stringify(event.metadata),
            event.occurredAt
          ]
        );
      }

      await client.query('COMMIT');

      // Notify subscribers
      this.notifySubscribers(events);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(
    streamId: string,
    fromVersion: number = 1,
    toVersion?: number
  ): Promise<DomainEvent[]> {
    const query = toVersion
      ? `SELECT * FROM events 
         WHERE stream_id = $1 
         AND event_version >= $2 
         AND event_version <= $3
         ORDER BY event_version`
      : `SELECT * FROM events 
         WHERE stream_id = $1 
         AND event_version >= $2
         ORDER BY event_version`;
    
    const params = toVersion
      ? [streamId, fromVersion, toVersion]
      : [streamId, fromVersion];
    
    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => this.deserializeEvent(row));
  }

  async getAllEvents(
    fromPosition: number = 0,
    limit: number = 1000
  ): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM events 
       WHERE id > $1 
       ORDER BY id 
       LIMIT $2`,
      [fromPosition, limit]
    );
    
    return result.rows.map(row => this.deserializeEvent(row));
  }

  async getStreamVersion(streamId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(MAX(event_version), 0) as version 
       FROM events 
       WHERE stream_id = $1`,
      [streamId]
    );
    
    return result.rows[0].version;
  }

  async streamExists(streamId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM events WHERE stream_id = $1
      ) as exists`,
      [streamId]
    );
    
    return result.rows[0].exists;
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO snapshots (
        aggregate_id, aggregate_type, version, data
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (aggregate_id, version) 
      DO UPDATE SET data = $4`,
      [
        snapshot.aggregateId,
        snapshot.aggregateType,
        snapshot.version,
        JSON.stringify(snapshot.data)
      ]
    );
  }

  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    const result = await this.pool.query(
      `SELECT * FROM snapshots 
       WHERE aggregate_id = $1 
       ORDER BY version DESC 
       LIMIT 1`,
      [aggregateId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      version: row.version,
      data: row.data,
      createdAt: row.created_at
    };
  }

  subscribe(
    fromPosition: number,
    handler: (event: DomainEvent) => Promise<void>
  ): EventSubscription {
    const subscriptionId = this.generateSubscriptionId();
    
    // Start polling for new events
    const pollInterval = setInterval(async () => {
      try {
        const events = await this.getAllEvents(fromPosition, 100);
        for (const event of events) {
          await handler(event);
          fromPosition = (event as any).id;
        }
      } catch (error) {
        console.error('Subscription error:', error);
      }
    }, 1000); // Poll every second

    return {
      unsubscribe: () => {
        clearInterval(pollInterval);
      }
    };
  }

  private deserializeEvent(row: any): DomainEvent {
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      eventVersion: row.event_version,
      payload: row.event_data,
      metadata: row.metadata,
      occurredAt: row.occurred_at
    };
  }

  private notifySubscribers(events: DomainEvent[]): void {
    // Implementation for real-time event notification
    // Could use WebSockets, Server-Sent Events, etc.
  }

  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
```

## Event-Sourced Aggregates

### Aggregate Base Class
```typescript
// src/domain/aggregates/AggregateRoot.ts
export abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  private version: number = 0;

  constructor(protected readonly id: string) {}

  protected applyEvent(event: DomainEvent): void {
    this.handleEvent(event);
    this.uncommittedEvents.push(event);
    this.version++;
  }

  protected abstract handleEvent(event: DomainEvent): void;

  public getUncommittedEvents(): DomainEvent[] {
    return this.uncommittedEvents;
  }

  public markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.handleEvent(event);
      this.version++;
    });
  }

  public getVersion(): number {
    return this.version;
  }

  public getId(): string {
    return this.id;
  }
}
```

### Account Aggregate
```typescript
// src/domain/aggregates/Account.ts
import { AggregateRoot } from './AggregateRoot';
import {
  AccountCreatedEvent,
  MoneyDepositedEvent,
  MoneyWithdrawnEvent,
  AccountFrozenEvent,
  AccountClosedEvent
} from '../events/AccountEvents';

export class Account extends AggregateRoot {
  private accountNumber?: string;
  private accountHolder?: string;
  private balance: number = 0;
  private currency?: string;
  private accountType?: 'CHECKING' | 'SAVINGS';
  private isFrozen: boolean = false;
  private isClosed: boolean = false;

  // Factory method for creating new account
  public static create(
    id: string,
    accountNumber: string,
    accountHolder: string,
    initialBalance: number,
    currency: string,
    accountType: 'CHECKING' | 'SAVINGS'
  ): Account {
    const account = new Account(id);
    
    account.applyEvent(new AccountCreatedEvent(
      id,
      accountNumber,
      accountHolder,
      initialBalance,
      currency,
      accountType,
      {}
    ));
    
    return account;
  }

  // Factory method for reconstituting from events
  public static fromEvents(id: string, events: DomainEvent[]): Account {
    const account = new Account(id);
    account.loadFromHistory(events);
    return account;
  }

  // Business methods
  public deposit(
    amount: number,
    source: string,
    reference: string
  ): void {
    this.validateNotClosed();
    this.validateNotFrozen();
    
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    
    this.applyEvent(new MoneyDepositedEvent(
      this.id,
      amount,
      this.currency!,
      source,
      reference,
      {}
    ));
  }

  public withdraw(
    amount: number,
    reason: string,
    reference: string
  ): void {
    this.validateNotClosed();
    this.validateNotFrozen();
    
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Check overdraft rules for checking accounts
    if (this.accountType === 'CHECKING') {
      const overdraftLimit = 500; // Example overdraft limit
      if (this.balance - amount < -overdraftLimit) {
        throw new Error('Exceeds overdraft limit');
      }
    }
    
    this.applyEvent(new MoneyWithdrawnEvent(
      this.id,
      amount,
      this.currency!,
      reason,
      reference,
      {}
    ));
  }

  public freeze(reason: string, frozenBy: string, frozenUntil?: Date): void {
    this.validateNotClosed();
    
    if (this.isFrozen) {
      throw new Error('Account is already frozen');
    }
    
    this.applyEvent(new AccountFrozenEvent(
      this.id,
      reason,
      frozenBy,
      frozenUntil,
      {}
    ));
  }

  public close(closureReason: string, closedBy: string): void {
    if (this.isClosed) {
      throw new Error('Account is already closed');
    }
    
    if (this.balance !== 0) {
      throw new Error('Cannot close account with non-zero balance');
    }
    
    this.applyEvent(new AccountClosedEvent(
      this.id,
      closureReason,
      closedBy,
      this.balance,
      {}
    ));
  }

  // Event handlers
  protected handleEvent(event: DomainEvent): void {
    switch (event.eventType) {
      case 'AccountCreated':
        this.handleAccountCreated(event as AccountCreatedEvent);
        break;
      case 'MoneyDeposited':
        this.handleMoneyDeposited(event as MoneyDepositedEvent);
        break;
      case 'MoneyWithdrawn':
        this.handleMoneyWithdrawn(event as MoneyWithdrawnEvent);
        break;
      case 'AccountFrozen':
        this.handleAccountFrozen(event as AccountFrozenEvent);
        break;
      case 'AccountClosed':
        this.handleAccountClosed(event as AccountClosedEvent);
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  private handleAccountCreated(event: AccountCreatedEvent): void {
    this.accountNumber = event.accountNumber;
    this.accountHolder = event.accountHolder;
    this.balance = event.initialBalance;
    this.currency = event.currency;
    this.accountType = event.accountType;
  }

  private handleMoneyDeposited(event: MoneyDepositedEvent): void {
    this.balance += event.amount;
  }

  private handleMoneyWithdrawn(event: MoneyWithdrawnEvent): void {
    this.balance -= event.amount;
  }

  private handleAccountFrozen(event: AccountFrozenEvent): void {
    this.isFrozen = true;
  }

  private handleAccountClosed(event: AccountClosedEvent): void {
    this.isClosed = true;
  }

  // Validation methods
  private validateNotClosed(): void {
    if (this.isClosed) {
      throw new Error('Account is closed');
    }
  }

  private validateNotFrozen(): void {
    if (this.isFrozen) {
      throw new Error('Account is frozen');
    }
  }

  // Getters
  public getBalance(): number {
    return this.balance;
  }

  public getAccountNumber(): string {
    return this.accountNumber!;
  }

  public getAccountHolder(): string {
    return this.accountHolder!;
  }

  public getIsFrozen(): boolean {
    return this.isFrozen;
  }

  public getIsClosed(): boolean {
    return this.isClosed;
  }
}
```

## Event Handlers and Projections

### Projection Base Class
```typescript
// src/application/projections/Projection.ts
export abstract class Projection {
  abstract readonly projectionName: string;
  abstract readonly subscribedEvents: string[];

  abstract handle(event: DomainEvent): Promise<void>;

  canHandle(event: DomainEvent): boolean {
    return this.subscribedEvents.includes(event.eventType);
  }
}
```

### Account Balance Projection
```typescript
// src/application/projections/AccountBalanceProjection.ts
import { Projection } from './Projection';
import { DomainEvent } from '../../domain/events/BaseEvent';
import { Pool } from 'pg';

export class AccountBalanceProjection extends Projection {
  readonly projectionName = 'AccountBalance';
  readonly subscribedEvents = [
    'AccountCreated',
    'MoneyDeposited',
    'MoneyWithdrawn',
    'AccountClosed'
  ];

  constructor(private readonly pool: Pool) {
    super();
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS account_balances (
        account_id VARCHAR(255) PRIMARY KEY,
        account_number VARCHAR(100) NOT NULL,
        account_holder VARCHAR(255) NOT NULL,
        balance DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        account_type VARCHAR(20) NOT NULL,
        is_frozen BOOLEAN DEFAULT FALSE,
        is_closed BOOLEAN DEFAULT FALSE,
        last_transaction_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_account_balances_account_number 
        ON account_balances(account_number);
      CREATE INDEX IF NOT EXISTS idx_account_balances_account_holder 
        ON account_balances(account_holder);
    `);
  }

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'AccountCreated':
        await this.handleAccountCreated(event);
        break;
      case 'MoneyDeposited':
        await this.handleMoneyDeposited(event);
        break;
      case 'MoneyWithdrawn':
        await this.handleMoneyWithdrawn(event);
        break;
      case 'AccountClosed':
        await this.handleAccountClosed(event);
        break;
    }
  }

  private async handleAccountCreated(event: DomainEvent): Promise<void> {
    const { 
      accountNumber, 
      accountHolder, 
      initialBalance, 
      currency, 
      accountType 
    } = event.payload;

    await this.pool.query(
      `INSERT INTO account_balances (
        account_id, account_number, account_holder,
        balance, currency, account_type,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.aggregateId,
        accountNumber,
        accountHolder,
        initialBalance,
        currency,
        accountType,
        event.occurredAt,
        event.occurredAt
      ]
    );
  }

  private async handleMoneyDeposited(event: DomainEvent): Promise<void> {
    const { amount } = event.payload;

    await this.pool.query(
      `UPDATE account_balances 
       SET balance = balance + $1,
           last_transaction_date = $2,
           updated_at = $3
       WHERE account_id = $4`,
      [amount, event.occurredAt, new Date(), event.aggregateId]
    );
  }

  private async handleMoneyWithdrawn(event: DomainEvent): Promise<void> {
    const { amount } = event.payload;

    await this.pool.query(
      `UPDATE account_balances 
       SET balance = balance - $1,
           last_transaction_date = $2,
           updated_at = $3
       WHERE account_id = $4`,
      [amount, event.occurredAt, new Date(), event.aggregateId]
    );
  }

  private async handleAccountClosed(event: DomainEvent): Promise<void> {
    await this.pool.query(
      `UPDATE account_balances 
       SET is_closed = TRUE,
           updated_at = $1
       WHERE account_id = $2`,
      [new Date(), event.aggregateId]
    );
  }
}
```

### Transaction History Projection
```typescript
// src/application/projections/TransactionHistoryProjection.ts
export class TransactionHistoryProjection extends Projection {
  readonly projectionName = 'TransactionHistory';
  readonly subscribedEvents = [
    'MoneyDeposited',
    'MoneyWithdrawn'
  ];

  constructor(private readonly pool: Pool) {
    super();
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_history (
        id BIGSERIAL PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        reference VARCHAR(255),
        description TEXT,
        balance_after DECIMAL(15, 2),
        occurred_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transaction_history_account_id 
        ON transaction_history(account_id);
      CREATE INDEX IF NOT EXISTS idx_transaction_history_occurred_at 
        ON transaction_history(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_transaction_history_reference 
        ON transaction_history(reference);
    `);
  }

  async handle(event: DomainEvent): Promise<void> {
    const transactionType = event.eventType === 'MoneyDeposited' 
      ? 'DEPOSIT' 
      : 'WITHDRAWAL';
    
    const { amount, currency, reference } = event.payload;
    const description = event.eventType === 'MoneyDeposited'
      ? `Deposit from ${event.payload.source}`
      : `Withdrawal: ${event.payload.reason}`;

    // Get current balance
    const balanceResult = await this.pool.query(
      'SELECT balance FROM account_balances WHERE account_id = $1',
      [event.aggregateId]
    );
    
    const balanceAfter = balanceResult.rows[0]?.balance || 0;

    await this.pool.query(
      `INSERT INTO transaction_history (
        account_id, transaction_type, amount, currency,
        reference, description, balance_after, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.aggregateId,
        transactionType,
        amount,
        currency,
        reference,
        description,
        balanceAfter,
        event.occurredAt
      ]
    );
  }
}
```

## Command Handlers

### Command Handler Pattern
```typescript
// src/application/commands/CommandHandler.ts
export interface Command {
  commandId: string;
  timestamp: Date;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export abstract class BaseCommandHandler<T extends Command> 
  implements CommandHandler<T> {
  
  constructor(
    protected readonly eventStore: EventStore,
    protected readonly eventBus: EventBus
  ) {}

  abstract handle(command: T): Promise<void>;

  protected async saveAndPublishEvents(
    streamId: string,
    aggregate: AggregateRoot,
    expectedVersion?: number
  ): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    
    if (events.length === 0) {
      return;
    }

    // Save to event store
    await this.eventStore.append(streamId, events, expectedVersion);
    
    // Mark events as committed
    aggregate.markEventsAsCommitted();
    
    // Publish to event bus
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }
}
```

### Account Command Handlers
```typescript
// src/application/commands/AccountCommands.ts
export interface CreateAccountCommand extends Command {
  accountId: string;
  accountNumber: string;
  accountHolder: string;
  initialDeposit: number;
  currency: string;
  accountType: 'CHECKING' | 'SAVINGS';
}

export interface DepositMoneyCommand extends Command {
  accountId: string;
  amount: number;
  source: string;
  reference: string;
}

export interface WithdrawMoneyCommand extends Command {
  accountId: string;
  amount: number;
  reason: string;
  reference: string;
}

// src/application/commands/AccountCommandHandlers.ts
export class CreateAccountCommandHandler 
  extends BaseCommandHandler<CreateAccountCommand> {
  
  async handle(command: CreateAccountCommand): Promise<void> {
    // Check if account already exists
    const exists = await this.eventStore.streamExists(command.accountId);
    if (exists) {
      throw new Error(`Account ${command.accountId} already exists`);
    }

    // Create new account
    const account = Account.create(
      command.accountId,
      command.accountNumber,
      command.accountHolder,
      command.initialDeposit,
      command.currency,
      command.accountType
    );

    // Save events
    await this.saveAndPublishEvents(
      command.accountId,
      account
    );
  }
}

export class DepositMoneyCommandHandler 
  extends BaseCommandHandler<DepositMoneyCommand> {
  
  async handle(command: DepositMoneyCommand): Promise<void> {
    // Load account from event store
    const events = await this.eventStore.getEvents(command.accountId);
    if (events.length === 0) {
      throw new Error(`Account ${command.accountId} not found`);
    }

    const account = Account.fromEvents(command.accountId, events);
    const expectedVersion = account.getVersion();

    // Execute business logic
    account.deposit(
      command.amount,
      command.source,
      command.reference
    );

    // Save events with optimistic concurrency control
    await this.saveAndPublishEvents(
      command.accountId,
      account,
      expectedVersion
    );
  }
}

export class WithdrawMoneyCommandHandler 
  extends BaseCommandHandler<WithdrawMoneyCommand> {
  
  async handle(command: WithdrawMoneyCommand): Promise<void> {
    // Load account with snapshot optimization
    const snapshot = await this.eventStore.getSnapshot(command.accountId);
    
    let account: Account;
    let fromVersion = 1;
    
    if (snapshot) {
      // Reconstitute from snapshot
      account = new Account(command.accountId);
      account.loadFromSnapshot(snapshot.data);
      fromVersion = snapshot.version + 1;
    } else {
      account = new Account(command.accountId);
    }

    // Load events after snapshot
    const events = await this.eventStore.getEvents(
      command.accountId,
      fromVersion
    );
    
    if (events.length === 0 && !snapshot) {
      throw new Error(`Account ${command.accountId} not found`);
    }

    account.loadFromHistory(events);
    const expectedVersion = account.getVersion();

    // Execute business logic
    account.withdraw(
      command.amount,
      command.reason,
      command.reference
    );

    // Save events
    await this.saveAndPublishEvents(
      command.accountId,
      account,
      expectedVersion
    );

    // Create snapshot every 10 events
    if (account.getVersion() % 10 === 0) {
      await this.eventStore.saveSnapshot({
        aggregateId: command.accountId,
        aggregateType: 'Account',
        version: account.getVersion(),
        data: account.toSnapshot(),
        createdAt: new Date()
      });
    }
  }
}
```

## Query Models

### Read Model Queries
```typescript
// src/application/queries/AccountQueries.ts
export interface AccountSummary {
  accountId: string;
  accountNumber: string;
  accountHolder: string;
  balance: number;
  currency: string;
  accountType: string;
  isFrozen: boolean;
  isClosed: boolean;
  lastTransactionDate?: Date;
}

export interface TransactionSummary {
  transactionId: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  currency: string;
  reference: string;
  description: string;
  balanceAfter: number;
  occurredAt: Date;
}

export class AccountQueryService {
  constructor(private readonly pool: Pool) {}

  async getAccountSummary(accountId: string): Promise<AccountSummary | null> {
    const result = await this.pool.query(
      `SELECT * FROM account_balances WHERE account_id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      accountId: row.account_id,
      accountNumber: row.account_number,
      accountHolder: row.account_holder,
      balance: parseFloat(row.balance),
      currency: row.currency,
      accountType: row.account_type,
      isFrozen: row.is_frozen,
      isClosed: row.is_closed,
      lastTransactionDate: row.last_transaction_date
    };
  }

  async getTransactionHistory(
    accountId: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 100
  ): Promise<TransactionSummary[]> {
    let query = `
      SELECT * FROM transaction_history 
      WHERE account_id = $1
    `;
    
    const params: any[] = [accountId];
    let paramIndex = 2;

    if (fromDate) {
      query += ` AND occurred_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      query += ` AND occurred_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    query += ` ORDER BY occurred_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      transactionId: row.id,
      accountId: row.account_id,
      type: row.transaction_type,
      amount: parseFloat(row.amount),
      currency: row.currency,
      reference: row.reference,
      description: row.description,
      balanceAfter: parseFloat(row.balance_after),
      occurredAt: row.occurred_at
    }));
  }

  async getAccountsByHolder(
    accountHolder: string
  ): Promise<AccountSummary[]> {
    const result = await this.pool.query(
      `SELECT * FROM account_balances 
       WHERE account_holder ILIKE $1
       ORDER BY created_at DESC`,
      [`%${accountHolder}%`]
    );

    return result.rows.map(row => ({
      accountId: row.account_id,
      accountNumber: row.account_number,
      accountHolder: row.account_holder,
      balance: parseFloat(row.balance),
      currency: row.currency,
      accountType: row.account_type,
      isFrozen: row.is_frozen,
      isClosed: row.is_closed,
      lastTransactionDate: row.last_transaction_date
    }));
  }

  async getDailyBalances(
    accountId: string,
    days: number = 30
  ): Promise<Array<{ date: Date; balance: number }>> {
    const result = await this.pool.query(
      `WITH daily_transactions AS (
        SELECT 
          DATE(occurred_at) as date,
          SUM(CASE 
            WHEN transaction_type = 'DEPOSIT' THEN amount
            WHEN transaction_type = 'WITHDRAWAL' THEN -amount
            ELSE 0
          END) as daily_change
        FROM transaction_history
        WHERE account_id = $1
        AND occurred_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(occurred_at)
      )
      SELECT 
        date,
        SUM(daily_change) OVER (ORDER BY date) as balance
      FROM daily_transactions
      ORDER BY date`,
      [accountId]
    );

    return result.rows.map(row => ({
      date: row.date,
      balance: parseFloat(row.balance)
    }));
  }
}
```

## Event Replay and Temporal Queries

### Event Replay Service
```typescript
// src/application/services/EventReplayService.ts
export class EventReplayService {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projections: Projection[]
  ) {}

  async replayAllEvents(): Promise<void> {
    console.log('Starting full event replay...');
    
    let position = 0;
    const batchSize = 1000;
    let processedCount = 0;

    while (true) {
      const events = await this.eventStore.getAllEvents(
        position,
        batchSize
      );

      if (events.length === 0) {
        break;
      }

      for (const event of events) {
        await this.processEvent(event);
        processedCount++;
        
        if (processedCount % 1000 === 0) {
          console.log(`Processed ${processedCount} events`);
        }
      }

      position = (events[events.length - 1] as any).id;
    }

    console.log(`Event replay completed. Processed ${processedCount} events.`);
  }

  async replayStream(streamId: string): Promise<void> {
    const events = await this.eventStore.getEvents(streamId);
    
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  async replayFromDate(fromDate: Date): Promise<void> {
    // Implementation for replaying events from specific date
    // Would require additional indexing by date in event store
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    for (const projection of this.projections) {
      if (projection.canHandle(event)) {
        await projection.handle(event);
      }
    }
  }
}
```

### Temporal Query Service
```typescript
// src/application/services/TemporalQueryService.ts
export class TemporalQueryService {
  constructor(private readonly eventStore: EventStore) {}

  async getAggregateStateAtTime<T extends AggregateRoot>(
    aggregateId: string,
    aggregateType: string,
    pointInTime: Date,
    AggregateClass: new (id: string) => T
  ): Promise<T | null> {
    // Get all events up to the point in time
    const events = await this.eventStore.getEvents(aggregateId);
    
    const relevantEvents = events.filter(
      event => event.occurredAt <= pointInTime
    );

    if (relevantEvents.length === 0) {
      return null;
    }

    const aggregate = new AggregateClass(aggregateId);
    aggregate.loadFromHistory(relevantEvents);
    
    return aggregate;
  }

  async getAccountBalanceAtTime(
    accountId: string,
    pointInTime: Date
  ): Promise<number | null> {
    const account = await this.getAggregateStateAtTime(
      accountId,
      'Account',
      pointInTime,
      Account
    );

    return account ? account.getBalance() : null;
  }

  async auditAccountChanges(
    accountId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Array<{
    timestamp: Date;
    eventType: string;
    changes: any;
    userId?: string;
  }>> {
    const events = await this.eventStore.getEvents(accountId);
    
    return events
      .filter(event => 
        event.occurredAt >= fromDate && 
        event.occurredAt <= toDate
      )
      .map(event => ({
        timestamp: event.occurredAt,
        eventType: event.eventType,
        changes: event.payload,
        userId: event.metadata.userId
      }));
  }
}
```

## Event Schema Evolution

### Event Versioning Strategy
```typescript
// src/infrastructure/eventstore/EventUpgrader.ts
export interface EventUpgrader {
  canUpgrade(event: DomainEvent): boolean;
  upgrade(event: DomainEvent): DomainEvent;
}

export class AccountCreatedEventV1ToV2Upgrader implements EventUpgrader {
  canUpgrade(event: DomainEvent): boolean {
    return event.eventType === 'AccountCreated' && 
           event.eventVersion === 1;
  }

  upgrade(event: DomainEvent): DomainEvent {
    const upgradedPayload = {
      ...event.payload,
      // Add new required field with default value
      kycStatus: 'PENDING',
      // Rename field
      holderName: event.payload.accountHolder,
      // Remove deprecated field
      accountHolder: undefined
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
    new AccountCreatedEventV1ToV2Upgrader(),
    // Add more upgraders as needed
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

  upgradeEvents(events: DomainEvent[]): DomainEvent[] {
    return events.map(event => this.upgradeEvent(event));
  }
}
```

## Testing Event-Sourced Systems

### Aggregate Testing
```typescript
// tests/domain/Account.test.ts
import { Account } from '../../src/domain/aggregates/Account';
import { 
  AccountCreatedEvent,
  MoneyDepositedEvent 
} from '../../src/domain/events/AccountEvents';

describe('Account Aggregate', () => {
  describe('create', () => {
    it('should create account with initial balance', () => {
      const account = Account.create(
        'ACC-001',
        '123456789',
        'John Doe',
        1000,
        'USD',
        'CHECKING'
      );

      expect(account.getBalance()).toBe(1000);
      expect(account.getAccountNumber()).toBe('123456789');
      expect(account.getAccountHolder()).toBe('John Doe');
      
      const events = account.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('AccountCreated');
    });
  });

  describe('deposit', () => {
    it('should increase balance', () => {
      const account = Account.create(
        'ACC-001',
        '123456789',
        'John Doe',
        1000,
        'USD',
        'CHECKING'
      );
      account.markEventsAsCommitted();

      account.deposit(500, 'ATM', 'REF-001');

      expect(account.getBalance()).toBe(1500);
      
      const events = account.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('MoneyDeposited');
    });

    it('should reject negative amounts', () => {
      const account = Account.create(
        'ACC-001',
        '123456789',
        'John Doe',
        1000,
        'USD',
        'CHECKING'
      );

      expect(() => account.deposit(-100, 'ATM', 'REF-001'))
        .toThrow('Deposit amount must be positive');
    });
  });

  describe('fromEvents', () => {
    it('should reconstitute state from events', () => {
      const events = [
        new AccountCreatedEvent(
          'ACC-001',
          '123456789',
          'John Doe',
          1000,
          'USD',
          'CHECKING',
          {}
        ),
        new MoneyDepositedEvent(
          'ACC-001',
          500,
          'USD',
          'ATM',
          'REF-001',
          {}
        )
      ];

      const account = Account.fromEvents('ACC-001', events);

      expect(account.getBalance()).toBe(1500);
      expect(account.getVersion()).toBe(2);
      expect(account.getUncommittedEvents()).toHaveLength(0);
    });
  });
});
```

### Event Store Testing
```typescript
// tests/infrastructure/EventStore.test.ts
describe('PostgreSQLEventStore', () => {
  let eventStore: PostgreSQLEventStore;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ /* test database config */ });
    eventStore = new PostgreSQLEventStore(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('append and getEvents', () => {
    it('should store and retrieve events', async () => {
      const streamId = 'test-stream-1';
      const events = [
        new AccountCreatedEvent(
          streamId,
          '123456',
          'Test User',
          1000,
          'USD',
          'CHECKING',
          {}
        )
      ];

      await eventStore.append(streamId, events);
      const retrievedEvents = await eventStore.getEvents(streamId);

      expect(retrievedEvents).toHaveLength(1);
      expect(retrievedEvents[0].eventType).toBe('AccountCreated');
      expect(retrievedEvents[0].aggregateId).toBe(streamId);
    });

    it('should enforce optimistic concurrency control', async () => {
      const streamId = 'test-stream-2';
      const event1 = new AccountCreatedEvent(
        streamId,
        '123457',
        'Test User 2',
        2000,
        'USD',
        'SAVINGS',
        {}
      );

      await eventStore.append(streamId, [event1]);

      // Try to append with wrong expected version
      const event2 = new MoneyDepositedEvent(
        streamId,
        500,
        'USD',
        'Transfer',
        'REF-002',
        {}
      );

      await expect(
        eventStore.append(streamId, [event2], 0)
      ).rejects.toThrow(ConcurrencyError);
    });
  });

  describe('snapshots', () => {
    it('should save and retrieve snapshots', async () => {
      const snapshot: AggregateSnapshot = {
        aggregateId: 'ACC-001',
        aggregateType: 'Account',
        version: 10,
        data: {
          balance: 5000,
          accountNumber: '123456789'
        },
        createdAt: new Date()
      };

      await eventStore.saveSnapshot(snapshot);
      const retrieved = await eventStore.getSnapshot('ACC-001');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.version).toBe(10);
      expect(retrieved!.data.balance).toBe(5000);
    });
  });
});
```

## Performance Optimization

### Snapshot Strategy
```typescript
// src/infrastructure/snapshot/SnapshotStrategy.ts
export interface SnapshotStrategy {
  shouldCreateSnapshot(
    aggregate: AggregateRoot,
    lastSnapshotVersion?: number
  ): boolean;
}

export class VersionIntervalSnapshotStrategy implements SnapshotStrategy {
  constructor(private readonly interval: number = 10) {}

  shouldCreateSnapshot(
    aggregate: AggregateRoot,
    lastSnapshotVersion: number = 0
  ): boolean {
    return aggregate.getVersion() - lastSnapshotVersion >= this.interval;
  }
}

export class TimeBasedSnapshotStrategy implements SnapshotStrategy {
  constructor(
    private readonly snapshotStore: SnapshotStore,
    private readonly maxAge: number = 3600000 // 1 hour in ms
  ) {}

  async shouldCreateSnapshot(
    aggregate: AggregateRoot
  ): Promise<boolean> {
    const lastSnapshot = await this.snapshotStore.getLastSnapshot(
      aggregate.getId()
    );
    
    if (!lastSnapshot) {
      return true;
    }
    
    const age = Date.now() - lastSnapshot.createdAt.getTime();
    return age > this.maxAge;
  }
}
```

### Event Store Caching
```typescript
// src/infrastructure/eventstore/CachedEventStore.ts
import { LRUCache } from 'lru-cache';

export class CachedEventStore implements EventStore {
  private eventCache: LRUCache<string, DomainEvent[]>;
  private versionCache: LRUCache<string, number>;

  constructor(
    private readonly delegate: EventStore,
    cacheSize: number = 1000
  ) {
    this.eventCache = new LRUCache({
      max: cacheSize,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    
    this.versionCache = new LRUCache({
      max: cacheSize * 2,
      ttl: 1000 * 60 * 5
    });
  }

  async append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    await this.delegate.append(streamId, events, expectedVersion);
    
    // Invalidate caches
    this.eventCache.delete(streamId);
    this.versionCache.delete(streamId);
  }

  async getEvents(
    streamId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<DomainEvent[]> {
    // Cache key includes version range
    const cacheKey = `${streamId}:${fromVersion || 0}:${toVersion || 'latest'}`;
    
    const cached = this.eventCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const events = await this.delegate.getEvents(
      streamId,
      fromVersion,
      toVersion
    );
    
    this.eventCache.set(cacheKey, events);
    return events;
  }

  async getStreamVersion(streamId: string): Promise<number> {
    const cached = this.versionCache.get(streamId);
    if (cached !== undefined) {
      return cached;
    }

    const version = await this.delegate.getStreamVersion(streamId);
    this.versionCache.set(streamId, version);
    return version;
  }

  // Delegate other methods...
  async getAllEvents(
    fromPosition?: number,
    limit?: number
  ): Promise<DomainEvent[]> {
    return this.delegate.getAllEvents(fromPosition, limit);
  }

  async streamExists(streamId: string): Promise<boolean> {
    return this.delegate.streamExists(streamId);
  }

  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    return this.delegate.saveSnapshot(snapshot);
  }

  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    return this.delegate.getSnapshot(aggregateId);
  }

  subscribe(
    fromPosition: number,
    handler: (event: DomainEvent) => Promise<void>
  ): EventSubscription {
    return this.delegate.subscribe(fromPosition, handler);
  }
}
```

## Production Deployment

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-sourced-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: event-sourced-app
  template:
    metadata:
      labels:
        app: event-sourced-app
    spec:
      containers:
      - name: app
        image: event-sourced-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: EVENT_STORE_URL
          valueFrom:
            secretKeyRef:
              name: eventstore-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: event-sourced-app
spec:
  selector:
    app: event-sourced-app
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Best Practices

### 1. Event Design Guidelines
```typescript
// Good: Explicit, domain-focused events
class OrderShippedEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly carrier: string,
    public readonly estimatedDelivery: Date
  ) {}
}

// Bad: Generic, CRUD-like events
class EntityUpdatedEvent {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly changes: any
  ) {}
}
```

### 2. Event Naming Conventions
```typescript
// Use past tense for events (they represent facts)
✓ AccountCreated
✓ MoneyDeposited
✓ OrderShipped
✗ CreateAccount
✗ DepositMoney
✗ ShipOrder
```

### 3. Event Granularity
```typescript
// Good: Fine-grained events
class ProductAddedToCartEvent { /* ... */ }
class ProductRemovedFromCartEvent { /* ... */ }
class CartCheckedOutEvent { /* ... */ }

// Bad: Coarse-grained events
class CartUpdatedEvent {
  constructor(
    public readonly action: 'add' | 'remove' | 'checkout',
    public readonly data: any
  ) {}
}
```

This comprehensive Event Sourcing pattern document provides:
- Complete event modeling and design patterns
- PostgreSQL-based event store implementation
- Event-sourced aggregate patterns
- Command and query handling
- Projection and read model patterns
- Event replay and temporal queries
- Schema evolution strategies
- Performance optimization techniques
- Production deployment configurations
- Testing strategies
- Best practices and guidelines

The implementation demonstrates professional-grade event sourcing with proper error handling, concurrency control, and scalability considerations.