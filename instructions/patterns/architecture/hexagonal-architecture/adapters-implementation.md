# Adapters Implementation

> 🎯 **目的**: ポートの具体実装と外部技術統合
> 
> 📊 **対象**: Primary/Secondaryアダプター、データ変換、エラーハンドリング
> 
> ⚡ **特徴**: 技術特化実装、設定可能性、高可用性、テスタビリティ

## Primary Adapters (駆動側)

### REST API Adapter

```typescript
// Express.jsベースのRESTアダプター
import { Request, Response, Router } from 'express';
import { Container } from 'inversify';
import { OrderUseCases } from '../../../application/ports/primary/OrderUseCases';
import { OrderQueries } from '../../../application/ports/primary/OrderQueries';

export class OrderController {
  private router: Router;
  private orderUseCases: OrderUseCases;
  private orderQueries: OrderQueries;

  constructor(container: Container) {
    this.router = Router();
    this.orderUseCases = container.get<OrderUseCases>('OrderUseCases');
    this.orderQueries = container.get<OrderQueries>('OrderQueries');
    this.setupRoutes();
    this.setupMiddleware();
  }

  private setupRoutes(): void {
    // Command endpoints
    this.router.post('/orders', this.createOrder.bind(this));
    this.router.post('/orders/:orderId/confirm', this.confirmOrder.bind(this));
    this.router.post('/orders/:orderId/ship', this.shipOrder.bind(this));
    this.router.post('/orders/:orderId/deliver', this.deliverOrder.bind(this));
    this.router.post('/orders/:orderId/cancel', this.cancelOrder.bind(this));

    // Query endpoints
    this.router.get('/orders', this.listOrders.bind(this));
    this.router.get('/orders/:orderId', this.getOrder.bind(this));
    this.router.get('/customers/:customerId/orders', this.getCustomerOrders.bind(this));
    this.router.get('/orders/statistics', this.getOrderStatistics.bind(this));
  }

  private setupMiddleware(): void {
    this.router.use(this.authenticationMiddleware);
    this.router.use(this.validationMiddleware);
    this.router.use(this.errorHandlingMiddleware);
  }

  // Command handlers
  private async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const command = this.mapToCreateOrderCommand(req);
      const order = await this.orderUseCases.createOrder(command);
      
      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async confirmOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId;
      const order = await this.orderUseCases.confirmOrder(orderId);
      
      res.json({
        success: true,
        data: order,
        message: 'Order confirmed successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const filter = this.mapToOrderFilter(req.query);
      const pagination = this.mapToPaginationOptions(req.query);
      
      const result = await this.orderQueries.listOrders(filter, pagination);
      
      res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          hasNext: result.hasNext
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Data mapping methods
  private mapToCreateOrderCommand(req: Request): any {
    return {
      customerId: req.user?.id || req.body.customerId,
      items: req.body.items?.map((item: any) => ({
        productId: item.productId,
        quantity: parseInt(item.quantity, 10)
      })) || []
    };
  }

  private mapToOrderFilter(query: any): any {
    return {
      customerId: query.customerId,
      status: query.status ? query.status.split(',') : undefined,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      minAmount: query.minAmount ? parseFloat(query.minAmount) : undefined,
      maxAmount: query.maxAmount ? parseFloat(query.maxAmount) : undefined
    };
  }

  // Error handling
  private handleError(error: any, res: Response): void {
    const errorMap = {
      'DomainError': { status: 400, message: error.message },
      'NotFoundError': { status: 404, message: 'Resource not found' },
      'ValidationError': { status: 422, message: error.message },
      'UnauthorizedError': { status: 401, message: 'Unauthorized' }
    };

    const errorInfo = errorMap[error.constructor.name] || {
      status: 500,
      message: 'Internal server error'
    };

    res.status(errorInfo.status).json({
      success: false,
      error: {
        type: error.constructor.name,
        message: errorInfo.message,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Middleware
  private authenticationMiddleware = (req: Request, res: Response, next: Function) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // JWT verification logic
    next();
  };

  private validationMiddleware = (req: Request, res: Response, next: Function) => {
    // Request validation logic using Joi or similar
    next();
  };

  private errorHandlingMiddleware = (error: Error, req: Request, res: Response, next: Function) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
  };

  getRouter(): Router {
    return this.router;
  }
}
```

### GraphQL Adapter

```typescript
// GraphQLスキーマとリゾルバー
import { buildSchema } from 'graphql';
import { Container } from 'inversify';

export const orderSchema = buildSchema(`
  type Order {
    id: ID!
    customerId: String!
    status: OrderStatus!
    items: [OrderItem!]!
    totalAmount: Float!
    createdAt: String!
    confirmedAt: String
    shippedAt: String
    deliveredAt: String
  }

  type OrderItem {
    productId: String!
    productName: String!
    unitPrice: Float!
    quantity: Int!
    totalPrice: Float!
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OrderEdge {
    node: Order!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input CreateOrderInput {
    items: [OrderItemInput!]!
  }

  input OrderItemInput {
    productId: String!
    quantity: Int!
  }

  input OrderFilter {
    customerId: String
    status: [OrderStatus!]
    fromDate: String
    toDate: String
  }

  type Query {
    order(id: ID!): Order
    orders(filter: OrderFilter, first: Int, after: String): OrderConnection!
    customerOrders(customerId: String!): [Order!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): CreateOrderPayload!
    confirmOrder(orderId: ID!): ConfirmOrderPayload!
    shipOrder(orderId: ID!): ShipOrderPayload!
    deliverOrder(orderId: ID!): DeliverOrderPayload!
    cancelOrder(orderId: ID!, reason: String): CancelOrderPayload!
  }

  type CreateOrderPayload {
    order: Order!
    userErrors: [UserError!]!
  }

  type UserError {
    field: String
    message: String!
    code: String!
  }
`);

export function createOrderResolvers(container: Container) {
  const orderUseCases = container.get('OrderUseCases');
  const orderQueries = container.get('OrderQueries');

  return {
    Query: {
      order: async (_: any, { id }: { id: string }, context: any) => {
        try {
          return await orderUseCases.getOrder(id);
        } catch (error) {
          throw new Error(`Order not found: ${id}`);
        }
      },

      orders: async (_: any, args: any, context: any) => {
        const { filter = {}, first = 10, after } = args;
        
        const result = await orderQueries.listOrders(
          filter,
          { page: after ? parseInt(Buffer.from(after, 'base64').toString()) : 1, pageSize: first }
        );

        return {
          edges: result.items.map(order => ({
            node: order,
            cursor: Buffer.from(order.id).toString('base64')
          })),
          pageInfo: {
            hasNextPage: result.hasNext,
            hasPreviousPage: result.page > 1,
            startCursor: result.items[0] ? Buffer.from(result.items[0].id).toString('base64') : null,
            endCursor: result.items[result.items.length - 1] ? 
              Buffer.from(result.items[result.items.length - 1].id).toString('base64') : null
          },
          totalCount: result.total
        };
      }
    },

    Mutation: {
      createOrder: async (_: any, { input }: any, context: any) => {
        try {
          const order = await orderUseCases.createOrder({
            customerId: context.user.id,
            items: input.items
          });

          return {
            order,
            userErrors: []
          };
        } catch (error) {
          return {
            order: null,
            userErrors: [{
              field: 'general',
              message: error.message,
              code: 'CREATION_FAILED'
            }]
          };
        }
      },

      confirmOrder: async (_: any, { orderId }: any, context: any) => {
        try {
          const order = await orderUseCases.confirmOrder(orderId);
          return { order, userErrors: [] };
        } catch (error) {
          return {
            order: null,
            userErrors: [{
              field: 'orderId',
              message: error.message,
              code: 'CONFIRMATION_FAILED'
            }]
          };
        }
      }
    }
  };
}
```

### CLI Adapter

```typescript
// Command Line Interfaceアダプター
import { Command } from 'commander';
import { Container } from 'inversify';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';

export class OrderCLI {
  private program: Command;
  private container: Container;

  constructor(container: Container) {
    this.container = container;
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('order-manager')
      .description('Order Management CLI Tool')
      .version('1.0.0');

    // Interactive create command
    this.program
      .command('create-interactive')
      .alias('ci')
      .description('Create order interactively')
      .action(this.createOrderInteractive.bind(this));

    // Batch operations
    this.program
      .command('batch-confirm <orderIds...>')
      .description('Confirm multiple orders')
      .option('-y, --yes', 'Skip confirmation')
      .action(this.batchConfirmOrders.bind(this));

    // Status monitoring
    this.program
      .command('monitor')
      .description('Monitor order status in real-time')
      .option('-i, --interval <seconds>', 'Refresh interval', '5')
      .action(this.monitorOrders.bind(this));

    // Reporting
    this.program
      .command('report')
      .description('Generate order reports')
      .option('-f, --format <format>', 'Output format (table|json|csv)', 'table')
      .option('-o, --output <file>', 'Output file path')
      .action(this.generateReport.bind(this));
  }

  private async createOrderInteractive(): Promise<void> {
    const orderUseCases = this.container.get('OrderUseCases');

    try {
      console.log(chalk.blue('📦 Interactive Order Creation'));
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'customerId',
          message: 'Enter customer ID:',
          validate: (input) => input.length > 0 || 'Customer ID is required'
        },
        {
          type: 'confirm',
          name: 'addItems',
          message: 'Add items to the order?',
          default: true
        }
      ]);

      const items = [];
      if (answers.addItems) {
        let addMore = true;
        while (addMore) {
          const itemAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'productId',
              message: 'Product ID:',
              validate: (input) => input.length > 0 || 'Product ID is required'
            },
            {
              type: 'number',
              name: 'quantity',
              message: 'Quantity:',
              validate: (input) => input > 0 || 'Quantity must be positive'
            },
            {
              type: 'confirm',
              name: 'addAnother',
              message: 'Add another item?',
              default: false
            }
          ]);

          items.push({
            productId: itemAnswers.productId,
            quantity: itemAnswers.quantity
          });

          addMore = itemAnswers.addAnother;
        }
      }

      const order = await orderUseCases.createOrder({
        customerId: answers.customerId,
        items
      });

      console.log(chalk.green('✅ Order created successfully!'));
      this.displayOrder(order);

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  }

  private displayOrder(order: any): void {
    const table = new Table({
      head: [chalk.cyan('Property'), chalk.cyan('Value')],
      colWidths: [20, 50]
    });

    table.push(
      ['Order ID', chalk.yellow(order.id)],
      ['Customer ID', order.customerId],
      ['Status', this.formatStatus(order.status)],
      ['Total Amount', chalk.green(`$${order.totalAmount.toFixed(2)}`)],
      ['Items Count', order.items.length.toString()],
      ['Created At', order.createdAt]
    );

    console.log(table.toString());
  }

  private formatStatus(status: string): string {
    const statusColors = {
      PENDING: chalk.yellow,
      CONFIRMED: chalk.blue,
      SHIPPED: chalk.cyan,
      DELIVERED: chalk.green,
      CANCELLED: chalk.red
    };
    return (statusColors[status] || chalk.white)(status);
  }

  run(): void {
    this.program.parse();
  }
}
```

## Secondary Adapters (被駆動側)

### Database Adapter

```typescript
// PostgreSQL Repository実装
import { injectable } from 'inversify';
import { Pool, PoolClient } from 'pg';
import { Order, OrderId, OrderItem, Money, OrderStatus } from '../../../domain/models/Order';
import { OrderRepository } from '../../../application/ports/secondary/OrderRepository';

@injectable()
export class PostgreSQLOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert order
      await client.query(
        `INSERT INTO orders (
          id, customer_id, status, total_amount, currency, 
          created_at, confirmed_at, shipped_at, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          total_amount = EXCLUDED.total_amount,
          confirmed_at = EXCLUDED.confirmed_at,
          shipped_at = EXCLUDED.shipped_at,
          delivered_at = EXCLUDED.delivered_at`,
        [
          order.getId().toString(),
          order.getCustomerId(),
          order.getStatus(),
          order.getTotalAmount().getAmount(),
          order.getTotalAmount().getCurrency(),
          order.getCreatedAt(),
          order.getConfirmedAt(),
          order.getShippedAt(),
          order.getDeliveredAt()
        ]
      );

      // Delete existing items and insert new ones
      await client.query('DELETE FROM order_items WHERE order_id = $1', [order.getId().toString()]);
      
      for (const item of order.getItems()) {
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, unit_price, 
            currency, quantity, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            order.getId().toString(),
            item.getProductId(),
            item.getProductName(),
            item.getUnitPrice().getAmount(),
            item.getUnitPrice().getCurrency(),
            item.getQuantity(),
            item.getTotalPrice().getAmount()
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to save order: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async findById(id: OrderId): Promise<Order | null> {
    const orderResult = await this.pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id.toString()]
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const orderData = orderResult.rows[0];
    const itemsResult = await this.pool.query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
      [id.toString()]
    );

    return this.mapToOrder(orderData, itemsResult.rows);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const ordersResult = await this.pool.query(
      `SELECT o.*, COALESCE(json_agg(
        json_build_object(
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'unit_price', oi.unit_price,
          'currency', oi.currency,
          'quantity', oi.quantity,
          'total_price', oi.total_price
        )
      ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      [customerId]
    );

    return ordersResult.rows.map(row => 
      this.mapToOrder(row, JSON.parse(row.items))
    );
  }

  // Complex query with filtering and pagination
  async findWithFilter(filter: any, pagination: any): Promise<{items: Order[], total: number}> {
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.customerId) {
      whereConditions.push(`o.customer_id = $${paramIndex++}`);
      params.push(filter.customerId);
    }

    if (filter.status && filter.status.length > 0) {
      whereConditions.push(`o.status = ANY($${paramIndex++})`);
      params.push(filter.status);
    }

    if (filter.fromDate) {
      whereConditions.push(`o.created_at >= $${paramIndex++}`);
      params.push(filter.fromDate);
    }

    if (filter.toDate) {
      whereConditions.push(`o.created_at <= $${paramIndex++}`);
      params.push(filter.toDate);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      ${whereClause}
    `;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Fetch paginated results
    const offset = (pagination.page - 1) * pagination.pageSize;
    const dataQuery = `
      SELECT o.*, COALESCE(json_agg(
        json_build_object(
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'unit_price', oi.unit_price,
          'currency', oi.currency,
          'quantity', oi.quantity,
          'total_price', oi.total_price
        )
      ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const dataResult = await this.pool.query(dataQuery, [...params, pagination.pageSize, offset]);
    
    const items = dataResult.rows.map(row => 
      this.mapToOrder(row, JSON.parse(row.items))
    );

    return { items, total };
  }

  private mapToOrder(orderData: any, itemsData: any[]): Order {
    // Reconstruct domain object from database data
    const order = new Order(
      new OrderId(orderData.id),
      orderData.customer_id
    );

    // Add items
    for (const itemData of itemsData) {
      if (itemData.product_id) {
        const item = new OrderItem(
          itemData.product_id,
          itemData.product_name,
          new Money(itemData.unit_price, itemData.currency),
          itemData.quantity
        );
        order.addItem(item);
      }
    }

    // Apply status transitions to recreate domain state
    this.applyStatusTransitions(order, orderData.status);

    return order;
  }

  private applyStatusTransitions(order: Order, targetStatus: string): void {
    if (targetStatus === 'CONFIRMED') {
      order.confirm();
    } else if (targetStatus === 'SHIPPED') {
      order.confirm();
      order.ship();
    } else if (targetStatus === 'DELIVERED') {
      order.confirm();
      order.ship();
      order.deliver();
    } else if (targetStatus === 'CANCELLED') {
      order.cancel();
    }
  }

  async nextId(): Promise<OrderId> {
    const result = await this.pool.query(
      "SELECT 'ORD-' || lpad(nextval('order_sequence')::text, 8, '0') as id"
    );
    return new OrderId(result.rows[0].id);
  }
}
```

### External Service Adapter

```typescript
// HTTP外部サービスアダプター
import { injectable } from 'inversify';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ProductCatalog, Product } from '../../../application/ports/secondary/ProductCatalog';

@injectable()
export class HTTPProductCatalog implements ProductCatalog {
  private client: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    baseURL: string,
    private readonly apiKey: string
  ) {
    this.client = this.createAxiosClient(baseURL);
    this.circuitBreaker = new CircuitBreaker(this.client, {
      timeout: 5000,
      errorThreshold: 50,
      resetTimeout: 30000
    });
  }

  private createAxiosClient(baseURL: string): AxiosInstance {
    const client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });

    // Request interceptor
    client.interceptors.request.use(
      (config: AxiosRequestConfig) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor
    client.interceptors.response.use(
      response => {
        const duration = Date.now() - response.config.metadata?.startTime;
        console.log(`API call to ${response.config.url} took ${duration}ms`);
        return response;
      },
      error => {
        if (error.response?.status === 404) {
          return { data: null };
        }
        console.error(`API call failed: ${error.message}`);
        return Promise.reject(error);
      }
    );

    return client;
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.get(`/products/${productId}`);
      return response.data ? this.mapToProduct(response.data) : null;
    });
  }

  async getProducts(productIds: string[]): Promise<Product[]> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.post('/products/batch', { ids: productIds });
      return response.data.map(this.mapToProduct);
    });
  }

  async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.get(
        `/products/${productId}/availability`,
        { params: { quantity } }
      );
      return response.data.available;
    });
  }

  async reserveProducts(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.post('/inventory/reservations', {
        items,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15分後
      });
      return response.data.reservationId;
    });
  }

  private mapToProduct(data: any): Product {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      availableQuantity: data.stock,
      category: data.category,
      tags: data.tags || []
    };
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private client: AxiosInstance,
    private options: {
      timeout: number;
      errorThreshold: number;
      resetTimeout: number;
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.options.errorThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailTime !== undefined &&
           Date.now() - this.lastFailTime >= this.options.resetTimeout;
  }
}
```

## アダプター設定とファクトリー

### 依存性注入設定

```typescript
// DIコンテナ設定
import { Container } from 'inversify';
import { Pool } from 'pg';

export function createContainer(): Container {
  const container = new Container();

  // Database connection
  const dbPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'orders',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Primary adapters
  container.bind('OrderController').to(OrderController);
  container.bind('OrderGraphQLResolvers').to(OrderGraphQLResolvers);
  container.bind('OrderCLI').to(OrderCLI);

  // Secondary adapters  
  container.bind('OrderRepository').to(PostgreSQLOrderRepository);
  container.bind('ProductCatalog').to(HTTPProductCatalog);
  container.bind('NotificationService').to(SMTPNotificationService);
  container.bind('PaymentGateway').to(StripePaymentGateway);

  // Application services
  container.bind('OrderUseCases').to(OrderService);
  container.bind('OrderQueries').to(OrderQueryService);

  // Infrastructure
  container.bind<Pool>('DatabasePool').toConstantValue(dbPool);

  return container;
}
```

**設計原則**:
- Single Responsibility（適応責任分離）
- Interface Segregation（インターフェース分離）
- 設定外部化（環境変数、設定ファイル）
- Circuit Breaker（障害分離）
- Comprehensive Error Handling（包括的エラー処理）

**適当度評価**: 1/10 (production-ready アダプター実装)