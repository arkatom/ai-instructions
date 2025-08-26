## Advanced Fixtures Patterns

### 1. 階層化フィクスチャシステム

```python
import pytest
import asyncio
import docker
import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator, AsyncGenerator, Dict, Any
import tempfile
import shutil
from pathlib import Path

# スコープ別フィクスチャの構築
@pytest.fixture(scope="session")
def docker_client():
    """Dockerクライアント（セッション全体で共有）"""
    client = docker.from_env()
    yield client
    client.close()

@pytest.fixture(scope="session")
def postgres_container(docker_client):
    """PostgreSQLコンテナ（セッション全体で共有）"""
    container = docker_client.containers.run(
        "postgres:14",
        environment={
            "POSTGRES_DB": "testdb",
            "POSTGRES_USER": "testuser",
            "POSTGRES_PASSWORD": "testpass"
        },
        ports={"5432/tcp": None},
        detach=True,
        remove=True
    )
    
    # コンテナの起動を待機
    import time
    time.sleep(5)
    
    # 接続情報の取得
    port = container.attrs['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']
    container.connection_url = f"postgresql://testuser:testpass@localhost:{port}/testdb"
    
    yield container
    
    container.stop()

@pytest.fixture(scope="module")
def database_engine(postgres_container):
    """データベースエンジン（モジュール全体で共有）"""
    engine = create_engine(postgres_container.connection_url)
    
    # テーブルの作成
    from myapp.models import Base
    Base.metadata.create_all(engine)
    
    yield engine
    
    # テーブルのクリーンアップ
    Base.metadata.drop_all(engine)
    engine.dispose()

@pytest.fixture(scope="function")
def db_session(database_engine):
    """データベースセッション（テスト関数ごとに作成）"""
    Session = sessionmaker(bind=database_engine)
    session = Session()
    
    # トランザクションの開始
    transaction = session.begin()
    
    yield session
    
    # ロールバック（テスト間の独立性を保証）
    transaction.rollback()
    session.close()

@pytest.fixture(scope="function")
def temp_directory():
    """一時ディレクトリ（テスト関数ごとに作成）"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

# 複雑な依存関係を持つフィクスチャ
@pytest.fixture
def test_user(db_session):
    """テストユーザーの作成"""
    from myapp.models import User
    
    user = User(
        username="testuser",
        email="test@example.com",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    yield user
    
    # ユーザーの削除（必要に応じて）
    db_session.delete(user)
    db_session.commit()

@pytest.fixture
def authenticated_client(test_user, client):
    """認証済みクライアント"""
    # JWTトークンの生成
    from myapp.auth import create_access_token
    
    token = create_access_token(data={"sub": test_user.username})
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    yield client
    
    # ヘッダーのクリーンアップ
    if "Authorization" in client.headers:
        del client.headers["Authorization"]

# フィクスチャファクトリーパターン
@pytest.fixture
def user_factory(db_session):
    """ユーザーファクトリー"""
    created_users = []
    
    def _create_user(username=None, email=None, **kwargs):
        from myapp.models import User
        import uuid
        
        if username is None:
            username = f"user_{uuid.uuid4().hex[:8]}"
        if email is None:
            email = f"{username}@example.com"
        
        user = User(username=username, email=email, **kwargs)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        created_users.append(user)
        return user
    
    yield _create_user
    
    # 作成されたユーザーのクリーンアップ
    for user in created_users:
        db_session.delete(user)
    db_session.commit()

# パラメータ化フィクスチャ
@pytest.fixture(params=["sqlite", "postgresql", "mysql"])
def database_url(request, postgres_container):
    """複数のデータベースでテスト"""
    if request.param == "sqlite":
        return "sqlite:///:memory:"
    elif request.param == "postgresql":
        return postgres_container.connection_url
    elif request.param == "mysql":
        # MySQL設定（実装は省略）
        return "mysql://testuser:testpass@localhost/testdb"

# 条件付きフィクスチャ
@pytest.fixture
def redis_client():
    """Redis接続（Redisが利用可能な場合のみ）"""
    pytest.importorskip("redis")
    
    try:
        import redis
        client = redis.Redis(host='localhost', port=6379, db=0)
        client.ping()  # 接続テスト
        yield client
    except redis.ConnectionError:
        pytest.skip("Redis server not available")

# フィクスチャ組み合わせパターン
@pytest.fixture
def complete_test_environment(
    db_session,
    authenticated_client,
    temp_directory,
    user_factory
):
    """完全なテスト環境"""
    # 追加のテストデータ作成
    admin_user = user_factory(username="admin", is_admin=True)
    regular_users = [user_factory() for _ in range(5)]
    
    # テスト設定ファイルの作成
    config_file = temp_directory / "test_config.json"
    config_file.write_text('{"test_mode": true}')
    
    return {
        "db_session": db_session,
        "client": authenticated_client,
        "temp_dir": temp_directory,
        "admin_user": admin_user,
        "regular_users": regular_users,
        "config_file": config_file
    }
```

### 2. 動的フィクスチャ生成

```python
import pytest
from typing import Dict, Any, List
import json
import yaml

class FixtureRegistry:
    """動的フィクスチャレジストリ"""
    
    def __init__(self):
        self.fixtures: Dict[str, Any] = {}
        self.fixture_configs: Dict[str, Dict[str, Any]] = {}
    
    def register_fixture(self, name: str, factory_func, config: Dict[str, Any] = None):
        """フィクスチャの動的登録"""
        self.fixtures[name] = factory_func
        self.fixture_configs[name] = config or {}
    
    def create_fixture(self, name: str, **kwargs):
        """フィクスチャの動的作成"""
        if name not in self.fixtures:
            raise ValueError(f"Fixture {name} not registered")
        
        config = {**self.fixture_configs[name], **kwargs}
        return self.fixtures[name](**config)

# グローバルレジストリ
fixture_registry = FixtureRegistry()

def pytest_generate_tests(metafunc):
    """テストケースの動的生成"""
    # テストデータファイルからパラメータを読み込み
    if "test_data" in metafunc.fixturenames:
        test_data_file = metafunc.config.getoption("--test-data-file")
        if test_data_file:
            with open(test_data_file, 'r') as f:
                if test_data_file.endswith('.json'):
                    test_data = json.load(f)
                else:
                    test_data = yaml.safe_load(f)
            
            metafunc.parametrize("test_data", test_data)

def pytest_configure(config):
    """pytest設定時の動的フィクスチャ登録"""
    # 設定ファイルからフィクスチャを読み込み
    fixtures_config = config.getoption("--fixtures-config")
    if fixtures_config:
        with open(fixtures_config, 'r') as f:
            config_data = yaml.safe_load(f)
        
        for fixture_name, fixture_config in config_data.get("fixtures", {}).items():
            register_dynamic_fixture(fixture_name, fixture_config)

def register_dynamic_fixture(name: str, config: Dict[str, Any]):
    """動的フィクスチャの登録"""
    fixture_type = config.get("type", "simple")
    
    if fixture_type == "database_record":
        def factory(**kwargs):
            return create_database_record(config["model"], {**config.get("defaults", {}), **kwargs})
        
        fixture_registry.register_fixture(name, factory, config)
    
    elif fixture_type == "api_mock":
        def factory(**kwargs):
            return create_api_mock(config["endpoints"], {**config.get("defaults", {}), **kwargs})
        
        fixture_registry.register_fixture(name, factory, config)

def create_database_record(model_name: str, data: Dict[str, Any]):
    """データベースレコードの動的作成"""
    # モデルクラスの動的取得
    from myapp.models import get_model_by_name
    
    model_class = get_model_by_name(model_name)
    return model_class(**data)

def create_api_mock(endpoints: List[Dict[str, Any]], config: Dict[str, Any]):
    """APIモックの動的作成"""
    from unittest.mock import Mock
    
    mock = Mock()
    
    for endpoint in endpoints:
        method = endpoint["method"].lower()
        path = endpoint["path"]
        response_data = endpoint.get("response", {})
        
        # モックメソッドの設定
        mock_method = getattr(mock, method)
        mock_method.return_value.json.return_value = response_data
        mock_method.return_value.status_code = endpoint.get("status_code", 200)
    
    return mock

# 設定ファイルベースのテストケース生成
@pytest.fixture
def dynamic_test_case(request):
    """設定ファイルベースの動的テストケース"""
    # マーカーからテストケース設定を取得
    test_config = request.node.get_closest_marker("test_config")
    
    if test_config:
        config_data = test_config.args[0]
        
        # 必要なフィクスチャを動的に作成
        fixtures = {}
        for fixture_name, fixture_config in config_data.get("fixtures", {}).items():
            fixtures[fixture_name] = fixture_registry.create_fixture(fixture_name, **fixture_config)
        
        return {
            "config": config_data,
            "fixtures": fixtures,
            "expected_results": config_data.get("expected_results", {}),
            "test_data": config_data.get("test_data", {})
        }
    
    return {}

# 使用例
@pytest.mark.test_config({
    "fixtures": {
        "test_user": {
            "type": "database_record",
            "model": "User",
            "username": "dynamic_user",
            "email": "dynamic@example.com"
        },
        "api_mock": {
            "type": "api_mock",
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/api/users",
                    "response": {"users": []},
                    "status_code": 200
                }
            ]
        }
    },
    "test_data": {
        "input_value": 42,
        "expected_output": 84
    },
    "expected_results": {
        "status_code": 200,
        "response_contains": ["success"]
    }
})
def test_dynamic_configuration(dynamic_test_case):
    """動的設定ベースのテスト"""
    config = dynamic_test_case["config"]
    fixtures = dynamic_test_case["fixtures"]
    test_data = dynamic_test_case["test_data"]
    expected = dynamic_test_case["expected_results"]
    
    # テストロジック
    assert fixtures["test_user"].username == "dynamic_user"
    assert test_data["input_value"] * 2 == test_data["expected_output"]
```

