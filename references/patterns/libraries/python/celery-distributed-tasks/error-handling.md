# Error Handling & Retry Strategies

> 🎯 **目的**: Celeryの企業レベルエラーハンドリングと高度なリトライ戦略
> 
> 📊 **対象**: エラー分類、サーキットブレーカー、通知システム、回復可能タスク
> 
> ⚡ **特徴**: 包括的エラー処理、指数バックオフ、障害復旧、監視連携

## 包括的エラーハンドリングシステム

### エラー分類と処理クラス

```python
from celery.exceptions import Retry, WorkerLostError, SoftTimeLimitExceeded
import traceback
from functools import wraps
from typing import Type, List, Callable, Dict, Any
from dataclasses import dataclass
from enum import Enum
import random
import time
import json
import hashlib

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class RetryPolicy:
    """リトライポリシー設定"""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 300.0
    backoff_factor: float = 2.0
    jitter: bool = True
    exceptions: List[Type[Exception]] = None

class CeleryErrorHandler:
    """企業レベルCeleryエラーハンドラー"""
    
    def __init__(self):
        self.error_callbacks = {}
        self.retry_policies = {}
        self.circuit_breakers = {}
        
        # デフォルトリトライポリシー
        self.default_retry_policy = RetryPolicy(
            max_retries=3,
            base_delay=1.0,
            backoff_factor=2.0,
            exceptions=[ConnectionError, TimeoutError]
        )
    
    def register_error_callback(self, exception_type: Type[Exception], callback: Callable):
        """エラーコールバックの登録"""
        self.error_callbacks[exception_type] = callback
    
    def register_retry_policy(self, task_name: str, policy: RetryPolicy):
        """タスク別リトライポリシーの登録"""
        self.retry_policies[task_name] = policy
    
    def handle_task_error(self, task, exc: Exception, task_id: str, args: tuple, kwargs: dict):
        """タスクエラーの包括的処理"""
        
        # エラーの分類
        severity = self._classify_error(exc)
        
        # エラーログの記録
        self._log_error(task, exc, task_id, args, kwargs, severity)
        
        # エラーコールバックの実行
        self._execute_error_callbacks(exc, task, task_id)
        
        # リトライの判定
        return self._should_retry(task, exc)
    
    def _classify_error(self, exc: Exception) -> ErrorSeverity:
        """エラーの自動分類"""
        
        # ネットワーク関連エラー
        if isinstance(exc, (ConnectionError, TimeoutError)):
            return ErrorSeverity.MEDIUM
        
        # データベース関連エラー
        if 'database' in str(type(exc)).lower() or 'sql' in str(type(exc)).lower():
            return ErrorSeverity.HIGH
        
        # メモリ関連エラー
        if isinstance(exc, MemoryError):
            return ErrorSeverity.CRITICAL
        
        # ワーカー関連エラー
        if isinstance(exc, (WorkerLostError, SoftTimeLimitExceeded)):
            return ErrorSeverity.HIGH
        
        return ErrorSeverity.LOW
    
    def _log_error(self, task, exc: Exception, task_id: str, args: tuple, kwargs: dict, severity: ErrorSeverity):
        """構造化エラーログの記録"""
        
        error_data = {
            'task_id': task_id,
            'task_name': task.name,
            'exception_type': type(exc).__name__,
            'exception_message': str(exc),
            'severity': severity.value,
            'args': args,
            'kwargs': kwargs,
            'traceback': traceback.format_exc(),
            'timestamp': time.time()
        }
        
        # Redis にエラーログを保存
        redis_client = redis.Redis.from_url(app.conf.result_backend)
        redis_client.lpush('celery_errors', json.dumps(error_data))
        redis_client.ltrim('celery_errors', 0, 9999)
        
        # 重大エラーの即座通知
        if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            self._send_critical_error_notification(error_data)
```

## 高度なリトライ戦略

### 堅牢なタスクデコレータ

```python
def robust_task(retry_policy: RetryPolicy = None, error_callback: Callable = None):
    """堅牢なタスクデコレータ"""
    
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            
            # リトライポリシーの設定
            policy = retry_policy or error_handler.retry_policies.get(func.__name__, error_handler.default_retry_policy)
            
            try:
                return func(self, *args, **kwargs)
                
            except Exception as exc:
                
                # エラーハンドリング
                should_retry = error_handler.handle_task_error(self, exc, self.request.id, args, kwargs)
                
                # エラーコールバックの実行
                if error_callback:
                    try:
                        error_callback(exc, self, self.request.id)
                    except Exception:
                        pass
                
                # リトライの実行
                if should_retry and self.request.retries < policy.max_retries:
                    
                    # 指数バックオフの計算
                    delay = policy.base_delay * (policy.backoff_factor ** self.request.retries)
                    delay = min(delay, policy.max_delay)
                    
                    # ジッターの追加
                    if policy.jitter:
                        jitter = random.uniform(0.1, 0.3) * delay
                        delay += jitter
                    
                    logger.warning(f"Task {self.name} failed, retrying in {delay:.2f}s (attempt {self.request.retries + 1}/{policy.max_retries})")
                    
                    raise self.retry(countdown=delay, exc=exc)
                
                # 最終的な失敗
                logger.error(f"Task {self.name} failed permanently after {self.request.retries} retries")
                raise exc
        
        return wrapper
    return decorator

@app.task(bind=True, base=BaseTask)
@robust_task(
    retry_policy=RetryPolicy(
        max_retries=5,
        base_delay=2.0,
        max_delay=120.0,
        exceptions=[ConnectionError, TimeoutError, requests.RequestException]
    )
)
def resilient_api_call(self, url: str, method: str = 'GET', **kwargs):
    """回復可能なAPI呼び出しタスク"""
    
    import requests
    
    try:
        self.update_state(
            state='PROGRESS',
            meta={'status': f'Making {method} request to {url}'}
        )
        
        # APIリクエストの実行
        response = requests.request(method, url, timeout=30, **kwargs)
        response.raise_for_status()
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
        }
        
    except requests.exceptions.HTTPError as exc:
        if exc.response.status_code >= 500:
            # サーバーエラーはリトライ
            raise exc
        else:
            # クライアントエラーはリトライしない
            logger.error(f"Client error for {url}: {exc}")
            raise exc
```

## サーキットブレーカーパターン

### 障害の連鎖防止システム

```python
class CircuitBreaker:
    """サーキットブレーカー実装"""
    
    def __init__(self, failure_threshold: int = 5, timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = 'closed'  # closed, open, half_open
    
    def call(self, func: Callable, *args, **kwargs):
        """サーキットブレーカー経由の関数呼び出し"""
        
        current_time = time.time()
        
        # オープン状態のチェック
        if self.state == 'open':
            if current_time - self.last_failure_time > self.timeout:
                self.state = 'half_open'
            else:
                raise Exception(f"Circuit breaker is open")
        
        try:
            result = func(*args, **kwargs)
            
            # 成功時の処理
            if self.state == 'half_open':
                self.state = 'closed'
                self.failure_count = 0
            
            return result
            
        except Exception as exc:
            self.failure_count += 1
            self.last_failure_time = current_time
            
            if self.failure_count >= self.failure_threshold:
                self.state = 'open'
                logger.warning(f"Circuit breaker opened due to {self.failure_count} failures")
            
            raise exc

# サーキットブレーカー付きタスク
external_api_circuit_breaker = CircuitBreaker(failure_threshold=3, timeout=30.0)

@app.task(bind=True, base=BaseTask)
def external_api_with_circuit_breaker(self, api_endpoint: str, **kwargs):
    """サーキットブレーカー付き外部API呼び出し"""
    
    def api_call():
        return resilient_api_call.apply_async(args=[api_endpoint], kwargs=kwargs).get()
    
    try:
        result = external_api_circuit_breaker.call(api_call)
        return result
        
    except Exception as exc:
        logger.error(f"External API call failed: {exc}")
        
        # フォールバック処理
        return {
            'status': 'fallback',
            'message': 'External service unavailable, using cached data',
            'data': get_cached_api_response(api_endpoint)
        }
```

## エラー通知とコールバック

### 重大エラーの即座通知システム

```python
@app.task(base=BaseTask, queue='priority')
def send_error_notification(error_type: str, error_data: Dict[str, Any], recipients: List[str]):
    """エラー通知の送信"""
    
    try:
        if error_type == "critical_task_failure":
            subject = f"Critical Task Failure: {error_data['task_name']}"
            body = f"""
            Critical task failure detected:
            
            Task: {error_data['task_name']}
            Task ID: {error_data['task_id']}
            Exception: {error_data['exception_type']} - {error_data['exception_message']}
            Severity: {error_data['severity']}
            Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(error_data['timestamp']))}
            
            Traceback:
            {error_data['traceback']}
            """
        
        # 通知の送信
        for recipient in recipients:
            send_email_notification(recipient, subject, body)
        
        return {'sent_to': recipients, 'status': 'success'}
        
    except Exception as exc:
        logger.error(f"Failed to send error notification: {exc}")
        raise exc

def database_error_callback(exc: Exception, task, task_id: str):
    """データベースエラーコールバック"""
    
    try:
        global db_pool
        if db_pool:
            db_pool.closeall()
        init_worker()
        logger.info("Database connection pool reset due to error")
        
    except Exception as reset_exc:
        logger.error(f"Failed to reset database connection pool: {reset_exc}")

def memory_error_callback(exc: Exception, task, task_id: str):
    """メモリエラーコールバック"""
    
    import gc
    gc.collect()
    logger.critical(f"Memory error in task {task_id}, worker restart recommended")

# グローバルエラーハンドラー設定
error_handler = CeleryErrorHandler()

# エラーコールバックの登録
error_handler.register_error_callback(psycopg2.Error, database_error_callback)
error_handler.register_error_callback(MemoryError, memory_error_callback)

# カスタムリトライポリシーの設定例
api_retry_policy = RetryPolicy(
    max_retries=5,
    base_delay=3.0,
    max_delay=300.0,
    backoff_factor=2.5,
    jitter=True,
    exceptions=[ConnectionError, TimeoutError, requests.RequestException]
)

error_handler.register_retry_policy('resilient_api_call', api_retry_policy)
```

## 使用例とベストプラクティス

### 実運用での活用方法

```python
# データベース操作の回復可能タスク
@app.task(bind=True, base=BaseTask)
@robust_task(
    retry_policy=RetryPolicy(
        max_retries=3,
        base_delay=5.0,
        exceptions=[psycopg2.OperationalError, psycopg2.InterfaceError]
    )
)
def resilient_database_operation(self, operation: str, query: str, parameters: List[Any] = None):
    """回復可能なデータベース操作"""
    
    max_connection_attempts = 3
    
    for attempt in range(max_connection_attempts):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                if operation == 'select':
                    cursor.execute(query, parameters)
                    result = cursor.fetchall()
                    return {'rows': result, 'rowcount': cursor.rowcount}
                
                elif operation in ['insert', 'update', 'delete']:
                    cursor.execute(query, parameters)
                    conn.commit()
                    return {'rowcount': cursor.rowcount}
                    
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
            if attempt < max_connection_attempts - 1:
                wait_time = (attempt + 1) * 2
                logger.warning(f"Database connection failed, retrying in {wait_time}s: {exc}")
                time.sleep(wait_time)
                continue
            else:
                raise exc

def get_cached_api_response(api_endpoint: str) -> Dict[str, Any]:
    """フォールバック用のキャッシュレスポンス取得"""
    
    redis_client = redis.Redis.from_url(app.conf.result_backend)
    cache_key = f"api_cache:{hashlib.md5(api_endpoint.encode()).hexdigest()}"
    
    cached_data = redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)
    
    return {'message': 'No cached data available'}
```