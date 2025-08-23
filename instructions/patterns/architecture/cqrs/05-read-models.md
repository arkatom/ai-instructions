# Read Models

## Read Model Design Patterns

```typescript
// Denormalized read model
interface DenormalizedOrderView {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  shippingAddress: Address;
  billingAddress: Address;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Document-based read model
class DocumentReadModel {
  constructor(private documentStore: DocumentStore) {}

  async save(id: string, document: any): Promise<void> {
    await this.documentStore.upsert(id, {
      ...document,
      _metadata: {
        version: document.version || 1,
        updatedAt: new Date(),
        projectionName: this.constructor.name
      }
    });
  }

  async findById(id: string): Promise<any> {
    return this.documentStore.findById(id);
  }

  async findByQuery(query: any): Promise<any[]> {
    return this.documentStore.query(query);
  }
}
```

## Projection Builders

```typescript
class ReadModelProjector {
  private builders: Map<string, ReadModelBuilder> = new Map();

  register(eventType: string, builder: ReadModelBuilder): void {
    this.builders.set(eventType, builder);
  }

  async project(event: DomainEvent): Promise<void> {
    const builder = this.builders.get(event.type);
    
    if (!builder) {
      console.log(`No builder registered for ${event.type}`);
      return;
    }

    await builder.build(event);
  }
}

// Specialized builders
class OrderViewBuilder implements ReadModelBuilder {
  constructor(
    private readDb: Database,
    private cache: Cache
  ) {}

  async build(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'OrderCreated':
        await this.createOrderView(event as OrderCreatedEvent);
        break;
      case 'OrderItemAdded':
        await this.addItemToView(event as OrderItemAddedEvent);
        break;
      case 'OrderStatusChanged':
        await this.updateStatus(event as OrderStatusChangedEvent);
        break;
    }

    // Invalidate cache
    await this.cache.invalidate(`order:${event.aggregateId}`);
  }

  private async createOrderView(event: OrderCreatedEvent): Promise<void> {
    const customer = await this.getCustomerDetails(event.customerId);
    
    await this.readDb.query(
      `INSERT INTO order_views (
        order_id, order_number, customer_id, customer_name,
        customer_email, status, created_at, total_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.orderId, event.orderNumber, customer.id,
        customer.name, customer.email, 'PENDING',
        event.timestamp, 0
      ]
    );
  }

  private async addItemToView(event: OrderItemAddedEvent): Promise<void> {
    const product = await this.getProductDetails(event.productId);
    
    await this.readDb.query(
      `INSERT INTO order_item_views (
        order_id, product_id, product_name, quantity,
        unit_price, total
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.orderId, product.id, product.name,
        event.quantity, event.unitPrice,
        event.quantity * event.unitPrice
      ]
    );

    // Update order total
    await this.readDb.query(
      `UPDATE order_views 
       SET total_amount = total_amount + $1
       WHERE order_id = $2`,
      [event.quantity * event.unitPrice, event.orderId]
    );
  }
}
```

## Multiple Read Models

```typescript
class MultipleReadModelManager {
  private models: ReadModel[] = [];

  register(...models: ReadModel[]): void {
    this.models.push(...models);
  }

  async projectEvent(event: DomainEvent): Promise<void> {
    // Project to all read models in parallel
    await Promise.all(
      this.models.map(model => 
        this.safeProject(model, event)
      )
    );
  }

  private async safeProject(model: ReadModel, event: DomainEvent): Promise<void> {
    try {
      await model.project(event);
    } catch (error) {
      console.error(`Projection failed for ${model.name}:`, error);
      // Continue with other projections
    }
  }
}

// Different read models for different purposes
class SearchIndexProjection implements ReadModel {
  name = 'SearchIndex';
  
  constructor(private searchEngine: SearchEngine) {}

  async project(event: DomainEvent): Promise<void> {
    if (event.type === 'ProductCreated') {
      await this.searchEngine.index({
        id: event.aggregateId,
        type: 'product',
        name: event.payload.name,
        description: event.payload.description,
        price: event.payload.price,
        tags: event.payload.tags
      });
    }
  }
}

class ReportingProjection implements ReadModel {
  name = 'Reporting';
  
  constructor(private reportDb: Database) {}

  async project(event: DomainEvent): Promise<void> {
    if (event.type === 'OrderCompleted') {
      await this.updateSalesMetrics(event as OrderCompletedEvent);
    }
  }

  private async updateSalesMetrics(event: OrderCompletedEvent): Promise<void> {
    await this.reportDb.query(
      `INSERT INTO sales_metrics (date, revenue, order_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (date) DO UPDATE
       SET revenue = sales_metrics.revenue + $2,
           order_count = sales_metrics.order_count + 1`,
      [event.timestamp.toDateString(), event.totalAmount]
    );
  }
}
```

## Read Model Optimization

```typescript
class OptimizedReadModelStore {
  constructor(
    private primaryDb: Database,
    private cache: Redis,
    private cdn: CDN
  ) {}

  async get(key: string): Promise<any> {
    // Try CDN first for static content
    if (this.isStaticContent(key)) {
      const cdnResult = await this.cdn.get(key);
      if (cdnResult) return cdnResult;
    }

    // Try cache
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached);

    // Load from database
    const result = await this.primaryDb.query(
      'SELECT * FROM read_models WHERE key = $1',
      [key]
    );

    if (result.rows.length > 0) {
      // Cache for future requests
      await this.cache.setex(key, 300, JSON.stringify(result.rows[0]));
      return result.rows[0];
    }

    return null;
  }

  private isStaticContent(key: string): boolean {
    return key.startsWith('catalog:') || key.startsWith('static:');
  }
}

// Materialized view management
class MaterializedViewManager {
  async refresh(viewName: string): Promise<void> {
    await this.db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
  }

  async scheduleRefresh(viewName: string, intervalMs: number): void {
    setInterval(() => this.refresh(viewName), intervalMs);
  }
}
```

## Read Model Rebuild

```typescript
class ReadModelRebuilder {
  constructor(
    private eventStore: EventStore,
    private projectionEngine: ProjectionEngine
  ) {}

  async rebuild(projectionName: string): Promise<void> {
    console.log(`Starting rebuild of ${projectionName}`);
    
    // Clear existing read model
    await this.clearReadModel(projectionName);
    
    // Reset checkpoint
    await this.resetCheckpoint(projectionName);
    
    // Replay all events
    const events = await this.eventStore.getAllEvents();
    
    for (const event of events) {
      await this.projectionEngine.projectSingle(projectionName, event);
    }
    
    console.log(`Rebuild of ${projectionName} completed`);
  }

  private async clearReadModel(projectionName: string): Promise<void> {
    // Implementation depends on storage type
    await this.readDb.query(`TRUNCATE TABLE ${projectionName}_view`);
  }

  private async resetCheckpoint(projectionName: string): Promise<void> {
    await this.checkpointStore.reset(projectionName);
  }
}
```

## Best Practices

1. **Denormalization**: Optimize read models for specific query patterns
2. **Multiple Models**: Create different read models for different use cases
3. **Caching**: Implement multi-level caching for performance
4. **Rebuild Strategy**: Design read models to be rebuildable from events
5. **Monitoring**: Track projection lag and performance metrics
6. **Testing**: Test projections with event replay scenarios