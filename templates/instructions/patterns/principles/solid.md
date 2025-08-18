# SOLID Principles

Core object-oriented design principles for maintainable code.

## Single Responsibility Principle (SRP)
A class should have only one reason to change.

✅ Good:
```typescript
// Each class has one responsibility
class User {
  constructor(public id: string, public email: string) {}
}

class UserRepository {
  async save(user: User): Promise<void> { /* DB logic */ }
}

class EmailService {
  async sendEmail(user: User): Promise<void> { /* Email logic */ }
}
```

❌ Bad:
```typescript
// Multiple responsibilities in one class
class UserService {
  async createUser(email: string): Promise<User> {
    // Validation + DB + Email + Logging = Too many responsibilities
  }
}
```

## Open/Closed Principle (OCP)
Open for extension, closed for modification.

✅ Good:
```typescript
interface PaymentProcessor {
  process(amount: number): Promise<void>;
}

class CreditCardProcessor implements PaymentProcessor { /* ... */ }
class PayPalProcessor implements PaymentProcessor { /* ... */ }
// Add new payment methods without modifying existing code
```

## Liskov Substitution Principle (LSP)
Derived classes must be substitutable for base classes.

✅ Good:
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
// Both work with base class interface
```

## Interface Segregation Principle (ISP)
Don't force clients to depend on methods they don't use.

✅ Good:
```typescript
interface Readable { read(): string; }
interface Writable { write(data: string): void; }

class ReadOnlyFile implements Readable { /* ... */ }
class EditableFile implements Readable, Writable { /* ... */ }
```

## Dependency Inversion Principle (DIP)
Depend on abstractions, not concretions.

✅ Good:
```typescript
interface Logger { log(msg: string): void; }
interface Database { save(data: any): Promise<void>; }

class OrderService {
  constructor(
    private logger: Logger,    // Depend on abstractions
    private db: Database
  ) {}
}
```

## Checklist
- [ ] Each class has single responsibility
- [ ] New features added via extension not modification
- [ ] Subclasses properly substitute base classes
- [ ] Interfaces are small and focused
- [ ] Dependencies point to abstractions