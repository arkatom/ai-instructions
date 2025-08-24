# Microservices - トランザクションコーディネーション

> 分散ロック、デッドロック検出、モニタリングの実装

## 概要

分散トランザクション環境では、リーダー選出、分散ロック、デッドロック検出、包括的なモニタリングが不可欠です。これらの高度な機能を実装し、堅牢なシステムを構築します。

## 関連ファイル
- [トランザクションパターン](./05-transaction-patterns.md) - 基本的なトランザクションパターン
- [Sagaパターン](./06-saga-pattern.md) - Sagaパターンの実装詳細
- [Event Sourcing](./07-event-sourcing.md) - イベントソーシングとトランザクション管理

## 分散ロックとリーダー選出

### 1. 分散ロック実装

```typescript
// shared/infrastructure/distributed-lock.ts
export class DistributedLock {
  private lockId: string;
  private renewalInterval?: NodeJS.Timeout;
  
  constructor(
    private redis: Redis,
    private lockKey: string,
    private ttl: number = 30000 // 30秒
  ) {
    this.lockId = crypto.randomUUID();
  }

  async acquire(): Promise<boolean> {
    const result = await this.redis.set(
      this.lockKey,
      this.lockId,
      'PX', // TTLをミリ秒で設定
      this.ttl,
      'NX' // キーが存在しない場合のみ設定
    );

    if (result === 'OK') {
      // ロック取得成功
      this.scheduleRenewal();
      return true;
    }

    return false;
  }

  async release(): Promise<void> {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = undefined;
    }

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, this.lockKey, this.lockId);
  }

  async extend(additionalTime: number = this.ttl): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(
      script, 
      1, 
      this.lockKey, 
      this.lockId, 
      additionalTime
    );
    
    return result === 1;
  }

  private scheduleRenewal(): void {
    const renewInterval = this.ttl / 3; // TTLの1/3間隔で更新

    this.renewalInterval = setInterval(async () => {
      try {
        const extended = await this.extend();
        
        if (!extended) {
          // ロックが失われた
          console.warn(`Lock lost for key: ${this.lockKey}`);
          if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = undefined;
          }
        }
      } catch (error) {
        console.error('Lock renewal failed:', error);
        if (this.renewalInterval) {
          clearInterval(this.renewalInterval);
          this.renewalInterval = undefined;
        }
      }
    }, renewInterval);
  }
}

// ロックマネージャー
export class LockManager {
  private locks = new Map<string, DistributedLock>();

  constructor(private redis: Redis) {}

  async acquireLock(
    resource: string, 
    ttl: number = 30000,
    timeout: number = 10000
  ): Promise<DistributedLock | null> {
    const lockKey = `lock:${resource}`;
    const lock = new DistributedLock(this.redis, lockKey, ttl);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await lock.acquire()) {
        this.locks.set(resource, lock);
        return lock;
      }
      
      // 指数バックオフで再試行
      const backoff = Math.min(1000, 100 * Math.pow(2, Math.random()));
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
    
    return null; // タイムアウト
  }

  async releaseLock(resource: string): Promise<void> {
    const lock = this.locks.get(resource);
    if (lock) {
      await lock.release();
      this.locks.delete(resource);
    }
  }

  async releaseAllLocks(): Promise<void> {
    const releasePromises = Array.from(this.locks.entries()).map(
      async ([resource, lock]) => {
        try {
          await lock.release();
        } catch (error) {
          console.error(`Failed to release lock for ${resource}:`, error);
        }
      }
    );
    
    await Promise.all(releasePromises);
    this.locks.clear();
  }
}
```

### 2. Saga実行におけるデッドロック検出

```typescript
// shared/patterns/deadlock-detector.ts
export class SagaDeadlockDetector {
  private dependencyGraph = new Map<string, Set<string>>();
  
  constructor(
    private sagaRepository: SagaRepository,
    private logger: Logger
  ) {}

  async detectDeadlock(): Promise<DeadlockResult> {
    await this.buildDependencyGraph();
    const cycles = this.findCycles();
    
    return {
      hasDeadlock: cycles.length > 0,
      cycles,
      affectedSagas: this.getAffectedSagas(cycles)
    };
  }

  private async buildDependencyGraph(): Promise<void> {
    this.dependencyGraph.clear();
    
    const activeSagas = await this.sagaRepository.findActiveSagas();
    
    for (const saga of activeSagas) {
      const dependencies = await this.getSagaDependencies(saga);
      this.dependencyGraph.set(saga.id, new Set(dependencies));
    }
  }

  private async getSagaDependencies(saga: SagaRecord): Promise<string[]> {
    const dependencies: string[] = [];
    
    // リソースロックに基づく依存関係を分析
    const lockedResources = await this.getLockedResources(saga.id);
    
    for (const resource of lockedResources) {
      const otherSagas = await this.getSagasWaitingForResource(resource, saga.id);
      dependencies.push(...otherSagas);
    }
    
    return dependencies;
  }

  private findCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    for (const [sagaId] of this.dependencyGraph) {
      if (!visited.has(sagaId)) {
        this.findCyclesDFS(sagaId, visited, recursionStack, cycles, []);
      }
    }

    return cycles;
  }

  private findCyclesDFS(
    sagaId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    cycles: string[][],
    currentPath: string[]
  ): boolean {
    visited.add(sagaId);
    recursionStack.add(sagaId);
    currentPath.push(sagaId);

    const dependencies = this.dependencyGraph.get(sagaId) || new Set();

    for (const dependentSaga of dependencies) {
      if (!visited.has(dependentSaga)) {
        if (this.findCyclesDFS(dependentSaga, visited, recursionStack, cycles, currentPath)) {
          return true;
        }
      } else if (recursionStack.has(dependentSaga)) {
        // サイクル検出
        const cycleStartIndex = currentPath.indexOf(dependentSaga);
        const cycle = currentPath.slice(cycleStartIndex).concat([dependentSaga]);
        cycles.push(cycle);
        
        this.logger.warn('Deadlock detected', { cycle });
        return true;
      }
    }

    recursionStack.delete(sagaId);
    currentPath.pop();
    return false;
  }

  async resolveDeadlock(cycles: string[][]): Promise<void> {
    for (const cycle of cycles) {
      // 最も優先度の低いSagaを中止
      const sagaToAbort = await this.selectSagaToAbort(cycle);
      
      if (sagaToAbort) {
        await this.abortSaga(sagaToAbort);
        this.logger.info('Saga aborted to resolve deadlock', { 
          abortedSaga: sagaToAbort,
          cycle 
        });
      }
    }
  }

  private async selectSagaToAbort(sagaIds: string[]): Promise<string | null> {
    const sagas = await Promise.all(
      sagaIds.map(id => this.sagaRepository.findById(id))
    );

    // 優先度が最も低く、実行時間が最も短いSagaを選択
    let selectedSaga: SagaRecord | null = null;
    let minPriority = Infinity;
    let minRuntime = Infinity;

    for (const saga of sagas) {
      if (!saga) continue;

      const runtime = Date.now() - saga.createdAt.getTime();
      const priority = saga.priority || 0;

      if (priority < minPriority || (priority === minPriority && runtime < minRuntime)) {
        minPriority = priority;
        minRuntime = runtime;
        selectedSaga = saga;
      }
    }

    return selectedSaga?.id || null;
  }

  private async abortSaga(sagaId: string): Promise<void> {
    // Sagaを中止し、補償処理を実行
    const saga = await this.sagaRepository.findById(sagaId);
    if (saga) {
      saga.status = SagaStatus.FAILED;
      saga.error = 'Aborted due to deadlock resolution';
      await this.sagaRepository.save(saga);
    }
  }

  private async getLockedResources(sagaId: string): Promise<string[]> {
    // Sagaがロックしているリソースを取得
    // 実装はロックシステムに依存
    return [];
  }

  private async getSagasWaitingForResource(
    resource: string, 
    excludeSagaId: string
  ): Promise<string[]> {
    // リソースを待機しているSagaを取得
    return [];
  }

  private getAffectedSagas(cycles: string[][]): string[] {
    const affectedSagas = new Set<string>();
    cycles.forEach(cycle => {
      cycle.forEach(sagaId => affectedSagas.add(sagaId));
    });
    return Array.from(affectedSagas);
  }
}

interface DeadlockResult {
  hasDeadlock: boolean;
  cycles: string[][];
  affectedSagas: string[];
}
```

## 分散トランザクション監視

### 1. Sagaモニタリング

```typescript
// shared/monitoring/saga-monitor.ts
export class SagaMonitor {
  constructor(
    private sagaRepository: SagaRepository,
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager,
    private deadlockDetector: SagaDeadlockDetector
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.monitorSagaHealth();
      await this.detectStuckSagas();
      await this.detectDeadlocks();
      await this.collectMetrics();
    }, 30000); // 30秒間隔
  }

  private async monitorSagaHealth(): Promise<void> {
    const activeSagas = await this.sagaRepository.findActiveSagas();
    
    for (const saga of activeSagas) {
      const runtime = Date.now() - saga.createdAt.getTime();
      const maxExpectedRuntime = this.getMaxExpectedRuntime(saga.type);
      
      if (runtime > maxExpectedRuntime) {
        await this.alertManager.send({
          severity: 'warning',
          summary: `Long-running saga detected: ${saga.type}`,
          description: `Saga ${saga.id} has been running for ${runtime}ms`,
          metadata: {
            sagaId: saga.id,
            sagaType: saga.type,
            runtime,
            status: saga.status
          }
        });
      }
    }
  }

  private async detectStuckSagas(): Promise<void> {
    const stuckSagas = await this.sagaRepository.findStuckSagas();
    
    for (const saga of stuckSagas) {
      await this.alertManager.send({
        severity: 'critical',
        summary: `Stuck saga detected: ${saga.type}`,
        description: `Saga ${saga.id} appears to be stuck in ${saga.status} status`,
        metadata: {
          sagaId: saga.id,
          sagaType: saga.type,
          status: saga.status,
          lastUpdated: saga.updatedAt,
          stuckDuration: Date.now() - saga.updatedAt.getTime()
        }
      });
      
      // スタックしたSagaの自動復旧を試みる
      await this.attemptSagaRecovery(saga);
    }
  }

  private async detectDeadlocks(): Promise<void> {
    const deadlockResult = await this.deadlockDetector.detectDeadlock();
    
    if (deadlockResult.hasDeadlock) {
      await this.alertManager.send({
        severity: 'critical',
        summary: 'Deadlock detected in saga execution',
        description: `Detected ${deadlockResult.cycles.length} deadlock cycles involving ${deadlockResult.affectedSagas.length} sagas`,
        metadata: {
          cycles: deadlockResult.cycles,
          affectedSagas: deadlockResult.affectedSagas
        }
      });
      
      // デッドロックの解決を試みる
      await this.deadlockDetector.resolveDeadlock(deadlockResult.cycles);
    }
  }

  private async collectMetrics(): Promise<void> {
    const metrics = await this.calculateSagaMetrics();
    
    this.metricsCollector.recordGauge('sagas_active_total', metrics.activeCount);
    this.metricsCollector.recordGauge('sagas_completed_total', metrics.completedCount);
    this.metricsCollector.recordGauge('sagas_failed_total', metrics.failedCount);
    this.metricsCollector.recordHistogram('saga_duration_seconds', metrics.averageDuration);
    this.metricsCollector.recordGauge('saga_success_rate', metrics.successRate);
    this.metricsCollector.recordGauge('sagas_stuck_total', metrics.stuckCount);
  }

  private async calculateSagaMetrics(): Promise<SagaMetrics> {
    const stats = await this.sagaRepository.getStatistics();
    const stuckSagas = await this.sagaRepository.findStuckSagas();
    
    return {
      activeCount: stats.active,
      completedCount: stats.completed,
      failedCount: stats.failed,
      stuckCount: stuckSagas.length,
      averageDuration: stats.averageDuration,
      successRate: stats.completed / (stats.completed + stats.failed)
    };
  }

  private async attemptSagaRecovery(saga: SagaRecord): Promise<void> {
    try {
      // 1. Sagaの現在状態を確認
      const currentState = await this.sagaRepository.findById(saga.id);
      if (!currentState || currentState.status !== saga.status) {
        return; // 既に変更されている
      }
      
      // 2. 最後のステップを再実行できるかチェック
      const canRetry = await this.canRetryLastStep(saga);
      if (canRetry) {
        await this.retryLastStep(saga);
        return;
      }
      
      // 3. 補償処理でロールバック
      await this.compensateSaga(saga);
      
    } catch (error) {
      console.error(`Saga recovery failed for ${saga.id}:`, error);
      
      await this.alertManager.send({
        severity: 'critical',
        summary: 'Saga recovery failed',
        description: `Failed to recover stuck saga ${saga.id}`,
        metadata: {
          sagaId: saga.id,
          error: error.message
        }
      });
    }
  }

  private async canRetryLastStep(saga: SagaRecord): Promise<boolean> {
    // 再試行可能なステップかどうかを判定
    return saga.retryCount < 3; // 最大3回まで再試行
  }

  private async retryLastStep(saga: SagaRecord): Promise<void> {
    // 最後のステップを再試行
    saga.retryCount = (saga.retryCount || 0) + 1;
    saga.status = SagaStatus.EXECUTING;
    saga.updatedAt = new Date();
    await this.sagaRepository.save(saga);
  }

  private async compensateSaga(saga: SagaRecord): Promise<void> {
    // 補償処理でロールバック
    saga.status = SagaStatus.COMPENSATING;
    saga.updatedAt = new Date();
    await this.sagaRepository.save(saga);
  }

  private getMaxExpectedRuntime(sagaType: string): number {
    const timeouts = {
      'CreateOrderSaga': 5 * 60 * 1000, // 5分
      'ProcessRefundSaga': 10 * 60 * 1000, // 10分
      'UserRegistrationSaga': 2 * 60 * 1000 // 2分
    };
    
    return timeouts[sagaType] || 5 * 60 * 1000; // デフォルト5分
  }
}

interface SagaMetrics {
  activeCount: number;
  completedCount: number;
  failedCount: number;
  stuckCount: number;
  averageDuration: number;
  successRate: number;
}
```

### 2. パフォーマンスメトリクス

```typescript
// shared/monitoring/transaction-metrics.ts
export class TransactionMetricsCollector {
  private distributedTransactionHistogram: Histogram;
  private sagaExecutionHistogram: Histogram;
  private compensationCounter: Counter;
  private deadlockCounter: Counter;

  constructor(private metricsRegistry: MetricsRegistry) {
    this.setupMetrics();
  }

  private setupMetrics(): void {
    this.distributedTransactionHistogram = this.metricsRegistry.createHistogram({
      name: 'distributed_transaction_duration_seconds',
      help: 'Duration of distributed transactions',
      labelNames: ['transaction_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
    });

    this.sagaExecutionHistogram = this.metricsRegistry.createHistogram({
      name: 'saga_execution_duration_seconds',
      help: 'Duration of saga execution',
      labelNames: ['saga_type', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300]
    });

    this.compensationCounter = this.metricsRegistry.createCounter({
      name: 'saga_compensations_total',
      help: 'Total number of saga compensations',
      labelNames: ['saga_type', 'step', 'reason']
    });

    this.deadlockCounter = this.metricsRegistry.createCounter({
      name: 'deadlocks_detected_total',
      help: 'Total number of deadlocks detected',
      labelNames: ['resolution_method']
    });
  }

  recordDistributedTransaction(
    transactionType: string,
    status: 'success' | 'failure',
    duration: number
  ): void {
    this.distributedTransactionHistogram
      .labels(transactionType, status)
      .observe(duration / 1000);
  }

  recordSagaExecution(
    sagaType: string,
    status: 'completed' | 'failed' | 'compensated',
    duration: number
  ): void {
    this.sagaExecutionHistogram
      .labels(sagaType, status)
      .observe(duration / 1000);
  }

  recordCompensation(
    sagaType: string,
    step: string,
    reason: string
  ): void {
    this.compensationCounter
      .labels(sagaType, step, reason)
      .inc();
  }

  recordDeadlock(resolutionMethod: 'abort_saga' | 'timeout' | 'manual'): void {
    this.deadlockCounter
      .labels(resolutionMethod)
      .inc();
  }
}
```

これらの高度なコーディネーション機能により、分散トランザクション環境でも安定したシステム運用を実現できます。適切な監視、アラート、自動復旧機能を組み合わせ、堅牢なマイクロサービスアーキテクチャを構築しましょう。