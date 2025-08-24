# Microservices - Service Discovery 運用ベストプラクティス

> 運用チェックリスト、トラブルシューティング、災害復旧、継続的改善

## 概要

Service Discoveryシステムの効果的な運用には、体系的なアプローチと継続的な改善が不可欠です。設計から運用まで各フェーズでのベストプラクティス、トラブルシューティング手法、災害復旧戦略について詳しく説明します。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryモニタリング](./04c-service-discovery-monitoring.md) - モニタリング・運用概要
- [Service Discovery障害処理](./04c1-service-discovery-resilience.md) - 障害処理とフェイルオーバー
- [Service Discovery監視システム](./04c2-service-discovery-monitoring-system.md) - 監視とアラート

## Service Discovery運用チェックリスト

### 1. 設計フェーズ

#### アーキテクチャ設計
- [ ] **サービス間依存関係マップ作成**
  - サービス呼び出し関係の可視化
  - 循環依存の検出と排除
  - 重要サービスの特定（単一障害点の排除）

- [ ] **障害シナリオ分析と対策立案**
  - サービス停止時の影響範囲分析
  - カスケード障害の防止策
  - 部分的なシステム劣化許容レベルの定義

- [ ] **フォールバック戦略の定義**
  - 各サービスのフォールバック優先度設定
  - キャッシュ戦略とTTL設定
  - デフォルトレスポンス定義

- [ ] **モニタリング要件の整理**
  - SLA/SLO/SLI定義
  - アラート閾値の設定
  - ダッシュボード要件の定義

#### 容量計画
- [ ] **予想トラフィック分析**
  - ピーク時のリクエスト数予測
  - サービス発見頻度の最適化
  - レジストリ負荷の見積もり

- [ ] **スケーリング戦略**
  - 水平スケーリングの基準
  - 自動スケーリング設定
  - サービスレジストリの冗長化

### 2. 実装フェーズ

#### 基本機能実装
- [ ] **ヘルスチェックエンドポイント実装**
  - `/health`エンドポイントの標準化
  - 詳細ヘルスチェック（依存サービス確認）
  - ヘルスチェック応答時間最適化（< 1秒）

- [ ] **適切なタイムアウト設定**
  - 接続タイムアウト: 5-10秒
  - 読み取りタイムアウト: 30秒
  - サービス発見タイムアウト: 5秒以下

- [ ] **サーキットブレーカー導入**
  - 失敗閾値設定（5-10回）
  - タイムアウト期間設定（30-60秒）
  - ハーフオープン状態での成功閾値

- [ ] **リトライ機能実装**
  - 指数バックオフ実装
  - 最大リトライ回数制限（3-5回）
  - ジッター追加による雷の群れ効果防止

#### 品質保証
- [ ] **ロギング・メトリクス実装**
  - 構造化ログの実装
  - 重要メトリクスの定義と収集
  - トレーシング情報の追加

- [ ] **テストカバレッジ確保**
  - 単体テスト（90%以上）
  - 統合テスト（障害注入テスト含む）
  - 負荷テスト（予想トラフィックの2倍）

### 3. デプロイフェーズ

#### デプロイ戦略
- [ ] **Blue-Green デプロイ戦略**
  - 本番環境の完全複製
  - 切り替え手順の自動化
  - 瞬時ロールバック機能

- [ ] **カナリアリリース計画**
  - 段階的トラフィック移行（5% → 25% → 50% → 100%）
  - A/Bテスト機能の統合
  - 自動的な異常検知とロールバック

- [ ] **ロールバック手順確認**
  - ワンクリックロールバック機能
  - データベース変更の巻き戻し計画
  - 設定変更の巻き戻し手順

#### 監視・アラート設定
- [ ] **基本監視設定**
  - サービス可用性監視（99.9%目標）
  - レスポンス時間監視（P99 < 500ms）
  - エラー率監視（< 0.1%）

- [ ] **アラート設定**
  - 重要度別通知チャンネル設定
  - エスカレーション手順の定義
  - 時間外対応体制の確立

### 4. 運用フェーズ

#### 日常運用
- [ ] **定期的なヘルスチェック確認**
  - 日次ダッシュボードレビュー
  - 週次トレンド分析
  - 月次容量計画レビュー

- [ ] **パフォーマンス監視とチューニング**
  - クエリパフォーマンス最適化
  - キャッシュヒット率改善
  - ネットワーク遅延最適化

- [ ] **容量計画とスケーリング**
  - リソース使用率監視
  - 成長予測に基づくスケーリング
  - コスト最適化

- [ ] **災害復旧訓練実施**
  - 四半期ごとの訓練実施
  - 様々な障害シナリオでの検証
  - 復旧時間短縮の継続的改善

## トラブルシューティングガイド

### 1. よくある問題と対策

#### 問題: サービス発見に失敗する

```typescript
// デバッグ用のService Discovery診断ツール
export class ServiceDiscoveryDiagnostics {
  constructor(
    private serviceRegistry: ServiceRegistry,
    private logger: Logger
  ) {}

  async diagnose(serviceName: string): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      serviceName,
      timestamp: new Date(),
      checks: []
    };

    // 1. サービス登録状況確認
    await this.checkServiceRegistration(serviceName, report);

    // 2. ネットワーク接続性確認
    await this.checkNetworkConnectivity(serviceName, report);

    // 3. ヘルスチェック確認
    await this.checkHealthEndpoints(serviceName, report);

    // 4. DNS解決確認
    await this.checkDnsResolution(serviceName, report);

    // 5. レジストリ自体の健全性確認
    await this.checkRegistryHealth(report);
    
    return report;
  }

  private async checkServiceRegistration(serviceName: string, report: DiagnosticReport): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const healthyInstances = instances.filter(i => i.status === ServiceStatus.UP);
      
      report.checks.push({
        name: 'service_registration',
        status: instances.length > 0 ? 'PASS' : 'FAIL',
        message: `Found ${instances.length} registered instances (${healthyInstances.length} healthy)`,
        details: instances.map(i => `${i.host}:${i.port} (${i.status})`),
        recommendations: instances.length === 0 ? [
          'Check if service is properly deployed',
          'Verify service registration logic',
          'Check service registry configuration'
        ] : undefined
      });
    } catch (error) {
      report.checks.push({
        name: 'service_registration',
        status: 'ERROR',
        message: `Failed to discover service: ${error.message}`,
        recommendations: [
          'Check service registry connectivity',
          'Verify authentication credentials',
          'Check service registry configuration'
        ]
      });
    }
  }

  private async checkNetworkConnectivity(serviceName: string, report: DiagnosticReport): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const connectivityResults = await Promise.allSettled(
        instances.map(instance => this.testConnection(instance))
      );

      const successfulConnections = connectivityResults.filter(r => r.status === 'fulfilled').length;
      
      report.checks.push({
        name: 'network_connectivity',
        status: successfulConnections > 0 ? 'PASS' : 'FAIL',
        message: `${successfulConnections}/${instances.length} instances are reachable`,
        details: connectivityResults.map((result, index) => 
          `${instances[index].host}:${instances[index].port} - ${result.status === 'fulfilled' ? 'OK' : result.reason}`
        ),
        recommendations: successfulConnections === 0 ? [
          'Check firewall rules',
          'Verify network routing',
          'Check service binding configuration'
        ] : undefined
      });
    } catch (error) {
      report.checks.push({
        name: 'network_connectivity',
        status: 'ERROR',
        message: `Cannot test connectivity: ${error.message}`
      });
    }
  }

  private async testConnection(instance: ServiceInstance): Promise<boolean> {
    try {
      await axios.get(`http://${instance.host}:${instance.port}/health`, {
        timeout: 5000
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkHealthEndpoints(serviceName: string, report: DiagnosticReport): Promise<void> {
    try {
      const instances = await this.serviceRegistry.discover(serviceName);
      const healthResults = await Promise.allSettled(
        instances.map(instance => this.checkInstanceHealth(instance))
      );

      const healthyCount = healthResults.filter(r => 
        r.status === 'fulfilled' && r.value.healthy
      ).length;

      report.checks.push({
        name: 'health_endpoints',
        status: healthyCount > 0 ? 'PASS' : 'FAIL',
        message: `${healthyCount}/${instances.length} instances report healthy`,
        details: healthResults.map((result, index) => {
          const instance = instances[index];
          if (result.status === 'fulfilled') {
            return `${instance.host}:${instance.port} - ${result.value.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${result.value.message})`;
          } else {
            return `${instance.host}:${instance.port} - ERROR: ${result.reason}`;
          }
        }),
        recommendations: healthyCount === 0 ? [
          'Check application health logic',
          'Verify health endpoint implementation',
          'Check dependent services status'
        ] : undefined
      });
    } catch (error) {
      report.checks.push({
        name: 'health_endpoints',
        status: 'ERROR',
        message: `Cannot check health endpoints: ${error.message}`
      });
    }
  }

  private async checkInstanceHealth(instance: ServiceInstance): Promise<{healthy: boolean, message: string}> {
    try {
      const response = await axios.get(instance.healthCheckUrl, { timeout: 5000 });
      return {
        healthy: response.status === 200,
        message: `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  private async checkDnsResolution(serviceName: string, report: DiagnosticReport): Promise<void> {
    // DNS-based Service Discoveryの場合のDNS解決確認
    // 実装は使用するService Discoveryの種類に依存
    report.checks.push({
      name: 'dns_resolution',
      status: 'SKIP',
      message: 'DNS resolution check not applicable for this discovery method'
    });
  }

  private async checkRegistryHealth(report: DiagnosticReport): Promise<void> {
    try {
      // サービスレジストリ自体のヘルスチェック
      // 実装は使用するレジストリによって異なる
      report.checks.push({
        name: 'registry_health',
        status: 'PASS',
        message: 'Service registry is responding normally'
      });
    } catch (error) {
      report.checks.push({
        name: 'registry_health',
        status: 'FAIL',
        message: `Service registry health check failed: ${error.message}`,
        recommendations: [
          'Check service registry cluster status',
          'Verify registry node connectivity',
          'Check registry resource utilization'
        ]
      });
    }
  }
}

interface DiagnosticReport {
  serviceName: string;
  timestamp: Date;
  checks: DiagnosticCheck[];
}

interface DiagnosticCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'ERROR' | 'SKIP';
  message: string;
  details?: string[];
  recommendations?: string[];
}
```

### 2. パフォーマンス問題の分析

```typescript
// パフォーマンス分析ツール
export class ServiceDiscoveryPerformanceAnalyzer {
  constructor(
    private metricsCollector: MetricsCollector,
    private logger: Logger
  ) {}

  async analyzePerformance(serviceName: string, timeRange: TimeRange): Promise<PerformanceAnalysis> {
    const metrics = await this.collectMetrics(serviceName, timeRange);
    
    return {
      serviceName,
      timeRange,
      responseTimeAnalysis: this.analyzeResponseTimes(metrics.responseTimes),
      errorRateAnalysis: this.analyzeErrorRates(metrics.errorRates),
      throughputAnalysis: this.analyzeThroughput(metrics.throughput),
      availabilityAnalysis: this.analyzeAvailability(metrics.availability),
      recommendations: this.generateRecommendations(metrics)
    };
  }

  private analyzeResponseTimes(responseTimes: TimeSeriesData[]): ResponseTimeAnalysis {
    const values = responseTimes.map(d => d.value);
    const p50 = this.calculatePercentile(values, 0.5);
    const p95 = this.calculatePercentile(values, 0.95);
    const p99 = this.calculatePercentile(values, 0.99);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    return {
      average: avg,
      p50,
      p95,
      p99,
      trend: this.calculateTrend(responseTimes),
      status: this.evaluateResponseTimeStatus(p99)
    };
  }

  private generateRecommendations(metrics: ServiceMetrics): string[] {
    const recommendations: string[] = [];

    // レスポンス時間が高い場合
    if (metrics.responseTimes.some(rt => rt.value > 1000)) {
      recommendations.push('Consider implementing response caching');
      recommendations.push('Review database query performance');
      recommendations.push('Check for network latency issues');
    }

    // エラー率が高い場合
    if (metrics.errorRates.some(er => er.value > 0.05)) {
      recommendations.push('Investigate and fix recurring errors');
      recommendations.push('Implement better error handling');
      recommendations.push('Review service dependencies');
    }

    // 可用性が低い場合
    if (metrics.availability.some(a => a.value < 0.99)) {
      recommendations.push('Increase service instance count');
      recommendations.push('Implement better health checks');
      recommendations.push('Review deployment procedures');
    }

    return recommendations;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(percentile * sorted.length);
    return sorted[index] || 0;
  }

  private calculateTrend(data: TimeSeriesData[]): 'improving' | 'stable' | 'degrading' {
    if (data.length < 2) return 'stable';

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'degrading';
    if (changePercent < -10) return 'improving';
    return 'stable';
  }

  private evaluateResponseTimeStatus(p99: number): 'good' | 'warning' | 'critical' {
    if (p99 < 500) return 'good';
    if (p99 < 2000) return 'warning';
    return 'critical';
  }
}
```

### 3. 災害復旧手順

#### 自動復旧プロセス
```bash
#!/bin/bash
# disaster-recovery.sh - Service Discovery災害復旧スクリプト

echo "Starting Service Discovery disaster recovery process..."

# 1. 現在の状況確認
echo "Step 1: Assessing current state..."
kubectl get pods -n microservices | grep service-registry
consul members
echo "Assessment complete."

# 2. バックアップからの復旧
echo "Step 2: Restoring from backup..."
if [ -f "/backup/service-registry-$(date +%Y%m%d).tar.gz" ]; then
    tar -xzf "/backup/service-registry-$(date +%Y%m%d).tar.gz" -C /var/lib/consul
    echo "Backup restored successfully."
else
    echo "WARNING: No recent backup found. Proceeding with cluster rebuild."
fi

# 3. クラスター再構築
echo "Step 3: Rebuilding cluster..."
kubectl scale deployment service-registry --replicas=3 -n microservices
kubectl rollout status deployment/service-registry -n microservices

# 4. ヘルスチェック
echo "Step 4: Performing health checks..."
for i in {1..10}; do
    if curl -s http://service-registry:8500/v1/status/leader; then
        echo "Health check passed."
        break
    else
        echo "Health check failed. Retrying in 30 seconds..."
        sleep 30
    fi
done

# 5. サービス再登録
echo "Step 5: Re-registering services..."
kubectl annotate pods -n microservices service-discovery-restart="$(date)"

echo "Disaster recovery process completed."
```

## 継続的改善

### 1. パフォーマンス最適化

- **定期的なベンチマーク実施**
  - 月次パフォーマンステスト
  - キャパシティプランニング
  - ボトルネック特定と解消

- **メトリクス駆動の改善**
  - SLI/SLOの継続的見直し
  - ユーザー体験指標の追跡
  - ビジネス指標との関連分析

### 2. 運用プロセス改善

- **インシデント事後分析**
  - 根本原因分析（RCA）実施
  - 改善策の継続的実装
  - チーム学習の促進

- **自動化の拡大**
  - 手作業プロセスの特定と自動化
  - デプロイメントの完全自動化
  - 復旧プロセスの自動化

### 3. チーム能力向上

- **定期的な訓練実施**
  - 災害復旧訓練
  - 新技術の導入訓練
  - チーム間の知識共有

- **ドキュメントの継続的更新**
  - 運用手順書の定期見直し
  - トラブルシューティングガイドの更新
  - ベストプラクティスの共有

Service Discoveryの効果的な運用により、マイクロサービス環境の信頼性と可用性を大幅に向上させ、継続的な改善を実現できます。