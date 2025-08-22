# Domain-Driven Design (DDD) - 実装パターン集

> ドメイン駆動設計の戦術的・戦略的パターンと実装
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **技術スタック**: TypeScript, Node.js, クリーンアーキテクチャ

## 🎯 戦略的設計パターン

### 1. Bounded Context とドメインモデリング

```typescript
// shared/domain/bounded-context.ts
export interface BoundedContext {
  name: string;
  description: string;
  ubiquitousLanguage: Map<string, string>;
  domainServices: string[];
  aggregates: string[];
  valueObjects: string[];
  domainEvents: string[];
}

// catalog/domain/catalog-context.ts
export class CatalogContext implements BoundedContext {
  readonly name = 'Catalog';
  readonly description = '製品カタログ管理と検索を担当するコンテキスト';
  
  readonly ubiquitousLanguage = new Map([
    ['Product', '販売可能な商品アイテム'],
    ['Category', '商品の分類体系'],
    ['SKU', 'Stock Keeping Unit - 在庫管理単位'],
    ['Specification', '商品の仕様・特性'],
    ['Variant', '商品のバリエーション（色、サイズなど）'],
    ['Brand', '商品ブランド'],
    ['Price', '商品価格（税抜）'],
    ['Availability', '商品の入手可能性']
  ]);

  readonly domainServices = [
    'ProductCatalogService',
    'PricingService',
    'InventoryAvailabilityService',
    'ProductRecommendationService'
  ];

  readonly aggregates = ['Product', 'Category', 'Brand'];
  readonly valueObjects = ['SKU', 'Price', 'ProductSpecification', 'ProductImage'];
  readonly domainEvents = [
    'ProductAdded',
    'ProductUpdated', 
    'ProductDiscontinued',
    'CategoryCreated',
    'PriceChanged'
  ];
}

// inventory/domain/inventory-context.ts
export class InventoryContext implements BoundedContext {
  readonly name = 'Inventory';
  readonly description = '在庫管理と入出庫を担当するコンテキスト';
  
  readonly ubiquitousLanguage = new Map([
    ['Stock', '実際の在庫数量'],
    ['Reservation', '在庫の予約・引当て'],
    ['StockLevel', '在庫レベル（適正在庫、安全在庫など）'],
    ['Warehouse', '倉庫・保管場所'],
    ['StockMovement', '在庫の入出庫履歴'],
    ['Allocation', '在庫の割り当て'],
    ['Replenishment', '在庫補充'],
    ['StockOut', '在庫切れ状態']
  ]);

  readonly domainServices = [
    'InventoryAllocationService',
    'ReplenishmentPlanningService',
    'StockLevelOptimizationService'
  ];

  readonly aggregates = ['StockItem', 'Warehouse', 'StockMovement'];
  readonly valueObjects = ['Quantity', 'StockLevel', 'Location'];
  readonly domainEvents = [
    'StockAllocated',
    'StockReplenished',
    'StockReserved',
    'StockReleased'
  ];
}

// order/domain/order-context.ts
export class OrderContext implements BoundedContext {
  readonly name = 'Order';
  readonly description = '注文処理と注文ライフサイクル管理を担当するコンテキスト';
  
  readonly ubiquitousLanguage = new Map([
    ['Order', '顧客からの注文'],
    ['OrderLine', '注文の明細行'],
    ['Customer', '注文者・顧客'],
    ['Payment', '支払い処理'],
    ['Shipment', '出荷・配送'],
    ['Fulfillment', '注文履行プロセス'],
    ['Cancellation', '注文キャンセル'],
    ['Return', '商品返品']
  ]);

  readonly domainServices = [
    'OrderProcessingService',
    'PaymentProcessingService',
    'ShippingService',
    'OrderValidationService'
  ];

  readonly aggregates = ['Order', 'Customer', 'Payment', 'Shipment'];
  readonly valueObjects = ['OrderId', 'CustomerId', 'Amount', 'Address'];
  readonly domainEvents = [
    'OrderPlaced',
    'OrderPaid',
    'OrderShipped',
    'OrderCancelled'
  ];
}

// Context Map - 各コンテキストの関係性を定義
export class ContextMap {
  private relationships = new Map<string, ContextRelationship[]>();

  constructor() {
    this.defineRelationships();
  }

  private defineRelationships(): void {
    // Catalog -> Inventory (Customer/Supplier)
    this.addRelationship('Catalog', 'Inventory', {
      type: 'Customer-Supplier',
      direction: 'downstream',
      description: 'CatalogはInventoryから在庫情報を取得',
      sharedConcepts: ['ProductId', 'SKU'],
      anticorruptionLayer: true
    });

    // Order -> Catalog (Customer/Supplier)
    this.addRelationship('Order', 'Catalog', {
      type: 'Customer-Supplier', 
      direction: 'downstream',
      description: 'Orderは製品情報をCatalogから取得',
      sharedConcepts: ['ProductId', 'Price'],
      anticorruptionLayer: true
    });

    // Order -> Inventory (Customer/Supplier)
    this.addRelationship('Order', 'Inventory', {
      type: 'Customer-Supplier',
      direction: 'downstream', 
      description: 'Orderは在庫確保をInventoryに依頼',
      sharedConcepts: ['ProductId', 'Quantity'],
      anticorruptionLayer: true
    });
  }

  private addRelationship(upstream: string, downstream: string, relationship: ContextRelationship): void {
    if (!this.relationships.has(upstream)) {
      this.relationships.set(upstream, []);
    }
    this.relationships.get(upstream)!.push(relationship);
  }

  getRelationships(contextName: string): ContextRelationship[] {
    return this.relationships.get(contextName) || [];
  }
}

interface ContextRelationship {
  type: 'Customer-Supplier' | 'Shared-Kernel' | 'Partnership' | 'Conformist';
  direction: 'upstream' | 'downstream' | 'bidirectional';
  description: string;
  sharedConcepts: string[];
  anticorruptionLayer: boolean;
}
```

### 2. Aggregateパターン

```typescript
// shared/domain/aggregate-root.ts
export abstract class AggregateRoot<TId> {
  protected _id: TId;
  protected _version: number = 0;
  protected _domainEvents: DomainEvent[] = [];
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: TId) {
    this._id = id;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  get id(): TId {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ドメインイベント管理
  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  protected incrementVersion(): void {
    this._version++;
    this._updatedAt = new Date();
  }

  // 不変条件検証
  protected abstract validateInvariants(): void;

  // 等価性
  equals(other: AggregateRoot<TId>): boolean {
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;
    return this._id === other._id;
  }
}

// catalog/domain/aggregates/product-aggregate.ts
export class Product extends AggregateRoot<ProductId> {
  private _name: ProductName;
  private _description: ProductDescription;
  private _price: Price;
  private _category: CategoryId;
  private _sku: SKU;
  private _specifications: ProductSpecification[];
  private _variants: ProductVariant[];
  private _brand: BrandId;
  private _status: ProductStatus;
  private _images: ProductImage[];
  private _tags: ProductTag[];

  constructor(
    id: ProductId,
    name: ProductName,
    description: ProductDescription,
    category: CategoryId,
    brand: BrandId,
    sku: SKU
  ) {
    super(id);
    this._name = name;
    this._description = description;
    this._category = category;
    this._brand = brand;
    this._sku = sku;
    this._status = ProductStatus.DRAFT;
    this._specifications = [];
    this._variants = [];
    this._images = [];
    this._tags = [];

    this.addDomainEvent(new ProductCreatedEvent(
      this._id,
      this._name,
      this._category,
      this._brand,
      this._sku
    ));
  }

  // ファクトリーメソッド
  static create(
    name: string,
    description: string,
    categoryId: string,
    brandId: string,
    skuValue: string
  ): Product {
    const productId = ProductId.generate();
    const productName = ProductName.create(name);
    const productDescription = ProductDescription.create(description);
    const category = CategoryId.create(categoryId);
    const brand = BrandId.create(brandId);
    const sku = SKU.create(skuValue);

    return new Product(productId, productName, productDescription, category, brand, sku);
  }

  // ビジネスメソッド
  changePrice(newPrice: Price, reason: string, changedBy: string): void {
    if (this._status === ProductStatus.DISCONTINUED) {
      throw new DomainError('Cannot change price of discontinued product');
    }

    if (this._price && this._price.equals(newPrice)) {
      return; // 価格変更なし
    }

    const oldPrice = this._price;
    this._price = newPrice;
    
    this.incrementVersion();
    this.addDomainEvent(new ProductPriceChangedEvent(
      this._id,
      oldPrice,
      newPrice,
      reason,
      changedBy
    ));
  }

  addVariant(variant: ProductVariant): void {
    this.validateVariantUniqueness(variant);
    
    this._variants.push(variant);
    this.incrementVersion();
    
    this.addDomainEvent(new ProductVariantAddedEvent(
      this._id,
      variant
    ));
  }

  updateSpecifications(specifications: ProductSpecification[]): void {
    this._specifications = [...specifications];
    this.incrementVersion();
    
    this.addDomainEvent(new ProductSpecificationsUpdatedEvent(
      this._id,
      specifications
    ));
  }

  publish(): void {
    if (this._status === ProductStatus.PUBLISHED) {
      throw new DomainError('Product is already published');
    }

    this.validatePublishingRequirements();
    
    this._status = ProductStatus.PUBLISHED;
    this.incrementVersion();
    
    this.addDomainEvent(new ProductPublishedEvent(this._id));
  }

  discontinue(reason: string, discontinuedBy: string): void {
    if (this._status === ProductStatus.DISCONTINUED) {
      throw new DomainError('Product is already discontinued');
    }

    this._status = ProductStatus.DISCONTINUED;
    this.incrementVersion();
    
    this.addDomainEvent(new ProductDiscontinuedEvent(
      this._id,
      reason,
      discontinuedBy
    ));
  }

  // 不変条件の検証
  protected validateInvariants(): void {
    if (!this._name) {
      throw new DomainError('Product must have a name');
    }

    if (!this._sku) {
      throw new DomainError('Product must have a SKU');
    }

    if (!this._category) {
      throw new DomainError('Product must belong to a category');
    }

    if (this._status === ProductStatus.PUBLISHED && !this._price) {
      throw new DomainError('Published product must have a price');
    }

    if (this._variants.length > 50) {
      throw new DomainError('Product cannot have more than 50 variants');
    }
  }

  private validateVariantUniqueness(newVariant: ProductVariant): void {
    const existingVariant = this._variants.find(variant => 
      variant.hasSameAttributes(newVariant)
    );
    
    if (existingVariant) {
      throw new DomainError('Product variant with same attributes already exists');
    }
  }

  private validatePublishingRequirements(): void {
    if (!this._price) {
      throw new DomainError('Product must have a price to be published');
    }

    if (this._images.length === 0) {
      throw new DomainError('Product must have at least one image to be published');
    }

    if (!this._description || this._description.isEmpty()) {
      throw new DomainError('Product must have a description to be published');
    }
  }

  // Getters
  get name(): ProductName {
    return this._name;
  }

  get description(): ProductDescription {
    return this._description;
  }

  get price(): Price | null {
    return this._price;
  }

  get category(): CategoryId {
    return this._category;
  }

  get sku(): SKU {
    return this._sku;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get variants(): readonly ProductVariant[] {
    return this._variants;
  }

  get specifications(): readonly ProductSpecification[] {
    return this._specifications;
  }

  isPublished(): boolean {
    return this._status === ProductStatus.PUBLISHED;
  }

  isDiscontinued(): boolean {
    return this._status === ProductStatus.DISCONTINUED;
  }
}

// order/domain/aggregates/order-aggregate.ts
export class Order extends AggregateRoot<OrderId> {
  private _customerId: CustomerId;
  private _orderDate: Date;
  private _status: OrderStatus;
  private _orderLines: OrderLine[];
  private _shippingAddress: Address;
  private _billingAddress: Address;
  private _paymentInfo: PaymentInfo | null = null;
  private _totalAmount: Money;
  private _currency: Currency;

  private constructor(
    id: OrderId,
    customerId: CustomerId,
    shippingAddress: Address,
    billingAddress: Address,
    currency: Currency
  ) {
    super(id);
    this._customerId = customerId;
    this._orderDate = new Date();
    this._status = OrderStatus.PENDING;
    this._orderLines = [];
    this._shippingAddress = shippingAddress;
    this._billingAddress = billingAddress;
    this._currency = currency;
    this._totalAmount = Money.zero(currency);
  }

  static place(
    customerId: string,
    orderLines: { productId: string; quantity: number; unitPrice: number }[],
    shippingAddress: Address,
    billingAddress: Address,
    currency: string = 'USD'
  ): Order {
    const orderId = OrderId.generate();
    const customer = CustomerId.create(customerId);
    const orderCurrency = Currency.create(currency);
    
    const order = new Order(orderId, customer, shippingAddress, billingAddress, orderCurrency);
    
    // 注文明細を追加
    orderLines.forEach(line => {
      order.addOrderLine(
        ProductId.create(line.productId),
        Quantity.create(line.quantity),
        Money.create(line.unitPrice, orderCurrency)
      );
    });

    order.addDomainEvent(new OrderPlacedEvent(
      orderId,
      customer,
      order._orderLines,
      order._totalAmount
    ));

    return order;
  }

  addOrderLine(productId: ProductId, quantity: Quantity, unitPrice: Money): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainError('Cannot modify order that is not pending');
    }

    // 同じ商品の明細が既に存在するかチェック
    const existingLine = this._orderLines.find(line => line.productId.equals(productId));
    if (existingLine) {
      existingLine.changeQuantity(existingLine.quantity.add(quantity));
    } else {
      const orderLine = OrderLine.create(productId, quantity, unitPrice);
      this._orderLines.push(orderLine);
    }

    this.recalculateTotalAmount();
    this.incrementVersion();
  }

  removeOrderLine(productId: ProductId): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainError('Cannot modify order that is not pending');
    }

    const index = this._orderLines.findIndex(line => line.productId.equals(productId));
    if (index === -1) {
      throw new DomainError('Order line not found');
    }

    this._orderLines.splice(index, 1);
    this.recalculateTotalAmount();
    this.incrementVersion();
  }

  confirmPayment(paymentInfo: PaymentInfo): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainError('Cannot confirm payment for non-pending order');
    }

    if (this._orderLines.length === 0) {
      throw new DomainError('Cannot confirm payment for empty order');
    }

    this._paymentInfo = paymentInfo;
    this._status = OrderStatus.PAID;
    this.incrementVersion();

    this.addDomainEvent(new OrderPaidEvent(
      this._id,
      this._customerId,
      this._totalAmount,
      paymentInfo
    ));
  }

  ship(trackingNumber: string, shippedBy: string): void {
    if (this._status !== OrderStatus.PAID) {
      throw new DomainError('Cannot ship order that is not paid');
    }

    this._status = OrderStatus.SHIPPED;
    this.incrementVersion();

    this.addDomainEvent(new OrderShippedEvent(
      this._id,
      this._customerId,
      trackingNumber,
      shippedBy,
      this._shippingAddress
    ));
  }

  cancel(reason: string, cancelledBy: string): void {
    if (this._status === OrderStatus.SHIPPED || this._status === OrderStatus.DELIVERED) {
      throw new DomainError('Cannot cancel shipped or delivered order');
    }

    if (this._status === OrderStatus.CANCELLED) {
      throw new DomainError('Order is already cancelled');
    }

    this._status = OrderStatus.CANCELLED;
    this.incrementVersion();

    this.addDomainEvent(new OrderCancelledEvent(
      this._id,
      this._customerId,
      reason,
      cancelledBy
    ));
  }

  private recalculateTotalAmount(): void {
    let total = Money.zero(this._currency);
    
    for (const line of this._orderLines) {
      total = total.add(line.totalAmount);
    }
    
    this._totalAmount = total;
  }

  protected validateInvariants(): void {
    if (!this._customerId) {
      throw new DomainError('Order must have a customer');
    }

    if (!this._shippingAddress) {
      throw new DomainError('Order must have a shipping address');
    }

    if (this._orderLines.length > 100) {
      throw new DomainError('Order cannot have more than 100 order lines');
    }

    if (this._status === OrderStatus.PAID && !this._paymentInfo) {
      throw new DomainError('Paid order must have payment information');
    }
  }

  // Getters
  get customerId(): CustomerId {
    return this._customerId;
  }

  get orderDate(): Date {
    return this._orderDate;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get orderLines(): readonly OrderLine[] {
    return this._orderLines;
  }

  get totalAmount(): Money {
    return this._totalAmount;
  }

  get itemCount(): number {
    return this._orderLines.reduce((count, line) => count + line.quantity.value, 0);
  }

  isPending(): boolean {
    return this._status === OrderStatus.PENDING;
  }

  isPaid(): boolean {
    return this._status === OrderStatus.PAID;
  }

  isCancelled(): boolean {
    return this._status === OrderStatus.CANCELLED;
  }
}
```

### 3. Value Objectパターン

```typescript
// shared/domain/value-object.ts
export abstract class ValueObject {
  abstract equals(other: ValueObject): boolean;
  
  protected static isEqual(a: any, b: any): boolean {
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a === 'object') {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);

      if (aKeys.length !== bKeys.length) {
        return false;
      }

      return aKeys.every(key => this.isEqual(a[key], b[key]));
    }

    return a === b;
  }
}

// catalog/domain/value-objects/product-name.ts
export class ProductName extends ValueObject {
  private readonly _value: string;

  private constructor(value: string) {
    super();
    this._value = value;
  }

  static create(value: string): ProductName {
    if (!value || value.trim().length === 0) {
      throw new DomainError('Product name cannot be empty');
    }

    if (value.length > 200) {
      throw new DomainError('Product name cannot exceed 200 characters');
    }

    if (!/^[a-zA-Z0-9\s\-_.()]+$/.test(value)) {
      throw new DomainError('Product name contains invalid characters');
    }

    return new ProductName(value.trim());
  }

  get value(): string {
    return this._value;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof ProductName)) {
      return false;
    }
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

// catalog/domain/value-objects/sku.ts
export class SKU extends ValueObject {
  private readonly _value: string;

  private constructor(value: string) {
    super();
    this._value = value;
  }

  static create(value: string): SKU {
    if (!value || value.trim().length === 0) {
      throw new DomainError('SKU cannot be empty');
    }

    const skuPattern = /^[A-Z0-9]{3,20}$/;
    if (!skuPattern.test(value)) {
      throw new DomainError('SKU must be 3-20 characters, uppercase letters and numbers only');
    }

    return new SKU(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof SKU)) {
      return false;
    }
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

// catalog/domain/value-objects/price.ts
export class Price extends ValueObject {
  private readonly _amount: number;
  private readonly _currency: Currency;

  private constructor(amount: number, currency: Currency) {
    super();
    this._amount = amount;
    this._currency = currency;
  }

  static create(amount: number, currency: Currency): Price {
    if (amount < 0) {
      throw new DomainError('Price amount cannot be negative');
    }

    if (amount > 1_000_000) {
      throw new DomainError('Price amount cannot exceed 1,000,000');
    }

    // 小数点以下2桁に丸める
    const roundedAmount = Math.round(amount * 100) / 100;

    return new Price(roundedAmount, currency);
  }

  static zero(currency: Currency): Price {
    return new Price(0, currency);
  }

  add(other: Price): Price {
    this.validateSameCurrency(other);
    return new Price(this._amount + other._amount, this._currency);
  }

  subtract(other: Price): Price {
    this.validateSameCurrency(other);
    const newAmount = this._amount - other._amount;
    
    if (newAmount < 0) {
      throw new DomainError('Cannot subtract price that results in negative amount');
    }
    
    return new Price(newAmount, this._currency);
  }

  multiply(factor: number): Price {
    if (factor < 0) {
      throw new DomainError('Cannot multiply price by negative factor');
    }
    
    return new Price(this._amount * factor, this._currency);
  }

  isGreaterThan(other: Price): boolean {
    this.validateSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Price): boolean {
    this.validateSameCurrency(other);
    return this._amount < other._amount;
  }

  private validateSameCurrency(other: Price): void {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot perform operation on prices with different currencies');
    }
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof Price)) {
      return false;
    }
    return this._amount === other._amount && this._currency.equals(other._currency);
  }

  toString(): string {
    return `${this._amount} ${this._currency.code}`;
  }
}

// shared/domain/value-objects/money.ts
export class Money extends ValueObject {
  private readonly _amount: number;
  private readonly _currency: Currency;

  private constructor(amount: number, currency: Currency) {
    super();
    this._amount = amount;
    this._currency = currency;
  }

  static create(amount: number, currency: Currency): Money {
    if (!Number.isFinite(amount)) {
      throw new DomainError('Money amount must be a finite number');
    }

    // 小数点以下2桁に丸める
    const roundedAmount = Math.round(amount * 100) / 100;

    return new Money(roundedAmount, currency);
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  multiply(multiplier: number): Money {
    if (!Number.isFinite(multiplier)) {
      throw new DomainError('Multiplier must be a finite number');
    }
    
    return new Money(this._amount * multiplier, this._currency);
  }

  divide(divisor: number): Money {
    if (!Number.isFinite(divisor) || divisor === 0) {
      throw new DomainError('Divisor must be a finite non-zero number');
    }
    
    return new Money(this._amount / divisor, this._currency);
  }

  isPositive(): boolean {
    return this._amount > 0;
  }

  isNegative(): boolean {
    return this._amount < 0;
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  private validateSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot perform operation on money with different currencies');
    }
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof Money)) {
      return false;
    }
    return this._amount === other._amount && this._currency.equals(other._currency);
  }

  toString(): string {
    return `${this._amount.toFixed(2)} ${this._currency.code}`;
  }
}

// shared/domain/value-objects/address.ts
export class Address extends ValueObject {
  private readonly _streetAddress: string;
  private readonly _city: string;
  private readonly _state: string;
  private readonly _postalCode: string;
  private readonly _country: string;

  constructor(
    streetAddress: string,
    city: string,
    state: string,
    postalCode: string,
    country: string
  ) {
    super();
    
    this.validateRequiredFields(streetAddress, city, state, postalCode, country);
    this.validatePostalCode(postalCode, country);
    
    this._streetAddress = streetAddress.trim();
    this._city = city.trim();
    this._state = state.trim();
    this._postalCode = postalCode.trim();
    this._country = country.trim().toUpperCase();
  }

  private validateRequiredFields(...fields: string[]): void {
    fields.forEach((field, index) => {
      if (!field || field.trim().length === 0) {
        const fieldNames = ['street address', 'city', 'state', 'postal code', 'country'];
        throw new DomainError(`${fieldNames[index]} is required`);
      }
    });
  }

  private validatePostalCode(postalCode: string, country: string): void {
    const patterns: Record<string, RegExp> = {
      'US': /^\d{5}(-\d{4})?$/,
      'CA': /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
      'JP': /^\d{3}-\d{4}$/,
      'GB': /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
    };

    const pattern = patterns[country.toUpperCase()];
    if (pattern && !pattern.test(postalCode)) {
      throw new DomainError(`Invalid postal code format for ${country}`);
    }
  }

  get streetAddress(): string {
    return this._streetAddress;
  }

  get city(): string {
    return this._city;
  }

  get state(): string {
    return this._state;
  }

  get postalCode(): string {
    return this._postalCode;
  }

  get country(): string {
    return this._country;
  }

  getFullAddress(): string {
    return `${this._streetAddress}, ${this._city}, ${this._state} ${this._postalCode}, ${this._country}`;
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof Address)) {
      return false;
    }
    
    return this._streetAddress === other._streetAddress &&
           this._city === other._city &&
           this._state === other._state &&
           this._postalCode === other._postalCode &&
           this._country === other._country;
  }

  toString(): string {
    return this.getFullAddress();
  }
}
```

### 4. Domain Serviceパターン

```typescript
// catalog/domain/services/pricing-service.ts
export interface PricingService {
  calculatePrice(product: Product, customer: Customer, quantity: number): Promise<Price>;
  validatePriceChange(product: Product, newPrice: Price): Promise<boolean>;
  getRecommendedPrice(product: Product): Promise<Price>;
}

export class DynamicPricingService implements PricingService {
  constructor(
    private priceRepository: PriceRepository,
    private competitorPriceService: CompetitorPriceService,
    private demandAnalysisService: DemandAnalysisService,
    private logger: Logger
  ) {}

  async calculatePrice(product: Product, customer: Customer, quantity: number): Promise<Price> {
    // ベース価格取得
    let basePrice = product.price;
    if (!basePrice) {
      basePrice = await this.getRecommendedPrice(product);
    }

    // 顧客セグメント別割引
    const customerDiscount = await this.calculateCustomerDiscount(customer);
    
    // 数量割引
    const volumeDiscount = this.calculateVolumeDiscount(quantity);
    
    // 総合割引率計算
    const totalDiscountRate = customerDiscount + volumeDiscount;
    const finalPrice = basePrice.multiply(1 - totalDiscountRate);

    this.logger.info('Price calculated', {
      productId: product.id.value,
      customerId: customer.id.value,
      basePrice: basePrice.amount,
      customerDiscount,
      volumeDiscount,
      finalPrice: finalPrice.amount
    });

    return finalPrice;
  }

  async validatePriceChange(product: Product, newPrice: Price): Promise<boolean> {
    const currentPrice = product.price;
    if (!currentPrice) {
      return true; // 初回価格設定は常に有効
    }

    // 価格変動率チェック
    const priceChangeRate = Math.abs(newPrice.amount - currentPrice.amount) / currentPrice.amount;
    const maxChangeRate = 0.3; // 30%まで

    if (priceChangeRate > maxChangeRate) {
      this.logger.warn('Price change exceeds maximum allowed rate', {
        productId: product.id.value,
        currentPrice: currentPrice.amount,
        newPrice: newPrice.amount,
        changeRate: priceChangeRate
      });
      return false;
    }

    // 競合価格との比較
    const competitorPrices = await this.competitorPriceService.getCompetitorPrices(product.sku);
    const avgCompetitorPrice = this.calculateAveragePrice(competitorPrices);
    
    if (avgCompetitorPrice && newPrice.isGreaterThan(avgCompetitorPrice.multiply(1.2))) {
      this.logger.warn('New price significantly higher than competitors', {
        productId: product.id.value,
        newPrice: newPrice.amount,
        avgCompetitorPrice: avgCompetitorPrice.amount
      });
      return false;
    }

    return true;
  }

  async getRecommendedPrice(product: Product): Promise<Price> {
    // コスト基準価格
    const costBasedPrice = await this.calculateCostBasedPrice(product);
    
    // 競合基準価格
    const competitorBasedPrice = await this.calculateCompetitorBasedPrice(product);
    
    // 需要基準価格
    const demandBasedPrice = await this.calculateDemandBasedPrice(product);

    // 各価格の重み付け平均
    const weightedAverage = this.calculateWeightedAveragePrice([
      { price: costBasedPrice, weight: 0.4 },
      { price: competitorBasedPrice, weight: 0.3 },
      { price: demandBasedPrice, weight: 0.3 }
    ]);

    return weightedAverage;
  }

  private async calculateCustomerDiscount(customer: Customer): Promise<number> {
    const customerSegment = await customer.getSegment();
    
    const discountRates: Record<string, number> = {
      'VIP': 0.15,
      'PREMIUM': 0.10,
      'REGULAR': 0.05,
      'NEW': 0.02
    };

    return discountRates[customerSegment] || 0;
  }

  private calculateVolumeDiscount(quantity: number): number {
    if (quantity >= 100) return 0.15;
    if (quantity >= 50) return 0.10;
    if (quantity >= 20) return 0.05;
    if (quantity >= 10) return 0.02;
    return 0;
  }

  private async calculateCostBasedPrice(product: Product): Promise<Price> {
    // 製造コスト + マージン率で計算
    const manufacturingCost = await this.getManufacturingCost(product);
    const marginRate = 0.4; // 40%マージン
    
    return manufacturingCost.multiply(1 + marginRate);
  }

  private async calculateCompetitorBasedPrice(product: Product): Promise<Price> {
    const competitorPrices = await this.competitorPriceService.getCompetitorPrices(product.sku);
    return this.calculateAveragePrice(competitorPrices);
  }

  private async calculateDemandBasedPrice(product: Product): Promise<Price> {
    const demandLevel = await this.demandAnalysisService.getDemandLevel(product);
    const basePrice = await this.calculateCostBasedPrice(product);
    
    const demandMultipliers: Record<string, number> = {
      'HIGH': 1.3,
      'MEDIUM': 1.1,
      'LOW': 0.9
    };

    const multiplier = demandMultipliers[demandLevel] || 1.0;
    return basePrice.multiply(multiplier);
  }

  private calculateAveragePrice(prices: Price[]): Price {
    if (prices.length === 0) {
      throw new DomainError('Cannot calculate average of empty price list');
    }

    const currency = prices[0].currency;
    const totalAmount = prices.reduce((sum, price) => sum + price.amount, 0);
    const averageAmount = totalAmount / prices.length;

    return Price.create(averageAmount, currency);
  }

  private calculateWeightedAveragePrice(
    weightedPrices: Array<{ price: Price; weight: number }>
  ): Price {
    const totalWeight = weightedPrices.reduce((sum, wp) => sum + wp.weight, 0);
    const currency = weightedPrices[0].price.currency;
    
    const weightedSum = weightedPrices.reduce(
      (sum, wp) => sum + (wp.price.amount * wp.weight),
      0
    );

    const averageAmount = weightedSum / totalWeight;
    return Price.create(averageAmount, currency);
  }
}

// order/domain/services/order-validation-service.ts
export class OrderValidationService {
  constructor(
    private inventoryService: InventoryService,
    private customerService: CustomerService,
    private paymentService: PaymentService,
    private logger: Logger
  ) {}

  async validateOrder(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];

    // 顧客検証
    const customerValidation = await this.validateCustomer(order.customerId);
    if (!customerValidation.isValid) {
      errors.push(...customerValidation.errors);
    }

    // 注文明細検証
    const orderLinesValidation = await this.validateOrderLines(order.orderLines);
    if (!orderLinesValidation.isValid) {
      errors.push(...orderLinesValidation.errors);
    }

    // 在庫検証
    const inventoryValidation = await this.validateInventory(order.orderLines);
    if (!inventoryValidation.isValid) {
      errors.push(...inventoryValidation.errors);
    }

    // 支払い能力検証
    const paymentValidation = await this.validatePaymentCapability(order);
    if (!paymentValidation.isValid) {
      errors.push(...paymentValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateCustomer(customerId: CustomerId): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const customer = await this.customerService.getCustomer(customerId);
      
      if (!customer) {
        errors.push('Customer not found');
        return { isValid: false, errors };
      }

      if (!customer.isActive()) {
        errors.push('Customer account is not active');
      }

      if (customer.isSuspended()) {
        errors.push('Customer account is suspended');
      }

      if (customer.hasOutstandingDebt()) {
        errors.push('Customer has outstanding debt');
      }

    } catch (error) {
      this.logger.error('Customer validation failed', {
        customerId: customerId.value,
        error: error.message
      });
      errors.push('Customer validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateOrderLines(orderLines: readonly OrderLine[]): Promise<ValidationResult> {
    const errors: string[] = [];

    if (orderLines.length === 0) {
      errors.push('Order must have at least one order line');
      return { isValid: false, errors };
    }

    if (orderLines.length > 100) {
      errors.push('Order cannot have more than 100 order lines');
    }

    // 重複商品チェック
    const productIds = orderLines.map(line => line.productId.value);
    const uniqueProductIds = new Set(productIds);
    
    if (productIds.length !== uniqueProductIds.size) {
      errors.push('Order contains duplicate products');
    }

    // 各明細の検証
    for (const line of orderLines) {
      if (line.quantity.value <= 0) {
        errors.push(`Invalid quantity for product ${line.productId.value}`);
      }

      if (line.quantity.value > 1000) {
        errors.push(`Quantity too high for product ${line.productId.value}`);
      }

      if (line.unitPrice.amount <= 0) {
        errors.push(`Invalid price for product ${line.productId.value}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateInventory(orderLines: readonly OrderLine[]): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      for (const line of orderLines) {
        const availability = await this.inventoryService.checkAvailability(
          line.productId,
          line.quantity
        );

        if (!availability.isAvailable) {
          errors.push(
            `Insufficient inventory for product ${line.productId.value}. ` +
            `Requested: ${line.quantity.value}, Available: ${availability.availableQuantity}`
          );
        }

        if (availability.isBackOrdered) {
          errors.push(
            `Product ${line.productId.value} is currently back-ordered. ` +
            `Expected availability: ${availability.expectedDate}`
          );
        }
      }

    } catch (error) {
      this.logger.error('Inventory validation failed', { error: error.message });
      errors.push('Inventory validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validatePaymentCapability(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const paymentCapability = await this.paymentService.checkPaymentCapability(
        order.customerId,
        order.totalAmount
      );

      if (!paymentCapability.isApproved) {
        errors.push('Payment capability check failed');
        
        if (paymentCapability.reason) {
          errors.push(`Reason: ${paymentCapability.reason}`);
        }
      }

      if (paymentCapability.requiresManualApproval) {
        errors.push('Order requires manual approval due to payment risk');
      }

    } catch (error) {
      this.logger.error('Payment capability validation failed', {
        customerId: order.customerId.value,
        amount: order.totalAmount.amount,
        error: error.message
      });
      errors.push('Payment capability validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 5. Repository パターン

```typescript
// shared/domain/repository.ts
export interface Repository<T, TId> {
  getById(id: TId): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface ProductRepository extends Repository<Product, ProductId> {
  getBySku(sku: SKU): Promise<Product | null>;
  getByCategory(categoryId: CategoryId): Promise<Product[]>;
  search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
  getDiscontinuedProducts(beforeDate: Date): Promise<Product[]>;
}

export interface OrderRepository extends Repository<Order, OrderId> {
  getByCustomer(customerId: CustomerId): Promise<Order[]>;
  getByStatus(status: OrderStatus): Promise<Order[]>;
  getByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
  findPendingOrders(): Promise<Order[]>;
}

// catalog/infrastructure/repositories/postgres-product-repository.ts
export class PostgresProductRepository implements ProductRepository {
  constructor(
    private pool: Pool,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async getById(id: ProductId): Promise<Product | null> {
    try {
      const client = await this.pool.connect();
      
      try {
        // メインの製品データ取得
        const productResult = await client.query(`
          SELECT 
            id, name, description, price, currency, category_id, brand_id,
            sku, status, created_at, updated_at, version
          FROM products 
          WHERE id = $1 AND deleted_at IS NULL
        `, [id.value]);

        if (productResult.rows.length === 0) {
          return null;
        }

        const productData = productResult.rows[0];

        // 関連データ取得
        const [specifications, variants, images, tags] = await Promise.all([
          this.getProductSpecifications(client, id),
          this.getProductVariants(client, id),
          this.getProductImages(client, id),
          this.getProductTags(client, id)
        ]);

        // ドメインオブジェクト復元
        const product = this.mapToDomainObject(productData, {
          specifications,
          variants,
          images,
          tags
        });

        return product;

      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error('Failed to get product by ID', {
        productId: id.value,
        error: error.message
      });
      throw new RepositoryError(`Failed to get product: ${error.message}`);
    }
  }

  async getBySku(sku: SKU): Promise<Product | null> {
    try {
      const client = await this.pool.connect();
      
      try {
        const result = await client.query(`
          SELECT id FROM products 
          WHERE sku = $1 AND deleted_at IS NULL
        `, [sku.value]);

        if (result.rows.length === 0) {
          return null;
        }

        const productId = ProductId.create(result.rows[0].id);
        return await this.getById(productId);

      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error('Failed to get product by SKU', {
        sku: sku.value,
        error: error.message
      });
      throw new RepositoryError(`Failed to get product by SKU: ${error.message}`);
    }
  }

  async save(product: Product): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 既存製品チェック
      const existing = await this.getById(product.id);
      
      if (existing) {
        await this.updateProduct(client, product);
      } else {
        await this.insertProduct(client, product);
      }

      // ドメインイベント発行
      const domainEvents = product.getDomainEvents();
      if (domainEvents.length > 0) {
        await this.eventBus.publish(domainEvents);
        product.clearDomainEvents();
      }

      await client.query('COMMIT');

      this.logger.info('Product saved successfully', {
        productId: product.id.value,
        sku: product.sku.value
      });

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to save product', {
        productId: product.id.value,
        error: error.message
      });
      throw new RepositoryError(`Failed to save product: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async search(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    try {
      const client = await this.pool.connect();
      
      try {
        const { query, params } = this.buildSearchQuery(criteria);
        
        // 総数取得
        const countQuery = query.replace(
          'SELECT p.id, p.name, p.description, p.price, p.currency, p.sku, p.status',
          'SELECT COUNT(*)'
        );
        const countResult = await client.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count);

        // データ取得
        const dataQuery = `${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const dataParams = [...params, criteria.pageSize, criteria.offset];
        const dataResult = await client.query(dataQuery, dataParams);

        const products = await Promise.all(
          dataResult.rows.map(row => this.getById(ProductId.create(row.id)))
        );

        return {
          products: products.filter(p => p !== null) as Product[],
          totalCount,
          page: criteria.page,
          pageSize: criteria.pageSize,
          totalPages: Math.ceil(totalCount / criteria.pageSize)
        };

      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error('Product search failed', {
        criteria,
        error: error.message
      });
      throw new RepositoryError(`Product search failed: ${error.message}`);
    }
  }

  private async insertProduct(client: any, product: Product): Promise<void> {
    await client.query(`
      INSERT INTO products (
        id, name, description, price, currency, category_id, brand_id,
        sku, status, created_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      product.id.value,
      product.name.value,
      product.description.value,
      product.price?.amount,
      product.price?.currency.code,
      product.category.value,
      product.brand?.value,
      product.sku.value,
      product.status,
      product.createdAt,
      product.updatedAt,
      product.version
    ]);

    // 関連データの保存
    await this.saveProductSpecifications(client, product);
    await this.saveProductVariants(client, product);
    await this.saveProductImages(client, product);
    await this.saveProductTags(client, product);
  }

  private async updateProduct(client: any, product: Product): Promise<void> {
    const result = await client.query(`
      UPDATE products SET
        name = $2, description = $3, price = $4, currency = $5,
        category_id = $6, brand_id = $7, status = $8, updated_at = $9, version = $10
      WHERE id = $1 AND version = $11
    `, [
      product.id.value,
      product.name.value,
      product.description.value,
      product.price?.amount,
      product.price?.currency.code,
      product.category.value,
      product.brand?.value,
      product.status,
      product.updatedAt,
      product.version,
      product.version - 1 // 楽観的ロック
    ]);

    if (result.rowCount === 0) {
      throw new ConcurrencyError('Product has been modified by another process');
    }

    // 関連データの更新
    await this.updateProductSpecifications(client, product);
    await this.updateProductVariants(client, product);
    await this.updateProductImages(client, product);
    await this.updateProductTags(client, product);
  }

  private buildSearchQuery(criteria: ProductSearchCriteria): { query: string; params: any[] } {
    let query = `
      SELECT p.id, p.name, p.description, p.price, p.currency, p.sku, p.status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // 検索条件の構築
    if (criteria.name) {
      query += ` AND p.name ILIKE $${paramIndex}`;
      params.push(`%${criteria.name}%`);
      paramIndex++;
    }

    if (criteria.categoryId) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(criteria.categoryId);
      paramIndex++;
    }

    if (criteria.status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(criteria.status);
      paramIndex++;
    }

    if (criteria.minPrice !== undefined) {
      query += ` AND p.price >= $${paramIndex}`;
      params.push(criteria.minPrice);
      paramIndex++;
    }

    if (criteria.maxPrice !== undefined) {
      query += ` AND p.price <= $${paramIndex}`;
      params.push(criteria.maxPrice);
      paramIndex++;
    }

    // ソート順
    const sortField = criteria.sortBy || 'created_at';
    const sortOrder = criteria.sortOrder || 'DESC';
    query += ` ORDER BY p.${sortField} ${sortOrder}`;

    return { query, params };
  }

  private mapToDomainObject(
    productData: any,
    relatedData: {
      specifications: ProductSpecification[];
      variants: ProductVariant[];
      images: ProductImage[];
      tags: ProductTag[];
    }
  ): Product {
    // データベースからドメインオブジェクトへの変換ロジック
    // 実際の実装では、適切なファクトリーメソッドやビルダーパターンを使用
    
    const product = Product.reconstitute({
      id: ProductId.create(productData.id),
      name: ProductName.create(productData.name),
      description: ProductDescription.create(productData.description),
      price: productData.price ? Price.create(
        productData.price,
        Currency.create(productData.currency)
      ) : null,
      category: CategoryId.create(productData.category_id),
      brand: productData.brand_id ? BrandId.create(productData.brand_id) : null,
      sku: SKU.create(productData.sku),
      status: productData.status,
      specifications: relatedData.specifications,
      variants: relatedData.variants,
      images: relatedData.images,
      tags: relatedData.tags,
      version: productData.version,
      createdAt: productData.created_at,
      updatedAt: productData.updated_at
    });

    return product;
  }
}
```

このDomain-Driven Designパターン集は以下の要素を包含しています：

1. **戦略的設計**: Bounded Context、Context Map、ユビキタス言語
2. **Aggregateパターン**: 複雑なビジネスルールとドメインイベント管理
3. **Value Objectパターン**: 不変性と検証ロジックを持つ値オブジェクト
4. **Domain Serviceパターン**: 複雑なビジネスロジックの実装
5. **Repositoryパターン**: ドメインオブジェクトの永続化と復元

これらのパターンにより、複雑なビジネスドメインを明確にモデリングし、保守性の高いソフトウェアを構築できます。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Phase 3: Python Advanced Libraries - FastAPI production patterns document", "status": "completed", "id": "18"}, {"content": "Phase 3: SQLAlchemy 2.0 advanced ORM patterns document", "status": "completed", "id": "19"}, {"content": "Phase 3: Pydantic v2 data validation patterns document", "status": "completed", "id": "20"}, {"content": "Phase 3: Async Python concurrency patterns document", "status": "completed", "id": "21"}, {"content": "Phase 3: Pytest advanced testing patterns document", "status": "completed", "id": "22"}, {"content": "Phase 3: Celery distributed task patterns document", "status": "completed", "id": "23"}, {"content": "Phase 3: NumPy/Pandas data science patterns document", "status": "completed", "id": "24"}, {"content": "Phase 3: Django REST framework enterprise patterns document", "status": "completed", "id": "25"}, {"content": "Phase 4 - Architecture Pattern 1: Microservices Architecture", "status": "completed", "id": "26"}, {"content": "Phase 4 - Architecture Pattern 2: Event-Driven Architecture", "status": "completed", "id": "27"}, {"content": "Phase 4 - Architecture Pattern 3: CQRS (Command Query Responsibility Segregation)", "status": "completed", "id": "28"}, {"content": "Phase 4 - Architecture Pattern 4: Domain-Driven Design (DDD)", "status": "completed", "id": "29"}, {"content": "Phase 4 - Architecture Pattern 5: Clean Architecture", "status": "in_progress", "id": "30"}, {"content": "Phase 4 - Architecture Pattern 6: Hexagonal Architecture", "status": "pending", "id": "31"}, {"content": "Phase 4 - Architecture Pattern 7: Event Sourcing", "status": "pending", "id": "32"}, {"content": "Phase 4 - Architecture Pattern 8: API Gateway Patterns", "status": "pending", "id": "33"}, {"content": "Phase 5: Development Methodologies (3 documents)", "status": "pending", "id": "34"}]