# Performance Monitoring

## 1. 包括的パフォーマンス監視

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