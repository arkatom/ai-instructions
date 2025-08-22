# Authentication & Authorization

> 🎯 **目的**: API Gatewayにおける認証・認可システムの実装
> 
> 📊 **対象**: JWT認証、OAuth2、API Key、ロールベースアクセス制御
> 
> ⚡ **特徴**: トークン検証、権限管理、セキュアな実装パターン

## JWT Authentication Middleware

```typescript
// src/gateway/middleware/Authenticator.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { Redis } from 'ioredis';

export interface AuthConfig {
  provider: 'jwt' | 'oauth2' | 'apikey';
  jwksUri?: string;
  issuer?: string;
  audience?: string;
  algorithms?: string[];
  publicKey?: string;
  secretKey?: string;
}

export interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

export class Authenticator {
  private jwksClient?: jwksRsa.JwksClient;
  private redis: Redis;
  private tokenBlacklist: Set<string> = new Set();

  constructor(private config: AuthConfig) {
    if (config.provider === 'jwt' && config.jwksUri) {
      this.jwksClient = jwksRsa({
        jwksUri: config.jwksUri,
        cache: true,
        cacheMaxAge: 600000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10
      });
    }
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }

  authenticate(options?: AuthOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No authentication token provided'
          });
        }

        // Check token blacklist
        if (await this.isTokenBlacklisted(token)) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has been revoked'
          });
        }

        // Verify token based on provider
        let user: User;
        
        switch (this.config.provider) {
          case 'jwt':
            user = await this.verifyJWT(token);
            break;
          case 'oauth2':
            user = await this.verifyOAuth2(token);
            break;
          case 'apikey':
            user = await this.verifyAPIKey(token);
            break;
          default:
            throw new Error('Unsupported authentication provider');
        }

        // Check permissions if required
        if (options?.requiredPermissions) {
          const hasPermission = options.requiredPermissions.some(
            perm => user.permissions.includes(perm)
          );
          
          if (!hasPermission) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Insufficient permissions'
            });
          }
        }

        // Check roles if required
        if (options?.requiredRoles) {
          const hasRole = options.requiredRoles.some(
            role => user.roles.includes(role)
          );
          
          if (!hasRole) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Insufficient role privileges'
            });
          }
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        
        next();
      } catch (error: any) {
        console.error('Authentication error:', error);
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has expired'
          });
        }
        
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
          });
        }
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed'
        });
      }
    };
  }

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    // Check cookie
    if (req.cookies?.token) {
      return req.cookies.token;
    }

    // Check query parameter (for WebSocket connections)
    if (req.query.token) {
      return req.query.token as string;
    }

    return null;
  }

  private async verifyJWT(token: string): Promise<User> {
    return new Promise((resolve, reject) => {
      const verifyOptions: jwt.VerifyOptions = {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: this.config.algorithms as jwt.Algorithm[]
      };

      const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
        if (this.jwksClient) {
          this.jwksClient.getSigningKey(header.kid!, (err, key) => {
            if (err) {
              return callback(err);
            }
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
          });
        } else if (this.config.publicKey) {
          callback(null, this.config.publicKey);
        } else if (this.config.secretKey) {
          callback(null, this.config.secretKey);
        } else {
          callback(new Error('No key configuration found'));
        }
      };

      jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
        if (err) {
          return reject(err);
        }

        const payload = decoded as any;
        const user: User = {
          id: payload.sub || payload.user_id,
          email: payload.email,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
          tenantId: payload.tenant_id
        };

        resolve(user);
      });
    });
  }

  private async verifyOAuth2(token: string): Promise<User> {
    // Validate token with OAuth2 provider
    const response = await fetch(`${this.config.oauth2Provider}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Invalid OAuth2 token');
    }

    const userInfo = await response.json();
    
    return {
      id: userInfo.sub,
      email: userInfo.email,
      roles: userInfo.roles || [],
      permissions: userInfo.permissions || [],
      tenantId: userInfo.tenant_id
    };
  }

  private async verifyAPIKey(apiKey: string): Promise<User> {
    // Look up API key in database or cache
    const keyData = await this.redis.get(`apikey:${apiKey}`);
    
    if (!keyData) {
      throw new Error('Invalid API key');
    }

    return JSON.parse(keyData);
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await this.redis.get(`blacklist:${token}`);
    return blacklisted !== null;
  }

  public async revokeToken(token: string, ttl: number = 3600): Promise<void> {
    await this.redis.setex(`blacklist:${token}`, ttl, '1');
    this.tokenBlacklist.add(token);
  }
}

interface AuthOptions {
  requiredPermissions?: string[];
  requiredRoles?: string[];
}
```

## OAuth2 Integration

```typescript
// src/gateway/auth/OAuth2Provider.ts
import { AuthorizationCode } from 'simple-oauth2';

export class OAuth2Provider {
  private client: AuthorizationCode;
  
  constructor(private config: OAuth2Config) {
    this.client = new AuthorizationCode({
      client: {
        id: config.clientId,
        secret: config.clientSecret
      },
      auth: {
        tokenHost: config.tokenHost,
        tokenPath: config.tokenPath,
        authorizePath: config.authorizePath
      }
    });
  }
  
  getAuthorizationUrl(scopes: string[], state?: string): string {
    return this.client.authorizeURL({
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state
    });
  }
  
  async exchangeCodeForToken(code: string): Promise<AccessToken> {
    const tokenParams = {
      code,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' ')
    };
    
    try {
      const accessToken = await this.client.getToken(tokenParams);
      return accessToken.token;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }
  
  async refreshToken(refreshToken: string): Promise<AccessToken> {
    try {
      const tokenObject = this.client.createToken({
        refresh_token: refreshToken
      });
      
      const refreshedToken = await tokenObject.refresh();
      return refreshedToken.token;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
  
  async introspectToken(token: string): Promise<TokenIntrospection> {
    const response = await fetch(`${this.config.tokenHost}/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({ token })
    });
    
    if (!response.ok) {
      throw new Error('Token introspection failed');
    }
    
    return response.json();
  }
}

interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenHost: string;
  tokenPath: string;
  authorizePath: string;
  redirectUri: string;
  scopes: string[];
}
```

## Role-Based Access Control (RBAC)

```typescript
// src/gateway/auth/RoleManager.ts
export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  inherited?: string[];
}

export class RoleManager {
  private roles: Map<string, Role> = new Map();
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
    
    this.loadRoles();
  }
  
  private async loadRoles(): Promise<void> {
    // Load roles from database or configuration
    const defaultRoles: Role[] = [
      {
        name: 'admin',
        permissions: [
          { action: '*', resource: '*' }
        ]
      },
      {
        name: 'user',
        permissions: [
          { action: 'read', resource: 'profile' },
          { action: 'update', resource: 'profile' },
          { action: 'read', resource: 'orders' },
          { action: 'create', resource: 'orders' }
        ]
      },
      {
        name: 'guest',
        permissions: [
          { action: 'read', resource: 'public' }
        ]
      }
    ];
    
    defaultRoles.forEach(role => {
      this.roles.set(role.name, role);
    });
  }
  
  hasPermission(
    userRoles: string[], 
    action: string, 
    resource: string,
    context?: Record<string, any>
  ): boolean {
    for (const roleName of userRoles) {
      const role = this.roles.get(roleName);
      if (!role) continue;
      
      const allPermissions = this.getAllPermissions(role);
      
      for (const permission of allPermissions) {
        if (this.matchesPermission(permission, action, resource, context)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  private getAllPermissions(role: Role): Permission[] {
    const permissions = [...role.permissions];
    
    // Include inherited permissions
    if (role.inherited) {
      for (const inheritedRoleName of role.inherited) {
        const inheritedRole = this.roles.get(inheritedRoleName);
        if (inheritedRole) {
          permissions.push(...this.getAllPermissions(inheritedRole));
        }
      }
    }
    
    return permissions;
  }
  
  private matchesPermission(
    permission: Permission,
    action: string,
    resource: string,
    context?: Record<string, any>
  ): boolean {
    // Check action
    if (permission.action !== '*' && permission.action !== action) {
      return false;
    }
    
    // Check resource
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }
    
    // Check conditions
    if (permission.conditions && context) {
      for (const [key, value] of Object.entries(permission.conditions)) {
        if (context[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  middleware(requiredAction: string, requiredResource: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      const hasPermission = this.hasPermission(
        req.user.roles,
        requiredAction,
        requiredResource,
        {
          userId: req.user.id,
          tenantId: req.user.tenantId,
          ...req.query,
          ...req.params
        }
      );
      
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions for ${requiredAction} on ${requiredResource}`
        });
      }
      
      next();
    };
  }
}
```

## API Key Management

```typescript
// src/gateway/auth/ApiKeyManager.ts
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  scopes: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
  expiresAt?: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

export class ApiKeyManager {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }
  
  generateApiKey(): string {
    const prefix = 'ak_';
    const randomBytes = crypto.randomBytes(32);
    const key = prefix + randomBytes.toString('hex');
    return key;
  }
  
  async createApiKey(
    userId: string,
    name: string,
    scopes: string[],
    options?: {
      rateLimit?: { requests: number; window: number };
      expiresAt?: Date;
    }
  ): Promise<ApiKey> {
    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      key: this.generateApiKey(),
      name,
      userId,
      scopes,
      rateLimit: options?.rateLimit,
      expiresAt: options?.expiresAt,
      createdAt: new Date(),
      isActive: true
    };
    
    // Store in Redis
    await this.redis.setex(
      `apikey:${apiKey.key}`,
      options?.expiresAt ? 
        Math.floor((options.expiresAt.getTime() - Date.now()) / 1000) : 
        60 * 60 * 24 * 365, // 1 year default
      JSON.stringify(apiKey)
    );
    
    return apiKey;
  }
  
  async validateApiKey(key: string): Promise<ApiKey | null> {
    const data = await this.redis.get(`apikey:${key}`);
    
    if (!data) {
      return null;
    }
    
    const apiKey: ApiKey = JSON.parse(data);
    
    // Check if expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      await this.revokeApiKey(key);
      return null;
    }
    
    // Check if active
    if (!apiKey.isActive) {
      return null;
    }
    
    // Update last used timestamp
    apiKey.lastUsedAt = new Date();
    await this.redis.setex(
      `apikey:${key}`,
      apiKey.expiresAt ? 
        Math.floor((apiKey.expiresAt.getTime() - Date.now()) / 1000) : 
        60 * 60 * 24 * 365,
      JSON.stringify(apiKey)
    );
    
    return apiKey;
  }
  
  async revokeApiKey(key: string): Promise<void> {
    await this.redis.del(`apikey:${key}`);
  }
  
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required'
        });
      }
      
      const keyData = await this.validateApiKey(apiKey);
      
      if (!keyData) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired API key'
        });
      }
      
      // Attach API key data to request
      req.apiKey = keyData;
      
      next();
    };
  }
}
```