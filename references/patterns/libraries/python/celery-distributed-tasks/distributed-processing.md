# Distributed Processing

> 🎯 **目的**: Celeryを使用した大規模分散データ処理システムの実装
> 
> 📊 **対象**: Map-Reduceパターン、データパーティション、並列処理最適化
> 
> ⚡ **特徴**: スケーラブルな分散処理、動的負荷分散、リアルタイム進捗監視

## 分散処理アーキテクチャ

### 基本データ構造

```python
import hashlib
import json
from typing import List, Dict, Any, Tuple
from celery import group, chord, chain
from celery.result import GroupResult
import numpy as np
from dataclasses import dataclass
import time

@dataclass
class ProcessingPartition:
    """処理パーティション"""
    partition_id: str
    data_range: Tuple[int, int]
    parameters: Dict[str, Any]
    assigned_worker: str = None
    estimated_processing_time: float = 0.0
    
    def __post_init__(self):
        """初期化後の処理"""
        if not self.partition_id:
            # ハッシュベースのパーティションID生成
            content = f"{self.data_range}_{hash(str(self.parameters))}"
            self.partition_id = hashlib.md5(content.encode()).hexdigest()[:8]

@dataclass
class ProcessingJob:
    """分散処理ジョブ"""
    job_id: str
    dataset_id: str
    processing_function: str
    parameters: Dict[str, Any]
    partitions: List[ProcessingPartition]
    status: str = 'pending'
    start_time: float = 0.0
    end_time: float = 0.0
    result: Any = None
    error: str = None
```

### 分散処理マネージャー

```python
class DistributedProcessor:
    """分散処理管理クラス"""
    
    def __init__(self, celery_app):
        self.celery_app = celery_app
        self.active_jobs = {}
        self.job_history = []
        self.performance_stats = {
            'total_jobs': 0,
            'successful_jobs': 0,
            'failed_jobs': 0,
            'total_processing_time': 0.0
        }
    
    def process_large_dataset(
        self, 
        dataset_id: str, 
        processing_function: str,
        parameters: Dict[str, Any],
        partition_size: int = 10000,
        max_workers: int = None
    ) -> str:
        """大容量データセットの分散処理"""
        
        # データセットサイズの取得
        dataset_size = self._get_dataset_size(dataset_id)
        print(f"Processing dataset {dataset_id} with {dataset_size} items")
        
        # パーティション計画の作成
        partitions = self._create_partitions(dataset_id, dataset_size, partition_size)
        
        # ワーカー数の最適化
        if max_workers is None:
            max_workers = min(len(partitions), self._get_optimal_worker_count())
        
        # 分散処理ジョブの作成
        job_id = f"distributed_{dataset_id}_{int(time.time())}"
        
        job = ProcessingJob(
            job_id=job_id,
            dataset_id=dataset_id,
            processing_function=processing_function,
            parameters=parameters,
            partitions=partitions
        )
        
        # Map-Reduce パターンでの処理
        map_tasks = []
        for partition in partitions:
            task_signature = distributed_map_task.s(
                partition.partition_id,
                partition.data_range,
                processing_function,
                parameters
            )
            map_tasks.append(task_signature)
        
        # Chord パターン: Map フェーズ + Reduce フェーズ
        celery_job = chord(map_tasks)(
            distributed_reduce_task.s(dataset_id, processing_function)
        )
        
        # ジョブの追跡
        self.active_jobs[job_id] = {
            'job': celery_job,
            'job_info': job,
            'start_time': time.time(),
            'status': 'running'
        }
        
        self.performance_stats['total_jobs'] += 1
        
        print(f"Started distributed job {job_id} with {len(partitions)} partitions")
        return job_id
    
    def _get_dataset_size(self, dataset_id: str) -> int:
        """データセットサイズの取得"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM dataset_items WHERE dataset_id = %s", (dataset_id,))
                result = cursor.fetchone()
                return result[0] if result else 0
        except Exception as e:
            logger.error(f"Failed to get dataset size for {dataset_id}: {e}")
            return 0
    
    def _create_partitions(
        self, 
        dataset_id: str, 
        dataset_size: int, 
        partition_size: int
    ) -> List[ProcessingPartition]:
        """パーティション作成"""
        
        partitions = []
        for i in range(0, dataset_size, partition_size):
            end_index = min(i + partition_size, dataset_size)
            
            partition = ProcessingPartition(
                partition_id=f"{dataset_id}_partition_{i//partition_size}",
                data_range=(i, end_index),
                parameters={
                    'dataset_id': dataset_id,
                    'partition_index': i//partition_size
                },
                estimated_processing_time=self._estimate_processing_time(end_index - i)
            )
            partitions.append(partition)
        
        return partitions
    
    def _estimate_processing_time(self, item_count: int) -> float:
        """処理時間の推定"""
        # 過去の実行データに基づく推定
        base_time_per_item = 0.001  # 1アイテム当たり1ms
        overhead = 0.5  # オーバーヘッド500ms
        return (item_count * base_time_per_item) + overhead
    
    def _get_optimal_worker_count(self) -> int:
        """最適ワーカー数の取得"""
        # システムリソースに基づく推定
        try:
            import psutil
            cpu_count = psutil.cpu_count()
            memory_gb = psutil.virtual_memory().total / (1024**3)
            
            # CPU数とメモリに基づく推定
            optimal_workers = min(
                cpu_count * 2,  # CPU数の2倍
                int(memory_gb / 0.5),  # 500MBあたり1ワーカー
                20  # 最大20ワーカー
            )
            
            return max(optimal_workers, 2)  # 最低2ワーカー
        except ImportError:
            return 4  # デフォルト値
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """ジョブステータスの取得"""
        if job_id not in self.active_jobs:
            # 履歴から検索
            for historical_job in self.job_history:
                if historical_job['job_id'] == job_id:
                    return historical_job
            return {"status": "not_found"}
        
        job_info = self.active_jobs[job_id]
        celery_job = job_info['job']
        
        # ジョブの状態確認
        status_info = {
            'job_id': job_id,
            'status': job_info['status'],
            'partitions': len(job_info['job_info'].partitions),
            'start_time': job_info['start_time'],
            'dataset_id': job_info['job_info'].dataset_id,
            'processing_function': job_info['job_info'].processing_function
        }
        
        if celery_job.ready():
            try:
                result = celery_job.get()
                job_info['status'] = 'completed'
                job_info['result'] = result
                job_info['end_time'] = time.time()
                
                status_info.update({
                    'status': 'completed',
                    'result': result,
                    'end_time': job_info['end_time'],
                    'duration': job_info['end_time'] - job_info['start_time']
                })
                
                self.performance_stats['successful_jobs'] += 1
                self.performance_stats['total_processing_time'] += status_info['duration']
                
                # 履歴に移動
                self.job_history.append(status_info.copy())
                del self.active_jobs[job_id]
                
            except Exception as e:
                job_info['status'] = 'failed'
                job_info['error'] = str(e)
                job_info['end_time'] = time.time()
                
                status_info.update({
                    'status': 'failed',
                    'error': str(e),
                    'end_time': job_info['end_time']
                })
                
                self.performance_stats['failed_jobs'] += 1
                
                # 履歴に移動
                self.job_history.append(status_info.copy())
                del self.active_jobs[job_id]
        else:
            # 進行中の詳細情報
            try:
                # Map タスクの進捗確認
                map_results = []
                completed_partitions = 0
                
                for partition in job_info['job_info'].partitions:
                    # 各パーティションの状態チェック（実装依存）
                    completed_partitions += 1  # 簡略化
                
                status_info.update({
                    'progress': {
                        'completed_partitions': completed_partitions,
                        'total_partitions': len(job_info['job_info'].partitions),
                        'percentage': int((completed_partitions / len(job_info['job_info'].partitions)) * 100)
                    }
                })
            except Exception as e:
                logger.warning(f"Failed to get detailed progress for {job_id}: {e}")
        
        return status_info
    
    def cancel_job(self, job_id: str) -> bool:
        """ジョブのキャンセル"""
        if job_id not in self.active_jobs:
            return False
        
        try:
            celery_job = self.active_jobs[job_id]['job']
            celery_job.revoke(terminate=True)
            
            self.active_jobs[job_id]['status'] = 'cancelled'
            self.active_jobs[job_id]['end_time'] = time.time()
            
            print(f"Job {job_id} cancelled")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {e}")
            return False
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """パフォーマンス統計の取得"""
        stats = self.performance_stats.copy()
        
        if stats['successful_jobs'] > 0:
            stats['average_processing_time'] = stats['total_processing_time'] / stats['successful_jobs']
        else:
            stats['average_processing_time'] = 0.0
        
        stats['success_rate'] = (stats['successful_jobs'] / stats['total_jobs'] * 100) if stats['total_jobs'] > 0 else 0.0
        stats['active_jobs'] = len(self.active_jobs)
        stats['historical_jobs'] = len(self.job_history)
        
        return stats
```

## Map-Reduce実装

### Map フェーズタスク

```python
# 分散処理タスク
@app.task(bind=True, base=BaseTask, queue='cpu_intensive')
def distributed_map_task(
    self, 
    partition_id: str,
    data_range: Tuple[int, int],
    processing_function: str,
    parameters: Dict[str, Any]
):
    """分散Mapタスク"""
    
    start_index, end_index = data_range
    dataset_id = parameters.get('dataset_id', partition_id.split('_')[0])
    
    self.update_state(
        state='PROGRESS',
        meta={
            'partition_id': partition_id,
            'progress': 0,
            'status': f'Starting processing for partition {partition_id}',
            'data_range': data_range
        }
    )
    
    try:
        # データの読み込み
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT item_index, data FROM dataset_items 
                WHERE dataset_id = %s AND item_index BETWEEN %s AND %s
                ORDER BY item_index
            """, (dataset_id, start_index, end_index - 1))
            
            partition_data = []
            for item_index, data_json in cursor.fetchall():
                partition_data.append({
                    'index': item_index,
                    'data': json.loads(data_json)
                })
        
        if not partition_data:
            logger.warning(f"No data found for partition {partition_id}")
            return {
                'partition_id': partition_id,
                'processed_count': 0,
                'results': [],
                'processing_time': 0,
                'warning': 'No data found'
            }
        
        # 処理関数の実行
        processing_func = get_processing_function(processing_function)
        
        results = []
        total_items = len(partition_data)
        start_time = time.time()
        
        for i, item in enumerate(partition_data):
            # アイテムの処理
            try:
                processed_item = processing_func(item['data'], parameters)
                processed_item['original_index'] = item['index']
                results.append(processed_item)
            except Exception as item_error:
                logger.error(f"Failed to process item {item['index']} in partition {partition_id}: {item_error}")
                # エラーアイテムも記録
                results.append({
                    'original_index': item['index'],
                    'error': str(item_error),
                    'status': 'failed'
                })
            
            # 進捗更新
            if i % 100 == 0 or i == total_items - 1:
                progress = int((i + 1) / total_items * 100)
                elapsed_time = time.time() - start_time
                items_per_second = (i + 1) / elapsed_time if elapsed_time > 0 else 0
                
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'partition_id': partition_id,
                        'progress': progress,
                        'processed': i + 1,
                        'total': total_items,
                        'items_per_second': round(items_per_second, 2),
                        'elapsed_time': round(elapsed_time, 2)
                    }
                )
        
        # パーティション結果の保存
        processing_time = time.time() - start_time
        partition_result = {
            'partition_id': partition_id,
            'processed_count': len(results),
            'successful_count': len([r for r in results if r.get('status') != 'failed']),
            'failed_count': len([r for r in results if r.get('status') == 'failed']),
            'results': results,
            'processing_time': processing_time,
            'items_per_second': len(results) / processing_time if processing_time > 0 else 0,
            'data_range': data_range
        }
        
        print(f"Completed partition {partition_id}: {len(results)} items in {processing_time:.2f}s")
        return partition_result
        
    except Exception as exc:
        logger.error(f"Map task failed for partition {partition_id}: {exc}")
        self.update_state(
            state='FAILURE',
            meta={
                'partition_id': partition_id,
                'error': str(exc),
                'traceback': traceback.format_exc()
            }
        )
        raise exc

@app.task(bind=True, base=BaseTask)
def distributed_reduce_task(self, map_results: List[Dict[str, Any]], dataset_id: str, processing_function: str):
    """分散Reduceタスク"""
    
    self.update_state(
        state='PROGRESS',
        meta={'status': 'Starting reduce phase', 'progress': 0}
    )
    
    try:
        # Map結果の検証と前処理
        valid_results = []
        failed_partitions = []
        
        for partition_result in map_results:
            if 'error' in partition_result:
                failed_partitions.append(partition_result['partition_id'])
                continue
            valid_results.append(partition_result)
        
        if failed_partitions:
            logger.warning(f"Some partitions failed: {failed_partitions}")
        
        # Map結果の集約
        total_processed = 0
        total_successful = 0
        total_failed = 0
        all_results = []
        processing_stats = {
            'partitions_processed': len(valid_results),
            'partitions_failed': len(failed_partitions),
            'total_processing_time': 0.0,
            'average_items_per_second': 0.0
        }
        
        for partition_result in valid_results:
            total_processed += partition_result['processed_count']
            total_successful += partition_result.get('successful_count', partition_result['processed_count'])
            total_failed += partition_result.get('failed_count', 0)
            all_results.extend(partition_result['results'])
            processing_stats['total_processing_time'] += partition_result['processing_time']
        
        # 平均処理速度の計算
        if valid_results:
            avg_items_per_second = sum(r.get('items_per_second', 0) for r in valid_results) / len(valid_results)
            processing_stats['average_items_per_second'] = round(avg_items_per_second, 2)
        
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Aggregating results', 'progress': 50}
        )
        
        # 最終的な集約処理
        reduce_func = get_reduce_function(processing_function)
        final_result = reduce_func(all_results)
        
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Saving final result', 'progress': 90}
        )
        
        # 最終結果の保存
        result_summary = {
            'dataset_id': dataset_id,
            'processing_function': processing_function,
            'total_processed': total_processed,
            'total_successful': total_successful,
            'total_failed': total_failed,
            'success_rate': (total_successful / total_processed * 100) if total_processed > 0 else 0,
            'final_result': final_result,
            'partitions_processed': processing_stats['partitions_processed'],
            'partitions_failed': processing_stats['partitions_failed'],
            'processing_stats': processing_stats,
            'completed_at': time.time()
        }
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO distributed_processing_results 
                (dataset_id, processing_function, result_data, total_processed, success_rate, completed_at) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                dataset_id, 
                processing_function,
                json.dumps(result_summary),
                total_processed,
                result_summary['success_rate'],
                result_summary['completed_at']
            ))
            conn.commit()
        
        print(f"Distributed processing completed for dataset {dataset_id}: {total_processed} items processed")
        return result_summary
        
    except Exception as exc:
        logger.error(f"Reduce task failed for dataset {dataset_id}: {exc}")
        self.update_state(
            state='FAILURE',
            meta={
                'error': str(exc),
                'traceback': traceback.format_exc()
            }
        )
        raise exc
```

## 処理関数とヘルパー

### 動的処理関数システム

```python
def get_processing_function(function_name: str):
    """処理関数の取得"""
    
    processing_functions = {
        'data_validation': validate_data_item,
        'data_transformation': transform_data_item,
        'data_analysis': analyze_data_item,
        'data_aggregation': aggregate_data_item,
        'data_enrichment': enrich_data_item,
        'data_classification': classify_data_item,
    }
    
    func = processing_functions.get(function_name)
    if func is None:
        raise ValueError(f"Unknown processing function: {function_name}")
    
    return func

def get_reduce_function(function_name: str):
    """Reduce関数の取得"""
    
    reduce_functions = {
        'data_validation': lambda results: {
            'valid_count': sum(1 for r in results if r.get('valid', False) and r.get('status') != 'failed'),
            'invalid_count': sum(1 for r in results if not r.get('valid', False)),
            'error_count': sum(1 for r in results if r.get('status') == 'failed'),
            'validation_summary': aggregate_validation_results(results)
        },
        'data_transformation': lambda results: {
            'transformed_items': [r for r in results if r.get('status') != 'failed'],
            'transformation_summary': summarize_transformations(results)
        },
        'data_analysis': lambda results: {
            'total_items': len([r for r in results if r.get('status') != 'failed']),
            'statistics': calculate_statistics(results),
            'analysis_summary': create_analysis_summary(results)
        },
        'data_aggregation': lambda results: aggregate_all_results(results),
        'data_enrichment': lambda results: {
            'enriched_items': [r for r in results if r.get('status') != 'failed'],
            'enrichment_stats': calculate_enrichment_stats(results)
        },
        'data_classification': lambda results: {
            'classification_summary': summarize_classifications(results),
            'class_distribution': calculate_class_distribution(results)
        }
    }
    
    func = reduce_functions.get(function_name)
    if func is None:
        return lambda results: {'results': results}  # デフォルト
    
    return func
```

### 具体的な処理関数実装

```python
# 具体的な処理関数
def validate_data_item(item: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """データアイテムの検証"""
    
    validation_rules = parameters.get('validation_rules', {})
    
    result = {
        'item_id': item.get('id'),
        'valid': True,
        'errors': [],
        'warnings': []
    }
    
    # 必須フィールドの検証
    required_fields = validation_rules.get('required_fields', [])
    for field in required_fields:
        if field not in item or item[field] is None or item[field] == '':
            result['valid'] = False
            result['errors'].append(f'Missing required field: {field}')
    
    # データ型の検証
    type_validations = validation_rules.get('type_validations', {})
    for field, expected_type in type_validations.items():
        if field in item and item[field] is not None:
            if not isinstance(item[field], expected_type):
                result['valid'] = False
                result['errors'].append(f'Invalid type for field {field}: expected {expected_type.__name__}')
    
    # 値の範囲検証
    range_validations = validation_rules.get('range_validations', {})
    for field, range_config in range_validations.items():
        if field in item and item[field] is not None:
            value = item[field]
            min_val = range_config.get('min')
            max_val = range_config.get('max')
            
            if min_val is not None and value < min_val:
                result['valid'] = False
                result['errors'].append(f'Field {field} value {value} is below minimum {min_val}')
            
            if max_val is not None and value > max_val:
                result['valid'] = False
                result['errors'].append(f'Field {field} value {value} is above maximum {max_val}')
    
    # パターン検証（正規表現）
    pattern_validations = validation_rules.get('pattern_validations', {})
    for field, pattern in pattern_validations.items():
        if field in item and item[field] is not None:
            import re
            if not re.match(pattern, str(item[field])):
                result['valid'] = False
                result['errors'].append(f'Field {field} does not match pattern {pattern}')
    
    return result

def transform_data_item(item: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """データアイテムの変換"""
    
    transformations = parameters.get('transformations', {})
    
    transformed_item = item.copy()
    
    # フィールドの正規化
    if 'normalize_fields' in transformations:
        for field in transformations['normalize_fields']:
            if field in transformed_item and isinstance(transformed_item[field], str):
                transformed_item[field] = transformed_item[field].lower().strip()
    
    # 計算フィールドの追加
    if 'calculated_fields' in transformations:
        for calc_field, expression in transformations['calculated_fields'].items():
            try:
                # 安全な計算式の評価
                safe_dict = {k: v for k, v in transformed_item.items() if isinstance(k, str)}
                transformed_item[calc_field] = eval(expression, {"__builtins__": {}}, safe_dict)
            except Exception as e:
                transformed_item[calc_field] = None
                logger.warning(f"Failed to calculate field {calc_field}: {e}")
    
    # フィールドの変換
    if 'field_mappings' in transformations:
        for old_field, new_field in transformations['field_mappings'].items():
            if old_field in transformed_item:
                transformed_item[new_field] = transformed_item[old_field]
                if old_field != new_field:
                    del transformed_item[old_field]
    
    # データ型変換
    if 'type_conversions' in transformations:
        for field, target_type in transformations['type_conversions'].items():
            if field in transformed_item and transformed_item[field] is not None:
                try:
                    if target_type == 'int':
                        transformed_item[field] = int(transformed_item[field])
                    elif target_type == 'float':
                        transformed_item[field] = float(transformed_item[field])
                    elif target_type == 'str':
                        transformed_item[field] = str(transformed_item[field])
                    elif target_type == 'bool':
                        transformed_item[field] = bool(transformed_item[field])
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to convert {field} to {target_type}: {e}")
    
    return transformed_item

def analyze_data_item(item: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """データアイテムの分析"""
    
    analysis_config = parameters.get('analysis_config', {})
    
    analysis_result = {
        'item_id': item.get('id'),
        'metrics': {},
        'categories': [],
        'anomalies': [],
        'insights': []
    }
    
    # 数値メトリクスの計算
    numeric_fields = analysis_config.get('numeric_fields', [])
    for field in numeric_fields:
        if field in item and isinstance(item[field], (int, float)):
            analysis_result['metrics'][field] = {
                'value': item[field],
                'normalized': item[field] / analysis_config.get('normalization_factors', {}).get(field, 1),
                'percentile': calculate_percentile(item[field], field, analysis_config)
            }
    
    # カテゴリ分類
    categorization_rules = analysis_config.get('categorization_rules', {})
    for category, rules in categorization_rules.items():
        if evaluate_categorization_rules(item, rules):
            analysis_result['categories'].append(category)
    
    # 異常検知
    anomaly_detection = analysis_config.get('anomaly_detection', {})
    if anomaly_detection.get('enabled', False):
        anomalies = detect_anomalies(item, anomaly_detection)
        analysis_result['anomalies'].extend(anomalies)
    
    return analysis_result

def aggregate_data_item(item: Dict[str, Any], parameters: Dict[str, Any]) -> Dict[str, Any]:
    """データアイテムの集約"""
    
    aggregation_config = parameters.get('aggregation_config', {})
    
    # グループキーの生成
    group_fields = aggregation_config.get('group_by', [])
    group_key = tuple(item.get(field, 'null') for field in group_fields)
    
    # 集約値の計算
    aggregate_fields = aggregation_config.get('aggregate_fields', {})
    aggregated_values = {}
    
    for field, aggregation_type in aggregate_fields.items():
        if field in item:
            value = item[field]
            
            if aggregation_type == 'sum':
                aggregated_values[f'{field}_sum'] = value
            elif aggregation_type == 'count':
                aggregated_values[f'{field}_count'] = 1
            elif aggregation_type == 'avg':
                aggregated_values[f'{field}_sum'] = value
                aggregated_values[f'{field}_count'] = 1
            elif aggregation_type == 'min':
                aggregated_values[f'{field}_min'] = value
            elif aggregation_type == 'max':
                aggregated_values[f'{field}_max'] = value
    
    return {
        'group_key': group_key,
        'aggregated_values': aggregated_values,
        'original_item': item
    }
```

## 使用例と最適化

### 分散処理実行例

```python
# 分散処理の実行例
distributed_processor = DistributedProcessor(app)

def run_distributed_processing_example():
    """分散処理の実行例"""
    
    # データ検証の分散処理
    validation_job = distributed_processor.process_large_dataset(
        dataset_id="dataset_001",
        processing_function="data_validation",
        parameters={
            "validation_rules": {
                "required_fields": ["id", "name", "email"],
                "type_validations": {
                    "id": int,
                    "name": str,
                    "email": str
                },
                "pattern_validations": {
                    "email": r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                }
            }
        },
        partition_size=5000
    )
    
    # データ変換の分散処理
    transformation_job = distributed_processor.process_large_dataset(
        dataset_id="dataset_001",
        processing_function="data_transformation",
        parameters={
            "transformations": {
                "normalize_fields": ["name", "email"],
                "calculated_fields": {
                    "name_length": "len(name) if 'name' in locals() and name else 0"
                },
                "type_conversions": {
                    "age": "int",
                    "score": "float"
                }
            }
        },
        partition_size=5000
    )
    
    print(f"Started validation job: {validation_job}")
    print(f"Started transformation job: {transformation_job}")
    
    return validation_job, transformation_job

def monitor_distributed_jobs():
    """分散ジョブの監視例"""
    
    # 実行中のジョブ監視
    while distributed_processor.active_jobs:
        for job_id in list(distributed_processor.active_jobs.keys()):
            status = distributed_processor.get_job_status(job_id)
            
            print(f"Job {job_id}: {status['status']}")
            
            if 'progress' in status:
                progress = status['progress']
                print(f"  Progress: {progress['percentage']}% ({progress['completed_partitions']}/{progress['total_partitions']})")
            
            if status['status'] in ['completed', 'failed']:
                if status['status'] == 'completed':
                    print(f"  Duration: {status['duration']:.2f}s")
                    print(f"  Result summary: {status['result'].get('total_processed', 'N/A')} items")
                else:
                    print(f"  Error: {status['error']}")
        
        time.sleep(5)
    
    # パフォーマンス統計の表示
    stats = distributed_processor.get_performance_stats()
    print("\nPerformance Statistics:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
```

### パフォーマンス最適化のヒント

```python
class OptimizedDistributedProcessor(DistributedProcessor):
    """最適化された分散処理システム"""
    
    def __init__(self, celery_app):
        super().__init__(celery_app)
        self.optimization_config = {
            'dynamic_partitioning': True,
            'adaptive_worker_count': True,
            'load_balancing': True,
            'caching_enabled': True
        }
    
    def _create_optimized_partitions(self, dataset_id: str, dataset_size: int, base_partition_size: int):
        """最適化されたパーティション作成"""
        
        if not self.optimization_config['dynamic_partitioning']:
            return super()._create_partitions(dataset_id, dataset_size, base_partition_size)
        
        # システムリソースに基づく動的パーティションサイズ調整
        optimal_partition_size = self._calculate_optimal_partition_size(dataset_size, base_partition_size)
        
        return super()._create_partitions(dataset_id, dataset_size, optimal_partition_size)
    
    def _calculate_optimal_partition_size(self, dataset_size: int, base_size: int) -> int:
        """最適なパーティションサイズの計算"""
        
        try:
            import psutil
            
            # メモリ使用量に基づく調整
            memory_percent = psutil.virtual_memory().percent
            if memory_percent > 80:
                return max(base_size // 2, 1000)  # メモリ不足時は小さく
            elif memory_percent < 50:
                return min(base_size * 2, 50000)  # メモリ余裕時は大きく
            
        except ImportError:
            pass
        
        return base_size
```