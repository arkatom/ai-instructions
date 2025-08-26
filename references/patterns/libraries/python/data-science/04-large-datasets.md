# Large Dataset Handling

## HDF5 and Zarr for Large Arrays

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
    """Large dataset processing handler"""
    
    def __init__(self):
        self.chunk_cache = {}
        self.cache_lock = threading.Lock()
        self.max_cache_size = 10
    
    def create_hdf5_dataset(self, file_path: str, data_generator: Iterator[np.ndarray], dataset_name: str = 'data', chunk_size: tuple = None, compression: str = 'gzip'):
        """Create HDF5 dataset"""
        with h5py.File(file_path, 'w') as f:
            first_chunk = next(data_generator)
            max_shape = (None,) + first_chunk.shape[1:]
            dataset = f.create_dataset(dataset_name, data=first_chunk, maxshape=max_shape, chunks=chunk_size, compression=compression)
            current_size = first_chunk.shape[0]
            
            for chunk in data_generator:
                new_size = current_size + chunk.shape[0]
                dataset.resize((new_size,) + chunk.shape[1:])
                dataset[current_size:new_size] = chunk
                current_size = new_size
    
    def read_hdf5_chunks(self, file_path: str, dataset_name: str = 'data', chunk_size: int = 10000) -> Iterator[np.ndarray]:
        """Read HDF5 dataset in chunks"""
        with h5py.File(file_path, 'r') as f:
            dataset = f[dataset_name]
            total_rows = dataset.shape[0]
            for start in range(0, total_rows, chunk_size):
                end = min(start + chunk_size, total_rows)
                yield dataset[start:end]
    
    def create_zarr_array(self, store_path: str, data_generator: Iterator[np.ndarray], chunk_size: tuple = (1000, 1000), compression: str = 'blosc'):
        """Create Zarr array"""
        store = zarr.DirectoryStore(store_path)
        first_chunk = next(data_generator)
        z = zarr.open(store, mode='w', shape=(0,) + first_chunk.shape[1:], chunks=chunk_size, dtype=first_chunk.dtype, compressor=zarr.Blosc(cname=compression))
        z.append(first_chunk, axis=0)
        for chunk in data_generator:
            z.append(chunk, axis=0)
        return z
    
    def parallel_parquet_processing(self, parquet_files: List[str], processing_func: callable, output_dir: str, n_workers: int = 4):
        """Parallel Parquet processing"""
        def process_single_file(file_info):
            file_path, output_path = file_info
            table = pq.read_table(file_path)
            df = table.to_pandas()
            processed_df = processing_func(df)
            processed_table = pa.Table.from_pandas(processed_df)
            pq.write_table(processed_table, output_path)
            return output_path
        
        file_pairs = [(file_path, os.path.join(output_dir, f"processed_{i}.parquet")) for i, file_path in enumerate(parquet_files)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(process_single_file, file_pairs))
        return results
    
    def cached_chunk_reader(self, file_path: str, chunk_size: int = 10000) -> Iterator[pd.DataFrame]:
        """Cached chunk reader"""
        cache_key = f"{file_path}_{chunk_size}"
        
        with self.cache_lock:
            if cache_key in self.chunk_cache:
                for chunk in self.chunk_cache[cache_key]:
                    yield chunk.copy()
                return
        
        chunks = []
        for chunk in pd.read_csv(file_path, chunksize=chunk_size):
            chunks.append(chunk.copy())
            yield chunk
        
        with self.cache_lock:
            if len(self.chunk_cache) >= self.max_cache_size:
                oldest_key = next(iter(self.chunk_cache))
                del self.chunk_cache[oldest_key]
            self.chunk_cache[cache_key] = chunks

class ColumnOrientedProcessor:
    """Columnar data processing"""
    def __init__(self):
        self.column_store = {}
    
    def create_columnar_store(self, df: pd.DataFrame, store_name: str, compression: str = 'snappy'):
        """Create columnar store"""
        store_path = f"{store_name}_columnar"
        os.makedirs(store_path, exist_ok=True)
        
        for column in df.columns:
            column_file = os.path.join(store_path, f"{column}.parquet")
            table = pa.Table.from_pandas(df[[column]])
            pq.write_table(table, column_file, compression=compression)
        
        metadata = {'columns': list(df.columns), 'shape': df.shape, 'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}}
        with open(os.path.join(store_path, 'metadata.json'), 'w') as f:
            json.dump(metadata, f)
        self.column_store[store_name] = store_path
    
    def read_columns(self, store_name: str, columns: List[str], row_slice: slice = None) -> pd.DataFrame:
        """Read specific columns"""
        if store_name not in self.column_store:
            raise ValueError(f"Store {store_name} not found")
        
        store_path = self.column_store[store_name]
        with open(os.path.join(store_path, 'metadata.json'), 'r') as f:
            metadata = json.load(f)
        
        column_data = {}
        for column in columns:
            if column in metadata['columns']:
                column_file = os.path.join(store_path, f"{column}.parquet")
                column_df = pd.read_parquet(column_file)
                if row_slice:
                    column_df = column_df.iloc[row_slice]
                column_data[column] = column_df[column]
        return pd.DataFrame(column_data)

class DistributedDataProcessor:
    """Distributed data processing"""
    def __init__(self, n_workers: int = 4):
        self.n_workers = n_workers
    
    def map_reduce_processing(self, data_partitions: List[Any], map_func: callable, reduce_func: callable) -> Any:
        """Map-Reduce processing"""
        with concurrent.futures.ProcessPoolExecutor(max_workers=self.n_workers) as executor:
            map_results = list(executor.map(map_func, data_partitions))
        
        result = map_results[0]
        for r in map_results[1:]:
            result = reduce_func(result, r)
        return result
    
    def parallel_file_processing(self, file_paths: List[str], processing_func: callable) -> List[Any]:
        """Parallel file processing"""
        def process_file(file_path):
            try:
                return processing_func(pd.read_csv(file_path))
            except Exception as e:
                print(f"Error: {e}")
                return None
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.n_workers) as executor:
            results = list(executor.map(process_file, file_paths))
        return [r for r in results if r is not None]

class DataLakeManager:
    """Data lake management"""
    
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.catalog = {}
        self.catalog_file = os.path.join(base_path, 'catalog.json')
        self._load_catalog()
    
    def _load_catalog(self):
        """Load catalog"""
        if os.path.exists(self.catalog_file):
            with open(self.catalog_file, 'r') as f:
                self.catalog = json.load(f)
        else:
            self.catalog = {}
    
    def _save_catalog(self):
        """Save catalog"""
        os.makedirs(self.base_path, exist_ok=True)
        with open(self.catalog_file, 'w') as f:
            json.dump(self.catalog, f, indent=2)
    
    def register_dataset(self, dataset_name: str, file_pattern: str, format_type: str = 'parquet',
                        partitions: List[str] = None, metadata: Dict[str, Any] = None):
        """Register dataset"""
        self.catalog[dataset_name] = {
            'file_pattern': file_pattern, 'format_type': format_type,
            'partitions': partitions or [], 'metadata': metadata or {},
            'created_at': pd.Timestamp.now().isoformat()
        }
        self._save_catalog()
    
    def read_dataset(self, dataset_name: str, partition_filter: Dict[str, Any] = None, columns: List[str] = None) -> pd.DataFrame:
        """Read dataset"""
        if dataset_name not in self.catalog:
            raise ValueError(f"Dataset {dataset_name} not found")
        
        dataset_info = self.catalog[dataset_name]
        file_pattern = os.path.join(self.base_path, dataset_info['file_pattern'])
        
        if dataset_info['format_type'] == 'parquet':
            filters = [(col, '==', val) for col, val in (partition_filter or {}).items()]
            table = pq.read_table(file_pattern, filters=filters or None, columns=columns)
            return table.to_pandas()
        
        elif dataset_info['format_type'] == 'csv':
            import glob
            dataframes = []
            for csv_file in glob.glob(file_pattern):
                df = pd.read_csv(csv_file, usecols=columns)
                if partition_filter:
                    for col, val in partition_filter.items():
                        if col in df.columns:
                            df = df[df[col] == val]
                dataframes.append(df)
            return pd.concat(dataframes, ignore_index=True)
        
        raise ValueError(f"Unsupported format: {dataset_info['format_type']}")
    
    def write_dataset(self, df: pd.DataFrame, dataset_name: str, partition_cols: List[str] = None, format_type: str = 'parquet'):
        """Write dataset"""
        dataset_path = os.path.join(self.base_path, dataset_name)
        os.makedirs(dataset_path, exist_ok=True)
        
        if format_type == 'parquet':
            table = pa.Table.from_pandas(df)
            if partition_cols:
                pq.write_to_dataset(table, root_path=dataset_path, partition_cols=partition_cols)
            else:
                pq.write_table(table, os.path.join(dataset_path, 'data.parquet'))
        
        elif format_type == 'csv':
            if partition_cols:
                for partition_values, group in df.groupby(partition_cols):
                    vals = partition_values if isinstance(partition_values, tuple) else [partition_values]
                    partition_path = '/'.join(f"{c}={v}" for c, v in zip(partition_cols, vals))
                    full_path = os.path.join(dataset_path, partition_path)
                    os.makedirs(full_path, exist_ok=True)
                    group.to_csv(os.path.join(full_path, 'data.csv'), index=False)
            else:
                df.to_csv(os.path.join(dataset_path, 'data.csv'), index=False)
        
        self.register_dataset(dataset_name, f"{dataset_name}/**/*.{format_type}", format_type, partition_cols, 
                            {'rows': len(df), 'columns': list(df.columns), 'size_mb': df.memory_usage(deep=True).sum() / 1024 / 1024})

# Usage example
def large_dataset_example():
    """Large dataset processing example"""
    handler = LargeDatasetHandler()
    data_lake = DataLakeManager('data_lake')
    sample_df = pd.DataFrame({
        'A': np.random.randn(10000), 'B': np.random.randn(10000), 
        'C': np.random.choice(['X', 'Y', 'Z'], 10000)
    })
    data_lake.write_dataset(sample_df, 'sample_dataset', partition_cols=['C'])
    filtered_data = data_lake.read_dataset('sample_dataset', partition_filter={'C': 'X'})
    return {'filtered_data_shape': filtered_data.shape}
```

## Best Practices

```yaml
storage_formats:
  hdf5: [hierarchical, compression, fast random access, scientific data]
  parquet: [columnar, cloud-native, analytics, data warehousing]
  zarr: [chunked, distributed, cloud-optimized, large arrays]
  csv: [universal, simple, small datasets, data exchange]

processing_patterns:
  dask: [lazy evaluation, task graphs, custom schedulers, diagnostics]
  map_reduce: [data partitioning, pre-aggregation, fault tolerance, checkpointing]
  streaming: [windowed operations, backpressure, watermarks, state stores]
```