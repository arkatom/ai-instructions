# Task Patterns & Best Practices

> 🎯 **目的**: Celeryの高度なタスクパターンと実装ベストプラクティス
> 
> 📊 **対象**: カスタムタスク実装、デコレータパターン、進捗追跡、条件付き実行
> 
> ⚡ **特徴**: べき等性、リトライ戦略、バッチ処理、動的タスク実行

## 高度なタスクパターン

### べき等性とリトライのデコレータ

```python
from celery import Task, group, chain, chord, chunks
from functools import wraps
import time
import json
from typing import Any, Dict, List, Optional, Callable
import hashlib
import pickle

# カスタムタスクデコレータ
def idempotent_task(func):
    """べき等タスクデコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        # タスクIDの生成（引数ベース）
        task_signature = f"{func.__name__}:{args}:{sorted(kwargs.items())}"
        task_hash = hashlib.md5(task_signature.encode()).hexdigest()
        
        # Redis でべき等性チェック
        redis_client = redis.Redis.from_url(app.conf.result_backend)
        result_key = f"idempotent:{task_hash}"
        
        cached_result = redis_client.get(result_key)
        if cached_result:
            return pickle.loads(cached_result)
        
        # タスク実行
        result = func(*args, **kwargs)
        
        # 結果をキャッシュ（24時間）
        redis_client.setex(result_key, 86400, pickle.dumps(result))
        
        return result
    
    return wrapper

def retry_with_backoff(max_retries=3, base_delay=1, max_delay=60):
    """指数バックオフリトライデコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(self, *args, **kwargs)
                except Exception as exc:
                    if attempt == max_retries:
                        raise exc
                    
                    # 指数バックオフ計算
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    
                    # ジッターの追加
                    import random
                    jitter = random.uniform(0.1, 0.3) * delay
                    final_delay = delay + jitter
                    
                    logger.warning(f"Task failed, retrying in {final_delay:.2f}s (attempt {attempt + 1}/{max_retries})")
                    
                    # リトライ
                    raise self.retry(countdown=final_delay, exc=exc)
        
        return wrapper
    return decorator
```

### 進捗追跡付き大容量データ処理

```python
# 高度なタスク実装
@app.task(bind=True, base=BaseTask)
@idempotent_task
@retry_with_backoff(max_retries=3)
def process_large_dataset(self, dataset_id: int, processing_options: Dict[str, Any]):
    """大容量データセット処理タスク"""
    
    # 進捗追跡の初期化
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 100, 'status': 'Starting processing...'}
    )
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # データセットの取得
            cursor.execute("SELECT data FROM datasets WHERE id = %s", (dataset_id,))
            dataset_row = cursor.fetchone()
            
            if not dataset_row:
                raise ValueError(f"Dataset {dataset_id} not found")
            
            dataset = json.loads(dataset_row[0])
            total_items = len(dataset)
            
            processed_items = []
            
            for i, item in enumerate(dataset):
                # アイテムの処理
                processed_item = process_single_item(item, processing_options)
                processed_items.append(processed_item)
                
                # 進捗更新
                if i % 10 == 0:  # 10アイテムごとに更新
                    progress = int((i + 1) / total_items * 100)
                    self.update_state(
                        state='PROGRESS',
                        meta={
                            'current': i + 1,
                            'total': total_items,
                            'status': f'Processed {i + 1}/{total_items} items',
                            'progress': progress
                        }
                    )
            
            # 結果の保存
            result_data = {
                'dataset_id': dataset_id,
                'processed_count': len(processed_items),
                'processing_options': processing_options,
                'timestamp': time.time()
            }
            
            cursor.execute(
                "INSERT INTO processing_results (dataset_id, result_data) VALUES (%s, %s)",
                (dataset_id, json.dumps(result_data))
            )
            conn.commit()
            
            return result_data
            
    except Exception as exc:
        # エラー状態の更新
        self.update_state(
            state='FAILURE',
            meta={'error': str(exc), 'traceback': traceback.format_exc()}
        )
        raise exc

def process_single_item(item: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
    """単一アイテムの処理"""
    # 実際の処理ロジック
    processed_item = item.copy()
    
    # オプションに基づく処理
    if options.get('normalize'):
        processed_item = normalize_item(processed_item)
    
    if options.get('validate'):
        validate_item(processed_item)
    
    return processed_item
```

### 通知とレポート生成タスク

```python
@app.task(bind=True, base=BaseTask)
def send_notification_email(self, recipient: str, subject: str, body: str, template_id: str = None):
    """通知メール送信タスク"""
    
    try:
        # メールサービスの初期化
        email_service = EmailService()
        
        # テンプレートの適用
        if template_id:
            body = email_service.apply_template(template_id, body)
        
        # メール送信
        success = email_service.send_email(
            to=recipient,
            subject=subject,
            body=body
        )
        
        if not success:
            raise Exception("Failed to send email")
        
        # 送信履歴の記録
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO email_logs (recipient, subject, sent_at, status) VALUES (%s, %s, %s, %s)",
                (recipient, subject, time.time(), 'sent')
            )
            conn.commit()
        
        return {"status": "sent", "recipient": recipient}
        
    except Exception as exc:
        # 失敗ログの記録
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO email_logs (recipient, subject, sent_at, status, error) VALUES (%s, %s, %s, %s, %s)",
                (recipient, subject, time.time(), 'failed', str(exc))
            )
            conn.commit()
        
        raise exc

@app.task(bind=True, base=BaseTask, queue='cpu_intensive')
def generate_report(self, report_type: str, parameters: Dict[str, Any]):
    """レポート生成タスク"""
    
    self.update_state(
        state='PROGRESS',
        meta={'status': 'Initializing report generation...'}
    )
    
    try:
        report_generator = ReportGenerator(report_type)
        
        # データ収集フェーズ
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Collecting data...', 'progress': 25}
        )
        
        data = report_generator.collect_data(parameters)
        
        # 分析フェーズ
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Analyzing data...', 'progress': 50}
        )
        
        analysis = report_generator.analyze_data(data)
        
        # レポート生成フェーズ
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Generating report...', 'progress': 75}
        )
        
        report_content = report_generator.generate_report(analysis)
        
        # ファイル保存
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Saving report...', 'progress': 90}
        )
        
        file_path = report_generator.save_report(report_content, parameters)
        
        return {
            "report_type": report_type,
            "file_path": file_path,
            "parameters": parameters,
            "generated_at": time.time()
        }
        
    except Exception as exc:
        logger.error(f"Report generation failed: {exc}")
        raise exc
```

## バッチ処理パターン

### ユーザーバッチ処理システム

```python
# バッチ処理パターン
@app.task(bind=True, base=BaseTask)
def batch_process_users(self, user_ids: List[int], operation: str, batch_size: int = 100):
    """ユーザーバッチ処理タスク"""
    
    total_users = len(user_ids)
    processed_count = 0
    failed_count = 0
    
    # バッチごとの処理
    for i in range(0, total_users, batch_size):
        batch = user_ids[i:i + batch_size]
        
        # バッチ処理の実行
        batch_result = process_user_batch.delay(batch, operation)
        
        try:
            result = batch_result.get(timeout=300)  # 5分タイムアウト
            processed_count += result['processed']
            failed_count += result['failed']
            
        except Exception as exc:
            logger.error(f"Batch processing failed for batch {i//batch_size + 1}: {exc}")
            failed_count += len(batch)
        
        # 進捗更新
        progress = int((i + len(batch)) / total_users * 100)
        self.update_state(
            state='PROGRESS',
            meta={
                'current': i + len(batch),
                'total': total_users,
                'processed': processed_count,
                'failed': failed_count,
                'progress': progress
            }
        )
    
    return {
        'total_users': total_users,
        'processed': processed_count,
        'failed': failed_count,
        'operation': operation
    }

@app.task(base=BaseTask)
def process_user_batch(user_ids: List[int], operation: str):
    """ユーザーバッチの処理"""
    
    processed = 0
    failed = 0
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        for user_id in user_ids:
            try:
                if operation == 'activate':
                    cursor.execute("UPDATE users SET is_active = TRUE WHERE id = %s", (user_id,))
                elif operation == 'deactivate':
                    cursor.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
                elif operation == 'delete':
                    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
                
                processed += 1
                
            except Exception as exc:
                logger.error(f"Failed to process user {user_id}: {exc}")
                failed += 1
        
        conn.commit()
    
    return {'processed': processed, 'failed': failed}
```

## 条件付きタスク実行

### 動的条件評価システム

```python
# 条件付きタスク実行
@app.task(bind=True, base=BaseTask)
def conditional_processing(self, data: Dict[str, Any], conditions: Dict[str, Any]):
    """条件付き処理タスク"""
    
    results = []
    
    # 条件評価
    for condition_name, condition_config in conditions.items():
        condition_type = condition_config['type']
        condition_params = condition_config['params']
        
        if evaluate_condition(data, condition_type, condition_params):
            # 条件が満たされた場合のタスク実行
            task_name = condition_config['task']
            task_params = condition_config.get('task_params', {})
            
            # 動的タスク実行
            task = app.tasks[task_name]
            result = task.delay(**task_params)
            
            results.append({
                'condition': condition_name,
                'task': task_name,
                'task_id': result.id,
                'status': 'scheduled'
            })
    
    return results

def evaluate_condition(data: Dict[str, Any], condition_type: str, params: Dict[str, Any]) -> bool:
    """条件評価"""
    
    if condition_type == 'value_equals':
        field = params['field']
        expected_value = params['value']
        return data.get(field) == expected_value
    
    elif condition_type == 'value_greater_than':
        field = params['field']
        threshold = params['threshold']
        return data.get(field, 0) > threshold
    
    elif condition_type == 'field_exists':
        field = params['field']
        return field in data
    
    elif condition_type == 'custom_function':
        function_name = params['function']
        # カスタム関数の実行
        function = globals().get(function_name)
        if function:
            return function(data, params)
    
    return False
```

## 使用例とベストプラクティス

### タスク定義の例

```python
# 使用例
def example_task_patterns():
    """タスクパターンの使用例"""
    
    # べき等タスクの実行
    result1 = process_large_dataset.delay(
        dataset_id=123,
        processing_options={
            'normalize': True,
            'validate': True,
            'quality_threshold': 0.95
        }
    )
    
    # バッチ処理の実行
    user_ids = list(range(1, 1001))  # 1000ユーザー
    result2 = batch_process_users.delay(
        user_ids=user_ids,
        operation='activate',
        batch_size=50
    )
    
    # 条件付き処理の実行
    conditions = {
        'high_priority': {
            'type': 'value_greater_than',
            'params': {'field': 'priority_score', 'threshold': 80},
            'task': 'high_priority_processing',
            'task_params': {'priority_level': 'urgent'}
        },
        'data_validation_required': {
            'type': 'field_exists',
            'params': {'field': 'validation_required'},
            'task': 'validate_data_quality',
            'task_params': {'strict_mode': True}
        }
    }
    
    result3 = conditional_processing.delay(
        data={'priority_score': 85, 'validation_required': True},
        conditions=conditions
    )
    
    # 結果の取得
    print(f"Dataset processing: {result1.get()}")
    print(f"Batch processing: {result2.get()}")
    print(f"Conditional processing: {result3.get()}")
```

### パフォーマンス最適化のヒント

```python
# タスク最適化のベストプラクティス

# 1. 適切なキューの使用
@app.task(queue='cpu_intensive')  # CPU集約的タスク
def cpu_heavy_task():
    pass

@app.task(queue='io_intensive')   # I/O集約的タスク
def io_heavy_task():
    pass

# 2. メモリ効率の考慮
@app.task(bind=True)
def memory_efficient_task(self, large_data_id):
    # 大容量データを直接渡さず、IDで参照
    with get_db_connection() as conn:
        data = fetch_data_by_id(conn, large_data_id)
        process_data(data)

# 3. 適切なタイムアウト設定
@app.task(soft_time_limit=300, time_limit=360)  # 5分ソフト制限、6分ハード制限
def time_limited_task():
    pass

# 4. リソース管理
@app.task(bind=True)
def resource_managed_task(self):
    try:
        # リソースの取得
        resource = acquire_limited_resource()
        
        # 処理実行
        result = process_with_resource(resource)
        
        return result
    finally:
        # リソースの確実な解放
        if 'resource' in locals():
            release_resource(resource)
```