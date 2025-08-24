# Clean Architecture パターン

## 📚 学習パス

### 初級者向け
1. [コア原則](./01-core-principles.md) - 依存性ルールと設計原則
2. [エンティティ層](./02-entities.md) - ビジネスルールの実装
3. [ユースケース層](./03-use-cases.md) - アプリケーション固有のビジネスルール

### 中級者向け
4. [インターフェースアダプター](./04-interface-adapters.md) - プレゼンターとコントローラー
5. [フレームワーク層](./05-frameworks.md) - 外部フレームワークとドライバー
6. [依存性注入](./06-dependency-injection.md) - 依存性逆転の実装

### 上級者向け
7. [テスト戦略](./07-testing.md) - 各層のテスト方法
8. [実装例](./08-implementation.md) - 完全な実装サンプル
9. [ベストプラクティス](./09-best-practices.md) - 設計上の注意点

## 🎯 トピック別アクセス

### アーキテクチャ設計
- [レイヤー構造](./01-core-principles.md#layers)
- [依存性ルール](./01-core-principles.md#dependency-rule)
- [境界の定義](./04-interface-adapters.md#boundaries)

### 実装パターン
- [エンティティ実装](./02-entities.md#implementation)
- [ユースケース実装](./03-use-cases.md#use-case-pattern)
- [リポジトリパターン](./04-interface-adapters.md#repository)

### テストとメンテナンス
- [単体テスト](./07-testing.md#unit-tests)
- [統合テスト](./07-testing.md#integration-tests)
- [モックとスタブ](./07-testing.md#mocking)

## 🚀 クイックスタート

```typescript
// Clean Architectureの基本構造
import { Entity } from './01-core-principles';
import { UseCase } from './03-use-cases';
import { Repository } from './04-interface-adapters';
```