# Python Best Practices

## Type Hints
Use type annotations for better code clarity and IDE support.

```python
# Good
def calculate_discount(price: float, discount_rate: float) -> float:
    return price * (1 - discount_rate)

from typing import List, Optional, Dict

def process_items(items: List[str], config: Optional[Dict[str, Any]] = None) -> List[str]:
    config = config or {}
    return [item.upper() for item in items]

# Bad
def calculate_discount(price, discount_rate):
    return price * (1 - discount_rate)
```

## Data Classes
Use dataclasses for simple data containers.

```python
# Good
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)

# Bad
class User:
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email
        self.created_at = datetime.now()
```

## Context Managers
Use context managers for resource management.

```python
# Good
with open('file.txt', 'r') as f:
    content = f.read()

from contextlib import contextmanager

@contextmanager
def database_connection():
    conn = create_connection()
    try:
        yield conn
    finally:
        conn.close()

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
from typing import List

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def fetch_multiple(urls: List[str]) -> List[dict]:
    tasks = [fetch_data(url) for url in urls]
    return await asyncio.gather(*tasks)

# Bad - blocking I/O
import requests

def fetch_multiple(urls):
    results = []
    for url in urls:
        response = requests.get(url)
        results.append(response.json())
    return results
```

## Error Handling
Use specific exceptions and proper error handling.

```python
# Good
class ValidationError(Exception):
    """Raised when validation fails"""
    pass

def validate_email(email: str) -> None:
    if '@' not in email:
        raise ValidationError(f"Invalid email format: {email}")

try:
    validate_email(user_email)
except ValidationError as e:
    logger.error(f"Validation failed: {e}")
    return {"error": str(e)}, 400

# Bad
def validate_email(email):
    if '@' not in email:
        raise Exception("Bad email")
```

## List Comprehensions and Generators
Use comprehensions for cleaner code, generators for memory efficiency.

```python
# Good
# List comprehension
squares = [x**2 for x in range(10) if x % 2 == 0]

# Generator for large datasets
def read_large_file(file_path: str):
    with open(file_path) as f:
        for line in f:
            yield line.strip()

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
# Good
from functools import wraps
import time

def measure_time(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.2f}s")
        return result
    return wrapper

@measure_time
def slow_function():
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

# Bad
import os

project_root = os.path.dirname(os.path.dirname(__file__))
config_file = os.path.join(project_root, "config", "settings.json")
```

## Testing
Write comprehensive tests with pytest.

```python
# Good
import pytest
from unittest.mock import Mock, patch

def test_user_creation():
    user = User(id=1, name="Alice", email="alice@example.com")
    assert user.name == "Alice"
    assert user.email == "alice@example.com"

@pytest.fixture
def mock_database():
    db = Mock()
    db.get_user.return_value = {"id": 1, "name": "Alice"}
    return db

def test_get_user_from_db(mock_database):
    user = get_user(mock_database, user_id=1)
    assert user["name"] == "Alice"
    mock_database.get_user.assert_called_once_with(1)

@pytest.mark.parametrize("input,expected", [
    (2, 4),
    (3, 9),
    (4, 16),
])
def test_square(input, expected):
    assert square(input) == expected
```

## Best Practices Checklist

- [ ] Use type hints for all functions
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