# エンティティ層

## エンティティの実装

### ユーザーエンティティ

```typescript
// core/entities/user.entity.ts
export class UserEntity {
  private readonly _id: string;
  private _email: string;
  private _passwordHash: string;
  private _firstName: string;
  private _lastName: string;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _lastLoginAt?: Date;
  private _failedLoginAttempts: number;
  private _lockedUntil?: Date;

  constructor(props: UserEntityProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._lastLoginAt = props.lastLoginAt;
    this._failedLoginAttempts = props.failedLoginAttempts ?? 0;
    this._lockedUntil = props.lockedUntil;
  }

  // ビジネスルール: メールアドレス変更
  changeEmail(newEmail: string): void {
    if (!this.isValidEmail(newEmail)) {
      throw new Error('Invalid email format');
    }
    
    if (this._email === newEmail) {
      return; // 変更なし
    }

    this._email = newEmail;
    this._updatedAt = new Date();
  }

  // ビジネスルール: ログイン試行
  recordLoginAttempt(success: boolean): void {
    if (success) {
      this._failedLoginAttempts = 0;
      this._lastLoginAt = new Date();
      this._lockedUntil = undefined;
    } else {
      this._failedLoginAttempts++;
      
      // 5回失敗でアカウントロック（30分）
      if (this._failedLoginAttempts >= 5) {
        const lockDuration = 30 * 60 * 1000; // 30分
        this._lockedUntil = new Date(Date.now() + lockDuration);
      }
    }
    
    this._updatedAt = new Date();
  }

  // ビジネスルール: アカウントロック確認
  isLocked(): boolean {
    if (!this._lockedUntil) {
      return false;
    }
    
    if (new Date() > this._lockedUntil) {
      this._lockedUntil = undefined;
      this._failedLoginAttempts = 0;
      return false;
    }
    
    return true;
  }

  // ビジネスルール: パスワード変更可能性
  canChangePassword(): boolean {
    return this._isActive && !this.isLocked();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Getters
  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get passwordHash(): string { return this._passwordHash; }
  get fullName(): string { return `${this._firstName} ${this._lastName}`; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }
  get failedLoginAttempts(): number { return this._failedLoginAttempts; }
}

interface UserEntityProps {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  failedLoginAttempts?: number;
  lockedUntil?: Date;
}
```

### プロダクトエンティティ

```typescript
// core/entities/product.entity.ts
export class ProductEntity {
  private readonly _id: string;
  private _name: string;
  private _description: string;
  private _price: number;
  private _currency: string;
  private _stockQuantity: number;
  private _isAvailable: boolean;
  private _categoryId: string;
  private _tags: string[];
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ProductEntityProps) {
    this.validateProps(props);
    
    this._id = props.id;
    this._name = props.name;
    this._description = props.description;
    this._price = props.price;
    this._currency = props.currency;
    this._stockQuantity = props.stockQuantity;
    this._isAvailable = props.isAvailable ?? true;
    this._categoryId = props.categoryId;
    this._tags = props.tags ?? [];
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ビジネスルール: 価格変更
  updatePrice(newPrice: number): void {
    if (newPrice < 0) {
      throw new Error('Price cannot be negative');
    }
    
    if (newPrice > this._price * 2) {
      throw new Error('Price increase cannot exceed 100%');
    }
    
    if (newPrice < this._price * 0.5) {
      throw new Error('Price decrease cannot exceed 50%');
    }
    
    this._price = newPrice;
    this._updatedAt = new Date();
  }

  // ビジネスルール: 在庫追加
  addStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    this._stockQuantity += quantity;
    this._updatedAt = new Date();
  }

  // ビジネスルール: 在庫減算
  removeStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    if (quantity > this._stockQuantity) {
      throw new Error('Insufficient stock');
    }
    
    this._stockQuantity -= quantity;
    
    // 在庫が0になったら利用不可にする
    if (this._stockQuantity === 0) {
      this._isAvailable = false;
    }
    
    this._updatedAt = new Date();
  }

  // ビジネスルール: 商品の購入可能性
  canBePurchased(quantity: number): boolean {
    return this._isAvailable && 
           this._stockQuantity >= quantity && 
           quantity > 0;
  }

  private validateProps(props: ProductEntityProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    
    if (props.price < 0) {
      throw new Error('Product price cannot be negative');
    }
    
    if (props.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
  }

  // Getters
  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get price(): number { return this._price; }
  get currency(): string { return this._currency; }
  get stockQuantity(): number { return this._stockQuantity; }
  get isAvailable(): boolean { return this._isAvailable; }
  get categoryId(): string { return this._categoryId; }
  get tags(): string[] { return [...this._tags]; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}

interface ProductEntityProps {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  isAvailable?: boolean;
  categoryId: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}