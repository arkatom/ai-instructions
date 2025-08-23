# Pandas Performance Optimization

## Query Optimization

```python
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

class PandasOptimizer:
    """Performance optimization utilities for Pandas"""
    
    @staticmethod
    def optimize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
        """Optimize DataFrame dtypes to reduce memory usage"""
        optimized = df.copy()
        
        for col in df.columns:
            col_type = df[col].dtype
            
            if col_type != 'object':
                c_min = df[col].min()
                c_max = df[col].max()
                
                if str(col_type)[:3] == 'int':
                    if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                        optimized[col] = df[col].astype(np.int8)
                    elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                        optimized[col] = df[col].astype(np.int16)
                    elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                        optimized[col] = df[col].astype(np.int32)
                else:
                    if c_min > np.finfo(np.float32).min and c_max < np.finfo(np.float32).max:
                        optimized[col] = df[col].astype(np.float32)
            else:
                # Convert strings to categories if beneficial
                if df[col].nunique() / len(df) < 0.5:  # Less than 50% unique values
                    optimized[col] = df[col].astype('category')
        
        return optimized
    
    @staticmethod
    def memory_usage_summary(df: pd.DataFrame) -> pd.DataFrame:
        """Detailed memory usage analysis"""
        memory_usage = df.memory_usage(deep=True)
        dtypes = df.dtypes
        
        summary = pd.DataFrame({
            'Column': df.columns,
            'Dtype': dtypes,
            'Memory_MB': memory_usage[1:] / 1024**2,
            'Null_Count': df.isnull().sum(),
            'Unique_Values': df.nunique()
        })
        
        summary['Memory_Percentage'] = (summary['Memory_MB'] / summary['Memory_MB'].sum()) * 100
        return summary.sort_values('Memory_MB', ascending=False)

# Efficient query patterns
def efficient_filtering(df: pd.DataFrame) -> pd.DataFrame:
    """Demonstrate efficient filtering techniques"""
    
    # Use query() for complex conditions (faster than boolean indexing)
    threshold = 100
    result1 = df.query('column_a > @threshold and column_b < 50')
    
    # Use .loc for single conditions
    result2 = df.loc[df['column_c'] == 'target_value']
    
    # Use categorical data for string operations
    if df['category_col'].dtype == 'object':
        df['category_col'] = df['category_col'].astype('category')
    
    return result1

def vectorized_operations(df: pd.DataFrame) -> pd.DataFrame:
    """Use vectorized operations instead of apply()"""
    
    # BAD: Using apply with lambda
    # df['new_col'] = df['col'].apply(lambda x: x * 2 + 1)
    
    # GOOD: Vectorized operations
    df['new_col'] = df['col'] * 2 + 1
    
    # Use where() for conditional operations
    df['conditional'] = np.where(df['col'] > 0, df['col'], 0)
    
    # Use cut() for binning
    df['binned'] = pd.cut(df['numeric_col'], bins=5, labels=['low', 'med-low', 'med', 'med-high', 'high'])
    
    return df
```

## Groupby Optimization

```python
class GroupbyOptimizer:
    """Optimized groupby operations"""
    
    @staticmethod
    def efficient_aggregation(df: pd.DataFrame, group_cols: List[str]) -> pd.DataFrame:
        """Efficient aggregation patterns"""
        
        # Use categorical grouping columns
        for col in group_cols:
            if df[col].dtype == 'object':
                df[col] = df[col].astype('category')
        
        # Multiple aggregations in single operation
        agg_dict = {
            'value_col': ['sum', 'mean', 'count'],
            'price_col': ['min', 'max', 'std']
        }
        
        result = df.groupby(group_cols).agg(agg_dict)
        result.columns = ['_'.join(col).strip() for col in result.columns]
        
        return result.reset_index()
    
    @staticmethod
    def rolling_groupby(df: pd.DataFrame, group_col: str, 
                       value_col: str, window: int) -> pd.DataFrame:
        """Efficient rolling operations by group"""
        
        # Sort for efficiency
        df_sorted = df.sort_values([group_col, 'date_col'])
        
        # Rolling operations
        df_sorted['rolling_mean'] = (df_sorted.groupby(group_col)[value_col]
                                   .rolling(window=window, min_periods=1)
                                   .mean()
                                   .reset_index(level=0, drop=True))
        
        return df_sorted
    
    @staticmethod
    def transform_vs_apply(df: pd.DataFrame, group_col: str, value_col: str) -> pd.DataFrame:
        """When to use transform vs apply"""
        
        # Use transform for same-shape operations
        df['group_mean'] = df.groupby(group_col)[value_col].transform('mean')
        df['centered'] = df[value_col] - df['group_mean']
        
        # Use apply for aggregation or complex functions
        group_stats = df.groupby(group_col)[value_col].apply(
            lambda x: pd.Series({
                'count': len(x),
                'mean': x.mean(),
                'std': x.std()
            })
        ).unstack()
        
        return df, group_stats
```

## I/O Optimization

```python
class IOOptimizer:
    """File I/O optimization patterns"""
    
    @staticmethod
    def optimized_csv_reading(filepath: str, **kwargs) -> pd.DataFrame:
        """Optimized CSV reading with dtype inference"""
        
        # First, read small sample to infer types
        sample = pd.read_csv(filepath, nrows=1000)
        dtypes = {}
        
        for col in sample.columns:
            if sample[col].dtype == 'object':
                # Check if it should be categorical
                if sample[col].nunique() / len(sample) < 0.5:
                    dtypes[col] = 'category'
            elif sample[col].dtype == 'int64':
                # Downcast integers
                if sample[col].max() < 32767 and sample[col].min() > -32768:
                    dtypes[col] = 'int16'
            elif sample[col].dtype == 'float64':
                # Try float32
                dtypes[col] = 'float32'
        
        # Read full file with optimized dtypes
        return pd.read_csv(filepath, dtype=dtypes, **kwargs)
    
    @staticmethod
    def chunked_processing(filepath: str, chunksize: int = 10000,
                          process_func=None) -> pd.DataFrame:
        """Process large files in chunks"""
        results = []
        
        for chunk in pd.read_csv(filepath, chunksize=chunksize):
            if process_func:
                processed_chunk = process_func(chunk)
            else:
                processed_chunk = chunk
            
            results.append(processed_chunk)
        
        return pd.concat(results, ignore_index=True)
    
    @staticmethod
    def parquet_optimization(df: pd.DataFrame, filepath: str):
        """Save DataFrame in optimized Parquet format"""
        
        # Optimize types before saving
        df_optimized = PandasOptimizer.optimize_dtypes(df)
        
        # Save with compression
        df_optimized.to_parquet(
            filepath,
            compression='snappy',
            index=False,
            engine='pyarrow'
        )
```

## Method Chaining Patterns

```python
def method_chaining_example(df: pd.DataFrame) -> pd.DataFrame:
    """Efficient method chaining patterns"""
    result = (df.pipe(PandasOptimizer.optimize_dtypes)
              .query('age > 18 and salary > 0')
              .assign(age_group=lambda x: pd.cut(x['age'], bins=[0, 30, 50, 100], 
                                                labels=['young', 'middle', 'senior']),
                     salary_log=lambda x: np.log1p(x['salary']))
              .groupby('department')
              .agg({'salary': ['mean', 'median'], 'age': 'mean', 'employee_id': 'count'})
              .round(2))
    result.columns = ['_'.join(col).strip() for col in result.columns]
    return result.reset_index()

# Performance monitoring
def profile_pandas_operation(operation_func, df: pd.DataFrame):
    """Profile pandas operations"""
    import time
    start_time = time.time()
    start_memory = df.memory_usage(deep=True).sum()
    result = operation_func(df)
    print(f"Execution time: {time.time() - start_time:.3f}s")
    print(f"Memory change: {(result.memory_usage(deep=True).sum() if hasattr(result, 'memory_usage') else 0 - start_memory) / 1024**2:.1f}MB")
    return result
```

## Best Practices Summary

```yaml
memory_optimization:
  - Use categorical dtype for low-cardinality strings
  - Downcast numeric types (int64 → int32/int16)
  - Use float32 instead of float64 when possible
  - Process large files in chunks

query_optimization:
  - Use .query() for complex boolean conditions
  - Use .loc[] for simple single conditions  
  - Set columns as categorical before grouping
  - Use vectorized operations over .apply()

groupby_optimization:
  - Sort data before groupby operations
  - Use transform for broadcasting operations
  - Combine multiple aggregations in single call
  - Use categorical group keys

io_optimization:
  - Specify dtypes when reading CSV files
  - Use Parquet format for better performance
  - Enable compression for storage efficiency
  - Use chunked reading for large files
```