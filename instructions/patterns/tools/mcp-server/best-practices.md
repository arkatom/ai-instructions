# MCPサーバー ベストプラクティス

セキュリティ、パフォーマンス、エラーハンドリング。

## セキュリティ

```typescript
// 入力検証
import { z } from 'zod';

const schema = z.object({
  query: z.string().max(1000),
  limit: z.number().min(1).max(100)
});

// APIキー検証
function validateApiKey(key: string): boolean {
  const validKeys = new Set(process.env.VALID_KEYS?.split(','));
  return validKeys.has(key);
}

// SQLインジェクション対策
function sanitizeQuery(query: string): string {
  return query.replace(/[';\\]/g, '');
}
```

## パフォーマンス最適化

```typescript
// キャッシング
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5 // 5分
});

// レート制限
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute'
});

// 非同期バッチ処理
import pLimit from 'p-limit';

const limit = pLimit(5); // 同時実行数5
```

## エラーハンドリング

```typescript
// カスタムエラークラス
class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

// グローバルエラーハンドラー
server.onerror = (error) => {
  logger.error({
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};
```

## ロギング

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});
```

## 環境設定

```typescript
// .env
NODE_ENV=production
API_KEY=secret-key
LOG_LEVEL=info
MAX_CONNECTIONS=100

// config.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY!,
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100')
};
```

## チェックリスト
- [ ] 入力検証実装
- [ ] エラーハンドリング
- [ ] ロギング設定
- [ ] キャッシング検討
- [ ] レート制限
- [ ] セキュリティ対策
- [ ] 環境変数管理
- [ ] テスト作成