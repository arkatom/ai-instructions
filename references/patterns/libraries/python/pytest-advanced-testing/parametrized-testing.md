## Parametrized Testing

### 1. 高度なパラメータ化テスト

```python
import pytest
from typing import List, Dict, Any, Union
import itertools
from dataclasses import dataclass
from enum import Enum

class TestCategory(Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    EDGE_CASE = "edge_case"
    PERFORMANCE = "performance"

@dataclass
class TestCase:
    """構造化テストケース"""
    name: str
    input_data: Dict[str, Any]
    expected_result: Any
    category: TestCategory
    should_raise: Exception = None
    marks: List[str] = None
    timeout: float = None

# 複雑なパラメータ化パターン
class TestDataBuilder:
    """テストデータビルダー"""
    
    def __init__(self):
        self.test_cases: List[TestCase] = []
    
    def add_positive_case(self, name: str, input_data: Dict[str, Any], expected: Any, **kwargs):
        """ポジティブテストケースの追加"""
        self.test_cases.append(TestCase(
            name=name,
            input_data=input_data,
            expected_result=expected,
            category=TestCategory.POSITIVE,
            **kwargs
        ))
        return self
    
    def add_negative_case(self, name: str, input_data: Dict[str, Any], exception: Exception, **kwargs):
        """ネガティブテストケースの追加"""
        self.test_cases.append(TestCase(
            name=name,
            input_data=input_data,
            expected_result=None,
            category=TestCategory.NEGATIVE,
            should_raise=exception,
            **kwargs
        ))
        return self
    
    def add_edge_case(self, name: str, input_data: Dict[str, Any], expected: Any, **kwargs):
        """エッジケースの追加"""
        self.test_cases.append(TestCase(
            name=name,
            input_data=input_data,
            expected_result=expected,
            category=TestCategory.EDGE_CASE,
            **kwargs
        ))
        return self
    
    def add_performance_case(self, name: str, input_data: Dict[str, Any], expected: Any, timeout: float, **kwargs):
        """パフォーマンステストケースの追加"""
        self.test_cases.append(TestCase(
            name=name,
            input_data=input_data,
            expected_result=expected,
            category=TestCategory.PERFORMANCE,
            timeout=timeout,
            marks=["performance"] + (kwargs.get("marks", [])),
            **kwargs
        ))
        return self
    
    def build(self) -> List[TestCase]:
        """テストケースリストの構築"""
        return self.test_cases

# 数学関数のテストケース例
def create_math_function_test_cases():
    """数学関数テストケースの作成"""
    builder = TestDataBuilder()
    
    # ポジティブケース
    builder.add_positive_case(
        "basic_addition",
        {"a": 2, "b": 3},
        5
    ).add_positive_case(
        "large_numbers",
        {"a": 1000000, "b": 2000000},
        3000000
    ).add_positive_case(
        "decimal_numbers",
        {"a": 1.5, "b": 2.7},
        4.2
    )
    
    # ネガティブケース
    builder.add_negative_case(
        "invalid_type_string",
        {"a": "invalid", "b": 3},
        TypeError
    ).add_negative_case(
        "invalid_type_none",
        {"a": None, "b": 3},
        TypeError
    )
    
    # エッジケース
    builder.add_edge_case(
        "zero_values",
        {"a": 0, "b": 0},
        0
    ).add_edge_case(
        "negative_numbers",
        {"a": -5, "b": -3},
        -8
    ).add_edge_case(
        "very_small_numbers",
        {"a": 1e-10, "b": 2e-10},
        3e-10
    )
    
    # パフォーマンスケース
    builder.add_performance_case(
        "large_computation",
        {"a": 10**6, "b": 10**6},
        2 * 10**6,
        timeout=1.0
    )
    
    return builder.build()

# パラメータ化テストの実装
math_test_cases = create_math_function_test_cases()

@pytest.mark.parametrize(
    "test_case",
    math_test_cases,
    ids=[case.name for case in math_test_cases]
)
def test_math_function(test_case: TestCase):
    """数学関数の包括的テスト"""
    from myapp.math_utils import add_numbers
    
    # タイムアウト設定
    if test_case.timeout:
        pytest.mark.timeout(test_case.timeout)
    
    # テストカテゴリに応じた処理
    if test_case.category == TestCategory.NEGATIVE:
        with pytest.raises(test_case.should_raise):
            add_numbers(**test_case.input_data)
    else:
        result = add_numbers(**test_case.input_data)
        
        if test_case.category == TestCategory.POSITIVE:
            assert result == test_case.expected_result
        elif test_case.category == TestCategory.EDGE_CASE:
            # エッジケースは許容誤差を考慮
            if isinstance(result, float):
                assert abs(result - test_case.expected_result) < 1e-10
            else:
                assert result == test_case.expected_result
        elif test_case.category == TestCategory.PERFORMANCE:
            assert result == test_case.expected_result
            # パフォーマンス要件は @pytest.mark.timeout で制御

# カテゴリフィルタリング
@pytest.mark.parametrize(
    "test_case",
    [case for case in math_test_cases if case.category == TestCategory.POSITIVE],
    ids=[case.name for case in math_test_cases if case.category == TestCategory.POSITIVE]
)
def test_math_function_positive_only(test_case: TestCase):
    """ポジティブテストケースのみ"""
    from myapp.math_utils import add_numbers
    result = add_numbers(**test_case.input_data)
    assert result == test_case.expected_result

# 組み合わせテスト（Combinatorial Testing）
@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE"])
@pytest.mark.parametrize("status_code", [200, 404, 500])
@pytest.mark.parametrize("content_type", ["application/json", "text/html"])
def test_api_combinations(method, status_code, content_type):
    """API エンドポイントの組み合わせテスト"""
    # 全ての組み合わせをテスト（4 × 3 × 2 = 24 テストケース）
    response = simulate_api_call(method, status_code, content_type)
    
    # 基本的な検証
    assert response.method == method
    assert response.status_code == status_code
    assert response.content_type == content_type

# 条件付きパラメータ化
def pytest_generate_tests(metafunc):
    """動的パラメータ化"""
    if "database_config" in metafunc.fixturenames:
        # 環境変数に基づいてデータベース設定を変更
        import os
        
        configs = []
        if os.getenv("TEST_SQLITE"):
            configs.append(("sqlite", "sqlite:///:memory:"))
        if os.getenv("TEST_POSTGRESQL"):
            configs.append(("postgresql", "postgresql://localhost/testdb"))
        if os.getenv("TEST_MYSQL"):
            configs.append(("mysql", "mysql://localhost/testdb"))
        
        if not configs:
            configs = [("sqlite", "sqlite:///:memory:")]  # デフォルト
        
        metafunc.parametrize("database_config", configs, ids=[config[0] for config in configs])

# データドリブンテスト
@pytest.mark.parametrize(
    "user_data,expected_validation",
    [
        # 有効なユーザーデータ
        (
            {"username": "validuser", "email": "user@example.com", "age": 25},
            {"valid": True, "errors": []}
        ),
        # 無効なユーザーデータ
        (
            {"username": "", "email": "invalid-email", "age": -1},
            {"valid": False, "errors": ["username_required", "invalid_email", "invalid_age"]}
        ),
        # エッジケース
        (
            {"username": "a" * 100, "email": "edge@example.com", "age": 0},
            {"valid": False, "errors": ["username_too_long", "invalid_age"]}
        )
    ]
)
def test_user_validation(user_data, expected_validation):
    """ユーザーデータ検証のテスト"""
    from myapp.validators import validate_user
    
    result = validate_user(user_data)
    
    assert result["valid"] == expected_validation["valid"]
    assert set(result["errors"]) == set(expected_validation["errors"])
```

### 2. 外部データソースからのパラメータ化

```python
import pytest
import csv
import json
import yaml
from pathlib import Path
from typing import List, Dict, Any
import pandas as pd

class ExternalTestDataLoader:
    """外部テストデータローダー"""
    
    @staticmethod
    def load_csv(file_path: str) -> List[Dict[str, Any]]:
        """CSVファイルからテストデータを読み込み"""
        test_data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 型変換の試行
                converted_row = {}
                for key, value in row.items():
                    # 数値変換の試行
                    try:
                        if '.' in value:
                            converted_row[key] = float(value)
                        else:
                            converted_row[key] = int(value)
                    except ValueError:
                        # ブール値変換の試行
                        if value.lower() in ('true', 'false'):
                            converted_row[key] = value.lower() == 'true'
                        # NULL値の処理
                        elif value.lower() in ('null', 'none', ''):
                            converted_row[key] = None
                        else:
                            converted_row[key] = value
                
                test_data.append(converted_row)
        
        return test_data
    
    @staticmethod
    def load_json(file_path: str) -> List[Dict[str, Any]]:
        """JSONファイルからテストデータを読み込み"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def load_yaml(file_path: str) -> List[Dict[str, Any]]:
        """YAMLファイルからテストデータを読み込み"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @staticmethod
    def load_excel(file_path: str, sheet_name: str = None) -> List[Dict[str, Any]]:
        """Excelファイルからテストデータを読み込み"""
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        return df.to_dict('records')

# テストデータファイルパス
TEST_DATA_DIR = Path(__file__).parent / "test_data"

# CSVからのデータ読み込み例
def load_api_test_data():
    """API テストデータの読み込み"""
    csv_file = TEST_DATA_DIR / "api_test_cases.csv"
    if csv_file.exists():
        return ExternalTestDataLoader.load_csv(str(csv_file))
    else:
        # フォールバックデータ
        return [
            {"endpoint": "/api/users", "method": "GET", "expected_status": 200},
            {"endpoint": "/api/users/1", "method": "GET", "expected_status": 200},
            {"endpoint": "/api/users/999", "method": "GET", "expected_status": 404}
        ]

# JSONからの複雑なテストシナリオ
def load_integration_test_scenarios():
    """統合テストシナリオの読み込み"""
    json_file = TEST_DATA_DIR / "integration_scenarios.json"
    if json_file.exists():
        return ExternalTestDataLoader.load_json(str(json_file))
    else:
        return []

# パラメータ化テストの実装
api_test_data = load_api_test_data()

@pytest.mark.parametrize(
    "test_data",
    api_test_data,
    ids=[f"{data['method']}_{data['endpoint']}" for data in api_test_data]
)
def test_api_endpoints(test_data, client):
    """外部データドリブンAPIテスト"""
    method = test_data["method"].lower()
    endpoint = test_data["endpoint"]
    expected_status = test_data["expected_status"]
    
    # HTTP メソッドの動的呼び出し
    response = getattr(client, method)(endpoint)
    
    assert response.status_code == expected_status
    
    # 追加の検証ルール
    if "expected_keys" in test_data:
        response_json = response.json()
        for key in test_data["expected_keys"]:
            assert key in response_json
    
    if "response_validation" in test_data:
        validation_rules = test_data["response_validation"]
        response_json = response.json()
        
        for rule in validation_rules:
            field = rule["field"]
            condition = rule["condition"]
            value = rule["value"]
            
            if condition == "equals":
                assert response_json[field] == value
            elif condition == "contains":
                assert value in response_json[field]
            elif condition == "min_length":
                assert len(response_json[field]) >= value

# YAMLベースのテストシナリオ
@pytest.mark.parametrize(
    "scenario",
    load_integration_test_scenarios(),
    ids=lambda scenario: scenario.get("name", "unnamed_scenario")
)
def test_integration_scenarios(scenario, complete_test_environment):
    """YAML定義による統合テストシナリオ"""
    steps = scenario.get("steps", [])
    setup = scenario.get("setup", {})
    teardown = scenario.get("teardown", {})
    
    # セットアップ実行
    for setup_step in setup.get("actions", []):
        execute_test_action(setup_step, complete_test_environment)
    
    try:
        # テストステップの実行
        for step in steps:
            execute_test_action(step, complete_test_environment)
    
    finally:
        # ティアダウン実行
        for teardown_step in teardown.get("actions", []):
            execute_test_action(teardown_step, complete_test_environment)

def execute_test_action(action: Dict[str, Any], test_env: Dict[str, Any]):
    """テストアクションの実行"""
    action_type = action["type"]
    
    if action_type == "http_request":
        client = test_env["client"]
        method = action["method"].lower()
        url = action["url"]
        
        response = getattr(client, method)(url, **action.get("params", {}))
        
        # アサーション
        if "assertions" in action:
            for assertion in action["assertions"]:
                assert_type = assertion["type"]
                
                if assert_type == "status_code":
                    assert response.status_code == assertion["value"]
                elif assert_type == "response_contains":
                    assert assertion["value"] in response.text
    
    elif action_type == "database_query":
        db_session = test_env["db_session"]
        query = action["query"]
        
        result = db_session.execute(query)
        
        if "assertions" in action:
            for assertion in action["assertions"]:
                if assertion["type"] == "row_count":
                    assert result.rowcount == assertion["value"]
    
    elif action_type == "file_operation":
        temp_dir = test_env["temp_dir"]
        operation = action["operation"]
        
        if operation == "create_file":
            file_path = temp_dir / action["filename"]
            file_path.write_text(action["content"])
        elif operation == "check_file_exists":
            file_path = temp_dir / action["filename"]
            assert file_path.exists()

# データファイル生成ヘルパー
def generate_test_data_files():
    """テストデータファイルの生成（開発用）"""
    # CSV テストデータの生成
    csv_data = [
        {"endpoint": "/api/users", "method": "GET", "expected_status": 200, "expected_keys": "id,username,email"},
        {"endpoint": "/api/users/1", "method": "GET", "expected_status": 200, "expected_keys": "id,username,email"},
        {"endpoint": "/api/users/999", "method": "GET", "expected_status": 404, "expected_keys": "error"},
        {"endpoint": "/api/users", "method": "POST", "expected_status": 201, "expected_keys": "id,username,email"}
    ]
    
    csv_file = TEST_DATA_DIR / "api_test_cases.csv"
    csv_file.parent.mkdir(exist_ok=True)
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=csv_data[0].keys())
        writer.writeheader()
        writer.writerows(csv_data)
    
    # JSON テストシナリオの生成
    scenarios = [
        {
            "name": "user_registration_flow",
            "description": "ユーザー登録フローのテスト",
            "setup": {
                "actions": [
                    {"type": "database_query", "query": "DELETE FROM users WHERE username = 'testuser'"}
                ]
            },
            "steps": [
                {
                    "type": "http_request",
                    "method": "POST",
                    "url": "/api/register",
                    "params": {"json": {"username": "testuser", "email": "test@example.com", "password": "password123"}},
                    "assertions": [
                        {"type": "status_code", "value": 201},
                        {"type": "response_contains", "value": "testuser"}
                    ]
                },
                {
                    "type": "database_query",
                    "query": "SELECT COUNT(*) FROM users WHERE username = 'testuser'",
                    "assertions": [
                        {"type": "row_count", "value": 1}
                    ]
                }
            ],
            "teardown": {
                "actions": [
                    {"type": "database_query", "query": "DELETE FROM users WHERE username = 'testuser'"}
                ]
            }
        }
    ]
    
    json_file = TEST_DATA_DIR / "integration_scenarios.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(scenarios, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    generate_test_data_files()
```

