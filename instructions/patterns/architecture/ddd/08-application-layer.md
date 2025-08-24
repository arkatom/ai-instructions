# アプリケーション層

## アプリケーションサービス

### UseCase実装パターン

```typescript
// shared/application/use-case.ts
export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export abstract class BaseUseCase<TRequest, TResponse> 
  implements UseCase<TRequest, TResponse> {
  
  constructor(protected logger: Logger) {}

  async execute(request: TRequest): Promise<TResponse> {
    this.logger.info(`Executing ${this.constructor.name}`, { request });
    
    try {
      this.validateRequest(request);
      const response = await this.doExecute(request);
      
      this.logger.info(`${this.constructor.name} completed successfully`, {
        request,
        response
      });
      
      return response;
    } catch (error) {
      this.logger.error(`${this.constructor.name} failed`, {
        request,
        error: error.message
      });
      throw error;
    }
  }

  protected abstract validateRequest(request: TRequest): void;
  protected abstract doExecute(request: TRequest): Promise<TResponse>;
}
```

### プロダクト作成UseCase

```typescript
// catalog/application/use-cases/create-product.ts
export class CreateProductUseCase extends BaseUseCase<
  CreateProductRequest,
  CreateProductResponse
> {
  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository,
    private brandRepository: BrandRepository,
    private eventBus: EventBus,
    logger: Logger
  ) {
    super(logger);
  }

  protected validateRequest(request: CreateProductRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationError('Product name is required');
    }
    
    if (!request.categoryId) {
      throw new ValidationError('Category is required');
    }
    
    if (!request.brandId) {
      throw new ValidationError('Brand is required');
    }
    
    if (!request.sku) {
      throw new ValidationError('SKU is required');
    }
  }

  protected async doExecute(
    request: CreateProductRequest
  ): Promise<CreateProductResponse> {
    // カテゴリとブランドの存在確認
    const [category, brand] = await Promise.all([
      this.categoryRepository.getById(CategoryId.create(request.categoryId)),
      this.brandRepository.getById(BrandId.create(request.brandId))
    ]);

    if (!category) {
      throw new NotFoundError(`Category ${request.categoryId} not found`);
    }

    if (!brand) {
      throw new NotFoundError(`Brand ${request.brandId} not found`);
    }

    // SKUの重複チェック
    const existingProduct = await this.productRepository.getBySku(
      SKU.create(request.sku)
    );

    if (existingProduct) {
      throw new DuplicateError(`Product with SKU ${request.sku} already exists`);
    }

    // プロダクト作成
    const product = Product.create(
      request.name,
      request.description,
      request.categoryId,
      request.brandId,
      request.sku
    );

    // 初期価格設定
    if (request.price) {
      const price = Price.create(
        request.price.amount,
        Currency.create(request.price.currency)
      );
      product.changePrice(price, 'Initial price', request.createdBy);
    }

    // 保存とイベント発行
    await this.productRepository.save(product);

    return {
      productId: product.id.value,
      sku: product.sku.value,
      name: product.name.value,
      status: product.status
    };
  }
}
```

### 注文処理UseCase

```typescript
// order/application/use-cases/place-order.ts
export class PlaceOrderUseCase extends BaseUseCase<
  PlaceOrderRequest,
  PlaceOrderResponse
> {
  constructor(
    private orderRepository: OrderRepository,
    private productRepository: ProductRepository,
    private customerRepository: CustomerRepository,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private orderValidationService: OrderValidationService,
    private paymentService: PaymentService,
    private eventBus: EventBus,
    logger: Logger
  ) {
    super(logger);
  }

  protected validateRequest(request: PlaceOrderRequest): void {
    if (!request.customerId) {
      throw new ValidationError('Customer ID is required');
    }

    if (!request.orderLines || request.orderLines.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    if (!request.shippingAddress) {
      throw new ValidationError('Shipping address is required');
    }
  }

  protected async doExecute(
    request: PlaceOrderRequest
  ): Promise<PlaceOrderResponse> {
    // 顧客取得
    const customer = await this.customerRepository.getById(
      CustomerId.create(request.customerId)
    );

    if (!customer) {
      throw new NotFoundError(`Customer ${request.customerId} not found`);
    }

    // 注文明細の準備
    const orderLines = await Promise.all(
      request.orderLines.map(async (line) => {
        const product = await this.productRepository.getById(
          ProductId.create(line.productId)
        );

        if (!product) {
          throw new NotFoundError(`Product ${line.productId} not found`);
        }

        // 価格計算
        const price = await this.pricingService.calculatePrice(
          product,
          customer,
          line.quantity
        );

        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: price.amount
        };
      })
    );

    // 注文作成
    const order = Order.place(
      request.customerId,
      orderLines,
      Address.create(request.shippingAddress),
      Address.create(request.billingAddress || request.shippingAddress),
      request.currency
    );

    // 注文検証
    const validationResult = await this.orderValidationService.validateOrder(order);
    if (!validationResult.isValid) {
      throw new ValidationError(
        `Order validation failed: ${validationResult.errors.join(', ')}`
      );
    }

    // 在庫割当
    const allocationResult = await this.inventoryService.allocateInventory(
      order.id,
      order.orderLines
    );

    if (!allocationResult.success) {
      throw new BusinessError('Inventory allocation failed');
    }

    // 支払い処理
    const paymentResult = await this.paymentService.processPayment(
      order.customerId,
      order.totalAmount,
      request.paymentMethod
    );

    if (paymentResult.success) {
      order.confirmPayment(paymentResult.paymentInfo);
    } else {
      // 在庫割当のロールバック
      await this.inventoryService.releaseInventory(allocationResult.allocations);
      throw new PaymentError('Payment processing failed');
    }

    // 注文保存
    await this.orderRepository.save(order);

    return {
      orderId: order.id.value,
      orderNumber: order.orderNumber.value,
      status: order.status,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency.code
    };
  }
}