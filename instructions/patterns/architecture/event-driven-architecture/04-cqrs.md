# CQRS (Command Query Responsibility Segregation)

## Command Side Implementation

```typescript
export interface Command {
  id: string;
  aggregateId: string;
  timestamp: Date;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();

  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void {
    this.handlers.set(commandType, handler);
  }

  async dispatch(command: Command): Promise<void> {
    const commandType = command.constructor.name;
    const handler = this.handlers.get(commandType);
    
    if (!handler) {
      throw new Error(`No handler registered for command: ${commandType}`);
    }
    
    await handler.handle(command);
  }
}

// Example Commands
export class RegisterUserCommand implements Command {
  id = crypto.randomUUID();
  timestamp = new Date();
  
  constructor(
    public aggregateId: string,
    public email: string,
    public firstName: string,
    public lastName: string,
    public registrationSource: string
  ) {}
}

export class UpdateUserProfileCommand implements Command {
  id = crypto.randomUUID();
  timestamp = new Date();
  
  constructor(
    public aggregateId: string,
    public email?: string,
    public firstName?: string,
    public lastName?: string
  ) {}
}
```

## Query Side Implementation

```typescript
export interface QueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export class QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();

  register<TQuery, TResult>(queryType: string, handler: QueryHandler<TQuery, TResult>): void {
    this.handlers.set(queryType, handler);
  }

  async execute<TResult>(query: any): Promise<TResult> {
    const queryType = query.constructor.name;
    const handler = this.handlers.get(queryType);
    
    if (!handler) {
      throw new Error(`No handler registered for query: ${queryType}`);
    }
    
    return await handler.handle(query);
  }
}

// Example Queries
export class GetUserByIdQuery {
  constructor(public userId: string) {}
}

export class GetUsersByEmailQuery {
  constructor(public email: string) {}
}

export class GetActiveUsersQuery {
  constructor(
    public limit: number = 50,
    public offset: number = 0
  ) {}
}
```

## Read Model Implementation

```typescript
export interface UserReadModel {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  registeredAt: Date;
  lastUpdated: Date;
}

export class UserQueryHandler implements 
  QueryHandler<GetUserByIdQuery, UserReadModel | null>,
  QueryHandler<GetUsersByEmailQuery, UserReadModel[]>,
  QueryHandler<GetActiveUsersQuery, UserReadModel[]> {
  
  constructor(private db: Db) {}

  async handle(query: GetUserByIdQuery | GetUsersByEmailQuery | GetActiveUsersQuery): Promise<any> {
    if (query instanceof GetUserByIdQuery) {
      return await this.getUserById(query);
    } else if (query instanceof GetUsersByEmailQuery) {
      return await this.getUsersByEmail(query);
    } else if (query instanceof GetActiveUsersQuery) {
      return await this.getActiveUsers(query);
    }
  }

  private async getUserById(query: GetUserByIdQuery): Promise<UserReadModel | null> {
    const user = await this.db.collection('user_views').findOne({ id: query.userId });
    return user ? this.mapToReadModel(user) : null;
  }

  private async getUsersByEmail(query: GetUsersByEmailQuery): Promise<UserReadModel[]> {
    const users = await this.db.collection('user_views')
      .find({ email: new RegExp(query.email, 'i') })
      .toArray();
    return users.map(this.mapToReadModel);
  }

  private async getActiveUsers(query: GetActiveUsersQuery): Promise<UserReadModel[]> {
    const users = await this.db.collection('user_views')
      .find({ isActive: true })
      .skip(query.offset)
      .limit(query.limit)
      .toArray();
    return users.map(this.mapToReadModel);
  }

  private mapToReadModel(doc: any): UserReadModel {
    return {
      id: doc.id,
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
      isActive: doc.isActive,
      registeredAt: doc.registeredAt,
      lastUpdated: doc.lastUpdated
    };
  }
}
```

## Command Handler Implementation

```typescript
export class UserCommandHandler implements 
  CommandHandler<RegisterUserCommand>,
  CommandHandler<UpdateUserProfileCommand> {
  
  constructor(
    private repository: EventSourcedRepository<UserAggregate>,
    private eventBus: EventBus
  ) {}

  async handle(command: RegisterUserCommand | UpdateUserProfileCommand): Promise<void> {
    if (command instanceof RegisterUserCommand) {
      await this.handleRegisterUser(command);
    } else if (command instanceof UpdateUserProfileCommand) {
      await this.handleUpdateUserProfile(command);
    }
  }

  private async handleRegisterUser(command: RegisterUserCommand): Promise<void> {
    const existingUser = await this.repository.getById(command.aggregateId);
    if (existingUser) throw new Error('User already exists');

    const user = UserAggregate.register(
      command.aggregateId, command.email, command.firstName, 
      command.lastName, command.registrationSource
    );

    await this.repository.save(user);
    
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }

  private async handleUpdateUserProfile(command: UpdateUserProfileCommand): Promise<void> {
    const user = await this.repository.getById(command.aggregateId);
    if (!user) {
      throw new Error('User not found');
    }

    user.updateProfile(command.email, command.firstName, command.lastName);
    await this.repository.save(user);
    
    // Publish events
    const events = user.getUncommittedEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }
}
```

## CQRS Patterns

```yaml
patterns:
  separate_models:
    write: "Domain aggregates optimized for consistency"
    read: "Denormalized views optimized for queries"
  eventual_consistency:
    write: "Commands processed immediately" 
    read: "Views updated asynchronously via events"
  polyglot_persistence:
    write: "Event store (MongoDB, PostgreSQL)"
    read: "Optimized stores (Redis, Elasticsearch)"
benefits:
  - Scale read and write independently
  - Optimized models for each use case
  - Different storage technologies
challenges:
  - More moving parts and complexity
  - Eventual consistency model
  - Keeping read models synchronized
```