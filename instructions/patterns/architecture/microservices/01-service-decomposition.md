# Microservices - サービス分割戦略

> ドメイン駆動設計に基づくサービス境界の定義と実装パターン

## 概要

マイクロサービスアーキテクチャの成功は、適切なサービス分割にかかっています。ドメイン駆動設計（DDD）の境界付けられたコンテキスト（Bounded Context）を基準に、ビジネス機能に沿ったサービス境界を設定することが重要です。

## サービス分割の原則

### 1. ビジネス機能による分割

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
```

### 2. 注文サービスの分割例

```typescript
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
```

### 3. ドメインイベントの設計

```typescript
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

export class ProductUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly name: string,
    public readonly price: number,
    public readonly stockQuantity: number
  ) {
    super(aggregateId);
  }
}
```

## サービス境界の決定戦略

### 1. Bounded Contextの特定

```typescript
// Domain Model Mapping
interface BoundedContextMap {
  userManagement: {
    aggregates: ['User', 'UserProfile', 'UserPreferences'];
    services: ['UserService', 'AuthenticationService'];
    events: ['UserCreated', 'UserUpdated', 'UserAuthenticated'];
  };
  
  orderManagement: {
    aggregates: ['Order', 'OrderItem'];
    services: ['OrderService', 'OrderProcessingService'];
    events: ['OrderCreated', 'OrderConfirmed', 'OrderShipped'];
  };
  
  inventory: {
    aggregates: ['Product', 'InventoryItem'];
    services: ['InventoryService', 'StockService'];
    events: ['StockReserved', 'StockConfirmed', 'ProductUpdated'];
  };
  
  payment: {
    aggregates: ['Payment', 'PaymentMethod'];
    services: ['PaymentService', 'RefundService'];
    events: ['PaymentProcessed', 'PaymentFailed', 'RefundIssued'];
  };
}
```

### 2. データ所有権の明確化

```typescript
// services/user-service/src/repository/user.repository.ts
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  // ユーザーサービスが完全に所有
}

// services/order-service/src/repository/order.repository.ts
export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: UserId): Promise<Order[]>;
  // 注文サービスが完全に所有
}

// サービス間でのデータ重複を許容
// services/order-service/src/domain/customer-info.ts
export interface CustomerInfo {
  id: UserId;
  email: Email;
  name: string;
  // 注文処理に必要な最小限のユーザー情報のみ保持
}
```

### 3. 依存関係の管理

```typescript
// services/order-service/src/clients/user-service.client.ts
export interface UserServiceClient {
  getUser(userId: UserId): Promise<UserDetails | null>;
  validateUser(userId: UserId): Promise<boolean>;
  // 必要最小限のインターフェース
}

export class HttpUserServiceClient implements UserServiceClient {
  constructor(
    private httpClient: HttpClient,
    private serviceDiscovery: ServiceDiscovery,
    private circuitBreaker: CircuitBreaker
  ) {}

  async getUser(userId: UserId): Promise<UserDetails | null> {
    return this.circuitBreaker.execute(async () => {
      const serviceUrl = await this.serviceDiscovery.getServiceUrl('user-service');
      const response = await this.httpClient.get(`${serviceUrl}/users/${userId}`);
      return response.data;
    });
  }

  async validateUser(userId: UserId): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user !== null && user.isActive;
    } catch (error) {
      // フォールバック戦略
      console.error('User validation failed, assuming valid', { userId, error });
      return true;
    }
  }
}
```

## サービス間契約の定義

### 1. APIファーストアプローチ

```yaml
# services/user-service/api/openapi.yaml
openapi: 3.0.3
info:
  title: User Service API
  version: 1.0.0
  description: User management service

paths:
  /users:
    post:
      summary: Create new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Invalid input
        '409':
          description: User already exists

  /users/{userId}:
    get:
      summary: Get user by ID
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          description: User not found

components:
  schemas:
    CreateUserRequest:
      type: object
      required:
        - email
        - firstName
        - lastName
      properties:
        email:
          type: string
          format: email
        firstName:
          type: string
          minLength: 1
        lastName:
          type: string
          minLength: 1
    
    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
```

### 2. イベントスキーマの定義

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UserCreatedEvent",
  "type": "object",
  "properties": {
    "eventId": {
      "type": "string",
      "format": "uuid"
    },
    "eventType": {
      "type": "string",
      "const": "UserCreated"
    },
    "aggregateId": {
      "type": "string",
      "format": "uuid"
    },
    "occurredOn": {
      "type": "string",
      "format": "date-time"
    },
    "data": {
      "type": "object",
      "properties": {
        "userId": {
          "type": "string",
          "format": "uuid"
        },
        "email": {
          "type": "string",
          "format": "email"
        },
        "firstName": {
          "type": "string"
        },
        "lastName": {
          "type": "string"
        }
      },
      "required": ["userId", "email", "firstName", "lastName"]
    }
  },
  "required": ["eventId", "eventType", "aggregateId", "occurredOn", "data"]
}
```

## 段階的分割戦略

### Phase 1: モノリス分析

```typescript
// analysis/domain-analysis.ts
interface DomainAnalysis {
  identifyBoundedContexts(): BoundedContext[];
  analyzeDataDependencies(): DataDependencyMap;
  identifyTransactionBoundaries(): TransactionBoundary[];
  assessComplexity(): ComplexityMetrics;
}

class ModularMonolithAnalyzer implements DomainAnalysis {
  constructor(private codebase: Codebase) {}

  identifyBoundedContexts(): BoundedContext[] {
    // コード分析によるドメイン境界の特定
    const modules = this.codebase.getModules();
    return modules
      .filter(module => this.hasDistinctBusinessLogic(module))
      .map(module => this.extractBoundedContext(module));
  }

  analyzeDataDependencies(): DataDependencyMap {
    // データベーステーブル間の結合分析
    const tables = this.codebase.getDatabaseSchema().getTables();
    const dependencies = new Map();
    
    for (const table of tables) {
      const foreignKeys = table.getForeignKeys();
      dependencies.set(table.name, foreignKeys.map(fk => fk.referencedTable));
    }
    
    return dependencies;
  }
}
```

### Phase 2: Strangler Fig パターン

```typescript
// migration/strangler-fig.ts
class StranglerFigMigration {
  constructor(
    private routingService: RoutingService,
    private monolithService: MonolithService,
    private microService: MicroService
  ) {}

  async migrateEndpoint(
    endpoint: string,
    migrationStrategy: MigrationStrategy
  ): Promise<void> {
    switch (migrationStrategy) {
      case 'shadow':
        await this.shadowTraffic(endpoint);
        break;
      case 'canary':
        await this.canaryRelease(endpoint);
        break;
      case 'blue-green':
        await this.blueGreenDeploy(endpoint);
        break;
    }
  }

  private async shadowTraffic(endpoint: string): Promise<void> {
    this.routingService.addRule({
      path: endpoint,
      primary: this.monolithService,
      shadow: this.microService,
      shadowPercent: 100
    });
  }

  private async canaryRelease(endpoint: string): Promise<void> {
    // 段階的にトラフィックを移行
    const stages = [5, 10, 25, 50, 100];
    
    for (const percentage of stages) {
      this.routingService.updateRule(endpoint, {
        primary: this.monolithService,
        canary: this.microService,
        canaryPercent: percentage
      });
      
      await this.monitorHealth(endpoint, '10m');
      
      if (!this.isHealthy(endpoint)) {
        await this.rollback(endpoint);
        throw new MigrationError('Health check failed');
      }
    }
  }
}
```

## データ同期戦略

### 1. Change Data Capture (CDC)

```typescript
// data-sync/cdc-processor.ts
export class CDCProcessor {
  constructor(
    private eventStore: EventStore,
    private targetServices: Map<string, ServiceClient>
  ) {}

  async processChange(change: DatabaseChange): Promise<void> {
    const events = this.mapChangeToEvents(change);
    
    for (const event of events) {
      // イベントストアに保存
      await this.eventStore.append(event);
      
      // 関連サービスに通知
      const interestedServices = this.getInterestedServices(event.type);
      for (const service of interestedServices) {
        await service.notify(event);
      }
    }
  }

  private mapChangeToEvents(change: DatabaseChange): DomainEvent[] {
    switch (change.table) {
      case 'users':
        if (change.operation === 'INSERT') {
          return [new UserCreatedEvent(change.newValues)];
        }
        if (change.operation === 'UPDATE') {
          return [new UserUpdatedEvent(change.oldValues, change.newValues)];
        }
        break;
      
      case 'orders':
        // 注文関連イベントのマッピング
        break;
    }
    
    return [];
  }
}
```

### 2. 双方向同期

```typescript
// data-sync/bidirectional-sync.ts
export class BidirectionalSyncService {
  constructor(
    private sourceService: ServiceClient,
    private targetService: ServiceClient,
    private conflictResolver: ConflictResolver
  ) {}

  async synchronize(): Promise<void> {
    const sourceChanges = await this.sourceService.getChanges();
    const targetChanges = await this.targetService.getChanges();
    
    // 競合検出
    const conflicts = this.detectConflicts(sourceChanges, targetChanges);
    
    if (conflicts.length > 0) {
      const resolutions = await this.conflictResolver.resolve(conflicts);
      await this.applyResolutions(resolutions);
    }
    
    // 変更の適用
    await this.applyChangesToTarget(sourceChanges);
    await this.applyChangesToSource(targetChanges);
  }

  private detectConflicts(
    sourceChanges: Change[],
    targetChanges: Change[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    
    for (const sourceChange of sourceChanges) {
      const conflictingTargetChange = targetChanges.find(
        tc => tc.entityId === sourceChange.entityId && 
             tc.timestamp > sourceChange.timestamp
      );
      
      if (conflictingTargetChange) {
        conflicts.push({
          entityId: sourceChange.entityId,
          sourceChange,
          targetChange: conflictingTargetChange
        });
      }
    }
    
    return conflicts;
  }
}
```

## ベストプラクティス

### 1. サービス粒度の決定原則
- **Team Size Rule**: 2ピザルール（6-8人のチーム）
- **Data Cohesion**: 高度に関連するデータを一つのサービスに
- **Business Capability**: 明確なビジネス機能の境界
- **Change Frequency**: 変更頻度が似ているコンポーネント

### 2. 段階的移行
```typescript
// migration/gradual-migration.ts
class GradualMigrationPlan {
  phases: MigrationPhase[] = [
    {
      name: 'User Service Extraction',
      priority: 'HIGH',
      dependencies: [],
      estimatedWeeks: 4
    },
    {
      name: 'Product Catalog Service',
      priority: 'MEDIUM', 
      dependencies: ['User Service'],
      estimatedWeeks: 6
    },
    {
      name: 'Order Processing Service',
      priority: 'HIGH',
      dependencies: ['User Service', 'Product Catalog Service'],
      estimatedWeeks: 8
    }
  ];

  getExecutionOrder(): MigrationPhase[] {
    return this.topologicalSort(this.phases);
  }
}
```

### 3. 失敗時の対応策
- **Circuit Breaker**: 障害の伝播防止
- **Fallback Strategy**: 代替処理の定義
- **Graceful Degradation**: 機能縮退での継続
- **Rollback Plan**: 迅速な復旧手順

サービス分割は一度で完璧に行う必要はありません。段階的なアプローチで継続的に改善し、ビジネス価値の最大化を目指しましょう。