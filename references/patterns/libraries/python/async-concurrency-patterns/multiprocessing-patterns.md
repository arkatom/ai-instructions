# Multiprocessing Patterns

## 1. 高度なプロセス間通信

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