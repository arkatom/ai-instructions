# Production Examples

## 1. Web スクレイピングシステム

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

## 2. 分散タスク処理システム

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
```