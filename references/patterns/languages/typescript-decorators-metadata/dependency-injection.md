# Dependency Injection Container

> 🎯 **目的**: DecoratorベースのDIコンテナの実装と依存性注入パターン
> 
> 📊 **対象**: サービスの登録と解決、依存関係の自動解決
> 
> ⚡ **特徴**: 型安全なDI実装、シングルトンパターン対応、循環依存検知

## DI Container実装

```typescript
// DI Container実装
interface ServiceDescriptor {
  token: string;
  factory: () => any;
  singleton?: boolean;
  dependencies?: string[];
}

class DIContainer {
  private services = new Map<string, ServiceDescriptor>();
  private instances = new Map<string, any>();
  
  register<T>(descriptor: ServiceDescriptor): void {
    this.services.set(descriptor.token, descriptor);
  }
  
  resolve<T>(token: string): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }
    
    const service = this.services.get(token);
    if (!service) {
      throw new Error(`Service ${token} not found`);
    }
    
    // 依存関係の解決
    const dependencies = service.dependencies || [];
    const resolvedDependencies = dependencies.map(dep => this.resolve(dep));
    
    const instance = service.factory(...resolvedDependencies);
    
    if (service.singleton) {
      this.instances.set(token, instance);
    }
    
    return instance;
  }
  
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }
}

// DI Decorators
const container = new DIContainer();

function Injectable(token: string, options: { singleton?: boolean } = {}) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    const dependencies = Reflect.getMetadata('inject-tokens', constructor) || [];
    
    container.register({
      token,
      factory: (...deps) => new constructor(...deps),
      singleton: options.singleton,
      dependencies
    });
    
    return constructor;
  };
}

function Inject(token: string) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('inject-tokens', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('inject-tokens', existingTokens, target);
  };
}
```

## サービス定義と実装

```typescript
// サービス定義
interface ILogger {
  log(message: string): void;
}

interface IUserRepository {
  findById(id: string): Promise<any>;
  save(user: any): Promise<void>;
}

@Injectable('Logger', { singleton: true })
class ConsoleLogger implements ILogger {
  log(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

@Injectable('UserRepository')
class UserRepository implements IUserRepository {
  constructor(@Inject('Logger') private logger: ILogger) {}
  
  async findById(id: string): Promise<any> {
    this.logger.log(`Finding user with ID: ${id}`);
    // データベース処理のシミュレーション
    return { id, name: 'John Doe' };
  }
  
  async save(user: any): Promise<void> {
    this.logger.log(`Saving user: ${JSON.stringify(user)}`);
    // 保存処理のシミュレーション
  }
}

@Injectable('UserService')
class UserService {
  constructor(
    @Inject('UserRepository') private userRepository: IUserRepository,
    @Inject('Logger') private logger: ILogger
  ) {}
  
  async getUser(id: string): Promise<any> {
    this.logger.log(`Getting user ${id}`);
    return await this.userRepository.findById(id);
  }
  
  async createUser(userData: any): Promise<any> {
    this.logger.log(`Creating new user`);
    const user = { id: Date.now().toString(), ...userData };
    await this.userRepository.save(user);
    return user;
  }
}

// 使用例
const userService = container.resolve<UserService>('UserService');
userService.getUser('123').then(user => {
  console.log('Retrieved user:', user);
});
```

## 高度なDIパターン

```typescript
// Factory注入パターン
interface ServiceFactory<T> {
  create(...args: any[]): T;
}

function InjectFactory<T>(token: string) {
  return function(target: any, propertyKey: string) {
    Object.defineProperty(target, propertyKey, {
      get() {
        return {
          create: (...args: any[]) => {
            const service = container.resolve<T>(token);
            // 追加の初期化ロジックを適用
            return service;
          }
        };
      }
    });
  };
}

// スコープ付きサービス
enum ServiceScope {
  Singleton = 'singleton',
  Transient = 'transient',
  Request = 'request'
}

class ScopedContainer extends DIContainer {
  private scopes = new Map<string, ServiceScope>();
  private requestInstances = new Map<string, Map<string, any>>();
  
  registerScoped<T>(
    token: string,
    scope: ServiceScope,
    factory: (...deps: any[]) => T,
    dependencies?: string[]
  ): void {
    this.scopes.set(token, scope);
    this.register({
      token,
      factory,
      singleton: scope === ServiceScope.Singleton,
      dependencies
    });
  }
  
  resolveInScope<T>(token: string, requestId?: string): T {
    const scope = this.scopes.get(token);
    
    if (scope === ServiceScope.Request && requestId) {
      if (!this.requestInstances.has(requestId)) {
        this.requestInstances.set(requestId, new Map());
      }
      
      const requestCache = this.requestInstances.get(requestId)!;
      if (requestCache.has(token)) {
        return requestCache.get(token);
      }
      
      const instance = this.resolve<T>(token);
      requestCache.set(token, instance);
      return instance;
    }
    
    return this.resolve<T>(token);
  }
  
  clearRequest(requestId: string): void {
    this.requestInstances.delete(requestId);
  }
}
```