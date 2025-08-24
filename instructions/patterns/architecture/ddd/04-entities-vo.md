# エンティティと値オブジェクト

## エンティティパターン

### 基底エンティティクラス

```typescript
// shared/domain/entity.ts
export abstract class Entity<TId> {
  protected readonly _id: TId;
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

  equals(other: Entity<TId>): boolean {
    if (!other) return false;
    if (this === other) return true;
    if (this.constructor !== other.constructor) return false;
    return this._id === other._id;
  }

  protected updateTimestamp(): void {
    this._updatedAt = new Date();
  }
}
```

### OrderLineエンティティ

```typescript
// order/domain/entities/order-line.ts
export class OrderLine extends Entity<OrderLineId> {
  private _productId: ProductId;
  private _quantity: Quantity;
  private _unitPrice: Money;
  private _discount: Discount | null = null;

  constructor(
    id: OrderLineId,
    productId: ProductId,
    quantity: Quantity,
    unitPrice: Money
  ) {
    super(id);
    this._productId = productId;
    this._quantity = quantity;
    this._unitPrice = unitPrice;
  }

  static create(
    productId: ProductId,
    quantity: Quantity,
    unitPrice: Money
  ): OrderLine {
    const id = OrderLineId.generate();
    return new OrderLine(id, productId, quantity, unitPrice);
  }

  changeQuantity(newQuantity: Quantity): void {
    if (newQuantity.isZero()) {
      throw new DomainError('Order line quantity cannot be zero');
    }
    this._quantity = newQuantity;
    this.updateTimestamp();
  }

  applyDiscount(discount: Discount): void {
    if (this._discount) {
      throw new DomainError('Discount already applied to this order line');
    }
    this._discount = discount;
    this.updateTimestamp();
  }

  get totalAmount(): Money {
    const baseAmount = this._unitPrice.multiply(this._quantity.value);
    
    if (this._discount) {
      return this._discount.apply(baseAmount);
    }
    
    return baseAmount;
  }

  get productId(): ProductId { return this._productId; }
  get quantity(): Quantity { return this._quantity; }
  get unitPrice(): Money { return this._unitPrice; }
}
```

## 値オブジェクトパターン

### 基底値オブジェクトクラス

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
```

### 商品名値オブジェクト

```typescript
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

  get value(): string { return this._value; }

  equals(other: ValueObject): boolean {
    if (!(other instanceof ProductName)) return false;
    return this._value === other._value;
  }

  toString(): string { return this._value; }
}
```

### Money値オブジェクト

```typescript
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
    if (amount < 0) {
      throw new DomainError('Money amount cannot be negative');
    }

    if (amount > 1_000_000) {
      throw new DomainError('Money amount cannot exceed 1,000,000');
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
    const result = this._amount - other._amount;
    
    if (result < 0) {
      throw new DomainError('Money subtraction would result in negative amount');
    }
    
    return new Money(result, this._currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new DomainError('Cannot multiply money by negative factor');
    }
    
    return Money.create(this._amount * factor, this._currency);
  }

  private validateSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new DomainError('Cannot operate on money with different currencies');
    }
  }

  equals(other: ValueObject): boolean {
    if (!(other instanceof Money)) return false;
    return this._amount === other._amount && 
           this._currency.equals(other._currency);
  }

  get amount(): number { return this._amount; }
  get currency(): Currency { return this._currency; }
}