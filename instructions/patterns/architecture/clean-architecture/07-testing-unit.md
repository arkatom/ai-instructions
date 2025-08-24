# Clean Architecture - ユニットテスト

> エンティティとユースケースの単体テスト

## 概要

Clean Architectureでは、各層の責任が明確に分離されているため、それぞれに適したテスト戦略を適用できます。依存性注入により、モックやスタブを効果的に使用して、高速で信頼性の高いテストスイートを構築できます。

## エンティティのユニットテスト

### ユーザーエンティティのテスト

```typescript
// __tests__/entities/user.entity.test.ts
describe('UserEntity', () => {
  let user: UserEntity;

  beforeEach(() => {
    user = new UserEntity({
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe'
    });
  });

  describe('changeEmail', () => {
    it('should change email when valid', () => {
      const newEmail = 'new@example.com';
      
      user.changeEmail(newEmail);
      
      expect(user.email).toBe(newEmail);
      expect(user.updatedAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should throw error for invalid email format', () => {
      expect(() => {
        user.changeEmail('invalid-email');
      }).toThrow('Invalid email format');
    });

    it('should not change email when same as current', () => {
      const originalUpdatedAt = user.updatedAt;
      
      user.changeEmail(user.email);
      
      expect(user.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe('recordLoginAttempt', () => {
    it('should reset failed attempts on successful login', () => {
      // 失敗を記録
      user.recordLoginAttempt(false);
      user.recordLoginAttempt(false);
      
      // 成功を記録
      user.recordLoginAttempt(true);
      
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).toBeDefined();
    });

    it('should increment failed attempts on failed login', () => {
      user.recordLoginAttempt(false);
      
      expect(user.failedLoginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        user.recordLoginAttempt(false);
      }
      
      expect(user.isLocked()).toBe(true);
      expect(user.failedLoginAttempts).toBe(5);
    });
  });

  describe('isLocked', () => {
    it('should return false when not locked', () => {
      expect(user.isLocked()).toBe(false);
    });

    it('should return true when locked and within lock period', () => {
      // 5回失敗させてロック
      for (let i = 0; i < 5; i++) {
        user.recordLoginAttempt(false);
      }
      
      expect(user.isLocked()).toBe(true);
    });

    it('should unlock after lock period expires', () => {
      // プライベートプロパティにアクセスするためのテストユーティリティ
      const pastLockTime = new Date(Date.now() - 31 * 60 * 1000); // 31分前
      (user as any)._lockedUntil = pastLockTime;
      (user as any)._failedLoginAttempts = 5;
      
      expect(user.isLocked()).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
    });
  });
});
```

### 商品エンティティのテスト

```typescript
// __tests__/entities/product.entity.test.ts
describe('ProductEntity', () => {
  let product: ProductEntity;

  beforeEach(() => {
    product = new ProductEntity({
      id: 'product-123',
      name: 'Test Product',
      description: 'Test Description',
      price: 1000,
      currency: 'JPY',
      stockQuantity: 10,
      categoryId: 'category-123'
    });
  });

  describe('updatePrice', () => {
    it('should update price when within valid range', () => {
      product.updatePrice(1500); // 50%増加
      
      expect(product.price).toBe(1500);
    });

    it('should throw error when price is negative', () => {
      expect(() => {
        product.updatePrice(-100);
      }).toThrow('Price cannot be negative');
    });

    it('should throw error when price increase exceeds 100%', () => {
      expect(() => {
        product.updatePrice(2100); // 110%増加
      }).toThrow('Price increase cannot exceed 100%');
    });

    it('should throw error when price decrease exceeds 50%', () => {
      expect(() => {
        product.updatePrice(400); // 60%減少
      }).toThrow('Price decrease cannot exceed 50%');
    });
  });

  describe('stock management', () => {
    it('should add stock correctly', () => {
      product.addStock(5);
      
      expect(product.stockQuantity).toBe(15);
    });

    it('should remove stock correctly', () => {
      product.removeStock(3);
      
      expect(product.stockQuantity).toBe(7);
      expect(product.isAvailable).toBe(true);
    });

    it('should mark as unavailable when stock reaches zero', () => {
      product.removeStock(10);
      
      expect(product.stockQuantity).toBe(0);
      expect(product.isAvailable).toBe(false);
    });

    it('should throw error when removing more stock than available', () => {
      expect(() => {
        product.removeStock(15);
      }).toThrow('Insufficient stock');
    });
  });

  describe('canBePurchased', () => {
    it('should return true when product is available and has sufficient stock', () => {
      expect(product.canBePurchased(5)).toBe(true);
    });

    it('should return false when quantity is zero or negative', () => {
      expect(product.canBePurchased(0)).toBe(false);
      expect(product.canBePurchased(-1)).toBe(false);
    });

    it('should return false when insufficient stock', () => {
      expect(product.canBePurchased(15)).toBe(false);
    });

    it('should return false when product is not available', () => {
      (product as any)._isAvailable = false;
      
      expect(product.canBePurchased(5)).toBe(false);
    });
  });
});
```