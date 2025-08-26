# HTTP Route Decorators

> 🎯 **目的**: Express/Koa風のHTTPルーティングをDecoratorで実装
> 
> 📊 **対象**: RESTful API構築、ミドルウェア統合、パラメータ解決
> 
> ⚡ **特徴**: 型安全なルート定義、自動パラメータマッピング、ミドルウェアチェーン

## メタデータストレージ

```typescript
// HTTP メソッドとルートメタデータ
interface RouteMetadata {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  middlewares: Function[];
  paramTypes: any[];
}

interface ControllerMetadata {
  prefix: string;
  routes: Map<string, RouteMetadata>;
  middlewares: Function[];
}

class RouteMetadataStorage {
  private static controllers = new Map<any, ControllerMetadata>();
  
  static getController(target: any): ControllerMetadata {
    if (!this.controllers.has(target)) {
      this.controllers.set(target, {
        prefix: '',
        routes: new Map(),
        middlewares: []
      });
    }
    return this.controllers.get(target)!;
  }
  
  static setRoute(target: any, methodName: string, route: RouteMetadata): void {
    const controller = this.getController(target);
    controller.routes.set(methodName, route);
  }
  
  static getAllControllers(): Map<any, ControllerMetadata> {
    return this.controllers;
  }
}
```

## HTTP Method Decorators

```typescript
// HTTP Decorators
function Controller(prefix: string = '') {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    const metadata = RouteMetadataStorage.getController(constructor);
    metadata.prefix = prefix;
    
    return constructor;
  };
}

function createMethodDecorator(method: RouteMetadata['method']) {
  return function(path: string = '') {
    return function(target: any, methodName: string, descriptor: PropertyDescriptor) {
      const paramTypes = Reflect.getMetadata('design:paramtypes', target, methodName) || [];
      
      RouteMetadataStorage.setRoute(target.constructor, methodName, {
        path,
        method,
        middlewares: [],
        paramTypes
      });
    };
  };
}

const Get = createMethodDecorator('GET');
const Post = createMethodDecorator('POST');
const Put = createMethodDecorator('PUT');
const Delete = createMethodDecorator('DELETE');
const Patch = createMethodDecorator('PATCH');

// Middleware Decorator
function UseMiddleware(...middlewares: Function[]) {
  return function(target: any, methodName?: string) {
    if (methodName) {
      // メソッドレベルミドルウェア
      const controller = RouteMetadataStorage.getController(target.constructor);
      const route = controller.routes.get(methodName);
      if (route) {
        route.middlewares.push(...middlewares);
      }
    } else {
      // コントローラーレベルミドルウェア
      const controller = RouteMetadataStorage.getController(target);
      controller.middlewares.push(...middlewares);
    }
  };
}
```

## Parameter Decorators

```typescript
// Parameter Decorators
function Body(target: any, methodName: string, parameterIndex: number) {
  Reflect.defineMetadata(`param:${parameterIndex}:type`, 'body', target, methodName);
}

function Param(name?: string) {
  return function(target: any, methodName: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'param', target, methodName);
    if (name) {
      Reflect.defineMetadata(`param:${parameterIndex}:name`, name, target, methodName);
    }
  };
}

function Query(name?: string) {
  return function(target: any, methodName: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'query', target, methodName);
    if (name) {
      Reflect.defineMetadata(`param:${parameterIndex}:name`, name, target, methodName);
    }
  };
}

// カスタムパラメータデコレータ
function Headers(name?: string) {
  return function(target: any, methodName: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'headers', target, methodName);
    if (name) {
      Reflect.defineMetadata(`param:${parameterIndex}:name`, name, target, methodName);
    }
  };
}

function CurrentUser(target: any, methodName: string, parameterIndex: number) {
  Reflect.defineMetadata(`param:${parameterIndex}:type`, 'user', target, methodName);
}
```

## Router実装

```typescript
// Express風のSimple Router実装
interface Request {
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  method: string;
  path: string;
  user?: any;
}

interface Response {
  status(code: number): Response;
  json(data: any): Response;
  send(data: any): Response;
}

class SimpleRouter {
  private routes: Array<{
    method: string;
    path: string;
    handler: Function;
    middlewares: Function[];
  }> = [];
  
  register(controllers: any[]): void {
    controllers.forEach(ControllerClass => {
      const instance = new ControllerClass();
      const metadata = RouteMetadataStorage.getController(ControllerClass);
      
      metadata.routes.forEach((route, methodName) => {
        const handler = (req: Request, res: Response) => {
          const args = this.resolveParameters(instance, methodName, req, res);
          return (instance as any)[methodName](...args);
        };
        
        this.routes.push({
          method: route.method,
          path: metadata.prefix + route.path,
          handler,
          middlewares: [...metadata.middlewares, ...route.middlewares]
        });
      });
    });
  }
  
  private resolveParameters(instance: any, methodName: string, req: Request, res: Response): any[] {
    const paramTypes = Reflect.getMetadata('design:paramtypes', instance.constructor.prototype, methodName) || [];
    const args: any[] = [];
    
    for (let i = 0; i < paramTypes.length; i++) {
      const paramType = Reflect.getMetadata(`param:${i}:type`, instance.constructor.prototype, methodName);
      const paramName = Reflect.getMetadata(`param:${i}:name`, instance.constructor.prototype, methodName);
      
      switch (paramType) {
        case 'body':
          args[i] = req.body;
          break;
        case 'param':
          args[i] = paramName ? req.params[paramName] : req.params;
          break;
        case 'query':
          args[i] = paramName ? req.query[paramName] : req.query;
          break;
        case 'headers':
          args[i] = paramName ? req.headers[paramName] : req.headers;
          break;
        case 'user':
          args[i] = req.user;
          break;
        default:
          // Request/Response型の推論
          if (paramTypes[i].name === 'Request' || i === paramTypes.length - 2) {
            args[i] = req;
          } else if (paramTypes[i].name === 'Response' || i === paramTypes.length - 1) {
            args[i] = res;
          }
      }
    }
    
    return args;
  }
  
  async handle(req: Request): Promise<void> {
    const route = this.routes.find(r => 
      r.method === req.method && 
      this.matchPath(r.path, req.path)
    );
    
    if (!route) {
      console.log(`404: Route not found for ${req.method} ${req.path}`);
      return;
    }
    
    const res = new MockResponse();
    
    try {
      // ミドルウェア実行
      for (const middleware of route.middlewares) {
        await middleware(req, res);
      }
      
      // ハンドラー実行
      await route.handler(req, res);
    } catch (error) {
      console.error('Route handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  private matchPath(routePath: string, requestPath: string): boolean {
    // 簡単なパスマッチング（:paramをサポート）
    const routeSegments = routePath.split('/');
    const pathSegments = requestPath.split('/');
    
    if (routeSegments.length !== pathSegments.length) {
      return false;
    }
    
    for (let i = 0; i < routeSegments.length; i++) {
      if (routeSegments[i].startsWith(':')) {
        // パラメーター部分はマッチ
        continue;
      }
      if (routeSegments[i] !== pathSegments[i]) {
        return false;
      }
    }
    
    return true;
  }
}

class MockResponse implements Response {
  private statusCode = 200;
  
  status(code: number): Response {
    this.statusCode = code;
    return this;
  }
  
  json(data: any): Response {
    console.log(`[${this.statusCode}] JSON Response:`, data);
    return this;
  }
  
  send(data: any): Response {
    console.log(`[${this.statusCode}] Response:`, data);
    return this;
  }
}
```

## Controller実装例

```typescript
// ミドルウェア例
function logMiddleware(req: Request, res: Response) {
  console.log(`${req.method} ${req.path}`);
}

function authMiddleware(req: Request, res: Response) {
  // 認証チェック
  req.user = { id: 1, name: 'AuthUser' };
  console.log('Auth check passed');
}

// Controller実装例
@Controller('/api/users')
@UseMiddleware(logMiddleware)
class UserController {
  @Get()
  async getAllUsers(@Query('limit') limit: string, @Query() query: any) {
    return {
      users: ['user1', 'user2'],
      limit: limit || 'no limit',
      query
    };
  }

  @Get('/:id')
  async getUserById(@Param('id') id: string) {
    return { id, name: `User ${id}` };
  }

  @Post()
  @UseMiddleware(authMiddleware)
  async createUser(@Body body: any, @CurrentUser user: any) {
    return { 
      created: true, 
      user: body,
      createdBy: user
    };
  }

  @Put('/:id')
  async updateUser(
    @Param('id') id: string, 
    @Body body: any,
    @Headers('authorization') auth: string
  ) {
    return { 
      id, 
      updated: true, 
      data: body,
      auth: auth ? 'provided' : 'missing'
    };
  }

  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    return { id, deleted: true };
  }
}

// ルーター使用例
const router = new SimpleRouter();
router.register([UserController]);

// リクエストのシミュレーション
const testRequests: Request[] = [
  { 
    method: 'GET', 
    path: '/api/users', 
    params: {}, 
    query: { limit: '10' }, 
    body: null,
    headers: {}
  },
  { 
    method: 'POST', 
    path: '/api/users', 
    params: {}, 
    query: {}, 
    body: { name: 'John' },
    headers: {}
  },
];

testRequests.forEach(req => {
  console.log(`\n=== Processing ${req.method} ${req.path} ===`);
  router.handle(req);
});
```