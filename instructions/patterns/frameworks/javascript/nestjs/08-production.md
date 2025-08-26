# NestJS Production Optimization

## ⚡ Performance Optimization

### Caching Strategy
```typescript
// cache/cache.module.ts
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: 60, // seconds
        max: 100, // maximum items in cache
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}

// Service with caching
@Injectable()
export class ProductService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private productRepository: ProductRepository,
  ) {}

  async findAll(): Promise<Product[]> {
    const cacheKey = 'products:all';
    const cached = await this.cacheManager.get<Product[]>(cacheKey);
    
    if (cached) return cached;
    
    const products = await this.productRepository.find();
    await this.cacheManager.set(cacheKey, products, 300);
    
    return products;
  }

  @CacheEvict('products:*')
  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    // 要実装: キャッシュ無効化デコレーター
    return this.productRepository.update(id, dto);
  }
}
```

### Database Connection Pooling
```typescript
// database/database.config.ts
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  
  // Connection pool configuration
  extra: {
    max: 30, // Maximum connections
    min: 5,  // Minimum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Query optimization
  logging: process.env.NODE_ENV === 'development',
  cache: {
    duration: 30000, // 30 seconds
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
  },
};
```

## 📊 Monitoring & Logging

### Structured Logging
```typescript
// logging/winston.config.ts
import * as winston from 'winston';

export const winstonConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
};

// Custom logger service
@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger(winstonConfig);
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info(message, { context, ...meta });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
  }
}
```

### Health Checks
```typescript
// health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.checkDiskSpace(),
      () => this.checkMemoryUsage(),
    ]);
  }

  private async checkDiskSpace(): Promise<HealthIndicatorResult> {
    // 要実装: ディスク容量チェック
    const usage = await getDiskUsage();
    const isHealthy = usage.percentage < 90;
    
    return {
      disk: {
        status: isHealthy ? 'up' : 'down',
        usage: `${usage.percentage}%`,
      },
    };
  }
}
```

## 🚀 Deployment Configuration

### Docker Optimization
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
COPY package*.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main"]
```

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'nestjs-app',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true,
    
    // Auto-restart configuration
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
  }],
};
```

## 🔐 Security Hardening

### Production Security Middleware
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  
  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests
  }));
  
  // Compression
  app.use(compression());
  
  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });
  
  await app.listen(process.env.PORT || 3000);
}
```