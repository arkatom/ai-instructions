# Clean Architecture - データベース実装

> PostgreSQLとMongoDBによるデータ永続化層

## PostgreSQL接続とクエリ実行

```typescript
// infrastructure/database/postgres-connection.ts
import { Pool, PoolConfig } from 'pg';

export class PostgresConnection implements Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 2000,
    };

    this.pool = new Pool(poolConfig);

    // エラーハンドリング
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 5000) {
        console.warn('Slow query detected', { text, duration });
      }
      
      return {
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error('Query error', { text, params, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await callback({
        query: (text: string, params?: any[]) => client.query(text, params)
      });
      
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

## MongoDB実装

```typescript
// infrastructure/database/mongodb-connection.ts
import { MongoClient, Db, Collection } from 'mongodb';

export class MongoDBConnection implements NoSQLDatabase {
  private client: MongoClient;
  private db: Db;

  constructor(private config: MongoConfig) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.config.uri, {
      maxPoolSize: this.config.maxPoolSize || 10,
      serverSelectionTimeoutMS: this.config.serverSelectionTimeout || 5000,
      socketTimeoutMS: this.config.socketTimeout || 45000,
    });

    await this.client.connect();
    this.db = this.client.db(this.config.database);
    
    console.log('Connected to MongoDB');
  }

  collection<T = any>(name: string): Collection<T> {
    return this.db.collection<T>(name);
  }

  async createIndexes(collectionName: string, indexes: IndexSpec[]): Promise<void> {
    const collection = this.collection(collectionName);
    
    for (const index of indexes) {
      await collection.createIndex(index.spec, index.options);
    }
  }

  async transaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    
    try {
      return await session.withTransaction(callback);
    } finally {
      await session.endSession();
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// MongoDBユーザーリポジトリ実装
export class MongoUserRepository implements UserRepository {
  constructor(
    private db: MongoDBConnection,
    private mapper: UserMapper
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    const collection = this.db.collection('users');
    const document = await collection.findOne({ _id: id });
    
    if (!document) {
      return null;
    }
    
    return this.mapper.toDomain(document);
  }

  async save(user: UserEntity): Promise<void> {
    const collection = this.db.collection('users');
    const document = this.mapper.toPersistence(user);
    
    await collection.replaceOne(
      { _id: user.id },
      { ...document, _id: user.id },
      { upsert: true }
    );
  }

  async findWithAggregation(pipeline: any[]): Promise<UserEntity[]> {
    const collection = this.db.collection('users');
    const cursor = collection.aggregate(pipeline);
    const documents = await cursor.toArray();
    
    return documents.map(doc => this.mapper.toDomain(doc));
  }
}
```