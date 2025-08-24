# Microservices - ログ分析基礎

> Grafanaダッシュボード、基本統計、ログクエリ実装

## 概要

マイクロサービス環境でのログ分析の基礎となるダッシュボード設定、基本的な統計分析、効率的なクエリ実装について学習します。Grafana、Kibana、基本的なパフォーマンス分析の実装方法を詳しく説明します。

## 関連ファイル
- [構造化ログ](./15-structured-logging.md) - 統一ログ形式とビジネスイベント記録
- [ログ集約](./16-log-aggregation.md) - ログ収集とアラートシステム
- [ログ異常検知](./18-log-anomaly-detection.md) - 高度な異常検知とレポート生成

## ダッシュボード設定

### 1. Grafanaダッシュボード

```json
{
  "dashboard": {
    "title": "Microservices Logs Dashboard",
    "tags": ["microservices", "logs"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Log Volume by Service",
        "type": "graph",
        "targets": [
          {
            "query": "service:* | stats count by service",
            "legendFormat": "{{service}}"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        }
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "query": "level:error | stats count",
            "legendFormat": "Errors"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        }
      },
      {
        "title": "Log Levels Distribution",
        "type": "piechart",
        "targets": [
          {
            "query": "* | stats count by level"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        }
      },
      {
        "title": "Recent Errors",
        "type": "logs",
        "targets": [
          {
            "query": "level:error | sort @timestamp desc | limit 100"
          }
        ],
        "gridPos": {
          "h": 12,
          "w": 24,
          "x": 0,
          "y": 16
        }
      },
      {
        "title": "Response Time Distribution",
        "type": "heatmap",
        "targets": [
          {
            "query": "performance:true | stats avg(duration) by bin(@timestamp, 1m)"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 24,
          "x": 0,
          "y": 28
        }
      }
    ]
  }
}
```

### 2. Kibanaダッシュボード設定

```json
{
  "version": "7.10.0",
  "objects": [
    {
      "type": "dashboard",
      "id": "microservices-logs-overview",
      "attributes": {
        "title": "Microservices Logs Overview",
        "type": "dashboard",
        "description": "Overview of microservices log analysis",
        "panelsJSON": "[{\"version\":\"7.10.0\",\"gridData\":{\"x\":0,\"y\":0,\"w\":24,\"h\":15},\"panelIndex\":\"1\",\"embeddableConfig\":{},\"panelRefName\":\"panel_1\"}]",
        "optionsJSON": "{\"useMargins\":true,\"syncColors\":false,\"hidePanelTitles\":false}",
        "version": 1,
        "timeRestore": false,
        "kibanaSavedObjectMeta": {
          "searchSourceJSON": "{\"query\":{\"query\":\"\",\"language\":\"kuery\"},\"filter\":[]}"
        }
      },
      "references": [
        {
          "name": "panel_1",
          "type": "visualization",
          "id": "log-volume-visualization"
        }
      ]
    }
  ]
}
```

### 3. 基本統計分析

```typescript
// shared/analytics/basic-log-stats.ts
export class BasicLogStatistics {
  constructor(private elasticsearchClient: ElasticsearchClient) {}

  async getLogVolumeStats(timeRange: { start: Date; end: Date }): Promise<LogVolumeStats> {
    const query = {
      query: {
        range: {
          timestamp: {
            gte: timeRange.start.toISOString(),
            lte: timeRange.end.toISOString()
          }
        }
      },
      aggs: {
        total_logs: {
          value_count: {
            field: 'timestamp'
          }
        },
        logs_by_service: {
          terms: {
            field: 'service.keyword',
            size: 50
          }
        },
        logs_by_level: {
          terms: {
            field: 'level.keyword',
            size: 10
          }
        },
        logs_over_time: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: '1h'
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const logsByService: Record<string, number> = {};
    response.body.aggregations.logs_by_service.buckets.forEach((bucket: any) => {
      logsByService[bucket.key] = bucket.doc_count;
    });

    const logsByLevel: Record<string, number> = {};
    response.body.aggregations.logs_by_level.buckets.forEach((bucket: any) => {
      logsByLevel[bucket.key] = bucket.doc_count;
    });

    const logsOverTime = response.body.aggregations.logs_over_time.buckets.map((bucket: any) => ({
      timestamp: new Date(bucket.key),
      count: bucket.doc_count
    }));

    return {
      totalLogs: response.body.aggregations.total_logs.value,
      logsByService,
      logsByLevel,
      logsOverTime
    };
  }

  async getErrorAnalysis(timeRange: { start: Date; end: Date }): Promise<ErrorAnalysis> {
    const query = {
      query: {
        bool: {
          must: [
            {
              range: {
                timestamp: {
                  gte: timeRange.start.toISOString(),
                  lte: timeRange.end.toISOString()
                }
              }
            },
            {
              term: {
                level: 'error'
              }
            }
          ]
        }
      },
      aggs: {
        error_count: {
          value_count: {
            field: 'timestamp'
          }
        },
        errors_by_service: {
          terms: {
            field: 'service.keyword',
            size: 20
          }
        },
        common_error_messages: {
          terms: {
            field: 'message.keyword',
            size: 10
          },
          aggs: {
            services: {
              terms: {
                field: 'service.keyword',
                size: 5
              }
            }
          }
        },
        errors_over_time: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: '1h'
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const errorsByService: Record<string, number> = {};
    response.body.aggregations.errors_by_service.buckets.forEach((bucket: any) => {
      errorsByService[bucket.key] = bucket.doc_count;
    });

    const commonErrors = response.body.aggregations.common_error_messages.buckets.map((bucket: any) => ({
      message: bucket.key,
      count: bucket.doc_count,
      services: bucket.services.buckets.map((serviceBucket: any) => serviceBucket.key)
    }));

    const errorsOverTime = response.body.aggregations.errors_over_time.buckets.map((bucket: any) => ({
      timestamp: new Date(bucket.key),
      count: bucket.doc_count
    }));

    return {
      totalErrors: response.body.aggregations.error_count.value,
      errorsByService,
      commonErrors,
      errorsOverTime
    };
  }

  async getPerformanceBasics(timeRange: { start: Date; end: Date }): Promise<PerformanceBasics> {
    const query = {
      query: {
        bool: {
          must: [
            {
              range: {
                timestamp: {
                  gte: timeRange.start.toISOString(),
                  lte: timeRange.end.toISOString()
                }
              }
            },
            {
              exists: {
                field: 'metadata.duration'
              }
            }
          ]
        }
      },
      aggs: {
        avg_duration: {
          avg: {
            field: 'metadata.duration'
          }
        },
        duration_percentiles: {
          percentiles: {
            field: 'metadata.duration',
            percents: [50, 95, 99]
          }
        },
        performance_by_service: {
          terms: {
            field: 'service.keyword',
            size: 20
          },
          aggs: {
            avg_duration: {
              avg: {
                field: 'metadata.duration'
              }
            },
            max_duration: {
              max: {
                field: 'metadata.duration'
              }
            }
          }
        },
        duration_histogram: {
          histogram: {
            field: 'metadata.duration',
            interval: 100
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const performanceByService: Record<string, { avg: number; max: number }> = {};
    response.body.aggregations.performance_by_service.buckets.forEach((bucket: any) => {
      performanceByService[bucket.key] = {
        avg: bucket.avg_duration.value || 0,
        max: bucket.max_duration.value || 0
      };
    });

    const durationDistribution = response.body.aggregations.duration_histogram.buckets.map((bucket: any) => ({
      range: `${bucket.key}-${bucket.key + 100}ms`,
      count: bucket.doc_count
    }));

    return {
      avgDuration: response.body.aggregations.avg_duration.value || 0,
      p50Duration: response.body.aggregations.duration_percentiles.values['50.0'] || 0,
      p95Duration: response.body.aggregations.duration_percentiles.values['95.0'] || 0,
      p99Duration: response.body.aggregations.duration_percentiles.values['99.0'] || 0,
      performanceByService,
      durationDistribution
    };
  }
}

// インターフェース定義
interface LogVolumeStats {
  totalLogs: number;
  logsByService: Record<string, number>;
  logsByLevel: Record<string, number>;
  logsOverTime: Array<{
    timestamp: Date;
    count: number;
  }>;
}

interface ErrorAnalysis {
  totalErrors: number;
  errorsByService: Record<string, number>;
  commonErrors: Array<{
    message: string;
    count: number;
    services: string[];
  }>;
  errorsOverTime: Array<{
    timestamp: Date;
    count: number;
  }>;
}

interface PerformanceBasics {
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  performanceByService: Record<string, {
    avg: number;
    max: number;
  }>;
  durationDistribution: Array<{
    range: string;
    count: number;
  }>;
}
```

### 4. クエリ最適化

```typescript
// shared/analytics/query-optimizer.ts
export class LogQueryOptimizer {
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5分

  constructor(private elasticsearchClient: ElasticsearchClient) {}

  async executeOptimizedQuery(queryKey: string, query: any, useCache: boolean = true): Promise<any> {
    // キャッシュチェック
    if (useCache) {
      const cached = this.queryCache.get(queryKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
    }

    // クエリ最適化
    const optimizedQuery = this.optimizeQuery(query);
    
    // 実行
    const result = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: optimizedQuery
    });

    // キャッシュ更新
    if (useCache) {
      this.queryCache.set(queryKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  private optimizeQuery(query: any): any {
    const optimized = { ...query };

    // タイムレンジの最適化
    if (optimized.query?.range?.timestamp) {
      optimized._source = false; // 必要なフィールドのみ取得
      optimized.track_total_hits = false; // 総件数計算をスキップ
    }

    // アグリゲーションの最適化
    if (optimized.aggs) {
      this.optimizeAggregations(optimized.aggs);
    }

    // フィールドの制限
    if (!optimized._source) {
      optimized._source = [
        'timestamp',
        'level',
        'service',
        'message',
        'traceId',
        'metadata.duration',
        'metadata.operation'
      ];
    }

    return optimized;
  }

  private optimizeAggregations(aggs: any): void {
    Object.keys(aggs).forEach(aggKey => {
      const agg = aggs[aggKey];
      
      // Terms aggregationのサイズ制限
      if (agg.terms && !agg.terms.size) {
        agg.terms.size = 50;
      }
      
      // Date histogramの間隔最適化
      if (agg.date_histogram && !agg.date_histogram.interval) {
        agg.date_histogram.calendar_interval = '1h';
      }
      
      // 再帰的に最適化
      if (agg.aggs) {
        this.optimizeAggregations(agg.aggs);
      }
    });
  }

  clearCache(): void {
    this.queryCache.clear();
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.queryCache.size,
      entries: Array.from(this.queryCache.keys())
    };
  }
}
```

これらの基本分析機能により、マイクロサービス環境でのログデータを効果的に可視化し、基本的な統計分析を実行できます。次は[ログ異常検知](./18-log-anomaly-detection.md)について学習しましょう。