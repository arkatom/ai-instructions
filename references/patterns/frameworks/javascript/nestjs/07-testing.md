# NestJS Testing Strategies

## 🧪 Unit Testing

### Service Testing
```typescript
// user.service.spec.ts
describe('UserService', () => {
  let service: UserService;
  let repository: MockType<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();

    service = module.get(UserService);
    repository = module.get(getRepositoryToken(User));
  });

  describe('createUser', () => {
    it('should hash password and save user', async () => {
      const dto = { email: 'test@example.com', password: 'password' };
      repository.save.mockResolvedValue({ id: 1, ...dto });
      
      const result = await service.createUser(dto);
      
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email })
      );
      expect(result.password).toBeUndefined();
    });
  });
});
```

### Controller Testing
```typescript
describe('UserController', () => {
  let controller: UserController;
  let service: MockType<UserService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useFactory: () => ({
            findAll: jest.fn(),
            findOne: jest.fn(),
          }),
        },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  it('should return paginated users', async () => {
    const mockUsers = [{ id: 1 }, { id: 2 }];
    service.findAll.mockResolvedValue({
      items: mockUsers,
      total: 2,
    });

    const result = await controller.findAll({ page: 1, limit: 10 });
    
    expect(result.items).toEqual(mockUsers);
    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });
});
```

## 🔄 Integration Testing

### E2E Test Setup
```typescript
// test/app.e2e-spec.ts
describe('AppController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Get auth token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    authToken = response.body.access_token;
  });

  describe('/users', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/users')
        .expect(401);
    });

    it('should return users with valid token', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

## 🎯 Test Utilities

### Mock Factories
```typescript
// test/factories/repository.mock.ts
export const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(() => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
}));

// Test data builders
export class UserTestDataBuilder {
  private user: Partial<User> = {
    email: 'test@example.com',
    username: 'testuser',
  };

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  withRole(role: UserRole): this {
    this.user.role = role;
    return this;
  }

  build(): User {
    return this.user as User;
  }
}
```

### Database Seeding
```typescript
// test/seeds/test-data.seed.ts
export class TestDataSeeder {
  constructor(private dataSource: DataSource) {}

  async seed(): Promise<void> {
    await this.seedUsers();
    await this.seedPosts();
  }

  private async seedUsers(): Promise<void> {
    const users = Array.from({ length: 10 }, (_, i) => ({
      email: `user${i}@test.com`,
      username: `user${i}`,
      password: 'hashedpassword',
    }));

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(users)
      .execute();
  }

  async cleanup(): Promise<void> {
    // 要実装: トランザクション内でテストデータをクリーンアップ
    await this.dataSource.query('TRUNCATE TABLE users CASCADE');
  }
}
```

## 💡 Testing Best Practices

### Coverage Configuration
```json
// package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.module.ts",
      "!**/main.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### Performance Testing
```typescript
// 要実装: 負荷テストとパフォーマンス計測
describe('Performance', () => {
  it('should handle 1000 concurrent requests', async () => {
    const promises = Array.from({ length: 1000 }, () =>
      request(app.getHttpServer()).get('/health')
    );
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000); // 5秒以内
  });
});
```