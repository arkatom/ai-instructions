# DDD戦略的設計

## 基本概念

### ユビキタス言語
開発チームとドメインエキスパートが共有する共通言語。コード、会話、ドキュメント全てで一貫して使用する。

```typescript
// ユビキタス言語の定義例
export interface UbiquitousLanguage {
  term: string;
  definition: string;
  context: string;
  examples: string[];
}

// ECサイトのユビキタス言語
const ecommerceLanguage: UbiquitousLanguage[] = [
  {
    term: 'Product',
    definition: '販売可能な商品アイテム',
    context: 'Catalog',
    examples: ['書籍', 'デジタルコンテンツ', '物理商品']
  },
  {
    term: 'Order',
    definition: '顧客からの注文',
    context: 'Order',
    examples: ['通常注文', '定期購入', 'プリオーダー']
  },
  {
    term: 'Stock',
    definition: '実際の在庫数量',
    context: 'Inventory',
    examples: ['倉庫在庫', '店舗在庫', '予約在庫']
  }
];
```

### BoundedContext
ドメインモデルが適用される明確な境界。各コンテキストは独自のユビキタス言語を持つ。

```typescript
export interface BoundedContext {
  name: string;
  description: string;
  ubiquitousLanguage: Map<string, string>;
  domainServices: string[];
  aggregates: string[];
  valueObjects: string[];
  domainEvents: string[];
}

// コンテキスト定義の基底クラス
export abstract class DomainContext implements BoundedContext {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly ubiquitousLanguage: Map<string, string>;
  abstract readonly domainServices: string[];
  abstract readonly aggregates: string[];
  abstract readonly valueObjects: string[];
  abstract readonly domainEvents: string[];

  // コンテキスト間の通信
  async publishEvent(event: DomainEvent): Promise<void> {
    // イベントバスへの公開
    console.log(`Publishing ${event.name} from ${this.name} context`);
  }

  // 他コンテキストからのイベント購読
  subscribeToEvent(eventName: string, handler: EventHandler): void {
    // イベント購読の設定
    console.log(`${this.name} subscribing to ${eventName}`);
  }
}
```

### Context Map
複数のBounded Context間の関係を視覚化し、統合パターンを定義。

```typescript
export enum RelationshipType {
  CUSTOMER_SUPPLIER = 'Customer-Supplier',
  SHARED_KERNEL = 'Shared-Kernel',
  PARTNERSHIP = 'Partnership',
  CONFORMIST = 'Conformist',
  ANTICORRUPTION_LAYER = 'Anticorruption-Layer',
  OPEN_HOST_SERVICE = 'Open-Host-Service',
  PUBLISHED_LANGUAGE = 'Published-Language'
}

export interface ContextRelationship {
  type: RelationshipType;
  upstream: string;
  downstream: string;
  description: string;
  sharedConcepts: string[];
  integrationPattern: string;
}

export class ContextMap {
  private relationships = new Map<string, ContextRelationship[]>();

  addRelationship(relationship: ContextRelationship): void {
    const key = `${relationship.upstream}->${relationship.downstream}`;
    if (!this.relationships.has(key)) {
      this.relationships.set(key, []);
    }
    this.relationships.get(key)!.push(relationship);
  }

  // 統合パターンの実装例
  getIntegrationStrategy(from: string, to: string): string {
    const key = `${from}->${to}`;
    const relations = this.relationships.get(key);
    
    if (!relations || relations.length === 0) {
      return 'No direct relationship';
    }

    // 関係性に基づく統合戦略の決定
    const relation = relations[0];
    switch (relation.type) {
      case RelationshipType.CUSTOMER_SUPPLIER:
        return 'REST API with versioning';
      case RelationshipType.SHARED_KERNEL:
        return 'Shared library';
      case RelationshipType.ANTICORRUPTION_LAYER:
        return 'Adapter pattern with translation';
      default:
        return 'Event-driven integration';
    }
  }
}
```

### サブドメイン
ビジネスドメインを論理的に分割した部分領域。

```typescript
export enum SubdomainType {
  CORE = 'Core',           // 競争優位性の源泉
  SUPPORTING = 'Supporting', // ビジネスをサポート
  GENERIC = 'Generic'      // 汎用的な機能
}

export interface Subdomain {
  name: string;
  type: SubdomainType;
  businessValue: 'High' | 'Medium' | 'Low';
  complexity: 'High' | 'Medium' | 'Low';
  volatility: 'High' | 'Medium' | 'Low';
}

// ECサイトのサブドメイン例
const subdomains: Subdomain[] = [
  {
    name: 'Product Recommendation',
    type: SubdomainType.CORE,
    businessValue: 'High',
    complexity: 'High',
    volatility: 'High'
  },
  {
    name: 'Order Management',
    type: SubdomainType.SUPPORTING,
    businessValue: 'High',
    complexity: 'Medium',
    volatility: 'Medium'
  },
  {
    name: 'User Authentication',
    type: SubdomainType.GENERIC,
    businessValue: 'Low',
    complexity: 'Low',
    volatility: 'Low'
  }
];
```