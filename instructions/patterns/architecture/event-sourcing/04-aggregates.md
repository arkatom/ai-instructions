# Event-Sourced Aggregates

## Aggregate Base Implementation

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

## Domain Aggregate Example

```typescript
// src/domain/aggregates/Account.ts
export class Account extends AggregateRoot {
  private accountNumber?: string;
  private accountHolder?: string;
  private balance: number = 0;
  private currency?: string;
  private accountType?: 'CHECKING' | 'SAVINGS';
  private isFrozen: boolean = false;
  private isClosed: boolean = false;

  // Factory for new accounts
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
      id, accountNumber, accountHolder,
      initialBalance, currency, accountType, {}
    ));
    
    return account;
  }

  // Factory for reconstitution
  public static fromEvents(id: string, events: DomainEvent[]): Account {
    const account = new Account(id);
    account.loadFromHistory(events);
    return account;
  }

  // Business methods
  public deposit(amount: number, source: string, reference: string): void {
    this.validate();
    
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    
    this.applyEvent(new MoneyDepositedEvent(
      this.id, amount, this.currency!, source, reference, {}
    ));
  }

  public withdraw(amount: number, reason: string, reference: string): void {
    this.validate();
    
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }
    
    if (this.balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    this.applyEvent(new MoneyWithdrawnEvent(
      this.id, amount, this.currency!, reason, reference, {}
    ));
  }

  // Event handlers
  protected handleEvent(event: DomainEvent): void {
    const handlers: Record<string, (e: any) => void> = {
      'AccountCreated': (e) => this.handleAccountCreated(e),
      'MoneyDeposited': (e) => this.handleMoneyDeposited(e),
      'MoneyWithdrawn': (e) => this.handleMoneyWithdrawn(e),
      'AccountFrozen': (e) => this.handleAccountFrozen(e),
      'AccountClosed': (e) => this.handleAccountClosed(e)
    };

    const handler = handlers[event.eventType];
    if (handler) {
      handler(event);
    } else {
      throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  private handleAccountCreated(event: AccountCreatedEvent): void {
    Object.assign(this, {
      accountNumber: event.accountNumber,
      accountHolder: event.accountHolder,
      balance: event.initialBalance,
      currency: event.currency,
      accountType: event.accountType
    });
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

  // Validation
  private validate(): void {
    if (this.isClosed) throw new Error('Account is closed');
    if (this.isFrozen) throw new Error('Account is frozen');
  }
}
```

## Command Handlers

```typescript
// src/application/commands/AccountCommandHandler.ts
export class AccountCommandHandler {
  constructor(
    private readonly eventStore: EventStore,
    private readonly snapshotManager: SnapshotManager
  ) {}

  async handle(command: Command): Promise<void> {
    const handlers: Record<string, (cmd: any) => Promise<void>> = {
      'CreateAccount': (cmd) => this.createAccount(cmd),
      'DepositMoney': (cmd) => this.depositMoney(cmd),
      'WithdrawMoney': (cmd) => this.withdrawMoney(cmd)
    };

    const handler = handlers[command.type];
    if (!handler) throw new Error(`Unknown command type: ${command.type}`);
    await handler(command);
  }

  private async createAccount(command: CreateAccountCommand): Promise<void> {
    if (await this.eventStore.streamExists(command.accountId)) {
      throw new Error('Account already exists');
    }

    const account = Account.create(
      command.accountId, command.accountNumber, command.accountHolder,
      command.initialBalance, command.currency, command.accountType
    );

    await this.saveAggregate(account);
  }

  private async depositMoney(command: DepositMoneyCommand): Promise<void> {
    const account = await this.loadAggregate(command.accountId);
    account.deposit(command.amount, command.source, command.reference);
    await this.saveAggregate(account);
  }

  private async withdrawMoney(command: WithdrawMoneyCommand): Promise<void> {
    const account = await this.loadAggregate(command.accountId);
    account.withdraw(command.amount, command.reason, command.reference);
    await this.saveAggregate(account);
  }

  private async loadAggregate(aggregateId: string): Promise<Account> {
    const { snapshot, events } = await this.snapshotManager.loadAggregate(aggregateId);
    
    if (snapshot) {
      const account = Account.fromSnapshot(aggregateId, snapshot.data);
      account.loadFromHistory(events);
      return account;
    }
    
    const allEvents = await this.eventStore.getEvents(aggregateId);
    return Account.fromEvents(aggregateId, allEvents);
  }

  private async saveAggregate(account: Account): Promise<void> {
    const events = account.getUncommittedEvents();
    
    await this.eventStore.append(
      account.getId(),
      events,
      account.getVersion() - events.length
    );

    account.markEventsAsCommitted();

    if (account.getVersion() % 100 === 0) {
      await this.snapshotManager.saveSnapshot(account);
    }
  }
}
```

## Aggregate Repository Pattern

```typescript
interface AggregateRepository<T extends AggregateRoot> {
  save(aggregate: T): Promise<void>;
  getById(id: string): Promise<T | null>;
  exists(id: string): Promise<boolean>;
}

class EventSourcedRepository<T extends AggregateRoot> implements AggregateRepository<T> {
  constructor(
    private readonly eventStore: EventStore,
    private readonly factory: (id: string, events: DomainEvent[]) => T
  ) {}

  async save(aggregate: T): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    await this.eventStore.append(
      aggregate.getId(), events, aggregate.getVersion() - events.length
    );
    aggregate.markEventsAsCommitted();
  }

  async getById(id: string): Promise<T | null> {
    if (!await this.eventStore.streamExists(id)) {
      return null;
    }

    const events = await this.eventStore.getEvents(id);
    return this.factory(id, events);
  }

  async exists(id: string): Promise<boolean> {
    return this.eventStore.streamExists(id);
  }
}
```