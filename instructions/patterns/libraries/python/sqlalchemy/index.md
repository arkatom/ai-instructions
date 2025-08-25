# SQLAlchemy 2.0 Advanced ORM パターン

> SQLAlchemy 2.0の最新機能を活用した高度なORM実装パターン集
> 
> **対象**: Python 3.10+, SQLAlchemy 2.0+
> **重点**: 非同期処理、型安全性、パフォーマンス最適化

## 📚 学習パス

### 初級者向け
1. [基本設定](./01-setup.md) - 非同期エンジン、セッション管理
2. [モデル定義](./02-models.md) - Mapped型、データクラス統合
3. [リレーションシップ](./03-relationships.md) - 関連定義、遅延読み込み

### 中級者向け
4. [クエリパターン](./04-queries.md) - 複雑なクエリ、JOIN最適化
5. [パフォーマンス最適化](./05-optimization.md) - N+1問題、バルク操作

### 上級者向け
6. [テスト戦略](./06-testing.md) - 非同期テスト、モック、ファクトリー
7. [高度なパターン](./07-patterns.md) - イベント、ハイブリッド属性、パーティショニング

## 🎯 タスク別クイックアクセス

### データベース接続
- [非同期エンジン設定](./01-setup.md#async-engine)
- [接続プール最適化](./01-setup.md#connection-pool)
- [セッション管理](./01-setup.md#session-management)

### モデル設計
- [Mapped型アノテーション](./02-models.md#mapped-types)
- [データクラス統合](./02-models.md#dataclass-integration)
- [カスタムベースクラス](./02-models.md#custom-base)

### リレーションシップ
- [1対多・多対多](./03-relationships.md#basic-relationships)
- [遅延読み込み戦略](./03-relationships.md#lazy-loading)
- [カスケード設定](./03-relationships.md#cascading)

### クエリ最適化
- [select()構文](./04-queries.md#select-syntax)
- [JOIN最適化](./04-queries.md#join-optimization)
- [サブクエリ](./04-queries.md#subqueries)

### パフォーマンス
- [N+1問題解決](./05-optimization.md#n-plus-one)
- [バルク操作](./05-optimization.md#bulk-operations)
- [キャッシング](./05-optimization.md#caching)

### テスト
- [非同期テスト](./06-testing.md#async-testing)
- [ファクトリーパターン](./06-testing.md#factory-pattern)
- [トランザクション管理](./06-testing.md#transaction-management)

## 💡 SQLAlchemy 2.0 主要変更点

1. **型アノテーション**: `Mapped[]`による型安全な定義
2. **データクラス統合**: `MappedAsDataclass`でシームレス統合
3. **非同期ファースト**: `asyncio`完全対応
4. **新クエリ構文**: `select()`中心の直感的な構文
5. **パフォーマンス向上**: 内部最適化による高速化
6. **型チェッカー対応**: mypy/pyright完全サポート