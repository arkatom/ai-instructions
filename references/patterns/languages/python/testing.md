# Pythonテストパターン (2024)

Pytestを活用した最新のPythonテストベストプラクティス。

## Pytest基礎

### プロジェクト構造
```
project/
├── src/
│   ├── __init__.py
│   └── app/
│       ├── __init__.py
│       ├── models.py
│       ├── services.py
│       └── utils.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py      # グローバルフィクスチャ
│   ├── unit/
│   │   ├── test_models.py
│   │   └── test_utils.py
│   ├── integration/
│   │   └── test_services.py
│   └── e2e/
│       └── test_api.py
├── pyproject.toml       # プロジェクト設定
└── pytest.ini           # pytest設定
```

### Pytest設定
```ini
# pytest.ini
[pytest]
minversion = 7.0
addopts = 
    -ra 
    -q 
    --strict-markers
    --strict-config
    --cov=src
    --cov-branch
    --cov-report=term-missing:skip-covered
    --cov-report=html
    --cov-report=xml
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
```

## フィクスチャパターン

### 基本的なフィクスチャ
```python
# conftest.py
import pytest
from datetime import datetime
from typing import Generator
import asyncio

@pytest.fixture
def sample_user():
    """シンプルなフィクスチャ"""
    return {
        "id": 1,
        "name": "Test User",
        "email": "test@example.com",
        "created_at": datetime.now()
    }

@pytest.fixture
def database_session():
    """データベースセッションフィクスチャ"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()
    engine.dispose()

@pytest.fixture(scope="session")
def event_loop():
    """非同期テスト用イベントループ"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
```

### パラメータ化フィクスチャ
```python
@pytest.fixture(params=[
    ("user1", "password1"),
    ("user2", "password2"),
    ("admin", "admin123"),
])
def credentials(request):
    """複数の認証情報でテスト"""
    username, password = request.param
    return {"username": username, "password": password}

@pytest.fixture
def make_user():
    """ファクトリーフィクスチャ"""
    created_users = []
    
    def _make_user(name="Test User", email=None, **kwargs):
        user = {
            "id": len(created_users) + 1,
            "name": name,
            "email": email or f"{name.lower().replace(' ', '.')}@example.com",
            **kwargs
        }
        created_users.append(user)
        return user
    
    yield _make_user
    
    # クリーンアップ
    for user in created_users:
        print(f"Cleaning up user: {user['id']}")
```

## モッキング戦略

### 基本的なモック
```python
from unittest.mock import Mock, MagicMock, patch, AsyncMock
import pytest

def test_service_with_mock():
    """外部サービスのモック"""
    # Mockオブジェクト作成
    mock_api = Mock()
    mock_api.get_user.return_value = {"id": 1, "name": "Mock User"}
    
    # サービスでモックを使用
    service = UserService(api_client=mock_api)
    user = service.fetch_user(1)
    
    # アサーション
    assert user["name"] == "Mock User"
    mock_api.get_user.assert_called_once_with(1)

@patch('app.services.external_api')
def test_with_patch(mock_api):
    """patchデコレータでモック"""
    mock_api.fetch_data.return_value = {"status": "success"}
    
    result = process_external_data()
    
    assert result["status"] == "success"
    mock_api.fetch_data.assert_called()

async def test_async_mock():
    """非同期関数のモック"""
    mock_async_func = AsyncMock()
    mock_async_func.return_value = {"async": "result"}
    
    result = await mock_async_func()
    assert result == {"async": "result"}
```

### pytest-mock使用
```python
def test_with_pytest_mock(mocker):
    """pytest-mockでより簡潔なモック"""
    # モックスパイ
    mock_func = mocker.spy(module, 'function_name')
    
    # パッチ
    mocker.patch('app.services.external_api.call', return_value="mocked")
    
    # MagicMock
    mock_obj = mocker.MagicMock()
    mock_obj.method.return_value = "result"
    
    result = function_under_test(mock_obj)
    
    assert mock_func.called
    assert result == "expected"
```

## パラメータ化テスト

### 基本的なパラメータ化
```python
import pytest

@pytest.mark.parametrize("input,expected", [
    (2, 4),
    (3, 9),
    (4, 16),
    (-2, 4),
])
def test_square(input, expected):
    """複数の入力でテスト"""
    assert square(input) == expected

@pytest.mark.parametrize("x,y,expected", [
    (2, 3, 5),
    (0, 0, 0),
    (-1, 1, 0),
    pytest.param(1, 1, 3, marks=pytest.mark.xfail),  # 失敗が予想される
])
def test_addition(x, y, expected):
    assert add(x, y) == expected
```

### 複雑なパラメータ化
```python
@pytest.mark.parametrize("test_input,expected,description", [
    (
        {"name": "Alice", "age": 30},
        True,
        "Valid user data"
    ),
    (
        {"name": "", "age": 30},
        False,
        "Empty name should fail"
    ),
    (
        {"name": "Bob", "age": -1},
        False,
        "Negative age should fail"
    ),
], ids=lambda x: x if isinstance(x, str) else str(x))
def test_validate_user(test_input, expected, description):
    """IDを使った見やすいテストレポート"""
    assert validate_user(test_input) == expected
```

## 非同期テスト

### pytest-asyncio使用
```python
import pytest
import asyncio
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_async_function():
    """非同期関数のテスト"""
    result = await async_process_data("input")
    assert result == "processed"

@pytest.mark.asyncio
async def test_async_api_call():
    """非同期APIコールのテスト"""
    async with AsyncClient() as client:
        response = await client.get("https://api.example.com/data")
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_concurrent_operations():
    """並行処理のテスト"""
    tasks = [
        process_item(i) for i in range(10)
    ]
    results = await asyncio.gather(*tasks)
    assert len(results) == 10
    assert all(r["status"] == "completed" for r in results)
```

## プロパティベーステスト (Hypothesis)

### Hypothesis使用
```python
from hypothesis import given, strategies as st
import hypothesis.strategies as st

@given(st.integers())
def test_double_is_even(x):
    """任意の整数の2倍は偶数"""
    assert (x * 2) % 2 == 0

@given(
    st.lists(st.integers(), min_size=1)
)
def test_list_reversal(lst):
    """リストの2回反転は元に戻る"""
    assert list(reversed(list(reversed(lst)))) == lst

@given(
    username=st.text(min_size=3, max_size=20),
    age=st.integers(min_value=0, max_value=120)
)
def test_user_creation(username, age):
    """ユーザー作成のプロパティテスト"""
    user = create_user(username, age)
    assert user.username == username
    assert user.age == age
    assert user.id is not None
```

## カバレッジとレポート

### カバレッジ設定
```toml
# pyproject.toml
[tool.coverage.run]
source = ["src"]
branch = true
parallel = true
omit = [
    "*/tests/*",
    "*/migrations/*",
    "*/__init__.py",
]

[tool.coverage.report]
precision = 2
show_missing = true
skip_covered = true
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
]

[tool.coverage.html]
directory = "htmlcov"
```

### カスタムマーカー
```python
import pytest

@pytest.mark.slow
def test_heavy_computation():
    """時間のかかるテスト"""
    result = expensive_calculation()
    assert result == expected

@pytest.mark.integration
@pytest.mark.requires_db
def test_database_integration():
    """データベース統合テスト"""
    pass

# 実行例
# pytest -m "not slow"  # slowマーカーを除外
# pytest -m integration  # integrationマーカーのみ実行
```

## テストダブル

### テストダブルパターン
```python
class FakeEmailService:
    """フェイク実装"""
    def __init__(self):
        self.sent_emails = []
    
    def send(self, to, subject, body):
        self.sent_emails.append({
            "to": to,
            "subject": subject,
            "body": body
        })
        return True

class StubDatabase:
    """スタブ実装"""
    def get_user(self, user_id):
        return {"id": user_id, "name": "Stub User"}
    
    def save_user(self, user):
        return True

@pytest.fixture
def fake_email_service():
    return FakeEmailService()

def test_user_registration(fake_email_service):
    service = UserService(email_service=fake_email_service)
    service.register_user("test@example.com")
    
    assert len(fake_email_service.sent_emails) == 1
    assert fake_email_service.sent_emails[0]["to"] == "test@example.com"
```

## ベストプラクティス

### テスト命名規則
```python
def test_should_return_user_when_valid_id_provided():
    """明確な意図を示すテスト名"""
    pass

def test_raises_exception_when_invalid_input():
    """例外ケースの明示"""
    pass

class TestUserService:
    """関連するテストをグループ化"""
    
    def test_create_user_success(self):
        pass
    
    def test_create_user_duplicate_email(self):
        pass
    
    def test_update_user_not_found(self):
        pass
```

### アサーションベストプラクティス
```python
# Good - 具体的なアサーション
assert response.status_code == 200
assert len(users) == 3
assert user.email == "test@example.com"

# Better - カスタムメッセージ付き
assert response.status_code == 200, f"Expected 200, got {response.status_code}"

# pytest特有の強力なアサーション
import pytest

with pytest.raises(ValueError, match="Invalid email"):
    validate_email("not-an-email")

# 近似値の比較
assert result == pytest.approx(0.1 + 0.2)

# 警告のテスト
with pytest.warns(DeprecationWarning):
    old_function()
```

## チェックリスト
- [ ] 適切なテスト構造とディレクトリ配置
- [ ] フィクスチャの効果的な活用
- [ ] モックの適切な使用
- [ ] パラメータ化テストでのカバレッジ向上
- [ ] 非同期テストの実装
- [ ] プロパティベーステスト検討
- [ ] カバレッジ目標の設定（80%以上）
- [ ] CI/CDパイプラインへの統合