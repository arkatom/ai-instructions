# Clean Architecture - E2Eテスト

> APIエンドポイントの統合テスト実装

## API統合テスト

```typescript
// __tests__/e2e/user-api.e2e.test.ts
describe('User API E2E Tests', () => {
  let app: Application;
  let server: any;
  let container: TestDIContainer;

  beforeAll(async () => {
    // テスト用DIコンテナを使用
    container = new TestDIContainer();
    await container.initialize();

    app = new Application(container);
    server = await app.start(0); // ランダムポート
  });

  afterAll(async () => {
    await server.close();
    await container.cleanup();
  });

  beforeEach(async () => {
    await container.reset();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User registered successfully',
        userId: expect.any(String)
      });
    });

    it('should reject invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'Doe'
      };

      await request(server)
        .post('/api/v1/users/register')
        .send(invalidData)
        .expect(400);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // 最初の登録
      await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      // 重複登録
      await request(server)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /api/v1/users/login', () => {
    beforeEach(async () => {
      // テストユーザーを作成
      await request(server)
        .post('/api/v1/users/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com'
        })
      });
    });

    it('should reject invalid credentials', async () => {
      await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // ユーザー登録とログイン
      const registerResponse = await request(server)
        .post('/api/v1/users/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe'
        });

      userId = registerResponse.body.userId;

      const loginResponse = await request(server)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        });

      authToken = loginResponse.body.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(server)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    it('should reject request without token', async () => {
      await request(server)
        .get(`/api/v1/users/${userId}`)
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(server)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
```