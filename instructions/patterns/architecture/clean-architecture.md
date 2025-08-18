# クリーンアーキテクチャ

## 基本原則

### 依存性のルール
依存関係は内側に向かう必要がある。内側の円は外側の円について何も知らない。

```typescript
// 良い例 - 内側レイヤーがインターフェースを定義
// ドメインレイヤー（内側）
interface UserRepository {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
}

// インフラストラクチャレイヤー（外側）
class PostgresUserRepository implements UserRepository {
  async findById(id: string): Promise<User> {
    // PostgreSQL固有の実装
  }
}

// 悪い例 - ドメインがインフラに依存
class User {
  constructor(private db: PostgreSQLConnection) {} // 間違い！
}
```

## レイヤー構造

### 1. エンティティ（ドメイン）
外部が変更されても変わらないビジネスルール。

```typescript
// 良い例 - 純粋なビジネスロジック
class Order {
  private items: OrderItem[] = [];
  
  addItem(product: Product, quantity: number): void {
    if (quantity <= 0) {
      throw new Error('数量は正の値である必要があります');
    }
    this.items.push(new OrderItem(product, quantity));
  }
  
  calculateTotal(): number {
    return this.items.reduce((sum, item) => sum + item.getSubtotal(), 0);
  }
}
```

### 2. ユースケース（アプリケーション）
アプリケーション固有のビジネスルール。エンティティ間のデータフローを調整。

```typescript
// 良い例 - ユースケースの調整
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

### 3. インターフェースアダプター
ユースケースと外部エージェンシー間でデータを変換。

```typescript
// 良い例 - コントローラーアダプター
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
    // HTTPリクエストをユースケースリクエストにマップ
  }
}
```

### 4. フレームワーク＆ドライバー
データベース、Webフレームワーク、UIなどの外部詳細。

```typescript
// 良い例 - インフラストラクチャ実装
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

## 依存性注入

### コンストラクタ注入
外側から内側へ依存関係を配線。

```typescript
// 良い例 - 外側レイヤーから依存関係を注入
// コンポジションルート（main）
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

## テスト戦略

### 各レイヤーを独立してテスト
```typescript
// ドメインレイヤーテスト - 外部依存なし
describe('Order', () => {
  it('合計を正しく計算する', () => {
    const order = new Order('customer123');
    const product = new Product('prod1', 'ウィジェット', 10.00);
    order.addItem(product, 2);
    
    expect(order.calculateTotal()).toBe(20.00);
  });
});

// ユースケーステスト - リポジトリをモック
describe('CreateOrderUseCase', () => {
  it('注文を作成してメールを送信する', async () => {
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

## 共通パターン

### リポジトリパターン
データ永続化を抽象化。

```typescript
// ドメインがインターフェースを定義
interface Repository<T> {
  findById(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// インフラストラクチャが実装
class MongoUserRepository implements Repository<User> {
  // MongoDB固有の実装
}
```

### プレゼンターパターン
ユースケース出力をフォーマット。

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

## ベストプラクティスチェックリスト

- [ ] 依存関係は内側のみに向かう
- [ ] ドメインエンティティは外部依存を持たない
- [ ] ユースケースは調整するがビジネスロジックを実装しない
- [ ] インターフェースは内側レイヤーで定義、外側で実装
- [ ] データベース/フレームワークの詳細は外側レイヤーに隔離
- [ ] 各レイヤーは独立してテスト可能
- [ ] 配線には依存性注入を使用
- [ ] フレームワークとは適切な距離を保つ
- [ ] データベース、フレームワークの決定を遅延
- [ ] UI、データベース、外部サービスなしでビジネスルールをテスト