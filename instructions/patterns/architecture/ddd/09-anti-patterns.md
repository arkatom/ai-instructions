# DDDアンチパターン

## よくある失敗パターン

### 1. 貧血ドメインモデル

```typescript
// ❌ アンチパターン：ロジックのないデータホルダー
export class Product {
  public id: string;
  public name: string;
  public price: number;
  public status: string;
}

export class ProductService {
  changePrice(product: Product, newPrice: number): void {
    if (product.status === 'DISCONTINUED') {
      throw new Error('Cannot change price');
    }
    product.price = newPrice;
  }
}

// ✅ 正しい実装：ビジネスロジックを持つドメインモデル
export class Product {
  private _price: Price;
  private _status: ProductStatus;

  changePrice(newPrice: Price, reason: string): void {
    if (this._status === ProductStatus.DISCONTINUED) {
      throw new DomainError('Cannot change price of discontinued product');
    }
    
    this._price = newPrice;
    this.addDomainEvent(new ProductPriceChangedEvent(this.id, newPrice, reason));
  }
}
```

### 2. 過度に大きいアグリゲート

```typescript
// ❌ アンチパターン：巨大なアグリゲート
export class Order {
  private customer: Customer;  // 顧客全体を含む
  private products: Product[]; // 商品全体を含む
  private warehouse: Warehouse; // 倉庫全体を含む
  private shipments: Shipment[]; // 配送情報全体を含む
}

// ✅ 正しい実装：適切な境界
export class Order {
  private customerId: CustomerId; // IDで参照
  private orderLines: OrderLine[]; // 必要最小限の情報
  private shippingAddress: Address; // 値オブジェクト
}
```

### 3. ドメインサービスの乱用

```typescript
// ❌ アンチパターン：エンティティの責務をサービスに移動
export class OrderService {
  addItem(order: Order, product: Product, quantity: number): void {
    const orderLine = new OrderLine(product.id, quantity, product.price);
    order.orderLines.push(orderLine);
    order.totalAmount = this.calculateTotal(order.orderLines);
  }

  cancel(order: Order, reason: string): void {
    order.status = 'CANCELLED';
    order.cancelReason = reason;
  }
}

// ✅ 正しい実装：エンティティ自身が責務を持つ
export class Order {
  addItem(productId: ProductId, quantity: Quantity, unitPrice: Money): void {
    const orderLine = OrderLine.create(productId, quantity, unitPrice);
    this._orderLines.push(orderLine);
    this.recalculateTotal();
  }

  cancel(reason: string): void {
    if (this._status === OrderStatus.SHIPPED) {
      throw new DomainError('Cannot cancel shipped order');
    }
    this._status = OrderStatus.CANCELLED;
    this.addDomainEvent(new OrderCancelledEvent(this.id, reason));
  }
}
```

### 4. 不適切なコンテキスト境界

```typescript
// ❌ アンチパターン：異なる関心事を混在
export class Product {
  // カタログコンテキスト
  private name: string;
  private description: string;
  
  // 在庫コンテキスト
  private stockQuantity: number;
  private warehouseLocation: string;
  
  // 注文コンテキスト
  private orderCount: number;
  private lastOrderDate: Date;
  
  // 価格コンテキスト
  private purchasePrice: number;
  private sellingPrice: number;
  private profitMargin: number;
}

// ✅ 正しい実装：コンテキストごとに分離
// カタログコンテキスト
export class CatalogProduct {
  private name: ProductName;
  private description: ProductDescription;
}

// 在庫コンテキスト
export class InventoryItem {
  private productId: ProductId;
  private quantity: Quantity;
  private location: WarehouseLocation;
}

// 価格コンテキスト
export class PricedProduct {
  private productId: ProductId;
  private sellingPrice: Money;
  private costPrice: Money;
}
```

### 5. 過度な技術的複雑性

```typescript
// ❌ アンチパターン：シンプルなドメインに過度な抽象化
export abstract class BaseEntity<T> {
  abstract accept(visitor: EntityVisitor<T>): T;
}

export class ProductAggregate extends BaseEntity<Product> 
  implements IAggregate, IEventSourced, IVersioned {
  // 過度に複雑な実装
}

// ✅ 正しい実装：必要十分なシンプルさ
export class Product {
  private id: ProductId;
  private name: string;
  private price: Money;

  changePrice(newPrice: Money): void {
    this.price = newPrice;
  }
}
```

### 6. 永続化の詳細がドメインに漏れる

```typescript
// ❌ アンチパターン：ORMアノテーションがドメインに
@Entity()
@Table('products')
export class Product {
  @PrimaryColumn()
  id: string;

  @Column({ length: 200 })
  name: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}

// ✅ 正しい実装：純粋なドメインモデル
export class Product {
  constructor(
    private readonly id: ProductId,
    private name: ProductName,
    private category: CategoryId
  ) {}
}

// インフラ層でマッピング
export class ProductMapper {
  toDomain(entity: ProductEntity): Product {
    return new Product(
      ProductId.create(entity.id),
      ProductName.create(entity.name),
      CategoryId.create(entity.categoryId)
    );
  }
}
```