# Clean Architecture

## Core Principles

### Dependency Rule
Dependencies must point inward. Nothing in an inner circle can know anything about outer circles.

```typescript
// Good - Inner layer defines interface
// Domain Layer (inner)
interface UserRepository {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
}

// Infrastructure Layer (outer)
class PostgresUserRepository implements UserRepository {
  async findById(id: string): Promise<User> {
    // PostgreSQL specific implementation
  }
}

// Bad - Domain depends on infrastructure
class User {
  constructor(private db: PostgreSQLConnection) {} // Wrong!
}
```

## Layer Structure

### 1. Entities (Domain)
Business rules that don't change when external things change.

```typescript
// Good - Pure business logic
class Order {
  private items: OrderItem[] = [];
  
  addItem(product: Product, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    this.items.push(new OrderItem(product, quantity));
  }
  
  calculateTotal(): number {
    return this.items.reduce((sum, item) => sum + item.getSubtotal(), 0);
  }
}
```

### 2. Use Cases (Application)
Application-specific business rules. Orchestrates data flow between entities.

```typescript
// Good - Use case orchestration
class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private emailService: EmailService
  ) {}
  
  async execute(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const products = await this.productRepo.findByIds(request.productIds);
    
    const order = new Order(request.customerId);
    for (const item of request.items) {
      const product = products.find(p => p.id === item.productId);
      order.addItem(product, item.quantity);
    }
    
    await this.orderRepo.save(order);
    await this.emailService.sendOrderConfirmation(order);
    
    return { orderId: order.id, total: order.calculateTotal() };
  }
}
```

### 3. Interface Adapters
Convert data between use cases and external agencies.

```typescript
// Good - Controller adapter
class OrderController {
  constructor(private createOrderUseCase: CreateOrderUseCase) {}
  
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const request = this.mapToUseCaseRequest(req.body);
      const response = await this.createOrderUseCase.execute(request);
      res.json(this.mapToHttpResponse(response));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  private mapToUseCaseRequest(body: any): CreateOrderRequest {
    // Map HTTP request to use case request
  }
}
```

### 4. Frameworks & Drivers
External details like databases, web frameworks, UI.

```typescript
// Good - Infrastructure implementation
class ExpressServer {
  private app: Express;
  
  constructor(private orderController: OrderController) {
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    this.app.post('/orders', (req, res) => 
      this.orderController.createOrder(req, res)
    );
  }
  
  start(port: number): void {
    this.app.listen(port);
  }
}
```

## Dependency Injection

### Constructor Injection
Wire dependencies from outside-in.

```typescript
// Good - Dependencies injected from outer layers
// Composition root (main)
const database = new PostgreSQLDatabase(config.db);
const orderRepo = new PostgresOrderRepository(database);
const productRepo = new PostgresProductRepository(database);
const emailService = new SendGridEmailService(config.sendgrid);

const createOrderUseCase = new CreateOrderUseCase(
  orderRepo,
  productRepo,
  emailService
);

const orderController = new OrderController(createOrderUseCase);
const server = new ExpressServer(orderController);
server.start(3000);
```

## Testing Strategy

### Test Each Layer Independently
```typescript
// Domain layer test - no external dependencies
describe('Order', () => {
  it('should calculate total correctly', () => {
    const order = new Order('customer123');
    const product = new Product('prod1', 'Widget', 10.00);
    order.addItem(product, 2);
    
    expect(order.calculateTotal()).toBe(20.00);
  });
});

// Use case test - mock repositories
describe('CreateOrderUseCase', () => {
  it('should create order and send email', async () => {
    const mockOrderRepo = { save: jest.fn() };
    const mockEmailService = { sendOrderConfirmation: jest.fn() };
    
    const useCase = new CreateOrderUseCase(
      mockOrderRepo,
      mockProductRepo,
      mockEmailService
    );
    
    await useCase.execute(request);
    
    expect(mockOrderRepo.save).toHaveBeenCalled();
    expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalled();
  });
});
```

## Common Patterns

### Repository Pattern
Abstracts data persistence.

```typescript
// Domain defines interface
interface Repository<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Infrastructure implements
class MongoUserRepository implements Repository<User> {
  // MongoDB specific implementation
}
```

### Presenter Pattern
Formats use case output.

```typescript
interface Presenter<T> {
  present(data: T): void;
}

class JsonOrderPresenter implements Presenter<Order> {
  present(order: Order): string {
    return JSON.stringify({
      id: order.id,
      total: order.calculateTotal(),
      items: order.items.map(item => ({
        product: item.product.name,
        quantity: item.quantity
      }))
    });
  }
}
```

## Best Practices Checklist

- [ ] Dependencies point inward only
- [ ] Domain entities have no external dependencies
- [ ] Use cases orchestrate but don't implement business logic
- [ ] Interfaces defined in inner layers, implemented in outer
- [ ] Database/framework details isolated to outer layer
- [ ] Each layer is independently testable
- [ ] Use dependency injection for wiring
- [ ] Keep frameworks at arm's length
- [ ] Defer decisions about databases, frameworks
- [ ] Test business rules without UI, database, or external services