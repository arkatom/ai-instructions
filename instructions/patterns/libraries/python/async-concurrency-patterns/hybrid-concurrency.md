# Hybrid Concurrency Patterns

## 1. Async + Threading ハイブリッド

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