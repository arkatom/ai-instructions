# Clean Architecture - 統合テスト

> リポジトリ層の統合テスト実装

## PostgreSQL リポジトリテスト

```typescript
// __tests__/repositories/user-repository.integration.test.ts
describe('UserRepositoryImpl Integration Tests', () => {
  let database: PostgresConnection;
  let repository: UserRepositoryImpl;
  let mapper: UserMapper;

  beforeAll(async () => {
    // テストデータベース接続
    database = new PostgresConnection({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'test_db',
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test'
    });

    mapper = new UserMapper();
    repository = new UserRepositoryImpl(database, mapper);

    // テストテーブル作成
    await setupTestTables();
  });

  beforeEach(async () => {
    // 各テスト前にテーブルをクリーンアップ
    await database.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await database.close();
  });

  describe('save and findById', () => {
    it('should save and retrieve user', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      const retrieved = await repository.findById('user-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('user-123');
      expect(retrieved!.email).toBe('test@example.com');
      expect(retrieved!.firstName).toBe('John');
    });

    it('should update existing user', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      // エンティティを更新
      user.changeEmail('updated@example.com');

      await repository.save(user);

      const retrieved = await repository.findById('user-123');

      expect(retrieved!.email).toBe('updated@example.com');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = new UserEntity({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe'
      });

      await repository.save(user);

      const retrieved = await repository.findByEmail('test@example.com');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('user-123');
    });

    it('should return null for non-existent email', async () => {
      const retrieved = await repository.findByEmail('nonexistent@example.com');

      expect(retrieved).toBeNull();
    });
  });

  describe('findAll with criteria', () => {
    beforeEach(async () => {
      // テストデータの準備
      const users = [
        new UserEntity({
          id: 'user-1',
          email: 'user1@example.com',
          passwordHash: 'hash',
          firstName: 'User1',
          lastName: 'Test',
          isActive: true
        }),
        new UserEntity({
          id: 'user-2',
          email: 'user2@example.com',
          passwordHash: 'hash',
          firstName: 'User2',
          lastName: 'Test',
          isActive: false
        }),
        new UserEntity({
          id: 'user-3',
          email: 'user3@example.com',
          passwordHash: 'hash',
          firstName: 'User3',
          lastName: 'Test',
          isActive: true
        })
      ];

      for (const user of users) {
        await repository.save(user);
      }
    });

    it('should find all users', async () => {
      const users = await repository.findAll();

      expect(users).toHaveLength(3);
    });

    it('should filter by active status', async () => {
      const activeUsers = await repository.findAll({ isActive: true });

      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.every(user => user.isActive)).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const users = await repository.findAll({ limit: 2, offset: 1 });

      expect(users).toHaveLength(2);
    });
  });

  async function setupTestTables(): Promise<void> {
    const createUserTable = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP
      )
    `;

    await database.query(createUserTable);
  }
});
```