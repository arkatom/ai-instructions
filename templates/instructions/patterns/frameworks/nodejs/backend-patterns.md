# Node.js Backend Patterns

## Project Structure

### Modular Architecture
Organize code by feature, not by file type.

```
src/
├── features/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.middleware.ts
│   │   └── auth.test.ts
│   └── users/
│       ├── user.model.ts
│       ├── user.controller.ts
│       ├── user.service.ts
│       └── user.test.ts
├── shared/
│   ├── database/
│   ├── middleware/
│   └── utils/
└── app.ts
```

## Middleware Patterns

### Error Handling Middleware
Centralized error handling.

```typescript
// Good
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }
  
  // Log unexpected errors
  console.error('ERROR 💥', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong'
  });
};

// Usage
app.use(errorHandler);
```

### Async Handler Wrapper
Avoid try-catch in every route.

```typescript
// Good
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
}));

// Bad - repetitive try-catch
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});
```

## Authentication & Security

### JWT with Refresh Tokens
Secure token management.

```typescript
// Good
class AuthService {
  generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
  }
  
  async refreshAccessToken(refreshToken: string) {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const tokens = this.generateTokens(decoded.userId);
    
    // Store new refresh token in database
    await RefreshToken.create({
      token: tokens.refreshToken,
      userId: decoded.userId
    });
    
    return tokens;
  }
}
```

### Security Headers
Use helmet for security headers.

```typescript
// Good
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(cors({ 
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true 
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

## Database Patterns

### Connection Pool Management
Efficient database connections.

```typescript
// Good - Single connection pool
import { Pool } from 'pg';

class Database {
  private static pool: Pool;
  
  static getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return this.pool;
  }
  
  static async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed', { text, duration, rows: res.rowCount });
    return res;
  }
}
```

### Repository Pattern
Abstract database operations.

```typescript
// Good
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    const { rows } = await Database.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }
  
  async create(data: Partial<User>): Promise<User> {
    const { rows } = await Database.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [data.name, data.email]
    );
    return rows[0];
  }
}
```

## Validation

### Schema Validation
Use Joi or Zod for input validation.

```typescript
// Good - Zod validation
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().min(18).optional()
});

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ errors: error.errors });
      }
    }
  };
};

// Usage
router.post('/users', 
  validateRequest(createUserSchema),
  asyncHandler(userController.create)
);
```

## Logging

### Structured Logging
Use Winston or Pino for production logging.

```typescript
// Good
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage with request context
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  logger.info('Request received', {
    requestId: req.requestId,
    method: req.method,
    url: req.url
  });
  next();
});
```

## Best Practices Checklist

- [ ] Use environment variables for configuration
- [ ] Implement graceful shutdown
- [ ] Use compression middleware
- [ ] Implement health check endpoints
- [ ] Use process manager (PM2) in production
- [ ] Implement request validation
- [ ] Use async/await instead of callbacks
- [ ] Handle unhandled promise rejections
- [ ] Use connection pooling for databases
- [ ] Implement proper logging
- [ ] Use rate limiting
- [ ] Sanitize user inputs