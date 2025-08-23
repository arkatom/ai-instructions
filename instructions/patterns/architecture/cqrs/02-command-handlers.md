# Command Handlers

## Command Bus Implementation

```typescript
interface CommandBus {
  send<T extends Command>(command: T): Promise<void>;
  register<T extends Command>(
    commandType: string,
    handler: CommandHandler<T>
  ): void;
}

class InMemoryCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private middleware: CommandMiddleware[] = [];

  register<T extends Command>(
    commandType: string,
    handler: CommandHandler<T>
  ): void {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for ${commandType}`);
    }
    this.handlers.set(commandType, handler);
  }

  async send<T extends Command>(command: T): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for ${command.type}`);
    }

    // Execute middleware pipeline
    const pipeline = this.buildPipeline(handler, command);
    await pipeline(command);
  }

  use(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  private buildPipeline(
    handler: CommandHandler<any>,
    command: Command
  ): (cmd: Command) => Promise<void> {
    let pipeline = (cmd: Command) => handler.handle(cmd);

    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const middleware = this.middleware[i];
      const next = pipeline;
      pipeline = (cmd: Command) => middleware.execute(cmd, next);
    }

    return pipeline;
  }
}
```

## Command Validation

```typescript
interface CommandValidator<T extends Command> {
  validate(command: T): ValidationResult;
}

class ValidationResult {
  constructor(
    public readonly isValid: boolean,
    public readonly errors: ValidationError[] = []
  ) {}

  static success(): ValidationResult {
    return new ValidationResult(true);
  }

  static failure(errors: ValidationError[]): ValidationResult {
    return new ValidationResult(false, errors);
  }
}

// Decorator-based validation
function ValidateCommand<T extends Command>(
  validator: CommandValidator<T>
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(command: T) {
      const validation = validator.validate(command);
      if (!validation.isValid) {
        throw new ValidationException(validation.errors);
      }
      return originalMethod.apply(this, [command]);
    };

    return descriptor;
  };
}

// Example validator
class CreateOrderValidator implements CommandValidator<CreateOrderCommand> {
  validate(command: CreateOrderCommand): ValidationResult {
    const errors: ValidationError[] = [];

    if (!command.customerId) {
      errors.push({
        field: 'customerId',
        message: 'Customer ID is required'
      });
    }

    if (!command.items || command.items.length === 0) {
      errors.push({
        field: 'items',
        message: 'Order must contain at least one item'
      });
    }

    command.items?.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push({
          field: `items[${index}].quantity`,
          message: 'Quantity must be positive'
        });
      }
      if (item.price < 0) {
        errors.push({
          field: `items[${index}].price`,
          message: 'Price cannot be negative'
        });
      }
    });

    return errors.length > 0 
      ? ValidationResult.failure(errors)
      : ValidationResult.success();
  }
}
```

## Middleware Patterns

```typescript
interface CommandMiddleware {
  execute(
    command: Command,
    next: (command: Command) => Promise<void>
  ): Promise<void>;
}

// Logging middleware
class LoggingMiddleware implements CommandMiddleware {
  constructor(private logger: Logger) {}

  async execute(
    command: Command,
    next: (command: Command) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info('Command received', {
      type: command.type,
      commandId: command.metadata.commandId,
      userId: command.metadata.userId
    });

    try {
      await next(command);
      
      this.logger.info('Command completed', {
        type: command.type,
        commandId: command.metadata.commandId,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.logger.error('Command failed', {
        type: command.type,
        commandId: command.metadata.commandId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
}

// Transaction middleware
class TransactionMiddleware implements CommandMiddleware {
  constructor(private transactionManager: TransactionManager) {}

  async execute(
    command: Command,
    next: (command: Command) => Promise<void>
  ): Promise<void> {
    await this.transactionManager.runInTransaction(async () => {
      await next(command);
    });
  }
}

// Authorization middleware
class AuthorizationMiddleware implements CommandMiddleware {
  constructor(private authorizer: Authorizer) {}

  async execute(
    command: Command,
    next: (command: Command) => Promise<void>
  ): Promise<void> {
    const isAuthorized = await this.authorizer.canExecute(
      command.metadata.userId,
      command.type
    );

    if (!isAuthorized) {
      throw new UnauthorizedException(
        `User ${command.metadata.userId} cannot execute ${command.type}`
      );
    }

    await next(command);
  }
}
```

## Advanced Handler Patterns

```typescript
// Saga-based handler
abstract class SagaCommandHandler<T extends Command> implements CommandHandler<T> {
  protected abstract steps: SagaStep<T>[];

  async handle(command: T): Promise<void> {
    const executedSteps: SagaStep<T>[] = [];

    try {
      for (const step of this.steps) {
        await step.execute(command);
        executedSteps.push(step);
      }
    } catch (error) {
      // Compensate in reverse order
      for (let i = executedSteps.length - 1; i >= 0; i--) {
        try {
          await executedSteps[i].compensate(command);
        } catch (compensationError) {
          console.error('Compensation failed:', compensationError);
        }
      }
      throw error;
    }
  }
}

// Retry handler decorator
class RetryableCommandHandler<T extends Command> implements CommandHandler<T> {
  constructor(
    private innerHandler: CommandHandler<T>,
    private maxRetries: number = 3,
    private retryDelay: number = 1000
  ) {}

  async handle(command: T): Promise<void> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.innerHandler.handle(command);
        return;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Command Dispatching Strategies

```typescript
// Async command processing
class AsyncCommandDispatcher {
  constructor(
    private queue: MessageQueue,
    private commandBus: CommandBus
  ) {}

  async dispatch(command: Command): Promise<void> {
    await this.queue.publish('commands', command);
  }

  async processCommands(): Promise<void> {
    await this.queue.subscribe('commands', async (command: Command) => {
      try {
        await this.commandBus.send(command);
      } catch (error) {
        await this.handleFailedCommand(command, error);
      }
    });
  }

  private async handleFailedCommand(command: Command, error: Error): Promise<void> {
    // Implement dead letter queue or retry logic
    await this.queue.publish('commands.dlq', {
      command,
      error: error.message,
      timestamp: new Date()
    });
  }
}
```

## Best Practices

1. **Single Responsibility**: Each handler should handle one command type
2. **Idempotency**: Ensure commands can be safely retried
3. **Validation**: Validate commands before processing
4. **Error Handling**: Implement comprehensive error handling and compensation
5. **Monitoring**: Track command execution metrics and failures
6. **Testing**: Unit test handlers in isolation