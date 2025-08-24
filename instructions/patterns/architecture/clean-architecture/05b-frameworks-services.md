# Clean Architecture - インフラサービス

> 認証、キャッシュ、メッセージング、ロギングの実装

## 認証・認可サービス

### JWT認証サービス

```typescript
// infrastructure/services/jwt-auth.service.ts
import jwt from 'jsonwebtoken';

export class JWTAuthService implements AuthService {
  constructor(
    private secret: string,
    private expiresIn: string = '24h'
  ) {}

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'clean-architecture-app',
      audience: 'clean-architecture-users'
    });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'clean-architecture-app',
        audience: 'clean-architecture-users'
      }) as TokenPayload;
      
      return decoded;
    } catch (error) {
      return null;
    }
  }

  refreshToken(token: string): string | null {
    const payload = this.verifyToken(token);
    
    if (!payload) {
      return null;
    }
    
    // 新しいトークンを生成
    return this.generateToken({
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles
    });
  }
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}
```

### パスワードハッシュ化サービス

```typescript
// infrastructure/services/bcrypt-password.service.ts
import bcrypt from 'bcrypt';

export class BcryptPasswordService implements PasswordHasher {
  private readonly saltRounds = 10;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

## キャッシュサービス

### Redis実装

```typescript
// infrastructure/services/redis-cache.service.ts
import Redis from 'ioredis';

export class RedisCacheService implements CacheService {
  private client: Redis;

  constructor(config: RedisConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('error', (error) => {
      console.error('Redis error', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    
    if (!value) {
      return null;
    }
    
    try {
      return JSON.parse(value);
    } catch {
      return value as any;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }

  // パターンマッチングによる一括削除
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // リスト操作
  async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => 
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return this.client.lpush(key, ...serializedValues);
  }

  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    const values = await this.client.lrange(key, start, stop);
    return values.map(v => {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    });
  }
}
```

## メッセージング

### RabbitMQイベントバス

```typescript
// infrastructure/messaging/rabbitmq-event-bus.ts
import amqp from 'amqplib';

export class RabbitMQEventBus implements EventBus {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(private config: RabbitMQConfig) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.config.url);
    this.channel = await this.connection.createChannel();
    
    // エクスチェンジの作成
    await this.channel.assertExchange('events', 'topic', { durable: true });
    
    console.log('Connected to RabbitMQ');
  }

  async publish(event: DomainEvent): Promise<void> {
    const routingKey = event.type;
    const message = Buffer.from(JSON.stringify(event));
    
    await this.channel.publish('events', routingKey, message, {
      persistent: true,
      timestamp: Date.now(),
      messageId: generateId()
    });
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    const queueName = `${eventType}_queue`;
    
    // キューの作成
    await this.channel.assertQueue(queueName, { durable: true });
    
    // バインディング
    await this.channel.bindQueue(queueName, 'events', eventType);
    
    // コンシューマーの設定
    await this.channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await handler(event);
          
          this.channel.ack(msg);
        } catch (error) {
          console.error('Event handling error', error);
          this.channel.nack(msg, false, false); // デッドレターキューへ
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
```

## ロギング

### Winston Logger実装

```typescript
// infrastructure/services/winston-logger.service.ts
import winston from 'winston';

export class WinstonLogger implements Logger {
  private logger: winston.Logger;

  constructor(config: LoggerConfig) {
    this.logger = winston.createLogger({
      level: config.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}
```

## 設計原則

### 1. プラガビリティ
フレームワークは置き換え可能な部品として設計

### 2. 設定の外部化
環境変数や設定ファイルによる設定管理

### 3. グレースフルシャットダウン
適切なリソースクリーンアップ

### 4. エラー処理の統一
ロギングとモニタリングの一元化

### 5. パフォーマンス考慮
接続プーリング、キャッシング、圧縮などの最適化