# Clean Architectureのコア原則

## 依存性ルール

### レイヤー構造

```typescript
// 依存性の方向: 外側から内側へのみ
// Framework & Drivers → Interface Adapters → Use Cases → Entities

// ❌ 悪い例：内側が外側に依存
// entities/user.ts
import { PostgresClient } from 'pg'; // 外部ライブラリへの依存

// ✅ 良い例：依存性逆転
// entities/user.ts
export class User {
  // 純粋なビジネスロジックのみ
}

// use-cases/user-service.ts
interface UserRepository {
  save(user: User): Promise<void>;
}

// infrastructure/postgres-user-repository.ts
import { PostgresClient } from 'pg';
class PostgresUserRepository implements UserRepository {
  // 外部依存はインフラ層に隔離
}
```

## SOLID原則の適用

### 単一責任原則 (SRP)

```typescript
// ✅ 各クラスは単一の責任を持つ
export class User {
  // ユーザーのビジネスルールのみ
  changeEmail(email: string): void {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email');
    }
    this._email = email;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

export class UserSerializer {
  // シリアライゼーションの責任のみ
  toJSON(user: User): object {
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }
}

export class UserValidator {
  // バリデーションの責任のみ
  validate(user: User): ValidationResult {
    const errors: string[] = [];
    
    if (!user.email) {
      errors.push('Email is required');
    }
    
    if (!user.name) {
      errors.push('Name is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 開放閉鎖原則 (OCP)

```typescript
// 拡張に対して開いており、修正に対して閉じている
interface PaymentProcessor {
  process(amount: number): Promise<PaymentResult>;
}

// 新しい支払い方法の追加は既存コードの修正不要
class CreditCardProcessor implements PaymentProcessor {
  async process(amount: number): Promise<PaymentResult> {
    // クレジットカード処理
    return { success: true, transactionId: 'CC123' };
  }
}

class PayPalProcessor implements PaymentProcessor {
  async process(amount: number): Promise<PaymentResult> {
    // PayPal処理
    return { success: true, transactionId: 'PP456' };
  }
}

class PaymentService {
  constructor(private processor: PaymentProcessor) {}
  
  async makePayment(amount: number): Promise<PaymentResult> {
    return this.processor.process(amount);
  }
}
```

### 依存性逆転原則 (DIP)

```typescript
// 高レベルモジュールは低レベルモジュールに依存しない
// 両方とも抽象に依存する

// Core層（高レベル）
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

class UserService {
  constructor(private repository: UserRepository) {}
  
  async getUser(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
}

// Infrastructure層（低レベル）
class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    // MongoDB固有の実装
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.mapToUser(doc) : null;
  }
  
  async save(user: User): Promise<void> {
    // MongoDB固有の実装
    await this.collection.updateOne(
      { _id: user.id },
      { $set: this.mapToDocument(user) },
      { upsert: true }
    );
  }
}
```

## テスタビリティ

```typescript
// テスト可能な設計
class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: Logger
  ) {}
  
  async execute(input: CreateUserInput): Promise<User> {
    // ビジネスロジック
    const user = new User(input);
    await this.userRepository.save(user);
    await this.emailService.sendWelcome(user.email);
    this.logger.info('User created', { userId: user.id });
    return user;
  }
}

// テスト時はモックを注入
describe('CreateUserUseCase', () => {
  it('should create user', async () => {
    const mockRepo = { save: jest.fn() };
    const mockEmail = { sendWelcome: jest.fn() };
    const mockLogger = { info: jest.fn() };
    
    const useCase = new CreateUserUseCase(
      mockRepo as any,
      mockEmail as any,
      mockLogger as any
    );
    
    const user = await useCase.execute({
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(mockRepo.save).toHaveBeenCalledWith(user);
    expect(mockEmail.sendWelcome).toHaveBeenCalledWith('test@example.com');
  });
});
```