# NestJS 認証・セキュリティ

JWT認証、RBAC、セキュリティベストプラクティス。

## 🔐 JWT認証

### 認証サービス

```typescript
// auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService
  ) {}

  async login(credentials: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(credentials.email, credentials.password);
    
    const tokens = await this.generateTokens(user);
    
    // リフレッシュトークン保存
    await this.cacheManager.set(
      `refresh_token:${user.id}`,
      tokens.refreshToken,
      this.configService.get('JWT_REFRESH_EXPIRATION')
    );

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.configService.get('JWT_EXPIRATION')
    };
  }

  async refreshTokens(refreshToken: string): Promise<RefreshResult> {
    const payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.get('JWT_REFRESH_SECRET')
    });

    const cachedToken = await this.cacheManager.get(`refresh_token:${payload.sub}`);
    if (cachedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(payload.sub);
    const tokens = await this.generateTokens(user);

    // トークン更新
    await this.cacheManager.set(
      `refresh_token:${user.id}`,
      tokens.refreshToken,
      this.configService.get('JWT_REFRESH_EXPIRATION')
    );

    return tokens;
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION')
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION')
      })
    ]);

    return { accessToken, refreshToken };
  }
}
```

## 🛡️ ガード実装

### JWTガード

```typescript
// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }
}

// デコレーター
export const Public = () => SetMetadata('isPublic', true);
```

### ロールベースアクセス制御

```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}

// 使用例
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Post('users')
  @RequireRoles('admin')
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }
}
```

## 🔒 権限システム

```typescript
// permissions/permission.guard.ts
export interface Permission {
  resource: string;
  action: string;
  condition?: (user: User, resource: any) => boolean;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<Permission[]>('permissions', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!permissions) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    for (const permission of permissions) {
      const hasPermission = await this.permissionService.hasPermission(
        user,
        permission.resource,
        permission.action
      );

      if (!hasPermission) return false;

      // リソース固有の条件確認
      if (permission.condition) {
        const resource = await this.getResourceFromRequest(request, permission.resource);
        if (!permission.condition(user, resource)) return false;
      }
    }

    return true;
  }
}

// 使用例
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrderController {
  @Get(':id')
  @RequirePermissions({
    resource: 'order',
    action: 'read',
    condition: (user, order) => user.id === order.userId || user.isAdmin()
  })
  async getOrder(@Param('id') id: string) {
    return this.orderService.findById(id);
  }
}
```

## 🛡️ セキュリティミドルウェア

```typescript
// middleware/security.middleware.ts
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Helmet設定
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    
    // CORS設定は別途CorsOptionsで管理
    next();
  }
}

// レート制限
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = `rate_limit:${request.ip}`;
    
    const current = await this.cacheManager.get<number>(key) || 0;
    
    if (current >= 100) { // 100リクエスト/分
      throw new HttpException('Rate limit exceeded', 429);
    }
    
    await this.cacheManager.set(key, current + 1, 60);
    
    return true;
  }
}
```

## 🎯 ベストプラクティス

- **トークン管理**: アクセストークンとリフレッシュトークンの分離
- **ロール階層**: 柔軟な権限管理
- **セキュリティヘッダー**: XSS、CSRF対策
- **レート制限**: DDoS攻撃対策