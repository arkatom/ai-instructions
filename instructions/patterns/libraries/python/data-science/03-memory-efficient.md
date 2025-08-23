# Memory-Efficient Data Processing

## Memory Management for Large Datasets

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
    """Memory-efficient data processing"""
    
    def __init__(self, memory_threshold: float = 0.8):
        self.memory_threshold = memory_threshold
        self.temp_files = []
    
    def __del__(self):
        """Cleanup temporary files"""
        for temp_file in self.temp_files:
            try:
                os.remove(temp_file)
            except:
                pass
    
    @contextmanager
    def memory_monitor(self):
        """Memory monitoring context"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        try:
            yield
        finally:
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_used = final_memory - initial_memory
            print(f"Memory used: {memory_used:.1f}MB")
            
            memory_percent = psutil.virtual_memory().percent
            if memory_percent > self.memory_threshold * 100:
                print(f"Warning: High memory usage ({memory_percent:.1f}%)")
                gc.collect()
    
    def chunk_file_processor(self, file_path: str, chunk_size: int = 10000, processor_func: Callable = None) -> Generator[pd.DataFrame, None, None]:
        """Process files in chunks"""
        with self.memory_monitor():
            for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                processed_chunk = processor_func(chunk) if processor_func else chunk
                yield processed_chunk
                del chunk
                gc.collect()
    
    def streaming_aggregation(self, file_path: str, group_cols: List[str], agg_cols: Dict[str, List[str]], chunk_size: int = 10000) -> pd.DataFrame:
        """Streaming aggregation"""
        partial_results = {}
        
        with self.memory_monitor():
            for chunk in pd.read_csv(file_path, chunksize=chunk_size):
                chunk_agg = chunk.groupby(group_cols).agg(agg_cols)
                for group_key, group_data in chunk_agg.groupby(level=group_cols):
                    if group_key not in partial_results:
                        partial_results[group_key] = []
                    partial_results[group_key].append(group_data)
                del chunk, chunk_agg
                gc.collect()
        
        final_results = []
        for group_key, group_chunks in partial_results.items():
            combined_chunk = pd.concat(group_chunks)
            final_agg = combined_chunk.groupby(level=group_cols).agg(agg_cols)
            final_results.append(final_agg)
        return pd.concat(final_results)
    
    def external_sort(self, file_path: str, sort_columns: List[str], chunk_size: int = 10000, output_path: str = None) -> str:
        """External sorting for large files"""
        if output_path is None:
            output_path = f"sorted_{os.path.basename(file_path)}"
        
        temp_files = []
        with self.memory_monitor():
            for i, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size)):
                sorted_chunk = chunk.sort_values(sort_columns)
                temp_file = f"temp_sorted_{i}.csv"
                sorted_chunk.to_csv(temp_file, index=False)
                temp_files.append(temp_file)
                self.temp_files.append(temp_file)
                del chunk, sorted_chunk
                gc.collect()
        
        self._merge_sorted_files(temp_files, sort_columns, output_path)
        return output_path
    
    def _merge_sorted_files(self, temp_files: List[str], sort_columns: List[str], output_path: str):
        """Merge sorted files"""
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
        
        with open(output_path, 'w') as output_file:
            if current_rows:
                header = ','.join(current_rows[0].index.tolist()) + '\n'
                output_file.write(header)
                
                while current_rows:
                    min_idx = 0
                    for i, row in enumerate(current_rows[1:], 1):
                        if self._compare_rows(row, current_rows[min_idx], sort_columns) < 0:
                            min_idx = i
                    
                    min_row = current_rows[min_idx]
                    row_str = ','.join(str(val) for val in min_row.values) + '\n'
                    output_file.write(row_str)
                    
                    try:
                        next_chunk = next(file_iterators[min_idx])
                        current_rows[min_idx] = next_chunk.iloc[0]
                    except StopIteration:
                        del current_rows[min_idx]
                        del file_iterators[min_idx]
    
    def _compare_rows(self, row1: pd.Series, row2: pd.Series, sort_columns: List[str]) -> int:
        """Compare rows for sorting"""
        for col in sort_columns:
            if row1[col] < row2[col]: return -1
            elif row1[col] > row2[col]: return 1
        return 0

class DaskDataProcessor:
    """Distributed data processing with Dask"""
    
    def __init__(self, n_workers: int = 4):
        self.n_workers = n_workers
        dask.config.set(scheduler='threads')
    
    def parallel_csv_processing(self, file_patterns: List[str], processing_func: Callable, output_path: str = None) -> dd.DataFrame:
        """Parallel CSV processing"""
        ddf = dd.read_csv(file_patterns)
        processed_ddf = ddf.map_partitions(processing_func, meta=ddf)
        if output_path:
            processed_ddf.to_csv(output_path, index=False)
        return processed_ddf
    
    def distributed_aggregation(self, ddf: dd.DataFrame, group_cols: List[str], agg_dict: Dict[str, str]) -> pd.DataFrame:
        """Distributed aggregation"""
        result = ddf.groupby(group_cols).agg(agg_dict)
        return result.compute()
    
    def parallel_apply(self, ddf: dd.DataFrame, func: Callable, axis: int = 0) -> dd.DataFrame:
        """Parallel apply operations"""
        if axis == 0:
            return ddf.map_partitions(lambda x: x.apply(func, axis=0))
        else:
            return ddf.apply(func, axis=1, meta=('result', 'f8'))

class StreamingDataProcessor:
    """Streaming data processor"""
    
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
        """Process streaming data"""
        
        for data_point in data_stream:
            self.buffer.append(data_point)
            
            if len(self.buffer) >= self.buffer_size:
                self._process_buffer(processor_func, output_handler)
        
        if self.buffer:
            self._process_buffer(processor_func, output_handler)
    
    def _process_buffer(self, processor_func: Callable, output_handler: Callable):
        """Process buffer data"""
        
        df = pd.DataFrame(self.buffer)
        processed_df = processor_func(df)
        output_handler(processed_df)
        
        self.processed_count += len(self.buffer)
        self.buffer.clear()
        print(f"Processed {self.processed_count} records")

class IncrementalProcessor:
    """Incremental data processor"""
    def __init__(self, state_file: str = "processing_state.json"):
        self.state_file = state_file
        self.state = self._load_state()
    
    def _load_state(self) -> Dict[str, Any]:
        if os.path.exists(self.state_file):
            import json
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {}
    
    def _save_state(self):
        import json
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f)
    
    def incremental_processing(self, data_source: str, processor_func: Callable, key_column: str = 'timestamp') -> pd.DataFrame:
        """Incremental processing"""
        last_processed = self.state.get('last_processed', None)
        df = pd.read_csv(data_source)
        
        if last_processed:
            if key_column in df.columns:
                df[key_column] = pd.to_datetime(df[key_column])
                last_processed_dt = pd.to_datetime(last_processed)
                incremental_df = df[df[key_column] > last_processed_dt]
            else:
                incremental_df = df
        else:
            incremental_df = df
        
        if len(incremental_df) == 0:
            print("No new data to process")
            return pd.DataFrame()
        
        processed_df = processor_func(incremental_df)
        
        if key_column in incremental_df.columns:
            self.state['last_processed'] = incremental_df[key_column].max().isoformat()
        self.state['processed_count'] = self.state.get('processed_count', 0) + len(incremental_df)
        self._save_state()
        
        print(f"Processed {len(incremental_df)} new records")
        return processed_df

# Usage example
def memory_efficient_example():
    """Memory-efficient processing example"""
    sample_data = pd.DataFrame({
        'id': range(100000),
        'category': np.random.choice(['A', 'B', 'C'], 100000),
        'value': np.random.randn(100000),
        'timestamp': pd.date_range('2023-01-01', periods=100000, freq='1min')
    })
    
    sample_file = 'sample_large_data.csv'
    sample_data.to_csv(sample_file, index=False)
    
    processor = MemoryEfficientProcessor()
    def simple_processor(chunk): return chunk[chunk['value'] > 0]
    
    processed_chunks = [len(chunk) for chunk in processor.chunk_file_processor(sample_file, chunk_size=10000, processor_func=simple_processor)]
    
    agg_result = processor.streaming_aggregation(sample_file, group_cols=['category'], agg_cols={'value': ['mean', 'sum', 'count']}, chunk_size=20000)
    
    dask_processor = DaskDataProcessor()
    ddf = dd.read_csv(sample_file)
    dask_agg = dask_processor.distributed_aggregation(ddf, group_cols=['category'], agg_dict={'value': 'mean'})
    
    memory_pool = MemoryPool(max_memory_mb=100)
    arrays = [memory_pool.allocate_array((1000, 1000), dtype=np.float32).shape for i in range(5)]
    
    os.remove(sample_file)
    memory_pool.clear_all()
    
    return {
        'processed_chunk_sizes': processed_chunks,
        'streaming_agg_shape': agg_result.shape,
        'dask_agg_shape': dask_agg.shape,
        'memory_pool_arrays': arrays
    }
```

## Best Practices

```yaml
memory_management:
  - Process data in chunks to stay within memory limits
  - Use generators for lazy evaluation
  - Monitor memory usage with context managers
  - Implement proper cleanup with __del__ methods

streaming_processing:
  - Use buffer-based processing for real-time data
  - Implement incremental processing for large datasets
  - Save processing state for recovery
  - Use Dask for distributed processing

optimization_techniques:
  - External sorting for files larger than RAM
  - Memory pools for efficient array allocation
  - Parallel processing with ThreadPoolExecutor
  - Temporary file management with automatic cleanup
```