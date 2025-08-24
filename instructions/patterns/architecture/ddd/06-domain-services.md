# ドメインサービス

## ドメインサービスパターン

### 価格計算サービス

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

  async calculatePrice(
    product: Product,
    customer: Customer,
    quantity: number
  ): Promise<Price> {
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
}
```

### 注文検証サービス

```typescript
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
}
```

### 在庫割当サービス

```typescript
// inventory/domain/services/inventory-allocation-service.ts
export class InventoryAllocationService {
  constructor(
    private inventoryRepository: InventoryRepository,
    private reservationRepository: ReservationRepository,
    private logger: Logger
  ) {}

  async allocateInventory(
    orderId: OrderId,
    items: OrderItem[]
  ): Promise<AllocationResult> {
    const allocations: InventoryAllocation[] = [];
    const failures: AllocationFailure[] = [];

    for (const item of items) {
      try {
        const allocation = await this.allocateItem(orderId, item);
        allocations.push(allocation);
      } catch (error) {
        failures.push({
          productId: item.productId,
          quantity: item.quantity,
          reason: error.message
        });
      }
    }

    if (failures.length > 0) {
      // 部分的な失敗時はロールバック
      await this.rollbackAllocations(allocations);
      return {
        success: false,
        allocations: [],
        failures
      };
    }

    return {
      success: true,
      allocations,
      failures: []
    };
  }

  private async allocateItem(
    orderId: OrderId,
    item: OrderItem
  ): Promise<InventoryAllocation> {
    const inventory = await this.inventoryRepository.getByProductId(item.productId);
    
    if (!inventory) {
      throw new DomainError(`No inventory found for product ${item.productId.value}`);
    }

    const availableQuantity = inventory.getAvailableQuantity();
    
    if (availableQuantity < item.quantity.value) {
      throw new DomainError(
        `Insufficient inventory. Available: ${availableQuantity}, Requested: ${item.quantity.value}`
      );
    }

    // 在庫予約作成
    const reservation = Reservation.create(
      orderId,
      item.productId,
      item.quantity,
      new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間後に期限
    );

    await this.reservationRepository.save(reservation);

    // 在庫更新
    inventory.reserve(item.quantity);
    await this.inventoryRepository.save(inventory);

    return {
      reservationId: reservation.id,
      productId: item.productId,
      quantity: item.quantity,
      warehouseId: inventory.warehouseId
    };
  }
}