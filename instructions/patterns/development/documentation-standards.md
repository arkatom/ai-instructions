# Documentation Standards

## Core Principles

### Documentation Philosophy
```yaml
documentation_fundamentals:
  purpose:
    - Knowledge preservation
    - Onboarding acceleration  
    - Maintenance guidance
    - API reference
    - Decision rationale
    
  principles:
    - Write for your future self
    - Document why, not just what
    - Keep it close to code
    - Maintain accuracy
    - Optimize for searchability
    
  audience_types:
    - End users
    - Developers
    - DevOps engineers
    - Stakeholders
    - Future maintainers
```

## README Documentation

### Professional README Template
```markdown
# Project Name

[![Build Status](https://img.shields.io/github/workflow/status/username/repo/CI)](https://github.com/username/repo/actions)
[![Coverage](https://img.shields.io/codecov/c/github/username/repo)](https://codecov.io/gh/username/repo)
[![License](https://img.shields.io/github/license/username/repo)](LICENSE)
[![Version](https://img.shields.io/npm/v/package-name)](https://www.npmjs.com/package/package-name)
[![Downloads](https://img.shields.io/npm/dm/package-name)](https://www.npmjs.com/package/package-name)

> Brief, compelling description of what this project does and why it exists.

## 🚀 Features

- ✨ Feature 1: Brief description
- 🎯 Feature 2: Brief description  
- 🔧 Feature 3: Brief description
- 📊 Feature 4: Brief description

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 7.0

### Package Installation

```bash
# Using npm
npm install package-name

# Using yarn
yarn add package-name

# Using pnpm
pnpm add package-name
```

### From Source

```bash
# Clone the repository
git clone https://github.com/username/repo.git
cd repo

# Install dependencies
npm install

# Build the project
npm run build
```

## 🎯 Quick Start

Get up and running in less than 5 minutes:

```typescript
import { Application } from 'package-name';

const app = new Application({
  apiKey: 'your-api-key',
  environment: 'production'
});

await app.initialize();

// Your first API call
const result = await app.doSomething({
  param1: 'value1',
  param2: 'value2'
});

console.log(result);
```

## 💻 Usage

### Basic Usage

```typescript
// Example 1: Simple use case
const client = new Client();
const response = await client.fetch('/api/resource');
```

### Advanced Usage

```typescript
// Example 2: Complex configuration
const client = new Client({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  retry: {
    attempts: 3,
    delay: 1000
  },
  interceptors: {
    request: (config) => {
      // Modify request
      return config;
    },
    response: (response) => {
      // Process response
      return response;
    }
  }
});
```

### Error Handling

```typescript
try {
  const result = await client.operation();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 📚 API Reference

See the [full API documentation](https://docs.example.com/api) for detailed information.

### Core Classes

#### `Application`

The main application class.

##### Constructor

```typescript
new Application(config: ApplicationConfig)
```

##### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize()` | Initialize the application | `Promise<void>` |
| `shutdown()` | Gracefully shutdown | `Promise<void>` |
| `getStatus()` | Get application status | `Status` |

### Interfaces

#### `ApplicationConfig`

```typescript
interface ApplicationConfig {
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  options?: {
    timeout?: number;
    retryAttempts?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d

# External Services
API_KEY=your-api-key
WEBHOOK_SECRET=webhook-secret
```

### Configuration File

```yaml
# config.yaml
app:
  name: MyApplication
  version: 1.0.0
  
server:
  port: 3000
  host: 0.0.0.0
  
database:
  host: localhost
  port: 5432
  name: myapp
  pool:
    min: 2
    max: 10
    
cache:
  ttl: 3600
  max: 1000
```

## 🔧 Development

### Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/username/repo.git
cd repo

# Install dependencies
npm install

# Set up pre-commit hooks
npm run prepare

# Start development server
npm run dev
```

### Project Structure

```
project/
├── src/                  # Source code
│   ├── controllers/      # Request handlers
│   ├── services/        # Business logic
│   ├── models/          # Data models
│   ├── utils/           # Utilities
│   └── index.ts         # Entry point
├── tests/               # Test files
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/           # End-to-end tests
├── docs/               # Documentation
├── scripts/            # Build/deploy scripts
└── config/            # Configuration files
```

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Writing Tests

```typescript
// Example test
describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const user = await service.createUser({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });
  });
});
```

## 🚀 Deployment

### Docker

```bash
# Build Docker image
docker build -t myapp:latest .

# Run container
docker run -p 3000:3000 myapp:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl rollout status deployment/myapp
```

### Cloud Platforms

#### AWS

```bash
# Deploy to AWS Lambda
npm run deploy:aws
```

#### Google Cloud

```bash
# Deploy to Cloud Run
gcloud run deploy myapp --source .
```

#### Azure

```bash
# Deploy to Azure Functions
func azure functionapp publish myapp
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors
- Inspired by [project-name]
- Built with [technology-stack]

## 📞 Support

- 📧 Email: support@example.com
- 💬 Discord: [Join our server](https://discord.gg/example)
- 🐛 Issues: [GitHub Issues](https://github.com/username/repo/issues)
- 📖 Docs: [Documentation](https://docs.example.com)

---

Made with ❤️ by [Your Name](https://github.com/username)
```

## API Documentation

### OpenAPI/Swagger Documentation
```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: API Documentation
  description: |
    Complete API documentation for the service.
    
    ## Authentication
    All API requests require authentication using Bearer tokens.
    
    ## Rate Limiting
    API requests are limited to 1000 requests per hour per API key.
    
    ## Versioning
    The API uses URL versioning (e.g., /v1/, /v2/).
  version: 1.0.0
  contact:
    name: API Support
    email: api@example.com
    url: https://support.example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server
  - url: http://localhost:3000/v1
    description: Development server

security:
  - BearerAuth: []
  - ApiKeyAuth: []

tags:
  - name: Authentication
    description: Authentication endpoints
  - name: Users
    description: User management
  - name: Resources
    description: Resource operations

paths:
  /auth/login:
    post:
      tags:
        - Authentication
      summary: User login
      description: Authenticate user and receive access token
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
            examples:
              valid:
                value:
                  email: user@example.com
                  password: SecurePassword123!
      responses:
        '200':
          description: Successful authentication
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimitExceeded'

  /users:
    get:
      tags:
        - Users
      summary: List users
      description: Get paginated list of users
      operationId: listUsers
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/SortParam'
        - name: filter
          in: query
          description: Filter expression
          schema:
            type: string
            example: status:active
      responses:
        '200':
          description: User list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          description: User email address
        password:
          type: string
          format: password
          minLength: 8
          description: User password

    LoginResponse:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT access token
        refreshToken:
          type: string
          description: JWT refresh token
        expiresIn:
          type: integer
          description: Token expiry time in seconds
        user:
          $ref: '#/components/schemas/User'

    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        role:
          type: string
          enum: [admin, user, guest]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    UserList:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/User'
        meta:
          $ref: '#/components/schemas/PaginationMeta'

    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer
        totalPages:
          type: integer

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
        timestamp:
          type: string
          format: date-time

  parameters:
    PageParam:
      name: page
      in: query
      description: Page number
      schema:
        type: integer
        minimum: 1
        default: 1

    LimitParam:
      name: limit
      in: query
      description: Items per page
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

    SortParam:
      name: sort
      in: query
      description: Sort field and order
      schema:
        type: string
        pattern: '^[a-zA-Z_]+:(asc|desc)$'
        example: createdAt:desc

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    RateLimitExceeded:
      description: Rate limit exceeded
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
        X-RateLimit-Remaining:
          schema:
            type: integer
        X-RateLimit-Reset:
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
```

## Code Documentation

### JSDoc/TSDoc Standards
```typescript
/**
 * Represents a user in the system.
 * 
 * @remarks
 * This class handles user authentication, authorization, and profile management.
 * It implements the {@link IUser} interface and extends {@link BaseEntity}.
 * 
 * @example
 * ```typescript
 * const user = new User({
 *   email: 'john@example.com',
 *   name: 'John Doe'
 * });
 * await user.save();
 * ```
 * 
 * @public
 */
export class User extends BaseEntity implements IUser {
  /**
   * User's email address
   * @readonly
   */
  public readonly email: string;

  /**
   * User's full name
   */
  public name: string;

  /**
   * User's hashed password
   * @internal
   */
  private passwordHash: string;

  /**
   * Creates a new User instance.
   * 
   * @param data - User initialization data
   * @throws {@link ValidationError} If email is invalid
   * @throws {@link DuplicateError} If email already exists
   */
  constructor(data: UserData) {
    super();
    this.validate(data);
    this.email = data.email;
    this.name = data.name;
  }

  /**
   * Authenticates a user with email and password.
   * 
   * @param email - User's email address
   * @param password - Plain text password
   * @returns Authenticated user or null
   * 
   * @example
   * ```typescript
   * const user = await User.authenticate('john@example.com', 'password123');
   * if (user) {
   *   console.log('Login successful');
   * }
   * ```
   * 
   * @public
   * @static
   * @async
   */
  public static async authenticate(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Updates the user's password.
   * 
   * @param newPassword - The new password
   * @returns Promise that resolves when password is updated
   * 
   * @throws {@link ValidationError} If password doesn't meet requirements
   * @throws {@link DatabaseError} If update fails
   * 
   * @see {@link PasswordPolicy} for password requirements
   * 
   * @beta
   */
  public async updatePassword(newPassword: string): Promise<void> {
    this.validatePassword(newPassword);
    this.passwordHash = await this.hashPassword(newPassword);
    await this.save();
  }

  /**
   * Gets the user's role.
   * 
   * @deprecated Use {@link User.permissions} instead
   * @returns User's role
   */
  public getRole(): UserRole {
    return this.role;
  }

  /**
   * Validates user data.
   * 
   * @param data - Data to validate
   * @throws {@link ValidationError} If validation fails
   * 
   * @internal
   */
  private validate(data: UserData): void {
    if (!this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }
    if (!data.name || data.name.length < 2) {
      throw new ValidationError('Name must be at least 2 characters');
    }
  }
}

/**
 * User initialization data
 * 
 * @public
 */
export interface UserData {
  /** User's email address */
  email: string;
  /** User's full name */
  name: string;
  /** Optional user role */
  role?: UserRole;
}

/**
 * Available user roles
 * 
 * @public
 */
export enum UserRole {
  /** Administrator with full access */
  Admin = 'admin',
  /** Regular user with limited access */
  User = 'user',
  /** Guest with read-only access */
  Guest = 'guest'
}
```

### Python Docstring Standards
```python
"""
Module for user management functionality.

This module provides classes and functions for user authentication,
authorization, and profile management.

Examples:
    Basic usage::

        from users import User
        
        user = User(email='john@example.com', name='John Doe')
        user.save()

Attributes:
    DEFAULT_ROLE (str): Default role assigned to new users
    PASSWORD_MIN_LENGTH (int): Minimum password length

"""

from typing import Optional, List, Dict, Any
from datetime import datetime
import bcrypt


class User:
    """
    Represents a user in the system.
    
    This class handles user authentication, authorization, and profile
    management. It provides methods for password management, role assignment,
    and profile updates.
    
    Attributes:
        email (str): User's email address (read-only)
        name (str): User's full name
        role (UserRole): User's role in the system
        created_at (datetime): Account creation timestamp
        updated_at (datetime): Last update timestamp
    
    Args:
        email (str): User's email address
        name (str): User's full name
        password (str, optional): User's password
        role (UserRole, optional): User's role. Defaults to UserRole.USER
    
    Raises:
        ValidationError: If email format is invalid
        DuplicateError: If email already exists in the system
    
    Example:
        >>> user = User(
        ...     email='john@example.com',
        ...     name='John Doe',
        ...     password='SecurePass123!'
        ... )
        >>> user.save()
        >>> print(user.id)
        'user_123abc'
    
    Note:
        Passwords are automatically hashed using bcrypt before storage.
        
    See Also:
        :class:`UserRole`: Available user roles
        :class:`UserProfile`: Extended user profile information
    
    .. versionadded:: 1.0.0
    .. versionchanged:: 1.2.0
       Added support for OAuth authentication
    
    """
    
    def __init__(
        self,
        email: str,
        name: str,
        password: Optional[str] = None,
        role: Optional['UserRole'] = None
    ) -> None:
        """Initialize a new User instance."""
        self._validate_email(email)
        self.email = email
        self.name = name
        self.role = role or UserRole.USER
        self._password_hash = self._hash_password(password) if password else None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    @classmethod
    def authenticate(
        cls,
        email: str,
        password: str
    ) -> Optional['User']:
        """
        Authenticate a user with email and password.
        
        This method verifies the user's credentials and returns the
        authenticated user object if successful.
        
        Args:
            email (str): User's email address
            password (str): Plain text password to verify
        
        Returns:
            Optional[User]: Authenticated user object if successful,
                None otherwise
        
        Raises:
            DatabaseError: If database connection fails
        
        Example:
            >>> user = User.authenticate('john@example.com', 'password')
            >>> if user:
            ...     print(f"Welcome back, {user.name}!")
        
        Warning:
            This method performs a database query. Consider using
            caching for frequently authenticated users.
        
        .. deprecated:: 2.0.0
           Use :meth:`authenticate_with_token` for API authentication
        
        """
        user = cls._find_by_email(email)
        if not user:
            return None
        
        if bcrypt.checkpw(
            password.encode('utf-8'),
            user._password_hash
        ):
            return user
        return None
    
    def update_password(self, new_password: str) -> None:
        """
        Update the user's password.
        
        Args:
            new_password (str): The new password to set
        
        Returns:
            None
        
        Raises:
            ValidationError: If password doesn't meet requirements:
                
                - Minimum 8 characters
                - At least one uppercase letter
                - At least one lowercase letter
                - At least one digit
                - At least one special character
        
        Example:
            >>> user.update_password('NewSecurePass123!')
        
        """
        self._validate_password(new_password)
        self._password_hash = self._hash_password(new_password)
        self.updated_at = datetime.utcnow()
        self.save()
    
    def has_permission(self, permission: str) -> bool:
        """
        Check if user has a specific permission.
        
        Parameters:
            permission : str
                The permission to check
        
        Returns:
            bool
                True if user has the permission, False otherwise
        
        """
        return permission in self.role.permissions
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert user object to dictionary representation.
        
        Returns:
            Dict[str, Any]: Dictionary containing user data::
            
                {
                    'id': 'user_123',
                    'email': 'john@example.com',
                    'name': 'John Doe',
                    'role': 'user',
                    'created_at': '2024-01-01T00:00:00Z',
                    'updated_at': '2024-01-01T00:00:00Z'
                }
        
        """
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role.value,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def _validate_email(self, email: str) -> None:
        """Validate email format (internal use only)."""
        # Implementation details...
        pass
    
    def _hash_password(self, password: str) -> bytes:
        """Hash password using bcrypt (internal use only)."""
        # Implementation details...
        pass


def create_user(
    email: str,
    name: str,
    **kwargs: Any
) -> User:
    """
    Factory function to create a new user.
    
    This is a convenience function that creates and saves a new user
    in a single operation.
    
    Args:
        email (str): User's email address
        name (str): User's full name
        **kwargs: Additional user attributes
            password (str, optional): User's password
            role (UserRole, optional): User's role
            send_welcome_email (bool, optional): Send welcome email.
                Defaults to True.
    
    Returns:
        User: Newly created user object
    
    Raises:
        ValidationError: If user data is invalid
        DatabaseError: If save operation fails
    
    Examples:
        Basic usage::
        
            user = create_user(
                email='john@example.com',
                name='John Doe'
            )
        
        With additional options::
        
            user = create_user(
                email='admin@example.com',
                name='Admin User',
                role=UserRole.ADMIN,
                send_welcome_email=False
            )
    
    .. seealso::
       :func:`bulk_create_users` for creating multiple users
       :class:`User` for more details on user objects
    
    """
    send_welcome = kwargs.pop('send_welcome_email', True)
    
    user = User(email=email, name=name, **kwargs)
    user.save()
    
    if send_welcome:
        send_welcome_email(user)
    
    return user
```

## Architecture Documentation

### Architecture Decision Records (ADR)
```markdown
# ADR-001: Use Microservices Architecture

## Status
Accepted

## Context
Our monolithic application is becoming difficult to scale and deploy. Different components have different scaling requirements, and the single codebase is becoming hard to maintain with multiple teams.

## Decision
We will migrate to a microservices architecture, breaking the monolith into the following services:
- User Service: Authentication and user management
- Order Service: Order processing and management
- Inventory Service: Product catalog and inventory
- Payment Service: Payment processing
- Notification Service: Email/SMS notifications

## Consequences

### Positive
- Independent deployment and scaling of services
- Technology diversity (can use different tech stacks)
- Fault isolation (one service failure doesn't affect others)
- Team autonomy (teams can work independently)

### Negative
- Increased operational complexity
- Network latency between services
- Data consistency challenges
- Need for service discovery and orchestration

### Risks
- Distributed system complexity
- Eventual consistency issues
- Increased monitoring requirements

## Mitigation
- Implement comprehensive logging and tracing
- Use API gateway for routing
- Implement circuit breakers for resilience
- Use event sourcing for data consistency

## References
- Martin Fowler's Microservices article
- "Building Microservices" by Sam Newman
- Internal scaling requirements document
```

### System Design Documentation
```markdown
# System Architecture

## Overview
This document describes the high-level architecture of our e-commerce platform.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App]
        MOB[Mobile App]
        API_CLIENT[API Clients]
    end
    
    subgraph "Gateway Layer"
        AG[API Gateway]
        LB[Load Balancer]
    end
    
    subgraph "Service Layer"
        US[User Service]
        OS[Order Service]
        IS[Inventory Service]
        PS[Payment Service]
        NS[Notification Service]
    end
    
    subgraph "Data Layer"
        UDB[(User DB)]
        ODB[(Order DB)]
        IDB[(Inventory DB)]
        CACHE[(Redis Cache)]
        MQ[Message Queue]
    end
    
    subgraph "External Services"
        PAYMENT[Payment Gateway]
        EMAIL[Email Service]
        SMS[SMS Service]
    end
    
    WEB --> LB
    MOB --> LB
    API_CLIENT --> LB
    LB --> AG
    
    AG --> US
    AG --> OS
    AG --> IS
    AG --> PS
    AG --> NS
    
    US --> UDB
    US --> CACHE
    OS --> ODB
    OS --> MQ
    IS --> IDB
    IS --> CACHE
    PS --> PAYMENT
    NS --> EMAIL
    NS --> SMS
    NS --> MQ
```

## Component Descriptions

### API Gateway
- **Purpose**: Single entry point for all client requests
- **Technology**: Kong Gateway
- **Responsibilities**:
  - Request routing
  - Authentication/Authorization
  - Rate limiting
  - Request/Response transformation
  - Circuit breaking

### User Service
- **Purpose**: User management and authentication
- **Technology**: Node.js with Express
- **Database**: PostgreSQL
- **Key Features**:
  - JWT-based authentication
  - OAuth2 integration
  - User profile management
  - Role-based access control

### Order Service
- **Purpose**: Order processing and management
- **Technology**: Java with Spring Boot
- **Database**: PostgreSQL
- **Key Features**:
  - Order creation and tracking
  - Order status management
  - Integration with payment and inventory
  - Order history

## Data Flow

### Order Creation Flow
1. Client sends order request to API Gateway
2. Gateway authenticates request and routes to Order Service
3. Order Service validates inventory with Inventory Service
4. Order Service initiates payment with Payment Service
5. On successful payment, Order Service:
   - Updates order status
   - Publishes order event to Message Queue
   - Returns confirmation to client
6. Notification Service consumes event and sends confirmation email

## Security Architecture

### Authentication & Authorization
- JWT tokens for API authentication
- OAuth2 for third-party integrations
- Role-Based Access Control (RBAC)
- API key management for service-to-service communication

### Data Protection
- Encryption at rest using AES-256
- TLS 1.3 for data in transit
- PII data masking in logs
- Regular security audits

## Scalability Considerations

### Horizontal Scaling
- All services designed to be stateless
- Database read replicas for read-heavy operations
- Redis cluster for distributed caching
- Auto-scaling based on CPU and memory metrics

### Performance Optimization
- Database query optimization
- Caching strategy (Redis)
- CDN for static assets
- Async processing for heavy operations

## Monitoring & Observability

### Metrics
- Prometheus for metrics collection
- Grafana for visualization
- Custom business metrics dashboard

### Logging
- ELK stack (Elasticsearch, Logstash, Kibana)
- Structured logging with correlation IDs
- Log aggregation from all services

### Tracing
- Jaeger for distributed tracing
- End-to-end request tracking
- Performance bottleneck identification
```

## Inline Code Documentation

### Best Practices
```typescript
/**
 * GOOD: Explains WHY, not WHAT
 * 
 * We use exponential backoff here because the external API
 * has aggressive rate limiting that triggers after rapid retries.
 * This prevents our IP from being blocked.
 */
const delay = Math.pow(2, attempt) * 1000;

// BAD: Explains WHAT (obvious from code)
// Multiply attempt by 2 and convert to milliseconds
const delay = Math.pow(2, attempt) * 1000;

/**
 * GOOD: Documents complex business logic
 * 
 * Price calculation follows the tiered pricing model:
 * - First 100 units: $10 each
 * - Next 400 units: $8 each
 * - Above 500 units: $6 each
 * 
 * Example: 750 units = (100 * $10) + (400 * $8) + (250 * $6) = $5,700
 */
function calculateTieredPrice(quantity: number): number {
  // Implementation...
}

// GOOD: Warns about non-obvious behavior
// IMPORTANT: This modifies the original array
array.sort((a, b) => a - b);

// GOOD: TODO with context and assignee
// TODO(john): Optimize this O(n²) algorithm before production
// Issue: #1234
for (const item of items) {
  for (const other of items) {
    // ...
  }
}

// GOOD: Documents workaround with reason
// WORKAROUND: The API returns 200 even for errors, so we check
// the response body for an error field instead of status code
if (response.data.error) {
  throw new ApiError(response.data.error);
}

// GOOD: Security warning
// SECURITY: Never log the actual password, even in development
console.log(`Login attempt for user: ${email}`);

// GOOD: Performance note
// PERFORMANCE: This query is optimized for the user_email_idx index
// Average execution time: ~5ms for 1M records
const user = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

## Documentation Generation

### TypeDoc Configuration
```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "theme": "default",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeProtected": false,
  "excludeExternals": true,
  "includeVersion": true,
  "categorizeByGroup": true,
  "defaultCategory": "Other",
  "categoryOrder": [
    "Core",
    "Models",
    "Services",
    "Utilities",
    "*"
  ],
  "navigation": {
    "includeCategories": true,
    "includeGroups": true
  },
  "plugin": [
    "typedoc-plugin-markdown",
    "typedoc-plugin-missing-exports"
  ]
}
```

### Documentation CI/CD
```yaml
# .github/workflows/documentation.yml
name: Documentation

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'docs/**'
      - 'README.md'

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate API documentation
        run: npm run docs:generate
        
      - name: Generate test coverage report
        run: npm run test:coverage
        
      - name: Build documentation site
        run: npm run docs:build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs-dist
```

## Documentation Tools

### Static Site Generators
```javascript
// docusaurus.config.js
module.exports = {
  title: 'Project Documentation',
  tagline: 'Comprehensive documentation for our project',
  url: 'https://docs.example.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'company',
  projectName: 'project',
  
  themeConfig: {
    navbar: {
      title: 'Docs',
      logo: {
        alt: 'Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Documentation',
          position: 'left',
        },
        {
          to: 'api/',
          label: 'API',
          position: 'left',
        },
        {
          to: 'blog',
          label: 'Blog',
          position: 'left'
        },
        {
          href: 'https://github.com/company/project',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: 'docs/',
            },
            {
              label: 'API Reference',
              to: 'api/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/project',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/project',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: 'blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/company/project',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Company, Inc.`,
    },
    prism: {
      theme: require('prism-react-renderer/themes/github'),
      darkTheme: require('prism-react-renderer/themes/dracula'),
    },
    algolia: {
      apiKey: 'your-api-key',
      indexName: 'project',
      contextualSearch: true,
    },
  },
  
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/company/project/edit/main/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/company/project/edit/main/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
```

## Best Practices

### Documentation Checklist
```yaml
readme_checklist:
  - Project title and description
  - Badges (build, coverage, version)
  - Installation instructions
  - Quick start guide
  - Usage examples
  - API reference link
  - Configuration options
  - Development setup
  - Testing instructions
  - Contribution guidelines
  - License information
  - Support channels

code_documentation:
  - All public APIs documented
  - Complex algorithms explained
  - Business logic documented
  - Error scenarios described
  - Examples provided
  - Deprecations marked
  - Breaking changes noted

architecture_documentation:
  - System overview diagram
  - Component descriptions
  - Data flow diagrams
  - Security architecture
  - Scalability plan
  - Technology choices explained
  - ADRs for major decisions

api_documentation:
  - OpenAPI/Swagger spec
  - Authentication explained
  - Rate limiting documented
  - Error responses listed
  - Request/response examples
  - Versioning strategy
  - SDK links
```

This comprehensive Documentation Standards document provides:
- Professional README templates
- API documentation with OpenAPI/Swagger
- Code documentation standards (JSDoc/TSDoc/Docstrings)
- Architecture documentation patterns
- Inline documentation best practices
- Documentation generation and tooling
- CI/CD integration for documentation
- Documentation quality checklists

The document emphasizes clear, maintainable, and searchable documentation that serves different audiences effectively.