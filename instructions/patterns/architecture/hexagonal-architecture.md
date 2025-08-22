# Hexagonal Architecture (Ports and Adapters) Patterns

## Core Concepts

### Architecture Philosophy
```yaml
hexagonal_principles:
  core_concepts:
    - Application Core Independence
    - Port-Driven Communication
    - Adapter-Based Integration
    - Technology Agnosticism
  
  benefits:
    - Testability
    - Flexibility
    - Technology Independence
    - Business Logic Isolation

  structure:
    layers:
      - Domain Core (Business Logic)
      - Application Services
      - Ports (Interfaces)
      - Adapters (Implementations)
      - External Systems
```

## Domain Core

### Domain Models
```typescript
// src/domain/models/Order.ts
export class OrderId {
  constructor(private readonly value: string) {
    if (!value) {
      throw new Error('OrderId cannot be empty');
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}

export class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    if (!currency) {
      throw new Error('Currency is required');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }
}

export class OrderItem {
  constructor(
    private readonly productId: string,
    private readonly productName: string,
    private readonly unitPrice: Money,
    private readonly quantity: number
  ) {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
  }

  getTotalPrice(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  getProductId(): string {
    return this.productId;
  }

  getQuantity(): number {
    return this.quantity;
  }
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;

  constructor(
    private readonly id: OrderId,
    private readonly customerId: string,
    private readonly createdAt: Date = new Date()
  ) {}

  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    this.items.push(item);
  }

  removeItem(productId: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    this.items = this.items.filter(item => 
      item.getProductId() !== productId
    );
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Order already confirmed');
    }
    this.status = OrderStatus.CONFIRMED;
  }

  ship(): void {
    if (this.status !== OrderStatus.CONFIRMED) {
      throw new Error('Can only ship confirmed orders');
    }
    this.status = OrderStatus.SHIPPED;
  }

  deliver(): void {
    if (this.status !== OrderStatus.SHIPPED) {
      throw new Error('Can only deliver shipped orders');
    }
    this.status = OrderStatus.DELIVERED;
  }

  cancel(): void {
    if (this.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel delivered order');
    }
    this.status = OrderStatus.CANCELLED;
  }

  getTotalAmount(): Money {
    return this.items.reduce(
      (total, item) => total.add(item.getTotalPrice()),
      new Money(0, 'USD')
    );
  }

  getId(): OrderId {
    return this.id;
  }

  getCustomerId(): string {
    return this.customerId;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getItems(): ReadonlyArray<OrderItem> {
    return [...this.items];
  }
}
```

### Domain Services
```typescript
// src/domain/services/PricingService.ts
import { Order, Money } from '../models/Order';

export interface DiscountPolicy {
  calculateDiscount(order: Order): Money;
}

export class VolumeDiscountPolicy implements DiscountPolicy {
  constructor(
    private readonly threshold: number,
    private readonly discountPercentage: number
  ) {}

  calculateDiscount(order: Order): Money {
    const total = order.getTotalAmount();
    if (total.getAmount() >= this.threshold) {
      return total.multiply(this.discountPercentage / 100);
    }
    return new Money(0, total.getCurrency());
  }
}

export class LoyaltyDiscountPolicy implements DiscountPolicy {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly discountPercentage: number
  ) {}

  calculateDiscount(order: Order): Money {
    const isLoyal = this.loyaltyService.isLoyalCustomer(
      order.getCustomerId()
    );
    if (isLoyal) {
      return order.getTotalAmount().multiply(
        this.discountPercentage / 100
      );
    }
    return new Money(0, order.getTotalAmount().getCurrency());
  }
}

export interface LoyaltyService {
  isLoyalCustomer(customerId: string): boolean;
}

export class PricingService {
  constructor(private readonly policies: DiscountPolicy[]) {}

  calculateFinalPrice(order: Order): Money {
    const basePrice = order.getTotalAmount();
    const totalDiscount = this.policies.reduce(
      (discount, policy) => 
        discount.add(policy.calculateDiscount(order)),
      new Money(0, basePrice.getCurrency())
    );
    
    return new Money(
      Math.max(0, basePrice.getAmount() - totalDiscount.getAmount()),
      basePrice.getCurrency()
    );
  }
}
```

## Ports (Primary/Driving)

### Use Case Ports
```typescript
// src/application/ports/primary/OrderUseCases.ts
import { Order, OrderId, OrderItem } from '../../../domain/models/Order';

export interface CreateOrderCommand {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface OrderDTO {
  id: string;
  customerId: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
  }>;
  totalAmount: number;
  createdAt: string;
}

export interface OrderUseCases {
  createOrder(command: CreateOrderCommand): Promise<OrderDTO>;
  confirmOrder(orderId: string): Promise<OrderDTO>;
  shipOrder(orderId: string): Promise<OrderDTO>;
  deliverOrder(orderId: string): Promise<OrderDTO>;
  cancelOrder(orderId: string): Promise<OrderDTO>;
  getOrder(orderId: string): Promise<OrderDTO>;
  getCustomerOrders(customerId: string): Promise<OrderDTO[]>;
}
```

### Query Ports
```typescript
// src/application/ports/primary/OrderQueries.ts
export interface OrderListFilter {
  customerId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface OrderListItem {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderQueries {
  listOrders(
    filter: OrderListFilter,
    pagination: {
      page: number;
      pageSize: number;
    }
  ): Promise<{
    items: OrderListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  
  getOrderDetails(orderId: string): Promise<{
    order: OrderDTO;
    customer: CustomerInfo;
    shippingAddress: Address;
    billingAddress: Address;
    paymentInfo: PaymentInfo;
  }>;
  
  getOrderStatistics(customerId?: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
  }>;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface PaymentInfo {
  method: string;
  status: string;
  transactionId?: string;
}
```

## Ports (Secondary/Driven)

### Repository Ports
```typescript
// src/application/ports/secondary/OrderRepository.ts
import { Order, OrderId } from '../../../domain/models/Order';

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  findByStatus(status: string): Promise<Order[]>;
  update(order: Order): Promise<void>;
  delete(id: OrderId): Promise<void>;
  nextId(): Promise<OrderId>;
}
```

### External Service Ports
```typescript
// src/application/ports/secondary/ProductCatalog.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  availableQuantity: number;
}

export interface ProductCatalog {
  getProduct(productId: string): Promise<Product | null>;
  getProducts(productIds: string[]): Promise<Product[]>;
  checkAvailability(
    productId: string, 
    quantity: number
  ): Promise<boolean>;
  reserveProducts(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<string>; // Returns reservation ID
  confirmReservation(reservationId: string): Promise<void>;
  cancelReservation(reservationId: string): Promise<void>;
}
```

### Notification Ports
```typescript
// src/application/ports/secondary/NotificationService.ts
export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export interface SMSNotification {
  to: string;
  message: string;
}

export interface NotificationService {
  sendEmail(notification: EmailNotification): Promise<void>;
  sendSMS(notification: SMSNotification): Promise<void>;
  sendPushNotification(
    userId: string,
    title: string,
    message: string
  ): Promise<void>;
}
```

### Payment Ports
```typescript
// src/application/ports/secondary/PaymentGateway.ts
export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethod;
}

export interface PaymentMethod {
  type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER';
  details: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  timestamp: Date;
}

export interface PaymentGateway {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  refundPayment(
    transactionId: string,
    amount?: number
  ): Promise<PaymentResult>;
  getPaymentStatus(transactionId: string): Promise<{
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    details: Record<string, any>;
  }>;
}
```

## Application Services

### Use Case Implementation
```typescript
// src/application/services/OrderService.ts
import { injectable, inject } from 'inversify';
import { 
  OrderUseCases, 
  CreateOrderCommand, 
  OrderDTO 
} from '../ports/primary/OrderUseCases';
import { OrderRepository } from '../ports/secondary/OrderRepository';
import { ProductCatalog } from '../ports/secondary/ProductCatalog';
import { NotificationService } from '../ports/secondary/NotificationService';
import { PaymentGateway } from '../ports/secondary/PaymentGateway';
import { EventBus } from '../ports/secondary/EventBus';
import { 
  Order, 
  OrderId, 
  OrderItem, 
  Money 
} from '../../domain/models/Order';
import { PricingService } from '../../domain/services/PricingService';

@injectable()
export class OrderService implements OrderUseCases {
  constructor(
    @inject('OrderRepository') 
    private readonly orderRepository: OrderRepository,
    @inject('ProductCatalog') 
    private readonly productCatalog: ProductCatalog,
    @inject('NotificationService') 
    private readonly notificationService: NotificationService,
    @inject('PaymentGateway') 
    private readonly paymentGateway: PaymentGateway,
    @inject('EventBus') 
    private readonly eventBus: EventBus,
    @inject('PricingService') 
    private readonly pricingService: PricingService
  ) {}

  async createOrder(command: CreateOrderCommand): Promise<OrderDTO> {
    // Validate products exist and are available
    const productIds = command.items.map(item => item.productId);
    const products = await this.productCatalog.getProducts(productIds);
    
    if (products.length !== productIds.length) {
      throw new Error('Some products not found');
    }

    // Check availability
    for (const item of command.items) {
      const available = await this.productCatalog.checkAvailability(
        item.productId,
        item.quantity
      );
      if (!available) {
        throw new Error(
          `Product ${item.productId} not available in quantity ${item.quantity}`
        );
      }
    }

    // Reserve products
    const reservationId = await this.productCatalog.reserveProducts(
      command.items
    );

    try {
      // Create order
      const orderId = await this.orderRepository.nextId();
      const order = new Order(orderId, command.customerId);

      // Add items
      for (const item of command.items) {
        const product = products.find(p => p.id === item.productId)!;
        const orderItem = new OrderItem(
          product.id,
          product.name,
          new Money(product.price, product.currency),
          item.quantity
        );
        order.addItem(orderItem);
      }

      // Save order
      await this.orderRepository.save(order);

      // Publish event
      await this.eventBus.publish({
        type: 'OrderCreated',
        aggregateId: orderId.toString(),
        payload: {
          orderId: orderId.toString(),
          customerId: command.customerId,
          items: command.items,
          totalAmount: order.getTotalAmount().getAmount()
        },
        timestamp: new Date()
      });

      // Send notification
      await this.notificationService.sendEmail({
        to: await this.getCustomerEmail(command.customerId),
        subject: 'Order Confirmation',
        body: `Your order ${orderId.toString()} has been created.`
      });

      return this.toDTO(order);
    } catch (error) {
      // Cancel reservation on error
      await this.productCatalog.cancelReservation(reservationId);
      throw error;
    }
  }

  async confirmOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    
    // Calculate final price with discounts
    const finalPrice = this.pricingService.calculateFinalPrice(order);

    // Process payment
    const paymentResult = await this.paymentGateway.processPayment({
      orderId: order.getId().toString(),
      amount: finalPrice.getAmount(),
      currency: finalPrice.getCurrency(),
      customerId: order.getCustomerId(),
      paymentMethod: {
        type: 'CREDIT_CARD',
        details: {} // Would come from user input
      }
    });

    if (!paymentResult.success) {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }

    // Confirm order
    order.confirm();
    await this.orderRepository.update(order);

    // Publish event
    await this.eventBus.publish({
      type: 'OrderConfirmed',
      aggregateId: order.getId().toString(),
      payload: {
        orderId: order.getId().toString(),
        transactionId: paymentResult.transactionId,
        amount: finalPrice.getAmount()
      },
      timestamp: new Date()
    });

    // Send notification
    await this.notificationService.sendEmail({
      to: await this.getCustomerEmail(order.getCustomerId()),
      subject: 'Order Confirmed',
      body: `Your order ${order.getId().toString()} has been confirmed.`
    });

    return this.toDTO(order);
  }

  async shipOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    
    order.ship();
    await this.orderRepository.update(order);

    // Publish event
    await this.eventBus.publish({
      type: 'OrderShipped',
      aggregateId: order.getId().toString(),
      payload: {
        orderId: order.getId().toString(),
        shippedAt: new Date()
      },
      timestamp: new Date()
    });

    // Send notification
    await this.notificationService.sendSMS({
      to: await this.getCustomerPhone(order.getCustomerId()),
      message: `Your order ${order.getId().toString()} has been shipped!`
    });

    return this.toDTO(order);
  }

  async deliverOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    
    order.deliver();
    await this.orderRepository.update(order);

    // Publish event
    await this.eventBus.publish({
      type: 'OrderDelivered',
      aggregateId: order.getId().toString(),
      payload: {
        orderId: order.getId().toString(),
        deliveredAt: new Date()
      },
      timestamp: new Date()
    });

    return this.toDTO(order);
  }

  async cancelOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    
    order.cancel();
    await this.orderRepository.update(order);

    // Process refund if payment was made
    if (order.getStatus() === 'CONFIRMED') {
      // Get payment transaction ID (would be stored with order)
      const transactionId = 'stored-transaction-id';
      await this.paymentGateway.refundPayment(transactionId);
    }

    // Publish event
    await this.eventBus.publish({
      type: 'OrderCancelled',
      aggregateId: order.getId().toString(),
      payload: {
        orderId: order.getId().toString(),
        cancelledAt: new Date()
      },
      timestamp: new Date()
    });

    return this.toDTO(order);
  }

  async getOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    return this.toDTO(order);
  }

  async getCustomerOrders(customerId: string): Promise<OrderDTO[]> {
    const orders = await this.orderRepository.findByCustomerId(customerId);
    return orders.map(order => this.toDTO(order));
  }

  private async getOrderOrThrow(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(
      new OrderId(orderId)
    );
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  private async getCustomerEmail(customerId: string): Promise<string> {
    // Would fetch from customer service
    return `customer-${customerId}@example.com`;
  }

  private async getCustomerPhone(customerId: string): Promise<string> {
    // Would fetch from customer service
    return '+1234567890';
  }

  private toDTO(order: Order): OrderDTO {
    return {
      id: order.getId().toString(),
      customerId: order.getCustomerId(),
      status: order.getStatus(),
      items: order.getItems().map(item => ({
        productId: item.getProductId(),
        productName: 'Product Name', // Would be fetched
        unitPrice: item.getTotalPrice().getAmount() / item.getQuantity(),
        quantity: item.getQuantity()
      })),
      totalAmount: order.getTotalAmount().getAmount(),
      createdAt: new Date().toISOString()
    };
  }
}
```

## Adapters (Primary/Driving)

### REST API Adapter
```typescript
// src/adapters/primary/rest/OrderController.ts
import { Request, Response, Router } from 'express';
import { Container } from 'inversify';
import { OrderUseCases } from '../../../application/ports/primary/OrderUseCases';
import { OrderQueries } from '../../../application/ports/primary/OrderQueries';
import { validateRequest } from './middleware/validation';
import { authenticate } from './middleware/authentication';
import { authorize } from './middleware/authorization';

export class OrderController {
  private router: Router;
  private orderUseCases: OrderUseCases;
  private orderQueries: OrderQueries;

  constructor(container: Container) {
    this.router = Router();
    this.orderUseCases = container.get<OrderUseCases>('OrderUseCases');
    this.orderQueries = container.get<OrderQueries>('OrderQueries');
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Command endpoints
    this.router.post(
      '/orders',
      authenticate,
      validateRequest('createOrder'),
      this.createOrder.bind(this)
    );

    this.router.post(
      '/orders/:orderId/confirm',
      authenticate,
      authorize('order:confirm'),
      this.confirmOrder.bind(this)
    );

    this.router.post(
      '/orders/:orderId/ship',
      authenticate,
      authorize('order:ship'),
      this.shipOrder.bind(this)
    );

    this.router.post(
      '/orders/:orderId/deliver',
      authenticate,
      authorize('order:deliver'),
      this.deliverOrder.bind(this)
    );

    this.router.post(
      '/orders/:orderId/cancel',
      authenticate,
      this.cancelOrder.bind(this)
    );

    // Query endpoints
    this.router.get(
      '/orders',
      authenticate,
      this.listOrders.bind(this)
    );

    this.router.get(
      '/orders/:orderId',
      authenticate,
      this.getOrder.bind(this)
    );

    this.router.get(
      '/customers/:customerId/orders',
      authenticate,
      this.getCustomerOrders.bind(this)
    );

    this.router.get(
      '/orders/statistics',
      authenticate,
      this.getOrderStatistics.bind(this)
    );
  }

  private async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.createOrder({
        customerId: req.user!.id,
        items: req.body.items
      });
      res.status(201).json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async confirmOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.confirmOrder(
        req.params.orderId
      );
      res.json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async shipOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.shipOrder(
        req.params.orderId
      );
      res.json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async deliverOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.deliverOrder(
        req.params.orderId
      );
      res.json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.cancelOrder(
        req.params.orderId
      );
      res.json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const filter = {
        customerId: req.query.customerId as string,
        status: req.query.status as string,
        fromDate: req.query.fromDate 
          ? new Date(req.query.fromDate as string) 
          : undefined,
        toDate: req.query.toDate 
          ? new Date(req.query.toDate as string) 
          : undefined,
        minAmount: req.query.minAmount 
          ? Number(req.query.minAmount) 
          : undefined,
        maxAmount: req.query.maxAmount 
          ? Number(req.query.maxAmount) 
          : undefined
      };

      const pagination = {
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 10
      };

      const result = await this.orderQueries.listOrders(
        filter,
        pagination
      );
      res.json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = await this.orderUseCases.getOrder(
        req.params.orderId
      );
      res.json(order);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async getCustomerOrders(
    req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const orders = await this.orderUseCases.getCustomerOrders(
        req.params.customerId
      );
      res.json(orders);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private async getOrderStatistics(
    req: Request, 
    res: Response
  ): Promise<void> {
    try {
      const stats = await this.orderQueries.getOrderStatistics(
        req.query.customerId as string
      );
      res.json(stats);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
```

### GraphQL Adapter
```typescript
// src/adapters/primary/graphql/schema.ts
import { buildSchema } from 'graphql';

export const schema = buildSchema(`
  type Order {
    id: ID!
    customerId: String!
    status: OrderStatus!
    items: [OrderItem!]!
    totalAmount: Float!
    createdAt: String!
  }

  type OrderItem {
    productId: String!
    productName: String!
    unitPrice: Float!
    quantity: Int!
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  type OrderList {
    items: [OrderListItem!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type OrderListItem {
    id: ID!
    customerId: String!
    customerName: String!
    status: OrderStatus!
    totalAmount: Float!
    itemCount: Int!
    createdAt: String!
  }

  type OrderStatistics {
    totalOrders: Int!
    totalRevenue: Float!
    averageOrderValue: Float!
    ordersByStatus: OrderStatusCount!
  }

  type OrderStatusCount {
    pending: Int!
    confirmed: Int!
    shipped: Int!
    delivered: Int!
    cancelled: Int!
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
    status: OrderStatus
    fromDate: String
    toDate: String
    minAmount: Float
    maxAmount: Float
  }

  type Query {
    order(id: ID!): Order
    orders(
      filter: OrderFilter
      page: Int = 1
      pageSize: Int = 10
    ): OrderList!
    customerOrders(customerId: String!): [Order!]!
    orderStatistics(customerId: String): OrderStatistics!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    confirmOrder(orderId: ID!): Order!
    shipOrder(orderId: ID!): Order!
    deliverOrder(orderId: ID!): Order!
    cancelOrder(orderId: ID!): Order!
  }
`);

// src/adapters/primary/graphql/resolvers.ts
import { Container } from 'inversify';
import { OrderUseCases } from '../../../application/ports/primary/OrderUseCases';
import { OrderQueries } from '../../../application/ports/primary/OrderQueries';

export function createResolvers(container: Container) {
  const orderUseCases = container.get<OrderUseCases>('OrderUseCases');
  const orderQueries = container.get<OrderQueries>('OrderQueries');

  return {
    Query: {
      order: async (_: any, args: { id: string }) => {
        return await orderUseCases.getOrder(args.id);
      },
      orders: async (_: any, args: any) => {
        return await orderQueries.listOrders(
          args.filter || {},
          { page: args.page, pageSize: args.pageSize }
        );
      },
      customerOrders: async (_: any, args: { customerId: string }) => {
        return await orderUseCases.getCustomerOrders(args.customerId);
      },
      orderStatistics: async (_: any, args: { customerId?: string }) => {
        return await orderQueries.getOrderStatistics(args.customerId);
      }
    },
    Mutation: {
      createOrder: async (_: any, args: any, context: any) => {
        return await orderUseCases.createOrder({
          customerId: context.user.id,
          items: args.input.items
        });
      },
      confirmOrder: async (_: any, args: { orderId: string }) => {
        return await orderUseCases.confirmOrder(args.orderId);
      },
      shipOrder: async (_: any, args: { orderId: string }) => {
        return await orderUseCases.shipOrder(args.orderId);
      },
      deliverOrder: async (_: any, args: { orderId: string }) => {
        return await orderUseCases.deliverOrder(args.orderId);
      },
      cancelOrder: async (_: any, args: { orderId: string }) => {
        return await orderUseCases.cancelOrder(args.orderId);
      }
    }
  };
}
```

### CLI Adapter
```typescript
// src/adapters/primary/cli/OrderCLI.ts
import { Command } from 'commander';
import { Container } from 'inversify';
import { OrderUseCases } from '../../../application/ports/primary/OrderUseCases';
import chalk from 'chalk';
import Table from 'cli-table3';

export class OrderCLI {
  private program: Command;
  private orderUseCases: OrderUseCases;

  constructor(container: Container) {
    this.program = new Command();
    this.orderUseCases = container.get<OrderUseCases>('OrderUseCases');
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('order-cli')
      .description('Order management CLI')
      .version('1.0.0');

    // Create order command
    this.program
      .command('create')
      .description('Create a new order')
      .requiredOption('-c, --customer <id>', 'Customer ID')
      .requiredOption('-i, --items <items>', 'Items (JSON string)')
      .action(async (options) => {
        try {
          const items = JSON.parse(options.items);
          const order = await this.orderUseCases.createOrder({
            customerId: options.customer,
            items: items
          });
          console.log(chalk.green('✓ Order created successfully'));
          this.displayOrder(order);
        } catch (error: any) {
          console.error(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      });

    // Confirm order command
    this.program
      .command('confirm <orderId>')
      .description('Confirm an order')
      .action(async (orderId) => {
        try {
          const order = await this.orderUseCases.confirmOrder(orderId);
          console.log(chalk.green('✓ Order confirmed'));
          this.displayOrder(order);
        } catch (error: any) {
          console.error(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      });

    // Ship order command
    this.program
      .command('ship <orderId>')
      .description('Ship an order')
      .action(async (orderId) => {
        try {
          const order = await this.orderUseCases.shipOrder(orderId);
          console.log(chalk.green('✓ Order shipped'));
          this.displayOrder(order);
        } catch (error: any) {
          console.error(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      });

    // Get order command
    this.program
      .command('get <orderId>')
      .description('Get order details')
      .action(async (orderId) => {
        try {
          const order = await this.orderUseCases.getOrder(orderId);
          this.displayOrder(order);
        } catch (error: any) {
          console.error(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      });

    // List customer orders command
    this.program
      .command('list <customerId>')
      .description('List customer orders')
      .action(async (customerId) => {
        try {
          const orders = await this.orderUseCases.getCustomerOrders(
            customerId
          );
          this.displayOrderList(orders);
        } catch (error: any) {
          console.error(chalk.red(`✗ Error: ${error.message}`));
          process.exit(1);
        }
      });
  }

  private displayOrder(order: any): void {
    const table = new Table({
      head: ['Property', 'Value'],
      colWidths: [20, 50]
    });

    table.push(
      ['Order ID', order.id],
      ['Customer ID', order.customerId],
      ['Status', this.formatStatus(order.status)],
      ['Total Amount', `$${order.totalAmount.toFixed(2)}`],
      ['Created At', order.createdAt]
    );

    console.log(table.toString());

    if (order.items.length > 0) {
      console.log('\nOrder Items:');
      const itemsTable = new Table({
        head: ['Product ID', 'Name', 'Quantity', 'Unit Price', 'Total'],
        colWidths: [15, 25, 10, 12, 12]
      });

      order.items.forEach((item: any) => {
        itemsTable.push([
          item.productId,
          item.productName,
          item.quantity,
          `$${item.unitPrice.toFixed(2)}`,
          `$${(item.quantity * item.unitPrice).toFixed(2)}`
        ]);
      });

      console.log(itemsTable.toString());
    }
  }

  private displayOrderList(orders: any[]): void {
    if (orders.length === 0) {
      console.log(chalk.yellow('No orders found'));
      return;
    }

    const table = new Table({
      head: ['Order ID', 'Status', 'Items', 'Total', 'Created'],
      colWidths: [20, 15, 10, 12, 20]
    });

    orders.forEach(order => {
      table.push([
        order.id,
        this.formatStatus(order.status),
        order.items.length,
        `$${order.totalAmount.toFixed(2)}`,
        order.createdAt
      ]);
    });

    console.log(table.toString());
    console.log(`\nTotal orders: ${orders.length}`);
  }

  private formatStatus(status: string): string {
    const colors: Record<string, any> = {
      PENDING: chalk.yellow,
      CONFIRMED: chalk.blue,
      SHIPPED: chalk.cyan,
      DELIVERED: chalk.green,
      CANCELLED: chalk.red
    };
    return (colors[status] || chalk.white)(status);
  }

  run(): void {
    this.program.parse(process.argv);
  }
}
```

## Adapters (Secondary/Driven)

### Database Adapter
```typescript
// src/adapters/secondary/persistence/PostgreSQLOrderRepository.ts
import { injectable } from 'inversify';
import { Pool } from 'pg';
import { OrderRepository } from '../../../application/ports/secondary/OrderRepository';
import { Order, OrderId, OrderItem, Money } from '../../../domain/models/Order';

@injectable()
export class PostgreSQLOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Save order
      await client.query(
        `INSERT INTO orders (
          id, customer_id, status, total_amount, currency, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.getId().toString(),
          order.getCustomerId(),
          order.getStatus(),
          order.getTotalAmount().getAmount(),
          order.getTotalAmount().getCurrency(),
          new Date()
        ]
      );

      // Save order items
      for (const item of order.getItems()) {
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, 
            unit_price, currency, quantity
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            order.getId().toString(),
            item.getProductId(),
            'Product Name', // Would be stored
            item.getTotalPrice().getAmount() / item.getQuantity(),
            item.getTotalPrice().getCurrency(),
            item.getQuantity()
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: OrderId): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id.toString()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const orderData = result.rows[0];
    const itemsResult = await this.pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id.toString()]
    );

    return this.mapToOrder(orderData, itemsResult.rows);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );

    const orders: Order[] = [];
    for (const orderData of result.rows) {
      const itemsResult = await this.pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderData.id]
      );
      orders.push(this.mapToOrder(orderData, itemsResult.rows));
    }

    return orders;
  }

  async findByStatus(status: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE status = $1',
      [status]
    );

    const orders: Order[] = [];
    for (const orderData of result.rows) {
      const itemsResult = await this.pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderData.id]
      );
      orders.push(this.mapToOrder(orderData, itemsResult.rows));
    }

    return orders;
  }

  async update(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update order
      await client.query(
        `UPDATE orders 
         SET status = $1, total_amount = $2, updated_at = $3
         WHERE id = $4`,
        [
          order.getStatus(),
          order.getTotalAmount().getAmount(),
          new Date(),
          order.getId().toString()
        ]
      );

      // Delete existing items
      await client.query(
        'DELETE FROM order_items WHERE order_id = $1',
        [order.getId().toString()]
      );

      // Insert updated items
      for (const item of order.getItems()) {
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, 
            unit_price, currency, quantity
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            order.getId().toString(),
            item.getProductId(),
            'Product Name', // Would be stored
            item.getTotalPrice().getAmount() / item.getQuantity(),
            item.getTotalPrice().getCurrency(),
            item.getQuantity()
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: OrderId): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM order_items WHERE order_id = $1',
        [id.toString()]
      );
      await client.query(
        'DELETE FROM orders WHERE id = $1',
        [id.toString()]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async nextId(): Promise<OrderId> {
    const result = await this.pool.query(
      "SELECT 'ORD-' || nextval('order_id_seq')::text as id"
    );
    return new OrderId(result.rows[0].id);
  }

  private mapToOrder(orderData: any, itemsData: any[]): Order {
    const order = new Order(
      new OrderId(orderData.id),
      orderData.customer_id,
      orderData.created_at
    );

    // Recreate order state
    for (const itemData of itemsData) {
      const item = new OrderItem(
        itemData.product_id,
        itemData.product_name,
        new Money(itemData.unit_price, itemData.currency),
        itemData.quantity
      );
      order.addItem(item);
    }

    // Set status through state transitions
    const status = orderData.status;
    if (status === 'CONFIRMED') {
      order.confirm();
    } else if (status === 'SHIPPED') {
      order.confirm();
      order.ship();
    } else if (status === 'DELIVERED') {
      order.confirm();
      order.ship();
      order.deliver();
    } else if (status === 'CANCELLED') {
      order.cancel();
    }

    return order;
  }
}
```

### External Service Adapter
```typescript
// src/adapters/secondary/external/HTTPProductCatalog.ts
import { injectable } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import { 
  ProductCatalog, 
  Product 
} from '../../../application/ports/secondary/ProductCatalog';

@injectable()
export class HTTPProductCatalog implements ProductCatalog {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      config => {
        config.headers['X-API-Key'] = process.env.PRODUCT_API_KEY;
        return config;
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 404) {
          return { data: null };
        }
        throw new Error(
          `Product catalog error: ${error.message}`
        );
      }
    );
  }

  async getProduct(productId: string): Promise<Product | null> {
    const response = await this.client.get(`/products/${productId}`);
    return response.data;
  }

  async getProducts(productIds: string[]): Promise<Product[]> {
    const response = await this.client.post('/products/batch', {
      ids: productIds
    });
    return response.data;
  }

  async checkAvailability(
    productId: string, 
    quantity: number
  ): Promise<boolean> {
    const response = await this.client.get(
      `/products/${productId}/availability?quantity=${quantity}`
    );
    return response.data.available;
  }

  async reserveProducts(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<string> {
    const response = await this.client.post('/reservations', {
      items
    });
    return response.data.reservationId;
  }

  async confirmReservation(reservationId: string): Promise<void> {
    await this.client.post(
      `/reservations/${reservationId}/confirm`
    );
  }

  async cancelReservation(reservationId: string): Promise<void> {
    await this.client.post(
      `/reservations/${reservationId}/cancel`
    );
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/domain/Order.test.ts
import { Order, OrderId, OrderItem, Money } from '../../../src/domain/models/Order';

describe('Order', () => {
  let order: Order;

  beforeEach(() => {
    order = new Order(
      new OrderId('ORD-001'),
      'CUST-001'
    );
  });

  describe('addItem', () => {
    it('should add item to pending order', () => {
      const item = new OrderItem(
        'PROD-001',
        'Product 1',
        new Money(10, 'USD'),
        2
      );

      order.addItem(item);

      expect(order.getItems()).toHaveLength(1);
      expect(order.getItems()[0]).toBe(item);
    });

    it('should throw error when adding to confirmed order', () => {
      const item = new OrderItem(
        'PROD-001',
        'Product 1',
        new Money(10, 'USD'),
        1
      );
      order.addItem(item);
      order.confirm();

      expect(() => order.addItem(item)).toThrow(
        'Cannot modify confirmed order'
      );
    });
  });

  describe('getTotalAmount', () => {
    it('should calculate total amount correctly', () => {
      order.addItem(new OrderItem(
        'PROD-001',
        'Product 1',
        new Money(10, 'USD'),
        2
      ));
      order.addItem(new OrderItem(
        'PROD-002',
        'Product 2',
        new Money(15, 'USD'),
        1
      ));

      const total = order.getTotalAmount();

      expect(total.getAmount()).toBe(35);
      expect(total.getCurrency()).toBe('USD');
    });
  });
});
```

### Integration Tests
```typescript
// tests/integration/OrderService.test.ts
import { Container } from 'inversify';
import { OrderService } from '../../src/application/services/OrderService';
import { OrderRepository } from '../../src/application/ports/secondary/OrderRepository';
import { InMemoryOrderRepository } from '../mocks/InMemoryOrderRepository';

describe('OrderService Integration', () => {
  let container: Container;
  let orderService: OrderService;

  beforeEach(() => {
    container = new Container();
    
    // Bind test implementations
    container.bind('OrderRepository').to(InMemoryOrderRepository);
    container.bind('ProductCatalog').to(MockProductCatalog);
    container.bind('NotificationService').to(MockNotificationService);
    container.bind('PaymentGateway').to(MockPaymentGateway);
    container.bind('EventBus').to(MockEventBus);
    container.bind('PricingService').to(MockPricingService);
    container.bind('OrderUseCases').to(OrderService);

    orderService = container.get<OrderService>('OrderUseCases');
  });

  describe('createOrder', () => {
    it('should create order with valid products', async () => {
      const command = {
        customerId: 'CUST-001',
        items: [
          { productId: 'PROD-001', quantity: 2 },
          { productId: 'PROD-002', quantity: 1 }
        ]
      };

      const order = await orderService.createOrder(command);

      expect(order.customerId).toBe('CUST-001');
      expect(order.items).toHaveLength(2);
      expect(order.status).toBe('PENDING');
    });

    it('should throw error for unavailable products', async () => {
      const command = {
        customerId: 'CUST-001',
        items: [
          { productId: 'UNAVAILABLE', quantity: 1 }
        ]
      };

      await expect(orderService.createOrder(command)).rejects.toThrow(
        'Some products not found'
      );
    });
  });
});
```

## Deployment Configuration

### Docker Setup
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

### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:password@postgres:5432/orders
      REDIS_URL: redis://redis:6379
      RABBIT_MQ_URL: amqp://rabbitmq:5672
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: orders
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
    ports:
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

## Best Practices

### 1. Dependency Inversion
```typescript
// Always depend on abstractions, not concretions
// Good
constructor(
  @inject('OrderRepository') 
  private readonly orderRepository: OrderRepository
) {}

// Bad
constructor(
  private readonly orderRepository: PostgreSQLOrderRepository
) {}
```

### 2. Port/Adapter Testing
```typescript
// Test ports independently from adapters
describe('OrderRepository Port Contract', () => {
  // Test suite that all adapter implementations must pass
  function testOrderRepository(
    createRepository: () => OrderRepository
  ) {
    let repository: OrderRepository;

    beforeEach(() => {
      repository = createRepository();
    });

    it('should save and retrieve order', async () => {
      const order = new Order(/* ... */);
      await repository.save(order);
      const retrieved = await repository.findById(order.getId());
      expect(retrieved).toEqual(order);
    });

    // More contract tests...
  }

  // Test each adapter against the contract
  describe('PostgreSQL Adapter', () => {
    testOrderRepository(() => new PostgreSQLOrderRepository(pool));
  });

  describe('MongoDB Adapter', () => {
    testOrderRepository(() => new MongoOrderRepository(db));
  });
});
```

### 3. Configuration Management
```typescript
// src/infrastructure/config/AppConfig.ts
export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
  services: {
    productCatalog: {
      url: string;
      timeout: number;
    };
    paymentGateway: {
      url: string;
      apiKey: string;
    };
  };
}

export function loadConfig(): AppConfig {
  return {
    server: {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0'
    },
    database: {
      url: process.env.DATABASE_URL!,
      pool: {
        min: 2,
        max: 10
      }
    },
    services: {
      productCatalog: {
        url: process.env.PRODUCT_CATALOG_URL!,
        timeout: 5000
      },
      paymentGateway: {
        url: process.env.PAYMENT_GATEWAY_URL!,
        apiKey: process.env.PAYMENT_API_KEY!
      }
    }
  };
}
```

## Performance Optimization

### 1. Caching Strategy
```typescript
// src/adapters/secondary/caching/CachedProductCatalog.ts
@injectable()
export class CachedProductCatalog implements ProductCatalog {
  constructor(
    private readonly delegate: ProductCatalog,
    private readonly cache: Cache
  ) {}

  async getProduct(productId: string): Promise<Product | null> {
    const cacheKey = `product:${productId}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from delegate
    const product = await this.delegate.getProduct(productId);
    
    // Cache the result
    if (product) {
      await this.cache.set(
        cacheKey,
        JSON.stringify(product),
        300 // 5 minutes TTL
      );
    }

    return product;
  }

  // Implement other methods with caching...
}
```

### 2. Connection Pooling
```typescript
// src/infrastructure/database/ConnectionPool.ts
export class ConnectionPool {
  private pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool({
      ...config,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected pool error', err);
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration });
      return result;
    } catch (error) {
      console.error('Query error', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
  }
}
```

## Monitoring and Observability

### Health Checks
```typescript
// src/infrastructure/health/HealthCheckService.ts
export interface HealthCheck {
  name: string;
  check(): Promise<HealthStatus>;
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  details?: any;
}

@injectable()
export class HealthCheckService {
  constructor(
    private readonly checks: HealthCheck[]
  ) {}

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, HealthStatus>;
  }> {
    const results: Record<string, HealthStatus> = {};
    let allHealthy = true;

    for (const check of this.checks) {
      try {
        results[check.name] = await check.check();
        if (!results[check.name].healthy) {
          allHealthy = false;
        }
      } catch (error: any) {
        results[check.name] = {
          healthy: false,
          message: error.message
        };
        allHealthy = false;
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results
    };
  }
}

// Database health check
export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';

  constructor(private pool: Pool) {}

  async check(): Promise<HealthStatus> {
    try {
      const result = await this.pool.query('SELECT 1');
      return {
        healthy: true,
        message: 'Database connection successful'
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Database connection failed: ${error.message}`
      };
    }
  }
}
```

This comprehensive Hexagonal Architecture pattern document provides:
- Complete domain model implementation
- Clear port definitions for both primary and secondary sides
- Multiple adapter implementations (REST, GraphQL, CLI, Database)
- Testing strategies and examples
- Deployment configuration
- Performance optimization techniques
- Monitoring and observability patterns

The architecture ensures complete isolation of business logic from technical concerns, making the system highly testable and adaptable to technology changes.