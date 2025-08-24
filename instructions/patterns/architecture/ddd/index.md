# Domain-Driven Design (DDD) パターン

## 📚 学習パス

### 初級者向け
1. [戦略的設計](./01-strategic-design.md) - DDDの基本概念とユビキタス言語
2. [境界づけられたコンテキスト](./02-bounded-context.md) - コンテキストマッピングと統合パターン
3. [エンティティと値オブジェクト](./04-entities-vo.md) - 基本的なドメインモデル要素

### 中級者向け
4. [アグリゲート](./03-aggregates.md) - トランザクション境界と一貫性
5. [リポジトリ](./05-repositories.md) - 永続化の抽象化
6. [ドメインサービス](./06-domain-services.md) - ビジネスロジックの配置

### 上級者向け
7. [ドメインイベント](./07-domain-events.md) - イベント駆動アーキテクチャ
8. [アプリケーション層](./08-application-layer.md) - ユースケースの実装
9. [アンチパターン](./09-anti-patterns.md) - よくある失敗と対策

## 🎯 トピック別アクセス

### 実装パターン
- [アグリゲート実装例](./03-aggregates.md#implementation)
- [値オブジェクト実装例](./04-entities-vo.md#value-objects)
- [リポジトリ実装例](./05-repositories.md#implementation)

### 設計パターン
- [コンテキストマッピング](./02-bounded-context.md#context-mapping)
- [ドメインイベント設計](./07-domain-events.md#event-design)
- [レイヤーアーキテクチャ](./08-application-layer.md#architecture)

### トラブルシューティング
- [アグリゲート境界の見直し](./03-aggregates.md#troubleshooting)
- [アンチパターン回避](./09-anti-patterns.md)

## 🚀 クイックスタート

```typescript
// 基本的なDDD実装の開始点
import { Entity, ValueObject, AggregateRoot } from './01-strategic-design';
import { Repository } from './05-repositories';
import { DomainEvent } from './07-domain-events';
```