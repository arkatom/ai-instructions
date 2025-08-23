# Performance Optimization

## Query Performance Optimization

```typescript
class QueryOptimizer {
  private queryCache: LRUCache<string, any>;
  private queryPlanner: QueryPlanner;

  constructor(cacheSize: number = 1000) {
    this.queryCache = new LRUCache({ max: cacheSize });
    this.queryPlanner = new QueryPlanner();
  }

  async optimizeQuery<T>(query: Query): Promise<T> {
    // Check cache first
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && !this.isStale(cached)) {
      return cached.data;
    }

    // Optimize query execution
    const optimizedQuery = this.queryPlanner.optimize(query);
    const result = await this.executeOptimized(optimizedQuery);
    
    // Cache result
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  private async executeOptimized(query: OptimizedQuery): Promise<any> {
    // Use parallel execution for independent sub-queries
    if (query.parallelizable) {
      const results = await Promise.all(
        query.subQueries.map(sq => this.executeSubQuery(sq))
      );
      return this.mergeResults(results);
    }

    // Use indexed access
    if (query.useIndex) {
      return this.executeWithIndex(query);
    }

    // Default execution
    return this.executeDefault(query);
  }
}
```

## Command Processing Optimization

```typescript
class CommandBatchProcessor {
  private batchQueue: Command[] = [];
  private batchSize: number = 100;
  private flushInterval: number = 100; // ms

  constructor(private commandBus: CommandBus) {
    this.startBatchProcessor();
  }

  async enqueue(command: Command): Promise<void> {
    this.batchQueue.push(command);
    
    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.batchSize);
    
    // Process commands in parallel where possible
    const groups = this.groupByAggregate(batch);
    
    await Promise.all(
      Object.entries(groups).map(([aggregateId, commands]) =>
        this.processAggregateCommands(aggregateId, commands)
      )
    );
  }

  private groupByAggregate(commands: Command[]): Record<string, Command[]> {
    return commands.reduce((groups, cmd) => {
      const key = cmd.aggregateId;
      groups[key] = groups[key] || [];
      groups[key].push(cmd);
      return groups;
    }, {} as Record<string, Command[]>);
  }

  private async processAggregateCommands(
    aggregateId: string,
    commands: Command[]
  ): Promise<void> {
    // Process commands for same aggregate sequentially
    for (const command of commands) {
      await this.commandBus.send(command);
    }
  }

  private startBatchProcessor(): void {
    setInterval(() => this.flush(), this.flushInterval);
  }
}
```

## Read Model Optimization

```typescript
class OptimizedReadModelProjector {
  private projectionBuffer: Map<string, DomainEvent[]> = new Map();
  private bufferSize: number = 1000;

  async project(event: DomainEvent): Promise<void> {
    // Buffer events for batch processing
    const key = event.aggregateId;
    
    if (!this.projectionBuffer.has(key)) {
      this.projectionBuffer.set(key, []);
    }
    
    this.projectionBuffer.get(key)!.push(event);
    
    // Flush when buffer is full
    if (this.getTotalBufferedEvents() >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    const bulkOperations: BulkOperation[] = [];
    
    for (const [aggregateId, events] of this.projectionBuffer) {
      const operations = this.createBulkOperations(aggregateId, events);
      bulkOperations.push(...operations);
    }
    
    // Execute all operations in single batch
    await this.executeBulk(bulkOperations);
    
    // Clear buffer
    this.projectionBuffer.clear();
  }

  private createBulkOperations(
    aggregateId: string,
    events: DomainEvent[]
  ): BulkOperation[] {
    return events.map(event => ({
      type: 'upsert',
      collection: 'read_models',
      filter: { aggregateId },
      update: this.createUpdateFromEvent(event),
      options: { upsert: true }
    }));
  }
}
```

## Caching Strategy

```typescript
class MultiTierCache {
  private l1Cache: InMemoryCache;  // Hot data
  private l2Cache: RedisCache;     // Warm data
  private l3Cache: CDNCache;       // Static data

  async get(key: string): Promise<any> {
    // Try L1 cache (microseconds)
    let value = await this.l1Cache.get(key);
    if (value) return value;

    // Try L2 cache (milliseconds)
    value = await this.l2Cache.get(key);
    if (value) {
      await this.l1Cache.set(key, value, 60); // Promote to L1
      return value;
    }

    // Try L3 cache (network latency)
    value = await this.l3Cache.get(key);
    if (value) {
      await this.promoteToUpperTiers(key, value);
      return value;
    }

    return null;
  }

  private async promoteToUpperTiers(key: string, value: any): Promise<void> {
    await Promise.all([
      this.l2Cache.set(key, value, 300),  // 5 minutes in L2
      this.l1Cache.set(key, value, 60)    // 1 minute in L1
    ]);
  }
}

// Intelligent cache invalidation
class CacheInvalidator {
  constructor(
    private cache: MultiTierCache,
    private dependencyTracker: DependencyTracker
  ) {}

  async invalidate(event: DomainEvent): Promise<void> {
    // Get affected cache keys
    const affectedKeys = await this.dependencyTracker.getAffectedKeys(event);
    
    // Invalidate in parallel
    await Promise.all(
      affectedKeys.map(key => this.cache.invalidate(key))
    );
  }
}
```

## Scaling Strategies

```typescript
class CQRSScaler {
  async scaleReadSide(metrics: PerformanceMetrics): Promise<void> {
    if (metrics.queryLatencyP99 > 100) {
      // Add read replicas
      await this.addReadReplica();
    }

    if (metrics.cacheHitRate < 0.8) {
      // Increase cache size
      await this.increaseCacheSize();
    }
  }

  async scaleWriteSide(metrics: PerformanceMetrics): Promise<void> {
    if (metrics.commandQueueDepth > 1000) {
      // Add command processors
      await this.addCommandProcessor();
    }

    if (metrics.eventStoreLatency > 50) {
      // Partition event store
      await this.partitionEventStore();
    }
  }

  private async addReadReplica(): Promise<void> {
    // Implementation for adding database read replica
    console.log('Adding read replica');
  }

  private async partitionEventStore(): Promise<void> {
    // Implementation for event store partitioning
    console.log('Partitioning event store');
  }
}
```

## Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics: MetricsCollector;

  trackQueryPerformance(query: Query, duration: number): void {
    this.metrics.histogram('query.duration', duration, {
      type: query.type,
      complexity: this.calculateComplexity(query)
    });
  }

  trackCommandPerformance(command: Command, duration: number): void {
    this.metrics.histogram('command.duration', duration, {
      type: command.type
    });
  }

  trackProjectionLag(projectionName: string, lag: number): void {
    this.metrics.gauge('projection.lag', lag, {
      projection: projectionName
    });
  }
}
```

## Best Practices

1. **Batch Processing**: Group operations for better throughput
2. **Caching**: Implement multi-tier caching strategy
3. **Async Processing**: Use asynchronous command processing
4. **Connection Pooling**: Optimize database connections
5. **Index Optimization**: Create appropriate indexes for queries
6. **Monitoring**: Track key performance metrics continuously