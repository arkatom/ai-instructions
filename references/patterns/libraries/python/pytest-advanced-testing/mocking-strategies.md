## Mocking Strategies

### 1. 高度なモッキングパターン

```python
import pytest
from unittest.mock import Mock, MagicMock, patch, call, AsyncMock
from unittest.mock import PropertyMock, mock_open
import requests
import asyncio
from typing import Any, Dict, List
import json
import os
import tempfile

# 基本的なモックパターン
class EmailService:
    """メールサービス（モック対象）"""
    
    def __init__(self, smtp_server: str, port: int = 587):
        self.smtp_server = smtp_server
        self.port = port
        self.connection = None
    
    def connect(self) -> bool:
        """SMTP接続"""
        # 実際のSMTP接続ロジック
        return True
    
    def send_email(self, to: str, subject: str, body: str) -> bool:
        """メール送信"""
        if not self.connection:
            if not self.connect():
                return False
        
        # 実際のメール送信ロジック
        return True
    
    def disconnect(self):
        """接続切断"""
        self.connection = None

class UserService:
    """ユーザーサービス"""
    
    def __init__(self, email_service: EmailService):
        self.email_service = email_service
    
    def register_user(self, username: str, email: str) -> Dict[str, Any]:
        """ユーザー登録"""
        # ユーザー登録ロジック
        user_id = 12345  # データベースから取得したと仮定
        
        # ウェルカムメールの送信
        welcome_sent = self.email_service.send_email(
            to=email,
            subject="Welcome to our service!",
            body=f"Hello {username}, welcome to our platform!"
        )
        
        return {
            "user_id": user_id,
            "username": username,
            "email": email,
            "welcome_email_sent": welcome_sent
        }

# モックを使用したテスト
def test_user_registration_with_mock():
    """モックを使用したユーザー登録テスト"""
    # メールサービスのモック作成
    mock_email_service = Mock(spec=EmailService)
    mock_email_service.send_email.return_value = True
    
    # ユーザーサービスの作成
    user_service = UserService(mock_email_service)
    
    # ユーザー登録の実行
    result = user_service.register_user("testuser", "test@example.com")
    
    # アサーション
    assert result["user_id"] == 12345
    assert result["username"] == "testuser"
    assert result["email"] == "test@example.com"
    assert result["welcome_email_sent"] is True
    
    # モックの呼び出し確認
    mock_email_service.send_email.assert_called_once_with(
        to="test@example.com",
        subject="Welcome to our service!",
        body="Hello testuser, welcome to our platform!"
    )

# パッチデコレータを使用したテスト
@patch('requests.get')
def test_api_client_with_patch(mock_get):
    """パッチデコレータを使用したAPIクライアントテスト"""
    # モックレスポンスの設定
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": 1,
        "name": "Test User",
        "email": "test@example.com"
    }
    mock_get.return_value = mock_response
    
    # APIクライアントの実行
    from myapp.api_client import get_user
    result = get_user(user_id=1)
    
    # アサーション
    assert result["name"] == "Test User"
    assert result["email"] == "test@example.com"
    
    # HTTPリクエストの確認
    mock_get.assert_called_once_with("https://api.example.com/users/1")

# コンテキストマネージャーを使用したパッチ
def test_file_operations_with_context_patch():
    """コンテキストマネージャーパッチのテスト"""
    from myapp.file_utils import save_user_data
    
    # ファイル書き込みのモック
    mock_file_content = ""
    
    def mock_write(content):
        nonlocal mock_file_content
        mock_file_content += content
    
    with patch('builtins.open', mock_open()) as mock_file:
        mock_file.return_value.write = mock_write
        
        # ファイル操作の実行
        save_user_data({"name": "John", "age": 30})
        
        # ファイル操作の確認
        mock_file.assert_called_once_with("/tmp/user_data.json", "w")

# 複雑なモックシナリオ
class DatabaseManager:
    """データベース管理クラス"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connection = None
    
    def connect(self):
        """データベース接続"""
        pass
    
    def execute_query(self, query: str, params: List[Any] = None) -> List[Dict[str, Any]]:
        """クエリ実行"""
        pass
    
    def begin_transaction(self):
        """トランザクション開始"""
        pass
    
    def commit_transaction(self):
        """トランザクションコミット"""
        pass
    
    def rollback_transaction(self):
        """トランザクションロールバック"""
        pass

class UserRepository:
    """ユーザーリポジトリ"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_user(self, user_data: Dict[str, Any]) -> int:
        """ユーザー作成"""
        try:
            self.db_manager.begin_transaction()
            
            # ユーザーの重複チェック
            existing_users = self.db_manager.execute_query(
                "SELECT id FROM users WHERE email = ?",
                [user_data["email"]]
            )
            
            if existing_users:
                raise ValueError("User already exists")
            
            # ユーザー作成
            result = self.db_manager.execute_query(
                "INSERT INTO users (username, email) VALUES (?, ?) RETURNING id",
                [user_data["username"], user_data["email"]]
            )
            
            self.db_manager.commit_transaction()
            return result[0]["id"]
            
        except Exception:
            self.db_manager.rollback_transaction()
            raise

def test_user_repository_complex_mock():
    """複雑なモックシナリオのテスト"""
    # データベースマネージャーのモック
    mock_db = Mock(spec=DatabaseManager)
    
    # モックの動作設定
    mock_db.execute_query.side_effect = [
        [],  # 重複チェック（結果なし）
        [{"id": 456}]  # INSERT結果
    ]
    
    # リポジトリの作成とテスト
    repo = UserRepository(mock_db)
    
    user_data = {"username": "newuser", "email": "new@example.com"}
    user_id = repo.create_user(user_data)
    
    # アサーション
    assert user_id == 456
    
    # モック呼び出しの詳細確認
    expected_calls = [
        call("SELECT id FROM users WHERE email = ?", ["new@example.com"]),
        call("INSERT INTO users (username, email) VALUES (?, ?) RETURNING id", ["newuser", "new@example.com"])
    ]
    mock_db.execute_query.assert_has_calls(expected_calls)
    
    # トランザクション処理の確認
    mock_db.begin_transaction.assert_called_once()
    mock_db.commit_transaction.assert_called_once()
    mock_db.rollback_transaction.assert_not_called()

def test_user_repository_exception_handling():
    """例外処理のモックテスト"""
    mock_db = Mock(spec=DatabaseManager)
    
    # 重複ユーザーのシナリオ
    mock_db.execute_query.return_value = [{"id": 123}]  # 既存ユーザーあり
    
    repo = UserRepository(mock_db)
    
    user_data = {"username": "duplicate", "email": "duplicate@example.com"}
    
    # 例外の発生確認
    with pytest.raises(ValueError, match="User already exists"):
        repo.create_user(user_data)
    
    # ロールバックの確認
    mock_db.rollback_transaction.assert_called_once()
    mock_db.commit_transaction.assert_not_called()

# プロパティモック
class User:
    """ユーザークラス"""
    
    def __init__(self, username: str, email: str):
        self._username = username
        self._email = email
        self._is_verified = False
    
    @property
    def username(self) -> str:
        return self._username
    
    @property
    def email(self) -> str:
        return self._email
    
    @property
    def is_verified(self) -> bool:
        # 実際には外部APIでの検証ロジックがある
        return self._is_verified
    
    def verify_email(self) -> bool:
        """メール検証"""
        # 外部API呼び出し
        self._is_verified = True
        return True

def test_user_property_mock():
    """プロパティモックのテスト"""
    user = User("testuser", "test@example.com")
    
    # プロパティのモック
    with patch.object(User, 'is_verified', new_callable=PropertyMock) as mock_verified:
        mock_verified.return_value = True
        
        # プロパティの確認
        assert user.is_verified is True
        
        # プロパティアクセスの確認
        mock_verified.assert_called()

# 環境変数のモック
def test_environment_variables_mock():
    """環境変数のモックテスト"""
    from myapp.config import get_database_url
    
    # 環境変数のモック
    with patch.dict(os.environ, {
        'DATABASE_URL': 'postgresql://test:test@localhost/testdb',
        'DEBUG': 'true'
    }):
        db_url = get_database_url()
        assert db_url == 'postgresql://test:test@localhost/testdb'

# ファイルシステムのモック
def test_file_system_mock():
    """ファイルシステムのモックテスト"""
    from myapp.file_manager import load_config
    
    # ファイル内容のモック
    mock_config = {
        "database": {"host": "localhost", "port": 5432},
        "redis": {"host": "localhost", "port": 6379}
    }
    
    with patch('builtins.open', mock_open(read_data=json.dumps(mock_config))):
        config = load_config('/path/to/config.json')
        
        assert config["database"]["host"] == "localhost"
        assert config["redis"]["port"] == 6379

# 時間のモック
def test_time_mock():
    """時間のモックテスト"""
    from myapp.utils import get_timestamp
    import time
    
    fixed_time = 1609459200.0  # 2021-01-01 00:00:00 UTC
    
    with patch('time.time', return_value=fixed_time):
        timestamp = get_timestamp()
        assert timestamp == fixed_time

# 非同期モック
@pytest.mark.asyncio
async def test_async_mock_example():
    """非同期モックの例"""
    
    async def async_api_call(url: str) -> Dict[str, Any]:
        """非同期API呼び出し（モック対象）"""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.json()
    
    # 非同期関数のモック
    with patch('myapp.api.async_api_call', new_callable=AsyncMock) as mock_api:
        mock_api.return_value = {"status": "success", "data": [1, 2, 3]}
        
        from myapp.service import process_data
        result = await process_data()
        
        assert result["status"] == "success"
        mock_api.assert_awaited_once()

# モッククラスの継承
class MockEmailService(EmailService):
    """EmailServiceのモック実装"""
    
    def __init__(self):
        super().__init__("mock_server")
        self.sent_emails = []
        self.connected = False
    
    def connect(self) -> bool:
        self.connected = True
        return True
    
    def send_email(self, to: str, subject: str, body: str) -> bool:
        if not self.connected:
            return False
        
        self.sent_emails.append({
            "to": to,
            "subject": subject,
            "body": body
        })
        return True
    
    def disconnect(self):
        self.connected = False

def test_custom_mock_class():
    """カスタムモッククラスのテスト"""
    mock_email_service = MockEmailService()
    user_service = UserService(mock_email_service)
    
    result = user_service.register_user("testuser", "test@example.com")
    
    assert result["welcome_email_sent"] is True
    assert len(mock_email_service.sent_emails) == 1
    
    sent_email = mock_email_service.sent_emails[0]
    assert sent_email["to"] == "test@example.com"
    assert "testuser" in sent_email["body"]
```

