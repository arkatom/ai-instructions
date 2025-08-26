# Workflow Management

> 🎯 **目的**: Celeryを使用した複雑なワークフロー管理システムの実装
> 
> 📊 **対象**: 依存関係を持つタスクチェーン、条件付き実行、並列処理の統合管理
> 
> ⚡ **特徴**: 動的ワークフロー、依存関係解析、実行状態管理、エラーハンドリング

## ワークフローエンジンの実装

### 基本クラス定義

```python
from celery import signature, chain, group, chord
from celery.result import GroupResult
import json
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

class WorkflowStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"

@dataclass
class WorkflowStep:
    """ワークフローステップ"""
    name: str
    task_name: str
    parameters: Dict[str, Any]
    depends_on: List[str] = None
    retry_count: int = 3
    timeout: int = 300
    queue: str = 'default'
    
    def __post_init__(self):
        """初期化後の処理"""
        if self.depends_on is None:
            self.depends_on = []
```

### ワークフローエンジン

```python
class WorkflowEngine:
    """ワークフローエンジン"""
    
    def __init__(self):
        self.workflows = {}
        self.executions = {}
        self.execution_history = []
    
    def register_workflow(self, workflow_id: str, steps: List[WorkflowStep]):
        """ワークフローの登録"""
        # 依存関係の検証
        self._validate_workflow(steps)
        self.workflows[workflow_id] = steps
        print(f"Workflow '{workflow_id}' registered with {len(steps)} steps")
    
    def _validate_workflow(self, steps: List[WorkflowStep]):
        """ワークフロー検証"""
        step_names = {step.name for step in steps}
        
        for step in steps:
            # 依存関係の存在確認
            for dependency in step.depends_on:
                if dependency not in step_names:
                    raise ValueError(f"Step '{step.name}' depends on unknown step '{dependency}'")
        
        # 循環依存の検査
        self._check_circular_dependencies(steps)
    
    def _check_circular_dependencies(self, steps: List[WorkflowStep]):
        """循環依存の検査"""
        step_map = {step.name: step for step in steps}
        visited = set()
        recursion_stack = set()
        
        def has_cycle(step_name: str) -> bool:
            if step_name in recursion_stack:
                return True
            if step_name in visited:
                return False
            
            visited.add(step_name)
            recursion_stack.add(step_name)
            
            step = step_map[step_name]
            for dependency in step.depends_on:
                if has_cycle(dependency):
                    return True
            
            recursion_stack.remove(step_name)
            return False
        
        for step in steps:
            if step.name not in visited:
                if has_cycle(step.name):
                    raise ValueError(f"Circular dependency detected in workflow")
    
    def execute_workflow(self, workflow_id: str, input_data: Dict[str, Any]) -> str:
        """ワークフロー実行"""
        
        if workflow_id not in self.workflows:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        steps = self.workflows[workflow_id]
        execution_id = f"{workflow_id}_{int(time.time())}"
        
        # 依存関係の解析
        execution_plan = self._create_execution_plan(steps)
        
        # 実行状態の初期化
        self.executions[execution_id] = {
            'workflow_id': workflow_id,
            'status': WorkflowStatus.RUNNING,
            'steps': {},
            'input_data': input_data,
            'start_time': time.time(),
            'result': None,
            'error': None,
            'execution_plan': execution_plan
        }
        
        # ワークフローの非同期実行
        execute_workflow_async.delay(execution_id, execution_plan, input_data)
        
        return execution_id
    
    def _create_execution_plan(self, steps: List[WorkflowStep]) -> List[List[WorkflowStep]]:
        """実行プランの作成（依存関係を考慮）"""
        
        # 依存関係グラフの作成
        step_map = {step.name: step for step in steps}
        
        # トポロジカルソート
        execution_levels = []
        remaining_steps = set(step.name for step in steps)
        
        while remaining_steps:
            # 依存関係のないステップを見つける
            ready_steps = []
            
            for step_name in remaining_steps:
                step = step_map[step_name]
                dependencies = step.depends_on or []
                
                # 全ての依存関係が満たされているかチェック
                if all(dep not in remaining_steps for dep in dependencies):
                    ready_steps.append(step)
            
            if not ready_steps:
                raise ValueError("Circular dependency detected in workflow")
            
            execution_levels.append(ready_steps)
            
            # 処理済みステップを削除
            for step in ready_steps:
                remaining_steps.remove(step.name)
        
        return execution_levels
    
    def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
        """ワークフロー状態の取得"""
        if execution_id not in self.executions:
            raise ValueError(f"Execution {execution_id} not found")
        
        execution = self.executions[execution_id]
        
        # 詳細な状態情報を追加
        status_info = execution.copy()
        
        if execution['status'] == WorkflowStatus.RUNNING:
            # 実行中の進捗情報
            total_steps = sum(len(level) for level in execution['execution_plan'])
            completed_steps = len([step for step in execution['steps'].values() if step['status'] == 'success'])
            status_info['progress'] = {
                'completed_steps': completed_steps,
                'total_steps': total_steps,
                'percentage': int((completed_steps / total_steps) * 100) if total_steps > 0 else 0
            }
        
        return status_info
    
    def cancel_workflow(self, execution_id: str):
        """ワークフローのキャンセル"""
        if execution_id in self.executions:
            self.executions[execution_id]['status'] = WorkflowStatus.CANCELLED
            self.executions[execution_id]['end_time'] = time.time()
            # 実行中のタスクの停止処理
            print(f"Workflow {execution_id} cancelled")
    
    def get_execution_history(self) -> List[Dict[str, Any]]:
        """実行履歴の取得"""
        return [
            {
                'execution_id': exec_id,
                'workflow_id': exec_data['workflow_id'],
                'status': exec_data['status'],
                'start_time': exec_data['start_time'],
                'end_time': exec_data.get('end_time'),
                'duration': exec_data.get('end_time', time.time()) - exec_data['start_time']
            }
            for exec_id, exec_data in self.executions.items()
        ]

# グローバルワークフローエンジン
workflow_engine = WorkflowEngine()
```

## ワークフロー実行システム

### 非同期実行タスク

```python
@app.task(bind=True, base=BaseTask)
def execute_workflow_async(self, execution_id: str, execution_plan: List[List[WorkflowStep]], input_data: Dict[str, Any]):
    """ワークフローの非同期実行"""
    
    try:
        execution = workflow_engine.executions[execution_id]
        step_results = {'input': input_data}
        
        # レベルごとの実行
        for level_index, level_steps in enumerate(execution_plan):
            
            # キャンセルチェック
            if execution['status'] == WorkflowStatus.CANCELLED:
                raise Exception("Workflow cancelled by user")
            
            print(f"Executing level {level_index + 1} with {len(level_steps)} steps")
            
            # レベル内の並列実行
            if len(level_steps) == 1:
                # 単一ステップの実行
                step = level_steps[0]
                result = execute_workflow_step.delay(
                    step.task_name, 
                    step.parameters, 
                    step_results
                ).get(timeout=step.timeout)
                
                step_results[step.name] = result
                execution['steps'][step.name] = {
                    'status': 'success',
                    'result': result,
                    'execution_time': time.time(),
                    'level': level_index
                }
                
            else:
                # 並列ステップの実行
                parallel_tasks = []
                
                for step in level_steps:
                    task_signature = signature(
                        'execute_workflow_step',
                        args=[step.task_name, step.parameters, step_results],
                        queue=step.queue,
                        retry=step.retry_count
                    )
                    parallel_tasks.append(task_signature)
                
                # 並列実行
                job = group(parallel_tasks)
                result_group = job.apply_async()
                
                # 結果の収集
                parallel_results = result_group.get(timeout=max(step.timeout for step in level_steps))
                
                for step, result in zip(level_steps, parallel_results):
                    step_results[step.name] = result
                    execution['steps'][step.name] = {
                        'status': 'success',
                        'result': result,
                        'execution_time': time.time(),
                        'level': level_index
                    }
        
        # ワークフロー完了
        execution['status'] = WorkflowStatus.SUCCESS
        execution['result'] = step_results
        execution['end_time'] = time.time()
        
        print(f"Workflow {execution_id} completed successfully")
        return step_results
        
    except Exception as exc:
        # ワークフロー失敗
        execution['status'] = WorkflowStatus.FAILURE
        execution['error'] = str(exc)
        execution['end_time'] = time.time()
        
        logger.error(f"Workflow {execution_id} failed: {exc}")
        raise exc

@app.task(bind=True, base=BaseTask)
def execute_workflow_step(self, task_name: str, parameters: Dict[str, Any], context: Dict[str, Any]):
    """ワークフローステップの実行"""
    
    try:
        # タスクの動的実行
        task = app.tasks.get(task_name)
        if not task:
            raise ValueError(f"Task {task_name} not found")
        
        # コンテキストデータをパラメータに結合
        merged_params = {**context, **parameters}
        
        # タスク実行
        print(f"Executing step: {task_name}")
        result = task(**merged_params)
        print(f"Step {task_name} completed")
        
        return result
        
    except Exception as exc:
        logger.error(f"Workflow step {task_name} failed: {exc}")
        raise exc
```

## 実用的なワークフロー定義

### データ処理ワークフロー

```python
def register_data_processing_workflow():
    """データ処理ワークフローの登録"""
    
    steps = [
        WorkflowStep(
            name="validate_input",
            task_name="validate_data",
            parameters={"validation_rules": "strict"},
            queue="priority"
        ),
        WorkflowStep(
            name="clean_data",
            task_name="clean_dataset",
            parameters={"cleaning_options": {"remove_nulls": True}},
            depends_on=["validate_input"],
            queue="cpu_intensive"
        ),
        WorkflowStep(
            name="transform_data",
            task_name="transform_dataset", 
            parameters={"transformation_rules": "standard"},
            depends_on=["clean_data"],
            queue="cpu_intensive"
        ),
        WorkflowStep(
            name="analyze_data",
            task_name="analyze_dataset",
            parameters={"analysis_type": "comprehensive"},
            depends_on=["transform_data"],
            queue="cpu_intensive"
        ),
        WorkflowStep(
            name="generate_report",
            task_name="generate_analysis_report",
            parameters={"format": "pdf"},
            depends_on=["analyze_data"]
        ),
        WorkflowStep(
            name="send_notification",
            task_name="send_completion_notification",
            parameters={"notification_type": "email"},
            depends_on=["generate_report"]
        )
    ]
    
    workflow_engine.register_workflow("data_processing", steps)
```

### 条件付きワークフロー

```python
def register_conditional_workflow():
    """条件付きワークフローの登録"""
    
    steps = [
        WorkflowStep(
            name="check_prerequisites",
            task_name="check_data_prerequisites",
            parameters={}
        ),
        WorkflowStep(
            name="quick_analysis",
            task_name="quick_data_analysis", 
            parameters={"mode": "fast"},
            depends_on=["check_prerequisites"]
        ),
        WorkflowStep(
            name="detailed_analysis",
            task_name="detailed_data_analysis",
            parameters={"mode": "comprehensive"},
            depends_on=["check_prerequisites"]
        ),
        WorkflowStep(
            name="conditional_processing",
            task_name="conditional_data_processing",
            parameters={
                "conditions": {
                    "data_size_large": {
                        "type": "value_greater_than",
                        "params": {"field": "data_size", "threshold": 1000000},
                        "task": "detailed_analysis"
                    },
                    "data_size_small": {
                        "type": "value_greater_than",
                        "params": {"field": "data_size", "threshold": 10000},
                        "task": "quick_analysis"
                    }
                }
            },
            depends_on=["check_prerequisites"]
        )
    ]
    
    workflow_engine.register_workflow("conditional_processing", steps)
```

### 複雑な並列ワークフロー

```python
def register_parallel_processing_workflow():
    """並列処理ワークフローの登録"""
    
    steps = [
        # 初期化フェーズ
        WorkflowStep(
            name="initialize",
            task_name="initialize_processing",
            parameters={"config": "production"}
        ),
        
        # 並列データ準備フェーズ
        WorkflowStep(
            name="prepare_user_data",
            task_name="prepare_user_data",
            parameters={"data_type": "users"},
            depends_on=["initialize"],
            queue="io_intensive"
        ),
        WorkflowStep(
            name="prepare_product_data",
            task_name="prepare_product_data", 
            parameters={"data_type": "products"},
            depends_on=["initialize"],
            queue="io_intensive"
        ),
        WorkflowStep(
            name="prepare_analytics_data",
            task_name="prepare_analytics_data",
            parameters={"data_type": "analytics"},
            depends_on=["initialize"],
            queue="io_intensive"
        ),
        
        # 並列分析フェーズ
        WorkflowStep(
            name="analyze_user_behavior",
            task_name="analyze_user_behavior",
            parameters={"analysis_type": "behavioral"},
            depends_on=["prepare_user_data", "prepare_analytics_data"],
            queue="cpu_intensive"
        ),
        WorkflowStep(
            name="analyze_product_performance",
            task_name="analyze_product_performance",
            parameters={"analysis_type": "performance"},
            depends_on=["prepare_product_data", "prepare_analytics_data"],
            queue="cpu_intensive"
        ),
        
        # 統合フェーズ
        WorkflowStep(
            name="integrate_results",
            task_name="integrate_analysis_results",
            parameters={"integration_method": "comprehensive"},
            depends_on=["analyze_user_behavior", "analyze_product_performance"],
            timeout=600
        ),
        
        # 最終出力フェーズ
        WorkflowStep(
            name="generate_dashboard",
            task_name="generate_dashboard",
            parameters={"dashboard_type": "executive"},
            depends_on=["integrate_results"]
        ),
        WorkflowStep(
            name="send_alerts",
            task_name="send_threshold_alerts",
            parameters={"alert_level": "high"},
            depends_on=["integrate_results"]
        )
    ]
    
    workflow_engine.register_workflow("parallel_processing", steps)
```

## 使用例とモニタリング

### ワークフロー実行例

```python
def execute_data_processing_example():
    """データ処理ワークフローの実行例"""
    
    input_data = {
        "dataset_id": 123,
        "processing_options": {
            "quality_threshold": 0.95,
            "output_format": "json"
        },
        "notification_recipients": ["admin@example.com"]
    }
    
    execution_id = workflow_engine.execute_workflow("data_processing", input_data)
    
    # 実行状況の監視
    import time
    while True:
        status = workflow_engine.get_workflow_status(execution_id)
        print(f"Status: {status['status']}")
        
        if status['status'] in [WorkflowStatus.SUCCESS, WorkflowStatus.FAILURE, WorkflowStatus.CANCELLED]:
            break
            
        if status['status'] == WorkflowStatus.RUNNING:
            progress = status.get('progress', {})
            print(f"Progress: {progress.get('percentage', 0)}% ({progress.get('completed_steps', 0)}/{progress.get('total_steps', 0)})")
        
        time.sleep(5)
    
    return execution_id

# 初期化時にワークフローを登録
register_data_processing_workflow()
register_conditional_workflow()
register_parallel_processing_workflow()
```

### ワークフロー管理ユーティリティ

```python
class WorkflowManager:
    """ワークフロー管理ユーティリティ"""
    
    def __init__(self, engine: WorkflowEngine):
        self.engine = engine
    
    def list_workflows(self) -> List[str]:
        """登録済みワークフロー一覧"""
        return list(self.engine.workflows.keys())
    
    def get_workflow_info(self, workflow_id: str) -> Dict[str, Any]:
        """ワークフロー情報の取得"""
        if workflow_id not in self.engine.workflows:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        steps = self.engine.workflows[workflow_id]
        return {
            'workflow_id': workflow_id,
            'step_count': len(steps),
            'steps': [
                {
                    'name': step.name,
                    'task_name': step.task_name,
                    'depends_on': step.depends_on,
                    'queue': step.queue,
                    'timeout': step.timeout
                }
                for step in steps
            ]
        }
    
    def cancel_all_executions(self):
        """全実行のキャンセル"""
        for execution_id in self.engine.executions:
            if self.engine.executions[execution_id]['status'] == WorkflowStatus.RUNNING:
                self.engine.cancel_workflow(execution_id)
    
    def cleanup_completed_executions(self, max_age_hours: int = 24):
        """完了した実行の清理"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        to_remove = []
        for execution_id, execution in self.engine.executions.items():
            if (execution.get('end_time', time.time()) < cutoff_time and 
                execution['status'] in [WorkflowStatus.SUCCESS, WorkflowStatus.FAILURE]):
                to_remove.append(execution_id)
        
        for execution_id in to_remove:
            del self.engine.executions[execution_id]
        
        print(f"Cleaned up {len(to_remove)} completed executions")

# グローバル管理インスタンス
workflow_manager = WorkflowManager(workflow_engine)
```