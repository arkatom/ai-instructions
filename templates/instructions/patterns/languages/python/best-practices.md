# Python Best Practices

## Type Hints (Python 3.10+)
Use modern type annotations for better code clarity and IDE support.

```python
# Good - Python 3.10+ syntax
def calculate_discount(price: float, discount_rate: float) -> float:
    return price * (1 - discount_rate)

# Use Union types with | operator (Python 3.10+)
def process_items(items: list[str], config: dict[str, Any] | None = None) -> list[str]:
    config = config or {}
    return [item.upper() for item in items]

# TypeAlias for complex types (Python 3.10+)
from typing import TypeAlias, Any

UserData: TypeAlias = dict[str, str | int | list[str]]

# Bad - Old style (pre-3.10)
from typing import List, Optional, Dict  # Don't use these anymore
def old_process(items: List[str], config: Optional[Dict[str, Any]] = None):  # Outdated
    pass
```

## Pattern Matching (Python 3.10+)
Use match/case for cleaner conditional logic.

```python
# Good - Pattern matching
def handle_response(response: dict[str, Any]) -> str:
    match response:
        case {"status": 200, "data": data}:
            return f"Success: {data}"
        case {"status": 404}:
            return "Not found"
        case {"status": code} if code >= 500:
            return f"Server error: {code}"
        case _:
            return "Unknown response"

# Structural pattern matching with guards
def process_command(command: list[str]) -> str:
    match command:
        case ["move", ("north" | "south" | "east" | "west") as direction]:
            return f"Moving {direction}"
        case ["attack", target] if target:
            return f"Attacking {target}"
        case ["defend"]:
            return "Defending"
        case _:
            return "Invalid command"
```

## Data Classes
Use dataclasses for simple data containers.

```python
# Good
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)
    tags: list[str] = field(default_factory=list)

# With __post_init__ for validation
@dataclass
class Product:
    name: str
    price: float
    quantity: int = 0
    
    def __post_init__(self):
        if self.price < 0:
            raise ValueError("Price cannot be negative")

# Bad
class User:
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email
        self.created_at = datetime.now()
```

## Protocols (Structural Subtyping)
Use Protocol for duck typing with type safety.

```python
# Good - Protocol pattern
from typing import Protocol, runtime_checkable

@runtime_checkable
class Drawable(Protocol):
    def draw(self) -> None: ...

@runtime_checkable
class Resizable(Protocol):
    def resize(self, width: int, height: int) -> None: ...

class Shape:
    def draw(self) -> None:
        print("Drawing shape")
    
    def resize(self, width: int, height: int) -> None:
        print(f"Resizing to {width}x{height}")

def render(obj: Drawable) -> None:
    obj.draw()  # Type-safe duck typing

# Shape implements Drawable protocol implicitly
shape = Shape()
render(shape)  # Works!

# Runtime check
if isinstance(shape, Drawable):
    print("Shape is drawable")
```

## Context Managers
Use context managers for resource management.

```python
# Good
with open('file.txt', 'r') as f:
    content = f.read()

# Custom context manager with contextlib
from contextlib import contextmanager
import sqlite3

@contextmanager
def database_connection(db_name: str):
    conn = sqlite3.connect(db_name)
    try:
        yield conn
    finally:
        conn.close()

# Using the custom context manager
with database_connection('app.db') as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")

# Parenthesized context managers (Python 3.10+)
with (
    open('input.txt') as infile,
    open('output.txt', 'w') as outfile
):
    outfile.write(infile.read())

# Bad
f = open('file.txt', 'r')
content = f.read()
f.close()  # Easy to forget
```

## Async/Await
Use async/await for concurrent I/O operations.

```python
# Good
import asyncio
import aiohttp

async def fetch_data(url: str) -> dict[str, Any]:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def fetch_multiple(urls: list[str]) -> list[dict[str, Any]]:
    tasks = [fetch_data(url) for url in urls]
    return await asyncio.gather(*tasks)

# Using asyncio.TaskGroup (Python 3.11+)
async def fetch_with_taskgroup(urls: list[str]) -> list[dict[str, Any]]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_data(url)) for url in urls]
    return [task.result() for task in tasks]

# Bad - blocking I/O
import requests

def fetch_multiple_blocking(urls):
    results = []
    for url in urls:
        response = requests.get(url)
        results.append(response.json())
    return results
```

## Error Handling
Use specific exceptions and proper error handling.

```python
# Good - Custom exceptions with Exception Groups (Python 3.11+)
class ValidationError(Exception):
    """Raised when validation fails"""
    pass

class EmailValidationError(ValidationError):
    """Specific email validation error"""
    pass

def validate_user(data: dict[str, Any]) -> None:
    errors = []
    
    if 'email' not in data:
        errors.append(EmailValidationError("Email is required"))
    elif '@' not in data['email']:
        errors.append(EmailValidationError(f"Invalid email: {data['email']}"))
    
    if 'age' in data and data['age'] < 0:
        errors.append(ValidationError("Age cannot be negative"))
    
    if errors:
        raise ExceptionGroup("Validation failed", errors)

# Handle exception groups
try:
    validate_user({'email': 'invalid', 'age': -1})
except* EmailValidationError as eg:
    for error in eg.exceptions:
        print(f"Email error: {error}")
except* ValidationError as eg:
    for error in eg.exceptions:
        print(f"Validation error: {error}")
```

## List Comprehensions and Generators
Use comprehensions for cleaner code, generators for memory efficiency.

```python
# Good
# List comprehension with walrus operator (Python 3.8+)
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
filtered = [y for x in data if (y := x * 2) > 10]

# Generator for large datasets
def read_large_file(file_path: str):
    with open(file_path) as f:
        for line in f:
            if processed := line.strip():  # Walrus operator
                yield processed

# Generator expression
sum_squares = sum(x**2 for x in range(1000000))

# Bad
squares = []
for x in range(10):
    if x % 2 == 0:
        squares.append(x**2)
```

## Decorators
Use decorators for cross-cutting concerns.

```python
# Good - Modern decorator with ParamSpec (Python 3.10+)
from functools import wraps
from typing import ParamSpec, TypeVar, Callable
import time

P = ParamSpec('P')
R = TypeVar('R')

def measure_time(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.2f}s")
        return result
    return wrapper

@measure_time
def slow_function() -> str:
    time.sleep(1)
    return "done"

# Caching decorator
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(n: int) -> int:
    return n ** n
```

## Path Handling
Use pathlib for file system operations.

```python
# Good
from pathlib import Path

project_root = Path(__file__).parent.parent
config_file = project_root / "config" / "settings.json"

if config_file.exists():
    with config_file.open() as f:
        config = json.load(f)

# Create directory if it doesn't exist
output_dir = project_root / "output"
output_dir.mkdir(parents=True, exist_ok=True)

# Glob patterns
for py_file in project_root.glob("**/*.py"):
    print(py_file)

# Bad
import os

project_root = os.path.dirname(os.path.dirname(__file__))
config_file = os.path.join(project_root, "config", "settings.json")
```

## Testing
Write comprehensive tests with pytest.

```python
# Good - Modern pytest with type hints
import pytest
from unittest.mock import Mock, AsyncMock, patch

def test_user_creation() -> None:
    user = User(id=1, name="Alice", email="alice@example.com")
    assert user.name == "Alice"
    assert user.email == "alice@example.com"

@pytest.fixture
def mock_database() -> Mock:
    db = Mock()
    db.get_user.return_value = {"id": 1, "name": "Alice"}
    return db

def test_get_user_from_db(mock_database: Mock) -> None:
    user = get_user(mock_database, user_id=1)
    assert user["name"] == "Alice"
    mock_database.get_user.assert_called_once_with(1)

# Async test
@pytest.mark.asyncio
async def test_async_function() -> None:
    mock_api = AsyncMock()
    mock_api.fetch.return_value = {"status": "ok"}
    result = await process_api_call(mock_api)
    assert result["status"] == "ok"

# Parametrized tests
@pytest.mark.parametrize("input,expected", [
    (2, 4),
    (3, 9),
    (4, 16),
])
def test_square(input: int, expected: int) -> None:
    assert square(input) == expected
```

## Security Best Practices

✅ Input validation and sanitization:
```python
# Good - comprehensive input validation
import re
from typing import Any
from html import escape

def validate_email(email: str) -> bool:
    """Validate email format and length."""
    if not isinstance(email, str) or len(email) > 254:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def sanitize_html_input(user_input: str) -> str:
    """Sanitize user input to prevent XSS."""
    if not isinstance(user_input, str):
        raise ValueError("Input must be a string")
    
    # HTML escape and limit length
    sanitized = escape(user_input.strip())
    return sanitized[:1000]  # Limit length

def validate_user_data(data: dict[str, Any]) -> dict[str, str]:
    """Validate and sanitize user registration data."""
    required_fields = ['name', 'email']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")
    
    if not validate_email(data['email']):
        raise ValueError("Invalid email format")
    
    return {
        'name': sanitize_html_input(data['name']),
        'email': data['email'].lower().strip()
    }

# Bad - no validation
def unsafe_user_creation(data):
    return {
        'name': data['name'],      # No validation
        'email': data['email'],    # No format check
        'bio': data.get('bio', '') # No XSS protection
    }
```

✅ Secure database operations:
```python
# Good - parameterized queries with sqlalchemy
from sqlalchemy import text
from sqlalchemy.orm import Session

def get_user_securely(db: Session, user_id: int) -> dict[str, Any] | None:
    """Safely get user data using parameterized query."""
    if not isinstance(user_id, int) or user_id <= 0:
        raise ValueError("Invalid user ID")
    
    query = text("SELECT id, name, email FROM users WHERE id = :user_id")
    result = db.execute(query, {"user_id": user_id}).fetchone()
    
    if result:
        return {
            'id': result.id,
            'name': result.name,
            'email': result.email
        }
    return None

def search_users_securely(db: Session, search_term: str) -> list[dict[str, Any]]:
    """Secure user search with input validation."""
    # Validate and sanitize search term
    if not isinstance(search_term, str):
        raise ValueError("Search term must be string")
    
    clean_term = sanitize_html_input(search_term)
    if len(clean_term) < 2:
        return []
    
    # Use parameterized query with LIKE
    query = text("""
        SELECT id, name, email 
        FROM users 
        WHERE name ILIKE :search_term 
        LIMIT 50
    """)
    
    results = db.execute(query, {"search_term": f"%{clean_term}%"}).fetchall()
    
    return [
        {'id': r.id, 'name': r.name, 'email': r.email}
        for r in results
    ]

# Bad - SQL injection vulnerability
def unsafe_user_search(db, search_term):
    query = f"SELECT * FROM users WHERE name LIKE '%{search_term}%'"
    return db.execute(query).fetchall()  # SQL injection risk
```

✅ Secure file operations:
```python
# Good - secure file handling
from pathlib import Path
import os

ALLOWED_UPLOAD_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'}
UPLOAD_DIRECTORY = Path('/secure/uploads')
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file_upload(filename: str, content: bytes) -> tuple[bool, str]:
    """Validate uploaded file for security."""
    if not filename:
        return False, "Filename required"
    
    # Check file extension
    file_path = Path(filename)
    if file_path.suffix.lower() not in ALLOWED_UPLOAD_EXTENSIONS:
        return False, f"File type not allowed: {file_path.suffix}"
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        return False, "File too large"
    
    # Check for path traversal
    if '..' in filename or filename.startswith('/'):
        return False, "Invalid filename"
    
    return True, "Valid file"

def save_uploaded_file(filename: str, content: bytes) -> Path:
    """Securely save uploaded file."""
    is_valid, message = validate_file_upload(filename, content)
    if not is_valid:
        raise ValueError(message)
    
    # Generate safe filename
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
    file_path = UPLOAD_DIRECTORY / safe_filename
    
    # Ensure upload directory exists
    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    
    # Write file securely
    with file_path.open('wb') as f:
        f.write(content)
    
    return file_path

# Bad - insecure file handling
def unsafe_file_save(filename, content):
    with open(f"/uploads/{filename}", 'wb') as f:  # Path traversal risk
        f.write(content)  # No validation
```

✅ Environment and secrets management:
```python
# Good - secure configuration management
import os
from functools import lru_cache
from pydantic import BaseSettings, validator

class SecureSettings(BaseSettings):
    """Secure application settings with validation."""
    
    database_url: str
    secret_key: str
    api_key: str
    debug: bool = False
    
    @validator('secret_key')
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError('Secret key must be at least 32 characters')
        return v
    
    @validator('database_url')
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith(('postgresql://', 'sqlite://')):
            raise ValueError('Invalid database URL')
        return v
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

@lru_cache()
def get_settings() -> SecureSettings:
    """Get validated settings (cached)."""
    return SecureSettings()

# Usage
settings = get_settings()

# Bad - insecure configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret')  # Weak default
DATABASE_URL = os.environ['DATABASE_URL']  # No validation
```

## Best Practices Checklist

- [ ] Use type hints for all functions (Python 3.10+ syntax)
- [ ] Use `|` for Union types instead of `Union[X, Y]`
- [ ] Use built-in generics (`list`, `dict`) instead of `List`, `Dict`
- [ ] Use pattern matching for complex conditionals
- [ ] Use Protocol for structural subtyping
- [ ] Follow PEP 8 style guide
- [ ] Use virtual environments (venv, poetry, pipenv)
- [ ] Pin dependencies with requirements.txt or pyproject.toml
- [ ] Use f-strings for formatting
- [ ] Prefer pathlib over os.path
- [ ] Write docstrings for modules, classes, and functions
- [ ] Use logging instead of print for debugging
- [ ] Handle exceptions specifically
- [ ] Write tests with pytest
- [ ] Use linters (pylint, flake8, black, mypy)
- [ ] Validate and sanitize all user inputs
- [ ] Use parameterized queries to prevent SQL injection  
- [ ] Implement secure file upload validation
- [ ] Validate environment variables and secrets
- [ ] Use proper HTML escaping for web output