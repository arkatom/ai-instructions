# ORM-style Entity Decorators

> 🎯 **目的**: TypeScriptでのORM風Entity定義とメタデータ駆動のデータマッピング
> 
> 📊 **対象**: データベースマッピング、リレーション定義、Repository実装
> 
> ⚡ **特徴**: 型安全なEntity定義、SQLクエリ生成、リレーション管理

## Entity メタデータシステム

```typescript
// ORM メタデータ型定義
interface EntityMetadata {
  tableName: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  primaryKeys: string[];
}

interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
}

interface RelationMetadata {
  propertyName: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: () => any;
  joinColumn?: string;
  inverseSide?: string;
}

// メタデータストレージ
class EntityMetadataStorage {
  private static entities = new Map<any, EntityMetadata>();
  
  static getEntity(target: any): EntityMetadata {
    return this.entities.get(target) || {
      tableName: target.name.toLowerCase(),
      columns: [],
      relations: [],
      primaryKeys: []
    };
  }
  
  static setEntity(target: any, metadata: EntityMetadata): void {
    this.entities.set(target, metadata);
  }
  
  static addColumn(target: any, column: ColumnMetadata): void {
    const entity = this.getEntity(target);
    const existingIndex = entity.columns.findIndex(c => c.propertyName === column.propertyName);
    
    if (existingIndex >= 0) {
      entity.columns[existingIndex] = { ...entity.columns[existingIndex], ...column };
    } else {
      entity.columns.push(column);
    }
    
    this.setEntity(target, entity);
  }
  
  static addRelation(target: any, relation: RelationMetadata): void {
    const entity = this.getEntity(target);
    entity.relations.push(relation);
    this.setEntity(target, entity);
  }
}
```

## ORM Decorators

```typescript
// ORM Decorators
function Entity(tableName?: string) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    const entity = EntityMetadataStorage.getEntity(constructor);
    entity.tableName = tableName || constructor.name.toLowerCase();
    EntityMetadataStorage.setEntity(constructor, entity);
    
    return constructor;
  };
}

function Column(options: Partial<ColumnMetadata> = {}) {
  return function(target: any, propertyKey: string) {
    const column: ColumnMetadata = {
      propertyName: propertyKey,
      columnName: options.columnName || propertyKey,
      type: options.type || 'varchar',
      nullable: options.nullable ?? true,
      unique: options.unique ?? false,
      defaultValue: options.defaultValue
    };
    
    EntityMetadataStorage.addColumn(target.constructor, column);
  };
}

function PrimaryKey(target: any, propertyKey: string) {
  const entity = EntityMetadataStorage.getEntity(target.constructor);
  entity.primaryKeys.push(propertyKey);
  EntityMetadataStorage.setEntity(target.constructor, entity);
  
  // PrimaryKeyは通常のColumnでもある
  Column({ type: 'bigint', nullable: false, unique: true })(target, propertyKey);
}

function OneToMany(target: () => any, options: { inverseSide?: string } = {}) {
  return function(target_: any, propertyKey: string) {
    const relation: RelationMetadata = {
      propertyName: propertyKey,
      type: 'one-to-many',
      target,
      inverseSide: options.inverseSide
    };
    
    EntityMetadataStorage.addRelation(target_.constructor, relation);
  };
}

function ManyToOne(target: () => any, options: { joinColumn?: string } = {}) {
  return function(target_: any, propertyKey: string) {
    const relation: RelationMetadata = {
      propertyName: propertyKey,
      type: 'many-to-one',
      target,
      joinColumn: options.joinColumn
    };
    
    EntityMetadataStorage.addRelation(target_.constructor, relation);
  };
}
```

## Repository パターン

```typescript
// Repository基底クラス
abstract class Repository<T> {
  constructor(protected entityClass: new() => T) {}
  
  getMetadata(): EntityMetadata {
    return EntityMetadataStorage.getEntity(this.entityClass);
  }
  
  // SQLクエリ生成（簡略版）
  generateSelectSQL(): string {
    const metadata = this.getMetadata();
    const columns = metadata.columns.map(c => c.columnName).join(', ');
    return `SELECT ${columns} FROM ${metadata.tableName}`;
  }
  
  generateInsertSQL(entity: Partial<T>): string {
    const metadata = this.getMetadata();
    const columns = metadata.columns
      .filter(c => (entity as any)[c.propertyName] !== undefined)
      .map(c => c.columnName);
    const placeholders = columns.map(() => '?').join(', ');
    
    return `INSERT INTO ${metadata.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  }
  
  // 実際のデータベース操作メソッド（実装は省略）
  abstract findById(id: any): Promise<T | null>;
  abstract findAll(): Promise<T[]>;
  abstract save(entity: T): Promise<T>;
  abstract delete(entity: T): Promise<void>;
}
```

## Entity定義と使用例

```typescript
// Entity定義例
@Entity('users')
class User {
  @PrimaryKey
  id: number;

  @Column({ type: 'varchar', nullable: false, unique: true })
  username: string;

  @Column({ type: 'varchar', nullable: false })
  email: string;

  @Column({ type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => Post, { inverseSide: 'author' })
  posts: Post[];

  constructor() {
    this.id = 0;
    this.username = '';
    this.email = '';
    this.createdAt = new Date();
    this.posts = [];
  }
}

@Entity('posts') 
class Post {
  @PrimaryKey
  id: number;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => User, { joinColumn: 'author_id' })
  author: User;

  constructor() {
    this.id = 0;
    this.title = '';
    this.content = '';
    this.author = new User();
  }
}

// Repository実装例
class UserRepository extends Repository<User> {
  constructor() {
    super(User);
  }
  
  async findById(id: number): Promise<User | null> {
    // 実際のDB処理をシミュレート
    console.log(this.generateSelectSQL() + ` WHERE id = ${id}`);
    return null;
  }
  
  async findAll(): Promise<User[]> {
    console.log(this.generateSelectSQL());
    return [];
  }
  
  async save(user: User): Promise<User> {
    console.log(this.generateInsertSQL(user));
    return user;
  }
  
  async delete(user: User): Promise<void> {
    const metadata = this.getMetadata();
    console.log(`DELETE FROM ${metadata.tableName} WHERE id = ${user.id}`);
  }
}

// 使用例
const userRepo = new UserRepository();
console.log('User metadata:', userRepo.getMetadata());
```