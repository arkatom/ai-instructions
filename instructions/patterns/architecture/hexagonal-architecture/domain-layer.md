# Domain Layer Implementation

> 🎯 **目的**: ビジネスロジックの中核となるドメイン層の設計実装
> 
> 📊 **対象**: エンティティ、値オブジェクト、ドメインサービス、集約
> 
> ⚡ **特徴**: 不変性、ビジネスルール集約、技術非依存の純粋な設計

## ドメインモデル設計

### 値オブジェクト（Value Objects）

```typescript
// 強力な型安全性を持つ値オブジェクト
export class OrderId {
  private readonly value: string;
  
  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('OrderId cannot be empty');
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
      throw new Error('OrderId contains invalid characters');
    }
    this.value = value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }

  // 値オブジェクトは不変
  static generate(): OrderId {
    return new OrderId(`ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }
}

export class Money {
  private readonly amount: number;
  private readonly currency: string;
  
  constructor(amount: number, currency: string) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be 3-letter code');
    }
    this.amount = this.roundToCents(amount);
    this.currency = currency.toUpperCase();
  }

  add(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.validateSameCurrency(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error('Resulting amount cannot be negative');
    }
    return new Money(result, this.currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Factor cannot be negative');
    }
    return new Money(this.amount * factor, this.currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  private validateSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate with different currencies: ${this.currency} and ${other.currency}`);
    }
  }

  private roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}

// 複合値オブジェクト
export class OrderItem {
  private readonly productId: string;
  private readonly productName: string;
  private readonly unitPrice: Money;
  private readonly quantity: number;

  constructor(
    productId: string,
    productName: string,
    unitPrice: Money,
    quantity: number
  ) {
    if (!productId) throw new Error('ProductId is required');
    if (!productName) throw new Error('ProductName is required');
    if (quantity <= 0) throw new Error('Quantity must be positive');
    
    this.productId = productId;
    this.productName = productName;
    this.unitPrice = unitPrice;
    this.quantity = quantity;
  }

  getTotalPrice(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  getProductId(): string {
    return this.productId;
  }

  getProductName(): string {
    return this.productName;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getUnitPrice(): Money {
    return this.unitPrice;
  }

  changeQuantity(newQuantity: number): OrderItem {
    return new OrderItem(
      this.productId,
      this.productName,
      this.unitPrice,
      newQuantity
    );
  }
}
```

### エンティティ（Entities）

```typescript
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

// ビジネスルールを内包するエンティティ
export class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;
  private readonly createdAt: Date;
  private confirmedAt?: Date;
  private shippedAt?: Date;
  private deliveredAt?: Date;

  constructor(
    private readonly id: OrderId,
    private readonly customerId: string
  ) {
    if (!customerId) {
      throw new Error('CustomerId is required');
    }
    this.createdAt = new Date();
  }

  // ビジネスルールを含むメソッド
  addItem(item: OrderItem): void {
    this.ensureOrderIsPending();
    
    const existingItemIndex = this.items.findIndex(
      existing => existing.getProductId() === item.getProductId()
    );

    if (existingItemIndex >= 0) {
      // 既存アイテムがある場合は数量を更新
      const existingItem = this.items[existingItemIndex];
      const newQuantity = existingItem.getQuantity() + item.getQuantity();
      this.items[existingItemIndex] = existingItem.changeQuantity(newQuantity);
    } else {
      this.items.push(item);
    }
  }

  removeItem(productId: string): void {
    this.ensureOrderIsPending();
    this.items = this.items.filter(item => 
      item.getProductId() !== productId
    );
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Order can only be confirmed from pending status');
    }
    
    this.status = OrderStatus.CONFIRMED;
    this.confirmedAt = new Date();
  }

  ship(): void {
    if (this.status !== OrderStatus.CONFIRMED) {
      throw new Error('Can only ship confirmed orders');
    }
    this.status = OrderStatus.SHIPPED;
    this.shippedAt = new Date();
  }

  deliver(): void {
    if (this.status !== OrderStatus.SHIPPED) {
      throw new Error('Can only deliver shipped orders');
    }
    this.status = OrderStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  cancel(): void {
    if (this.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel delivered order');
    }
    if (this.status === OrderStatus.CANCELLED) {
      throw new Error('Order is already cancelled');
    }
    this.status = OrderStatus.CANCELLED;
  }

  // ビジネス計算ロジック
  getTotalAmount(): Money {
    if (this.items.length === 0) {
      return new Money(0, 'USD');
    }
    
    return this.items.reduce(
      (total, item) => total.add(item.getTotalPrice()),
      new Money(0, this.items[0].getTotalPrice().getCurrency())
    );
  }

  getItemCount(): number {
    return this.items.reduce((total, item) => total + item.getQuantity(), 0);
  }

  // 読み取り専用アクセサー
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

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  getConfirmedAt(): Date | undefined {
    return this.confirmedAt ? new Date(this.confirmedAt) : undefined;
  }

  private ensureOrderIsPending(): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
  }
}
```

## ドメインサービス

### 価格計算サービス

```typescript
// ドメインサービス: 複数のエンティティにまたがるビジネスロジック
export interface DiscountPolicy {
  calculateDiscount(order: Order): Money;
  getName(): string;
  isApplicable(order: Order): boolean;
}

export class VolumeDiscountPolicy implements DiscountPolicy {
  constructor(
    private readonly threshold: number,
    private readonly discountPercentage: number,
    private readonly name: string = `Volume discount ${discountPercentage}%`
  ) {
    if (threshold <= 0) throw new Error('Threshold must be positive');
    if (discountPercentage <= 0 || discountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
  }

  calculateDiscount(order: Order): Money {
    if (!this.isApplicable(order)) {
      return new Money(0, order.getTotalAmount().getCurrency());
    }

    return order.getTotalAmount().multiply(this.discountPercentage / 100);
  }

  getName(): string {
    return this.name;
  }

  isApplicable(order: Order): boolean {
    return order.getTotalAmount().getAmount() >= this.threshold;
  }
}

export class LoyaltyDiscountPolicy implements DiscountPolicy {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly discountPercentage: number,
    private readonly name: string = `Loyalty discount ${discountPercentage}%`
  ) {}

  calculateDiscount(order: Order): Money {
    if (!this.isApplicable(order)) {
      return new Money(0, order.getTotalAmount().getCurrency());
    }

    return order.getTotalAmount().multiply(this.discountPercentage / 100);
  }

  getName(): string {
    return this.name;
  }

  isApplicable(order: Order): boolean {
    return this.loyaltyService.isLoyalCustomer(order.getCustomerId());
  }
}

// ドメインサービスのインターフェース（ポート）
export interface LoyaltyService {
  isLoyalCustomer(customerId: string): boolean;
  getLoyaltyPoints(customerId: string): number;
}

export class PricingService {
  constructor(private readonly policies: DiscountPolicy[]) {
    if (!policies || policies.length === 0) {
      throw new Error('At least one discount policy is required');
    }
  }

  calculateFinalPrice(order: Order): PriceCalculation {
    const basePrice = order.getTotalAmount();
    const applicableDiscounts: DiscountApplication[] = [];
    
    let totalDiscount = new Money(0, basePrice.getCurrency());
    
    for (const policy of this.policies) {
      if (policy.isApplicable(order)) {
        const discount = policy.calculateDiscount(order);
        totalDiscount = totalDiscount.add(discount);
        applicableDiscounts.push({
          policyName: policy.getName(),
          discountAmount: discount
        });
      }
    }
    
    const finalPrice = new Money(
      Math.max(0, basePrice.getAmount() - totalDiscount.getAmount()),
      basePrice.getCurrency()
    );

    return new PriceCalculation(
      basePrice,
      applicableDiscounts,
      totalDiscount,
      finalPrice
    );
  }
}

// 価格計算結果の値オブジェクト
export interface DiscountApplication {
  policyName: string;
  discountAmount: Money;
}

export class PriceCalculation {
  constructor(
    private readonly basePrice: Money,
    private readonly discounts: DiscountApplication[],
    private readonly totalDiscount: Money,
    private readonly finalPrice: Money
  ) {}

  getBasePrice(): Money {
    return this.basePrice;
  }

  getDiscounts(): ReadonlyArray<DiscountApplication> {
    return [...this.discounts];
  }

  getTotalDiscount(): Money {
    return this.totalDiscount;
  }

  getFinalPrice(): Money {
    return this.finalPrice;
  }

  hasDiscounts(): boolean {
    return !this.totalDiscount.isZero();
  }
}
```

## ドメインイベント

### イベント駆動設計

```typescript
// ドメインイベントの基底クラス
export abstract class DomainEvent {
  private readonly occurredAt: Date = new Date();
  private readonly eventId: string = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  getOccurredAt(): Date {
    return new Date(this.occurredAt);
  }

  getEventId(): string {
    return this.eventId;
  }

  abstract getEventType(): string;
}

// 具体的なドメインイベント
export class OrderConfirmedEvent extends DomainEvent {
  constructor(
    private readonly orderId: OrderId,
    private readonly customerId: string,
    private readonly totalAmount: Money
  ) {
    super();
  }

  getEventType(): string {
    return 'OrderConfirmed';
  }

  getOrderId(): OrderId {
    return this.orderId;
  }

  getCustomerId(): string {
    return this.customerId;
  }

  getTotalAmount(): Money {
    return this.totalAmount;
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    private readonly orderId: OrderId,
    private readonly reason: string
  ) {
    super();
  }

  getEventType(): string {
    return 'OrderCancelled';
  }

  getOrderId(): OrderId {
    return this.orderId;
  }

  getReason(): string {
    return this.reason;
  }
}

// ドメインイベント発行機能を持つエンティティ
export abstract class EventSourcedEntity {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): ReadonlyArray<DomainEvent> {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
```

**実装ガイドライン**: 
- 値オブジェクトは不変性を保持
- エンティティはビジネスルールを内包
- ドメインサービスは複数エンティティのロジック処理
- ドメインイベントで副作用を分離

