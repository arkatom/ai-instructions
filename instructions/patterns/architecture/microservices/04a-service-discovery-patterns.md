# Microservices - Service Discoveryパターン

> ロードバランシングとヘルスチェックの実装

## 高度なロードバランシング

```typescript
// shared/infrastructure/load-balancer.ts
export interface LoadBalancer {
  selectInstance(instances: ServiceInstance[]): ServiceInstance;
}

export class RoundRobinLoadBalancer implements LoadBalancer {
  private counters = new Map<string, number>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available');
    }

    const serviceName = instances[0].serviceName;
    const counter = this.counters.get(serviceName) || 0;
    const selectedInstance = instances[counter % instances.length];
    
    this.counters.set(serviceName, counter + 1);
    
    return selectedInstance;
  }
}

export class WeightedRoundRobinLoadBalancer implements LoadBalancer {
  private weightedInstances = new Map<string, WeightedInstance[]>();
  private currentWeights = new Map<string, number[]>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    const serviceName = instances[0].serviceName;
    
    if (!this.weightedInstances.has(serviceName)) {
      this.initializeWeights(serviceName, instances);
    }

    const weightedInstances = this.weightedInstances.get(serviceName)!;
    const currentWeights = this.currentWeights.get(serviceName)!;

    // 重み付きラウンドロビンアルゴリズム
    let maxWeightIndex = 0;
    for (let i = 1; i < currentWeights.length; i++) {
      if (currentWeights[i] > currentWeights[maxWeightIndex]) {
        maxWeightIndex = i;
      }
    }

    // 選択されたインスタンスの現在重みを減算
    const totalWeight = weightedInstances.reduce((sum, wi) => sum + wi.weight, 0);
    currentWeights[maxWeightIndex] -= totalWeight;

    // すべてのインスタンスの現在重みを元の重みだけ加算
    for (let i = 0; i < currentWeights.length; i++) {
      currentWeights[i] += weightedInstances[i].weight;
    }

    return weightedInstances[maxWeightIndex].instance;
  }

  private initializeWeights(serviceName: string, instances: ServiceInstance[]): void {
    const weightedInstances = instances.map(instance => ({
      instance,
      weight: instance.weight || 1
    }));

    const currentWeights = weightedInstances.map(wi => wi.weight);

    this.weightedInstances.set(serviceName, weightedInstances);
    this.currentWeights.set(serviceName, currentWeights);
  }
}

export class LeastConnectionsLoadBalancer implements LoadBalancer {
  private connections = new Map<string, number>();

  selectInstance(instances: ServiceInstance[]): ServiceInstance {
    let minConnections = Infinity;
    let selectedInstance = instances[0];

    for (const instance of instances) {
      const instanceKey = `${instance.host}:${instance.port}`;
      const connections = this.connections.get(instanceKey) || 0;
      
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }

    // 接続数を増加
    const instanceKey = `${selectedInstance.host}:${selectedInstance.port}`;
    this.connections.set(instanceKey, (this.connections.get(instanceKey) || 0) + 1);

    // 一定時間後に接続数を減少
    setTimeout(() => {
      const currentConnections = this.connections.get(instanceKey) || 0;
      this.connections.set(instanceKey, Math.max(0, currentConnections - 1));
    }, 30000); // 30秒後

    return selectedInstance;
  }
}

interface WeightedInstance {
  instance: ServiceInstance;
  weight: number;
}
```

## ヘルスチェック機能

```typescript
// shared/infrastructure/health-checker.ts
export class HealthChecker {
  constructor(
    private httpClient: AxiosInstance,
    private logger: Logger
  ) {}

  async checkInstance(instance: ServiceInstance): Promise<boolean> {
    try {
      const response = await this.httpClient.get(instance.healthCheckUrl, {
        timeout: 5000,
        validateStatus: (status) => status === 200
      });

      const healthData = response.data;
      
      // 詳細ヘルスチェック
      if (this.isDetailedHealthCheck(healthData)) {
        return this.evaluateDetailedHealth(healthData);
      }

      return true;
    } catch (error) {
      this.logger.warn('Health check failed', {
        instanceId: instance.id,
        healthCheckUrl: instance.healthCheckUrl,
        error: error.message
      });
      return false;
    }
  }

  async checkAllInstances(instances: ServiceInstance[]): Promise<Map<string, boolean>> {
    const healthChecks = instances.map(async (instance) => ({
      instanceId: instance.id,
      healthy: await this.checkInstance(instance)
    }));

    const results = await Promise.all(healthChecks);
    const healthMap = new Map<string, boolean>();

    results.forEach(result => {
      healthMap.set(result.instanceId, result.healthy);
    });

    return healthMap;
  }

  private isDetailedHealthCheck(healthData: any): boolean {
    return healthData && 
           typeof healthData === 'object' && 
           'checks' in healthData;
  }

  private evaluateDetailedHealth(healthData: any): boolean {
    const { status, checks } = healthData;

    // 全体ステータスが UP でない場合は不健全
    if (status !== 'UP') {
      return false;
    }

    // 個別チェックの評価
    if (checks && typeof checks === 'object') {
      for (const [checkName, checkResult] of Object.entries(checks)) {
        if (this.isCriticalCheck(checkName) && !this.isCheckHealthy(checkResult)) {
          this.logger.warn('Critical health check failed', { 
            checkName, 
            checkResult 
          });
          return false;
        }
      }
    }

    return true;
  }

  private isCriticalCheck(checkName: string): boolean {
    const criticalChecks = ['database', 'redis', 'essential-service'];
    return criticalChecks.includes(checkName.toLowerCase());
  }

  private isCheckHealthy(checkResult: any): boolean {
    if (typeof checkResult === 'boolean') {
      return checkResult;
    }

    if (typeof checkResult === 'object' && checkResult.status) {
      return checkResult.status === 'UP' || checkResult.status === 'HEALTHY';
    }

    return false;
  }
}
```

## ロードバランシング戦略の選択

### ラウンドロビン
- 各インスタンスに順番にリクエストを分配
- シンプルで予測可能な負荷分散
- インスタンスの性能が均一な場合に適している

### 重み付きラウンドロビン
- インスタンスの性能に応じた重み付け
- より多くのリソースを持つインスタンスに多くのトラフィックを配分
- 異種環境での負荷分散に適している

### 最小接続数
- アクティブな接続数が最も少ないインスタンスを選択
- 長時間接続やWebSocketなどに適している
- リアルタイムの負荷状況を反映