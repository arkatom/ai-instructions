# CQRS (Command Query Responsibility Segregation) - 実装パターン集

> コマンド・クエリ責務分離アーキテクチャの設計と実装パターン
> 
> **対象レベル**: 中級〜上級  
> **最終更新**: 2025年1月  
> **技術スタック**: TypeScript, Node.js, PostgreSQL, Redis, Event Sourcing

## 🎯 中核概念と設計原則

### 1. CQRS基本構造

```typescript
// shared/cqrs/interfaces.ts
export interface Command {
  readonly commandId: string;
  readonly aggregateId: string;
  readonly timestamp: Date;
  readonly userId?: string;
  getCommandType(): string;
  validate(): ValidationResult;
}

export interface Query {
  readonly queryId: string;
  readonly timestamp: Date;
  readonly userId?: string;
  getQueryType(): string;
  validate(): ValidationResult;
}

export interface CommandHandler<TCommand extends Command, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
  getCommandType(): string;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
  getQueryType(): string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// shared/cqrs/base-command.ts
export abstract class BaseCommand implements Command {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly userId?: string
  ) {
    this.commandId = crypto.randomUUID();
    this.timestamp = new Date();
  }

  abstract getCommandType(): string;
  
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.aggregateId) {
      errors.push('Aggregate ID is required');
    }
    
    if (!this.commandId) {
      errors.push('Command ID is required');
    }
    
    // サブクラスでのカスタムバリデーション
    const customValidation = this.customValidate();
    errors.push(...customValidation.errors);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  protected customValidate(): ValidationResult {
    return { isValid: true, errors: [] };
  }
}

// shared/cqrs/base-query.ts
export abstract class BaseQuery implements Query {
  public readonly queryId: string;
  public readonly timestamp: Date;

  constructor(public readonly userId?: string) {
    this.queryId = crypto.randomUUID();
    this.timestamp = new Date();
  }

  abstract getQueryType(): string;
  
  validate(): ValidationResult {
    const errors: string[] = [];
    
    // サブクラスでのカスタムバリデーション
    const customValidation = this.customValidate();
    errors.push(...customValidation.errors);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  protected customValidate(): ValidationResult {
    return { isValid: true, errors: [] };
  }
}
```

### 2. Command Side実装

```typescript
// domain/commands/product-commands.ts
export class CreateProductCommand extends BaseCommand {
  constructor(
    aggregateId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly sku: string,
    userId?: string
  ) {
    super(aggregateId, userId);
  }

  getCommandType(): string {
    return 'CreateProduct';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Product name is required');
    }
    
    if (this.name && this.name.length > 200) {
      errors.push('Product name cannot exceed 200 characters');
    }
    
    if (!this.description || this.description.trim().length === 0) {
      errors.push('Product description is required');
    }
    
    if (this.price <= 0) {
      errors.push('Product price must be greater than 0');
    }
    
    if (!this.categoryId) {
      errors.push('Category ID is required');
    }
    
    if (!this.sku || this.sku.trim().length === 0) {
      errors.push('SKU is required');
    }
    
    if (this.sku && !/^[A-Z0-9-]{3,20}$/.test(this.sku)) {
      errors.push('SKU must be 3-20 characters, alphanumeric and dashes only');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class UpdateProductPriceCommand extends BaseCommand {
  constructor(
    aggregateId: string,
    public readonly newPrice: number,
    public readonly reason: string,
    userId?: string
  ) {
    super(aggregateId, userId);
  }

  getCommandType(): string {
    return 'UpdateProductPrice';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (this.newPrice <= 0) {
      errors.push('New price must be greater than 0');
    }
    
    if (!this.reason || this.reason.trim().length === 0) {
      errors.push('Reason for price update is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class DeactivateProductCommand extends BaseCommand {
  constructor(
    aggregateId: string,
    public readonly reason: string,
    userId?: string
  ) {
    super(aggregateId, userId);
  }

  getCommandType(): string {
    return 'DeactivateProduct';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.reason || this.reason.trim().length === 0) {
      errors.push('Reason for deactivation is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// domain/aggregates/product-aggregate.ts
export class ProductAggregate {
  private events: DomainEvent[] = [];
  private version: number = 0;

  constructor(
    public readonly id: string,
    private name: string,
    private description: string,
    private price: number,
    private categoryId: string,
    private sku: string,
    private isActive: boolean = true,
    private createdBy?: string,
    private createdAt?: Date
  ) {
    this.createdAt = createdAt || new Date();
  }

  // ファクトリーメソッド
  static create(command: CreateProductCommand): ProductAggregate {
    const product = new ProductAggregate(
      command.aggregateId,
      command.name,
      command.description,
      command.price,
      command.categoryId,
      command.sku,
      true,
      command.userId
    );

    product.addEvent(new ProductCreatedEvent(
      command.aggregateId,
      product.version + 1,
      command.name,
      command.description,
      command.price,
      command.categoryId,
      command.sku,
      command.userId
    ));

    product.version++;
    return product;
  }

  updatePrice(command: UpdateProductPriceCommand): void {
    if (!this.isActive) {
      throw new DomainError('Cannot update price of inactive product');
    }

    if (this.price === command.newPrice) {
      return; // 価格変更なし
    }

    const previousPrice = this.price;
    this.price = command.newPrice;

    this.addEvent(new ProductPriceUpdatedEvent(
      this.id,
      this.version + 1,
      previousPrice,
      command.newPrice,
      command.reason,
      command.userId
    ));

    this.version++;
  }

  deactivate(command: DeactivateProductCommand): void {
    if (!this.isActive) {
      throw new DomainError('Product is already deactivated');
    }

    this.isActive = false;

    this.addEvent(new ProductDeactivatedEvent(
      this.id,
      this.version + 1,
      command.reason,
      command.userId
    ));

    this.version++;
  }

  // Event Sourcing support
  static fromHistory(id: string, events: DomainEvent[]): ProductAggregate {
    if (events.length === 0) {
      throw new DomainError(`No events found for aggregate ${id}`);
    }

    const firstEvent = events[0];
    if (!(firstEvent instanceof ProductCreatedEvent)) {
      throw new DomainError('First event must be ProductCreatedEvent');
    }

    const product = new ProductAggregate(
      id,
      firstEvent.name,
      firstEvent.description,
      firstEvent.price,
      firstEvent.categoryId,
      firstEvent.sku,
      true,
      firstEvent.createdBy,
      firstEvent.occurredOn
    );

    // 残りのイベントを適用
    for (let i = 1; i < events.length; i++) {
      product.applyEvent(events[i]);
    }

    product.version = events[events.length - 1].aggregateVersion;
    return product;
  }

  private applyEvent(event: DomainEvent): void {
    switch (event.constructor.name) {
      case 'ProductPriceUpdatedEvent':
        this.applyProductPriceUpdatedEvent(event as ProductPriceUpdatedEvent);
        break;
      case 'ProductDeactivatedEvent':
        this.applyProductDeactivatedEvent(event as ProductDeactivatedEvent);
        break;
      default:
        throw new DomainError(`Unknown event type: ${event.constructor.name}`);
    }
  }

  private applyProductPriceUpdatedEvent(event: ProductPriceUpdatedEvent): void {
    this.price = event.newPrice;
  }

  private applyProductDeactivatedEvent(event: ProductDeactivatedEvent): void {
    this.isActive = false;
  }

  // Event management
  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  markEventsAsCommitted(): void {
    this.events = [];
  }

  private addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  // Getters
  get currentVersion(): number {
    return this.version;
  }

  get productName(): string {
    return this.name;
  }

  get currentPrice(): number {
    return this.price;
  }

  get active(): boolean {
    return this.isActive;
  }
}

// application/command-handlers/product-command-handlers.ts
export class CreateProductCommandHandler implements CommandHandler<CreateProductCommand> {
  constructor(
    private productRepository: ProductRepository,
    private skuService: SkuService,
    private categoryService: CategoryService,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  getCommandType(): string {
    return 'CreateProduct';
  }

  async handle(command: CreateProductCommand): Promise<void> {
    this.logger.info('Processing CreateProductCommand', {
      commandId: command.commandId,
      aggregateId: command.aggregateId,
      sku: command.sku
    });

    try {
      // ビジネスルール検証
      await this.validateBusinessRules(command);

      // 既存製品チェック
      const existingProduct = await this.productRepository.getById(command.aggregateId);
      if (existingProduct) {
        throw new DomainError(`Product already exists: ${command.aggregateId}`);
      }

      // SKU重複チェック
      const existingBySku = await this.productRepository.getBySku(command.sku);
      if (existingBySku) {
        throw new DomainError(`SKU already exists: ${command.sku}`);
      }

      // アグリゲート作成
      const product = ProductAggregate.create(command);

      // 永続化
      await this.productRepository.save(product);

      // イベント発行
      await this.eventBus.publish(product.getUncommittedEvents());

      this.logger.info('Product created successfully', {
        commandId: command.commandId,
        productId: command.aggregateId,
        sku: command.sku
      });

    } catch (error) {
      this.logger.error('Failed to create product', {
        commandId: command.commandId,
        aggregateId: command.aggregateId,
        error: error.message
      });
      throw error;
    }
  }

  private async validateBusinessRules(command: CreateProductCommand): Promise<void> {
    // カテゴリー存在チェック
    const categoryExists = await this.categoryService.exists(command.categoryId);
    if (!categoryExists) {
      throw new DomainError(`Category not found: ${command.categoryId}`);
    }

    // SKUフォーマット検証
    if (!this.skuService.isValidFormat(command.sku)) {
      throw new DomainError(`Invalid SKU format: ${command.sku}`);
    }
  }
}

export class UpdateProductPriceCommandHandler implements CommandHandler<UpdateProductPriceCommand> {
  constructor(
    private productRepository: ProductRepository,
    private pricingService: PricingService,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  getCommandType(): string {
    return 'UpdateProductPrice';
  }

  async handle(command: UpdateProductPriceCommand): Promise<void> {
    this.logger.info('Processing UpdateProductPriceCommand', {
      commandId: command.commandId,
      productId: command.aggregateId,
      newPrice: command.newPrice
    });

    try {
      // 製品取得
      const product = await this.productRepository.getById(command.aggregateId);
      if (!product) {
        throw new DomainError(`Product not found: ${command.aggregateId}`);
      }

      // ビジネスルール検証
      await this.validatePriceUpdate(command, product);

      const expectedVersion = product.currentVersion;

      // 価格更新
      product.updatePrice(command);

      // 永続化
      await this.productRepository.save(product, expectedVersion);

      // イベント発行
      await this.eventBus.publish(product.getUncommittedEvents());

      this.logger.info('Product price updated successfully', {
        commandId: command.commandId,
        productId: command.aggregateId,
        newPrice: command.newPrice
      });

    } catch (error) {
      this.logger.error('Failed to update product price', {
        commandId: command.commandId,
        productId: command.aggregateId,
        error: error.message
      });
      throw error;
    }
  }

  private async validatePriceUpdate(
    command: UpdateProductPriceCommand, 
    product: ProductAggregate
  ): Promise<void> {
    // 価格変更制限チェック
    const maxPriceChange = await this.pricingService.getMaxPriceChangePercentage();
    const currentPrice = product.currentPrice;
    const changePercentage = Math.abs((command.newPrice - currentPrice) / currentPrice) * 100;

    if (changePercentage > maxPriceChange) {
      throw new DomainError(
        `Price change exceeds maximum allowed percentage: ${changePercentage}% > ${maxPriceChange}%`
      );
    }

    // 最小価格チェック
    const minPrice = await this.pricingService.getMinimumPrice(product.productName);
    if (command.newPrice < minPrice) {
      throw new DomainError(`Price cannot be below minimum: ${command.newPrice} < ${minPrice}`);
    }
  }
}
```

### 3. Query Side実装

```typescript
// application/queries/product-queries.ts
export class GetProductByIdQuery extends BaseQuery {
  constructor(
    public readonly productId: string,
    userId?: string
  ) {
    super(userId);
  }

  getQueryType(): string {
    return 'GetProductById';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.productId) {
      errors.push('Product ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class SearchProductsQuery extends BaseQuery {
  constructor(
    public readonly searchTerm?: string,
    public readonly categoryId?: string,
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
    public readonly isActive?: boolean,
    public readonly sortBy: 'name' | 'price' | 'createdAt' = 'createdAt',
    public readonly sortOrder: 'asc' | 'desc' = 'desc',
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    userId?: string
  ) {
    super(userId);
  }

  getQueryType(): string {
    return 'SearchProducts';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (this.page < 1) {
      errors.push('Page must be >= 1');
    }
    
    if (this.pageSize < 1 || this.pageSize > 100) {
      errors.push('Page size must be between 1 and 100');
    }
    
    if (this.minPrice !== undefined && this.minPrice < 0) {
      errors.push('Minimum price must be >= 0');
    }
    
    if (this.maxPrice !== undefined && this.maxPrice < 0) {
      errors.push('Maximum price must be >= 0');
    }
    
    if (this.minPrice !== undefined && this.maxPrice !== undefined && this.minPrice > this.maxPrice) {
      errors.push('Minimum price cannot be greater than maximum price');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class GetProductAnalyticsQuery extends BaseQuery {
  constructor(
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly groupBy: 'day' | 'week' | 'month' = 'day',
    public readonly categoryId?: string,
    userId?: string
  ) {
    super(userId);
  }

  getQueryType(): string {
    return 'GetProductAnalytics';
  }

  protected customValidate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.startDate) {
      errors.push('Start date is required');
    }
    
    if (!this.endDate) {
      errors.push('End date is required');
    }
    
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      errors.push('Start date cannot be after end date');
    }
    
    // 最大90日の制限
    if (this.startDate && this.endDate) {
      const daysDiff = (this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        errors.push('Date range cannot exceed 90 days');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// infrastructure/read-models/product-read-model.ts
export interface ProductReadModel {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  categoryName: string;
  sku: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  lastPriceUpdate?: Date;
  priceHistory: PriceHistoryEntry[];
  totalSales: number;
  averageRating: number;
  reviewCount: number;
  tags: string[];
}

export interface PriceHistoryEntry {
  price: number;
  changedAt: Date;
  changedBy: string;
  reason: string;
}

export interface ProductSearchResult {
  products: ProductReadModel[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ProductAnalytics {
  period: string;
  totalProducts: number;
  activeProducts: number;
  newProducts: number;
  deactivatedProducts: number;
  averagePrice: number;
  priceChanges: number;
  topCategories: CategoryAnalytics[];
  dailyStats: DailyProductStats[];
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  productCount: number;
  averagePrice: number;
  totalSales: number;
}

export interface DailyProductStats {
  date: string;
  newProducts: number;
  priceChanges: number;
  activations: number;
  deactivations: number;
}

// application/query-handlers/product-query-handlers.ts
export class ProductQueryHandler implements
  QueryHandler<GetProductByIdQuery, ProductReadModel | null>,
  QueryHandler<SearchProductsQuery, ProductSearchResult>,
  QueryHandler<GetProductAnalyticsQuery, ProductAnalytics> {

  constructor(
    private readModelDb: Pool,
    private cacheService: CacheService,
    private logger: Logger
  ) {}

  getQueryType(): string {
    return 'ProductQuery';
  }

  async handle(query: Query): Promise<any> {
    switch (query.getQueryType()) {
      case 'GetProductById':
        return this.handleGetProductById(query as GetProductByIdQuery);
      case 'SearchProducts':
        return this.handleSearchProducts(query as SearchProductsQuery);
      case 'GetProductAnalytics':
        return this.handleGetProductAnalytics(query as GetProductAnalyticsQuery);
      default:
        throw new Error(`Unsupported query type: ${query.getQueryType()}`);
    }
  }

  private async handleGetProductById(query: GetProductByIdQuery): Promise<ProductReadModel | null> {
    const cacheKey = `product:${query.productId}`;
    
    // キャッシュチェック
    const cached = await this.cacheService.get<ProductReadModel>(cacheKey);
    if (cached) {
      this.logger.debug('Product retrieved from cache', { productId: query.productId });
      return cached;
    }

    try {
      const result = await this.readModelDb.query(`
        SELECT 
          p.id, p.name, p.description, p.price, p.category_id, c.name as category_name,
          p.sku, p.is_active, p.created_by, p.created_at, p.last_price_update,
          p.total_sales, p.average_rating, p.review_count,
          array_agg(DISTINCT t.name) as tags,
          json_agg(
            json_build_object(
              'price', ph.price,
              'changedAt', ph.changed_at,
              'changedBy', ph.changed_by,
              'reason', ph.reason
            ) ORDER BY ph.changed_at DESC
          ) as price_history
        FROM product_read_model p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        LEFT JOIN price_history ph ON p.id = ph.product_id
        WHERE p.id = $1
        GROUP BY p.id, c.name
      `, [query.productId]);

      if (result.rows.length === 0) {
        return null;
      }

      const product = this.mapToProductReadModel(result.rows[0]);
      
      // キャッシュに保存（15分）
      await this.cacheService.set(cacheKey, product, 900);
      
      return product;

    } catch (error) {
      this.logger.error('Failed to get product by ID', {
        queryId: query.queryId,
        productId: query.productId,
        error: error.message
      });
      throw error;
    }
  }

  private async handleSearchProducts(query: SearchProductsQuery): Promise<ProductSearchResult> {
    const cacheKey = this.generateSearchCacheKey(query);
    
    // キャッシュチェック（検索結果は5分間キャッシュ）
    const cached = await this.cacheService.get<ProductSearchResult>(cacheKey);
    if (cached) {
      this.logger.debug('Search results retrieved from cache', { 
        searchTerm: query.searchTerm,
        categoryId: query.categoryId 
      });
      return cached;
    }

    try {
      const conditions: string[] = ['1=1'];
      const parameters: any[] = [];
      let paramIndex = 1;

      // 検索条件構築
      if (query.searchTerm) {
        conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
        parameters.push(`%${query.searchTerm}%`);
        paramIndex++;
      }

      if (query.categoryId) {
        conditions.push(`p.category_id = $${paramIndex}`);
        parameters.push(query.categoryId);
        paramIndex++;
      }

      if (query.minPrice !== undefined) {
        conditions.push(`p.price >= $${paramIndex}`);
        parameters.push(query.minPrice);
        paramIndex++;
      }

      if (query.maxPrice !== undefined) {
        conditions.push(`p.price <= $${paramIndex}`);
        parameters.push(query.maxPrice);
        paramIndex++;
      }

      if (query.isActive !== undefined) {
        conditions.push(`p.is_active = $${paramIndex}`);
        parameters.push(query.isActive);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');
      
      // ソート順
      const orderBy = this.buildOrderByClause(query.sortBy, query.sortOrder);
      
      // 総数取得
      const countResult = await this.readModelDb.query(`
        SELECT COUNT(*) as total
        FROM product_read_model p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereClause}
      `, parameters);

      const totalCount = parseInt(countResult.rows[0].total);
      
      // データ取得
      const offset = (query.page - 1) * query.pageSize;
      parameters.push(query.pageSize, offset);
      
      const dataResult = await this.readModelDb.query(`
        SELECT 
          p.id, p.name, p.description, p.price, p.category_id, c.name as category_name,
          p.sku, p.is_active, p.created_by, p.created_at, p.last_price_update,
          p.total_sales, p.average_rating, p.review_count,
          array_agg(DISTINCT t.name) as tags
        FROM product_read_model p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE ${whereClause}
        GROUP BY p.id, c.name
        ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, parameters);

      const products = dataResult.rows.map(row => this.mapToProductReadModel(row));
      
      const totalPages = Math.ceil(totalCount / query.pageSize);
      
      const result: ProductSearchResult = {
        products,
        totalCount,
        page: query.page,
        pageSize: query.pageSize,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1
      };

      // キャッシュに保存（5分）
      await this.cacheService.set(cacheKey, result, 300);
      
      return result;

    } catch (error) {
      this.logger.error('Failed to search products', {
        queryId: query.queryId,
        searchTerm: query.searchTerm,
        error: error.message
      });
      throw error;
    }
  }

  private async handleGetProductAnalytics(query: GetProductAnalyticsQuery): Promise<ProductAnalytics> {
    const cacheKey = `analytics:products:${query.startDate.toISOString()}:${query.endDate.toISOString()}:${query.groupBy}:${query.categoryId || 'all'}`;
    
    // キャッシュチェック（1時間）
    const cached = await this.cacheService.get<ProductAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const conditions = [`date >= $1 AND date <= $2`];
      const parameters = [query.startDate, query.endDate];
      
      if (query.categoryId) {
        conditions.push(`category_id = $3`);
        parameters.push(query.categoryId);
      }

      const whereClause = conditions.join(' AND ');

      // 基本統計
      const basicStats = await this.readModelDb.query(`
        SELECT 
          COUNT(DISTINCT id) as total_products,
          COUNT(DISTINCT CASE WHEN is_active THEN id END) as active_products,
          COUNT(DISTINCT CASE WHEN created_at >= $1 THEN id END) as new_products,
          COUNT(DISTINCT CASE WHEN deactivated_at >= $1 THEN id END) as deactivated_products,
          AVG(price) as average_price,
          COUNT(DISTINCT CASE WHEN last_price_update >= $1 THEN id END) as price_changes
        FROM product_read_model p
        WHERE ${whereClause}
      `, parameters);

      // カテゴリー別統計
      const categoryStats = await this.readModelDb.query(`
        SELECT 
          c.id as category_id,
          c.name as category_name,
          COUNT(p.id) as product_count,
          AVG(p.price) as average_price,
          SUM(p.total_sales) as total_sales
        FROM categories c
        LEFT JOIN product_read_model p ON c.id = p.category_id
        WHERE p.created_at <= $2 ${query.categoryId ? 'AND c.id = $3' : ''}
        GROUP BY c.id, c.name
        ORDER BY product_count DESC
        LIMIT 10
      `, parameters);

      // 日次統計
      const dailyStats = await this.readModelDb.query(`
        SELECT 
          date_trunc('${query.groupBy}', date) as period,
          COUNT(CASE WHEN event_type = 'ProductCreated' THEN 1 END) as new_products,
          COUNT(CASE WHEN event_type = 'ProductPriceUpdated' THEN 1 END) as price_changes,
          COUNT(CASE WHEN event_type = 'ProductActivated' THEN 1 END) as activations,
          COUNT(CASE WHEN event_type = 'ProductDeactivated' THEN 1 END) as deactivations
        FROM product_events
        WHERE ${whereClause}
        GROUP BY period
        ORDER BY period
      `, parameters);

      const analytics: ProductAnalytics = {
        period: `${query.startDate.toISOString()} - ${query.endDate.toISOString()}`,
        totalProducts: parseInt(basicStats.rows[0].total_products),
        activeProducts: parseInt(basicStats.rows[0].active_products),
        newProducts: parseInt(basicStats.rows[0].new_products),
        deactivatedProducts: parseInt(basicStats.rows[0].deactivated_products),
        averagePrice: parseFloat(basicStats.rows[0].average_price || '0'),
        priceChanges: parseInt(basicStats.rows[0].price_changes),
        topCategories: categoryStats.rows.map(row => ({
          categoryId: row.category_id,
          categoryName: row.category_name,
          productCount: parseInt(row.product_count),
          averagePrice: parseFloat(row.average_price || '0'),
          totalSales: parseInt(row.total_sales || '0')
        })),
        dailyStats: dailyStats.rows.map(row => ({
          date: row.period,
          newProducts: parseInt(row.new_products || '0'),
          priceChanges: parseInt(row.price_changes || '0'),
          activations: parseInt(row.activations || '0'),
          deactivations: parseInt(row.deactivations || '0')
        }))
      };

      // キャッシュに保存（1時間）
      await this.cacheService.set(cacheKey, analytics, 3600);
      
      return analytics;

    } catch (error) {
      this.logger.error('Failed to get product analytics', {
        queryId: query.queryId,
        error: error.message
      });
      throw error;
    }
  }

  private mapToProductReadModel(row: any): ProductReadModel {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      categoryId: row.category_id,
      categoryName: row.category_name,
      sku: row.sku,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastPriceUpdate: row.last_price_update,
      priceHistory: row.price_history || [],
      totalSales: parseInt(row.total_sales || '0'),
      averageRating: parseFloat(row.average_rating || '0'),
      reviewCount: parseInt(row.review_count || '0'),
      tags: row.tags ? row.tags.filter(t => t !== null) : []
    };
  }

  private generateSearchCacheKey(query: SearchProductsQuery): string {
    const keyParts = [
      'search',
      query.searchTerm || 'all',
      query.categoryId || 'all',
      query.minPrice || 'any',
      query.maxPrice || 'any',
      query.isActive !== undefined ? query.isActive.toString() : 'any',
      query.sortBy,
      query.sortOrder,
      query.page.toString(),
      query.pageSize.toString()
    ];
    
    return keyParts.join(':');
  }

  private buildOrderByClause(sortBy: string, sortOrder: string): string {
    const validSortFields = {
      name: 'p.name',
      price: 'p.price',
      createdAt: 'p.created_at'
    };

    const field = validSortFields[sortBy] || 'p.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    return `ORDER BY ${field} ${order}`;
  }
}
```

### 4. Command・Query Bus実装

```typescript
// infrastructure/cqrs/command-bus.ts
export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private middlewares: CommandMiddleware[] = [];

  constructor(private logger: Logger) {}

  registerHandler<TCommand extends Command>(handler: CommandHandler<TCommand>): void {
    const commandType = handler.getCommandType();
    
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command type: ${commandType}`);
    }
    
    this.handlers.set(commandType, handler);
    this.logger.info('Command handler registered', { commandType });
  }

  addMiddleware(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  async execute<TCommand extends Command>(command: TCommand): Promise<void> {
    const commandType = command.getCommandType();
    
    this.logger.info('Executing command', {
      commandId: command.commandId,
      commandType,
      aggregateId: command.aggregateId
    });

    // バリデーション
    const validationResult = command.validate();
    if (!validationResult.isValid) {
      throw new ValidationError(`Command validation failed: ${validationResult.errors.join(', ')}`);
    }

    // ハンドラー取得
    const handler = this.handlers.get(commandType);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${commandType}`);
    }

    // ミドルウェア実行
    const context: CommandContext = {
      command,
      handler,
      timestamp: new Date()
    };

    try {
      await this.executeWithMiddlewares(context);
      
      this.logger.info('Command executed successfully', {
        commandId: command.commandId,
        commandType
      });

    } catch (error) {
      this.logger.error('Command execution failed', {
        commandId: command.commandId,
        commandType,
        error: error.message
      });
      throw error;
    }
  }

  private async executeWithMiddlewares(context: CommandContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware.execute(context, next);
      } else {
        await context.handler.handle(context.command);
      }
    };

    await next();
  }
}

export interface CommandMiddleware {
  execute(context: CommandContext, next: () => Promise<void>): Promise<void>;
}

export interface CommandContext {
  command: Command;
  handler: CommandHandler<any>;
  timestamp: Date;
}

// infrastructure/cqrs/query-bus.ts
export class QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();
  private middlewares: QueryMiddleware[] = [];

  constructor(private logger: Logger) {}

  registerHandler<TQuery extends Query, TResult>(handler: QueryHandler<TQuery, TResult>): void {
    const queryType = handler.getQueryType();
    
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for query type: ${queryType}`);
    }
    
    this.handlers.set(queryType, handler);
    this.logger.info('Query handler registered', { queryType });
  }

  addMiddleware(middleware: QueryMiddleware): void {
    this.middlewares.push(middleware);
  }

  async execute<TQuery extends Query, TResult>(query: TQuery): Promise<TResult> {
    const queryType = query.getQueryType();
    
    this.logger.debug('Executing query', {
      queryId: query.queryId,
      queryType
    });

    // バリデーション
    const validationResult = query.validate();
    if (!validationResult.isValid) {
      throw new ValidationError(`Query validation failed: ${validationResult.errors.join(', ')}`);
    }

    // ハンドラー取得
    const handler = this.handlers.get(queryType);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${queryType}`);
    }

    // ミドルウェア実行
    const context: QueryContext<TQuery, TResult> = {
      query,
      handler,
      timestamp: new Date()
    };

    try {
      const result = await this.executeWithMiddlewares(context);
      
      this.logger.debug('Query executed successfully', {
        queryId: query.queryId,
        queryType
      });

      return result;

    } catch (error) {
      this.logger.error('Query execution failed', {
        queryId: query.queryId,
        queryType,
        error: error.message
      });
      throw error;
    }
  }

  private async executeWithMiddlewares<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>
  ): Promise<TResult> {
    let index = 0;

    const next = async (): Promise<TResult> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return await middleware.execute(context, next);
      } else {
        return await context.handler.handle(context.query);
      }
    };

    return await next();
  }
}

export interface QueryMiddleware {
  execute<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>, 
    next: () => Promise<TResult>
  ): Promise<TResult>;
}

export interface QueryContext<TQuery extends Query, TResult> {
  query: TQuery;
  handler: QueryHandler<TQuery, TResult>;
  timestamp: Date;
}
```

### 5. ミドルウェアとクロスカッティング関心事

```typescript
// infrastructure/cqrs/middlewares/logging-middleware.ts
export class LoggingCommandMiddleware implements CommandMiddleware {
  constructor(private logger: Logger) {}

  async execute(context: CommandContext, next: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info('Command processing started', {
      commandId: context.command.commandId,
      commandType: context.command.getCommandType(),
      aggregateId: context.command.aggregateId,
      userId: context.command.userId
    });

    try {
      await next();
      
      const duration = Date.now() - startTime;
      this.logger.info('Command processing completed', {
        commandId: context.command.commandId,
        commandType: context.command.getCommandType(),
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Command processing failed', {
        commandId: context.command.commandId,
        commandType: context.command.getCommandType(),
        duration,
        error: error.message
      });
      throw error;
    }
  }
}

export class LoggingQueryMiddleware implements QueryMiddleware {
  constructor(private logger: Logger) {}

  async execute<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>,
    next: () => Promise<TResult>
  ): Promise<TResult> {
    const startTime = Date.now();
    
    this.logger.debug('Query processing started', {
      queryId: context.query.queryId,
      queryType: context.query.getQueryType(),
      userId: context.query.userId
    });

    try {
      const result = await next();
      
      const duration = Date.now() - startTime;
      this.logger.debug('Query processing completed', {
        queryId: context.query.queryId,
        queryType: context.query.getQueryType(),
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Query processing failed', {
        queryId: context.query.queryId,
        queryType: context.query.getQueryType(),
        duration,
        error: error.message
      });
      throw error;
    }
  }
}

// infrastructure/cqrs/middlewares/authorization-middleware.ts
export class AuthorizationCommandMiddleware implements CommandMiddleware {
  constructor(
    private authorizationService: AuthorizationService,
    private logger: Logger
  ) {}

  async execute(context: CommandContext, next: () => Promise<void>): Promise<void> {
    const command = context.command;
    
    if (!command.userId) {
      throw new AuthorizationError('User ID is required for command execution');
    }

    const isAuthorized = await this.authorizationService.isAuthorizedForCommand(
      command.userId,
      command.getCommandType(),
      command.aggregateId
    );

    if (!isAuthorized) {
      this.logger.warn('Unauthorized command execution attempt', {
        commandId: command.commandId,
        commandType: command.getCommandType(),
        userId: command.userId,
        aggregateId: command.aggregateId
      });
      
      throw new AuthorizationError(
        `User ${command.userId} is not authorized to execute ${command.getCommandType()}`
      );
    }

    await next();
  }
}

export class AuthorizationQueryMiddleware implements QueryMiddleware {
  constructor(
    private authorizationService: AuthorizationService,
    private logger: Logger
  ) {}

  async execute<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>,
    next: () => Promise<TResult>
  ): Promise<TResult> {
    const query = context.query;
    
    if (!query.userId) {
      throw new AuthorizationError('User ID is required for query execution');
    }

    const isAuthorized = await this.authorizationService.isAuthorizedForQuery(
      query.userId,
      query.getQueryType()
    );

    if (!isAuthorized) {
      this.logger.warn('Unauthorized query execution attempt', {
        queryId: query.queryId,
        queryType: query.getQueryType(),
        userId: query.userId
      });
      
      throw new AuthorizationError(
        `User ${query.userId} is not authorized to execute ${query.getQueryType()}`
      );
    }

    return await next();
  }
}

// infrastructure/cqrs/middlewares/performance-middleware.ts
export class PerformanceCommandMiddleware implements CommandMiddleware {
  constructor(
    private metricsService: MetricsService,
    private logger: Logger
  ) {}

  async execute(context: CommandContext, next: () => Promise<void>): Promise<void> {
    const startTime = process.hrtime.bigint();
    const commandType = context.command.getCommandType();

    try {
      await next();
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // ナノ秒をミリ秒に変換

      this.metricsService.recordCommandExecutionTime(commandType, duration);
      this.metricsService.incrementCommandCounter(commandType, 'success');

      // 長時間実行の警告
      if (duration > 5000) { // 5秒以上
        this.logger.warn('Slow command execution detected', {
          commandId: context.command.commandId,
          commandType,
          duration
        });
      }

    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      this.metricsService.recordCommandExecutionTime(commandType, duration);
      this.metricsService.incrementCommandCounter(commandType, 'error');

      throw error;
    }
  }
}

export class PerformanceQueryMiddleware implements QueryMiddleware {
  constructor(
    private metricsService: MetricsService,
    private logger: Logger
  ) {}

  async execute<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>,
    next: () => Promise<TResult>
  ): Promise<TResult> {
    const startTime = process.hrtime.bigint();
    const queryType = context.query.getQueryType();

    try {
      const result = await next();
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      this.metricsService.recordQueryExecutionTime(queryType, duration);
      this.metricsService.incrementQueryCounter(queryType, 'success');

      // 長時間実行の警告
      if (duration > 2000) { // 2秒以上
        this.logger.warn('Slow query execution detected', {
          queryId: context.query.queryId,
          queryType,
          duration
        });
      }

      return result;

    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      this.metricsService.recordQueryExecutionTime(queryType, duration);
      this.metricsService.incrementQueryCounter(queryType, 'error');

      throw error;
    }
  }
}

// infrastructure/cqrs/middlewares/caching-middleware.ts
export class CachingQueryMiddleware implements QueryMiddleware {
  constructor(
    private cacheService: CacheService,
    private logger: Logger
  ) {}

  async execute<TQuery extends Query, TResult>(
    context: QueryContext<TQuery, TResult>,
    next: () => Promise<TResult>
  ): Promise<TResult> {
    const query = context.query;
    const cacheKey = this.generateCacheKey(query);
    
    // キャッシュ可能なクエリかチェック
    if (!this.isCacheable(query)) {
      return await next();
    }

    try {
      // キャッシュからの取得試行
      const cachedResult = await this.cacheService.get<TResult>(cacheKey);
      if (cachedResult !== null) {
        this.logger.debug('Query result served from cache', {
          queryId: query.queryId,
          queryType: query.getQueryType(),
          cacheKey
        });
        return cachedResult;
      }

      // キャッシュミス - クエリ実行
      const result = await next();

      // 結果をキャッシュに保存
      const ttl = this.getCacheTtl(query);
      await this.cacheService.set(cacheKey, result, ttl);

      this.logger.debug('Query result cached', {
        queryId: query.queryId,
        queryType: query.getQueryType(),
        cacheKey,
        ttl
      });

      return result;

    } catch (error) {
      this.logger.error('Cache middleware error', {
        queryId: query.queryId,
        queryType: query.getQueryType(),
        error: error.message
      });
      
      // キャッシュエラーでもクエリは実行
      return await next();
    }
  }

  private generateCacheKey(query: Query): string {
    const queryData = {
      type: query.getQueryType(),
      ...query
    };
    
    // ユーザー固有データを除外
    delete queryData.queryId;
    delete queryData.timestamp;
    
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(queryData))
      .digest('hex');
    
    return `query:${query.getQueryType()}:${hash}`;
  }

  private isCacheable(query: Query): boolean {
    // 特定のクエリタイプのみキャッシュ対象
    const cacheableQueries = [
      'GetProductById',
      'SearchProducts',
      'GetProductAnalytics'
    ];
    
    return cacheableQueries.includes(query.getQueryType());
  }

  private getCacheTtl(query: Query): number {
    const ttlMap: Record<string, number> = {
      'GetProductById': 900,      // 15分
      'SearchProducts': 300,      // 5分
      'GetProductAnalytics': 3600 // 1時間
    };
    
    return ttlMap[query.getQueryType()] || 300; // デフォルト5分
  }
}
```

### 6. Read Model Projection とイベントハンドリング

```typescript
// infrastructure/projections/product-projection-handler.ts
export class ProductProjectionHandler implements EventHandler {
  constructor(
    private readModelDb: Pool,
    private logger: Logger
  ) {}

  getHandlerName(): string {
    return 'ProductProjectionHandler';
  }

  canHandle(eventType: string): boolean {
    return [
      'ProductCreated',
      'ProductPriceUpdated',
      'ProductDeactivated',
      'ProductActivated'
    ].includes(eventType);
  }

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.getEventType()) {
        case 'ProductCreated':
          await this.handleProductCreated(event as ProductCreatedEvent);
          break;
        case 'ProductPriceUpdated':
          await this.handleProductPriceUpdated(event as ProductPriceUpdatedEvent);
          break;
        case 'ProductDeactivated':
          await this.handleProductDeactivated(event as ProductDeactivatedEvent);
          break;
        case 'ProductActivated':
          await this.handleProductActivated(event as ProductActivatedEvent);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle event in product projection', {
        eventId: event.eventId,
        eventType: event.getEventType(),
        aggregateId: event.aggregateId,
        error: error.message
      });
      throw error;
    }
  }

  private async handleProductCreated(event: ProductCreatedEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      // 製品レコード作成
      await client.query(`
        INSERT INTO product_read_model (
          id, name, description, price, category_id, sku, 
          is_active, created_by, created_at, last_price_update,
          total_sales, average_rating, review_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `, [
        event.aggregateId,
        event.name,
        event.description,
        event.price,
        event.categoryId,
        event.sku,
        true,
        event.createdBy,
        event.occurredOn,
        event.occurredOn,
        0, // total_sales
        0, // average_rating
        0  // review_count
      ]);

      // 価格履歴レコード作成
      await client.query(`
        INSERT INTO price_history (
          product_id, price, changed_at, changed_by, reason
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        event.aggregateId,
        event.price,
        event.occurredOn,
        event.createdBy,
        'Initial price'
      ]);

      // イベント追跡
      await this.recordProductEvent(client, event, 'ProductCreated');

      await client.query('COMMIT');

      this.logger.info('Product created in read model', {
        productId: event.aggregateId,
        name: event.name,
        sku: event.sku
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async handleProductPriceUpdated(event: ProductPriceUpdatedEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      // 製品価格更新
      await client.query(`
        UPDATE product_read_model 
        SET price = $1, last_price_update = $2
        WHERE id = $3
      `, [event.newPrice, event.occurredOn, event.aggregateId]);

      // 価格履歴追加
      await client.query(`
        INSERT INTO price_history (
          product_id, price, changed_at, changed_by, reason
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        event.aggregateId,
        event.newPrice,
        event.occurredOn,
        event.changedBy,
        event.reason
      ]);

      // イベント追跡
      await this.recordProductEvent(client, event, 'ProductPriceUpdated');

      await client.query('COMMIT');

      this.logger.info('Product price updated in read model', {
        productId: event.aggregateId,
        previousPrice: event.previousPrice,
        newPrice: event.newPrice,
        reason: event.reason
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async handleProductDeactivated(event: ProductDeactivatedEvent): Promise<void> {
    const client = await this.readModelDb.connect();
    
    try {
      await client.query('BEGIN');

      // 製品を非アクティブ化
      await client.query(`
        UPDATE product_read_model 
        SET is_active = false, deactivated_at = $1, deactivated_by = $2
        WHERE id = $3
      `, [event.occurredOn, event.deactivatedBy, event.aggregateId]);

      // イベント追跡
      await this.recordProductEvent(client, event, 'ProductDeactivated');

      await client.query('COMMIT');

      this.logger.info('Product deactivated in read model', {
        productId: event.aggregateId,
        reason: event.reason
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordProductEvent(
    client: any, 
    event: DomainEvent, 
    eventType: string
  ): Promise<void> {
    await client.query(`
      INSERT INTO product_events (
        event_id, product_id, event_type, occurred_at, event_data
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      event.eventId,
      event.aggregateId,
      eventType,
      event.occurredOn,
      JSON.stringify(event.getEventData())
    ]);
  }
}

// infrastructure/projections/denormalized-projection-handler.ts
export class DenormalizedProductProjectionHandler implements EventHandler {
  constructor(
    private readModelDb: Pool,
    private searchIndex: SearchIndexService,
    private logger: Logger
  ) {}

  getHandlerName(): string {
    return 'DenormalizedProductProjectionHandler';
  }

  canHandle(eventType: string): boolean {
    return [
      'ProductCreated',
      'ProductPriceUpdated',
      'ProductDeactivated',
      'CategoryNameChanged'
    ].includes(eventType);
  }

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.getEventType()) {
        case 'ProductCreated':
          await this.handleProductCreated(event as ProductCreatedEvent);
          break;
        case 'ProductPriceUpdated':
          await this.handleProductPriceUpdated(event as ProductPriceUpdatedEvent);
          break;
        case 'CategoryNameChanged':
          await this.handleCategoryNameChanged(event as CategoryNameChangedEvent);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle event in denormalized projection', {
        eventId: event.eventId,
        eventType: event.getEventType(),
        error: error.message
      });
      throw error;
    }
  }

  private async handleProductCreated(event: ProductCreatedEvent): Promise<void> {
    // カテゴリー情報を取得して非正規化
    const categoryInfo = await this.getCategoryInfo(event.categoryId);
    
    const denormalizedProduct = {
      id: event.aggregateId,
      name: event.name,
      description: event.description,
      price: event.price,
      sku: event.sku,
      categoryId: event.categoryId,
      categoryName: categoryInfo.name,
      categoryPath: categoryInfo.path,
      isActive: true,
      createdAt: event.occurredOn,
      searchText: this.buildSearchText(event.name, event.description, event.sku, categoryInfo.name)
    };

    // 検索インデックスに追加
    await this.searchIndex.indexProduct(denormalizedProduct);

    this.logger.info('Product indexed for search', {
      productId: event.aggregateId,
      name: event.name
    });
  }

  private async handleCategoryNameChanged(event: CategoryNameChangedEvent): Promise<void> {
    // このカテゴリーに属するすべての製品の非正規化データを更新
    const products = await this.readModelDb.query(
      'SELECT id FROM product_read_model WHERE category_id = $1',
      [event.aggregateId]
    );

    for (const product of products.rows) {
      await this.updateProductCategoryInfo(product.id, event.aggregateId, event.newName);
    }

    this.logger.info('Updated category information for products', {
      categoryId: event.aggregateId,
      newName: event.newName,
      affectedProducts: products.rows.length
    });
  }

  private async getCategoryInfo(categoryId: string): Promise<{name: string, path: string}> {
    const result = await this.readModelDb.query(`
      WITH RECURSIVE category_path AS (
        SELECT id, name, parent_id, name as path, 0 as level
        FROM categories
        WHERE id = $1
        
        UNION ALL
        
        SELECT c.id, c.name, c.parent_id, c.name || ' > ' || cp.path, cp.level + 1
        FROM categories c
        INNER JOIN category_path cp ON c.id = cp.parent_id
      )
      SELECT name, path FROM category_path ORDER BY level DESC LIMIT 1
    `, [categoryId]);

    return result.rows[0] || { name: 'Unknown', path: 'Unknown' };
  }

  private buildSearchText(...fields: string[]): string {
    return fields.filter(f => f).join(' ').toLowerCase();
  }

  private async updateProductCategoryInfo(
    productId: string, 
    categoryId: string, 
    categoryName: string
  ): Promise<void> {
    // 検索インデックス更新
    await this.searchIndex.updateProductCategory(productId, categoryId, categoryName);
  }
}
```

このCQRSパターン集は以下の要素を包含しています：

1. **基本構造**: Command・Queryインターフェースとベースクラス
2. **Command Side**: アグリゲート、ドメインイベント、コマンドハンドラー
3. **Query Side**: Read Model、クエリハンドラー、複雑な検索・分析機能
4. **Command・Query Bus**: ミドルウェアサポート付きの実行基盤
5. **ミドルウェア**: ログ、認証・認可、パフォーマンス、キャッシュ機能
6. **Projection**: Read Model更新と非正規化処理

これらのパターンにより、スケーラブルで保守性の高いCQRSアーキテクチャを構築できます。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Phase 3: Python Advanced Libraries - FastAPI production patterns document", "status": "completed", "id": "18"}, {"content": "Phase 3: SQLAlchemy 2.0 advanced ORM patterns document", "status": "completed", "id": "19"}, {"content": "Phase 3: Pydantic v2 data validation patterns document", "status": "completed", "id": "20"}, {"content": "Phase 3: Async Python concurrency patterns document", "status": "completed", "id": "21"}, {"content": "Phase 3: Pytest advanced testing patterns document", "status": "completed", "id": "22"}, {"content": "Phase 3: Celery distributed task patterns document", "status": "completed", "id": "23"}, {"content": "Phase 3: NumPy/Pandas data science patterns document", "status": "completed", "id": "24"}, {"content": "Phase 3: Django REST framework enterprise patterns document", "status": "completed", "id": "25"}, {"content": "Phase 4 - Architecture Pattern 1: Microservices Architecture", "status": "completed", "id": "26"}, {"content": "Phase 4 - Architecture Pattern 2: Event-Driven Architecture", "status": "completed", "id": "27"}, {"content": "Phase 4 - Architecture Pattern 3: CQRS (Command Query Responsibility Segregation)", "status": "completed", "id": "28"}, {"content": "Phase 4 - Architecture Pattern 4: Domain-Driven Design (DDD)", "status": "in_progress", "id": "29"}, {"content": "Phase 4 - Architecture Pattern 5: Clean Architecture", "status": "pending", "id": "30"}, {"content": "Phase 4 - Architecture Pattern 6: Hexagonal Architecture", "status": "pending", "id": "31"}, {"content": "Phase 4 - Architecture Pattern 7: Event Sourcing", "status": "pending", "id": "32"}, {"content": "Phase 4 - Architecture Pattern 8: API Gateway Patterns", "status": "pending", "id": "33"}, {"content": "Phase 5: Development Methodologies (3 documents)", "status": "pending", "id": "34"}]