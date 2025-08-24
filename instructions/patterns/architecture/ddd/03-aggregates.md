# アグリゲート

## アグリゲートルートの実装

### 基底クラス

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

  get id(): TId { return this._id; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

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
```

### プロダクトアグリゲート実装

```typescript
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
      this._id, this._name, this._category, this._brand, this._sku
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
      this._id, oldPrice, newPrice, reason, changedBy
    ));
  }

  addVariant(variant: ProductVariant): void {
    this.validateVariantUniqueness(variant);
    
    this._variants.push(variant);
    this.incrementVersion();
    
    this.addDomainEvent(new ProductVariantAddedEvent(this._id, variant));
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
      this._id, reason, discontinuedBy
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
  get name(): ProductName { return this._name; }
  get description(): ProductDescription { return this._description; }
  get price(): Price | null { return this._price; }
  get category(): CategoryId { return this._category; }
  get sku(): SKU { return this._sku; }
  get status(): ProductStatus { return this._status; }
  get variants(): readonly ProductVariant[] { return this._variants; }
  get specifications(): readonly ProductSpecification[] { return this._specifications; }

  isPublished(): boolean { return this._status === ProductStatus.PUBLISHED; }
  isDiscontinued(): boolean { return this._status === ProductStatus.DISCONTINUED; }
}