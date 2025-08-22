# Core Concepts & Architecture Philosophy

> 🎯 **目的**: ヘキサゴナルアーキテクチャの基本原則と設計思想
> 
> 📊 **対象**: アーキテクチャ哲学、依存関係ルール、レイヤー構成
> 
> ⚡ **特徴**: ビジネスロジック独立性、技術非依存、テスタビリティ

## アーキテクチャ哲学

### 基本原則

```yaml
hexagonal_principles:
  core_concepts:
    application_core_independence: "ビジネスロジックの技術的独立性"
    port_driven_communication: "ポート経由での制御された通信"
    adapter_based_integration: "アダプターによる外部技術統合"
    technology_agnosticism: "技術選択からの自由"
  
  benefits:
    testability: "モックとスタブによる容易なテスト"
    flexibility: "要件変更への迅速な対応"
    technology_independence: "フレームワーク・DB非依存"
    business_logic_isolation: "ドメイン知識の保護"

  anti_patterns:
    - "フレームワークへの依存"
    - "データベーススキーマ駆動設計"
    - "技術的関心事のビジネスロジック侵入"
    - "テストが困難な密結合"
```

### レイヤー構成と責務

```typescript
// アーキテクチャレイヤーの定義
interface HexagonalLayers {
  // 中心: ドメインコア (最も重要)
  domainCore: {
    entities: "ビジネス概念の表現";
    valueObjects: "不変な値の表現";
    domainServices: "ドメイン固有ロジック";
    aggregates: "整合性境界の定義";
  };
  
  // アプリケーション層
  applicationServices: {
    useCases: "ユースケースの調整";
    workflows: "ビジネスプロセスの管理";
    eventHandlers: "ドメインイベント処理";
  };
  
  // ポート層 (境界の定義)
  ports: {
    primary: "外部からの駆動インターフェース";
    secondary: "外部への依存インターフェース";
  };
  
  // アダプター層 (境界の実装)
  adapters: {
    primary: "外部からの要求受付実装";
    secondary: "外部システム統合実装";
  };
}

// 依存関係ルール
class DependencyRule {
  private static readonly ALLOWED_DEPENDENCIES = [
    "External -> Adapter",
    "Adapter -> Port", 
    "Port -> Application",
    "Application -> Domain"
  ];
  
  private static readonly FORBIDDEN_DEPENDENCIES = [
    "Domain -> Application",
    "Domain -> Port", 
    "Domain -> Adapter",
    "Application -> Adapter"
  ];
  
  static validateDependency(from: Layer, to: Layer): boolean {
    // 内側の層は外側の層に依存してはならない
    return this.getLayerLevel(to) <= this.getLayerLevel(from);
  }
  
  private static getLayerLevel(layer: Layer): number {
    const levels = {
      'domain': 1,
      'application': 2,
      'port': 3,
      'adapter': 4,
      'external': 5
    };
    return levels[layer];
  }
}
```

## ポート・アダプターパターン

### ポートの概念と種類

```typescript
// Primary Port (駆動側ポート) - アプリケーションを使用する
interface PrimaryPort<T, R> {
  execute(input: T): Promise<R>;
}

// Secondary Port (被駆動側ポート) - アプリケーションが使用する  
interface SecondaryPort<T, R> {
  call(request: T): Promise<R>;
}

// 実用例: 注文管理システム
interface CreateOrderUseCase extends PrimaryPort<CreateOrderCommand, OrderResult> {
  execute(command: CreateOrderCommand): Promise<OrderResult>;
}

interface OrderRepository extends SecondaryPort<OrderQuery, Order[]> {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order>;
  findByCustomer(customerId: string): Promise<Order[]>;
}

interface PaymentService extends SecondaryPort<PaymentRequest, PaymentResult> {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  refundPayment(orderId: string): Promise<RefundResult>;
}

// ポート構成の設計パターン
class PortConfiguration {
  static readonly PRIMARY_PATTERNS = {
    "REST_API": "HTTP経由でのリクエスト処理",
    "GRAPHQL": "GraphQL クエリ・ミューテーション",
    "CLI": "コマンドライン インターフェース",
    "MESSAGE_QUEUE": "非同期メッセージ処理",
    "SCHEDULED_TASK": "定期実行タスク"
  };
  
  static readonly SECONDARY_PATTERNS = {
    "REPOSITORY": "データ永続化",
    "EXTERNAL_API": "外部サービス連携", 
    "NOTIFICATION": "通知・メッセージング",
    "CACHE": "キャッシング",
    "FILE_STORAGE": "ファイル管理"
  };
}
```

### アダプターの実装戦略

```typescript
// アダプター基底クラス
abstract class BaseAdapter<TPort, TExternal> {
  constructor(protected externalSystem: TExternal) {}
  
  abstract adapt(portCall: any): Promise<any>;
  
  // 共通のエラーハンドリング
  protected handleError(error: Error): void {
    // ログ出力、エラー変換、回復処理
    console.error(`Adapter error: ${error.message}`);
  }
  
  // 共通のデータ変換
  protected transform<T, R>(data: T, mapper: (data: T) => R): R {
    try {
      return mapper(data);
    } catch (error) {
      this.handleError(error);
      throw new Error('Data transformation failed');
    }
  }
}

// Primary Adapter の実装例
class RestApiAdapter extends BaseAdapter<CreateOrderUseCase, ExpressApp> {
  constructor(
    private useCase: CreateOrderUseCase,
    expressApp: ExpressApp
  ) {
    super(expressApp);
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    this.externalSystem.post('/orders', async (req, res) => {
      try {
        const command = this.transform(req.body, this.mapToCommand);
        const result = await this.useCase.execute(command);
        res.json(this.transform(result, this.mapToResponse));
      } catch (error) {
        this.handleError(error);
        res.status(500).json({ error: 'Order creation failed' });
      }
    });
  }
  
  private mapToCommand = (body: any): CreateOrderCommand => ({
    customerId: body.customerId,
    items: body.items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }))
  });
}

// Secondary Adapter の実装例  
class PostgreSQLOrderRepository extends BaseAdapter<any, PostgresClient> implements OrderRepository {
  constructor(pgClient: PostgresClient) {
    super(pgClient);
  }
  
  async save(order: Order): Promise<void> {
    const query = `
      INSERT INTO orders (id, customer_id, status, created_at, items)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await this.externalSystem.query(query, [
      order.getId().toString(),
      order.getCustomerId(),
      order.getStatus(),
      new Date(),
      JSON.stringify(order.getItems())
    ]);
  }
  
  async findById(id: OrderId): Promise<Order> {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await this.externalSystem.query(query, [id.toString()]);
    
    if (result.rows.length === 0) {
      throw new Error(`Order ${id.toString()} not found`);
    }
    
    return this.transform(result.rows[0], this.mapToOrder);
  }
}
```

## 設計決定フレームワーク

### アーキテクチャ判断基準

```typescript
class ArchitectureDecisionFramework {
  static evaluateDesign(proposal: DesignProposal): ArchitectureScore {
    const criteria = {
      businessLogicIsolation: this.scoreBLIsolation(proposal),
      testability: this.scoreTestability(proposal), 
      flexibility: this.scoreFlexibility(proposal),
      complexity: this.scoreComplexity(proposal),
      performance: this.scorePerformance(proposal)
    };
    
    return new ArchitectureScore(criteria);
  }
  
  private static scoreBLIsolation(proposal: DesignProposal): number {
    // ビジネスロジックが技術的関心事から分離されているかスコア化
    const hasFrameworkDependency = proposal.domainLayer.dependencies
      .some(dep => dep.type === 'framework');
    const hasInfrastructureDependency = proposal.domainLayer.dependencies
      .some(dep => dep.type === 'infrastructure');
    
    if (hasFrameworkDependency || hasInfrastructureDependency) {
      return 0; // 完全失格
    }
    
    return proposal.domainLayer.pureness * 10;
  }
  
  static recommendPattern(requirements: Requirements): PatternRecommendation {
    if (requirements.complexity === 'high' && requirements.changeFrequency === 'high') {
      return PatternRecommendation.FULL_HEXAGONAL;
    }
    
    if (requirements.complexity === 'medium') {
      return PatternRecommendation.SIMPLIFIED_HEXAGONAL;
    }
    
    return PatternRecommendation.TRADITIONAL_LAYERED;
  }
}
```

## 実装チェックリスト

### 設計品質検証項目

```yaml
hexagonal_quality_checklist:
  dependency_rules:
    - "ドメイン層に外部依存なし"
    - "アプリケーション層がポートのみに依存"
    - "アダプターが実装の詳細を隠蔽"
    
  port_design:
    - "ビジネス概念ベースのインターフェース"
    - "技術的詳細の抽象化"
    - "単一責任の原則遵守"
    
  testability:
    - "ドメインロジックが単体テスト可能"
    - "ポート経由でのモック・スタブ利用"
    - "外部依存なしでのテスト実行"
    
  flexibility:
    - "アダプター交換可能性"
    - "新規ポート追加の容易さ"
    - "技術選択の自由度"
```

**適用シナリオ**: 複雑なビジネスロジック、長期保守性、技術変更頻度が高いプロジェクト

**適当度評価**: 1/10 (包括的なアーキテクチャ原則の体系化)