# Microservices Architecture - 実装パターン集

> マイクロサービスアーキテクチャの設計と実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **技術スタック**: Docker, Kubernetes, Service Mesh, API Gateway

## 🎯 中核概念と設計原則

### 1. サービス分割戦略

```typescript
// services/user-service/src/domain/user.ts
export interface User {
  id: UserId;
  email: Email;
  profile: UserProfile;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async createUser(command: CreateUserCommand): Promise<User> {
    // ドメインバリデーション
    const user = User.create(command);
    
    // 永続化
    await this.userRepository.save(user);
    
    // ドメインイベント発行
    await this.eventBus.publish(
      new UserCreatedEvent(user.id, user.email)
    );
    
    this.logger.info('User created', { userId: user.id });
    
    return user;
  }

  async updateUserProfile(
    userId: UserId, 
    profile: UserProfile
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.updateProfile(profile);
    await this.userRepository.save(user);

    await this.eventBus.publish(
      new UserProfileUpdatedEvent(userId, profile)
    );
  }
}

// services/order-service/src/domain/order.ts
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private userServiceClient: UserServiceClient,
    private inventoryServiceClient: InventoryServiceClient,
    private paymentServiceClient: PaymentServiceClient,
    private eventBus: EventBus
  ) {}

  async createOrder(command: CreateOrderCommand): Promise<Order> {
    // 分散トランザクション（Sagaパターン）
    const saga = new CreateOrderSaga(
      this.userServiceClient,
      this.inventoryServiceClient,
      this.paymentServiceClient,
      this.orderRepository
    );

    try {
      const order = await saga.execute(command);
      
      await this.eventBus.publish(
        new OrderCreatedEvent(order.id, order.customerId, order.items)
      );
      
      return order;
    } catch (error) {
      // 補償トランザクション実行
      await saga.compensate();
      throw error;
    }
  }
}

// shared/domain/events.ts
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;

  constructor(public readonly aggregateId: string) {
    this.occurredOn = new Date();
    this.eventId = crypto.randomUUID();
  }
}

export class UserCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly email: string
  ) {
    super(aggregateId);
  }
}

export class OrderCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly customerId: string,
    public readonly items: OrderItem[]
  ) {
    super(aggregateId);
  }
}
```

### 2. Service Mesh とサービス間通信

```yaml
# infrastructure/istio/destination-rules.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service
spec:
  host: user-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    circuitBreaker:
      consecutiveGatewayErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    retryPolicy:
      attempts: 3
      perTryTimeout: 5s
      retryOn: gateway-error,connect-failure,refused-stream
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: user-service
spec:
  hosts:
  - user-service
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: user-service
        subset: v2
      weight: 100
  - route:
    - destination:
        host: user-service
        subset: v1
      weight: 90
    - destination:
        host: user-service
        subset: v2
      weight: 10
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
```

### 3. API Gateway パターン

```typescript
// api-gateway/src/gateway.ts
import express from 'express';
import httpProxy from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { authenticate, authorize } from './middleware/auth';
import { requestLogging } from './middleware/logging';
import { circuitBreaker } from './middleware/circuit-breaker';

export class APIGateway {
  private app: express.Application;
  private serviceRegistry: ServiceRegistry;

  constructor(serviceRegistry: ServiceRegistry) {
    this.app = express();
    this.serviceRegistry = serviceRegistry;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // セキュリティヘッダー
    this.app.use(helmet());

    // レート制限
    this.app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: 1000, // リクエスト数制限
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    }));

    // ログ
    this.app.use(requestLogging);

    // 認証
    this.app.use('/api', authenticate);
  }

  private setupRoutes(): void {
    // ユーザーサービス
    this.app.use('/api/users', 
      authorize(['user:read', 'user:write']),
      circuitBreaker('user-service'),
      this.createProxy('user-service')
    );

    // 注文サービス
    this.app.use('/api/orders',
      authorize(['order:read', 'order:write']),
      circuitBreaker('order-service'),
      this.createProxy('order-service')
    );

    // 在庫サービス
    this.app.use('/api/inventory',
      authorize(['inventory:read']),
      circuitBreaker('inventory-service'),
      this.createProxy('inventory-service')
    );

    // GraphQL Federation
    this.app.use('/graphql', this.createGraphQLGateway());
  }

  private createProxy(serviceName: string): express.RequestHandler {
    return httpProxy({
      target: () => this.serviceRegistry.getServiceUrl(serviceName),
      changeOrigin: true,
      pathRewrite: {
        [`^/api/${serviceName}`]: ''
      },
      onProxyReq: (proxyReq, req, res) => {
        // リクエストヘッダーに追加情報を設定
        proxyReq.setHeader('X-User-ID', req.user?.id);
        proxyReq.setHeader('X-Request-ID', req.requestId);
        proxyReq.setHeader('X-Correlation-ID', req.correlationId);
      },
      onError: (err, req, res) => {
        console.error(`Proxy error for ${serviceName}:`, err);
        res.status(503).json({
          error: 'Service temporarily unavailable',
          service: serviceName
        });
      }
    });
  }

  private createGraphQLGateway(): express.RequestHandler {
    const { ApolloGateway } = require('@apollo/gateway');
    const { ApolloServer } = require('apollo-server-express');

    const gateway = new ApolloGateway({
      serviceList: [
        { name: 'users', url: 'http://user-service:4000/graphql' },
        { name: 'orders', url: 'http://order-service:4000/graphql' },
        { name: 'inventory', url: 'http://inventory-service:4000/graphql' },
      ],
      buildService({ url }) {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest({ request, context }) {
            request.http.headers.set('user-id', context.userId);
            request.http.headers.set('authorization', context.authToken);
          }
        });
      }
    });

    const server = new ApolloServer({
      gateway,
      subscriptions: false,
      context: ({ req }) => ({
        userId: req.user?.id,
        authToken: req.headers.authorization
      })
    });

    return server.getMiddleware({ path: '/graphql' });
  }
}

// api-gateway/src/middleware/circuit-breaker.ts
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
}

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const defaultOptions: CircuitBreakerOptions = {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10
      };

      const breaker = new CircuitBreaker(() => {}, {
        ...defaultOptions,
        ...options
      });

      // イベントリスナー
      breaker.on('open', () => {
        console.log(`Circuit breaker opened for ${serviceName}`);
      });

      breaker.on('halfOpen', () => {
        console.log(`Circuit breaker half-opened for ${serviceName}`);
      });

      breaker.on('close', () => {
        console.log(`Circuit breaker closed for ${serviceName}`);
      });

      this.breakers.set(serviceName, breaker);
    }

    return this.breakers.get(serviceName)!;
  }
}

const circuitBreakerRegistry = new CircuitBreakerRegistry();

export function circuitBreaker(serviceName: string) {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName);

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (breaker.opened) {
      return res.status(503).json({
        error: 'Service circuit breaker is open',
        service: serviceName
      });
    }
    next();
  };
}
```

### 4. Event-Driven Communication

```typescript
// shared/infrastructure/event-bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string, 
    handler: EventHandler<T>
  ): Promise<void>;
}

export class RabbitMQEventBus implements EventBus {
  constructor(
    private connection: Connection,
    private logger: Logger
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    const channel = await this.connection.createChannel();
    
    try {
      const exchange = 'domain_events';
      const routingKey = event.constructor.name;
      
      await channel.assertExchange(exchange, 'topic', { durable: true });
      
      const message = JSON.stringify({
        eventId: event.eventId,
        eventType: event.constructor.name,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        data: event
      });

      await channel.publish(
        exchange,
        routingKey,
        Buffer.from(message),
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: event.occurredOn.getTime(),
          headers: {
            'event-type': event.constructor.name,
            'aggregate-id': event.aggregateId
          }
        }
      );

      this.logger.info('Event published', {
        eventId: event.eventId,
        eventType: event.constructor.name,
        aggregateId: event.aggregateId
      });

    } finally {
      await channel.close();
    }
  }

  async subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<void> {
    const channel = await this.connection.createChannel();
    const exchange = 'domain_events';
    const queue = `${eventType}_handler_${crypto.randomUUID()}`;

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { 
      durable: true,
      exclusive: false,
      autoDelete: false 
    });

    await channel.bindQueue(queue, exchange, eventType);

    await channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const eventData = JSON.parse(msg.content.toString());
        const event = this.deserializeEvent<T>(eventData);

        await handler.handle(event);
        
        channel.ack(msg);
        
        this.logger.info('Event processed successfully', {
          eventId: eventData.eventId,
          eventType: eventData.eventType,
          handler: handler.constructor.name
        });

      } catch (error) {
        this.logger.error('Event processing failed', {
          error: error.message,
          eventType,
          handler: handler.constructor.name
        });

        // デッドレターキューに送信
        channel.nack(msg, false, false);
      }
    });
  }

  private deserializeEvent<T extends DomainEvent>(eventData: any): T {
    // イベントタイプに基づいてデシリアライズ
    const eventClass = this.getEventClass(eventData.eventType);
    return Object.assign(new eventClass(), eventData.data);
  }

  private getEventClass(eventType: string): any {
    const eventClasses = {
      'UserCreatedEvent': UserCreatedEvent,
      'OrderCreatedEvent': OrderCreatedEvent,
      'PaymentProcessedEvent': PaymentProcessedEvent,
      // ... 他のイベントクラス
    };
    
    return eventClasses[eventType];
  }
}

// services/notification-service/src/handlers/user-events.ts
export class UserCreatedEventHandler implements EventHandler<UserCreatedEvent> {
  constructor(
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    this.logger.info('Processing UserCreatedEvent', {
      eventId: event.eventId,
      userId: event.aggregateId,
      email: event.email
    });

    try {
      // ウェルカムメール送信
      await this.emailService.sendWelcomeEmail({
        to: event.email,
        userId: event.aggregateId,
        templateData: {
          welcomeMessage: 'Welcome to our platform!'
        }
      });

      // アナリティクスイベント送信
      await this.analyticsService.trackUserRegistration({
        userId: event.aggregateId,
        email: event.email,
        registrationDate: event.occurredOn
      });

    } catch (error) {
      this.logger.error('Failed to process UserCreatedEvent', {
        eventId: event.eventId,
        userId: event.aggregateId,
        error: error.message
      });
      throw error; // リトライするために再スロー
    }
  }
}

// services/order-service/src/handlers/inventory-events.ts
export class InventoryReservedEventHandler implements EventHandler<InventoryReservedEvent> {
  constructor(
    private orderService: OrderService,
    private paymentServiceClient: PaymentServiceClient,
    private logger: Logger
  ) {}

  async handle(event: InventoryReservedEvent): Promise<void> {
    const { orderId, items } = event;

    this.logger.info('Processing InventoryReservedEvent', {
      eventId: event.eventId,
      orderId,
      items: items.length
    });

    try {
      // 注文ステータス更新
      await this.orderService.updateOrderStatus(orderId, 'INVENTORY_RESERVED');

      // 決済処理を開始
      const paymentRequest = {
        orderId,
        amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        currency: 'USD'
      };

      await this.paymentServiceClient.processPayment(paymentRequest);

    } catch (error) {
      this.logger.error('Failed to process InventoryReservedEvent', {
        eventId: event.eventId,
        orderId,
        error: error.message
      });

      // 在庫予約をキャンセル
      await this.inventoryServiceClient.cancelReservation(orderId);
      await this.orderService.updateOrderStatus(orderId, 'FAILED');
      
      throw error;
    }
  }
}
```

### 5. Saga パターン（分散トランザクション）

```typescript
// shared/patterns/saga.ts
export interface SagaStep {
  execute(): Promise<void>;
  compensate(): Promise<void>;
}

export abstract class Saga {
  protected steps: SagaStep[] = [];
  protected executedSteps: SagaStep[] = [];

  async execute(): Promise<void> {
    try {
      for (const step of this.steps) {
        await step.execute();
        this.executedSteps.push(step);
      }
    } catch (error) {
      await this.compensate();
      throw error;
    }
  }

  async compensate(): Promise<void> {
    // 実行済みステップを逆順で補償
    const stepsToCompensate = [...this.executedSteps].reverse();
    
    for (const step of stepsToCompensate) {
      try {
        await step.compensate();
      } catch (compensationError) {
        // 補償処理の失敗はログに記録して続行
        console.error('Compensation failed:', compensationError);
      }
    }
    
    this.executedSteps = [];
  }
}

// services/order-service/src/sagas/create-order-saga.ts
export class CreateOrderSaga extends Saga {
  private order: Order;

  constructor(
    private orderRepository: OrderRepository,
    private userServiceClient: UserServiceClient,
    private inventoryServiceClient: InventoryServiceClient,
    private paymentServiceClient: PaymentServiceClient,
    private command: CreateOrderCommand
  ) {
    super();
    this.setupSteps();
  }

  private setupSteps(): void {
    this.steps = [
      new ValidateUserStep(this.userServiceClient, this.command.customerId),
      new CreateOrderStep(this.orderRepository, this.command),
      new ReserveInventoryStep(this.inventoryServiceClient, this.command.items),
      new ProcessPaymentStep(this.paymentServiceClient, this.command),
      new ConfirmOrderStep(this.orderRepository)
    ];
  }

  async execute(): Promise<Order> {
    await super.execute();
    return this.order;
  }

  setOrder(order: Order): void {
    this.order = order;
  }

  getOrder(): Order {
    return this.order;
  }
}

class ValidateUserStep implements SagaStep {
  constructor(
    private userServiceClient: UserServiceClient,
    private customerId: string
  ) {}

  async execute(): Promise<void> {
    const user = await this.userServiceClient.getUser(this.customerId);
    if (!user) {
      throw new Error(`User not found: ${this.customerId}`);
    }
    if (!user.isActive) {
      throw new Error(`User is not active: ${this.customerId}`);
    }
  }

  async compensate(): Promise<void> {
    // ユーザー検証は補償処理不要
  }
}

class CreateOrderStep implements SagaStep {
  private orderId?: string;

  constructor(
    private orderRepository: OrderRepository,
    private command: CreateOrderCommand
  ) {}

  async execute(): Promise<void> {
    const order = new Order({
      customerId: this.command.customerId,
      items: this.command.items,
      status: 'PENDING'
    });

    await this.orderRepository.save(order);
    this.orderId = order.id;
  }

  async compensate(): Promise<void> {
    if (this.orderId) {
      await this.orderRepository.delete(this.orderId);
    }
  }
}

class ReserveInventoryStep implements SagaStep {
  private reservationId?: string;

  constructor(
    private inventoryServiceClient: InventoryServiceClient,
    private items: OrderItem[]
  ) {}

  async execute(): Promise<void> {
    const reservation = await this.inventoryServiceClient.reserveItems({
      items: this.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    });

    this.reservationId = reservation.id;
  }

  async compensate(): Promise<void> {
    if (this.reservationId) {
      await this.inventoryServiceClient.cancelReservation(this.reservationId);
    }
  }
}

class ProcessPaymentStep implements SagaStep {
  private paymentId?: string;

  constructor(
    private paymentServiceClient: PaymentServiceClient,
    private command: CreateOrderCommand
  ) {}

  async execute(): Promise<void> {
    const totalAmount = this.command.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    );

    const payment = await this.paymentServiceClient.processPayment({
      customerId: this.command.customerId,
      amount: totalAmount,
      currency: 'USD',
      paymentMethod: this.command.paymentMethod
    });

    this.paymentId = payment.id;
  }

  async compensate(): Promise<void> {
    if (this.paymentId) {
      await this.paymentServiceClient.refundPayment(this.paymentId);
    }
  }
}

class ConfirmOrderStep implements SagaStep {
  constructor(private orderRepository: OrderRepository) {}

  async execute(): Promise<void> {
    // 注文ステータスを確定に更新
    const order = await this.orderRepository.findById(this.orderId);
    order.confirm();
    await this.orderRepository.save(order);
  }

  async compensate(): Promise<void> {
    // 注文を失敗状態に更新
    const order = await this.orderRepository.findById(this.orderId);
    order.markAsFailed();
    await this.orderRepository.save(order);
  }
}
```

### 6. Service Discovery とロードバランシング

```typescript
// shared/infrastructure/service-discovery.ts
export interface ServiceInstance {
  id: string;
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl: string;
  metadata: Record<string, string>;
}

export interface ServiceRegistry {
  register(instance: ServiceInstance): Promise<void>;
  deregister(instanceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  getServiceUrl(serviceName: string): Promise<string>;
}

export class ConsulServiceRegistry implements ServiceRegistry {
  constructor(
    private consul: consul.Consul,
    private logger: Logger
  ) {}

  async register(instance: ServiceInstance): Promise<void> {
    const check = {
      http: instance.healthCheckUrl,
      interval: '10s',
      timeout: '5s',
      deregistercriticalserviceafter: '30s'
    };

    await this.consul.agent.service.register({
      id: instance.id,
      name: instance.serviceName,
      address: instance.host,
      port: instance.port,
      check,
      tags: Object.entries(instance.metadata).map(([key, value]) => `${key}=${value}`)
    });

    this.logger.info('Service registered', {
      instanceId: instance.id,
      serviceName: instance.serviceName,
      address: `${instance.host}:${instance.port}`
    });
  }

  async deregister(instanceId: string): Promise<void> {
    await this.consul.agent.service.deregister(instanceId);
    this.logger.info('Service deregistered', { instanceId });
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    const { services } = await this.consul.health.service({
      service: serviceName,
      passing: true
    });

    return services.map(service => ({
      id: service.Service.ID,
      serviceName: service.Service.Service,
      host: service.Service.Address || service.Node.Address,
      port: service.Service.Port,
      healthCheckUrl: `http://${service.Service.Address}:${service.Service.Port}/health`,
      metadata: this.parseMetadata(service.Service.Tags)
    }));
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.discover(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances found for service: ${serviceName}`);
    }

    // 簡単なラウンドロビン
    const instance = instances[Math.floor(Math.random() * instances.length)];
    return `http://${instance.host}:${instance.port}`;
  }

  private parseMetadata(tags: string[]): Record<string, string> {
    const metadata: Record<string, string> = {};
    
    for (const tag of tags) {
      const [key, value] = tag.split('=');
      if (key && value) {
        metadata[key] = value;
      }
    }
    
    return metadata;
  }
}

// shared/infrastructure/load-balancer.ts
export interface LoadBalancer {
  selectInstance(instances: ServiceInstance[]): ServiceInstance;
}

export class RoundRobinLoadBalancer implements LoadBalancer {
  private counters = new Map<string, number>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available');
    }

    const serviceName = instances[0].serviceName;
    const counter = this.counters.get(serviceName) || 0;
    const selectedInstance = instances[counter % instances.length];
    
    this.counters.set(serviceName, counter + 1);
    
    return selectedInstance;
  }
}

export class WeightedRoundRobinLoadBalancer implements LoadBalancer {
  private weightedInstances = new Map<string, WeightedInstance[]>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    const serviceName = instances[0].serviceName;
    
    if (!this.weightedInstances.has(serviceName)) {
      this.initializeWeights(serviceName, instances);
    }

    const weightedInstances = this.weightedInstances.get(serviceName)!;
    
    // 重み付きラウンドロビン
    for (const weightedInstance of weightedInstances) {
      if (weightedInstance.currentWeight < weightedInstance.weight) {
        weightedInstance.currentWeight++;
        return weightedInstance.instance;
      }
    }

    // すべての重みが消費された場合、リセット
    weightedInstances.forEach(wi => wi.currentWeight = 0);
    return this.selectInstance(instances);
  }

  private initializeWeights(serviceName: string, instances: ServiceInstance[]): void {
    const weightedInstances = instances.map(instance => ({
      instance,
      weight: parseInt(instance.metadata.weight || '1'),
      currentWeight: 0
    }));

    this.weightedInstances.set(serviceName, weightedInstances);
  }
}

interface WeightedInstance {
  instance: ServiceInstance;
  weight: number;
  currentWeight: number;
}

// shared/infrastructure/service-client.ts
export class ServiceClient {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private loadBalancer: LoadBalancer,
    private httpClient: AxiosInstance,
    private circuitBreaker: CircuitBreaker
  ) {}

  async get<T>(serviceName: string, path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest(serviceName, 'GET', path, undefined, config);
  }

  async post<T>(
    serviceName: string, 
    path: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.makeRequest(serviceName, 'POST', path, data, config);
  }

  async put<T>(
    serviceName: string, 
    path: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.makeRequest(serviceName, 'PUT', path, data, config);
  }

  async delete<T>(serviceName: string, path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.makeRequest(serviceName, 'DELETE', path, undefined, config);
  }

  private async makeRequest<T>(
    serviceName: string,
    method: string,
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.circuitBreaker.fire(async () => {
      const instances = await this.serviceRegistry.discover(serviceName);
      const selectedInstance = this.loadBalancer.selectInstance(instances);
      
      const url = `http://${selectedInstance.host}:${selectedInstance.port}${path}`;
      
      const response = await this.httpClient.request({
        method,
        url,
        data,
        ...config,
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': serviceName,
          'X-Request-ID': crypto.randomUUID(),
          ...config?.headers
        }
      });

      return response.data;
    });
  }
}
```

### 7. 観測可能性（Observability）

```typescript
// shared/monitoring/tracing.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export class TracingService {
  private tracer = trace.getTracer('microservices-app');

  createSpan(name: string, parentContext?: any) {
    return this.tracer.startSpan(name, {}, parentContext);
  }

  async traceAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName);
    
    if (attributes) {
      span.setAttributes(attributes);
    }

    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  propagateContext(headers: Record<string, string>): Record<string, string> {
    const activeContext = context.active();
    const propagatedHeaders: Record<string, string> = {};
    
    // OpenTelemetryのコンテキスト伝播
    trace.setSpanContext(activeContext, trace.getActiveSpan()?.spanContext());
    
    return { ...headers, ...propagatedHeaders };
  }
}

// shared/monitoring/metrics.ts
import { metrics } from '@opentelemetry/api-metrics';
import { MeterProvider } from '@opentelemetry/sdk-metrics-base';

export class MetricsService {
  private meter = metrics.getMeter('microservices-app');
  
  // カウンター
  private requestCounter = this.meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests'
  });

  private errorCounter = this.meter.createCounter('http_errors_total', {
    description: 'Total number of HTTP errors'
  });

  // ヒストグラム
  private responseTimeHistogram = this.meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds'
  });

  // ゲージ
  private activeConnectionsGauge = this.meter.createObservableGauge('active_connections', {
    description: 'Number of active connections'
  });

  recordRequest(method: string, path: string, statusCode: number, duration: number): void {
    const labels = { method, path, status_code: statusCode.toString() };
    
    this.requestCounter.add(1, labels);
    this.responseTimeHistogram.record(duration, labels);
    
    if (statusCode >= 400) {
      this.errorCounter.add(1, labels);
    }
  }

  recordBusinessMetric(metricName: string, value: number, attributes?: Record<string, string>): void {
    const counter = this.meter.createCounter(metricName);
    counter.add(value, attributes);
  }
}

// shared/monitoring/health-check.ts
export interface HealthCheck {
  name: string;
  check(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  details?: Record<string, any>;
}

export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';

  constructor(private database: Database) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.database.query('SELECT 1');
      return { status: 'UP' };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: error.message }
      };
    }
  }
}

export class ExternalServiceHealthCheck implements HealthCheck {
  constructor(
    public name: string,
    private serviceClient: ServiceClient,
    private serviceName: string
  ) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.serviceClient.get(this.serviceName, '/health');
      return { status: 'UP' };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { error: error.message }
      };
    }
  }
}

export class HealthService {
  private healthChecks: HealthCheck[] = [];

  addHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.push(healthCheck);
  }

  async getHealth(): Promise<{ status: string; checks: Record<string, HealthStatus> }> {
    const checks: Record<string, HealthStatus> = {};
    let overallStatus = 'UP';

    for (const healthCheck of this.healthChecks) {
      try {
        const status = await healthCheck.check();
        checks[healthCheck.name] = status;
        
        if (status.status !== 'UP') {
          overallStatus = status.status === 'DEGRADED' ? 'DEGRADED' : 'DOWN';
        }
      } catch (error) {
        checks[healthCheck.name] = {
          status: 'DOWN',
          details: { error: error.message }
        };
        overallStatus = 'DOWN';
      }
    }

    return { status: overallStatus, checks };
  }
}
```

### 8. Kubernetesデプロイメント

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: microservices-app
  labels:
    name: microservices-app

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: microservices-app
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  TRACING_ENABLED: "true"
  METRICS_ENABLED: "true"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: microservices-app
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  redis-url: <base64-encoded-redis-url>
  jwt-secret: <base64-encoded-jwt-secret>

---
# k8s/user-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: microservices-app
  labels:
    app: user-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
      version: v1
  template:
    metadata:
      labels:
        app: user-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: user-service
        image: user-service:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config-volume
        configMap:
          name: app-config

---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: microservices-app
  labels:
    app: user-service
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: ClusterIP

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: microservices-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

---
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: user-service-network-policy
  namespace: microservices-app
spec:
  podSelector:
    matchLabels:
      app: user-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53

---
# k8s/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: user-service
  namespace: microservices-app
  labels:
    app: user-service
spec:
  selector:
    matchLabels:
      app: user-service
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: microservices-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
```

このマイクロサービスアーキテクチャパターン集は以下の要素を包含しています：

1. **サービス分割戦略**: ドメイン駆動設計に基づいたサービス境界
2. **Service Mesh**: Istio による通信制御とセキュリティ
3. **API Gateway**: 統一されたエントリーポイントと認証・認可
4. **Event-Driven通信**: RabbitMQによる非同期メッセージング
5. **Sagaパターン**: 分散トランザクション管理
6. **Service Discovery**: Consulによるサービス発見とロードバランシング
7. **観測可能性**: OpenTelemetryによるトレーシングとメトリクス
8. **Kubernetesデプロイ**: 本番環境での運用設定

これらのパターンにより、スケーラブルで復元力の高いマイクロサービスアーキテクチャを構築できます。