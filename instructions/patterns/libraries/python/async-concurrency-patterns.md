# Async Python Concurrency Patterns

本番環境で使用されるPythonの非同期・並行・並列処理の高度なパターン集です。asyncio、threading、multiprocessingを活用した実用的なソリューションを提供します。

## 目次

1. [Asyncio Advanced Patterns](#asyncio-advanced-patterns)
2. [Concurrent Futures Patterns](#concurrent-futures-patterns)
3. [Threading Patterns](#threading-patterns)
4. [Multiprocessing Patterns](#multiprocessing-patterns)
5. [Hybrid Concurrency Patterns](#hybrid-concurrency-patterns)
6. [Performance Monitoring](#performance-monitoring)
7. [Error Handling Strategies](#error-handling-strategies)
8. [Production Examples](#production-examples)

## Asyncio Advanced Patterns

### 1. 高度な非同期コンテキストマネージャー

```python
import asyncio
import aiohttp
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class ConnectionPoolManager:
    """高性能な接続プール管理"""
    
    def __init__(self, max_connections: int = 100):
        self.max_connections = max_connections
        self.session: Optional[aiohttp.ClientSession] = None
        self.connector: Optional[aiohttp.TCPConnector] = None
        
    async def __aenter__(self):
        self.connector = aiohttp.TCPConnector(
            limit=self.max_connections,
            limit_per_host=20,
            keepalive_timeout=60,
            enable_cleanup_closed=True
        )
        
        timeout = aiohttp.ClientTimeout(
            total=30,
            connect=10,
            sock_read=10
        )
        
        self.session = aiohttp.ClientSession(
            connector=self.connector,
            timeout=timeout
        )
        
        logger.info(f"Connection pool initialized with {self.max_connections} connections")
        return self.session
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
        if self.connector:
            await self.connector.close()
        logger.info("Connection pool closed")

@asynccontextmanager
async def database_transaction() -> AsyncGenerator[Dict[str, Any], None]:
    """非同期データベーストランザクション管理"""
    connection = None
    transaction = None
    
    try:
        # 仮想的なデータベース接続
        connection = await create_connection()
        transaction = await connection.begin()
        
        logger.info("Database transaction started")
        
        yield {"connection": connection, "transaction": transaction}
        
        await transaction.commit()
        logger.info("Database transaction committed")
        
    except Exception as e:
        if transaction:
            await transaction.rollback()
        logger.error(f"Database transaction failed: {e}")
        raise
        
    finally:
        if connection:
            await connection.close()

async def create_connection():
    """仮想的なデータベース接続作成"""
    await asyncio.sleep(0.1)  # 接続時間をシミュレート
    return type('Connection', (), {
        'begin': lambda: asyncio.create_task(asyncio.sleep(0.01)),
        'close': lambda: asyncio.create_task(asyncio.sleep(0.01))
    })()
```

### 2. 非同期ジェネレータとストリーム処理

```python
import asyncio
from typing import AsyncGenerator, AsyncIterable, List, Callable, Any
import json
import aiofiles

class AsyncStreamProcessor:
    """非同期ストリーム処理エンジン"""
    
    def __init__(self, buffer_size: int = 1000):
        self.buffer_size = buffer_size
        
    async def process_file_stream(
        self, 
        file_path: str,
        processor: Callable[[str], Any]
    ) -> AsyncGenerator[Any, None]:
        """ファイルストリームの非同期処理"""
        
        async with aiofiles.open(file_path, 'r') as file:
            buffer = []
            
            async for line in file:
                line = line.strip()
                if line:
                    buffer.append(line)
                    
                if len(buffer) >= self.buffer_size:
                    # バッファ処理
                    tasks = [
                        asyncio.create_task(self._process_line(line, processor))
                        for line in buffer
                    ]
                    
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    for result in results:
                        if not isinstance(result, Exception):
                            yield result
                            
                    buffer.clear()
            
            # 残りのバッファを処理
            if buffer:
                tasks = [
                    asyncio.create_task(self._process_line(line, processor))
                    for line in buffer
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if not isinstance(result, Exception):
                        yield result
    
    async def _process_line(self, line: str, processor: Callable[[str], Any]) -> Any:
        """単一行の非同期処理"""
        # CPU集約的なタスクは別スレッドで実行
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, processor, line)

async def json_parser(line: str) -> dict:
    """JSON解析の例"""
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return {"error": "Invalid JSON", "line": line}

# 使用例
async def stream_example():
    processor = AsyncStreamProcessor(buffer_size=500)
    
    count = 0
    async for result in processor.process_file_stream(
        "large_file.jsonl", 
        json_parser
    ):
        count += 1
        if count % 1000 == 0:
            logger.info(f"Processed {count} lines")
```

### 3. 非同期タスクプール

```python
import asyncio
from typing import Callable, Any, List, Optional, Coroutine
import weakref
from dataclasses import dataclass
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class TaskResult:
    task_id: str
    status: TaskStatus
    result: Any = None
    error: Optional[Exception] = None
    execution_time: float = 0.0

class AsyncTaskPool:
    """高性能な非同期タスクプール"""
    
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self.semaphore = asyncio.Semaphore(max_workers)
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.completed_tasks: Dict[str, TaskResult] = {}
        self.task_counter = 0
        
    async def submit(
        self, 
        coro: Coroutine,
        task_id: Optional[str] = None
    ) -> str:
        """タスクをプールに投入"""
        
        if task_id is None:
            self.task_counter += 1
            task_id = f"task_{self.task_counter}"
            
        task = asyncio.create_task(self._execute_task(coro, task_id))
        self.active_tasks[task_id] = task
        
        # タスク完了時のクリーンアップ
        task.add_done_callback(
            lambda t: self.active_tasks.pop(task_id, None)
        )
        
        return task_id
        
    async def _execute_task(self, coro: Coroutine, task_id: str) -> TaskResult:
        """タスクの実行とモニタリング"""
        
        start_time = time.time()
        
        async with self.semaphore:
            try:
                result = await coro
                execution_time = time.time() - start_time
                
                task_result = TaskResult(
                    task_id=task_id,
                    status=TaskStatus.COMPLETED,
                    result=result,
                    execution_time=execution_time
                )
                
            except asyncio.CancelledError:
                task_result = TaskResult(
                    task_id=task_id,
                    status=TaskStatus.CANCELLED,
                    execution_time=time.time() - start_time
                )
                raise
                
            except Exception as e:
                task_result = TaskResult(
                    task_id=task_id,
                    status=TaskStatus.FAILED,
                    error=e,
                    execution_time=time.time() - start_time
                )
                
            self.completed_tasks[task_id] = task_result
            return task_result
    
    async def get_result(self, task_id: str, timeout: Optional[float] = None) -> TaskResult:
        """タスク結果の取得"""
        
        if task_id in self.completed_tasks:
            return self.completed_tasks[task_id]
            
        if task_id in self.active_tasks:
            try:
                return await asyncio.wait_for(
                    self.active_tasks[task_id], 
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                raise asyncio.TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")
        
        raise ValueError(f"Task {task_id} not found")
    
    async def cancel_task(self, task_id: str) -> bool:
        """タスクのキャンセル"""
        
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            task.cancel()
            return True
        return False
    
    async def wait_all(self, timeout: Optional[float] = None) -> List[TaskResult]:
        """全タスクの完了待機"""
        
        if not self.active_tasks:
            return list(self.completed_tasks.values())
            
        try:
            await asyncio.wait_for(
                asyncio.gather(*self.active_tasks.values(), return_exceptions=True),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.warning(f"Not all tasks completed within {timeout} seconds")
            
        return list(self.completed_tasks.values())

# 使用例
async def cpu_intensive_task(data: int) -> int:
    """CPU集約的なタスクの例"""
    # 実際の処理をシミュレート
    await asyncio.sleep(0.1)
    return data ** 2

async def task_pool_example():
    pool = AsyncTaskPool(max_workers=5)
    
    # 複数タスクの投入
    task_ids = []
    for i in range(20):
        task_id = await pool.submit(cpu_intensive_task(i))
        task_ids.append(task_id)
    
    # 結果の取得
    results = await pool.wait_all(timeout=10.0)
    
    for result in results:
        if result.status == TaskStatus.COMPLETED:
            logger.info(f"Task {result.task_id}: {result.result} (took {result.execution_time:.2f}s)")
```

## Concurrent Futures Patterns

### 1. ThreadPoolExecutor高度な使用法

```python
import concurrent.futures
import threading
import time
from typing import Callable, List, Any, Dict, Optional
import queue
import psutil
import os

class AdaptiveThreadPool:
    """適応的スレッドプール"""
    
    def __init__(
        self, 
        min_workers: int = 2,
        max_workers: Optional[int] = None,
        cpu_threshold: float = 80.0
    ):
        self.min_workers = min_workers
        self.max_workers = max_workers or (os.cpu_count() * 2)
        self.cpu_threshold = cpu_threshold
        self.current_workers = min_workers
        
        self.executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=self.current_workers
        )
        
        self.monitoring_thread = threading.Thread(
            target=self._monitor_performance,
            daemon=True
        )
        self.monitoring_thread.start()
        
        self.task_queue = queue.Queue()
        self.performance_metrics = {
            "cpu_usage": [],
            "queue_size": [],
            "completed_tasks": 0,
            "failed_tasks": 0
        }
        
    def _monitor_performance(self):
        """パフォーマンス監視と動的調整"""
        
        while True:
            try:
                cpu_percent = psutil.cpu_percent(interval=1)
                queue_size = self.task_queue.qsize()
                
                self.performance_metrics["cpu_usage"].append(cpu_percent)
                self.performance_metrics["queue_size"].append(queue_size)
                
                # 最新10件の平均を保持
                if len(self.performance_metrics["cpu_usage"]) > 10:
                    self.performance_metrics["cpu_usage"].pop(0)
                    self.performance_metrics["queue_size"].pop(0)
                
                avg_cpu = sum(self.performance_metrics["cpu_usage"]) / len(self.performance_metrics["cpu_usage"])
                avg_queue = sum(self.performance_metrics["queue_size"]) / len(self.performance_metrics["queue_size"])
                
                # 動的スケーリング
                if avg_cpu < self.cpu_threshold and avg_queue > 5 and self.current_workers < self.max_workers:
                    self._scale_up()
                elif avg_cpu > self.cpu_threshold and self.current_workers > self.min_workers:
                    self._scale_down()
                    
            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")
                
            time.sleep(5)
    
    def _scale_up(self):
        """スレッドプールのスケールアップ"""
        new_workers = min(self.current_workers + 1, self.max_workers)
        if new_workers != self.current_workers:
            old_executor = self.executor
            self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=new_workers)
            self.current_workers = new_workers
            
            # 古いエグゼキューターをグレースフルシャットダウン
            threading.Thread(target=old_executor.shutdown, args=(True,), daemon=True).start()
            logger.info(f"Scaled up to {new_workers} workers")
    
    def _scale_down(self):
        """スレッドプールのスケールダウン"""
        new_workers = max(self.current_workers - 1, self.min_workers)
        if new_workers != self.current_workers:
            old_executor = self.executor
            self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=new_workers)
            self.current_workers = new_workers
            
            # 古いエグゼキューターをグレースフルシャットダウン
            threading.Thread(target=old_executor.shutdown, args=(True,), daemon=True).start()
            logger.info(f"Scaled down to {new_workers} workers")
    
    def submit(self, fn: Callable, *args, **kwargs) -> concurrent.futures.Future:
        """タスクの投入"""
        future = self.executor.submit(fn, *args, **kwargs)
        self.task_queue.put(future)
        
        # 完了コールバック
        future.add_done_callback(self._task_completed)
        
        return future
    
    def _task_completed(self, future: concurrent.futures.Future):
        """タスク完了時の処理"""
        try:
            self.task_queue.get_nowait()
        except queue.Empty:
            pass
            
        if future.exception() is None:
            self.performance_metrics["completed_tasks"] += 1
        else:
            self.performance_metrics["failed_tasks"] += 1
    
    def shutdown(self, wait: bool = True):
        """プールのシャットダウン"""
        self.executor.shutdown(wait=wait)
        
    def get_stats(self) -> Dict[str, Any]:
        """パフォーマンス統計の取得"""
        return {
            "current_workers": self.current_workers,
            "queue_size": self.task_queue.qsize(),
            "completed_tasks": self.performance_metrics["completed_tasks"],
            "failed_tasks": self.performance_metrics["failed_tasks"],
            "avg_cpu_usage": sum(self.performance_metrics["cpu_usage"]) / len(self.performance_metrics["cpu_usage"]) if self.performance_metrics["cpu_usage"] else 0,
            "avg_queue_size": sum(self.performance_metrics["queue_size"]) / len(self.performance_metrics["queue_size"]) if self.performance_metrics["queue_size"] else 0
        }

def cpu_intensive_computation(data: int) -> int:
    """CPU集約的な計算の例"""
    result = 0
    for i in range(data * 1000):
        result += i ** 0.5
    return int(result)

# 使用例
def adaptive_pool_example():
    pool = AdaptiveThreadPool(min_workers=2, max_workers=8)
    
    futures = []
    for i in range(100):
        future = pool.submit(cpu_intensive_computation, i % 10 + 1)
        futures.append(future)
    
    # 結果の取得
    results = []
    for future in concurrent.futures.as_completed(futures, timeout=60):
        try:
            result = future.result()
            results.append(result)
        except Exception as e:
            logger.error(f"Task failed: {e}")
    
    stats = pool.get_stats()
    logger.info(f"Pool statistics: {stats}")
    
    pool.shutdown()
    return results
```

### 2. ProcessPoolExecutor高度な使用法

```python
import concurrent.futures
import multiprocessing
import pickle
import os
import sys
from typing import List, Dict, Any, Callable, Optional
import numpy as np
import time

class OptimizedProcessPool:
    """最適化されたプロセスプール"""
    
    def __init__(
        self, 
        max_workers: Optional[int] = None,
        initializer: Optional[Callable] = None,
        initargs: tuple = (),
        chunk_size: int = 1
    ):
        self.max_workers = max_workers or multiprocessing.cpu_count()
        self.chunk_size = chunk_size
        
        # プロセス間通信の最適化
        multiprocessing.set_start_method('spawn', force=True)
        
        self.executor = concurrent.futures.ProcessPoolExecutor(
            max_workers=self.max_workers,
            initializer=initializer,
            initargs=initargs
        )
        
        self.shared_state = multiprocessing.Manager().dict()
        
    def map_chunked(
        self, 
        func: Callable, 
        iterable: List[Any],
        chunk_size: Optional[int] = None
    ) -> List[Any]:
        """チャンク単位での並列マッピング"""
        
        chunk_size = chunk_size or self.chunk_size
        chunks = [iterable[i:i + chunk_size] for i in range(0, len(iterable), chunk_size)]
        
        # チャンク処理関数
        def process_chunk(chunk):
            return [func(item) for item in chunk]
        
        # 並列実行
        futures = [self.executor.submit(process_chunk, chunk) for chunk in chunks]
        
        results = []
        for future in concurrent.futures.as_completed(futures):
            try:
                chunk_results = future.result()
                results.extend(chunk_results)
            except Exception as e:
                logger.error(f"Chunk processing failed: {e}")
                raise
        
        return results
    
    def map_with_progress(
        self, 
        func: Callable, 
        iterable: List[Any],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[Any]:
        """進捗監視付きマッピング"""
        
        total_items = len(iterable)
        completed = 0
        
        futures = [self.executor.submit(func, item) for item in iterable]
        
        results = []
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                results.append(result)
                completed += 1
                
                if progress_callback:
                    progress_callback(completed, total_items)
                    
            except Exception as e:
                logger.error(f"Task failed: {e}")
                completed += 1
                
                if progress_callback:
                    progress_callback(completed, total_items)
                    
                raise
        
        return results
    
    def reduce_distributed(
        self, 
        map_func: Callable,
        reduce_func: Callable,
        iterable: List[Any],
        chunk_size: Optional[int] = None
    ) -> Any:
        """分散MapReduce"""
        
        # Map フェーズ
        mapped_results = self.map_chunked(map_func, iterable, chunk_size)
        
        # Reduce フェーズ（段階的に削減）
        while len(mapped_results) > 1:
            chunk_size = max(1, len(mapped_results) // self.max_workers)
            chunks = [
                mapped_results[i:i + chunk_size] 
                for i in range(0, len(mapped_results), chunk_size)
            ]
            
            def reduce_chunk(chunk):
                result = chunk[0]
                for item in chunk[1:]:
                    result = reduce_func(result, item)
                return result
            
            futures = [self.executor.submit(reduce_chunk, chunk) for chunk in chunks]
            mapped_results = [future.result() for future in futures]
        
        return mapped_results[0] if mapped_results else None
    
    def shutdown(self, wait: bool = True):
        """プールのシャットダウン"""
        self.executor.shutdown(wait=wait)

# 重い計算処理の例
def matrix_multiplication(matrices_data):
    """行列積の計算"""
    a, b = matrices_data
    return np.dot(a, b)

def fibonacci(n):
    """フィボナッチ数列（CPU集約的）"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def sum_reducer(a, b):
    """合計の削減関数"""
    return a + b

# 使用例
def process_pool_example():
    pool = OptimizedProcessPool(max_workers=4)
    
    # 行列計算の並列処理
    matrices = []
    for _ in range(20):
        a = np.random.rand(100, 100)
        b = np.random.rand(100, 100)
        matrices.append((a, b))
    
    def progress_callback(completed, total):
        print(f"Progress: {completed}/{total} ({completed/total*100:.1f}%)")
    
    start_time = time.time()
    results = pool.map_with_progress(
        matrix_multiplication, 
        matrices,
        progress_callback=progress_callback
    )
    
    execution_time = time.time() - start_time
    logger.info(f"Matrix calculations completed in {execution_time:.2f} seconds")
    
    # MapReduce の例
    numbers = list(range(1, 101))
    
    # 各数値を2乗するMap関数
    def square_map(x):
        return x ** 2
    
    total_sum = pool.reduce_distributed(
        map_func=square_map,
        reduce_func=sum_reducer,
        iterable=numbers,
        chunk_size=10
    )
    
    logger.info(f"Sum of squares (1-100): {total_sum}")
    
    pool.shutdown()
    return results, total_sum
```

## Threading Patterns

### 1. 高度なスレッド同期

```python
import threading
import time
import queue
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import weakref

class ThreadState(Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"

@dataclass
class ThreadMetrics:
    thread_id: str
    state: ThreadState
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    cpu_time: float = 0.0
    tasks_completed: int = 0
    errors: int = 0

class AdvancedThreadManager:
    """高度なスレッド管理システム"""
    
    def __init__(self):
        self.threads: Dict[str, threading.Thread] = {}
        self.thread_metrics: Dict[str, ThreadMetrics] = {}
        self.shutdown_event = threading.Event()
        self.condition = threading.Condition()
        
        # スレッド間通信
        self.message_queues: Dict[str, queue.Queue] = {}
        self.broadcast_queue: queue.Queue = queue.Queue()
        
        # 監視用
        self.monitor_thread = threading.Thread(
            target=self._monitor_threads,
            daemon=True
        )
        self.monitor_thread.start()
    
    def create_worker_thread(
        self, 
        thread_id: str,
        target: Callable,
        args: tuple = (),
        kwargs: Dict[str, Any] = None,
        daemon: bool = True
    ) -> str:
        """ワーカースレッドの作成"""
        
        if kwargs is None:
            kwargs = {}
            
        if thread_id in self.threads:
            raise ValueError(f"Thread {thread_id} already exists")
        
        # メッセージキューの作成
        self.message_queues[thread_id] = queue.Queue()
        
        # メトリクスの初期化
        self.thread_metrics[thread_id] = ThreadMetrics(
            thread_id=thread_id,
            state=ThreadState.CREATED
        )
        
        # ラップされたターゲット関数
        def wrapped_target():
            try:
                self.thread_metrics[thread_id].state = ThreadState.RUNNING
                self.thread_metrics[thread_id].start_time = time.time()
                
                # 実際のタスクを実行
                target(*args, **kwargs)
                
                self.thread_metrics[thread_id].state = ThreadState.STOPPED
                
            except Exception as e:
                self.thread_metrics[thread_id].state = ThreadState.ERROR
                self.thread_metrics[thread_id].errors += 1
                logger.error(f"Thread {thread_id} error: {e}")
                
            finally:
                self.thread_metrics[thread_id].end_time = time.time()
        
        # スレッドの作成
        thread = threading.Thread(
            target=wrapped_target,
            name=thread_id,
            daemon=daemon
        )
        
        self.threads[thread_id] = thread
        return thread_id
    
    def start_thread(self, thread_id: str):
        """スレッドの開始"""
        if thread_id in self.threads:
            self.threads[thread_id].start()
        else:
            raise ValueError(f"Thread {thread_id} not found")
    
    def pause_thread(self, thread_id: str):
        """スレッドの一時停止（協調的）"""
        if thread_id in self.thread_metrics:
            self.thread_metrics[thread_id].state = ThreadState.PAUSED
    
    def resume_thread(self, thread_id: str):
        """スレッドの再開"""
        if thread_id in self.thread_metrics:
            self.thread_metrics[thread_id].state = ThreadState.RUNNING
            
        with self.condition:
            self.condition.notify_all()
    
    def send_message(self, thread_id: str, message: Any):
        """特定スレッドへのメッセージ送信"""
        if thread_id in self.message_queues:
            self.message_queues[thread_id].put(message)
        else:
            raise ValueError(f"Thread {thread_id} not found")
    
    def broadcast_message(self, message: Any):
        """全スレッドへのブロードキャスト"""
        self.broadcast_queue.put(message)
    
    def get_message(self, thread_id: str, timeout: Optional[float] = None) -> Any:
        """メッセージの受信"""
        if thread_id in self.message_queues:
            try:
                return self.message_queues[thread_id].get(timeout=timeout)
            except queue.Empty:
                return None
        else:
            raise ValueError(f"Thread {thread_id} not found")
    
    def check_pause_point(self, thread_id: str):
        """一時停止ポイントのチェック（スレッド内で呼び出し）"""
        if thread_id in self.thread_metrics:
            metrics = self.thread_metrics[thread_id]
            
            if metrics.state == ThreadState.PAUSED:
                with self.condition:
                    while metrics.state == ThreadState.PAUSED and not self.shutdown_event.is_set():
                        self.condition.wait(timeout=1.0)
    
    def _monitor_threads(self):
        """スレッド監視ループ"""
        while not self.shutdown_event.is_set():
            try:
                # デッドスレッドのクリーンアップ
                dead_threads = []
                for thread_id, thread in self.threads.items():
                    if not thread.is_alive() and thread.ident is not None:
                        dead_threads.append(thread_id)
                
                for thread_id in dead_threads:
                    self._cleanup_thread(thread_id)
                
                # ブロードキャストメッセージの配信
                try:
                    message = self.broadcast_queue.get_nowait()
                    for thread_id in self.message_queues:
                        self.message_queues[thread_id].put(message)
                except queue.Empty:
                    pass
                
            except Exception as e:
                logger.error(f"Thread monitoring error: {e}")
                
            time.sleep(1.0)
    
    def _cleanup_thread(self, thread_id: str):
        """スレッドのクリーンアップ"""
        if thread_id in self.threads:
            del self.threads[thread_id]
        if thread_id in self.message_queues:
            del self.message_queues[thread_id]
        
        logger.info(f"Cleaned up thread {thread_id}")
    
    def get_thread_metrics(self, thread_id: Optional[str] = None) -> Dict[str, ThreadMetrics]:
        """スレッドメトリクスの取得"""
        if thread_id:
            return {thread_id: self.thread_metrics.get(thread_id)}
        return self.thread_metrics.copy()
    
    def shutdown(self, timeout: float = 10.0):
        """全スレッドのシャットダウン"""
        self.shutdown_event.set()
        
        # 全スレッドの終了を待機
        for thread_id, thread in self.threads.items():
            if thread.is_alive():
                thread.join(timeout=timeout / len(self.threads))
                
                if thread.is_alive():
                    logger.warning(f"Thread {thread_id} did not terminate gracefully")

# ワーカー関数の例
def data_processor_worker(thread_manager: AdvancedThreadManager, thread_id: str, data_source: str):
    """データ処理ワーカーの例"""
    
    processed_count = 0
    
    while not thread_manager.shutdown_event.is_set():
        # 一時停止ポイントのチェック
        thread_manager.check_pause_point(thread_id)
        
        # メッセージのチェック
        message = thread_manager.get_message(thread_id, timeout=0.1)
        if message:
            if message == "pause":
                thread_manager.pause_thread(thread_id)
                continue
            elif message == "shutdown":
                break
        
        # データ処理のシミュレート
        time.sleep(0.1)
        processed_count += 1
        
        if processed_count % 10 == 0:
            logger.info(f"Thread {thread_id} processed {processed_count} items")
            
        # メトリクスの更新
        thread_manager.thread_metrics[thread_id].tasks_completed = processed_count

# 使用例
def threading_example():
    manager = AdvancedThreadManager()
    
    # 複数のワーカースレッドを作成
    thread_ids = []
    for i in range(3):
        thread_id = f"worker_{i}"
        manager.create_worker_thread(
            thread_id,
            data_processor_worker,
            args=(manager, thread_id, f"data_source_{i}")
        )
        thread_ids.append(thread_id)
    
    # スレッドを開始
    for thread_id in thread_ids:
        manager.start_thread(thread_id)
    
    # 5秒後に一つのスレッドを一時停止
    time.sleep(5)
    manager.send_message("worker_1", "pause")
    
    # さらに3秒後に再開
    time.sleep(3)
    manager.resume_thread("worker_1")
    
    # 全体で10秒実行してからシャットダウン
    time.sleep(7)
    manager.broadcast_message("shutdown")
    
    # メトリクスの表示
    metrics = manager.get_thread_metrics()
    for thread_id, metric in metrics.items():
        logger.info(f"Thread {thread_id}: {metric.tasks_completed} tasks completed")
    
    manager.shutdown()
```

## Multiprocessing Patterns

### 1. 高度なプロセス間通信

```python
import multiprocessing
import threading
import time
import pickle
import mmap
import os
from typing import Dict, Any, List, Optional, Callable, Union
from dataclasses import dataclass
from enum import Enum
import struct

class MessageType(Enum):
    DATA = "data"
    CONTROL = "control"
    HEARTBEAT = "heartbeat"
    SHUTDOWN = "shutdown"

@dataclass
class Message:
    msg_type: MessageType
    sender_id: str
    timestamp: float
    data: Any

class SharedMemoryManager:
    """共有メモリ管理システム"""
    
    def __init__(self, name: str, size: int):
        self.name = name
        self.size = size
        self.shared_memory = None
        self.lock = multiprocessing.Lock()
        
    def create(self) -> bool:
        """共有メモリの作成"""
        try:
            self.shared_memory = multiprocessing.shared_memory.SharedMemory(
                create=True, 
                size=self.size, 
                name=self.name
            )
            return True
        except FileExistsError:
            return False
            
    def connect(self) -> bool:
        """既存の共有メモリに接続"""
        try:
            self.shared_memory = multiprocessing.shared_memory.SharedMemory(
                name=self.name
            )
            return True
        except FileNotFoundError:
            return False
    
    def write_data(self, data: bytes, offset: int = 0):
        """データの書き込み"""
        with self.lock:
            if len(data) + offset > self.size:
                raise ValueError("Data too large for shared memory")
            self.shared_memory.buf[offset:offset + len(data)] = data
    
    def read_data(self, length: int, offset: int = 0) -> bytes:
        """データの読み込み"""
        with self.lock:
            if offset + length > self.size:
                raise ValueError("Read request exceeds shared memory size")
            return bytes(self.shared_memory.buf[offset:offset + length])
    
    def cleanup(self):
        """共有メモリのクリーンアップ"""
        if self.shared_memory:
            try:
                self.shared_memory.close()
                self.shared_memory.unlink()
            except:
                pass

class HighPerformanceIPC:
    """高性能プロセス間通信システム"""
    
    def __init__(self, process_id: str):
        self.process_id = process_id
        self.message_queues: Dict[str, multiprocessing.Queue] = {}
        self.shared_memories: Dict[str, SharedMemoryManager] = {}
        
        # パフォーマンス統計
        self.stats = {
            "messages_sent": 0,
            "messages_received": 0,
            "bytes_transferred": 0,
            "errors": 0
        }
        
        # ハートビート機能
        self.heartbeat_interval = 5.0
        self.last_heartbeat = time.time()
        self.alive_processes: Dict[str, float] = {}
        
    def create_message_queue(self, queue_name: str, maxsize: int = 0):
        """メッセージキューの作成"""
        self.message_queues[queue_name] = multiprocessing.Queue(maxsize=maxsize)
        
    def send_message(
        self, 
        queue_name: str, 
        msg_type: MessageType,
        data: Any,
        timeout: Optional[float] = None
    ):
        """メッセージの送信"""
        if queue_name not in self.message_queues:
            raise ValueError(f"Queue {queue_name} not found")
            
        message = Message(
            msg_type=msg_type,
            sender_id=self.process_id,
            timestamp=time.time(),
            data=data
        )
        
        try:
            self.message_queues[queue_name].put(message, timeout=timeout)
            self.stats["messages_sent"] += 1
            
            # データサイズの推定
            try:
                data_size = len(pickle.dumps(data))
                self.stats["bytes_transferred"] += data_size
            except:
                pass
                
        except Exception as e:
            self.stats["errors"] += 1
            raise e
    
    def receive_message(
        self, 
        queue_name: str, 
        timeout: Optional[float] = None
    ) -> Optional[Message]:
        """メッセージの受信"""
        if queue_name not in self.message_queues:
            raise ValueError(f"Queue {queue_name} not found")
            
        try:
            message = self.message_queues[queue_name].get(timeout=timeout)
            self.stats["messages_received"] += 1
            
            # ハートビートの処理
            if message.msg_type == MessageType.HEARTBEAT:
                self.alive_processes[message.sender_id] = message.timestamp
            
            return message
            
        except Exception:
            return None
    
    def create_shared_memory(self, memory_name: str, size: int):
        """共有メモリの作成"""
        shared_mem = SharedMemoryManager(memory_name, size)
        if shared_mem.create():
            self.shared_memories[memory_name] = shared_mem
        else:
            raise RuntimeError(f"Failed to create shared memory {memory_name}")
    
    def connect_shared_memory(self, memory_name: str, size: int):
        """既存の共有メモリに接続"""
        shared_mem = SharedMemoryManager(memory_name, size)
        if shared_mem.connect():
            self.shared_memories[memory_name] = shared_mem
        else:
            raise RuntimeError(f"Failed to connect to shared memory {memory_name}")
    
    def write_shared_data(self, memory_name: str, data: bytes, offset: int = 0):
        """共有メモリへのデータ書き込み"""
        if memory_name in self.shared_memories:
            self.shared_memories[memory_name].write_data(data, offset)
            self.stats["bytes_transferred"] += len(data)
        else:
            raise ValueError(f"Shared memory {memory_name} not found")
    
    def read_shared_data(self, memory_name: str, length: int, offset: int = 0) -> bytes:
        """共有メモリからのデータ読み込み"""
        if memory_name in self.shared_memories:
            return self.shared_memories[memory_name].read_data(length, offset)
        else:
            raise ValueError(f"Shared memory {memory_name} not found")
    
    def send_heartbeat(self, queue_name: str):
        """ハートビートの送信"""
        self.send_message(queue_name, MessageType.HEARTBEAT, {"process_id": self.process_id})
        self.last_heartbeat = time.time()
    
    def check_alive_processes(self, timeout: float = 10.0) -> List[str]:
        """生存プロセスのチェック"""
        current_time = time.time()
        alive = []
        
        for process_id, last_seen in self.alive_processes.items():
            if current_time - last_seen <= timeout:
                alive.append(process_id)
        
        return alive
    
    def get_stats(self) -> Dict[str, Any]:
        """統計情報の取得"""
        return {
            **self.stats,
            "process_id": self.process_id,
            "alive_processes": len(self.alive_processes),
            "last_heartbeat": self.last_heartbeat
        }
    
    def cleanup(self):
        """リソースのクリーンアップ"""
        for shared_mem in self.shared_memories.values():
            shared_mem.cleanup()

def coordinator_process(ipc: HighPerformanceIPC, num_workers: int):
    """コーディネータープロセス"""
    logger.info(f"Coordinator {ipc.process_id} starting with {num_workers} workers")
    
    # 作業配布用のタスクキューを作成
    ipc.create_message_queue("task_queue")
    ipc.create_message_queue("result_queue")
    
    # 共有メモリでの大容量データ共有
    ipc.create_shared_memory("data_buffer", 1024 * 1024)  # 1MB
    
    # タスクの配布
    tasks = [{"task_id": i, "data": f"task_data_{i}"} for i in range(100)]
    
    for task in tasks:
        ipc.send_message("task_queue", MessageType.DATA, task)
    
    # 結果の収集
    completed_tasks = 0
    results = []
    
    while completed_tasks < len(tasks):
        # ハートビートの送信
        if time.time() - ipc.last_heartbeat > ipc.heartbeat_interval:
            ipc.send_heartbeat("result_queue")
        
        # 結果の受信
        message = ipc.receive_message("result_queue", timeout=1.0)
        if message and message.msg_type == MessageType.DATA:
            results.append(message.data)
            completed_tasks += 1
            
            if completed_tasks % 10 == 0:
                logger.info(f"Completed {completed_tasks}/{len(tasks)} tasks")
    
    # 終了メッセージの送信
    for _ in range(num_workers):
        ipc.send_message("task_queue", MessageType.SHUTDOWN, None)
    
    logger.info(f"Coordinator completed. Stats: {ipc.get_stats()}")
    ipc.cleanup()

def worker_process(worker_id: str, coordinator_queue_name: str):
    """ワーカープロセス"""
    ipc = HighPerformanceIPC(worker_id)
    
    # 既存のキューに接続
    ipc.message_queues["task_queue"] = multiprocessing.Queue()
    ipc.message_queues["result_queue"] = multiprocessing.Queue()
    
    # 共有メモリに接続
    ipc.connect_shared_memory("data_buffer", 1024 * 1024)
    
    logger.info(f"Worker {worker_id} started")
    
    while True:
        # タスクの受信
        message = ipc.receive_message("task_queue", timeout=5.0)
        
        if not message:
            continue
            
        if message.msg_type == MessageType.SHUTDOWN:
            logger.info(f"Worker {worker_id} shutting down")
            break
            
        if message.msg_type == MessageType.DATA:
            task = message.data
            
            # タスクの処理（シミュレート）
            time.sleep(0.1)
            result = {
                "task_id": task["task_id"],
                "result": f"processed_{task['data']}",
                "worker_id": worker_id
            }
            
            # 結果の送信
            ipc.send_message("result_queue", MessageType.DATA, result)
    
    logger.info(f"Worker {worker_id} stats: {ipc.get_stats()}")
    ipc.cleanup()

# 使用例
def multiprocessing_example():
    num_workers = 4
    
    # メインプロセスでのIPC設定
    main_ipc = HighPerformanceIPC("main")
    
    # コーディネータープロセスの開始
    coordinator_proc = multiprocessing.Process(
        target=coordinator_process,
        args=(main_ipc, num_workers)
    )
    coordinator_proc.start()
    
    # ワーカープロセスの開始
    worker_procs = []
    for i in range(num_workers):
        worker_proc = multiprocessing.Process(
            target=worker_process,
            args=(f"worker_{i}", "task_queue")
        )
        worker_proc.start()
        worker_procs.append(worker_proc)
    
    # プロセスの終了待機
    coordinator_proc.join()
    for proc in worker_procs:
        proc.join()
    
    logger.info("All processes completed")
```

## Hybrid Concurrency Patterns

### 1. Async + Threading ハイブリッド

```python
import asyncio
import threading
import concurrent.futures
from typing import Awaitable, Callable, Any, Dict, List, Optional
import time
import queue
import weakref

class AsyncThreadBridge:
    """非同期とスレッドの橋渡し"""
    
    def __init__(self, max_thread_workers: int = 10):
        self.max_thread_workers = max_thread_workers
        self.thread_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_thread_workers
        )
        
        # 非同期コンテキストでのスレッド実行結果管理
        self.pending_tasks: Dict[str, asyncio.Future] = {}
        self.task_counter = 0
        
    async def run_in_thread(
        self, 
        func: Callable, 
        *args, 
        **kwargs
    ) -> Any:
        """非同期コンテキストでスレッド関数を実行"""
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.thread_executor, 
            func, 
            *args, 
            **kwargs
        )
    
    def run_async_in_thread(
        self, 
        coro: Awaitable, 
        callback: Optional[Callable[[Any], None]] = None
    ) -> str:
        """スレッドコンテキストで非同期関数を実行"""
        
        task_id = f"async_task_{self.task_counter}"
        self.task_counter += 1
        
        def thread_runner():
            # 新しいイベントループを作成
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            
            try:
                result = new_loop.run_until_complete(coro)
                if callback:
                    callback(result)
                return result
            finally:
                new_loop.close()
        
        future = self.thread_executor.submit(thread_runner)
        return task_id
    
    async def cpu_intensive_with_progress(
        self, 
        func: Callable,
        data: List[Any],
        chunk_size: int = 10,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[Any]:
        """CPU集約的タスクの並列実行（進捗監視付き）"""
        
        chunks = [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
        completed = 0
        results = []
        
        # スレッドでチャンク処理
        async def process_chunk(chunk):
            nonlocal completed
            
            chunk_result = await self.run_in_thread(
                lambda: [func(item) for item in chunk]
            )
            
            completed += len(chunk)
            if progress_callback:
                progress_callback(completed, len(data))
                
            return chunk_result
        
        # 並列実行
        tasks = [process_chunk(chunk) for chunk in chunks]
        chunk_results = await asyncio.gather(*tasks)
        
        # 結果をフラット化
        for chunk_result in chunk_results:
            results.extend(chunk_result)
        
        return results
    
    def shutdown(self, wait: bool = True):
        """エグゼキューターのシャットダウン"""
        self.thread_executor.shutdown(wait=wait)

class HybridWorkerPool:
    """ハイブリッドワーカープール（async + thread）"""
    
    def __init__(
        self, 
        async_workers: int = 5,
        thread_workers: int = 5
    ):
        self.async_workers = async_workers
        self.thread_workers = thread_workers
        
        self.bridge = AsyncThreadBridge(max_thread_workers=thread_workers)
        self.async_semaphore = asyncio.Semaphore(async_workers)
        
        # タスクキュー
        self.async_queue: asyncio.Queue = asyncio.Queue()
        self.thread_queue: queue.Queue = queue.Queue()
        
        # ワーカー管理
        self.async_worker_tasks: List[asyncio.Task] = []
        self.thread_workers_active = threading.Event()
        self.thread_worker_threads: List[threading.Thread] = []
        
        # 統計情報
        self.stats = {
            "async_tasks_completed": 0,
            "thread_tasks_completed": 0,
            "errors": 0
        }
        
    async def start_workers(self):
        """ワーカーの開始"""
        
        # 非同期ワーカーの開始
        for i in range(self.async_workers):
            task = asyncio.create_task(self._async_worker(f"async_worker_{i}"))
            self.async_worker_tasks.append(task)
        
        # スレッドワーカーの開始
        self.thread_workers_active.set()
        for i in range(self.thread_workers):
            thread = threading.Thread(
                target=self._thread_worker,
                args=(f"thread_worker_{i}",),
                daemon=True
            )
            thread.start()
            self.thread_worker_threads.append(thread)
    
    async def _async_worker(self, worker_id: str):
        """非同期ワーカー"""
        
        while True:
            try:
                # セマフォで同時実行数を制御
                async with self.async_semaphore:
                    try:
                        task_data = await asyncio.wait_for(
                            self.async_queue.get(), 
                            timeout=1.0
                        )
                    except asyncio.TimeoutError:
                        continue
                    
                    if task_data is None:  # 終了シグナル
                        break
                    
                    func, args, kwargs, callback = task_data
                    
                    try:
                        if asyncio.iscoroutinefunction(func):
                            result = await func(*args, **kwargs)
                        else:
                            result = func(*args, **kwargs)
                        
                        if callback:
                            await callback(result)
                            
                        self.stats["async_tasks_completed"] += 1
                        
                    except Exception as e:
                        self.stats["errors"] += 1
                        logger.error(f"Async task error in {worker_id}: {e}")
                        
                    finally:
                        self.async_queue.task_done()
                        
            except Exception as e:
                logger.error(f"Async worker {worker_id} error: {e}")
    
    def _thread_worker(self, worker_id: str):
        """スレッドワーカー"""
        
        while self.thread_workers_active.is_set():
            try:
                try:
                    task_data = self.thread_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                if task_data is None:  # 終了シグナル
                    break
                
                func, args, kwargs, callback = task_data
                
                try:
                    result = func(*args, **kwargs)
                    
                    if callback:
                        callback(result)
                        
                    self.stats["thread_tasks_completed"] += 1
                    
                except Exception as e:
                    self.stats["errors"] += 1
                    logger.error(f"Thread task error in {worker_id}: {e}")
                    
                finally:
                    self.thread_queue.task_done()
                    
            except Exception as e:
                logger.error(f"Thread worker {worker_id} error: {e}")
    
    async def submit_async_task(
        self, 
        func: Callable,
        *args,
        callback: Optional[Callable] = None,
        **kwargs
    ):
        """非同期タスクの投入"""
        await self.async_queue.put((func, args, kwargs, callback))
    
    def submit_thread_task(
        self, 
        func: Callable,
        *args,
        callback: Optional[Callable] = None,
        **kwargs
    ):
        """スレッドタスクの投入"""
        self.thread_queue.put((func, args, kwargs, callback))
    
    async def submit_cpu_intensive(
        self, 
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """CPU集約的タスクの投入（結果を返す）"""
        return await self.bridge.run_in_thread(func, *args, **kwargs)
    
    async def wait_completion(self, timeout: Optional[float] = None):
        """全タスクの完了待機"""
        
        async_wait = self.async_queue.join()
        thread_wait = asyncio.create_task(
            asyncio.to_thread(self.thread_queue.join)
        )
        
        if timeout:
            await asyncio.wait_for(
                asyncio.gather(async_wait, thread_wait),
                timeout=timeout
            )
        else:
            await asyncio.gather(async_wait, thread_wait)
    
    async def shutdown(self):
        """プールのシャットダウン"""
        
        # 非同期ワーカーの停止
        for _ in range(self.async_workers):
            await self.async_queue.put(None)
        
        await asyncio.gather(*self.async_worker_tasks, return_exceptions=True)
        
        # スレッドワーカーの停止
        self.thread_workers_active.clear()
        
        for _ in range(self.thread_workers):
            self.thread_queue.put(None)
        
        for thread in self.thread_worker_threads:
            thread.join(timeout=5.0)
        
        self.bridge.shutdown()
    
    def get_stats(self) -> Dict[str, Any]:
        """統計情報の取得"""
        return {
            **self.stats,
            "async_queue_size": self.async_queue.qsize(),
            "thread_queue_size": self.thread_queue.qsize(),
            "active_async_workers": len([t for t in self.async_worker_tasks if not t.done()]),
            "active_thread_workers": len([t for t in self.thread_worker_threads if t.is_alive()])
        }

# CPU集約的関数の例
def fibonacci_cpu(n: int) -> int:
    """CPU集約的なフィボナッチ計算"""
    if n <= 1:
        return n
    return fibonacci_cpu(n - 1) + fibonacci_cpu(n - 2)

async def network_request(url: str) -> dict:
    """ネットワークリクエストのシミュレート"""
    await asyncio.sleep(0.1)  # ネットワーク遅延をシミュレート
    return {"url": url, "status": 200, "data": f"response_from_{url}"}

# 使用例
async def hybrid_example():
    pool = HybridWorkerPool(async_workers=3, thread_workers=2)
    
    # ワーカーの開始
    await pool.start_workers()
    
    # 非同期タスク（I/Oバウンド）の投入
    urls = [f"https://api{i}.example.com" for i in range(10)]
    
    results = []
    
    def collect_result(result):
        results.append(result)
    
    for url in urls:
        await pool.submit_async_task(
            network_request, 
            url, 
            callback=collect_result
        )
    
    # CPU集約的タスク（別スレッド実行）
    cpu_results = []
    
    def collect_cpu_result(result):
        cpu_results.append(result)
    
    for n in range(5, 15):
        pool.submit_thread_task(
            fibonacci_cpu, 
            n, 
            callback=collect_cpu_result
        )
    
    # 混合タスクの例（結果を直接取得）
    mixed_tasks = []
    for i in range(5):
        if i % 2 == 0:
            # 非同期タスク
            task = asyncio.create_task(network_request(f"https://mixed{i}.example.com"))
        else:
            # CPU集約的タスク
            task = asyncio.create_task(pool.submit_cpu_intensive(fibonacci_cpu, 10 + i))
        
        mixed_tasks.append(task)
    
    # 全タスクの完了を待機
    await pool.wait_completion(timeout=10.0)
    
    # 混合タスクの結果を取得
    mixed_results = await asyncio.gather(*mixed_tasks)
    
    # 統計情報の表示
    stats = pool.get_stats()
    logger.info(f"Pool statistics: {stats}")
    logger.info(f"Async results: {len(results)}")
    logger.info(f"CPU results: {len(cpu_results)}")
    logger.info(f"Mixed results: {len(mixed_results)}")
    
    # プールのシャットダウン
    await pool.shutdown()
    
    return results, cpu_results, mixed_results
```

## Performance Monitoring

### 1. 包括的パフォーマンス監視

```python
import asyncio
import threading
import time
import psutil
import resource
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from collections import deque
import weakref
import gc
import sys

@dataclass
class PerformanceMetrics:
    timestamp: float
    cpu_percent: float
    memory_usage: int
    memory_percent: float
    threads_count: int
    open_files: int
    network_connections: int
    context_switches: int = 0
    page_faults: int = 0
    
    # Python特有のメトリクス
    gc_collections: Dict[int, int] = field(default_factory=dict)
    object_count: int = 0
    
    # カスタムメトリクス
    custom_metrics: Dict[str, Any] = field(default_factory=dict)

class SystemMonitor:
    """システムパフォーマンス監視"""
    
    def __init__(self, sampling_interval: float = 1.0, history_size: int = 100):
        self.sampling_interval = sampling_interval
        self.history_size = history_size
        
        self.metrics_history: deque = deque(maxlen=history_size)
        self.custom_counters: Dict[str, int] = {}
        self.custom_timers: Dict[str, List[float]] = {}
        
        self.process = psutil.Process()
        self.monitoring_active = threading.Event()
        self.monitor_thread: Optional[threading.Thread] = None
        
        # アラート設定
        self.alert_thresholds = {
            "cpu_percent": 80.0,
            "memory_percent": 85.0,
            "threads_count": 100,
            "open_files": 1000
        }
        
        self.alert_callbacks: List[Callable[[str, PerformanceMetrics], None]] = []
    
    def start_monitoring(self):
        """監視の開始"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            return
            
        self.monitoring_active.set()
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop,
            daemon=True
        )
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """監視の停止"""
        if self.monitoring_active.is_set():
            self.monitoring_active.clear()
            
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5.0)
    
    def _monitoring_loop(self):
        """監視ループ"""
        last_cpu_times = self.process.cpu_times()
        
        while self.monitoring_active.is_set():
            try:
                # システムメトリクスの収集
                current_time = time.time()
                
                with self.process.oneshot():
                    # CPU使用率
                    cpu_percent = self.process.cpu_percent()
                    
                    # メモリ使用量
                    memory_info = self.process.memory_info()
                    memory_percent = self.process.memory_percent()
                    
                    # スレッド数
                    threads_count = self.process.num_threads()
                    
                    # オープンファイル数
                    try:
                        open_files = len(self.process.open_files())
                    except (psutil.PermissionError, psutil.AccessDenied):
                        open_files = 0
                    
                    # ネットワーク接続数
                    try:
                        network_connections = len(self.process.connections())
                    except (psutil.PermissionError, psutil.AccessDenied):
                        network_connections = 0
                    
                    # コンテキストスイッチとページフォルト
                    try:
                        ctx_switches = self.process.num_ctx_switches()
                        context_switches = ctx_switches.voluntary + ctx_switches.involuntary
                    except:
                        context_switches = 0
                    
                    try:
                        page_faults = self.process.memory_info().vms
                    except:
                        page_faults = 0
                
                # Pythonガベージコレクション統計
                gc_stats = {}
                for i in range(3):
                    gc_stats[i] = gc.get_count()[i]
                
                # オブジェクト数
                object_count = len(gc.get_objects())
                
                # メトリクスの作成
                metrics = PerformanceMetrics(
                    timestamp=current_time,
                    cpu_percent=cpu_percent,
                    memory_usage=memory_info.rss,
                    memory_percent=memory_percent,
                    threads_count=threads_count,
                    open_files=open_files,
                    network_connections=network_connections,
                    context_switches=context_switches,
                    page_faults=page_faults,
                    gc_collections=gc_stats,
                    object_count=object_count,
                    custom_metrics=self._get_custom_metrics()
                )
                
                self.metrics_history.append(metrics)
                
                # アラートのチェック
                self._check_alerts(metrics)
                
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
            
            time.sleep(self.sampling_interval)
    
    def _get_custom_metrics(self) -> Dict[str, Any]:
        """カスタムメトリクスの取得"""
        metrics = {}
        
        # カウンターの追加
        metrics.update(self.custom_counters)
        
        # タイマーの統計（平均、最大、最小）
        for name, times in self.custom_timers.items():
            if times:
                metrics[f"{name}_avg"] = sum(times) / len(times)
                metrics[f"{name}_max"] = max(times)
                metrics[f"{name}_min"] = min(times)
                metrics[f"{name}_count"] = len(times)
        
        return metrics
    
    def _check_alerts(self, metrics: PerformanceMetrics):
        """アラートのチェック"""
        for metric_name, threshold in self.alert_thresholds.items():
            value = getattr(metrics, metric_name, None)
            
            if value is not None and value > threshold:
                alert_message = f"Alert: {metric_name} = {value} exceeds threshold {threshold}"
                logger.warning(alert_message)
                
                # アラートコールバックの実行
                for callback in self.alert_callbacks:
                    try:
                        callback(alert_message, metrics)
                    except Exception as e:
                        logger.error(f"Alert callback error: {e}")
    
    def increment_counter(self, name: str, value: int = 1):
        """カスタムカウンターのインクリメント"""
        self.custom_counters[name] = self.custom_counters.get(name, 0) + value
    
    def record_time(self, name: str, duration: float):
        """実行時間の記録"""
        if name not in self.custom_timers:
            self.custom_timers[name] = deque(maxlen=100)
        self.custom_timers[name].append(duration)
    
    def add_alert_callback(self, callback: Callable[[str, PerformanceMetrics], None]):
        """アラートコールバックの追加"""
        self.alert_callbacks.append(callback)
    
    def get_current_metrics(self) -> Optional[PerformanceMetrics]:
        """現在のメトリクスの取得"""
        return self.metrics_history[-1] if self.metrics_history else None
    
    def get_metrics_history(self, last_n: Optional[int] = None) -> List[PerformanceMetrics]:
        """メトリクス履歴の取得"""
        if last_n:
            return list(self.metrics_history)[-last_n:]
        return list(self.metrics_history)
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """要約統計の取得"""
        if not self.metrics_history:
            return {}
        
        cpu_values = [m.cpu_percent for m in self.metrics_history]
        memory_values = [m.memory_percent for m in self.metrics_history]
        
        return {
            "monitoring_duration": time.time() - self.metrics_history[0].timestamp,
            "samples_collected": len(self.metrics_history),
            "cpu_avg": sum(cpu_values) / len(cpu_values),
            "cpu_max": max(cpu_values),
            "memory_avg": sum(memory_values) / len(memory_values),
            "memory_max": max(memory_values),
            "current_threads": self.metrics_history[-1].threads_count,
            "peak_threads": max(m.threads_count for m in self.metrics_history),
            "total_gc_collections": sum(
                sum(m.gc_collections.values()) for m in self.metrics_history
            )
        }

class TimingDecorator:
    """実行時間測定デコレータ"""
    
    def __init__(self, monitor: SystemMonitor, metric_name: str):
        self.monitor = monitor
        self.metric_name = metric_name
    
    def __call__(self, func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    return result
                finally:
                    duration = time.time() - start_time
                    self.monitor.record_time(self.metric_name, duration)
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    duration = time.time() - start_time
                    self.monitor.record_time(self.metric_name, duration)
            return sync_wrapper

# 使用例
def monitoring_example():
    monitor = SystemMonitor(sampling_interval=0.5, history_size=200)
    
    # アラートコールバックの設定
    def alert_handler(message: str, metrics: PerformanceMetrics):
        print(f"ALERT: {message}")
        print(f"Current CPU: {metrics.cpu_percent}%")
        print(f"Current Memory: {metrics.memory_percent}%")
    
    monitor.add_alert_callback(alert_handler)
    
    # 監視開始
    monitor.start_monitoring()
    
    # タイミングデコレータの使用
    @TimingDecorator(monitor, "cpu_task")
    def cpu_intensive_task(n: int) -> int:
        result = 0
        for i in range(n):
            result += i ** 0.5
        monitor.increment_counter("cpu_tasks_completed")
        return int(result)
    
    @TimingDecorator(monitor, "async_task")
    async def async_task(delay: float) -> str:
        await asyncio.sleep(delay)
        monitor.increment_counter("async_tasks_completed")
        return f"Task completed after {delay}s"
    
    # テスト実行
    async def run_tests():
        # CPU集約的タスクの実行
        for i in range(10):
            cpu_intensive_task(100000)
            await asyncio.sleep(0.1)
        
        # 非同期タスクの実行
        tasks = [async_task(0.1) for _ in range(20)]
        await asyncio.gather(*tasks)
        
        # 5秒間監視
        await asyncio.sleep(5)
        
        # 統計の表示
        current = monitor.get_current_metrics()
        if current:
            print(f"Current CPU: {current.cpu_percent}%")
            print(f"Current Memory: {current.memory_percent}%")
            print(f"Current Threads: {current.threads_count}")
        
        summary = monitor.get_summary_stats()
        print(f"Summary: {summary}")
        
        monitor.stop_monitoring()
    
    # 実行
    asyncio.run(run_tests())
```

## Error Handling Strategies

### 1. 包括的エラーハンドリング

```python
import asyncio
import threading
import time
import traceback
from typing import Dict, Any, List, Optional, Callable, Union, Type
from dataclasses import dataclass, field
from enum import Enum
import logging
from collections import deque
import functools

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ErrorInfo:
    timestamp: float
    error_type: str
    error_message: str
    severity: ErrorSeverity
    traceback_str: str
    context: Dict[str, Any] = field(default_factory=dict)
    recovery_attempted: bool = False
    recovery_successful: bool = False

class ConcurrencyErrorHandler:
    """並行処理用エラーハンドリングシステム"""
    
    def __init__(self, max_error_history: int = 1000):
        self.max_error_history = max_error_history
        self.error_history: deque = deque(maxlen=max_error_history)
        
        # エラー統計
        self.error_counts: Dict[str, int] = {}
        self.error_rates: Dict[str, deque] = {}
        
        # リカバリー戦略
        self.recovery_strategies: Dict[Type[Exception], Callable] = {}
        self.retry_strategies: Dict[Type[Exception], Dict[str, Any]] = {}
        
        # 通知システム
        self.error_callbacks: List[Callable[[ErrorInfo], None]] = []
        
        # サーキットブレーカー
        self.circuit_breakers: Dict[str, Dict[str, Any]] = {}
        
        # スレッドセーフティ
        self.lock = threading.RLock()
    
    def register_recovery_strategy(
        self, 
        exception_type: Type[Exception],
        recovery_func: Callable[[Exception, Dict[str, Any]], Any]
    ):
        """リカバリー戦略の登録"""
        self.recovery_strategies[exception_type] = recovery_func
    
    def register_retry_strategy(
        self, 
        exception_type: Type[Exception],
        max_retries: int = 3,
        delay: float = 1.0,
        backoff_factor: float = 2.0,
        jitter: bool = True
    ):
        """リトライ戦略の登録"""
        self.retry_strategies[exception_type] = {
            "max_retries": max_retries,
            "delay": delay,
            "backoff_factor": backoff_factor,
            "jitter": jitter
        }
    
    def handle_error(
        self, 
        exception: Exception,
        context: Dict[str, Any] = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM
    ) -> ErrorInfo:
        """エラーの処理"""
        
        if context is None:
            context = {}
        
        error_info = ErrorInfo(
            timestamp=time.time(),
            error_type=type(exception).__name__,
            error_message=str(exception),
            severity=severity,
            traceback_str=traceback.format_exc(),
            context=context
        )
        
        with self.lock:
            # エラー履歴の記録
            self.error_history.append(error_info)
            
            # エラー統計の更新
            self._update_error_stats(error_info)
            
            # リカバリーの試行
            self._attempt_recovery(exception, error_info, context)
            
            # 通知の送信
            self._notify_error(error_info)
        
        return error_info
    
    def _update_error_stats(self, error_info: ErrorInfo):
        """エラー統計の更新"""
        error_type = error_info.error_type
        
        # 累積カウント
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # レート追跡（過去5分間）
        if error_type not in self.error_rates:
            self.error_rates[error_type] = deque(maxlen=300)  # 5分間のサンプル
        
        self.error_rates[error_type].append(error_info.timestamp)
    
    def _attempt_recovery(
        self, 
        exception: Exception, 
        error_info: ErrorInfo,
        context: Dict[str, Any]
    ):
        """リカバリーの試行"""
        
        exception_type = type(exception)
        
        # 登録されたリカバリー戦略を検索
        for registered_type, recovery_func in self.recovery_strategies.items():
            if issubclass(exception_type, registered_type):
                try:
                    recovery_func(exception, context)
                    error_info.recovery_attempted = True
                    error_info.recovery_successful = True
                    logger.info(f"Recovery successful for {exception_type.__name__}")
                    break
                except Exception as recovery_error:
                    logger.error(f"Recovery failed: {recovery_error}")
                    error_info.recovery_attempted = True
                    error_info.recovery_successful = False
    
    def _notify_error(self, error_info: ErrorInfo):
        """エラー通知の送信"""
        for callback in self.error_callbacks:
            try:
                callback(error_info)
            except Exception as e:
                logger.error(f"Error callback failed: {e}")
    
    def add_error_callback(self, callback: Callable[[ErrorInfo], None]):
        """エラーコールバックの追加"""
        self.error_callbacks.append(callback)
    
    def get_error_rate(self, error_type: str, window_seconds: int = 300) -> float:
        """エラー率の取得"""
        if error_type not in self.error_rates:
            return 0.0
        
        current_time = time.time()
        cutoff_time = current_time - window_seconds
        
        recent_errors = [
            ts for ts in self.error_rates[error_type] 
            if ts >= cutoff_time
        ]
        
        return len(recent_errors) / window_seconds * 60  # 分あたりのエラー数
    
    def create_circuit_breaker(
        self, 
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception
    ):
        """サーキットブレーカーの作成"""
        self.circuit_breakers[name] = {
            "failure_threshold": failure_threshold,
            "recovery_timeout": recovery_timeout,
            "expected_exception": expected_exception,
            "failure_count": 0,
            "last_failure_time": 0,
            "state": "closed"  # closed, open, half_open
        }
    
    def circuit_breaker_call(self, name: str, func: Callable, *args, **kwargs):
        """サーキットブレーカー経由の関数呼び出し"""
        if name not in self.circuit_breakers:
            raise ValueError(f"Circuit breaker {name} not found")
        
        cb = self.circuit_breakers[name]
        current_time = time.time()
        
        # オープン状態のチェック
        if cb["state"] == "open":
            if current_time - cb["last_failure_time"] > cb["recovery_timeout"]:
                cb["state"] = "half_open"
            else:
                raise RuntimeError(f"Circuit breaker {name} is open")
        
        try:
            result = func(*args, **kwargs)
            
            # 成功時の処理
            if cb["state"] == "half_open":
                cb["state"] = "closed"
                cb["failure_count"] = 0
            
            return result
            
        except cb["expected_exception"] as e:
            cb["failure_count"] += 1
            cb["last_failure_time"] = current_time
            
            if cb["failure_count"] >= cb["failure_threshold"]:
                cb["state"] = "open"
                logger.warning(f"Circuit breaker {name} opened due to {cb['failure_count']} failures")
            
            # エラーハンドリング
            self.handle_error(e, {"circuit_breaker": name})
            raise
    
    def get_error_summary(self) -> Dict[str, Any]:
        """エラーサマリーの取得"""
        with self.lock:
            total_errors = len(self.error_history)
            
            if total_errors == 0:
                return {"total_errors": 0}
            
            # 重要度別の統計
            severity_counts = {}
            for error in self.error_history:
                severity = error.severity.value
                severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            # 最近のエラー率
            recent_rates = {}
            for error_type in self.error_counts.keys():
                recent_rates[error_type] = self.get_error_rate(error_type)
            
            return {
                "total_errors": total_errors,
                "error_counts_by_type": self.error_counts.copy(),
                "error_counts_by_severity": severity_counts,
                "recent_error_rates": recent_rates,
                "circuit_breaker_states": {
                    name: cb["state"] for name, cb in self.circuit_breakers.items()
                }
            }

class RetryDecorator:
    """リトライデコレータ"""
    
    def __init__(
        self, 
        max_retries: int = 3,
        delay: float = 1.0,
        backoff_factor: float = 2.0,
        jitter: bool = True,
        exceptions: tuple = (Exception,),
        error_handler: Optional[ConcurrencyErrorHandler] = None
    ):
        self.max_retries = max_retries
        self.delay = delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
        self.exceptions = exceptions
        self.error_handler = error_handler
    
    def __call__(self, func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):
            return self._async_wrapper(func)
        else:
            return self._sync_wrapper(func)
    
    def _sync_wrapper(self, func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(self.max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except self.exceptions as e:
                    last_exception = e
                    
                    if self.error_handler:
                        self.error_handler.handle_error(
                            e, 
                            {"attempt": attempt, "function": func.__name__}
                        )
                    
                    if attempt < self.max_retries:
                        sleep_time = self._calculate_delay(attempt)
                        time.sleep(sleep_time)
                    else:
                        break
            
            raise last_exception
        
        return wrapper
    
    def _async_wrapper(self, func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(self.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except self.exceptions as e:
                    last_exception = e
                    
                    if self.error_handler:
                        self.error_handler.handle_error(
                            e, 
                            {"attempt": attempt, "function": func.__name__}
                        )
                    
                    if attempt < self.max_retries:
                        sleep_time = self._calculate_delay(attempt)
                        await asyncio.sleep(sleep_time)
                    else:
                        break
            
            raise last_exception
        
        return wrapper
    
    def _calculate_delay(self, attempt: int) -> float:
        """遅延時間の計算"""
        delay = self.delay * (self.backoff_factor ** attempt)
        
        if self.jitter:
            import random
            delay *= (0.5 + random.random())
        
        return delay

# 使用例
def error_handling_example():
    error_handler = ConcurrencyErrorHandler()
    
    # エラーコールバックの設定
    def error_notification(error_info: ErrorInfo):
        if error_info.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            print(f"CRITICAL ERROR: {error_info.error_message}")
    
    error_handler.add_error_callback(error_notification)
    
    # リカバリー戦略の登録
    def connection_recovery(exception: Exception, context: Dict[str, Any]):
        print(f"Attempting connection recovery for: {exception}")
        # 実際のリカバリー処理
        time.sleep(0.1)
    
    error_handler.register_recovery_strategy(ConnectionError, connection_recovery)
    
    # サーキットブレーカーの作成
    error_handler.create_circuit_breaker(
        "database_calls",
        failure_threshold=3,
        recovery_timeout=30.0,
        expected_exception=ConnectionError
    )
    
    # リトライデコレータの使用
    @RetryDecorator(
        max_retries=3,
        delay=0.5,
        exceptions=(ValueError, ConnectionError),
        error_handler=error_handler
    )
    def unreliable_function(success_rate: float = 0.7) -> str:
        import random
        if random.random() < success_rate:
            return "Success!"
        else:
            if random.random() < 0.5:
                raise ValueError("Random value error")
            else:
                raise ConnectionError("Random connection error")
    
    def circuit_breaker_function():
        import random
        if random.random() < 0.3:
            raise ConnectionError("Database connection failed")
        return "Database query successful"
    
    # テスト実行
    async def run_error_tests():
        # リトライ付き関数のテスト
        for i in range(10):
            try:
                result = unreliable_function(success_rate=0.5)
                logger.info(f"Call {i}: {result}")
            except Exception as e:
                logger.error(f"Call {i} failed: {e}")
        
        # サーキットブレーカーのテスト
        for i in range(15):
            try:
                result = error_handler.circuit_breaker_call(
                    "database_calls",
                    circuit_breaker_function
                )
                logger.info(f"Circuit breaker call {i}: {result}")
            except Exception as e:
                logger.error(f"Circuit breaker call {i} failed: {e}")
            
            await asyncio.sleep(0.1)
        
        # エラーサマリーの表示
        summary = error_handler.get_error_summary()
        print(f"Error Summary: {summary}")
    
    # 実行
    asyncio.run(run_error_tests())
```

## Production Examples

### 1. Web スクレイピングシステム

```python
import asyncio
import aiohttp
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json

@dataclass
class ScrapingResult:
    url: str
    status_code: int
    content_length: int
    processing_time: float
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ProductionWebScraper:
    """本番環境用Webスクレイパー"""
    
    def __init__(
        self, 
        max_concurrent: int = 10,
        request_delay: float = 1.0,
        timeout: float = 30.0
    ):
        self.max_concurrent = max_concurrent
        self.request_delay = request_delay
        self.timeout = timeout
        
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # エラーハンドリング
        self.error_handler = ConcurrencyErrorHandler()
        self.error_handler.register_retry_strategy(
            aiohttp.ClientError,
            max_retries=3,
            delay=2.0,
            backoff_factor=2.0
        )
        
        # レート制限
        self.last_request_time = 0
        
        # 結果収集
        self.results: List[ScrapingResult] = []
        
    async def __aenter__(self):
        connector = aiohttp.TCPConnector(
            limit=self.max_concurrent * 2,
            limit_per_host=self.max_concurrent,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': 'ProductionScraper/1.0 (+https://example.com/bot)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
        )
        
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def scrape_url(self, url: str) -> ScrapingResult:
        """単一URLのスクレイピング"""
        
        async with self.semaphore:
            # レート制限の実装
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            
            if time_since_last < self.request_delay:
                await asyncio.sleep(self.request_delay - time_since_last)
            
            self.last_request_time = time.time()
            
            start_time = time.time()
            
            try:
                async with self.session.get(url) as response:
                    content = await response.text()
                    processing_time = time.time() - start_time
                    
                    # データの抽出（例：JSON API）
                    data = None
                    if response.content_type == 'application/json':
                        try:
                            data = await response.json()
                        except json.JSONDecodeError:
                            pass
                    
                    result = ScrapingResult(
                        url=url,
                        status_code=response.status,
                        content_length=len(content),
                        processing_time=processing_time,
                        data=data
                    )
                    
                    self.results.append(result)
                    return result
                    
            except Exception as e:
                processing_time = time.time() - start_time
                
                # エラーハンドリング
                self.error_handler.handle_error(
                    e, 
                    {"url": url}, 
                    ErrorSeverity.MEDIUM
                )
                
                error_result = ScrapingResult(
                    url=url,
                    status_code=0,
                    content_length=0,
                    processing_time=processing_time,
                    error=str(e)
                )
                
                self.results.append(error_result)
                return error_result
    
    async def scrape_batch(self, urls: List[str]) -> List[ScrapingResult]:
        """バッチスクレイピング"""
        
        tasks = [self.scrape_url(url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    def get_statistics(self) -> Dict[str, Any]:
        """統計情報の取得"""
        if not self.results:
            return {}
        
        successful = [r for r in self.results if r.error is None]
        failed = [r for r in self.results if r.error is not None]
        
        return {
            "total_requests": len(self.results),
            "successful_requests": len(successful),
            "failed_requests": len(failed),
            "success_rate": len(successful) / len(self.results) * 100,
            "average_response_time": sum(r.processing_time for r in successful) / len(successful) if successful else 0,
            "total_data_size": sum(r.content_length for r in successful),
            "error_summary": self.error_handler.get_error_summary()
        }

# 使用例
async def scraping_example():
    urls = [
        "https://httpbin.org/json",
        "https://httpbin.org/delay/1",
        "https://httpbin.org/status/200",
        "https://httpbin.org/status/404",
        "https://httpbin.org/status/500",
    ] * 5  # 25 URLs total
    
    async with ProductionWebScraper(
        max_concurrent=5,
        request_delay=0.5,
        timeout=10.0
    ) as scraper:
        
        logger.info(f"Starting to scrape {len(urls)} URLs")
        start_time = time.time()
        
        results = await scraper.scrape_batch(urls)
        
        total_time = time.time() - start_time
        stats = scraper.get_statistics()
        
        logger.info(f"Scraping completed in {total_time:.2f} seconds")
        logger.info(f"Statistics: {stats}")
        
        return results, stats
```

### 2. 分散タスク処理システム

```python
import asyncio
import multiprocessing
import pickle
import time
from typing import Any, Callable, Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import uuid

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Task:
    task_id: str
    function_name: str
    args: tuple
    kwargs: dict
    priority: int = 0
    created_at: float = field(default_factory=time.time)
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    worker_id: Optional[str] = None
    execution_time: float = 0.0

class DistributedTaskProcessor:
    """分散タスク処理システム"""
    
    def __init__(
        self, 
        num_workers: int = None,
        task_timeout: float = 300.0,
        result_ttl: float = 3600.0
    ):
        self.num_workers = num_workers or multiprocessing.cpu_count()
        self.task_timeout = task_timeout
        self.result_ttl = result_ttl
        
        # プロセス間通信
        self.task_queue = multiprocessing.Queue()
        self.result_queue = multiprocessing.Queue()
        self.control_queue = multiprocessing.Queue()
        
        # タスクとワーカーの管理
        self.tasks: Dict[str, Task] = {}
        self.workers: List[multiprocessing.Process] = []
        self.worker_stats: Dict[str, Dict[str, Any]] = {}
        
        # 共有状態
        self.manager = multiprocessing.Manager()
        self.shared_state = self.manager.dict()
        self.worker_heartbeats = self.manager.dict()
        
        # 登録された関数
        self.registered_functions: Dict[str, Callable] = {}
        
        # 監視スレッド
        self.monitor_active = threading.Event()
        self.monitor_thread: Optional[threading.Thread] = None
        
    def register_function(self, name: str, func: Callable):
        """処理関数の登録"""
        self.registered_functions[name] = func
        
    def submit_task(
        self, 
        func_name: str,
        *args,
        priority: int = 0,
        task_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """タスクの投入"""
        
        if func_name not in self.registered_functions:
            raise ValueError(f"Function {func_name} not registered")
        
        if task_id is None:
            task_id = str(uuid.uuid4())
        
        task = Task(
            task_id=task_id,
            function_name=func_name,
            args=args,
            kwargs=kwargs,
            priority=priority
        )
        
        self.tasks[task_id] = task
        self.task_queue.put(task)
        
        return task_id
    
    def get_task_result(
        self, 
        task_id: str, 
        timeout: Optional[float] = None
    ) -> Task:
        """タスク結果の取得"""
        
        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.tasks[task_id]
        start_time = time.time()
        
        while task.status in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            if timeout and (time.time() - start_time) > timeout:
                raise TimeoutError(f"Task {task_id} did not complete within {timeout} seconds")
            
            time.sleep(0.1)
            
        return task
    
    def cancel_task(self, task_id: str) -> bool:
        """タスクのキャンセル"""
        
        if task_id not in self.tasks:
            return False
        
        task = self.tasks[task_id]
        
        if task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            return True
        elif task.status == TaskStatus.RUNNING:
            # 実行中のタスクはワーカーに停止要求を送信
            self.control_queue.put(("cancel", task_id))
            return True
        
        return False
    
    def start_workers(self):
        """ワーカープロセスの開始"""
        
        for i in range(self.num_workers):
            worker = multiprocessing.Process(
                target=self._worker_process,
                args=(f"worker_{i}",),
                daemon=True
            )
            worker.start()
            self.workers.append(worker)
        
        # 監視スレッドの開始
        self.monitor_active.set()
        self.monitor_thread = threading.Thread(
            target=self._monitor_workers,
            daemon=True
        )
        self.monitor_thread.start()
        
        logger.info(f"Started {self.num_workers} worker processes")
    
    def _worker_process(self, worker_id: str):
        """ワーカープロセスのメインループ"""
        
        logger.info(f"Worker {worker_id} started")
        
        # ワーカー統計
        stats = {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "total_execution_time": 0.0,
            "start_time": time.time()
        }
        
        while True:
            try:
                # ハートビートの更新
                self.worker_heartbeats[worker_id] = time.time()
                
                # 制御メッセージのチェック
                try:
                    command, data = self.control_queue.get_nowait()
                    if command == "shutdown":
                        break
                    elif command == "cancel":
                        # キャンセル処理（実装は簡略化）
                        continue
                except:
                    pass
                
                # タスクの取得
                try:
                    task = self.task_queue.get(timeout=1.0)
                except:
                    continue
                
                # タスクの実行
                task.status = TaskStatus.RUNNING
                task.worker_id = worker_id
                
                start_time = time.time()
                
                try:
                    func = self.registered_functions[task.function_name]
                    result = func(*task.args, **task.kwargs)
                    
                    task.result = result
                    task.status = TaskStatus.COMPLETED
                    stats["tasks_completed"] += 1
                    
                except Exception as e:
                    task.error = str(e)
                    task.status = TaskStatus.FAILED
                    stats["tasks_failed"] += 1
                    
                    logger.error(f"Task {task.task_id} failed: {e}")
                
                finally:
                    task.execution_time = time.time() - start_time
                    stats["total_execution_time"] += task.execution_time
                    
                    # 結果をメインプロセスに送信
                    self.result_queue.put(task)
                
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
        
        # 統計情報の保存
        self.worker_stats[worker_id] = stats
        logger.info(f"Worker {worker_id} stopped")
    
    def _monitor_workers(self):
        """ワーカー監視スレッド"""
        
        while self.monitor_active.is_set():
            try:
                # 結果の処理
                try:
                    while True:
                        task = self.result_queue.get_nowait()
                        self.tasks[task.task_id] = task
                except:
                    pass
                
                # ワーカーヘルスチェック
                current_time = time.time()
                for worker_id, last_heartbeat in list(self.worker_heartbeats.items()):
                    if current_time - last_heartbeat > 30.0:  # 30秒無応答
                        logger.warning(f"Worker {worker_id} appears to be unresponsive")
                
                # タスクタイムアウトのチェック
                for task_id, task in self.tasks.items():
                    if (task.status == TaskStatus.RUNNING and 
                        current_time - task.created_at > self.task_timeout):
                        task.status = TaskStatus.FAILED
                        task.error = "Task timeout"
                        logger.warning(f"Task {task_id} timed out")
                
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                
            time.sleep(1.0)
    
    def shutdown(self, timeout: float = 30.0):
        """システムのシャットダウン"""
        
        logger.info("Shutting down distributed task processor")
        
        # 監視スレッドの停止
        if self.monitor_active.is_set():
            self.monitor_active.clear()
            
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5.0)
        
        # ワーカーに停止命令
        for _ in range(self.num_workers):
            self.control_queue.put(("shutdown", None))
        
        # ワーカープロセスの終了待機
        for worker in self.workers:
            worker.join(timeout=timeout / self.num_workers)
            
            if worker.is_alive():
                logger.warning(f"Force terminating worker {worker.pid}")
                worker.terminate()
                worker.join(timeout=5.0)
    
    def get_system_stats(self) -> Dict[str, Any]:
        """システム統計の取得"""
        
        total_tasks = len(self.tasks)
        completed = len([t for t in self.tasks.values() if t.status == TaskStatus.COMPLETED])
        failed = len([t for t in self.tasks.values() if t.status == TaskStatus.FAILED])
        running = len([t for t in self.tasks.values() if t.status == TaskStatus.RUNNING])
        pending = len([t for t in self.tasks.values() if t.status == TaskStatus.PENDING])
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed,
            "failed_tasks": failed,
            "running_tasks": running,
            "pending_tasks": pending,
            "success_rate": completed / total_tasks * 100 if total_tasks > 0 else 0,
            "active_workers": len([w for w in self.workers if w.is_alive()]),
            "worker_stats": dict(self.worker_stats)
        }

# 処理関数の例
def cpu_intensive_calculation(n: int) -> int:
    """CPU集約的な計算"""
    result = 0
    for i in range(n * 1000):
        result += i ** 0.5
    return int(result)

def data_processing_task(data: List[int]) -> Dict[str, Any]:
    """データ処理タスク"""
    import statistics
    
    return {
        "count": len(data),
        "sum": sum(data),
        "mean": statistics.mean(data),
        "median": statistics.median(data),
        "stdev": statistics.stdev(data) if len(data) > 1 else 0
    }

# 使用例
def distributed_processing_example():
    processor = DistributedTaskProcessor(num_workers=4)
    
    # 関数の登録
    processor.register_function("cpu_calc", cpu_intensive_calculation)
    processor.register_function("data_proc", data_processing_task)
    
    # ワーカーの開始
    processor.start_workers()
    
    # タスクの投入
    task_ids = []
    
    # CPU集約的タスク
    for i in range(10):
        task_id = processor.submit_task("cpu_calc", i + 1, priority=1)
        task_ids.append(task_id)
    
    # データ処理タスク
    import random
    for i in range(5):
        data = [random.randint(1, 100) for _ in range(50)]
        task_id = processor.submit_task("data_proc", data, priority=2)
        task_ids.append(task_id)
    
    # 結果の取得
    results = []
    for task_id in task_ids:
        try:
            task = processor.get_task_result(task_id, timeout=60.0)
            results.append({
                "task_id": task_id,
                "status": task.status.value,
                "result": task.result,
                "execution_time": task.execution_time
            })
        except Exception as e:
            logger.error(f"Failed to get result for task {task_id}: {e}")
    
    # 統計の表示
    stats = processor.get_system_stats()
    logger.info(f"System statistics: {stats}")
    
    # システムのシャットダウン
    processor.shutdown()
    
    return results, stats

# メイン実行
if __name__ == "__main__":
    # 例の実行
    results, stats = distributed_processing_example()
    print(f"Processed {len(results)} tasks")
    print(f"System stats: {stats}")