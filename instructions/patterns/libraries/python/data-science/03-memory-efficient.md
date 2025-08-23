# Memory-Efficient Data Processing

## Memory Management for Large Datasets

```python
import pandas as pd
import numpy as np
from typing import Iterator, Generator, Callable, Any, Dict, List, Optional
import os
import gc
import psutil
import json
from contextlib import contextmanager
import dask.dataframe as dd
import dask
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

class MemoryEfficientProcessor:
    """Memory-efficient data processing"""
    def __init__(self, memory_threshold: float = 0.8):
        self.memory_threshold = memory_threshold
        self.temp_files = []
    
    def __del__(self):
        for f in self.temp_files:
            try: os.remove(f)
            except: pass
    
    @contextmanager
    def memory_monitor(self):
        """Memory monitoring context"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        try:
            yield
        finally:
            memory_used = process.memory_info().rss / 1024 / 1024 - initial_memory
            print(f"Memory used: {memory_used:.1f}MB")
            if psutil.virtual_memory().percent > self.memory_threshold * 100:
                gc.collect()
    
    def chunk_file_processor(self, file_path: str, chunk_size: int = 10000, processor_func: Callable = None) -> Generator[pd.DataFrame, None, None]:
        """Process files in chunks"""
        for chunk in pd.read_csv(file_path, chunksize=chunk_size):
            yield processor_func(chunk) if processor_func else chunk
            gc.collect()
    
    def streaming_aggregation(self, file_path: str, group_cols: List[str], agg_cols: Dict[str, List[str]], chunk_size: int = 10000) -> pd.DataFrame:
        """Streaming aggregation"""
        partial_results = {}
        for chunk in pd.read_csv(file_path, chunksize=chunk_size):
            chunk_agg = chunk.groupby(group_cols).agg(agg_cols)
            for group_key, group_data in chunk_agg.groupby(level=group_cols):
                if group_key not in partial_results:
                    partial_results[group_key] = []
                partial_results[group_key].append(group_data)
        
        final_results = [pd.concat(chunks).groupby(level=group_cols).agg(agg_cols) 
                       for chunks in partial_results.values()]
        return pd.concat(final_results)
    
    def external_sort(self, file_path: str, sort_columns: List[str], chunk_size: int = 10000, output_path: str = None) -> str:
        """External sorting for large files"""
        output_path = output_path or f"sorted_{os.path.basename(file_path)}"
        temp_files = []
        for i, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size)):
            temp_file = f"temp_sorted_{i}.csv"
            chunk.sort_values(sort_columns).to_csv(temp_file, index=False)
            temp_files.append(temp_file)
            self.temp_files.append(temp_file)
        self._merge_sorted_files(temp_files, sort_columns, output_path)
        return output_path
    
    def _merge_sorted_files(self, temp_files: List[str], sort_columns: List[str], output_path: str):
        """Merge sorted files"""
        file_iterators, current_rows = [], []
        for temp_file in temp_files:
            iterator = pd.read_csv(temp_file, chunksize=1)
            try:
                first_row = next(iterator)
                file_iterators.append(iterator)
                current_rows.append(first_row.iloc[0])
            except StopIteration:
                continue
        
        with open(output_path, 'w') as f:
            if current_rows:
                f.write(','.join(current_rows[0].index.tolist()) + '\n')
                while current_rows:
                    min_idx = min(range(len(current_rows)), 
                                 key=lambda i: tuple(current_rows[i][col] for col in sort_columns))
                    f.write(','.join(str(val) for val in current_rows[min_idx].values) + '\n')
                    try:
                        current_rows[min_idx] = next(file_iterators[min_idx]).iloc[0]
                    except StopIteration:
                        del current_rows[min_idx], file_iterators[min_idx]
    

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
        return ddf.groupby(group_cols).agg(agg_dict).compute()

class StreamingDataProcessor:
    """Streaming data processor"""
    def __init__(self, buffer_size: int = 1000):
        self.buffer_size = buffer_size
        self.buffer = []
        self.processed_count = 0
    
    def process_stream(self, data_stream: Iterator[Dict[str, Any]], 
                      processor_func: Callable, output_handler: Callable):
        """Process streaming data"""
        for data_point in data_stream:
            self.buffer.append(data_point)
            if len(self.buffer) >= self.buffer_size:
                self._process_buffer(processor_func, output_handler)
        if self.buffer:
            self._process_buffer(processor_func, output_handler)
    
    def _process_buffer(self, processor_func: Callable, output_handler: Callable):
        """Process buffer data"""
        output_handler(processor_func(pd.DataFrame(self.buffer)))
        self.processed_count += len(self.buffer)
        self.buffer.clear()

class IncrementalProcessor:
    """Incremental data processor"""
    def __init__(self, state_file: str = "processing_state.json"):
        self.state_file = state_file
        self.state = json.load(open(state_file, 'r')) if os.path.exists(state_file) else {}
    
    def _save_state(self):
        json.dump(self.state, open(self.state_file, 'w'))
    
    def incremental_processing(self, data_source: str, processor_func: Callable, key_column: str = 'timestamp') -> pd.DataFrame:
        """Incremental processing"""
        df = pd.read_csv(data_source)
        last_processed = self.state.get('last_processed')
        
        if last_processed and key_column in df.columns:
            df[key_column] = pd.to_datetime(df[key_column])
            incremental_df = df[df[key_column] > pd.to_datetime(last_processed)]
        else:
            incremental_df = df
        
        if incremental_df.empty:
            return pd.DataFrame()
        
        processed_df = processor_func(incremental_df)
        if key_column in incremental_df.columns:
            self.state['last_processed'] = incremental_df[key_column].max().isoformat()
        self.state['processed_count'] = self.state.get('processed_count', 0) + len(incremental_df)
        self._save_state()
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
    chunks = list(processor.chunk_file_processor(
        sample_file, chunk_size=10000, 
        processor_func=lambda chunk: chunk[chunk['value'] > 0]))
    
    agg_result = processor.streaming_aggregation(
        sample_file, ['category'], {'value': ['mean', 'sum']}, 20000)
    
    dask_processor = DaskDataProcessor()
    ddf = dd.read_csv(sample_file)
    dask_agg = dask_processor.distributed_aggregation(
        ddf, ['category'], {'value': 'mean'})
    
    os.remove(sample_file)
    return {'chunks': len(chunks), 'agg_shape': agg_result.shape, 
            'dask_shape': dask_agg.shape}
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