# Clean Architecture - Frameworks & Drivers層

> 外部フレームワークとドライバーによるインフラストラクチャ実装

## 概要

Frameworks & Drivers層は、Clean Architectureの最外層に位置し、データベース、Webサーバー、UI、外部APIなどの技術的詳細を実装します。この層の変更は内側の層に影響を与えないように設計する必要があります。

## 実装ファイル一覧

### [Webフレームワーク](./05-frameworks-web.md)
Express.jsとFastAPIによるWeb層の実装

### [データベース](./05a-frameworks-database.md)
PostgreSQLとMongoDBによるデータ永続化層

### [インフラサービス](./05b-frameworks-services.md)
認証、キャッシュ、メッセージング、ロギングの実装

## アーキテクチャ原則

```
┌─────────────────────────────────────┐
│     Frameworks & Drivers層          │
│  ┌────────────────────────────┐    │
│  │   Web (Express/FastAPI)    │    │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │  Database (PostgreSQL/MongoDB)  │
│  └────────────────────────────┘    │
│  ┌────────────────────────────┐    │
│  │    Services (Auth/Cache)    │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
              ↓ 依存性の方向
    内側の層（Use Cases, Entities）
```

## 実装のポイント

1. **技術的詳細の隔離** - フレームワーク固有のコードをこの層に限定
2. **インターフェース準拠** - 内側の層で定義されたインターフェースを実装
3. **設定の外部化** - 環境変数による設定管理
4. **エラーハンドリング** - 統一的なエラー処理とロギング
5. **パフォーマンス最適化** - 接続プーリング、キャッシング、圧縮

## 技術スタック例

- **Webフレームワーク**: Express.js, FastAPI, NestJS
- **データベース**: PostgreSQL, MongoDB, Redis
- **認証**: JWT, OAuth2, Passport.js
- **メッセージング**: RabbitMQ, Kafka, Redis Pub/Sub
- **ロギング**: Winston, Bunyan, Pino

## 学習の進め方

1. [Webフレームワーク](./05-frameworks-web.md)でHTTP層の実装を理解
2. [データベース](./05a-frameworks-database.md)でデータ永続化を学習
3. [インフラサービス](./05b-frameworks-services.md)で周辺サービスを実装