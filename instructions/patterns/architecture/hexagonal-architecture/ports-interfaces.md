# Ports & Interfaces Definition

> 🎯 **目的**: ポート・アダプターパターンの境界インターフェース定義
> 
> 📊 **対象**: プライマリポート（駆動側）、セカンダリポート（被駆動側）
> 
> ⚡ **特徴**: 契約ベース設計、技術非依存、置換可能性

## Primary Ports (駆動側ポート)

### Use Case Ports - コマンド操作

```typescript
// プライマリポートの基本構造
interface PrimaryPort<TCommand, TResult> {
  execute(command: TCommand): Promise<TResult>;
}

// 注文管理のユースケースポート
export interface CreateOrderCommand {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface UpdateOrderCommand {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface OrderDTO {
  id: string;
  customerId: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  createdAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

// 統合されたユースケースポート
export interface OrderUseCases {
  // 注文操作
  createOrder(command: CreateOrderCommand): Promise<OrderDTO>;
  updateOrder(command: UpdateOrderCommand): Promise<OrderDTO>;
  confirmOrder(orderId: string): Promise<OrderDTO>;
  shipOrder(orderId: string): Promise<OrderDTO>;
  deliverOrder(orderId: string): Promise<OrderDTO>;
  cancelOrder(orderId: string, reason: string): Promise<OrderDTO>;
  
  // 単体取得
  getOrder(orderId: string): Promise<OrderDTO>;
  getCustomerOrders(customerId: string): Promise<OrderDTO[]>;
}
```

### Query Ports - クエリ操作

```typescript
// クエリ専用ポート（CQRS パターン）
export interface OrderListFilter {
  customerId?: string;
  status?: string[];
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  productIds?: string[];
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface OrderListItem {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderStatistics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  recentOrderTrend: Array<{
    date: string;
    orderCount: number;
    revenue: number;
  }>;
}

export interface OrderQueries {
  // リスト取得
  listOrders(
    filter: OrderListFilter,
    pagination: PaginationOptions
  ): Promise<{
    items: OrderListItem[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
  }>;
  
  // 詳細取得
  getOrderDetails(orderId: string): Promise<{
    order: OrderDTO;
    customer: CustomerInfo;
    shippingAddress: Address;
    billingAddress: Address;
    paymentInfo: PaymentInfo;
  }>;
  
  // 統計・分析
  getOrderStatistics(customerId?: string): Promise<OrderStatistics>;
  
  // 高度な検索
  searchOrders(searchQuery: string): Promise<OrderListItem[]>;
  
  // ダッシュボード
  getDashboardData(customerId?: string): Promise<{
    recentOrders: OrderListItem[];
    statistics: OrderStatistics;
    alerts: string[];
  }>;
}

// 共通データ型
export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipLevel: 'STANDARD' | 'PREMIUM' | 'VIP';
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface PaymentInfo {
  method: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  processedAt?: string;
}
```

## Secondary Ports (被駆動側ポート)

### Repository Ports - データ永続化

```typescript
// リポジトリパターンの基本インターフェース
export interface Repository<TEntity, TId> {
  save(entity: TEntity): Promise<void>;
  findById(id: TId): Promise<TEntity | null>;
  update(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

// 注文リポジトリ
export interface OrderRepository extends Repository<Order, OrderId> {
  findByCustomerId(customerId: string): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  findByDateRange(fromDate: Date, toDate: Date): Promise<Order[]>;
  countByStatus(status: OrderStatus): Promise<number>;
  nextId(): Promise<OrderId>;
  
  // バッチ操作
  saveMany(orders: Order[]): Promise<void>;
  findMany(ids: OrderId[]): Promise<Order[]>;
  
  // 複合クエリ
  findByCustomerAndStatus(
    customerId: string, 
    status: OrderStatus
  ): Promise<Order[]>;
}

// 顧客リポジトリ  
export interface CustomerRepository extends Repository<Customer, string> {
  findByEmail(email: string): Promise<Customer | null>;
  findByPhone(phone: string): Promise<Customer | null>;
  findPremiumCustomers(): Promise<Customer[]>;
}
```

### External Service Ports - 外部システム連携

```typescript
// 商品カタログサービス
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  availableQuantity: number;
  category: string;
  tags: string[];
}

export interface ProductCatalog {
  getProduct(productId: string): Promise<Product | null>;
  getProducts(productIds: string[]): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  
  // 在庫管理
  checkAvailability(productId: string, quantity: number): Promise<boolean>;
  reserveProducts(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<string>; // Returns reservation ID
  confirmReservation(reservationId: string): Promise<void>;
  cancelReservation(reservationId: string): Promise<void>;
  
  // 価格情報
  getCurrentPrice(productId: string): Promise<number>;
  getBulkPricing(productId: string, quantity: number): Promise<number>;
}

// 顧客サービス
export interface CustomerService {
  getCustomer(customerId: string): Promise<CustomerInfo | null>;
  getCustomerAddresses(customerId: string): Promise<Address[]>;
  isLoyalCustomer(customerId: string): Promise<boolean>;
  getLoyaltyPoints(customerId: string): Promise<number>;
  updateLoyaltyPoints(customerId: string, points: number): Promise<void>;
}
```

### Payment Gateway Port - 決済システム

```typescript
// 決済処理のインターフェース
export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  billingAddress: Address;
}

export interface PaymentMethod {
  type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PAYPAL' | 'BANK_TRANSFER' | 'CRYPTOCURRENCY';
  details: {
    // Credit/Debit Card
    cardNumber?: string;
    expiryMonth?: number;
    expiryYear?: number;
    cvv?: string;
    cardHolderName?: string;
    
    // PayPal
    paypalEmail?: string;
    
    // Bank Transfer
    accountNumber?: string;
    routingNumber?: string;
    
    // Cryptocurrency
    walletAddress?: string;
    cryptoType?: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  errorCode?: string;
  timestamp: Date;
  processingFee?: number;
}

export interface PaymentGateway {
  // 決済処理
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  
  // 返金処理
  refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentResult>;
  
  // ステータス確認
  getPaymentStatus(transactionId: string): Promise<{
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    details: Record<string, any>;
    updatedAt: Date;
  }>;
  
  // 決済方法の検証
  validatePaymentMethod(method: PaymentMethod): Promise<{
    isValid: boolean;
    errors: string[];
  }>;
}
```

### Notification Service Port - 通知システム

```typescript
// 通知チャネル別インターフェース
export interface EmailNotification {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    mimeType: string;
  }>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface SMSNotification {
  to: string;
  message: string;
  countryCode?: string;
}

export interface PushNotification {
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

export interface NotificationService {
  // 各種通知の送信
  sendEmail(notification: EmailNotification): Promise<{
    messageId: string;
    deliveredAt: Date;
  }>;
  
  sendSMS(notification: SMSNotification): Promise<{
    messageId: string;
    deliveredAt: Date;
  }>;
  
  sendPushNotification(notification: PushNotification): Promise<{
    messageId: string;
    deliveredAt: Date;
  }>;
  
  // 一括送信
  sendBulkEmails(notifications: EmailNotification[]): Promise<Array<{
    messageId: string;
    to: string;
    status: 'SENT' | 'FAILED';
    error?: string;
  }>>;
  
  // テンプレート機能
  sendTemplatedEmail(
    templateId: string,
    to: string,
    variables: Record<string, any>
  ): Promise<{ messageId: string; deliveredAt: Date }>;
  
  // 配信状況の確認
  getDeliveryStatus(messageId: string): Promise<{
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
    attempts: number;
    lastAttempt?: Date;
    error?: string;
  }>;
}
```

## Port Design Principles

### ポート設計の原則

```typescript
// ポート設計の品質チェッククラス
class PortDesignValidator {
  static validatePort(portInterface: any): ValidationResult {
    const issues: string[] = [];
    
    // 1. ビジネス概念ベースの命名
    if (this.containsTechnicalTerms(portInterface.name)) {
      issues.push("Port名に技術的な用語が含まれています");
    }
    
    // 2. 単一責任の原則
    if (this.countResponsibilities(portInterface) > 1) {
      issues.push("ポートが複数の責任を持っています");
    }
    
    // 3. 技術的詳細の抽象化
    if (this.exposesImplementationDetails(portInterface)) {
      issues.push("実装の詳細が露出しています");
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
  
  private static readonly TECHNICAL_TERMS = [
    'HTTP', 'REST', 'SQL', 'Database', 'Cache', 'Queue', 
    'Json', 'Xml', 'Socket', 'Protocol'
  ];
  
  private static containsTechnicalTerms(name: string): boolean {
    return this.TECHNICAL_TERMS.some(term => 
      name.toLowerCase().includes(term.toLowerCase())
    );
  }
}

// 良い例と悪い例
namespace PortExamples {
  // ❌ 悪い例 - 技術的詳細が露出
  interface BadOrderRepository {
    executeSQL(query: string, params: any[]): Promise<any>;
    getCachedOrder(id: string): Promise<any>;
    sendHttpRequest(url: string): Promise<any>;
  }
  
  // ✅ 良い例 - ビジネス概念ベース
  interface GoodOrderRepository {
    save(order: Order): Promise<void>;
    findById(id: OrderId): Promise<Order | null>;
    findByCustomer(customerId: string): Promise<Order[]>;
  }
}
```

**設計ガイドライン**:
- インターフェースはビジネス概念で命名
- 技術的詳細を抽象化
- 単一責任の原則を遵守  
- 契約ベースの設計（前提条件・事後条件）

**適当度評価**: 1/10 (完璧なポート・アダプター境界設計)