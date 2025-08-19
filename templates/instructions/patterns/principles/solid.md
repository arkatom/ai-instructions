# SOLID原則

保守性の高いコードのためのオブジェクト指向設計原則。

## 単一責任の原則 (SRP)
クラスは変更の理由を1つだけ持つべき。

✅ 良い例:
```typescript
// 各クラスが単一責任
class User {
  constructor(public id: string, public email: string) {}
}

class UserRepository {
  async save(user: User): Promise<void> { /* DB処理 */ }
}

class EmailService {
  async sendEmail(user: User): Promise<void> { /* メール処理 */ }
}
```

❌ 悪い例:
```typescript
// 1クラスに複数責任
class UserService {
  async createUser(email: string): Promise<User> {
    // 検証 + DB + メール + ログ = 責任過多
  }
}
```

## 開放閉鎖の原則 (OCP)
拡張に対して開き、修正に対して閉じる。

✅ 良い例:
```typescript
interface PaymentProcessor {
  process(amount: number): Promise<void>;
}

class CreditCardProcessor implements PaymentProcessor { /* ... */ }
class PayPalProcessor implements PaymentProcessor { /* ... */ }
// 既存コード修正なしで新決済方法追加
```

## リスコフの置換原則 (LSP)
派生クラスは基底クラスと置換可能であるべき。

✅ 良い例:
```typescript
abstract class Bird {
  abstract move(): void;
}

class FlyingBird extends Bird {
  move() { this.fly(); }
}

class SwimmingBird extends Bird {
  move() { this.swim(); }
}
// どちらも基底クラスとして扱える
```

## インターフェース分離の原則 (ISP)
使わないメソッドへの依存を強制しない。

✅ 良い例:
```typescript
interface Readable { read(): string; }
interface Writable { write(data: string): void; }

class ReadOnlyFile implements Readable { /* ... */ }
class EditableFile implements Readable, Writable { /* ... */ }
```

## 依存性逆転の原則 (DIP)
具象ではなく抽象に依存する。

✅ 良い例:
```typescript
interface Logger { log(msg: string): void; }
interface Database { save(data: any): Promise<void>; }

class OrderService {
  constructor(
    private logger: Logger,    // 抽象に依存
    private db: Database
  ) {}
}
```

## チェックリスト
- [ ] 各クラスが単一責任
- [ ] 拡張による機能追加、修正不要
- [ ] サブクラスが基底クラスを適切に代替
- [ ] インターフェースが小さく集中的
- [ ] 依存が抽象を向いている