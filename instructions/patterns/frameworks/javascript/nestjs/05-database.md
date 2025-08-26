# NestJS データベース統合

TypeORM統合とリポジトリパターンの実装。

## 🗄️ TypeORM設定

### データベース接続設定

```typescript
// config/database.config.ts
export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 接続プール最適化
  extra: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000
  },
  
  // クエリ最適化
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error'],
  maxQueryExecutionTime: 10000,
  
  // マイグレーション設定
  synchronize: false,
  migrationsRun: false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}']
});
```

### エンティティ定義

```typescript
// entities/user.entity.ts
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'jsonb', nullable: true })
  profile: UserProfile;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => RoleEntity)
  @JoinTable()
  roles: RoleEntity[];

  @OneToMany(() => OrderEntity, order => order.user)
  orders: OrderEntity[];
}
```

## 📦 リポジトリパターン

### インターフェース定義

```typescript
// repositories/interfaces/user.repository.ts
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findMany(criteria: UserSearchCriteria): Promise<User[]>;
  delete(id: string): Promise<void>;
}
```

### 実装

```typescript
// repositories/typeorm-user.repository.ts
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
    private readonly mapper: UserMapper
  ) {}

  async save(user: User): Promise<void> {
    const entity = this.mapper.toEntity(user);
    await this.repository.save(entity);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['profile', 'roles']
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findMany(criteria: UserSearchCriteria): Promise<User[]> {
    const query = this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.roles', 'roles');

    if (criteria.email) {
      query.andWhere('user.email ILIKE :email', { 
        email: `%${criteria.email}%` 
      });
    }

    if (criteria.isActive !== undefined) {
      query.andWhere('user.status = :status', { 
        status: criteria.isActive ? 'active' : 'inactive'
      });
    }

    const entities = await query
      .orderBy('user.createdAt', 'DESC')
      .limit(criteria.limit || 50)
      .offset(criteria.offset || 0)
      .getMany();

    return entities.map(entity => this.mapper.toDomain(entity));
  }
}
```

## 🔄 マイグレーション

```typescript
// migrations/1234567890-CreateUserTable.ts
export class CreateUserTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()'
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true
          },
          {
            name: 'password_hash',
            type: 'varchar'
          },
          {
            name: 'profile',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'suspended'],
            default: "'active'"
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()'
          }
        ],
        indices: [
          { name: 'IDX_USER_EMAIL', columnNames: ['email'] },
          { name: 'IDX_USER_STATUS', columnNames: ['status'] }
        ]
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

## 🎯 最適化

```typescript
// キャッシュリポジトリ
@Injectable()
export class CachedUserRepository implements UserRepository {
  constructor(
    private readonly baseRepository: TypeOrmUserRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    const cached = await this.cacheManager.get<User>(cacheKey);
    
    if (cached) return cached;

    const user = await this.baseRepository.findById(id);
    if (user) {
      await this.cacheManager.set(cacheKey, user, 300);
    }

    return user;
  }

  async save(user: User): Promise<void> {
    await this.baseRepository.save(user);
    await this.cacheManager.del(`user:${user.getId()}`);
  }
}
```

## 🎯 ベストプラクティス

- **リポジトリ抽象化**: ビジネスロジックとデータ層の分離
- **マッパー使用**: エンティティとドメインモデルの変換
- **インデックス最適化**: クエリパフォーマンス向上
- **キャッシュ戦略**: 頻繁にアクセスされるデータのキャッシング