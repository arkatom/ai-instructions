# Python Development Patterns

Best practices and patterns for Python development.

## Code Style

### PEP 8 Compliance
Follow PEP 8 style guide:
```python
# Good
def calculate_total(items: List[Item]) -> float:
    """Calculate total price of items."""
    return sum(item.price for item in items)

# Bad
def calculateTotal(items):
    return sum([item.price for item in items])
```

### Type Hints
Always use type hints for clarity:
```python
from typing import List, Optional, Dict, Union

def process_data(
    data: List[Dict[str, Union[str, int]]],
    filter_key: Optional[str] = None
) -> List[Dict[str, Union[str, int]]]:
    """Process and optionally filter data."""
    if filter_key:
        return [d for d in data if filter_key in d]
    return data
```

## Project Structure

### Standard Layout
```
project/
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── main.py
│       └── utils.py
├── tests/
│   ├── __init__.py
│   └── test_main.py
├── requirements.txt
├── setup.py
└── README.md
```

## Error Handling

### Custom Exceptions
```python
class ValidationError(Exception):
    """Raised when validation fails."""
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(self.message)
```

### Context Managers
```python
from contextlib import contextmanager

@contextmanager
def database_connection():
    conn = create_connection()
    try:
        yield conn
    finally:
        conn.close()
```

## Testing Patterns

### Pytest Fixtures
```python
import pytest

@pytest.fixture
def sample_data():
    return {
        "id": 1,
        "name": "Test",
        "value": 100
    }

def test_process(sample_data):
    result = process(sample_data)
    assert result["value"] == 100
```

### Mocking
```python
from unittest.mock import Mock, patch

@patch('module.external_api')
def test_api_call(mock_api):
    mock_api.return_value = {"status": "success"}
    result = function_using_api()
    assert result["status"] == "success"
```

## Performance Patterns

### Generators
```python
def read_large_file(file_path: str):
    """Read large file line by line."""
    with open(file_path, 'r') as file:
        for line in file:
            yield line.strip()
```

### Caching
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(n: int) -> int:
    """Cache expensive computation results."""
    return sum(i ** 2 for i in range(n))
```

## Async Patterns

### Async/Await
```python
import asyncio

async def fetch_data(url: str) -> dict:
    """Fetch data asynchronously."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def main():
    tasks = [fetch_data(url) for url in urls]
    results = await asyncio.gather(*tasks)
    return results
```

## Security Patterns

### Input Validation
```python
def validate_email(email: str) -> bool:
    """Validate email format."""
    import re
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return bool(re.match(pattern, email))
```

### Safe File Operations
```python
import os
from pathlib import Path

def safe_file_read(file_path: str, base_dir: str) -> str:
    """Safely read file within base directory."""
    base = Path(base_dir).resolve()
    file = Path(file_path).resolve()
    
    if not file.is_relative_to(base):
        raise ValueError("Path traversal attempt detected")
    
    return file.read_text()
```

## Data Patterns

### Dataclasses
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: int
    name: str
    email: str
    age: Optional[int] = None
    
    def __post_init__(self):
        if self.age and self.age < 0:
            raise ValueError("Age cannot be negative")
```

### Enums
```python
from enum import Enum, auto

class Status(Enum):
    PENDING = auto()
    PROCESSING = auto()
    COMPLETED = auto()
    FAILED = auto()
```