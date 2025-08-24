# Clean Architecture - プロジェクト構成

> プロジェクトのディレクトリ構造と初期設定

## 概要

Clean Architectureの実装は、適切なプロジェクト構成と段階的なアプローチによって成功します。このガイドでは、実際のプロジェクト立ち上げから完成まで、段階を追って実装方法を説明します。

## ディレクトリ構造

```
project/
├── src/
│   ├── core/                          # 内側の層
│   │   ├── entities/                  # エンティティ
│   │   │   ├── user.entity.ts
│   │   │   ├── product.entity.ts
│   │   │   └── order.entity.ts
│   │   ├── use-cases/                 # ユースケース
│   │   │   ├── user/
│   │   │   │   ├── register-user.use-case.ts
│   │   │   │   ├── login-user.use-case.ts
│   │   │   │   └── get-user-profile.use-case.ts
│   │   │   ├── product/
│   │   │   │   ├── create-product.use-case.ts
│   │   │   │   └── update-product.use-case.ts
│   │   │   └── order/
│   │   │       └── place-order.use-case.ts
│   │   └── interfaces/               # インターフェース定義
│   │       ├── repositories/
│   │       │   ├── user.repository.ts
│   │       │   └── product.repository.ts
│   │       └── services/
│   │           ├── auth.service.ts
│   │           └── email.service.ts
│   ├── adapters/                     # アダプタ層
│   │   ├── controllers/              # コントローラー
│   │   │   ├── user.controller.ts
│   │   │   └── product.controller.ts
│   │   ├── presenters/               # プレゼンター
│   │   │   ├── user.presenter.ts
│   │   │   └── product.presenter.ts
│   │   ├── gateways/                 # ゲートウェイ
│   │   │   ├── database/
│   │   │   │   ├── user-repository.impl.ts
│   │   │   │   └── product-repository.impl.ts
│   │   │   └── external/
│   │   │       └── payment-gateway.impl.ts
│   │   └── mappers/                  # マッパー
│   │       ├── user.mapper.ts
│   │       └── product.mapper.ts
│   ├── infrastructure/               # インフラ層
│   │   ├── web/
│   │   │   ├── express-app.ts
│   │   │   └── middleware/
│   │   ├── database/
│   │   │   └── postgres-connection.ts
│   │   ├── services/
│   │   │   ├── jwt-auth.service.ts
│   │   │   ├── bcrypt-password.service.ts
│   │   │   └── redis-cache.service.ts
│   │   └── messaging/
│   │       └── rabbitmq-event-bus.ts
│   ├── main/                         # メイン層
│   │   ├── container.ts              # DIコンテナ
│   │   ├── app.ts                    # アプリケーション
│   │   └── index.ts                  # エントリーポイント
│   └── shared/                       # 共通
│       ├── errors/
│       ├── types/
│       └── utils/
├── __tests__/                        # テスト
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                             # ドキュメント
├── migrations/                       # データベースマイグレーション
└── scripts/                          # ビルド・デプロイスクリプト
```

## パッケージ構成（package.json）

```json
{
  "name": "clean-architecture-api",
  "version": "1.0.0",
  "main": "dist/main/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev src/main/index.ts",
    "start": "node dist/main/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "pg": "^8.11.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "winston": "^3.8.2",
    "amqplib": "^0.10.3",
    "joi": "^17.9.1",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "typescript": "^5.0.4",
    "ts-node-dev": "^2.0.0",
    "@types/node": "^18.16.3",
    "@types/express": "^4.17.17",
    "@types/pg": "^8.6.6",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/bcrypt": "^5.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.1",
    "supertest": "^6.3.3",
    "eslint": "^8.40.0",
    "@typescript-eslint/parser": "^5.59.5",
    "@typescript-eslint/eslint-plugin": "^5.59.5",
    "prettier": "^2.8.8",
    "node-pg-migrate": "^6.2.2"
  }
}
```