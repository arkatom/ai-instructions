# リポジトリパターン

## リポジトリインターフェース定義

### 基底リポジトリインターフェース

```typescript
// shared/domain/repository.ts
export interface Repository<T, TId> {
  getById(id: TId): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}

export interface ReadRepository<T, TId> {
  getById(id: TId): Promise<T | null>;
  exists(id: TId): Promise<boolean>;
}

export interface WriteRepository<T, TId> {
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}
```

### プロダクトリポジトリ

```typescript
// catalog/domain/repositories/product-repository.ts
export interface ProductRepository extends Repository<Product, ProductId> {
  getBySku(sku: SKU): Promise<Product | null>;
  getByCategory(categoryId: CategoryId): Promise<Product[]>;
  search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
  getDiscontinuedProducts(beforeDate: Date): Promise<Product[]>;
}

export interface ProductSearchCriteria {
  keyword?: string;
  categoryId?: CategoryId;
  brandId?: BrandId;
  minPrice?: Money;
  maxPrice?: Money;
  status?: ProductStatus;
  tags?: string[];
  page: number;
  pageSize: number;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductSearchResult {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

## リポジトリ実装

### PostgreSQLリポジトリ実装

```typescript
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
        const [specifications, variants] = await Promise.all([
          this.getProductSpecifications(client, id),
          this.getProductVariants(client, id)
        ]);

        return this.mapToDomainObject(productData, {
          specifications,
          variants
        });

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

  async save(product: Product): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const existing = await this.getById(product.id);
      
      if (existing) {
        await this.updateProduct(client, product, existing.version);
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

  private async updateProduct(
    client: any,
    product: Product,
    expectedVersion: number
  ): Promise<void> {
    // 楽観的ロック
    const result = await client.query(`
      UPDATE products 
      SET name = $2, description = $3, price = $4, currency = $5,
          category_id = $6, brand_id = $7, status = $8, 
          updated_at = $9, version = $10
      WHERE id = $1 AND version = $11 AND deleted_at IS NULL
      RETURNING id
    `, [
      product.id.value,
      product.name.value,
      product.description.value,
      product.price?.amount,
      product.price?.currency.code,
      product.category.value,
      product.brand.value,
      product.status,
      new Date(),
      product.version,
      expectedVersion
    ]);

    if (result.rowCount === 0) {
      throw new ConcurrencyError('Product was modified by another process');
    }

    // 関連データ更新
    await this.updateRelatedData(client, product);
  }

  private mapToDomainObject(
    data: any,
    related: { specifications: any[], variants: any[] }
  ): Product {
    // データベースからドメインオブジェクトへのマッピング
    const product = Product.reconstruct({
      id: ProductId.create(data.id),
      name: ProductName.create(data.name),
      description: ProductDescription.create(data.description),
      price: data.price ? Price.create(data.price, Currency.create(data.currency)) : null,
      category: CategoryId.create(data.category_id),
      brand: BrandId.create(data.brand_id),
      sku: SKU.create(data.sku),
      status: data.status as ProductStatus,
      specifications: related.specifications.map(s => this.mapSpecification(s)),
      variants: related.variants.map(v => this.mapVariant(v)),
      version: data.version,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });

    return product;
  }
}
```

### キャッシュ付きリポジトリ

```typescript
// catalog/infrastructure/repositories/cached-product-repository.ts
export class CachedProductRepository implements ProductRepository {
  constructor(
    private baseRepository: ProductRepository,
    private cache: RedisClient,
    private ttl: number = 3600 // 1時間
  ) {}

  async getById(id: ProductId): Promise<Product | null> {
    const cacheKey = `product:${id.value}`;
    
    // キャッシュチェック
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return this.deserialize(cached);
    }

    // データベースから取得
    const product = await this.baseRepository.getById(id);
    
    if (product) {
      // キャッシュに保存
      await this.cache.setex(cacheKey, this.ttl, this.serialize(product));
    }

    return product;
  }

  async save(product: Product): Promise<void> {
    // データベースに保存
    await this.baseRepository.save(product);
    
    // キャッシュ無効化
    const cacheKey = `product:${product.id.value}`;
    await this.cache.del(cacheKey);
    
    // 関連キャッシュも無効化
    await this.invalidateRelatedCaches(product);
  }

  private async invalidateRelatedCaches(product: Product): Promise<void> {
    const keysToInvalidate = [
      `category:${product.category.value}:products`,
      `brand:${product.brand.value}:products`,
      `sku:${product.sku.value}`
    ];
    
    await Promise.all(
      keysToInvalidate.map(key => this.cache.del(key))
    );
  }
}