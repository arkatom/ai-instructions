# NestJS風のHTTP Framework

> 🎯 **目的**: NestJS風のフレームワーク機能をTypeScriptで実装
> 
> 📊 **対象**: Guards、Interceptors、Pipes、Exception Filters
> 
> ⚡ **特徴**: ミドルウェアチェーン、例外処理、バリデーション統合

## 基本インターフェース

```typescript
// NestJS風フレームワーク実装
interface ExecutionContext {
  getRequest<T = any>(): T;
  getResponse<T = any>(): T;
  getHandler(): Function;
  getClass(): any;
}

interface ArgumentsHost {
  getArgs(): any[];
  getArgByIndex<T = any>(index: number): T;
  switchToHttp(): {
    getRequest<T = any>(): T;
    getResponse<T = any>(): T;
  };
}

// Guard インターフェース
interface CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

// Interceptor インターフェース
interface NestInterceptor {
  intercept(context: ExecutionContext, next: { handle(): Promise<any> }): Promise<any>;
}

// Pipe インターフェース
interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata?: any): R;
}
```

## Exception クラス

```typescript
// カスタム例外クラス
class HttpException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}
```

## フレームワークデコレーター

```typescript
// フレームワークデコレーター
function Controller(prefix: string = '') {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    Reflect.defineMetadata('controller:prefix', prefix, constructor);
    return constructor;
  };
}

function UseGuards(...guards: (new() => CanActivate)[]) {
  return function(target: any, propertyKey?: string) {
    const key = propertyKey ? 'method:guards' : 'controller:guards';
    Reflect.defineMetadata(key, guards, propertyKey ? target : target.constructor, propertyKey);
  };
}

function UseInterceptors(...interceptors: (new() => NestInterceptor)[]) {
  return function(target: any, propertyKey?: string) {
    const key = propertyKey ? 'method:interceptors' : 'controller:interceptors';
    Reflect.defineMetadata(key, interceptors, propertyKey ? target : target.constructor, propertyKey);
  };
}

function UsePipes(...pipes: (new() => PipeTransform)[]) {
  return function(target: any, propertyKey?: string) {
    const key = propertyKey ? 'method:pipes' : 'controller:pipes';
    Reflect.defineMetadata(key, pipes, propertyKey ? target : target.constructor, propertyKey);
  };
}

// HTTPメソッドデコレーター
function createMethodDecorator(method: string) {
  return function(path: string = '') {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      Reflect.defineMetadata('route:method', method, target, propertyKey);
      Reflect.defineMetadata('route:path', path, target, propertyKey);
    };
  };
}

const Get = createMethodDecorator('GET');
const Post = createMethodDecorator('POST');
const Put = createMethodDecorator('PUT');
const Delete = createMethodDecorator('DELETE');
const Patch = createMethodDecorator('PATCH');

// パラメーターデコレーター
function Body(transform?: new() => PipeTransform) {
  return function(target: any, propertyKey: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'body', target, propertyKey);
    if (transform) {
      Reflect.defineMetadata(`param:${parameterIndex}:pipe`, transform, target, propertyKey);
    }
  };
}

function Param(name?: string, transform?: new() => PipeTransform) {
  return function(target: any, propertyKey: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'param', target, propertyKey);
    Reflect.defineMetadata(`param:${parameterIndex}:name`, name, target, propertyKey);
    if (transform) {
      Reflect.defineMetadata(`param:${parameterIndex}:pipe`, transform, target, propertyKey);
    }
  };
}

function Query(name?: string, transform?: new() => PipeTransform) {
  return function(target: any, propertyKey: string, parameterIndex: number) {
    Reflect.defineMetadata(`param:${parameterIndex}:type`, 'query', target, propertyKey);
    Reflect.defineMetadata(`param:${parameterIndex}:name`, name, target, propertyKey);
    if (transform) {
      Reflect.defineMetadata(`param:${parameterIndex}:pipe`, transform, target, propertyKey);
    }
  };
}
```

## Guards実装

```typescript
// 実装例：Guards
class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.getRequest();
    const authHeader = request.headers?.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    // トークン検証（簡略化）
    const token = authHeader.substring(7);
    return token === 'valid-token';
  }
}

class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.getRequest();
    const userRole = request.user?.role || 'guest';
    
    // 管理者のみアクセス可能とする例
    return userRole === 'admin';
  }
}
```

## Interceptors実装

```typescript
// 実装例：Interceptors
class LoggingInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext, 
    next: { handle(): Promise<any> }
  ): Promise<any> {
    const request = context.getRequest();
    const method = request.method;
    const url = request.url;
    
    console.log(`[${new Date().toISOString()}] ${method} ${url} - Start`);
    const startTime = Date.now();
    
    const result = await next.handle();
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${method} ${url} - End (${duration}ms)`);
    
    return result;
  }
}

class TransformResponseInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext, 
    next: { handle(): Promise<any> }
  ): Promise<any> {
    const result = await next.handle();
    
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
  }
}
```

## Pipes実装

```typescript
// 実装例：Pipes
class ValidationPipe implements PipeTransform {
  transform(value: any): any {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Invalid request body');
    }
    
    // 基本的なvalidation
    if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
      throw new BadRequestException('Invalid email format');
    }
    
    return value;
  }
}

class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException('Invalid integer value');
    }
    return parsed;
  }
}

// DTO例
class CreateUserDto {
  name: string;
  email: string;
  age: number;
  
  constructor(data: any) {
    this.name = data.name;
    this.email = data.email;
    this.age = data.age;
  }
}
```

## コントローラー実装

```typescript
// コントローラー実装例
@Controller('/api/users')
@UseInterceptors(LoggingInterceptor)
@UseGuards(AuthGuard)
class UsersController {
  
  @Get()
  @UseInterceptors(TransformResponseInterceptor)
  async getUsers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return Array.from({ length: limitNum }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`
    }));
  }
  
  @Get('/:id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    if (id < 1 || id > 1000) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`
    };
  }
  
  @Post()
  @UseGuards(RolesGuard)
  @UsePipes(ValidationPipe)
  async createUser(@Body() createUserDto: any) {
    // DTO変換
    const dto = new CreateUserDto(createUserDto);
    
    return {
      id: Date.now(),
      ...dto,
      createdAt: new Date().toISOString()
    };
  }
  
  @Put('/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: any
  ) {
    return {
      id,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
  }
  
  @Delete('/:id')
  @UseGuards(RolesGuard)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return {
      id,
      deleted: true,
      deletedAt: new Date().toISOString()
    };
  }
}
```

## アプリケーションブートストラップ

```typescript
// フレームワークエンジン（簡略版）
class NestApplication {
  private controllers: any[] = [];
  
  useGlobalInterceptors(...interceptors: NestInterceptor[]) {
    // グローバルインターセプター設定
  }
  
  useGlobalGuards(...guards: CanActivate[]) {
    // グローバルガード設定
  }
  
  useGlobalPipes(...pipes: PipeTransform[]) {
    // グローバルパイプ設定
  }
  
  controller(controllerClass: any) {
    this.controllers.push(controllerClass);
  }
  
  async listen(port: number) {
    console.log(`NestJS-like application listening on port ${port}`);
    
    // ルート解析とハンドラー生成
    this.controllers.forEach(ControllerClass => {
      this.registerController(ControllerClass);
    });
  }
  
  private registerController(ControllerClass: any) {
    const prefix = Reflect.getMetadata('controller:prefix', ControllerClass) || '';
    const instance = new ControllerClass();
    
    // メソッド走査
    const prototype = ControllerClass.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype)
      .filter(name => name !== 'constructor' && typeof prototype[name] === 'function');
    
    methodNames.forEach(methodName => {
      const httpMethod = Reflect.getMetadata('route:method', prototype, methodName);
      const path = Reflect.getMetadata('route:path', prototype, methodName);
      
      if (httpMethod && path !== undefined) {
        console.log(`Registered route: ${httpMethod} ${prefix}${path} -> ${ControllerClass.name}.${methodName}`);
      }
    });
  }
}

// アプリケーション使用例
async function bootstrap() {
  const app = new NestApplication();
  
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.controller(UsersController);
  
  await app.listen(3000);
}

bootstrap();
```