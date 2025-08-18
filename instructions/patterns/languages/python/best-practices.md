# Pythonベストプラクティス

## 型ヒント
コードの明確性とIDE支援のために型アノテーションを使用。

```python
# 良い例
def calculate_discount(price: float, discount_rate: float) -> float:
    return price * (1 - discount_rate)

from typing import List, Optional, Dict

def process_items(items: List[str], config: Optional[Dict[str, Any]] = None) -> List[str]:
    config = config or {}
    return [item.upper() for item in items]

# 悪い例
def calculate_discount(price, discount_rate):
    return price * (1 - discount_rate)
```

## データクラス
単純なデータコンテナにはdataclassesを使用。

```python
# 良い例
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)

# 悪い例
class User:
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email
        self.created_at = datetime.now()
```

## コンテキストマネージャー
リソース管理にはコンテキストマネージャーを使用。

```python
# 良い例
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

# 悪い例
f = open('file.txt', 'r')
content = f.read()
f.close()  # 忘れやすい
```

## 非同期処理
並行I/O操作にはasync/awaitを使用。

```python
# 良い例
import asyncio
from typing import List

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def fetch_multiple(urls: List[str]) -> List[dict]:
    tasks = [fetch_data(url) for url in urls]
    return await asyncio.gather(*tasks)

# 悪い例 - ブロッキングI/O
import requests

def fetch_multiple(urls):
    results = []
    for url in urls:
        response = requests.get(url)
        results.append(response.json())
    return results
```

## エラー処理
特定の例外と適切なエラー処理を使用。

```python
# 良い例
class ValidationError(Exception):
    """検証失敗時に発生"""
    pass

def validate_email(email: str) -> None:
    if '@' not in email:
        raise ValidationError(f"無効なメールフォーマット: {email}")

try:
    validate_email(user_email)
except ValidationError as e:
    logger.error(f"検証失敗: {e}")
    return {"error": str(e)}, 400

# 悪い例
def validate_email(email):
    if '@' not in email:
        raise Exception("不正なメール")
```

## リスト内包表記とジェネレータ
クリーンなコードには内包表記、メモリ効率にはジェネレータを使用。

```python
# 良い例
# リスト内包表記
squares = [x**2 for x in range(10) if x % 2 == 0]

# 大規模データセット用ジェネレータ
def read_large_file(file_path: str):
    with open(file_path) as f:
        for line in f:
            yield line.strip()

# ジェネレータ式
sum_squares = sum(x**2 for x in range(1000000))

# 悪い例
squares = []
for x in range(10):
    if x % 2 == 0:
        squares.append(x**2)
```

## デコレータ
横断的関心事にはデコレータを使用。

```python
# 良い例
from functools import wraps
import time

def measure_time(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__}は{end - start:.2f}秒かかりました")
        return result
    return wrapper

@measure_time
def slow_function():
    time.sleep(1)
    return "完了"

# キャッシュデコレータ
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(n: int) -> int:
    return n ** n
```

## パス処理
ファイルシステム操作にはpathlibを使用。

```python
# 良い例
from pathlib import Path

project_root = Path(__file__).parent.parent
config_file = project_root / "config" / "settings.json"

if config_file.exists():
    with config_file.open() as f:
        config = json.load(f)

# ディレクトリが存在しない場合は作成
output_dir = project_root / "output"
output_dir.mkdir(parents=True, exist_ok=True)

# 悪い例
import os

project_root = os.path.dirname(os.path.dirname(__file__))
config_file = os.path.join(project_root, "config", "settings.json")
```

## テスト
pytestで包括的なテストを記述。

```python
# 良い例
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

## ベストプラクティスチェックリスト

- [ ] すべての関数に型ヒントを使用
- [ ] PEP 8スタイルガイドに従う
- [ ] 仮想環境を使用（venv、poetry、pipenv）
- [ ] requirements.txtまたはpyproject.tomlで依存関係を固定
- [ ] フォーマットにはf文字列を使用
- [ ] os.pathよりpathlibを優先
- [ ] モジュール、クラス、関数にdocstringを記述
- [ ] デバッグにはprintの代わりにloggingを使用
- [ ] 例外を具体的に処理
- [ ] pytestでテストを記述
- [ ] リンターを使用（pylint、flake8、black、mypy）