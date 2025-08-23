# Advanced NumPy Patterns

## Memory-Efficient Array Operations

```python
import numpy as np
from typing import Generator, Tuple, Optional
import psutil
from contextlib import contextmanager

class MemoryEfficientArray:
    """Memory-mapped array for large datasets"""
    
    def __init__(self, shape: Tuple[int, ...], dtype=np.float64, chunk_size: int = 10000):
        self.shape = shape
        self.dtype = dtype
        self.chunk_size = chunk_size
        
        # Use memory-mapped file for large arrays
        self.data = np.memmap(
            f'temp_array_{id(self)}.dat',
            dtype=dtype, mode='w+', shape=shape
        )
    
    def chunk_iterator(self) -> Generator[np.ndarray, None, None]:
        """Process array in chunks to manage memory"""
        total_elements = np.prod(self.shape)
        for start in range(0, total_elements, self.chunk_size):
            end = min(start + self.chunk_size, total_elements)
            indices = np.unravel_index(range(start, end), self.shape)
            yield self.data[indices]
    
    def apply_function(self, func, inplace=True):
        """Apply function chunk-wise"""
        for i, chunk in enumerate(self.chunk_iterator()):
            result = func(chunk)
            if inplace:
                start = i * self.chunk_size
                end = min(start + self.chunk_size, np.prod(self.shape))
                indices = np.unravel_index(range(start, end), self.shape)
                self.data[indices] = result.flatten()

@contextmanager
def memory_monitor():
    """Monitor memory usage"""
    process = psutil.Process()
    mem_before = process.memory_info().rss / 1024 / 1024
    yield
    mem_after = process.memory_info().rss / 1024 / 1024
    print(f"Memory usage: {mem_after - mem_before:+.1f}MB")
```

## Vectorized Operations

```python
class VectorizedOps:
    """High-performance vectorized operations"""
    
    @staticmethod
    def batch_normalize(arrays: list, axis=0) -> list:
        """Batch normalization for multiple arrays"""
        normalized = []
        for array in arrays:
            mean = np.mean(array, axis=axis, keepdims=True)
            std = np.std(array, axis=axis, keepdims=True)
            std = np.where(std == 0, 1, std)  # Avoid division by zero
            normalized.append((array - mean) / std)
        return normalized
    
    @staticmethod
    def sliding_window(array: np.ndarray, window_size: int) -> np.ndarray:
        """Create sliding window view without copying data"""
        shape = array.shape[:-1] + (array.shape[-1] - window_size + 1, window_size)
        strides = array.strides + (array.strides[-1],)
        return np.lib.stride_tricks.as_strided(array, shape=shape, strides=strides)
    
    @staticmethod
    def rolling_stats(array: np.ndarray, window_size: int) -> dict:
        """Compute rolling statistics efficiently"""
        windows = VectorizedOps.sliding_window(array, window_size)
        return {
            'mean': np.mean(windows, axis=1),
            'std': np.std(windows, axis=1),
            'min': np.min(windows, axis=1),
            'max': np.max(windows, axis=1)
        }
```

## Advanced Numerical Computing

```python
class AdvancedNumerical:
    """High-performance numerical operations"""
    
    @staticmethod
    def fast_correlation_matrix(data: np.ndarray, method='pearson') -> np.ndarray:
        """Optimized correlation matrix computation"""
        if method == 'pearson':
            data_centered = data - np.mean(data, axis=0)
            cov_matrix = np.dot(data_centered.T, data_centered) / (data.shape[0] - 1)
            std_devs = np.sqrt(np.diag(cov_matrix))
            return cov_matrix / np.outer(std_devs, std_devs)
        
        elif method == 'spearman':
            # Rank-based correlation
            ranked_data = np.empty_like(data)
            for i in range(data.shape[1]):
                ranked_data[:, i] = np.argsort(np.argsort(data[:, i]))
            return AdvancedNumerical.fast_correlation_matrix(ranked_data, 'pearson')
    
    @staticmethod
    def vectorized_distances(points: np.ndarray, metric='euclidean') -> np.ndarray:
        """Vectorized distance matrix computation"""
        if metric == 'euclidean':
            # Use broadcasting: ||a-b||² = ||a||² + ||b||² - 2a·b
            points_sq = np.sum(points**2, axis=1)
            dist_matrix = (points_sq[:, np.newaxis] + points_sq[np.newaxis, :] - 
                          2 * np.dot(points, points.T))
            return np.sqrt(np.maximum(dist_matrix, 0))  # Fix numerical errors
        
        elif metric == 'cosine':
            # Cosine similarity
            norms = np.linalg.norm(points, axis=1)
            normalized = points / norms[:, np.newaxis]
            return 1 - np.dot(normalized, normalized.T)

# Performance optimization utilities
def optimize_dtype(array: np.ndarray) -> np.ndarray:
    """Optimize array dtype to reduce memory usage"""
    if np.issubdtype(array.dtype, np.integer):
        # Find minimum integer type
        min_val, max_val = array.min(), array.max()
        for dtype in [np.int8, np.int16, np.int32, np.int64]:
            info = np.iinfo(dtype)
            if min_val >= info.min and max_val <= info.max:
                return array.astype(dtype)
    
    elif np.issubdtype(array.dtype, np.floating):
        # Consider float32 if precision allows
        if np.allclose(array, array.astype(np.float32)):
            return array.astype(np.float32)
    
    return array
```

## Broadcasting and Indexing Patterns

```python
# Advanced broadcasting examples
def broadcast_operations():
    """Demonstrate efficient broadcasting patterns"""
    
    # Matrix operations with broadcasting
    matrix = np.random.randn(1000, 500)
    row_means = np.mean(matrix, axis=1, keepdims=True)  # Shape: (1000, 1)
    col_stds = np.std(matrix, axis=0, keepdims=True)    # Shape: (1, 500)
    
    # Automatic broadcasting in normalization
    normalized = (matrix - row_means) / col_stds
    
    # Boolean indexing patterns
    mask = matrix > 0
    positive_values = matrix[mask]
    
    # Fancy indexing for complex selections
    rows = np.array([0, 2, 4])
    cols = np.array([1, 3, 5])
    selected = matrix[np.ix_(rows, cols)]  # Cartesian product indexing
    
    return normalized, positive_values, selected

# Memory layout optimization
def optimize_memory_layout(array: np.ndarray) -> np.ndarray:
    """Optimize array memory layout for cache efficiency"""
    if not array.flags['C_CONTIGUOUS']:
        return np.ascontiguousarray(array)
    return array

# Structured arrays for heterogeneous data
def create_structured_array():
    """Example of structured arrays for complex data"""
    dtype = np.dtype([
        ('id', 'i4'),
        ('name', 'U10'),
        ('values', 'f8', (3,)),
        ('active', '?')
    ])
    
    data = np.array([
        (1, 'Alice', [1.0, 2.0, 3.0], True),
        (2, 'Bob', [4.0, 5.0, 6.0], False)
    ], dtype=dtype)
    
    return data
```

## Performance Best Practices

```yaml
memory_optimization:
  - Use appropriate dtypes (float32 vs float64)
  - Leverage memory mapping for large arrays
  - Process data in chunks when possible
  - Use views instead of copies when feasible

vectorization_tips:
  - Avoid Python loops with NumPy operations
  - Use broadcasting for element-wise operations
  - Leverage ufuncs for mathematical operations
  - Consider numba for custom functions

cache_efficiency:
  - Ensure C-contiguous memory layout
  - Access arrays in row-major order
  - Use blocking for large matrix operations
  - Minimize memory allocations in loops
```