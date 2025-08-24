# 境界づけられたコンテキスト

## Bounded Context実装パターン

### コンテキスト境界の定義

```typescript
// contexts/shared/domain/context-boundary.ts
export interface ContextBoundary {
  name: string;
  team: string;
  repository: string;
  deploymentUnit: string;
  dataStore: string;
  api: {
    internal: string[];
    external: string[];
  };
}

// ECサイトのコンテキスト境界例
export const catalogContext: ContextBoundary = {
  name: 'Catalog',
  team: 'Product Team',
  repository: 'catalog-service',
  deploymentUnit: 'catalog-api',
  dataStore: 'catalog-db',
  api: {
    internal: ['/products', '/categories', '/brands'],
    external: ['/api/v1/products']
  }
};
```

### Context Mapping実装

```typescript
// contexts/shared/integration/context-mapper.ts
export class ContextMapper {
  private mappings = new Map<string, IntegrationMapping>();

  registerMapping(mapping: IntegrationMapping): void {
    const key = `${mapping.upstream}:${mapping.downstream}`;
    this.mappings.set(key, mapping);
  }

  getMapping(upstream: string, downstream: string): IntegrationMapping | undefined {
    return this.mappings.get(`${upstream}:${downstream}`);
  }

  getAllMappings(): IntegrationMapping[] {
    return Array.from(this.mappings.values());
  }
}

export interface IntegrationMapping {
  upstream: string;
  downstream: string;
  pattern: IntegrationPattern;
  translator?: DataTranslator;
  eventMappings?: EventMapping[];
}

export enum IntegrationPattern {
  ANTICORRUPTION_LAYER = 'ACL',
  OPEN_HOST_SERVICE = 'OHS',
  PUBLISHED_LANGUAGE = 'PL',
  CUSTOMER_SUPPLIER = 'CS',
  CONFORMIST = 'CF',
  SHARED_KERNEL = 'SK'
}
```

### Anti-Corruption Layer (ACL)

```typescript
// contexts/order/infrastructure/acl/catalog-acl.ts
export class CatalogAntiCorruptionLayer {
  constructor(
    private readonly catalogApiClient: CatalogApiClient,
    private readonly translator: CatalogTranslator
  ) {}

  async getProduct(productId: string): Promise<OrderProduct> {
    // 外部コンテキストのデータを取得
    const externalProduct = await this.catalogApiClient.getProduct(productId);
    
    // 自コンテキストのモデルに変換
    return this.translator.toOrderProduct(externalProduct);
  }

  async checkProductAvailability(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const response = await this.catalogApiClient.checkStock(productId);
    
    // 外部の在庫表現を自コンテキストの可用性に変換
    return this.translator.isAvailable(response, quantity);
  }
}

// contexts/order/infrastructure/acl/catalog-translator.ts
export class CatalogTranslator {
  toOrderProduct(external: ExternalProduct): OrderProduct {
    return new OrderProduct(
      ProductId.create(external.id),
      ProductName.create(external.title), // titleをnameに変換
      Money.create(external.price.value, Currency.create(external.price.currency))
    );
  }

  isAvailable(stockResponse: StockResponse, requestedQuantity: number): boolean {
    // 外部の複雑な在庫ロジックを単純な可用性判定に変換
    const availableStock = stockResponse.onHand - stockResponse.reserved;
    return availableStock >= requestedQuantity;
  }
}
```

### Open Host Service (OHS)

```typescript
// contexts/catalog/infrastructure/ohs/product-api.ts
export class ProductOpenHostService {
  private readonly apiVersion = 'v1';
  
  async getProducts(request: ProductQueryRequest): Promise<ProductResponse[]> {
    // 公開APIとして標準化されたインターフェースを提供
    const products = await this.productRepository.findAll(
      this.translateQuery(request)
    );
    
    return products.map(p => this.toPublicFormat(p));
  }

  private toPublicFormat(product: Product): ProductResponse {
    return {
      id: product.id.value,
      name: product.name.value,
      description: product.description.value,
      price: {
        amount: product.price.amount,
        currency: product.price.currency.code
      },
      availability: this.calculateAvailability(product),
      _links: {
        self: `/api/${this.apiVersion}/products/${product.id.value}`,
        category: `/api/${this.apiVersion}/categories/${product.category.value}`
      }
    };
  }
}
```

### Shared Kernel

```typescript
// contexts/shared-kernel/domain/money.ts
// 複数のコンテキストで共有される基本的な値オブジェクト
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!this.currency || this.currency.length !== 3) {
      throw new Error('Invalid currency code');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```