# Event Projections and Read Models

## Projection Base Class

```typescript
export abstract class Projection {
  abstract readonly projectionName: string;
  abstract readonly subscribedEvents: string[];
  abstract handle(event: DomainEvent): Promise<void>;

  canHandle(event: DomainEvent): boolean {
    return this.subscribedEvents.includes(event.eventType);
  }
}
```

## Account Balance Projection

```typescript
export class AccountBalanceProjection extends Projection {
  readonly projectionName = 'AccountBalance';
  readonly subscribedEvents = [
    'AccountCreated', 'MoneyDeposited', 
    'MoneyWithdrawn', 'AccountClosed'
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
    `);
  }

  async handle(event: DomainEvent): Promise<void> {
    const handlers: Record<string, () => Promise<void>> = {
      'AccountCreated': () => this.handleAccountCreated(event),
      'MoneyDeposited': () => this.handleMoneyDeposited(event),
      'MoneyWithdrawn': () => this.handleMoneyWithdrawn(event),
      'AccountClosed': () => this.handleAccountClosed(event)
    };

    await handlers[event.eventType]?.();
  }

  private async handleAccountCreated(event: DomainEvent): Promise<void> {
    const { accountNumber, accountHolder, initialBalance, currency, accountType } = event.payload;
    await this.pool.query(
      `INSERT INTO account_balances (
        account_id, account_number, account_holder, balance, currency, 
        account_type, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [event.aggregateId, accountNumber, accountHolder, initialBalance, 
       currency, accountType, event.occurredAt, event.occurredAt]
    );
  }

  private async handleMoneyDeposited(event: DomainEvent): Promise<void> {
    await this.pool.query(
      `UPDATE account_balances SET balance = balance + $1, 
       last_transaction_date = $2, updated_at = $3 WHERE account_id = $4`,
      [event.payload.amount, event.occurredAt, new Date(), event.aggregateId]
    );
  }

  private async handleMoneyWithdrawn(event: DomainEvent): Promise<void> {
    await this.pool.query(
      `UPDATE account_balances SET balance = balance - $1,
       last_transaction_date = $2, updated_at = $3 WHERE account_id = $4`,
      [event.payload.amount, event.occurredAt, new Date(), event.aggregateId]
    );
  }

  private async handleAccountClosed(event: DomainEvent): Promise<void> {
    await this.pool.query(
      `UPDATE account_balances SET is_closed = TRUE, updated_at = $1 WHERE account_id = $2`,
      [new Date(), event.aggregateId]
    );
  }
}
```

## Projection Manager

```typescript
export class ProjectionManager {
  private projections: Projection[] = [];
  private isRunning = false;

  constructor(
    private readonly eventStore: EventStore,
    private readonly checkpointStore: CheckpointStore
  ) {}

  registerProjection(projection: Projection): void {
    this.projections.push(projection);
  }

  async start(): Promise<void> {
    this.isRunning = true;
    for (const projection of this.projections) {
      this.startProjection(projection);
    }
  }

  private async startProjection(projection: Projection): Promise<void> {
    const checkpoint = await this.checkpointStore.getCheckpoint(projection.projectionName);
    let position = checkpoint?.position || 0;

    while (this.isRunning) {
      const events = await this.eventStore.getAllEvents(position, 100);
      
      for (const event of events) {
        if (projection.canHandle(event)) {
          try {
            await projection.handle(event);
            position = (event as any).id;
            
            if (position % 10 === 0) {
              await this.checkpointStore.saveCheckpoint(projection.projectionName, position);
            }
          } catch (error) {
            console.error(`Projection error:`, error);
          }
        }
      }

      if (events.length === 0) await this.sleep(1000);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## CQRS Query Models

```typescript
export class AccountQueryService {
  constructor(private readonly pool: Pool) {}

  async getAccountById(accountId: string): Promise<AccountReadModel> {
    const result = await this.pool.query(
      `SELECT * FROM account_balances WHERE account_id = $1`,
      [accountId]
    );
    if (result.rows.length === 0) throw new Error('Account not found');
    return this.mapToReadModel(result.rows[0]);
  }

  async getTransactionHistory(
    accountId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<TransactionReadModel[]> {
    let query = `SELECT * FROM transaction_history WHERE account_id = $1`;
    const params: any[] = [accountId];

    if (fromDate) {
      query += ` AND occurred_at >= $${params.length + 1}`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND occurred_at <= $${params.length + 1}`;
      params.push(toDate);
    }
    query += ` ORDER BY occurred_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapToTransactionModel(row));
  }

  private mapToReadModel(row: any): AccountReadModel {
    return {
      accountId: row.account_id, accountNumber: row.account_number,
      accountHolder: row.account_holder, balance: parseFloat(row.balance),
      currency: row.currency, accountType: row.account_type,
      isFrozen: row.is_frozen, isClosed: row.is_closed,
      lastTransactionDate: row.last_transaction_date,
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapToTransactionModel(row: any): TransactionReadModel {
    return {
      id: row.id, accountId: row.account_id, type: row.transaction_type,
      amount: parseFloat(row.amount), currency: row.currency,
      reference: row.reference, description: row.description,
      balanceAfter: parseFloat(row.balance_after), occurredAt: row.occurred_at
    };
  }
}
```

## Projection Rebuilding

```typescript
export class ProjectionRebuilder {
  constructor(
    private readonly eventStore: EventStore,
    private readonly pool: Pool
  ) {}

  async rebuild(projection: Projection): Promise<void> {
    await this.clearProjectionData(projection.projectionName);
    await this.resetCheckpoint(projection.projectionName);
    let position = 0;
    const batchSize = 1000;
    while (true) {
      const events = await this.eventStore.getAllEvents(position, batchSize);
      if (events.length === 0) break;
      
      for (const event of events) {
        if (projection.canHandle(event)) await projection.handle(event);
        position = (event as any).id;
      }
    }
  }

  private async clearProjectionData(projectionName: string): Promise<void> {
    const tables = { 'AccountBalance': 'account_balances', 'TransactionHistory': 'transaction_history' };
    const table = tables[projectionName as keyof typeof tables];
    if (table) await this.pool.query(`TRUNCATE TABLE ${table}`);
  }

  private async resetCheckpoint(projectionName: string): Promise<void> {
    await this.pool.query(`DELETE FROM projection_checkpoints WHERE projection_name = $1`, [projectionName]);
  }
}
```