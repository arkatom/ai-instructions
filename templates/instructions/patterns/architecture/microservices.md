# Microservices Architecture

Distributed systems and microservices patterns.

## Service Design

### Domain Boundaries
```yaml
services:
  user-service:
    responsibilities:
      - User authentication
      - Profile management
    database: PostgreSQL
    
  order-service:
    responsibilities:
      - Order processing
      - Inventory management
    database: MongoDB
    
  payment-service:
    responsibilities:
      - Payment processing
      - Billing management
    database: PostgreSQL
```

### API Gateway
```typescript
const gateway = express();

// Routing
gateway.use('/api/users', 
  createProxyMiddleware({
    target: 'http://user-service:3001'
  })
);

gateway.use('/api/orders',
  createProxyMiddleware({
    target: 'http://order-service:3002'
  })
);

// Authentication
gateway.use(authMiddleware);
```

## Service Communication

### REST API
```typescript
class OrderService {
  async createOrder(orderData) {
    // Validate user
    const user = await fetch(`http://user-service/users/${orderData.userId}`);
    if (!user.ok) throw new Error('User not found');
    
    // Check inventory
    const inventory = await fetch(`http://inventory-service/check`, {
      method: 'POST',
      body: JSON.stringify(orderData.items)
    });
    
    // Create order
    return await this.orderRepository.create(orderData);
  }
}
```

### Message Queue
```typescript
const amqp = require('amqplib');

// Publisher
async function publishOrder(order) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  
  await channel.assertQueue('orders');
  channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)));
}

// Subscriber
async function consumeOrders() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  
  await channel.assertQueue('orders');
  channel.consume('orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    processOrder(order);
    channel.ack(msg);
  });
}
```

## Data Management

### Database per Service
```typescript
// user-service/db.ts
const userDB = new PrismaClient({
  datasources: { db: { url: process.env.USER_DB_URL } }
});

// order-service/db.ts
const orderDB = new MongoClient(process.env.ORDER_DB_URL);
```

### Saga Pattern
```typescript
class OrderSaga {
  async execute(order) {
    const steps = [
      { service: 'payment', action: 'reserve', compensate: 'cancel' },
      { service: 'inventory', action: 'reserve', compensate: 'release' },
      { service: 'shipping', action: 'schedule', compensate: 'cancel' }
    ];
    
    const executed = [];
    
    try {
      for (const step of steps) {
        await this.executeStep(step, order);
        executed.push(step);
      }
    } catch (error) {
      // Rollback
      for (const step of executed.reverse()) {
        await this.compensate(step, order);
      }
      throw error;
    }
  }
}
```

## Resilience

### Circuit Breaker
```typescript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
  
  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### Retry with Backoff
```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Checklist
- [ ] Service boundaries defined
- [ ] API Gateway implemented
- [ ] Communication strategy
- [ ] Data consistency handled
- [ ] Service discovery
- [ ] Fault tolerance
- [ ] Monitoring/Logging