# Application Services Implementation

> 🎯 **目的**: ユースケース調整とワークフロー実装
> 
> 📊 **対象**: ユースケース実装、トランザクション管理、イベント処理
> 
> ⚡ **特徴**: オーケストレーション、依存性注入、エラーハンドリング

## ユースケース実装パターン

### 基本的なアプリケーションサービス構造

```typescript
// アプリケーションサービス基底クラス
import { injectable } from 'inversify';
import { EventBus } from '../ports/secondary/EventBus';
import { TransactionManager } from '../ports/secondary/TransactionManager';
import { Logger } from '../ports/secondary/Logger';

@injectable()
export abstract class BaseApplicationService {
  constructor(
    protected readonly eventBus: EventBus,
    protected readonly transactionManager: TransactionManager,
    protected readonly logger: Logger
  ) {}

  // トランザクション管理付きの実行
  protected async executeInTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const transaction = await this.transactionManager.begin();
    
    try {
      const result = await operation();
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Transaction rolled back', { error });
      throw error;
    }
  }

  // ドメインイベント処理
  protected async publishDomainEvents(aggregate: any): Promise<void> {
    const events = aggregate.getDomainEvents?.() || [];
    
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    
    // イベント発行後にクリア
    aggregate.clearDomainEvents?.();
  }

  // エラーハンドリングとロギング
  protected handleError(error: Error, context: string): never {
    this.logger.error(`Error in ${context}`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### 注文管理のアプリケーションサービス

```typescript
// 完全なユースケース実装
import { injectable, inject } from 'inversify';
import { 
  OrderUseCases, 
  CreateOrderCommand, 
  OrderDTO 
} from '../ports/primary/OrderUseCases';
import { OrderRepository } from '../ports/secondary/OrderRepository';
import { ProductCatalog } from '../ports/secondary/ProductCatalog';
import { NotificationService } from '../ports/secondary/NotificationService';
import { PaymentGateway } from '../ports/secondary/PaymentGateway';
import { CustomerService } from '../ports/secondary/CustomerService';
import { Order, OrderId, OrderItem, Money } from '../../domain/models/Order';
import { PricingService } from '../../domain/services/PricingService';

@injectable()
export class OrderService extends BaseApplicationService implements OrderUseCases {
  constructor(
    @inject('OrderRepository') 
    private readonly orderRepository: OrderRepository,
    @inject('ProductCatalog') 
    private readonly productCatalog: ProductCatalog,
    @inject('NotificationService') 
    private readonly notificationService: NotificationService,
    @inject('PaymentGateway') 
    private readonly paymentGateway: PaymentGateway,
    @inject('CustomerService') 
    private readonly customerService: CustomerService,
    @inject('PricingService') 
    private readonly pricingService: PricingService,
    @inject('EventBus') eventBus: EventBus,
    @inject('TransactionManager') transactionManager: TransactionManager,
    @inject('Logger') logger: Logger
  ) {
    super(eventBus, transactionManager, logger);
  }

  async createOrder(command: CreateOrderCommand): Promise<OrderDTO> {
    this.logger.info('Creating order', { customerId: command.customerId });

    return this.executeInTransaction(async () => {
      // 1. 顧客の存在確認
      const customer = await this.customerService.getCustomer(command.customerId);
      if (!customer) {
        throw new Error(`Customer ${command.customerId} not found`);
      }

      // 2. 商品の検証と可用性チェック
      const validatedItems = await this.validateAndReserveProducts(command.items);

      try {
        // 3. 注文の作成
        const orderId = await this.orderRepository.nextId();
        const order = new Order(orderId, command.customerId);

        // 4. 注文アイテムの追加
        for (const item of validatedItems) {
          order.addItem(item.orderItem);
        }

        // 5. 注文の保存
        await this.orderRepository.save(order);

        // 6. ドメインイベントの発行
        await this.publishDomainEvents(order);

        // 7. 通知の送信
        await this.sendOrderCreatedNotification(order, customer);

        this.logger.info('Order created successfully', { 
          orderId: orderId.toString() 
        });

        return this.toDTO(order);

      } catch (error) {
        // 予約のキャンセル
        await this.cancelProductReservations(validatedItems);
        throw error;
      }
    });
  }

  async confirmOrder(orderId: string): Promise<OrderDTO> {
    this.logger.info('Confirming order', { orderId });

    return this.executeInTransaction(async () => {
      const order = await this.getOrderOrThrow(orderId);
      
      // ビジネスルール検証
      if (order.getStatus() !== 'PENDING') {
        throw new Error('Only pending orders can be confirmed');
      }

      // 価格計算
      const priceCalculation = this.pricingService.calculateFinalPrice(order);

      // 決済処理
      const paymentResult = await this.processPayment(order, priceCalculation);

      // 注文確定
      order.confirm();
      await this.orderRepository.update(order);

      // イベント発行
      await this.publishDomainEvents(order);

      // 通知送信
      await this.sendOrderConfirmedNotification(order);

      this.logger.info('Order confirmed successfully', { 
        orderId,
        transactionId: paymentResult.transactionId 
      });

      return this.toDTO(order);
    });
  }

  async shipOrder(orderId: string): Promise<OrderDTO> {
    return this.executeInTransaction(async () => {
      const order = await this.getOrderOrThrow(orderId);
      
      order.ship();
      await this.orderRepository.update(order);

      await this.publishDomainEvents(order);
      await this.sendOrderShippedNotification(order);

      return this.toDTO(order);
    });
  }

  async deliverOrder(orderId: string): Promise<OrderDTO> {
    return this.executeInTransaction(async () => {
      const order = await this.getOrderOrThrow(orderId);
      
      order.deliver();
      await this.orderRepository.update(order);

      await this.publishDomainEvents(order);
      await this.sendOrderDeliveredNotification(order);

      return this.toDTO(order);
    });
  }

  async cancelOrder(orderId: string, reason: string): Promise<OrderDTO> {
    return this.executeInTransaction(async () => {
      const order = await this.getOrderOrThrow(orderId);
      
      // 返金処理（確定済みの場合）
      if (order.getStatus() === 'CONFIRMED') {
        await this.processRefund(order);
      }

      order.cancel();
      await this.orderRepository.update(order);

      await this.publishDomainEvents(order);
      await this.sendOrderCancelledNotification(order, reason);

      return this.toDTO(order);
    });
  }

  async getOrder(orderId: string): Promise<OrderDTO> {
    const order = await this.getOrderOrThrow(orderId);
    return this.toDTO(order);
  }

  async getCustomerOrders(customerId: string): Promise<OrderDTO[]> {
    const orders = await this.orderRepository.findByCustomerId(customerId);
    return orders.map(order => this.toDTO(order));
  }

  // プライベートヘルパーメソッド
  private async validateAndReserveProducts(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<Array<{ 
    product: Product; 
    orderItem: OrderItem; 
    reservationId: string 
  }>> {
    const results = [];
    
    for (const item of items) {
      // 商品の取得
      const product = await this.productCatalog.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      // 可用性チェック
      const available = await this.productCatalog.checkAvailability(
        item.productId,
        item.quantity
      );
      if (!available) {
        throw new Error(`Product ${item.productId} not available in quantity ${item.quantity}`);
      }

      // 予約
      const reservationId = await this.productCatalog.reserveProducts([{
        productId: item.productId,
        quantity: item.quantity
      }]);

      // 注文アイテム作成
      const orderItem = new OrderItem(
        product.id,
        product.name,
        new Money(product.price, product.currency),
        item.quantity
      );

      results.push({
        product,
        orderItem,
        reservationId
      });
    }

    return results;
  }

  private async processPayment(
    order: Order, 
    priceCalculation: any
  ): Promise<any> {
    const customer = await this.customerService.getCustomer(order.getCustomerId());
    
    // 顧客のデフォルト決済方法を取得（実装依存）
    const paymentMethod = await this.getCustomerPaymentMethod(order.getCustomerId());

    const paymentResult = await this.paymentGateway.processPayment({
      orderId: order.getId().toString(),
      amount: priceCalculation.getFinalPrice().getAmount(),
      currency: priceCalculation.getFinalPrice().getCurrency(),
      customerId: order.getCustomerId(),
      paymentMethod,
      billingAddress: customer.billingAddress
    });

    if (!paymentResult.success) {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }

    return paymentResult;
  }

  private async processRefund(order: Order): Promise<void> {
    // 支払い情報の取得（実装依存）
    const transactionId = await this.getOrderTransactionId(order.getId());
    
    if (transactionId) {
      const refundResult = await this.paymentGateway.refundPayment(transactionId);
      if (!refundResult.success) {
        this.logger.error('Refund failed', { 
          orderId: order.getId().toString(),
          error: refundResult.error 
        });
      }
    }
  }

  // 通知メソッド群
  private async sendOrderCreatedNotification(
    order: Order, 
    customer: any
  ): Promise<void> {
    await this.notificationService.sendEmail({
      to: customer.email,
      subject: 'Order Confirmation',
      body: `Dear ${customer.name}, your order ${order.getId().toString()} has been created.`,
      isHtml: false
    });
  }

  private async sendOrderConfirmedNotification(order: Order): Promise<void> {
    const customer = await this.customerService.getCustomer(order.getCustomerId());
    
    await this.notificationService.sendEmail({
      to: customer.email,
      subject: 'Order Confirmed',
      body: `Your order ${order.getId().toString()} has been confirmed and payment processed.`
    });
  }

  private async sendOrderShippedNotification(order: Order): Promise<void> {
    const customer = await this.customerService.getCustomer(order.getCustomerId());
    
    // SMS通知
    await this.notificationService.sendSMS({
      to: customer.phone,
      message: `Your order ${order.getId().toString()} has been shipped!`
    });

    // プッシュ通知
    await this.notificationService.sendPushNotification({
      userId: order.getCustomerId(),
      title: 'Order Shipped',
      message: `Your order is on its way!`,
      data: { orderId: order.getId().toString() }
    });
  }

  private async sendOrderDeliveredNotification(order: Order): Promise<void> {
    const customer = await this.customerService.getCustomer(order.getCustomerId());
    
    await this.notificationService.sendEmail({
      to: customer.email,
      subject: 'Order Delivered',
      body: `Your order ${order.getId().toString()} has been successfully delivered. Thank you for your business!`
    });
  }

  private async sendOrderCancelledNotification(
    order: Order, 
    reason: string
  ): Promise<void> {
    const customer = await this.customerService.getCustomer(order.getCustomerId());
    
    await this.notificationService.sendEmail({
      to: customer.email,
      subject: 'Order Cancelled',
      body: `Your order ${order.getId().toString()} has been cancelled. Reason: ${reason}`
    });
  }

  // ユーティリティメソッド
  private async getOrderOrThrow(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(new OrderId(orderId));
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  private async cancelProductReservations(
    validatedItems: Array<{ reservationId: string }>
  ): Promise<void> {
    for (const item of validatedItems) {
      try {
        await this.productCatalog.cancelReservation(item.reservationId);
      } catch (error) {
        this.logger.error('Failed to cancel reservation', {
          reservationId: item.reservationId,
          error
        });
      }
    }
  }

  private async getCustomerPaymentMethod(customerId: string): Promise<any> {
    // 実装依存 - 顧客のデフォルト決済方法取得
    return {
      type: 'CREDIT_CARD',
      details: {
        // 暗号化された情報
      }
    };
  }

  private async getOrderTransactionId(orderId: OrderId): Promise<string | null> {
    // 実装依存 - 注文の決済取引IDを取得
    return 'transaction-id';
  }

  private toDTO(order: Order): OrderDTO {
    return {
      id: order.getId().toString(),
      customerId: order.getCustomerId(),
      status: order.getStatus(),
      items: order.getItems().map(item => ({
        productId: item.getProductId(),
        productName: item.getProductName(),
        unitPrice: item.getUnitPrice().getAmount(),
        quantity: item.getQuantity(),
        totalPrice: item.getTotalPrice().getAmount()
      })),
      totalAmount: order.getTotalAmount().getAmount(),
      createdAt: order.getCreatedAt().toISOString(),
      confirmedAt: order.getConfirmedAt()?.toISOString(),
      shippedAt: order.getShippedAt()?.toISOString(),
      deliveredAt: order.getDeliveredAt()?.toISOString()
    };
  }
}
```

## イベント駆動アーキテクチャの統合

### イベントハンドリングサービス

```typescript
// ドメインイベントハンドラー
import { injectable, inject } from 'inversify';
import { EventHandler } from '../ports/secondary/EventBus';
import { OrderConfirmedEvent } from '../../domain/events/OrderEvents';

@injectable()
export class OrderEventHandler implements EventHandler<OrderConfirmedEvent> {
  constructor(
    @inject('NotificationService') 
    private readonly notificationService: NotificationService,
    @inject('InventoryService') 
    private readonly inventoryService: InventoryService,
    @inject('LoyaltyService') 
    private readonly loyaltyService: LoyaltyService,
    @inject('Logger') 
    private readonly logger: Logger
  ) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    this.logger.info('Processing OrderConfirmedEvent', {
      orderId: event.getOrderId().toString()
    });

    try {
      // 1. 在庫の確定
      await this.inventoryService.confirmInventoryReservation(
        event.getOrderId().toString()
      );

      // 2. ロイヤリティポイントの付与
      await this.loyaltyService.addPoints(
        event.getCustomerId(),
        this.calculateLoyaltyPoints(event.getTotalAmount())
      );

      // 3. 社内通知（新規注文）
      await this.notificationService.sendEmail({
        to: 'fulfillment@company.com',
        subject: 'New Order Confirmed',
        body: `Order ${event.getOrderId()} confirmed for processing.`
      });

    } catch (error) {
      this.logger.error('Error processing OrderConfirmedEvent', {
        orderId: event.getOrderId().toString(),
        error
      });
      // 補償トランザクションやエラー回復処理
      throw error;
    }
  }

  private calculateLoyaltyPoints(amount: Money): number {
    return Math.floor(amount.getAmount() / 10); // 10円で1ポイント
  }
}
```

## エラーハンドリング戦略

### 包括的エラーマネジメント

```typescript
// カスタムエラークラス
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InfrastructureError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

// エラーハンドリングデコレータ
export function HandleErrors(errorMap: Record<string, (error: Error) => Error>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        // エラーマッピング
        for (const [errorType, handler] of Object.entries(errorMap)) {
          if (error instanceof Error && error.constructor.name === errorType) {
            throw handler(error);
          }
        }
        throw error;
      }
    };

    return descriptor;
  };
}

// 使用例
@HandleErrors({
  'ProductNotFoundError': (error) => new DomainError('商品が見つかりません', 'PRODUCT_NOT_FOUND'),
  'InsufficientInventoryError': (error) => new DomainError('在庫が不足しています', 'INSUFFICIENT_INVENTORY')
})
async createOrder(command: CreateOrderCommand): Promise<OrderDTO> {
  // 実装...
}
```

**設計原則**:
- Single Responsibility（単一責任）
- Dependency Inversion（依存性逆転）
- トランザクション境界の明確化
- ドメインイベントによる副作用分離
- 包括的エラーハンドリング

