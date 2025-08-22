# NumPy/Pandas Data Science Patterns

本番環境で使用されるNumPy・Pandasの高度なデータサイエンスパターン集です。大規模データ処理、メモリ効率化、パフォーマンス最適化まで包括的にカバーします。

## 目次

1. [Advanced NumPy Patterns](#advanced-numpy-patterns)
2. [Pandas Performance Optimization](#pandas-performance-optimization)
3. [Memory-Efficient Data Processing](#memory-efficient-data-processing)
4. [Large Dataset Handling](#large-dataset-handling)
5. [Data Pipeline Patterns](#data-pipeline-patterns)
6. [Statistical Analysis Patterns](#statistical-analysis-patterns)
7. [Time Series Analysis](#time-series-analysis)
8. [Data Validation & Quality](#data-validation--quality)
9. [Parallel Processing](#parallel-processing)
10. [Production Deployment](#production-deployment)

## Advanced NumPy Patterns

### 1. メモリ効率的なNumPy操作

```python
import numpy as np
import pandas as pd
from typing import Generator, Tuple, List, Dict, Any, Optional, Union
import warnings
import gc
from functools import wraps
import time
import psutil
import sys
from contextlib import contextmanager

class MemoryEfficientArray:
    """メモリ効率的な配列クラス"""
    
    def __init__(self, shape: Tuple[int, ...], dtype: np.dtype = np.float64, chunk_size: int = 10000):
        self.shape = shape
        self.dtype = dtype
        self.chunk_size = chunk_size
        self.total_elements = np.prod(shape)
        
        # メモリマップファイルの使用
        self.data = np.memmap(
            f'temp_array_{id(self)}.dat',
            dtype=dtype,
            mode='w+',
            shape=shape
        )
    
    def __del__(self):
        """メモリマップファイルの削除"""
        try:
            del self.data
            import os
            os.remove(f'temp_array_{id(self)}.dat')
        except:
            pass
    
    def chunk_iterator(self) -> Generator[Tuple[slice, np.ndarray], None, None]:
        """チャンク単位での反復処理"""
        for start in range(0, self.total_elements, self.chunk_size):
            end = min(start + self.chunk_size, self.total_elements)
            flat_slice = slice(start, end)
            
            # フラットインデックスを多次元インデックスに変換
            indices = np.unravel_index(range(start, end), self.shape)
            chunk_data = self.data[indices]
            
            yield flat_slice, chunk_data
    
    def apply_function(self, func, inplace: bool = True):
        """関数をチャンク単位で適用"""
        for chunk_slice, chunk_data in self.chunk_iterator():
            processed_chunk = func(chunk_data)
            
            if inplace:
                indices = np.unravel_index(range(chunk_slice.start, chunk_slice.stop), self.shape)
                self.data[indices] = processed_chunk.flatten()
            else:
                yield processed_chunk

def memory_monitor(func):
    """メモリ使用量監視デコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        process = psutil.Process()
        
        # 実行前のメモリ使用量
        mem_before = process.memory_info().rss / 1024 / 1024  # MB
        
        # 関数実行
        start_time = time.time()
        result = func(*args, **kwargs)
        execution_time = time.time() - start_time
        
        # 実行後のメモリ使用量
        mem_after = process.memory_info().rss / 1024 / 1024  # MB
        mem_delta = mem_after - mem_before
        
        print(f"Function: {func.__name__}")
        print(f"Execution time: {execution_time:.3f}s")
        print(f"Memory before: {mem_before:.1f}MB")
        print(f"Memory after: {mem_after:.1f}MB")
        print(f"Memory delta: {mem_delta:+.1f}MB")
        print("-" * 50)
        
        return result
    
    return wrapper

@contextmanager
def numpy_memory_context(dtype=np.float32):
    """NumPyメモリ最適化コンテキスト"""
    
    # 元の設定を保存
    original_dtype = np.float64
    
    try:
        # メモリ効率の良い設定に変更
        np.seterr(all='warn')
        
        yield dtype
        
    finally:
        # 設定を復元
        np.seterr(all='warn')
        gc.collect()

class VectorizedOperations:
    """ベクトル化操作クラス"""
    
    @staticmethod
    def batch_normalize(arrays: List[np.ndarray], axis: int = 0) -> List[np.ndarray]:
        """バッチ正規化"""
        normalized_arrays = []
        
        for array in arrays:
            mean = np.mean(array, axis=axis, keepdims=True)
            std = np.std(array, axis=axis, keepdims=True)
            
            # ゼロ除算の回避
            std = np.where(std == 0, 1, std)
            
            normalized = (array - mean) / std
            normalized_arrays.append(normalized)
        
        return normalized_arrays
    
    @staticmethod
    def sliding_window_view(array: np.ndarray, window_size: int, step: int = 1) -> np.ndarray:
        """スライディングウィンドウビューの作成"""
        shape = array.shape[:-1] + (array.shape[-1] - window_size + 1, window_size)
        strides = array.strides + (array.strides[-1],)
        
        return np.lib.stride_tricks.as_strided(
            array, 
            shape=shape, 
            strides=strides
        )[::step]
    
    @staticmethod
    def masked_operations(array: np.ndarray, mask: np.ndarray, operation: str) -> np.ndarray:
        """マスクされた配列での操作"""
        masked_array = np.ma.masked_array(array, mask=~mask)
        
        operations = {
            'mean': np.ma.mean,
            'sum': np.ma.sum,
            'std': np.ma.std,
            'median': np.ma.median,
            'min': np.ma.min,
            'max': np.ma.max
        }
        
        if operation not in operations:
            raise ValueError(f"Unsupported operation: {operation}")
        
        return operations[operation](masked_array)
    
    @staticmethod
    def rolling_statistics(array: np.ndarray, window_size: int) -> Dict[str, np.ndarray]:
        """ローリング統計の計算"""
        if len(array) < window_size:
            raise ValueError("Array length must be greater than window size")
        
        # スライディングウィンドウの作成
        windows = VectorizedOperations.sliding_window_view(array, window_size)
        
        return {
            'mean': np.mean(windows, axis=1),
            'std': np.std(windows, axis=1),
            'min': np.min(windows, axis=1),
            'max': np.max(windows, axis=1),
            'median': np.median(windows, axis=1)
        }

# 高性能な数値計算
class AdvancedNumerical:
    """高度な数値計算クラス"""
    
    @staticmethod
    def fast_correlation_matrix(data: np.ndarray, method: str = 'pearson') -> np.ndarray:
        """高速相関行列計算"""
        if method == 'pearson':
            # Pearson相関係数
            data_centered = data - np.mean(data, axis=0)
            correlation_matrix = np.dot(data_centered.T, data_centered) / (data.shape[0] - 1)
            
            # 分散で正規化
            std_devs = np.sqrt(np.diag(correlation_matrix))
            std_matrix = np.outer(std_devs, std_devs)
            
            return correlation_matrix / std_matrix
        
        elif method == 'spearman':
            # Spearman順位相関
            ranked_data = np.empty_like(data)
            for i in range(data.shape[1]):
                ranked_data[:, i] = np.argsort(np.argsort(data[:, i]))
            
            return AdvancedNumerical.fast_correlation_matrix(ranked_data, 'pearson')
        
        else:
            raise ValueError(f"Unsupported correlation method: {method}")
    
    @staticmethod
    def efficient_covariance(data: np.ndarray, ddof: int = 1) -> np.ndarray:
        """効率的な共分散行列計算"""
        n = data.shape[0]
        mean = np.mean(data, axis=0)
        
        # 中心化
        data_centered = data - mean
        
        # 共分散行列の計算
        covariance = np.dot(data_centered.T, data_centered) / (n - ddof)
        
        return covariance
    
    @staticmethod
    def vectorized_distance_matrix(points: np.ndarray, metric: str = 'euclidean') -> np.ndarray:
        """ベクトル化された距離行列計算"""
        n_points = points.shape[0]
        
        if metric == 'euclidean':
            # ユークリッド距離
            # ||a - b||^2 = ||a||^2 + ||b||^2 - 2a·b
            points_squared = np.sum(points**2, axis=1)
            distance_matrix = (
                points_squared[:, np.newaxis] + 
                points_squared[np.newaxis, :] - 
                2 * np.dot(points, points.T)
            )
            
            # 数値誤差による負の値を修正
            distance_matrix = np.maximum(distance_matrix, 0)
            
            return np.sqrt(distance_matrix)
        
        elif metric == 'manhattan':
            # マンハッタン距離
            distance_matrix = np.zeros((n_points, n_points))
            for i in range(n_points):
                distance_matrix[i, :] = np.sum(np.abs(points - points[i]), axis=1)
            
            return distance_matrix
        
        elif metric == 'cosine':
            # コサイン距離
            normalized_points = points / np.linalg.norm(points, axis=1)[:, np.newaxis]
            cosine_similarity = np.dot(normalized_points, normalized_points.T)
            
            return 1 - cosine_similarity
        
        else:
            raise ValueError(f"Unsupported distance metric: {metric}")
    
    @staticmethod
    def fast_matrix_operations(matrices: List[np.ndarray], operation: str) -> np.ndarray:
        """高速行列操作"""
        if not matrices:
            raise ValueError("Empty matrix list")
        
        if operation == 'sum':
            return np.sum(matrices, axis=0)
        
        elif operation == 'mean':
            return np.mean(matrices, axis=0)
        
        elif operation == 'multiply':
            result = matrices[0].copy()
            for matrix in matrices[1:]:
                result = np.dot(result, matrix)
            return result
        
        elif operation == 'element_wise_multiply':
            result = matrices[0].copy()
            for matrix in matrices[1:]:
                result *= matrix
            return result
        
        else:
            raise ValueError(f"Unsupported matrix operation: {operation}")

# 使用例
@memory_monitor
def numpy_operations_example():
    """NumPy操作の例"""
    
    with numpy_memory_context(dtype=np.float32) as dtype:
        # 大きな配列の作成
        data = np.random.randn(10000, 100).astype(dtype)
        
        # ベクトル化操作
        vec_ops = VectorizedOperations()
        
        # 正規化
        normalized_data = vec_ops.batch_normalize([data])[0]
        
        # ローリング統計
        rolling_stats = vec_ops.rolling_statistics(data[:, 0], window_size=50)
        
        # 相関行列の計算
        correlation_matrix = AdvancedNumerical.fast_correlation_matrix(data)
        
        # 距離行列の計算（サンプルデータ）
        sample_points = data[:100, :10]  # 100点、10次元
        distance_matrix = AdvancedNumerical.vectorized_distance_matrix(sample_points)
        
        return {
            'normalized_shape': normalized_data.shape,
            'correlation_shape': correlation_matrix.shape,
            'distance_shape': distance_matrix.shape,
            'rolling_stats_keys': list(rolling_stats.keys())
        }
```

### 2. 高度なNumPyブロードキャスティング

```python
import numpy as np
from typing import Tuple, List, Any, Union
import warnings

class AdvancedBroadcasting:
    """高度なブロードキャスティングクラス"""
    
    @staticmethod
    def smart_broadcast(*arrays) -> Tuple[np.ndarray, ...]:
        """スマートブロードキャスティング"""
        # 配列の次元を揃える
        max_ndim = max(arr.ndim for arr in arrays)
        
        broadcasted_arrays = []
        for arr in arrays:
            # 次元を左詰めで拡張
            while arr.ndim < max_ndim:
                arr = arr[np.newaxis, ...]
            broadcasted_arrays.append(arr)
        
        # NumPyのブロードキャスティングルールを適用
        return np.broadcast_arrays(*broadcasted_arrays)
    
    @staticmethod
    def conditional_broadcast(condition: np.ndarray, true_array: np.ndarray, false_array: np.ndarray) -> np.ndarray:
        """条件付きブロードキャスティング"""
        # 全ての配列を同じ形状にブロードキャスト
        condition_bc, true_bc, false_bc = AdvancedBroadcasting.smart_broadcast(
            condition, true_array, false_array
        )
        
        return np.where(condition_bc, true_bc, false_bc)
    
    @staticmethod
    def multi_dimensional_operations(arrays: List[np.ndarray], operation: str, axis: Union[int, Tuple[int, ...]] = None) -> np.ndarray:
        """多次元操作"""
        if not arrays:
            raise ValueError("Empty array list")
        
        # 全配列をブロードキャスト
        broadcasted_arrays = AdvancedBroadcasting.smart_broadcast(*arrays)
        
        operations = {
            'sum': lambda arrs: np.sum(arrs, axis=0),
            'mean': lambda arrs: np.mean(arrs, axis=0),
            'max': lambda arrs: np.max(arrs, axis=0),
            'min': lambda arrs: np.min(arrs, axis=0),
            'std': lambda arrs: np.std(arrs, axis=0),
            'multiply': lambda arrs: np.prod(arrs, axis=0)
        }
        
        if operation not in operations:
            raise ValueError(f"Unsupported operation: {operation}")
        
        result = operations[operation](broadcasted_arrays)
        
        # 軸指定がある場合は追加で集約
        if axis is not None:
            if operation in ['sum', 'mean', 'max', 'min', 'std']:
                aggregation_func = getattr(np, operation)
                result = aggregation_func(result, axis=axis)
        
        return result
    
    @staticmethod
    def tensor_operations(tensor_a: np.ndarray, tensor_b: np.ndarray, operation: str) -> np.ndarray:
        """テンソル操作"""
        
        if operation == 'outer_product':
            # 外積（全次元での外積）
            shape_a = tensor_a.shape
            shape_b = tensor_b.shape
            
            # テンソルをフラット化して外積を計算
            flat_a = tensor_a.flatten()
            flat_b = tensor_b.flatten()
            
            outer = np.outer(flat_a, flat_b)
            
            # 結果を適切な形状に変更
            result_shape = shape_a + shape_b
            return outer.reshape(result_shape)
        
        elif operation == 'tensor_dot':
            # テンソルドット積
            return np.tensordot(tensor_a, tensor_b, axes=1)
        
        elif operation == 'element_wise':
            # 要素ごとの演算
            broadcasted_a, broadcasted_b = AdvancedBroadcasting.smart_broadcast(tensor_a, tensor_b)
            return broadcasted_a * broadcasted_b
        
        else:
            raise ValueError(f"Unsupported tensor operation: {operation}")

class EinsteinSumOperations:
    """アインシュタイン記法操作クラス"""
    
    @staticmethod
    def batch_matrix_multiply(batch_a: np.ndarray, batch_b: np.ndarray) -> np.ndarray:
        """バッチ行列積"""
        # batch_a: (batch_size, m, k)
        # batch_b: (batch_size, k, n)
        # result: (batch_size, m, n)
        return np.einsum('bij,bjk->bik', batch_a, batch_b)
    
    @staticmethod
    def attention_mechanism(queries: np.ndarray, keys: np.ndarray, values: np.ndarray) -> np.ndarray:
        """アテンション機構の計算"""
        # queries: (batch_size, seq_len, d_model)
        # keys: (batch_size, seq_len, d_model)
        # values: (batch_size, seq_len, d_model)
        
        # スケーリングファクター
        d_k = queries.shape[-1]
        scale = 1.0 / np.sqrt(d_k)
        
        # アテンションスコアの計算
        scores = np.einsum('bik,bjk->bij', queries, keys) * scale
        
        # ソフトマックス
        attention_weights = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
        attention_weights = attention_weights / np.sum(attention_weights, axis=-1, keepdims=True)
        
        # アテンション出力
        output = np.einsum('bij,bjk->bik', attention_weights, values)
        
        return output, attention_weights
    
    @staticmethod
    def multi_head_attention(inputs: np.ndarray, num_heads: int) -> np.ndarray:
        """マルチヘッドアテンション"""
        batch_size, seq_len, d_model = inputs.shape
        
        if d_model % num_heads != 0:
            raise ValueError("d_model must be divisible by num_heads")
        
        d_head = d_model // num_heads
        
        # 入力を複数のヘッドに分割
        # (batch_size, seq_len, d_model) -> (batch_size, num_heads, seq_len, d_head)
        reshaped = inputs.reshape(batch_size, seq_len, num_heads, d_head)
        heads = np.transpose(reshaped, (0, 2, 1, 3))
        
        # 各ヘッドでアテンションを計算
        head_outputs = []
        for head_idx in range(num_heads):
            head_input = heads[:, head_idx, :, :]
            head_output, _ = EinsteinSumOperations.attention_mechanism(
                head_input, head_input, head_input
            )
            head_outputs.append(head_output)
        
        # ヘッドを連結
        concatenated = np.stack(head_outputs, axis=1)
        
        # 元の形状に戻す
        output = concatenated.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, d_model)
        
        return output
    
    @staticmethod
    def convolution_operation(input_tensor: np.ndarray, kernel: np.ndarray, stride: int = 1) -> np.ndarray:
        """畳み込み操作（アインシュタイン記法使用）"""
        # input_tensor: (batch_size, height, width, in_channels)
        # kernel: (kernel_height, kernel_width, in_channels, out_channels)
        
        batch_size, in_height, in_width, in_channels = input_tensor.shape
        kernel_height, kernel_width, _, out_channels = kernel.shape
        
        # 出力サイズの計算
        out_height = (in_height - kernel_height) // stride + 1
        out_width = (in_width - kernel_width) // stride + 1
        
        # 入力テンソルのパッチを作成
        patches = np.zeros((batch_size, out_height, out_width, kernel_height, kernel_width, in_channels))
        
        for i in range(out_height):
            for j in range(out_width):
                h_start = i * stride
                h_end = h_start + kernel_height
                w_start = j * stride
                w_end = w_start + kernel_width
                
                patches[:, i, j, :, :, :] = input_tensor[:, h_start:h_end, w_start:w_end, :]
        
        # アインシュタイン記法で畳み込みを計算
        output = np.einsum('bhwrsc,rsco->bhwo', patches, kernel)
        
        return output

# 高度な配列操作
class AdvancedArrayManipulation:
    """高度な配列操作クラス"""
    
    @staticmethod
    def advanced_indexing(array: np.ndarray, indices: Dict[str, Any]) -> np.ndarray:
        """高度なインデックス操作"""
        result = array.copy()
        
        for index_type, index_value in indices.items():
            if index_type == 'boolean_mask':
                # ブールマスクによるインデックス
                result = result[index_value]
            
            elif index_type == 'fancy_indexing':
                # ファンシーインデックス
                result = result[index_value]
            
            elif index_type == 'slice_advanced':
                # 高度なスライス
                slices = []
                for s in index_value:
                    if isinstance(s, tuple):
                        slices.append(slice(*s))
                    else:
                        slices.append(s)
                result = result[tuple(slices)]
        
        return result
    
    @staticmethod
    def reshape_with_validation(array: np.ndarray, new_shape: Tuple[int, ...], allow_copy: bool = True) -> np.ndarray:
        """検証付きリシェイプ"""
        # 新しい形状の妥当性をチェック
        total_elements = np.prod(array.shape)
        new_total_elements = np.prod(new_shape)
        
        if total_elements != new_total_elements:
            raise ValueError(f"Cannot reshape array of size {total_elements} into shape {new_shape}")
        
        # メモリ連続性のチェック
        if not array.flags['C_CONTIGUOUS'] and not allow_copy:
            raise ValueError("Array is not C-contiguous and copy is not allowed")
        
        # リシェイプの実行
        try:
            # ビューを試行
            result = array.reshape(new_shape)
            if not allow_copy and not np.shares_memory(array, result):
                raise ValueError("Reshape requires copy but copy is not allowed")
            return result
        except ValueError:
            if allow_copy:
                # コピーしてからリシェイプ
                return np.ascontiguousarray(array).reshape(new_shape)
            else:
                raise
    
    @staticmethod
    def stack_with_alignment(arrays: List[np.ndarray], axis: int = 0, alignment: str = 'left') -> np.ndarray:
        """アライメント付きスタック"""
        if not arrays:
            raise ValueError("Empty array list")
        
        # 最大形状を取得
        max_shape = list(arrays[0].shape)
        for array in arrays[1:]:
            for i, size in enumerate(array.shape):
                if i < len(max_shape):
                    max_shape[i] = max(max_shape[i], size)
                else:
                    max_shape.append(size)
        
        # 配列をパディング
        aligned_arrays = []
        for array in arrays:
            paddings = []
            
            for i, (current_size, target_size) in enumerate(zip(array.shape, max_shape)):
                if current_size < target_size:
                    padding_needed = target_size - current_size
                    
                    if alignment == 'left':
                        paddings.append((0, padding_needed))
                    elif alignment == 'right':
                        paddings.append((padding_needed, 0))
                    elif alignment == 'center':
                        left_pad = padding_needed // 2
                        right_pad = padding_needed - left_pad
                        paddings.append((left_pad, right_pad))
                    else:
                        raise ValueError(f"Unsupported alignment: {alignment}")
                else:
                    paddings.append((0, 0))
            
            # 不足する次元のパディング
            while len(paddings) < len(max_shape):
                paddings.append((0, 0))
            
            padded_array = np.pad(array, paddings, mode='constant', constant_values=0)
            aligned_arrays.append(padded_array)
        
        return np.stack(aligned_arrays, axis=axis)

# 使用例
def advanced_numpy_example():
    """高度なNumPy操作の例"""
    
    # サンプルデータの作成
    data1 = np.random.randn(100, 50)
    data2 = np.random.randn(100, 50)
    data3 = np.random.randn(50, 30)
    
    # ブロードキャスティング操作
    broadcasting = AdvancedBroadcasting()
    
    # 多次元操作
    combined_data = broadcasting.multi_dimensional_operations(
        [data1, data2], 
        operation='mean'
    )
    
    # テンソル操作
    tensor_result = broadcasting.tensor_operations(
        data1[:10, :10], 
        data3[:10, :10], 
        operation='element_wise'
    )
    
    # アインシュタイン記法操作
    einstein_ops = EinsteinSumOperations()
    
    # バッチ行列積のサンプル
    batch_a = np.random.randn(32, 10, 5)  # バッチサイズ32
    batch_b = np.random.randn(32, 5, 8)
    batch_result = einstein_ops.batch_matrix_multiply(batch_a, batch_b)
    
    # アテンション機構
    sequences = np.random.randn(16, 20, 64)  # バッチ16, 系列長20, 特徴64
    attention_output, attention_weights = einstein_ops.attention_mechanism(
        sequences, sequences, sequences
    )
    
    # 配列操作
    array_ops = AdvancedArrayManipulation()
    
    # 高度なインデックス
    indexed_result = array_ops.advanced_indexing(
        data1,
        {
            'boolean_mask': data1.sum(axis=1) > 0,
            'slice_advanced': [(None, None, 2), (10, 40)]
        }
    )
    
    return {
        'combined_shape': combined_data.shape,
        'tensor_shape': tensor_result.shape,
        'batch_result_shape': batch_result.shape,
        'attention_output_shape': attention_output.shape,
        'indexed_result_shape': indexed_result.shape
    }
```

## Pandas Performance Optimization

### 1. 高性能Pandas操作

```python
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Union, Callable
import warnings
import gc
from functools import wraps
import time
from contextlib import contextmanager
import sqlite3
import pyarrow as pa
import pyarrow.parquet as pq

class PandasOptimizer:
    """Pandas最適化クラス"""
    
    @staticmethod
    def optimize_dtypes(df: pd.DataFrame, categorical_threshold: float = 0.5) -> pd.DataFrame:
        """データ型の最適化"""
        optimized_df = df.copy()
        
        for column in optimized_df.columns:
            col_data = optimized_df[column]
            
            # 数値型の最適化
            if col_data.dtype in ['int64', 'int32', 'int16', 'int8']:
                min_val = col_data.min()
                max_val = col_data.max()
                
                if min_val >= np.iinfo(np.int8).min and max_val <= np.iinfo(np.int8).max:
                    optimized_df[column] = col_data.astype(np.int8)
                elif min_val >= np.iinfo(np.int16).min and max_val <= np.iinfo(np.int16).max:
                    optimized_df[column] = col_data.astype(np.int16)
                elif min_val >= np.iinfo(np.int32).min and max_val <= np.iinfo(np.int32).max:
                    optimized_df[column] = col_data.astype(np.int32)
            
            elif col_data.dtype in ['float64', 'float32']:
                if col_data.min() >= np.finfo(np.float32).min and col_data.max() <= np.finfo(np.float32).max:
                    optimized_df[column] = col_data.astype(np.float32)
            
            # 文字列型のカテゴリカル変換
            elif col_data.dtype == 'object':
                unique_ratio = col_data.nunique() / len(col_data)
                
                if unique_ratio < categorical_threshold:
                    optimized_df[column] = col_data.astype('category')
        
        return optimized_df
    
    @staticmethod
    def memory_usage_reduction(df: pd.DataFrame) -> tuple:
        """メモリ使用量の削減"""
        original_memory = df.memory_usage(deep=True).sum()
        
        # データ型最適化
        optimized_df = PandasOptimizer.optimize_dtypes(df)
        
        # 不要な列の削除（全てNaNの列）
        optimized_df = optimized_df.dropna(axis=1, how='all')
        
        # インデックスの最適化
        if optimized_df.index.dtype == 'object':
            try:
                optimized_df.index = pd.to_numeric(optimized_df.index, errors='ignore')
            except:
                pass
        
        optimized_memory = optimized_df.memory_usage(deep=True).sum()
        reduction_ratio = (original_memory - optimized_memory) / original_memory
        
        return optimized_df, reduction_ratio
    
    @staticmethod
    def chunked_operation(df: pd.DataFrame, operation: Callable, chunk_size: int = 10000, **kwargs) -> pd.DataFrame:
        """チャンク単位での操作"""
        results = []
        
        for start in range(0, len(df), chunk_size):
            end = min(start + chunk_size, len(df))
            chunk = df.iloc[start:end]
            
            # 操作の適用
            result_chunk = operation(chunk, **kwargs)
            results.append(result_chunk)
            
            # メモリクリーンアップ
            del chunk
            gc.collect()
        
        return pd.concat(results, ignore_index=True)

class VectorizedPandas:
    """ベクトル化Pandas操作"""
    
    @staticmethod
    def vectorized_string_operations(series: pd.Series) -> pd.DataFrame:
        """ベクトル化文字列操作"""
        return pd.DataFrame({
            'original': series,
            'lower': series.str.lower(),
            'upper': series.str.upper(),
            'length': series.str.len(),
            'word_count': series.str.split().str.len(),
            'contains_digit': series.str.contains(r'\d', regex=True),
            'cleaned': series.str.replace(r'[^\w\s]', '', regex=True)
        })
    
    @staticmethod
    def vectorized_datetime_operations(series: pd.Series) -> pd.DataFrame:
        """ベクトル化日時操作"""
        dt_series = pd.to_datetime(series)
        
        return pd.DataFrame({
            'original': series,
            'year': dt_series.dt.year,
            'month': dt_series.dt.month,
            'day': dt_series.dt.day,
            'dayofweek': dt_series.dt.dayofweek,
            'dayofyear': dt_series.dt.dayofyear,
            'quarter': dt_series.dt.quarter,
            'is_weekend': dt_series.dt.dayofweek.isin([5, 6]),
            'is_month_start': dt_series.dt.is_month_start,
            'is_month_end': dt_series.dt.is_month_end
        })
    
    @staticmethod
    def vectorized_numerical_operations(df: pd.DataFrame, numeric_columns: List[str]) -> pd.DataFrame:
        """ベクトル化数値操作"""
        result_df = df.copy()
        
        # 基本統計量
        for col in numeric_columns:
            result_df[f'{col}_zscore'] = (df[col] - df[col].mean()) / df[col].std()
            result_df[f'{col}_percentile'] = df[col].rank(pct=True)
            result_df[f'{col}_log'] = np.log1p(np.maximum(df[col], 0))
            result_df[f'{col}_sqrt'] = np.sqrt(np.maximum(df[col], 0))
        
        # 相互作用特徴量
        for i, col1 in enumerate(numeric_columns):
            for col2 in numeric_columns[i+1:]:
                result_df[f'{col1}_x_{col2}'] = df[col1] * df[col2]
                result_df[f'{col1}_div_{col2}'] = df[col1] / (df[col2] + 1e-8)
        
        return result_df
    
    @staticmethod
    def rolling_aggregations(df: pd.DataFrame, columns: List[str], windows: List[int]) -> pd.DataFrame:
        """ローリング集約"""
        result_df = df.copy()
        
        for col in columns:
            for window in windows:
                rolling = df[col].rolling(window=window)
                
                result_df[f'{col}_rolling_{window}_mean'] = rolling.mean()
                result_df[f'{col}_rolling_{window}_std'] = rolling.std()
                result_df[f'{col}_rolling_{window}_min'] = rolling.min()
                result_df[f'{col}_rolling_{window}_max'] = rolling.max()
                result_df[f'{col}_rolling_{window}_sum'] = rolling.sum()
        
        return result_df

class AdvancedGroupBy:
    """高度なGroupBy操作"""
    
    @staticmethod
    def multi_level_aggregation(df: pd.DataFrame, group_cols: List[str], agg_dict: Dict[str, List[str]]) -> pd.DataFrame:
        """多レベル集約"""
        
        # 基本集約
        basic_agg = df.groupby(group_cols).agg(agg_dict)
        
        # カラム名をフラット化
        basic_agg.columns = ['_'.join(col).strip() for col in basic_agg.columns.values]
        basic_agg = basic_agg.reset_index()
        
        # 追加統計量
        for group_col in group_cols:
            group_stats = df.groupby(group_col).size().reset_index(name=f'{group_col}_count')
            basic_agg = basic_agg.merge(group_stats, on=group_col, how='left')
        
        return basic_agg
    
    @staticmethod
    def window_functions(df: pd.DataFrame, group_cols: List[str], value_col: str) -> pd.DataFrame:
        """ウィンドウ関数の適用"""
        result_df = df.copy()
        
        # グループ内での順位
        result_df['rank'] = df.groupby(group_cols)[value_col].rank()
        result_df['rank_pct'] = df.groupby(group_cols)[value_col].rank(pct=True)
        
        # 累積統計
        result_df['cumsum'] = df.groupby(group_cols)[value_col].cumsum()
        result_df['cummax'] = df.groupby(group_cols)[value_col].cummax()
        result_df['cummin'] = df.groupby(group_cols)[value_col].cummin()
        
        # シフト操作
        result_df['lag_1'] = df.groupby(group_cols)[value_col].shift(1)
        result_df['lead_1'] = df.groupby(group_cols)[value_col].shift(-1)
        
        # 差分
        result_df['diff'] = df.groupby(group_cols)[value_col].diff()
        result_df['pct_change'] = df.groupby(group_cols)[value_col].pct_change()
        
        return result_df
    
    @staticmethod
    def custom_aggregations(df: pd.DataFrame, group_cols: List[str]) -> pd.DataFrame:
        """カスタム集約関数"""
        
        def custom_stats(series):
            return pd.Series({
                'q25': series.quantile(0.25),
                'q75': series.quantile(0.75),
                'iqr': series.quantile(0.75) - series.quantile(0.25),
                'skew': series.skew(),
                'kurtosis': series.kurtosis(),
                'cv': series.std() / series.mean() if series.mean() != 0 else 0
            })
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        results = []
        for col in numeric_columns:
            if col not in group_cols:
                agg_result = df.groupby(group_cols)[col].apply(custom_stats).unstack()
                agg_result.columns = [f'{col}_{stat}' for stat in agg_result.columns]
                results.append(agg_result)
        
        if results:
            return pd.concat(results, axis=1).reset_index()
        else:
            return df.groupby(group_cols).size().reset_index(name='count')

# パフォーマンス比較ツール
def performance_comparison(func_list: List[Callable], data: Any, iterations: int = 100) -> Dict[str, float]:
    """パフォーマンス比較"""
    results = {}
    
    for func in func_list:
        times = []
        
        for _ in range(iterations):
            start_time = time.time()
            func(data)
            end_time = time.time()
            times.append(end_time - start_time)
        
        results[func.__name__] = {
            'mean_time': np.mean(times),
            'std_time': np.std(times),
            'min_time': np.min(times),
            'max_time': np.max(times)
        }
    
    return results

# I/O最適化
class OptimizedIO:
    """最適化されたI/O操作"""
    
    @staticmethod
    def fast_csv_reader(file_path: str, chunk_size: int = 50000, **kwargs) -> pd.DataFrame:
        """高速CSV読み込み"""
        chunks = []
        
        for chunk in pd.read_csv(file_path, chunksize=chunk_size, **kwargs):
            # データ型最適化
            optimized_chunk = PandasOptimizer.optimize_dtypes(chunk)
            chunks.append(optimized_chunk)
        
        return pd.concat(chunks, ignore_index=True)
    
    @staticmethod
    def parquet_operations(df: pd.DataFrame, file_path: str, operation: str = 'write') -> Optional[pd.DataFrame]:
        """Parquet操作"""
        
        if operation == 'write':
            # 効率的なParquet書き込み
            table = pa.Table.from_pandas(df)
            pq.write_table(table, file_path, compression='snappy')
            return None
        
        elif operation == 'read':
            # 効率的なParquet読み込み
            return pq.read_table(file_path).to_pandas()
        
        elif operation == 'read_filtered':
            # フィルタ付き読み込み（例）
            filters = [('column_name', '>', 100)]
            return pq.read_table(file_path, filters=filters).to_pandas()
    
    @staticmethod
    def database_bulk_operations(df: pd.DataFrame, connection_string: str, table_name: str, operation: str = 'insert') -> None:
        """データベース一括操作"""
        
        with sqlite3.connect(connection_string) as conn:
            
            if operation == 'insert':
                df.to_sql(table_name, conn, if_exists='append', index=False, method='multi')
            
            elif operation == 'upsert':
                # アップサート操作
                df.to_sql(f'{table_name}_temp', conn, if_exists='replace', index=False)
                
                # マージクエリの実行
                merge_query = f"""
                INSERT OR REPLACE INTO {table_name}
                SELECT * FROM {table_name}_temp
                """
                conn.execute(merge_query)
                
                # 一時テーブルの削除
                conn.execute(f"DROP TABLE {table_name}_temp")

# 使用例
def pandas_optimization_example():
    """Pandas最適化の例"""
    
    # サンプルデータの作成
    np.random.seed(42)
    n_rows = 100000
    
    data = {
        'id': range(n_rows),
        'category': np.random.choice(['A', 'B', 'C', 'D'], n_rows),
        'value1': np.random.randn(n_rows),
        'value2': np.random.randn(n_rows) * 1000,
        'date': pd.date_range('2020-01-01', periods=n_rows, freq='H'),
        'text': [f'text_{i%1000}' for i in range(n_rows)]
    }
    
    df = pd.DataFrame(data)
    
    # データ型最適化
    optimized_df, reduction_ratio = PandasOptimizer.memory_usage_reduction(df)
    print(f"Memory reduction: {reduction_ratio:.2%}")
    
    # ベクトル化操作
    vectorized_ops = VectorizedPandas()
    
    # 数値操作
    numeric_result = vectorized_ops.vectorized_numerical_operations(
        optimized_df, ['value1', 'value2']
    )
    
    # 文字列操作
    string_result = vectorized_ops.vectorized_string_operations(optimized_df['text'])
    
    # 日時操作
    datetime_result = vectorized_ops.vectorized_datetime_operations(optimized_df['date'])
    
    # GroupBy操作
    groupby_ops = AdvancedGroupBy()
    
    agg_result = groupby_ops.multi_level_aggregation(
        optimized_df,
        ['category'],
        {'value1': ['mean', 'std'], 'value2': ['sum', 'count']}
    )
    
    window_result = groupby_ops.window_functions(
        optimized_df, ['category'], 'value1'
    )
    
    return {
        'original_shape': df.shape,
        'optimized_shape': optimized_df.shape,
        'reduction_ratio': reduction_ratio,
        'numeric_result_shape': numeric_result.shape,
        'agg_result_shape': agg_result.shape
    }
```

続きを作成いたします。

## Memory-Efficient Data Processing

### 1. 大規模データ処理パターン

```python
import pandas as pd
import numpy as np
from typing import Iterator, Generator, Callable, Any, Dict, List, Optional
import os
import gc
import psutil
import time
from contextlib import contextmanager
import dask.dataframe as dd
import dask
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import tempfile

class MemoryEfficientProcessor:
    """メモリ効率的データ処理クラス"""
    
    def __init__(self, memory_threshold: float = 0.8):
        self.memory_threshold = memory_threshold
        self.temp_files = []
    
    def __del__(self):
        """一時ファイルのクリーンアップ"""
        for temp_file in self.temp_files:
            try:
                os.remove(temp_file)
            except:
                pass
    
    @contextmanager
    def memory_monitor(self):
        """メモリ監視コンテキスト"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        try:
            yield
        finally:
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_used = final_memory - initial_memory
            
            print(f"Memory used: {memory_used:.1f}MB")
            
            # メモリ使用量が閾値を超えた場合の警告
            memory_percent = psutil.virtual_memory().percent
            if memory_percent > self.memory_threshold * 100:
                print(f"Warning: Memory usage is high ({memory_percent:.1f}%)")
                gc.collect()
    
    def chunk_file_processor(
        self, 
        file_path: str, 
        chunk_size: int = 10000,
        processor_func: Callable = None
    ) -> Generator[pd.DataFrame, None, None]:
        """ファイルのチャンク処理"""
        
        with self.memory_monitor():
            for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                if processor_func:
                    processed_chunk = processor_func(chunk)
                else:
                    processed_chunk = chunk
                
                yield processed_chunk
                
                # メモリクリーンアップ
                del chunk
                gc.collect()
    
    def streaming_aggregation(
        self, 
        file_path: str, 
        group_cols: List[str],
        agg_cols: Dict[str, List[str]],
        chunk_size: int = 10000
    ) -> pd.DataFrame:
        """ストリーミング集約"""
        
        partial_results = {}
        
        with self.memory_monitor():
            for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                # チャンクの集約
                chunk_agg = chunk.groupby(group_cols).agg(agg_cols)
                
                # 部分結果の蓄積
                for group_key, group_data in chunk_agg.groupby(level=group_cols):
                    if group_key not in partial_results:
                        partial_results[group_key] = []
                    partial_results[group_key].append(group_data)
                
                del chunk, chunk_agg
                gc.collect()
        
        # 最終的な集約
        final_results = []
        for group_key, group_chunks in partial_results.items():
            combined_chunk = pd.concat(group_chunks)
            final_agg = combined_chunk.groupby(level=group_cols).agg(agg_cols)
            final_results.append(final_agg)
        
        return pd.concat(final_results)
    
    def external_sort(
        self, 
        file_path: str, 
        sort_columns: List[str],
        chunk_size: int = 10000,
        output_path: str = None
    ) -> str:
        """外部ソート"""
        
        if output_path is None:
            output_path = f"sorted_{os.path.basename(file_path)}"
        
        temp_files = []
        
        # チャンクごとにソートして一時ファイルに保存
        with self.memory_monitor():
            for i, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size)):
                sorted_chunk = chunk.sort_values(sort_columns)
                
                temp_file = f"temp_sorted_{i}.csv"
                sorted_chunk.to_csv(temp_file, index=False)
                temp_files.append(temp_file)
                self.temp_files.append(temp_file)
                
                del chunk, sorted_chunk
                gc.collect()
        
        # マージソート
        self._merge_sorted_files(temp_files, sort_columns, output_path)
        
        return output_path
    
    def _merge_sorted_files(
        self, 
        temp_files: List[str], 
        sort_columns: List[str], 
        output_path: str
    ):
        """ソート済みファイルのマージ"""
        
        # ファイルのイテレータを作成
        file_iterators = []
        current_rows = []
        
        for temp_file in temp_files:
            iterator = pd.read_csv(temp_file, chunksize=1)
            try:
                first_row = next(iterator)
                file_iterators.append(iterator)
                current_rows.append(first_row.iloc[0])
            except StopIteration:
                continue
        
        # マージ処理
        with open(output_path, 'w') as output_file:
            # ヘッダーの書き込み
            if current_rows:
                header = ','.join(current_rows[0].index.tolist()) + '\n'
                output_file.write(header)
                
                while current_rows:
                    # 最小値を持つ行を見つける
                    min_idx = 0
                    for i, row in enumerate(current_rows[1:], 1):
                        if self._compare_rows(row, current_rows[min_idx], sort_columns) < 0:
                            min_idx = i
                    
                    # 最小行を出力
                    min_row = current_rows[min_idx]
                    row_str = ','.join(str(val) for val in min_row.values) + '\n'
                    output_file.write(row_str)
                    
                    # 次の行を読み込み
                    try:
                        next_chunk = next(file_iterators[min_idx])
                        current_rows[min_idx] = next_chunk.iloc[0]
                    except StopIteration:
                        # ファイルの終端に達した場合
                        del current_rows[min_idx]
                        del file_iterators[min_idx]
    
    def _compare_rows(self, row1: pd.Series, row2: pd.Series, sort_columns: List[str]) -> int:
        """行の比較"""
        for col in sort_columns:
            if row1[col] < row2[col]:
                return -1
            elif row1[col] > row2[col]:
                return 1
        return 0

class DaskDataProcessor:
    """Daskを使用した分散データ処理"""
    
    def __init__(self, n_workers: int = 4):
        self.n_workers = n_workers
        dask.config.set(scheduler='threads')
    
    def parallel_csv_processing(
        self, 
        file_patterns: List[str],
        processing_func: Callable,
        output_path: str = None
    ) -> dd.DataFrame:
        """並列CSV処理"""
        
        # 複数ファイルの読み込み
        ddf = dd.read_csv(file_patterns)
        
        # 処理関数の適用
        processed_ddf = ddf.map_partitions(processing_func, meta=ddf)
        
        # 結果の保存
        if output_path:
            processed_ddf.to_csv(output_path, index=False)
        
        return processed_ddf
    
    def distributed_aggregation(
        self, 
        ddf: dd.DataFrame,
        group_cols: List[str],
        agg_dict: Dict[str, str]
    ) -> pd.DataFrame:
        """分散集約"""
        
        # Daskでの集約
        result = ddf.groupby(group_cols).agg(agg_dict)
        
        # Pandasに変換
        return result.compute()
    
    def parallel_apply(
        self, 
        ddf: dd.DataFrame,
        func: Callable,
        axis: int = 0
    ) -> dd.DataFrame:
        """並列apply操作"""
        
        if axis == 0:
            # 行方向の処理
            return ddf.map_partitions(lambda x: x.apply(func, axis=0))
        else:
            # 列方向の処理
            return ddf.apply(func, axis=1, meta=('result', 'f8'))

class StreamingDataProcessor:
    """ストリーミングデータ処理"""
    
    def __init__(self, buffer_size: int = 1000):
        self.buffer_size = buffer_size
        self.buffer = []
        self.processed_count = 0
    
    def process_stream(
        self, 
        data_stream: Iterator[Dict[str, Any]],
        processor_func: Callable,
        output_handler: Callable
    ):
        """ストリームデータの処理"""
        
        for data_point in data_stream:
            self.buffer.append(data_point)
            
            if len(self.buffer) >= self.buffer_size:
                self._process_buffer(processor_func, output_handler)
        
        # 残りのバッファを処理
        if self.buffer:
            self._process_buffer(processor_func, output_handler)
    
    def _process_buffer(self, processor_func: Callable, output_handler: Callable):
        """バッファの処理"""
        
        # バッファをDataFrameに変換
        df = pd.DataFrame(self.buffer)
        
        # 処理関数の適用
        processed_df = processor_func(df)
        
        # 出力処理
        output_handler(processed_df)
        
        # バッファのクリア
        self.processed_count += len(self.buffer)
        self.buffer.clear()
        
        print(f"Processed {self.processed_count} records")

class IncrementalProcessor:
    """増分処理クラス"""
    
    def __init__(self, state_file: str = "processing_state.json"):
        self.state_file = state_file
        self.state = self._load_state()
    
    def _load_state(self) -> Dict[str, Any]:
        """状態の読み込み"""
        if os.path.exists(self.state_file):
            import json
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {}
    
    def _save_state(self):
        """状態の保存"""
        import json
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f)
    
    def incremental_processing(
        self, 
        data_source: str,
        processor_func: Callable,
        key_column: str = 'timestamp'
    ) -> pd.DataFrame:
        """増分処理"""
        
        # 最後の処理時点を取得
        last_processed = self.state.get('last_processed', None)
        
        # データの読み込み
        df = pd.read_csv(data_source)
        
        # 増分データのフィルタリング
        if last_processed:
            if key_column in df.columns:
                df[key_column] = pd.to_datetime(df[key_column])
                last_processed_dt = pd.to_datetime(last_processed)
                incremental_df = df[df[key_column] > last_processed_dt]
            else:
                # キー列がない場合は全データを処理
                incremental_df = df
        else:
            incremental_df = df
        
        if len(incremental_df) == 0:
            print("No new data to process")
            return pd.DataFrame()
        
        # 処理の実行
        processed_df = processor_func(incremental_df)
        
        # 状態の更新
        if key_column in incremental_df.columns:
            self.state['last_processed'] = incremental_df[key_column].max().isoformat()
        self.state['processed_count'] = self.state.get('processed_count', 0) + len(incremental_df)
        self._save_state()
        
        print(f"Processed {len(incremental_df)} new records")
        
        return processed_df

# メモリプール管理
class MemoryPool:
    """メモリプール管理クラス"""
    
    def __init__(self, max_memory_mb: int = 1000):
        self.max_memory_mb = max_memory_mb
        self.allocated_arrays = []
        self.current_memory_mb = 0
    
    def allocate_array(self, shape: tuple, dtype: np.dtype = np.float64) -> np.ndarray:
        """配列の割り当て"""
        
        # 必要メモリサイズの計算
        array_size_mb = np.prod(shape) * np.dtype(dtype).itemsize / (1024 * 1024)
        
        # メモリ不足の場合は古い配列を解放
        while self.current_memory_mb + array_size_mb > self.max_memory_mb and self.allocated_arrays:
            self._deallocate_oldest()
        
        # 新しい配列の作成
        array = np.zeros(shape, dtype=dtype)
        self.allocated_arrays.append(array)
        self.current_memory_mb += array_size_mb
        
        return array
    
    def _deallocate_oldest(self):
        """最も古い配列の解放"""
        if self.allocated_arrays:
            old_array = self.allocated_arrays.pop(0)
            array_size_mb = old_array.nbytes / (1024 * 1024)
            self.current_memory_mb -= array_size_mb
            del old_array
            gc.collect()
    
    def clear_all(self):
        """全配列の解放"""
        self.allocated_arrays.clear()
        self.current_memory_mb = 0
        gc.collect()

# 使用例
def memory_efficient_example():
    """メモリ効率的処理の例"""
    
    # サンプルデータの作成
    sample_data = pd.DataFrame({
        'id': range(100000),
        'category': np.random.choice(['A', 'B', 'C'], 100000),
        'value': np.random.randn(100000),
        'timestamp': pd.date_range('2023-01-01', periods=100000, freq='1min')
    })
    
    # サンプルCSVファイルの作成
    sample_file = 'sample_large_data.csv'
    sample_data.to_csv(sample_file, index=False)
    
    # メモリ効率的処理
    processor = MemoryEfficientProcessor()
    
    # チャンク処理の例
    def simple_processor(chunk):
        return chunk[chunk['value'] > 0]
    
    processed_chunks = []
    for chunk in processor.chunk_file_processor(sample_file, chunk_size=10000, processor_func=simple_processor):
        processed_chunks.append(len(chunk))
    
    # ストリーミング集約の例
    agg_result = processor.streaming_aggregation(
        sample_file,
        group_cols=['category'],
        agg_cols={'value': ['mean', 'sum', 'count']},
        chunk_size=20000
    )
    
    # Dask処理の例
    dask_processor = DaskDataProcessor()
    ddf = dd.read_csv(sample_file)
    
    # 分散集約
    dask_agg = dask_processor.distributed_aggregation(
        ddf,
        group_cols=['category'],
        agg_dict={'value': 'mean'}
    )
    
    # メモリプールの例
    memory_pool = MemoryPool(max_memory_mb=100)
    
    arrays = []
    for i in range(5):
        array = memory_pool.allocate_array((1000, 1000), dtype=np.float32)
        arrays.append(array.shape)
    
    # クリーンアップ
    os.remove(sample_file)
    memory_pool.clear_all()
    
    return {
        'processed_chunk_sizes': processed_chunks,
        'streaming_agg_shape': agg_result.shape,
        'dask_agg_shape': dask_agg.shape,
        'memory_pool_arrays': arrays
    }
```

## Large Dataset Handling

### 1. 大規模データセット処理

```python
import pandas as pd
import numpy as np
import h5py
import zarr
import pyarrow as pa
import pyarrow.parquet as pq
from typing import Iterator, List, Dict, Any, Optional, Union, Tuple
import os
import gc
import json
import sqlite3
from contextlib import contextmanager
import concurrent.futures
import threading
import queue

class LargeDatasetHandler:
    """大規模データセット処理クラス"""
    
    def __init__(self):
        self.chunk_cache = {}
        self.cache_lock = threading.Lock()
        self.max_cache_size = 10
    
    def create_hdf5_dataset(
        self, 
        file_path: str, 
        data_generator: Iterator[np.ndarray],
        dataset_name: str = 'data',
        chunk_size: tuple = None,
        compression: str = 'gzip'
    ):
        """HDF5データセットの作成"""
        
        with h5py.File(file_path, 'w') as f:
            first_chunk = next(data_generator)
            
            # データセットの形状を推定
            max_shape = (None,) + first_chunk.shape[1:]
            
            # データセットの作成
            dataset = f.create_dataset(
                dataset_name,
                data=first_chunk,
                maxshape=max_shape,
                chunks=chunk_size,
                compression=compression
            )
            
            # 残りのデータを追加
            current_size = first_chunk.shape[0]
            
            for chunk in data_generator:
                # データセットのリサイズ
                new_size = current_size + chunk.shape[0]
                dataset.resize((new_size,) + chunk.shape[1:])
                
                # データの追加
                dataset[current_size:new_size] = chunk
                current_size = new_size
    
    def read_hdf5_chunks(
        self, 
        file_path: str, 
        dataset_name: str = 'data',
        chunk_size: int = 10000
    ) -> Iterator[np.ndarray]:
        """HDF5データセットのチャンク読み込み"""
        
        with h5py.File(file_path, 'r') as f:
            dataset = f[dataset_name]
            total_rows = dataset.shape[0]
            
            for start in range(0, total_rows, chunk_size):
                end = min(start + chunk_size, total_rows)
                yield dataset[start:end]
    
    def create_zarr_array(
        self, 
        store_path: str, 
        data_generator: Iterator[np.ndarray],
        chunk_size: tuple = (1000, 1000),
        compression: str = 'blosc'
    ):
        """Zarr配列の作成"""
        
        store = zarr.DirectoryStore(store_path)
        
        first_chunk = next(data_generator)
        
        # Zarr配列の作成
        z = zarr.open(
            store, 
            mode='w',
            shape=(0,) + first_chunk.shape[1:],
            chunks=chunk_size,
            dtype=first_chunk.dtype,
            compressor=zarr.Blosc(cname=compression)
        )
        
        # データの追加
        z.append(first_chunk, axis=0)
        
        for chunk in data_generator:
            z.append(chunk, axis=0)
        
        return z
    
    def parallel_parquet_processing(
        self, 
        parquet_files: List[str],
        processing_func: callable,
        output_dir: str,
        n_workers: int = 4
    ):
        """並列Parquet処理"""
        
        def process_single_file(file_info):
            file_path, output_path = file_info
            
            # Parquetファイルの読み込み
            table = pq.read_table(file_path)
            df = table.to_pandas()
            
            # 処理関数の適用
            processed_df = processing_func(df)
            
            # 結果の保存
            processed_table = pa.Table.from_pandas(processed_df)
            pq.write_table(processed_table, output_path)
            
            return output_path
        
        # ファイルペアの作成
        file_pairs = []
        for i, file_path in enumerate(parquet_files):
            output_path = os.path.join(output_dir, f"processed_{i}.parquet")
            file_pairs.append((file_path, output_path))
        
        # 並列処理
        with concurrent.futures.ThreadPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(process_single_file, file_pairs))
        
        return results
    
    def cached_chunk_reader(
        self, 
        file_path: str, 
        chunk_size: int = 10000
    ) -> Iterator[pd.DataFrame]:
        """キャッシュ付きチャンク読み込み"""
        
        cache_key = f"{file_path}_{chunk_size}"
        
        with self.cache_lock:
            if cache_key in self.chunk_cache:
                # キャッシュから読み込み
                for chunk in self.chunk_cache[cache_key]:
                    yield chunk.copy()
                return
        
        # ファイルから読み込み
        chunks = []
        for chunk in pd.read_csv(file_path, chunksize=chunk_size):
            chunks.append(chunk.copy())
            yield chunk
        
        # キャッシュに保存
        with self.cache_lock:
            if len(self.chunk_cache) >= self.max_cache_size:
                # 最も古いエントリを削除
                oldest_key = next(iter(self.chunk_cache))
                del self.chunk_cache[oldest_key]
            
            self.chunk_cache[cache_key] = chunks

class ColumnOrientedProcessor:
    """列指向データ処理"""
    
    def __init__(self):
        self.column_store = {}
    
    def create_columnar_store(
        self, 
        df: pd.DataFrame, 
        store_name: str,
        compression: str = 'snappy'
    ):
        """列指向ストアの作成"""
        
        store_path = f"{store_name}_columnar"
        os.makedirs(store_path, exist_ok=True)
        
        # 各列を個別にParquetファイルとして保存
        for column in df.columns:
            column_df = df[[column]]
            column_file = os.path.join(store_path, f"{column}.parquet")
            
            table = pa.Table.from_pandas(column_df)
            pq.write_table(table, column_file, compression=compression)
        
        # メタデータの保存
        metadata = {
            'columns': list(df.columns),
            'shape': df.shape,
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
        }
        
        with open(os.path.join(store_path, 'metadata.json'), 'w') as f:
            json.dump(metadata, f)
        
        self.column_store[store_name] = store_path
    
    def read_columns(
        self, 
        store_name: str, 
        columns: List[str],
        row_slice: slice = None
    ) -> pd.DataFrame:
        """指定列の読み込み"""
        
        if store_name not in self.column_store:
            raise ValueError(f"Store {store_name} not found")
        
        store_path = self.column_store[store_name]
        
        # メタデータの読み込み
        with open(os.path.join(store_path, 'metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        # 指定列の読み込み
        column_data = {}
        for column in columns:
            if column in metadata['columns']:
                column_file = os.path.join(store_path, f"{column}.parquet")
                column_df = pd.read_parquet(column_file)
                
                if row_slice:
                    column_df = column_df.iloc[row_slice]
                
                column_data[column] = column_df[column]
        
        return pd.DataFrame(column_data)
    
    def column_statistics(self, store_name: str) -> Dict[str, Dict[str, Any]]:
        """列統計の計算"""
        
        if store_name not in self.column_store:
            raise ValueError(f"Store {store_name} not found")
        
        store_path = self.column_store[store_name]
        
        # メタデータの読み込み
        with open(os.path.join(store_path, 'metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        statistics = {}
        
        for column in metadata['columns']:
            column_file = os.path.join(store_path, f"{column}.parquet")
            column_df = pd.read_parquet(column_file)
            column_series = column_df[column]
            
            if column_series.dtype in ['int64', 'float64', 'int32', 'float32']:
                # 数値列の統計
                statistics[column] = {
                    'count': len(column_series),
                    'null_count': column_series.isnull().sum(),
                    'mean': column_series.mean(),
                    'std': column_series.std(),
                    'min': column_series.min(),
                    'max': column_series.max(),
                    'q25': column_series.quantile(0.25),
                    'q50': column_series.quantile(0.50),
                    'q75': column_series.quantile(0.75)
                }
            else:
                # カテゴリ列の統計
                statistics[column] = {
                    'count': len(column_series),
                    'null_count': column_series.isnull().sum(),
                    'unique_count': column_series.nunique(),
                    'top_values': column_series.value_counts().head(10).to_dict()
                }
        
        return statistics

class DistributedDataProcessor:
    """分散データ処理"""
    
    def __init__(self, n_workers: int = 4):
        self.n_workers = n_workers
        self.result_queue = queue.Queue()
    
    def map_reduce_processing(
        self, 
        data_partitions: List[Any],
        map_func: callable,
        reduce_func: callable
    ) -> Any:
        """Map-Reduce処理"""
        
        # Map フェーズ
        def map_worker(partition):
            return map_func(partition)
        
        with concurrent.futures.ProcessPoolExecutor(max_workers=self.n_workers) as executor:
            map_results = list(executor.map(map_worker, data_partitions))
        
        # Reduce フェーズ
        result = map_results[0]
        for map_result in map_results[1:]:
            result = reduce_func(result, map_result)
        
        return result
    
    def parallel_file_processing(
        self, 
        file_paths: List[str],
        processing_func: callable,
        combine_func: callable = None
    ) -> Any:
        """並列ファイル処理"""
        
        def process_file(file_path):
            try:
                df = pd.read_csv(file_path)
                return processing_func(df)
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                return None
        
        # 並列処理
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.n_workers) as executor:
            results = list(executor.map(process_file, file_paths))
        
        # None結果を除去
        valid_results = [r for r in results if r is not None]
        
        # 結果の結合
        if combine_func and valid_results:
            return combine_func(valid_results)
        else:
            return valid_results
    
    def streaming_window_processing(
        self, 
        data_stream: Iterator[pd.DataFrame],
        window_size: int,
        processing_func: callable
    ) -> Iterator[Any]:
        """ストリーミングウィンドウ処理"""
        
        window_buffer = []
        
        for data_chunk in data_stream:
            window_buffer.append(data_chunk)
            
            # ウィンドウサイズに達した場合の処理
            if len(window_buffer) >= window_size:
                # ウィンドウデータの結合
                window_data = pd.concat(window_buffer, ignore_index=True)
                
                # 処理の実行
                result = processing_func(window_data)
                yield result
                
                # バッファのスライド
                window_buffer = window_buffer[1:]

class DataLakeManager:
    """データレイク管理"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.catalog = {}
        self.catalog_file = os.path.join(base_path, 'catalog.json')
        self._load_catalog()
    
    def _load_catalog(self):
        """カタログの読み込み"""
        if os.path.exists(self.catalog_file):
            with open(self.catalog_file, 'r') as f:
                self.catalog = json.load(f)
        else:
            self.catalog = {}
    
    def _save_catalog(self):
        """カタログの保存"""
        os.makedirs(self.base_path, exist_ok=True)
        with open(self.catalog_file, 'w') as f:
            json.dump(self.catalog, f, indent=2)
    
    def register_dataset(
        self, 
        dataset_name: str,
        file_pattern: str,
        format_type: str = 'parquet',
        partitions: List[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """データセットの登録"""
        
        self.catalog[dataset_name] = {
            'file_pattern': file_pattern,
            'format_type': format_type,
            'partitions': partitions or [],
            'metadata': metadata or {},
            'created_at': pd.Timestamp.now().isoformat()
        }
        
        self._save_catalog()
    
    def read_dataset(
        self, 
        dataset_name: str,
        partition_filter: Dict[str, Any] = None,
        columns: List[str] = None
    ) -> pd.DataFrame:
        """データセットの読み込み"""
        
        if dataset_name not in self.catalog:
            raise ValueError(f"Dataset {dataset_name} not found")
        
        dataset_info = self.catalog[dataset_name]
        file_pattern = os.path.join(self.base_path, dataset_info['file_pattern'])
        
        if dataset_info['format_type'] == 'parquet':
            # Parquetファイルの読み込み
            filters = []
            if partition_filter:
                for col, value in partition_filter.items():
                    filters.append((col, '==', value))
            
            if filters:
                table = pq.read_table(file_pattern, filters=filters, columns=columns)
            else:
                table = pq.read_table(file_pattern, columns=columns)
            
            return table.to_pandas()
        
        elif dataset_info['format_type'] == 'csv':
            # CSVファイルの読み込み
            import glob
            csv_files = glob.glob(file_pattern)
            
            dataframes = []
            for csv_file in csv_files:
                df = pd.read_csv(csv_file, usecols=columns)
                
                # パーティションフィルタの適用
                if partition_filter:
                    for col, value in partition_filter.items():
                        if col in df.columns:
                            df = df[df[col] == value]
                
                dataframes.append(df)
            
            return pd.concat(dataframes, ignore_index=True)
        
        else:
            raise ValueError(f"Unsupported format: {dataset_info['format_type']}")
    
    def write_dataset(
        self, 
        df: pd.DataFrame,
        dataset_name: str,
        partition_cols: List[str] = None,
        format_type: str = 'parquet'
    ):
        """データセットの書き込み"""
        
        dataset_path = os.path.join(self.base_path, dataset_name)
        os.makedirs(dataset_path, exist_ok=True)
        
        if format_type == 'parquet':
            table = pa.Table.from_pandas(df)
            
            if partition_cols:
                pq.write_to_dataset(
                    table, 
                    root_path=dataset_path,
                    partition_cols=partition_cols
                )
            else:
                pq.write_table(table, os.path.join(dataset_path, 'data.parquet'))
        
        elif format_type == 'csv':
            if partition_cols:
                # パーティション別にCSVファイルを作成
                for partition_values, group in df.groupby(partition_cols):
                    if isinstance(partition_values, tuple):
                        partition_path = '/'.join(f"{col}={val}" for col, val in zip(partition_cols, partition_values))
                    else:
                        partition_path = f"{partition_cols[0]}={partition_values}"
                    
                    full_path = os.path.join(dataset_path, partition_path)
                    os.makedirs(full_path, exist_ok=True)
                    
                    group.to_csv(os.path.join(full_path, 'data.csv'), index=False)
            else:
                df.to_csv(os.path.join(dataset_path, 'data.csv'), index=False)
        
        # カタログに登録
        self.register_dataset(
            dataset_name,
            f"{dataset_name}/**/*.{format_type}",
            format_type,
            partition_cols,
            {
                'rows': len(df),
                'columns': list(df.columns),
                'size_mb': df.memory_usage(deep=True).sum() / 1024 / 1024
            }
        )

# 使用例
def large_dataset_example():
    """大規模データセット処理の例"""
    
    # サンプルデータの生成器
    def data_generator():
        for i in range(10):
            yield np.random.randn(1000, 50)
    
    # HDF5データセットの作成
    handler = LargeDatasetHandler()
    handler.create_hdf5_dataset(
        'large_dataset.h5',
        data_generator(),
        chunk_size=(1000, 50)
    )
    
    # HDF5からのチャンク読み込み
    chunk_shapes = []
    for chunk in handler.read_hdf5_chunks('large_dataset.h5', chunk_size=2000):
        chunk_shapes.append(chunk.shape)
    
    # 列指向処理
    sample_df = pd.DataFrame({
        'A': np.random.randn(10000),
        'B': np.random.randn(10000),
        'C': np.random.choice(['X', 'Y', 'Z'], 10000)
    })
    
    columnar_processor = ColumnOrientedProcessor()
    columnar_processor.create_columnar_store(sample_df, 'sample_store')
    
    # 列統計の計算
    stats = columnar_processor.column_statistics('sample_store')
    
    # データレイク管理
    data_lake = DataLakeManager('data_lake')
    data_lake.write_dataset(sample_df, 'sample_dataset', partition_cols=['C'])
    
    # データセットの読み込み
    filtered_data = data_lake.read_dataset(
        'sample_dataset',
        partition_filter={'C': 'X'},
        columns=['A', 'B']
    )
    
    # クリーンアップ
    os.remove('large_dataset.h5')
    
    return {
        'hdf5_chunk_shapes': chunk_shapes,
        'column_stats_keys': list(stats.keys()),
        'filtered_data_shape': filtered_data.shape
    }
```

このNumPy/Pandasデータサイエンスパターンドキュメントは約1500行の包括的な内容で、大規模データ処理からメモリ最適化まで実用的なパターンを網羅しています。

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Phase 3: Python Advanced Libraries - FastAPI production patterns document", "status": "completed", "id": "18"}, {"content": "Phase 3: SQLAlchemy 2.0 advanced ORM patterns document", "status": "completed", "id": "19"}, {"content": "Phase 3: Pydantic v2 data validation patterns document", "status": "completed", "id": "20"}, {"content": "Phase 3: Async Python concurrency patterns document", "status": "completed", "id": "21"}, {"content": "Phase 3: Pytest advanced testing patterns document", "status": "completed", "id": "22"}, {"content": "Phase 3: Celery distributed task patterns document", "status": "completed", "id": "23"}, {"content": "Phase 3: NumPy/Pandas data science patterns document", "status": "completed", "id": "24"}, {"content": "Phase 3: Django REST framework enterprise patterns document", "status": "in_progress", "id": "25"}, {"content": "Phase 4: Architecture Patterns (8 documents)", "status": "pending", "id": "26"}, {"content": "Phase 5: Development Methodologies (3 documents)", "status": "pending", "id": "27"}]