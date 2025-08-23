# Data Science with NumPy & Pandas

## 🎯 Quick Access by Topic

### Core Optimization
- **NumPy Advanced**: `01-numpy-advanced.md` - Broadcasting, vectorization, memory layouts
- **Pandas Performance**: `02-pandas-optimization.md` - Query optimization, categorical data
- **Memory Efficiency**: `03-memory-efficient.md` - Chunking, streaming, dtypes

### Production Scale
- **Large Datasets**: `04-large-datasets.md` - Dask, distributed processing, I/O optimization

## 📚 Learning Path

### 1. NumPy Mastery (Foundation)
```yaml
01-numpy-advanced.md:
  understand: Broadcasting rules, memory layout, vectorization
  implement: Custom ufuncs, structured arrays, advanced indexing
  optimize: Memory usage, computation speed
```

### 2. Pandas Optimization
```yaml
02-pandas-optimization.md:
  understand: Query engine, categorical data, groupby optimization
  implement: Vectorized operations, method chaining
  optimize: Memory usage, computation performance
```

### 3. Memory Management
```yaml
03-memory-efficient.md:
  understand: Memory profiling, dtype optimization, chunking
  implement: Streaming processing, generator patterns
  optimize: RAM usage for large datasets
```

### 4. Scale-Out Processing
```yaml
04-large-datasets.md:
  understand: Distributed computing, lazy evaluation, parallel I/O
  implement: Dask workflows, multiprocessing patterns
  scale: Handle datasets larger than RAM
```

## 🔧 Quick Reference

```python
# Memory optimization
df = pd.read_csv('data.csv', dtype={'col': 'category'})
df.memory_usage(deep=True)

# Vectorized operations
np.where(condition, x, y)  # Instead of loops
df.query('column > @threshold')  # Instead of boolean indexing

# Chunked processing
for chunk in pd.read_csv('large.csv', chunksize=10000):
    process_chunk(chunk)

# Dask for large data
import dask.dataframe as dd
ddf = dd.read_csv('*.csv')
result = ddf.groupby('key').value.mean().compute()
```