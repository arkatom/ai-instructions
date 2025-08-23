# Query Handlers

## Query Bus Implementation

```typescript
interface QueryBus {
  ask<TQuery extends Query, TResult>(query: TQuery): Promise<TResult>;
  register<TQuery extends Query, TResult>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void;
}

class InMemoryQueryBus implements QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();
  private middleware: QueryMiddleware[] = [];

  register<TQuery extends Query, TResult>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for ${queryType}`);
    }
    this.handlers.set(queryType, handler);
  }

  async ask<TQuery extends Query, TResult>(query: TQuery): Promise<TResult> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for ${query.type}`);
    }

    // Execute middleware pipeline
    const pipeline = this.buildPipeline(handler, query);
    return pipeline(query);
  }

  use(middleware: QueryMiddleware): void {
    this.middleware.push(middleware);
  }

  private buildPipeline<TQuery extends Query, TResult>(
    handler: QueryHandler<TQuery, TResult>,
    query: TQuery
  ): (q: TQuery) => Promise<TResult> {
    let pipeline = (q: TQuery) => handler.handle(q);

    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const middleware = this.middleware[i];
      const next = pipeline;
      pipeline = (q: TQuery) => middleware.execute(q, next);
    }

    return pipeline;
  }
}
```

## Query Optimization Patterns

```typescript
// Query optimizer
class QueryOptimizer {
  constructor(
    private queryPlanner: QueryPlanner,
    private statsCollector: StatsCollector
  ) {}

  optimize(query: Query): OptimizedQuery {
    const stats = this.statsCollector.getStats(query.type);
    const plan = this.queryPlanner.createPlan(query, stats);
    
    return {
      ...query,
      executionPlan: plan,
      hints: this.generateHints(plan, stats)
    };
  }

  private generateHints(plan: QueryPlan, stats: QueryStats): QueryHints {
    return {
      useIndex: plan.suggestedIndexes,
      parallelism: stats.averageRows > 10000 ? 4 : 1,
      fetchSize: Math.min(stats.averageRows, 1000),
      timeout: stats.p95Duration * 2
    };
  }
}

// Complex query handler
class ComplexQueryHandler<T extends ComplexQuery> implements QueryHandler<T, any> {
  constructor(
    private queryBuilder: QueryBuilder,
    private database: Database
  ) {}

  async handle(query: T): Promise<any> {
    const sql = this.queryBuilder
      .select(query.fields)
      .from(query.table)
      .where(query.conditions)
      .orderBy(query.sorting)
      .limit(query.pagination.limit)
      .offset(query.pagination.offset)
      .build();

    const result = await this.database.query(sql, query.parameters);
    
    return {
      data: result.rows,
      total: await this.getTotalCount(query),
      page: query.pagination.page,
      pageSize: query.pagination.limit
    };
  }

  private async getTotalCount(query: T): Promise<number> {
    const countSql = this.queryBuilder
      .select('COUNT(*) as total')
      .from(query.table)
      .where(query.conditions)
      .build();

    const result = await this.database.query(countSql, query.parameters);
    return result.rows[0].total;
  }
}
```

## Caching Strategies

```typescript
// Cache-aware query handler
class CachedQueryHandler<TQuery extends Query, TResult> 
  implements QueryHandler<TQuery, TResult> {
  
  constructor(
    private innerHandler: QueryHandler<TQuery, TResult>,
    private cache: Cache,
    private cacheKeyGenerator: CacheKeyGenerator,
    private ttl: number = 300 // 5 minutes default
  ) {}

  async handle(query: TQuery): Promise<TResult> {
    const cacheKey = this.cacheKeyGenerator.generate(query);
    
    // Try to get from cache
    const cached = await this.cache.get<TResult>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await this.innerHandler.handle(query);
    await this.cache.set(cacheKey, result, this.ttl);
    
    return result;
  }
}

// Multi-level caching
class MultiLevelCache implements Cache {
  constructor(
    private l1Cache: InMemoryCache,
    private l2Cache: RedisCache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // Check L1 cache first
    let value = await this.l1Cache.get<T>(key);
    if (value !== null) {
      return value;
    }

    // Check L2 cache
    value = await this.l2Cache.get<T>(key);
    if (value !== null) {
      // Promote to L1 cache
      await this.l1Cache.set(key, value, 60); // 1 minute in L1
      return value;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, 60)),
      this.l2Cache.set(key, value, ttl)
    ]);
  }

  async invalidate(pattern: string): Promise<void> {
    await Promise.all([
      this.l1Cache.invalidate(pattern),
      this.l2Cache.invalidate(pattern)
    ]);
  }
}
```

## Query Composition

```typescript
// Composite query handler
class CompositeQueryHandler implements QueryHandler<CompositeQuery, CompositeResult> {
  constructor(
    private queryBus: QueryBus,
    private aggregator: ResultAggregator
  ) {}

  async handle(query: CompositeQuery): Promise<CompositeResult> {
    // Execute sub-queries in parallel
    const results = await Promise.all(
      query.subQueries.map(subQuery => 
        this.queryBus.ask(subQuery)
      )
    );

    // Aggregate results
    return this.aggregator.aggregate(results, query.aggregationStrategy);
  }
}

// GraphQL-style query resolver
class GraphQLQueryResolver {
  constructor(
    private fieldResolvers: Map<string, FieldResolver>,
    private dataLoader: DataLoader
  ) {}

  async resolve(query: GraphQLQuery): Promise<any> {
    const result: any = {};

    for (const field of query.fields) {
      if (field.subFields) {
        // Resolve nested fields
        result[field.name] = await this.resolveNested(field);
      } else {
        // Resolve scalar field
        const resolver = this.fieldResolvers.get(field.name);
        if (resolver) {
          result[field.name] = await resolver.resolve(query.context);
        }
      }
    }

    return result;
  }

  private async resolveNested(field: Field): Promise<any> {
    // Use DataLoader for N+1 query prevention
    const ids = await this.getIds(field);
    return this.dataLoader.loadMany(ids);
  }
}
```

## Performance Monitoring

```typescript
// Query performance tracker
class QueryPerformanceTracker implements QueryMiddleware {
  constructor(
    private metrics: MetricsCollector,
    private slowQueryThreshold: number = 1000 // 1 second
  ) {}

  async execute<T>(
    query: Query,
    next: (query: Query) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = this.metrics.startTimer('query.duration', {
      type: query.type
    });

    try {
      const result = await next(query);
      const duration = Date.now() - startTime;
      
      timer.end();
      this.metrics.increment('query.success', { type: query.type });
      
      if (duration > this.slowQueryThreshold) {
        this.logSlowQuery(query, duration);
      }
      
      return result;
    } catch (error) {
      timer.end();
      this.metrics.increment('query.failure', { type: query.type });
      throw error;
    }
  }

  private logSlowQuery(query: Query, duration: number): void {
    console.warn('Slow query detected', {
      type: query.type,
      duration,
      parameters: query.parameters,
      timestamp: new Date()
    });
  }
}
```

## Query Result Transformation

```typescript
// Result mapper
class QueryResultMapper<TRaw, TDto> {
  constructor(
    private mappingRules: MappingRule<TRaw, TDto>[]
  ) {}

  map(raw: TRaw): TDto {
    const result = {} as TDto;
    
    for (const rule of this.mappingRules) {
      const value = rule.extract(raw);
      rule.assign(result, value);
    }
    
    return result;
  }

  mapMany(raws: TRaw[]): TDto[] {
    return raws.map(raw => this.map(raw));
  }
}

// Pagination wrapper
class PaginatedQueryHandler<T> implements QueryHandler<PaginatedQuery, PaginatedResult<T>> {
  constructor(private innerHandler: QueryHandler<any, T[]>) {}

  async handle(query: PaginatedQuery): Promise<PaginatedResult<T>> {
    const [data, total] = await Promise.all([
      this.innerHandler.handle(query),
      this.getTotalCount(query)
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    };
  }

  private async getTotalCount(query: PaginatedQuery): Promise<number> {
    // Implementation specific to data source
    return 0;
  }
}
```

## Best Practices

1. **Query Optimization**: Use appropriate indexes and query plans
2. **Caching**: Implement multi-level caching for frequently accessed data
3. **Pagination**: Always paginate large result sets
4. **N+1 Prevention**: Use DataLoader or similar patterns
5. **Monitoring**: Track query performance and identify bottlenecks
6. **Testing**: Test queries with realistic data volumes