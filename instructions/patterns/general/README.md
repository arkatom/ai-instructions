# General Development Patterns

Language-agnostic best practices and patterns applicable across all development.

## Clean Code Principles

### Naming Conventions
- **Variables**: Descriptive, lowercase with underscores (snake_case) or camelCase
- **Constants**: UPPERCASE_WITH_UNDERSCORES
- **Classes**: PascalCase
- **Functions**: Verb phrases that describe action

```
# Good
user_count = 10
MAX_RETRIES = 3
class UserService
def calculate_total()

# Bad
n = 10
max = 3
class user_service
def total()
```

### Single Responsibility
Each function/class should have one reason to change:
```
# Good
def validate_email(email):
    # Only validates email format

def send_email(email, message):
    # Only sends email

# Bad
def process_email(email, message):
    # Validates AND sends - doing too much
```

## Design Patterns

### Factory Pattern
Create objects without specifying exact classes:
```
class DatabaseFactory:
    @staticmethod
    def create(db_type):
        if db_type == "postgres":
            return PostgresDB()
        elif db_type == "mysql":
            return MySQLDB()
```

### Singleton Pattern
Ensure only one instance exists:
```
class Config:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

### Observer Pattern
Notify multiple objects about state changes:
```
class Subject:
    def __init__(self):
        self._observers = []
    
    def attach(self, observer):
        self._observers.append(observer)
    
    def notify(self):
        for observer in self._observers:
            observer.update()
```

## Error Handling

### Fail Fast
Detect and report errors as early as possible:
```
def process_data(data):
    if not data:
        raise ValueError("Data cannot be empty")
    # Process data
```

### Graceful Degradation
Provide fallbacks for non-critical failures:
```
def get_user_preference(key, default=None):
    try:
        return load_preference(key)
    except FileNotFoundError:
        return default
```

## Security Principles

### Input Validation
Never trust user input:
```
def process_user_input(input_data):
    # Sanitize
    clean_data = sanitize(input_data)
    
    # Validate
    if not is_valid(clean_data):
        raise ValidationError()
    
    # Process
    return process(clean_data)
```

### Principle of Least Privilege
Grant minimal necessary permissions:
```
# Good
def read_user_data(user_id, requester_id):
    if not can_read(requester_id, user_id):
        raise PermissionError()
    return fetch_data(user_id)
```

## Performance Optimization

### Caching Strategy
Cache expensive operations:
```
cache = {}

def expensive_operation(key):
    if key in cache:
        return cache[key]
    
    result = perform_calculation(key)
    cache[key] = result
    return result
```

### Lazy Loading
Defer initialization until needed:
```
class DataLoader:
    def __init__(self):
        self._data = None
    
    @property
    def data(self):
        if self._data is None:
            self._data = load_data()
        return self._data
```

## Database Patterns

### Connection Pooling
Reuse database connections:
```
class DatabasePool:
    def __init__(self, max_connections=10):
        self.pool = create_pool(max_connections)
    
    def get_connection(self):
        return self.pool.get()
```

### Query Optimization
- Use indexes for frequently queried columns
- Avoid N+1 queries
- Batch operations when possible
- Use pagination for large datasets

## API Design

### RESTful Principles
```
GET    /users      # List users
GET    /users/{id} # Get specific user
POST   /users      # Create user
PUT    /users/{id} # Update user
DELETE /users/{id} # Delete user
```

### Versioning
```
/api/v1/users
/api/v2/users  # New version with breaking changes
```

## Testing Strategies

### Test Pyramid
1. **Unit Tests** (70%): Fast, isolated, numerous
2. **Integration Tests** (20%): Test component interactions
3. **E2E Tests** (10%): Full system validation

### Test Naming
```
test_should_[expected_behavior]_when_[condition]

# Examples:
test_should_return_user_when_id_exists()
test_should_raise_error_when_invalid_input()
```

## Documentation

### Code Comments
```
# Good: Explain WHY
# Compensate for timezone difference
time_adjusted = time + timezone_offset

# Bad: Explain WHAT (obvious)
# Add timezone_offset to time
time_adjusted = time + timezone_offset
```

### API Documentation
```
def calculate_discount(price: float, percentage: float) -> float:
    """
    Calculate discounted price.
    
    Args:
        price: Original price in dollars
        percentage: Discount percentage (0-100)
    
    Returns:
        Discounted price
        
    Raises:
        ValueError: If percentage is not between 0 and 100
    """
```

## Deployment Patterns

### Blue-Green Deployment
- Maintain two identical production environments
- Switch traffic between them for zero-downtime updates

### Feature Flags
```
def new_feature(user):
    if feature_enabled("new_feature", user):
        return new_implementation()
    return old_implementation()
```

### Rolling Updates
- Update instances gradually
- Monitor for issues
- Rollback if problems detected

## Monitoring and Logging

### Structured Logging
```
logger.info("User action", {
    "user_id": user.id,
    "action": "login",
    "timestamp": datetime.now(),
    "ip_address": request.ip
})
```

### Metrics Collection
- Response times
- Error rates
- Resource usage
- Business metrics

## Code Review Checklist

- [ ] Follows naming conventions
- [ ] Single responsibility maintained
- [ ] Error handling present
- [ ] Tests included
- [ ] Documentation updated
- [ ] Security considered
- [ ] Performance acceptable
- [ ] No duplicate code