# Testing, Deployment & Operations

> 🎯 **目的**: 包括的テスト戦略とproduction ready運用設計
> 
> 📊 **対象**: 単体/統合テスト、デプロイ自動化、監視・運用
> 
> ⚡ **特徴**: 契約ベーステスト、継続的デプロイ、可観測性

## テスト戦略

### 単体テスト（Domain Layer）

```typescript
// tests/unit/domain/Order.test.ts
import { Order, OrderId, OrderItem, Money, OrderStatus } from '../../../src/domain/models/Order';

describe('Order Domain Model', () => {
  let order: Order;

  beforeEach(() => {
    order = new Order(
      new OrderId('ORD-001'),
      'CUST-001'
    );
  });

  describe('Business Rule Validation', () => {
    it('should add item to pending order', () => {
      const item = new OrderItem(
        'PROD-001',
        'Product 1',
        new Money(10.99, 'USD'),
        2
      );

      order.addItem(item);

      expect(order.getItems()).toHaveLength(1);
      expect(order.getItems()[0].getProductId()).toBe('PROD-001');
      expect(order.getTotalAmount().getAmount()).toBe(21.98);
    });

    it('should prevent modification of confirmed order', () => {
      const item = new OrderItem('PROD-001', 'Product 1', new Money(10, 'USD'), 1);
      order.addItem(item);
      order.confirm();

      expect(() => order.addItem(item)).toThrow('Cannot modify confirmed order');
      expect(() => order.removeItem('PROD-001')).toThrow('Cannot modify confirmed order');
    });

    it('should enforce valid state transitions', () => {
      const item = new OrderItem('PROD-001', 'Product 1', new Money(10, 'USD'), 1);
      order.addItem(item);

      // Valid transitions
      expect(() => order.confirm()).not.toThrow();
      expect(order.getStatus()).toBe(OrderStatus.CONFIRMED);
      
      expect(() => order.ship()).not.toThrow();
      expect(order.getStatus()).toBe(OrderStatus.SHIPPED);
      
      expect(() => order.deliver()).not.toThrow();
      expect(order.getStatus()).toBe(OrderStatus.DELIVERED);

      // Invalid transition
      expect(() => order.cancel()).toThrow('Cannot cancel delivered order');
    });

    it('should calculate total with multiple currencies error', () => {
      order.addItem(new OrderItem('PROD-001', 'Product 1', new Money(10, 'USD'), 1));
      
      expect(() => {
        order.addItem(new OrderItem('PROD-002', 'Product 2', new Money(15, 'EUR'), 1));
      }).toThrow('Cannot add different currencies');
    });
  });

  describe('Value Objects Immutability', () => {
    it('should maintain Money immutability', () => {
      const money1 = new Money(10, 'USD');
      const money2 = money1.add(new Money(5, 'USD'));
      
      expect(money1.getAmount()).toBe(10);
      expect(money2.getAmount()).toBe(15);
    });

    it('should enforce OrderId validation', () => {
      expect(() => new OrderId('')).toThrow('OrderId cannot be empty');
      expect(() => new OrderId('invalid chars!')).toThrow('OrderId contains invalid characters');
    });
  });
});
```

### ポート契約テスト（Port Contract Testing）

```typescript
// tests/contracts/OrderRepositoryContract.test.ts
import { OrderRepository } from '../../src/application/ports/secondary/OrderRepository';
import { Order, OrderId, OrderItem, Money } from '../../src/domain/models/Order';

// 全ての Repository 実装が満たすべき契約テスト
export function testOrderRepositoryContract(
  description: string,
  createRepository: () => Promise<OrderRepository>,
  cleanup?: () => Promise<void>
) {
  describe(`OrderRepository Contract: ${description}`, () => {
    let repository: OrderRepository;

    beforeEach(async () => {
      repository = await createRepository();
    });

    afterEach(async () => {
      if (cleanup) await cleanup();
    });

    describe('Basic CRUD Operations', () => {
      it('should save and retrieve order by ID', async () => {
        const order = createTestOrder();
        
        await repository.save(order);
        const retrieved = await repository.findById(order.getId());
        
        expect(retrieved).toBeDefined();
        expect(retrieved!.getId().toString()).toBe(order.getId().toString());
        expect(retrieved!.getCustomerId()).toBe(order.getCustomerId());
        expect(retrieved!.getStatus()).toBe(order.getStatus());
      });

      it('should return null for non-existent order', async () => {
        const result = await repository.findById(new OrderId('NON-EXISTENT'));
        expect(result).toBeNull();
      });

      it('should update existing order', async () => {
        const order = createTestOrder();
        await repository.save(order);
        
        order.confirm();
        await repository.update(order);
        
        const updated = await repository.findById(order.getId());
        expect(updated!.getStatus()).toBe('CONFIRMED');
      });

      it('should find orders by customer ID', async () => {
        const customerId = 'CUST-123';
        const order1 = new Order(new OrderId('ORD-001'), customerId);
        const order2 = new Order(new OrderId('ORD-002'), customerId);
        
        await repository.save(order1);
        await repository.save(order2);
        
        const customerOrders = await repository.findByCustomerId(customerId);
        expect(customerOrders).toHaveLength(2);
        expect(customerOrders.map(o => o.getId().toString())).toContain('ORD-001');
        expect(customerOrders.map(o => o.getId().toString())).toContain('ORD-002');
      });
    });

    describe('Complex Queries', () => {
      it('should find orders by status', async () => {
        const pendingOrder = createTestOrder();
        const confirmedOrder = createTestOrder();
        confirmedOrder.addItem(new OrderItem('PROD', 'Product', new Money(10, 'USD'), 1));
        confirmedOrder.confirm();
        
        await repository.save(pendingOrder);
        await repository.save(confirmedOrder);
        
        const confirmedOrders = await repository.findByStatus('CONFIRMED');
        expect(confirmedOrders).toHaveLength(1);
        expect(confirmedOrders[0].getStatus()).toBe('CONFIRMED');
      });

      it('should generate unique IDs', async () => {
        const id1 = await repository.nextId();
        const id2 = await repository.nextId();
        
        expect(id1.toString()).not.toBe(id2.toString());
        expect(id1.toString()).toMatch(/^ORD-/);
        expect(id2.toString()).toMatch(/^ORD-/);
      });
    });

    describe('Error Handling', () => {
      it('should handle concurrent modifications gracefully', async () => {
        const order = createTestOrder();
        await repository.save(order);
        
        // Simulate concurrent modifications
        const order1 = await repository.findById(order.getId());
        const order2 = await repository.findById(order.getId());
        
        order1!.addItem(new OrderItem('PROD1', 'Product 1', new Money(10, 'USD'), 1));
        order2!.addItem(new OrderItem('PROD2', 'Product 2', new Money(20, 'USD'), 1));
        
        await repository.update(order1!);
        
        // Second update should either succeed or throw specific error
        try {
          await repository.update(order2!);
        } catch (error) {
          expect(error).toBeDefined();
          // Verify specific error type if needed
        }
      });
    });

    function createTestOrder(): Order {
      return new Order(
        new OrderId(`ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        'CUST-TEST'
      );
    }
  });
}

// 具体的なアダプター実装のテスト
describe('Repository Implementations', () => {
  // PostgreSQL 実装のテスト
  testOrderRepositoryContract(
    'PostgreSQL Implementation',
    async () => new PostgreSQLOrderRepository(testPool),
    async () => {
      await testPool.query('DELETE FROM order_items');
      await testPool.query('DELETE FROM orders');
    }
  );

  // In-Memory 実装のテスト（開発・テスト用）
  testOrderRepositoryContract(
    'InMemory Implementation',
    async () => new InMemoryOrderRepository()
  );
});
```

### 統合テスト（Integration Testing）

```typescript
// tests/integration/OrderService.integration.test.ts
import { Container } from 'inversify';
import { OrderService } from '../../src/application/services/OrderService';
import { createTestContainer } from '../helpers/TestContainer';

describe('OrderService Integration Tests', () => {
  let container: Container;
  let orderService: OrderService;

  beforeEach(() => {
    container = createTestContainer();
    orderService = container.get<OrderService>('OrderUseCases');
  });

  describe('Complete Order Workflow', () => {
    it('should complete full order lifecycle', async () => {
      // 1. Create order
      const createCommand = {
        customerId: 'CUST-001',
        items: [
          { productId: 'PROD-001', quantity: 2 },
          { productId: 'PROD-002', quantity: 1 }
        ]
      };

      const createdOrder = await orderService.createOrder(createCommand);
      expect(createdOrder.status).toBe('PENDING');
      expect(createdOrder.items).toHaveLength(2);

      // 2. Confirm order
      const confirmedOrder = await orderService.confirmOrder(createdOrder.id);
      expect(confirmedOrder.status).toBe('CONFIRMED');

      // 3. Ship order
      const shippedOrder = await orderService.shipOrder(createdOrder.id);
      expect(shippedOrder.status).toBe('SHIPPED');

      // 4. Deliver order
      const deliveredOrder = await orderService.deliverOrder(createdOrder.id);
      expect(deliveredOrder.status).toBe('DELIVERED');

      // Verify final state
      const finalOrder = await orderService.getOrder(createdOrder.id);
      expect(finalOrder.status).toBe('DELIVERED');
    });

    it('should handle order cancellation with refund', async () => {
      const createCommand = {
        customerId: 'CUST-002',
        items: [{ productId: 'PROD-001', quantity: 1 }]
      };

      const order = await orderService.createOrder(createCommand);
      const confirmedOrder = await orderService.confirmOrder(order.id);

      // Cancel confirmed order (should trigger refund)
      const cancelledOrder = await orderService.cancelOrder(confirmedOrder.id, 'Customer request');
      expect(cancelledOrder.status).toBe('CANCELLED');

      // Verify refund was processed (check mock payment gateway)
      const paymentGateway = container.get('PaymentGateway');
      expect(paymentGateway.refundPayment).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle product not found error', async () => {
      const command = {
        customerId: 'CUST-001',
        items: [{ productId: 'NON-EXISTENT', quantity: 1 }]
      };

      await expect(orderService.createOrder(command)).rejects.toThrow('Some products not found');
    });

    it('should handle insufficient inventory', async () => {
      const command = {
        customerId: 'CUST-001',
        items: [{ productId: 'OUT-OF-STOCK', quantity: 100 }]
      };

      await expect(orderService.createOrder(command)).rejects.toThrow('not available in quantity');
    });

    it('should rollback on payment failure', async () => {
      const createCommand = {
        customerId: 'CUST-001',
        items: [{ productId: 'PROD-001', quantity: 1 }]
      };

      const order = await orderService.createOrder(createCommand);
      
      // Configure payment gateway to fail
      const paymentGateway = container.get('PaymentGateway');
      paymentGateway.processPayment.mockResolvedValueOnce({
        success: false,
        error: 'Payment declined'
      });

      await expect(orderService.confirmOrder(order.id)).rejects.toThrow('Payment failed');
      
      // Verify order status remains pending
      const failedOrder = await orderService.getOrder(order.id);
      expect(failedOrder.status).toBe('PENDING');
    });
  });
});
```

## End-to-End テスト

### API End-to-End テスト

```typescript
// tests/e2e/api/orders.e2e.test.ts
import request from 'supertest';
import { createTestApp } from '../helpers/TestApp';
import { createTestDatabase } from '../helpers/TestDatabase';

describe('Orders API E2E Tests', () => {
  let app: any;
  let database: any;
  let authToken: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    app = await createTestApp(database);
    authToken = await getAuthToken();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  describe('POST /api/orders', () => {
    it('should create new order successfully', async () => {
      const orderData = {
        items: [
          { productId: 'PROD-001', quantity: 2 },
          { productId: 'PROD-002', quantity: 1 }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.items).toHaveLength(2);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('items');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/orders')
        .send({ items: [] })
        .expect(401);
    });
  });

  describe('Order Lifecycle API Flow', () => {
    it('should complete full order flow via API', async () => {
      // Create order
      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: 'PROD-001', quantity: 1 }] })
        .expect(201);

      const orderId = createResponse.body.data.id;

      // Confirm order
      await request(app)
        .post(`/api/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Ship order
      await request(app)
        .post(`/api/orders/${orderId}/ship`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get final order state
      const finalResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalResponse.body.data.status).toBe('SHIPPED');
    });
  });

  async function getAuthToken(): Promise<string> {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });
    
    return response.body.token;
  }
});
```

## デプロイメント設定

### Docker化

```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine AS runtime

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy dependencies and built application
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --chown=nextjs:nodejs package*.json ./

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### Docker Compose（開発環境）

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:password@postgres:5432/orders_dev
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: orders_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass password
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "password", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  test-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: orders_test
    ports:
      - "5433:5432"
    volumes:
      - ./database/migrations:/docker-entrypoint-initdb.d
    networks:
      - app-network

volumes:
  postgres_dev_data:
  redis_dev_data:

networks:
  app-network:
    driver: bridge
```

### Kubernetes デプロイメント

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
      - name: order-service
        image: myregistry/order-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false

---
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: production
spec:
  selector:
    app: order-service
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-service-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.orders.company.com
    secretName: order-service-tls
  rules:
  - host: api.orders.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 80
```

## 監視・可観測性

### Health Checks実装

```typescript
// src/infrastructure/health/HealthCheckService.ts
export interface HealthCheck {
  name: string;
  check(): Promise<HealthStatus>;
  critical?: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
}

@injectable()
export class HealthCheckService {
  constructor(
    @multiInject('HealthCheck') private readonly checks: HealthCheck[]
  ) {}

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: Record<string, HealthStatus>;
    version: string;
  }> {
    const startTime = Date.now();
    const results: Record<string, HealthStatus> = {};
    let overallHealthy = true;

    // Run all health checks in parallel
    await Promise.allSettled(
      this.checks.map(async (check) => {
        const checkStartTime = Date.now();
        try {
          const result = await Promise.race([
            check.check(),
            this.timeoutPromise(10000) // 10s timeout
          ]);
          
          results[check.name] = {
            ...result,
            responseTime: Date.now() - checkStartTime
          };

          if (!result.healthy && (check.critical !== false)) {
            overallHealthy = false;
          }
        } catch (error: any) {
          results[check.name] = {
            healthy: false,
            message: error.message,
            responseTime: Date.now() - checkStartTime
          };
          if (check.critical !== false) {
            overallHealthy = false;
          }
        }
      })
    );

    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: results,
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  private timeoutPromise(timeout: number): Promise<HealthStatus> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });
  }
}

// 具体的なヘルスチェック実装
@injectable()
export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';
  critical = true;

  constructor(@inject('DatabasePool') private pool: Pool) {}

  async check(): Promise<HealthStatus> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT 1 as health_check');
      client.release();

      const connectionCount = this.pool.totalCount;
      const idleCount = this.pool.idleCount;

      return {
        healthy: true,
        message: 'Database connection successful',
        details: {
          totalConnections: connectionCount,
          idleConnections: idleCount,
          busyConnections: connectionCount - idleCount
        }
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Database connection failed: ${error.message}`
      };
    }
  }
}

@injectable()
export class ExternalServiceHealthCheck implements HealthCheck {
  name = 'product-catalog';
  critical = false; // Non-critical service

  constructor(@inject('ProductCatalog') private productCatalog: ProductCatalog) {}

  async check(): Promise<HealthStatus> {
    try {
      // Try to fetch a known product
      await this.productCatalog.getProduct('health-check-product');
      return {
        healthy: true,
        message: 'Product catalog service accessible'
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Product catalog unavailable: ${error.message}`
      };
    }
  }
}
```

### メトリクス収集

```typescript
// src/infrastructure/metrics/MetricsService.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

@injectable()
export class MetricsService {
  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0]
  });

  private readonly ordersTotal = new Counter({
    name: 'orders_total',
    help: 'Total orders created',
    labelNames: ['status']
  });

  private readonly activeOrders = new Gauge({
    name: 'active_orders',
    help: 'Current number of active orders'
  });

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    this.httpRequestDuration.labels(method, route).observe(duration);
  }

  recordOrderCreated(status: string): void {
    this.ordersTotal.labels(status).inc();
  }

  updateActiveOrdersCount(count: number): void {
    this.activeOrders.set(count);
  }

  getMetrics(): string {
    return register.metrics();
  }
}

// Express middleware for metrics
export function metricsMiddleware(metricsService: MetricsService) {
  return (req: Request, res: Response, next: Function) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
    });
    
    next();
  };
}
```

### ログ設定

```typescript
// src/infrastructure/logging/Logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        service: 'order-service',
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV,
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Structured logging helper
export class StructuredLogger {
  static logOrderEvent(event: string, orderId: string, details?: any): void {
    logger.info('Order event', {
      event,
      orderId,
      ...details
    });
  }

  static logPerformance(operation: string, duration: number, details?: any): void {
    logger.info('Performance metric', {
      operation,
      duration,
      ...details
    });
  }

  static logError(error: Error, context?: any): void {
    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
}
```

**実運用での要点**:
- 包括的テスト（単体→統合→E2E）
- 契約ベーステスト（ポート実装の互換性保証）
- Infrastructure as Code（Docker、K8s）
- 可観測性（ヘルスチェック、メトリクス、ログ）
- 段階的デプロイメント（Blue-Green、Canary）

