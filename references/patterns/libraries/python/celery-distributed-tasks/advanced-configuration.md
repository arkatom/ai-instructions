# Advanced Celery Configuration

> 🎯 **目的**: 企業レベルのCelery設定と動的ワーカー管理
> 
> 📊 **対象**: 本番環境でのCelery設定、自動スケーリング、監視設定
> 
> ⚡ **特徴**: 高可用性設計、リソース管理、セキュリティ考慮

## 企業レベルCelery設定

### 基本設定クラス

```python
from celery import Celery
from kombu import Queue, Exchange
import os
import logging
from datetime import timedelta
from celery.signals import task_prerun, task_postrun, task_failure
import redis
import json

# Celeryアプリケーションの設定
class CeleryConfig:
    """Celery設定クラス"""
    
    # ブローカー設定
    broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    result_backend = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
    
    # タスク設定
    task_serializer = 'json'
    accept_content = ['json']
    result_serializer = 'json'
    timezone = 'UTC'
    enable_utc = True
    
    # 結果の保持期間
    result_expires = 3600  # 1時間
    
    # タスクルーティング
    task_routes = {
        'tasks.cpu_intensive.*': {'queue': 'cpu_intensive'},
        'tasks.io_intensive.*': {'queue': 'io_intensive'},
        'tasks.priority.*': {'queue': 'priority'},
        'tasks.scheduled.*': {'queue': 'scheduled'},
    }
    
    # キューの定義
    task_default_queue = 'default'
    task_queues = (
        Queue('default', Exchange('default'), routing_key='default'),
        Queue('cpu_intensive', Exchange('cpu'), routing_key='cpu_intensive',
              queue_arguments={'x-max-priority': 10}),
        Queue('io_intensive', Exchange('io'), routing_key='io_intensive'),
        Queue('priority', Exchange('priority'), routing_key='priority',
              queue_arguments={'x-max-priority': 10}),
        Queue('scheduled', Exchange('scheduled'), routing_key='scheduled'),
    )
    
    # ワーカー設定
    worker_prefetch_multiplier = 1
    worker_max_tasks_per_child = 1000
    worker_disable_rate_limits = False
    
    # 監視設定
    worker_send_task_events = True
    task_send_sent_event = True
    
    # ビート設定（定期タスク）
    beat_schedule = {
        'cleanup-expired-sessions': {
            'task': 'tasks.cleanup.cleanup_expired_sessions',
            'schedule': timedelta(hours=1),
            'options': {'queue': 'scheduled'}
        },
        'generate-daily-reports': {
            'task': 'tasks.reports.generate_daily_reports',
            'schedule': crontab(hour=2, minute=0),
            'options': {'queue': 'scheduled'}
        },
        'health-check': {
            'task': 'tasks.monitoring.health_check',
            'schedule': timedelta(minutes=5),
            'options': {'queue': 'priority', 'priority': 9}
        }
    }
    
    # セキュリティ設定
    worker_hijack_root_logger = False
    worker_log_color = False

# Celeryアプリケーションの作成
app = Celery('distributed_tasks')
app.config_from_object(CeleryConfig)
```

### カスタムタスク基底クラス

```python
# カスタムタスク基底クラス
class BaseTask(app.Task):
    """カスタムタスク基底クラス"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """タスク失敗時の処理"""
        logger = logging.getLogger(__name__)
        logger.error(f'Task {task_id} failed: {exc}', exc_info=einfo)
        
        # 失敗の記録
        self.record_failure(task_id, str(exc), args, kwargs)
    
    def on_success(self, retval, task_id, args, kwargs):
        """タスク成功時の処理"""
        logger = logging.getLogger(__name__)
        logger.info(f'Task {task_id} succeeded')
        
        # 成功の記録
        self.record_success(task_id, retval, args, kwargs)
    
    def record_failure(self, task_id, error, args, kwargs):
        """失敗の記録"""
        failure_data = {
            'task_id': task_id,
            'error': error,
            'args': args,
            'kwargs': kwargs,
            'timestamp': time.time()
        }
        
        # Redis に失敗ログを保存
        redis_client = redis.Redis.from_url(CeleryConfig.result_backend)
        redis_client.lpush('task_failures', json.dumps(failure_data))
        redis_client.ltrim('task_failures', 0, 999)  # 最新1000件を保持
    
    def record_success(self, task_id, result, args, kwargs):
        """成功の記録"""
        success_data = {
            'task_id': task_id,
            'result': result,
            'timestamp': time.time()
        }
        
        redis_client = redis.Redis.from_url(CeleryConfig.result_backend)
        redis_client.lpush('task_successes', json.dumps(success_data))
        redis_client.ltrim('task_successes', 0, 999)

# アプリケーション設定
app.Task = BaseTask
```

### シグナルハンドラーとワーカー管理

```python
# シグナルハンドラー
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """タスク実行前の処理"""
    logger = logging.getLogger(__name__)
    logger.info(f'Task {task_id} started: {task.name}')

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """タスク実行後の処理"""
    logger = logging.getLogger(__name__)
    logger.info(f'Task {task_id} finished: {state}')

# ワーカーコンテキスト管理
from celery.signals import worker_process_init, worker_process_shutdown
import psycopg2
from contextlib import contextmanager

# データベース接続プール
db_pool = None

@worker_process_init.connect
def init_worker(**kwargs):
    """ワーカープロセス初期化"""
    global db_pool
    logger = logging.getLogger(__name__)
    logger.info('Initializing worker process')
    
    # データベース接続プールの初期化
    import psycopg2.pool
    db_pool = psycopg2.pool.ThreadedConnectionPool(
        1, 10,  # 最小・最大接続数
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'app_db'),
        user=os.getenv('DB_USER', 'app_user'),
        password=os.getenv('DB_PASSWORD', 'password')
    )

@worker_process_shutdown.connect
def shutdown_worker(**kwargs):
    """ワーカープロセス終了"""
    global db_pool
    logger = logging.getLogger(__name__)
    logger.info('Shutting down worker process')
    
    if db_pool:
        db_pool.closeall()

@contextmanager
def get_db_connection():
    """データベース接続の取得"""
    global db_pool
    connection = db_pool.getconn()
    try:
        yield connection
    finally:
        db_pool.putconn(connection)
```

## 動的ワーカー管理

### 自動スケーリングシステム

```python
import psutil
import time
from celery import current_app
from celery.worker.control import Panel
from typing import Dict, List, Any
import threading
import os
import signal
import subprocess

class DynamicWorkerManager:
    """動的ワーカー管理システム"""
    
    def __init__(self, celery_app):
        self.celery_app = celery_app
        self.worker_processes = {}
        self.monitoring_active = False
        self.monitor_thread = None
        
        # 設定
        self.max_workers = os.getenv('MAX_WORKERS', 10)
        self.min_workers = os.getenv('MIN_WORKERS', 2)
        self.cpu_threshold = float(os.getenv('CPU_THRESHOLD', 80.0))
        self.memory_threshold = float(os.getenv('MEMORY_THRESHOLD', 85.0))
        self.queue_threshold = int(os.getenv('QUEUE_THRESHOLD', 100))
        
    def start_monitoring(self):
        """監視の開始"""
        self.monitoring_active = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        
        # 初期ワーカーの起動
        for _ in range(self.min_workers):
            self.start_worker()
    
    def stop_monitoring(self):
        """監視の停止"""
        self.monitoring_active = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=10)
        
        # 全ワーカーの停止
        self.stop_all_workers()
    
    def _monitoring_loop(self):
        """監視ループ"""
        while self.monitoring_active:
            try:
                self._check_system_resources()
                self._check_queue_lengths()
                self._cleanup_dead_workers()
                
                time.sleep(30)  # 30秒間隔で監視
                
            except Exception as e:
                logger.error(f"Worker monitoring error: {e}")
    
    def _check_system_resources(self):
        """システムリソースの確認"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent
        
        active_workers = len([p for p in self.worker_processes.values() if p.poll() is None])
        
        # CPU使用率が高く、ワーカー数が最大未満の場合はスケールアップ
        if (cpu_percent < self.cpu_threshold / 2 and 
            memory_percent < self.memory_threshold / 2 and 
            active_workers < self.max_workers):
            
            queue_lengths = self._get_queue_lengths()
            total_queued = sum(queue_lengths.values())
            
            if total_queued > self.queue_threshold:
                self.start_worker()
                logger.info(f"Scaled up: CPU {cpu_percent}%, Memory {memory_percent}%, Queued {total_queued}")
        
        # リソース使用率が高い、または処理待ちが少ない場合はスケールダウン
        elif ((cpu_percent > self.cpu_threshold or memory_percent > self.memory_threshold) and 
              active_workers > self.min_workers):
            
            self.stop_worker()
            logger.info(f"Scaled down: CPU {cpu_percent}%, Memory {memory_percent}%")
```

### キュー監視と緊急スケーリング

```python
    def _check_queue_lengths(self):
        """キューの長さ確認"""
        queue_lengths = self._get_queue_lengths()
        
        for queue_name, length in queue_lengths.items():
            if length > self.queue_threshold * 2:  # 緊急スケールアップ
                if len(self.worker_processes) < self.max_workers:
                    self.start_worker(f"emergency_{queue_name}")
                    logger.warning(f"Emergency scale up for queue {queue_name}: {length} tasks")
    
    def _get_queue_lengths(self) -> Dict[str, int]:
        """キューの長さ取得"""
        try:
            # Celeryインスペクタを使用してキューの状態を取得
            from celery import current_app
            inspect = current_app.control.inspect()
            
            # アクティブなワーカーから情報を取得
            active_queues = inspect.active_queues()
            
            if not active_queues:
                return {}
            
            # Redis から直接キューの長さを取得
            import redis
            redis_client = redis.Redis.from_url(self.celery_app.conf.broker_url)
            
            queue_lengths = {}
            for queue_config in self.celery_app.conf.task_queues:
                queue_name = queue_config.name
                queue_key = f"celery:{queue_name}"
                length = redis_client.llen(queue_key)
                queue_lengths[queue_name] = length
            
            return queue_lengths
            
        except Exception as e:
            logger.error(f"Failed to get queue lengths: {e}")
            return {}
    
    def start_worker(self, worker_name: str = None) -> str:
        """ワーカーの開始"""
        if worker_name is None:
            worker_name = f"worker_{int(time.time())}"
        
        # ワーカープロセスの起動
        cmd = [
            'celery', 'worker',
            '-A', 'tasks',
            '--hostname', f'{worker_name}@%h',
            '--loglevel', 'INFO',
            '--without-gossip',
            '--without-mingle',
            '--without-heartbeat'
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        self.worker_processes[worker_name] = process
        logger.info(f"Started worker: {worker_name} (PID: {process.pid})")
        
        return worker_name
    
    def stop_worker(self, worker_name: str = None):
        """ワーカーの停止"""
        if worker_name is None:
            # 最も古いワーカーを選択
            active_workers = {
                name: proc for name, proc in self.worker_processes.items()
                if proc.poll() is None
            }
            
            if active_workers:
                worker_name = min(active_workers.keys())
        
        if worker_name in self.worker_processes:
            process = self.worker_processes[worker_name]
            
            if process.poll() is None:
                # グレースフルシャットダウンを試行
                process.terminate()
                
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    # 強制終了
                    process.kill()
                    process.wait()
                
                logger.info(f"Stopped worker: {worker_name}")
            
            del self.worker_processes[worker_name]
    
    def stop_all_workers(self):
        """全ワーカーの停止"""
        for worker_name in list(self.worker_processes.keys()):
            self.stop_worker(worker_name)
    
    def _cleanup_dead_workers(self):
        """死んだワーカーのクリーンアップ"""
        dead_workers = []
        
        for worker_name, process in self.worker_processes.items():
            if process.poll() is not None:
                dead_workers.append(worker_name)
        
        for worker_name in dead_workers:
            logger.warning(f"Cleaning up dead worker: {worker_name}")
            del self.worker_processes[worker_name]
    
    def get_worker_stats(self) -> Dict[str, Any]:
        """ワーカー統計の取得"""
        active_workers = len([p for p in self.worker_processes.values() if p.poll() is None])
        dead_workers = len([p for p in self.worker_processes.values() if p.poll() is not None])
        
        return {
            "total_workers": len(self.worker_processes),
            "active_workers": active_workers,
            "dead_workers": dead_workers,
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "queue_lengths": self._get_queue_lengths()
        }

# グローバルワーカーマネージャー
worker_manager = DynamicWorkerManager(app)

# アプリケーション起動時にワーカー管理を開始
def start_worker_management():
    """ワーカー管理の開始"""
    worker_manager.start_monitoring()

def stop_worker_management():
    """ワーカー管理の停止"""
    worker_manager.stop_monitoring()
```

## 使用例

```python
# アプリケーション起動
if __name__ == "__main__":
    import signal
    import sys
    
    # ワーカー管理の開始
    start_worker_management()
    
    # グレースフルシャットダウンの設定
    def signal_handler(sig, frame):
        print("Gracefully shutting down...")
        stop_worker_management()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # メインループ
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_worker_management()
```

## 設定のベストプラクティス

### 環境変数設定

```bash
# Celery設定
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"

# ワーカー管理設定
export MAX_WORKERS=10
export MIN_WORKERS=2
export CPU_THRESHOLD=80.0
export MEMORY_THRESHOLD=85.0
export QUEUE_THRESHOLD=100

# データベース設定
export DB_HOST="localhost"
export DB_NAME="app_db"
export DB_USER="app_user"
export DB_PASSWORD="secure_password"
```

### Dockerコンテナでの使用

```yaml
version: '3.8'
services:
  celery-worker:
    build: .
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - MAX_WORKERS=5
      - MIN_WORKERS=1
    volumes:
      - ./app:/app
    depends_on:
      - redis
      - postgres
```