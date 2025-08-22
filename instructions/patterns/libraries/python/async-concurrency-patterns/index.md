# Async Python Concurrency Patterns

本番環境で使用されるPythonの非同期・並行・並列処理の高度なパターン集です。asyncio、threading、multiprocessingを活用した実用的なソリューションを提供します。

## 目次

1. [Asyncio Advanced Patterns](#asyncio-advanced-patterns) - 本ファイル
2. [Concurrent Futures Patterns](./concurrent-futures.md)
3. [Threading Patterns](./threading-patterns.md)
4. [Multiprocessing Patterns](./multiprocessing-patterns.md)
5. [Hybrid Concurrency Patterns](./hybrid-concurrency.md)
6. [Performance Monitoring](./performance-monitoring.md)
7. [Error Handling Strategies](./error-handling.md)
8. [Production Examples](./production-examples.md)

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