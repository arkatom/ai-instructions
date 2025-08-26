# Angular風Dependency Injection

> 🎯 **目的**: Angular風のDIシステムをTypeScriptで実装
> 
> 📊 **対象**: InjectionToken、プロバイダーシステム、階層的インジェクター
> 
> ⚡ **特徴**: 型安全なトークン、循環依存検知、モジュールシステム

## InjectionTokenとプロバイダーシステム

```typescript
// Angular風DIシステム実装
interface InjectionToken<T> {
  description?: string;
  _type?: T;
}

function createInjectionToken<T>(description?: string): InjectionToken<T> {
  return { description };
}

// 組み込みトークン
const HTTP_CLIENT = createInjectionToken<IHttpClient>('HttpClient');
const CONFIG = createInjectionToken<IConfig>('Config');

interface IHttpClient {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data: any): Promise<T>;
}

interface IConfig {
  apiUrl: string;
  timeout: number;
}

// プロバイダーシステム
interface Provider<T = any> {
  provide: InjectionToken<T> | string;
  useClass?: new(...args: any[]) => T;
  useFactory?: (...args: any[]) => T;
  useValue?: T;
  deps?: (InjectionToken<any> | string)[];
}
```

## Injector実装

```typescript
class Injector {
  private providers = new Map<any, Provider>();
  private instances = new Map<any, any>();
  private resolutionStack = new Set<any>();
  
  static create(providers: Provider[]): Injector {
    const injector = new Injector();
    providers.forEach(provider => {
      injector.providers.set(provider.provide, provider);
    });
    return injector;
  }
  
  get<T>(token: InjectionToken<T> | string): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }
    
    if (this.resolutionStack.has(token)) {
      throw new Error(`Circular dependency detected: ${this.getTokenName(token)}`);
    }
    
    const provider = this.providers.get(token);
    if (!provider) {
      throw new Error(`No provider for ${this.getTokenName(token)}`);
    }
    
    this.resolutionStack.add(token);
    
    try {
      let instance: T;
      
      if (provider.useValue !== undefined) {
        instance = provider.useValue;
      } else if (provider.useFactory) {
        const deps = (provider.deps || []).map(dep => this.get(dep));
        instance = provider.useFactory(...deps);
      } else if (provider.useClass) {
        const deps = (provider.deps || []).map(dep => this.get(dep));
        instance = new provider.useClass(...deps);
      } else {
        throw new Error(`Invalid provider configuration for ${this.getTokenName(token)}`);
      }
      
      this.instances.set(token, instance);
      return instance;
    } finally {
      this.resolutionStack.delete(token);
    }
  }
  
  private getTokenName(token: any): string {
    if (typeof token === 'string') return token;
    return token.description || 'Unknown';
  }
}
```

## Angular風デコレーター

```typescript
// Angular風デコレーター
function Injectable(config: { providedIn?: 'root' | 'platform' | null } = {}) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    // メタデータにinjectableマークを付与
    Reflect.defineMetadata('injectable', true, constructor);
    if (config.providedIn === 'root') {
      Reflect.defineMetadata('providedIn', 'root', constructor);
    }
    return constructor;
  };
}

function Inject(token: InjectionToken<any> | string) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('inject-tokens', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('inject-tokens', existingTokens, target);
  };
}

function Component(config: { selector: string; template?: string }) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    Reflect.defineMetadata('component', config, constructor);
    return constructor;
  };
}

function NgModule(config: {
  declarations?: any[];
  imports?: any[];
  providers?: Provider[];
  bootstrap?: any[];
}) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    Reflect.defineMetadata('ngModule', config, constructor);
    return constructor;
  };
}
```

## サービス実装例

```typescript
// サービス実装例
@Injectable()
class HttpClient implements IHttpClient {
  constructor(@Inject(CONFIG) private config: IConfig) {}
  
  async get<T>(url: string): Promise<T> {
    const fullUrl = this.config.apiUrl + url;
    console.log(`GET ${fullUrl}`);
    
    // 実際のHTTPリクエストをシミュレート
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ data: 'mock response' } as T);
      }, 100);
    });
  }
  
  async post<T>(url: string, data: any): Promise<T> {
    const fullUrl = this.config.apiUrl + url;
    console.log(`POST ${fullUrl}`, data);
    
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ created: true, data } as T);
      }, 100);
    });
  }
}

@Injectable()
class UserService {
  constructor(@Inject(HTTP_CLIENT) private http: IHttpClient) {}
  
  async getUsers(): Promise<any[]> {
    return await this.http.get<any[]>('/users');
  }
  
  async createUser(userData: any): Promise<any> {
    return await this.http.post('/users', userData);
  }
}

@Injectable()
class DataService {
  constructor(
    @Inject(HTTP_CLIENT) private http: IHttpClient,
    private userService: UserService // トークンなしの場合はクラス自体をトークンとして使用
  ) {}
  
  async loadUserData(): Promise<void> {
    const users = await this.userService.getUsers();
    console.log('Loaded users:', users);
  }
}
```

## コンポーネントとモジュール

```typescript
// コンポーネント例
@Component({
  selector: 'app-user-list',
  template: '<div>User List Component</div>'
})
class UserListComponent {
  constructor(
    private userService: UserService,
    private dataService: DataService
  ) {}
  
  async ngOnInit() {
    await this.dataService.loadUserData();
  }
}

// モジュール定義
@NgModule({
  declarations: [UserListComponent],
  providers: [
    { provide: CONFIG, useValue: { apiUrl: 'https://api.example.com', timeout: 5000 } },
    { provide: HTTP_CLIENT, useClass: HttpClient, deps: [CONFIG] },
    { provide: UserService, useClass: UserService, deps: [HTTP_CLIENT] },
    { provide: DataService, useClass: DataService, deps: [HTTP_CLIENT, UserService] }
  ],
  bootstrap: [UserListComponent]
})
class AppModule {}

// ブートストラップ関数
function bootstrap(moduleClass: any) {
  const moduleConfig = Reflect.getMetadata('ngModule', moduleClass);
  if (!moduleConfig) {
    throw new Error('Invalid module');
  }
  
  const injector = Injector.create(moduleConfig.providers || []);
  
  // ブートストラップコンポーネントのインスタンス化
  moduleConfig.bootstrap?.forEach((ComponentClass: any) => {
    const component = createComponent(ComponentClass, injector);
    console.log(`Bootstrapped component: ${ComponentClass.name}`);
    
    // ngOnInitの呼び出し
    if (component.ngOnInit) {
      component.ngOnInit();
    }
  });
}

function createComponent(ComponentClass: any, injector: Injector): any {
  const paramTypes = Reflect.getMetadata('design:paramtypes', ComponentClass) || [];
  const injectTokens = Reflect.getMetadata('inject-tokens', ComponentClass) || [];
  
  const dependencies = paramTypes.map((paramType: any, index: number) => {
    const token = injectTokens[index] || paramType;
    return injector.get(token);
  });
  
  return new ComponentClass(...dependencies);
}

// 実行例
bootstrap(AppModule);
```