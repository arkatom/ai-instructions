# Microservices - ログ異常検知

> 高度な異常検知、機械学習、自動レポート生成

## 概要

マイクロサービス環境でのログ異常検知システム、機械学習を活用した高度な分析、自動レポート生成の実装方法を詳しく説明します。統計的手法とパターン認識による包括的な監視システムについて学習します。

## 関連ファイル
- [ログ分析基礎](./17-log-analytics-basics.md) - 基本ダッシュボードと統計分析
- [ログ集約](./16-log-aggregation.md) - ログ収集とアラートシステム
- [メトリクス監視](./13-metrics-monitoring.md) - メトリクス収集と監視システム

## 異常検知システム

### 1. 高度なログ分析エンジン

```typescript
// shared/analytics/advanced-log-analyzer.ts
export class AdvancedLogAnalyzer {
  constructor(
    private elasticsearchClient: ElasticsearchClient,
    private alertManager: AlertManager
  ) {}

  async detectAnomalies(timeRange: { start: Date; end: Date }): Promise<LogAnomaly[]> {
    const anomalies: LogAnomaly[] = [];

    // エラー率の異常検出
    const errorRateAnomalies = await this.detectErrorRateAnomalies(timeRange);
    anomalies.push(...errorRateAnomalies);

    // レスポンスタイムの異常検出
    const responseTimeAnomalies = await this.detectResponseTimeAnomalies(timeRange);
    anomalies.push(...responseTimeAnomalies);

    // 異常なログパターンの検出
    const patternAnomalies = await this.detectLogPatternAnomalies(timeRange);
    anomalies.push(...patternAnomalies);

    // ログボリューム異常の検出
    const volumeAnomalies = await this.detectLogVolumeAnomalies(timeRange);
    anomalies.push(...volumeAnomalies);

    return anomalies;
  }

  private async detectErrorRateAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
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
            }
          ]
        }
      },
      aggs: {
        services: {
          terms: {
            field: 'service.keyword',
            size: 50
          },
          aggs: {
            error_rate: {
              filter: {
                term: { level: 'error' }
              }
            },
            total_logs: {
              value_count: {
                field: 'timestamp'
              }
            },
            historical_error_rate: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: '1h'
              },
              aggs: {
                errors: {
                  filter: {
                    term: { level: 'error' }
                  }
                }
              }
            }
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const anomalies: LogAnomaly[] = [];
    const servicesBuckets = response.body.aggregations.services.buckets;

    for (const bucket of servicesBuckets) {
      const errorCount = bucket.error_rate.doc_count;
      const totalCount = bucket.total_logs.value;
      const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

      // 統計的異常検出（過去の履歴と比較）
      const historicalRates = bucket.historical_error_rate.buckets.map((h: any) => {
        const hErrors = h.errors.doc_count;
        const hTotal = h.doc_count;
        return hTotal > 0 ? hErrors / hTotal : 0;
      });

      const isAnomaly = this.isStatisticalAnomaly(errorRate, historicalRates);

      if (isAnomaly || errorRate > 0.05) {
        anomalies.push({
          type: 'error_rate',
          service: bucket.key,
          severity: errorRate > 0.1 ? 'critical' : 'warning',
          description: `Abnormal error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          value: errorRate,
          threshold: 0.05,
          timeRange,
          confidence: this.calculateConfidence(errorRate, historicalRates)
        });
      }
    }

    return anomalies;
  }

  private async detectResponseTimeAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
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
        services: {
          terms: {
            field: 'service.keyword',
            size: 50
          },
          aggs: {
            avg_duration: {
              avg: {
                field: 'metadata.duration'
              }
            },
            p95_duration: {
              percentiles: {
                field: 'metadata.duration',
                percents: [95]
              }
            },
            duration_histogram: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: '1h'
              },
              aggs: {
                avg_duration: {
                  avg: {
                    field: 'metadata.duration'
                  }
                }
              }
            }
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const anomalies: LogAnomaly[] = [];
    const servicesBuckets = response.body.aggregations.services.buckets;

    for (const bucket of servicesBuckets) {
      const avgDuration = bucket.avg_duration.value;
      const p95Duration = bucket.p95_duration.values['95.0'];

      // 過去の履歴からベースラインを計算
      const historicalDurations = bucket.duration_histogram.buckets
        .map((h: any) => h.avg_duration.value)
        .filter((d: number) => d !== null);

      const isAnomaly = this.isStatisticalAnomaly(avgDuration, historicalDurations);

      if (isAnomaly || avgDuration > 5000 || p95Duration > 10000) {
        anomalies.push({
          type: 'response_time',
          service: bucket.key,
          severity: p95Duration > 15000 ? 'critical' : 'warning',
          description: `Abnormal response time: avg=${avgDuration.toFixed(0)}ms, p95=${p95Duration.toFixed(0)}ms`,
          value: avgDuration,
          threshold: 5000,
          timeRange,
          confidence: this.calculateConfidence(avgDuration, historicalDurations)
        });
      }
    }

    return anomalies;
  }

  private async detectLogPatternAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
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
            }
          ]
        }
      },
      aggs: {
        error_patterns: {
          filter: {
            term: { level: 'error' }
          },
          aggs: {
            message_patterns: {
              terms: {
                field: 'message.keyword',
                size: 100,
                min_doc_count: 5
              },
              aggs: {
                services_affected: {
                  terms: {
                    field: 'service.keyword',
                    size: 10
                  }
                },
                time_distribution: {
                  date_histogram: {
                    field: 'timestamp',
                    calendar_interval: '15m'
                  }
                }
              }
            }
          }
        },
        unusual_log_volumes: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: '5m'
          },
          aggs: {
            services: {
              terms: {
                field: 'service.keyword',
                size: 20
              }
            }
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const anomalies: LogAnomaly[] = [];

    // エラーパターン分析
    const messageBuckets = response.body.aggregations.error_patterns.message_patterns.buckets;
    for (const bucket of messageBuckets) {
      const count = bucket.doc_count;
      const message = bucket.key;
      const servicesAffected = bucket.services_affected.buckets.length;

      // 急激に増加したエラーパターンを検出
      const timeDistribution = bucket.time_distribution.buckets;
      const isSpike = this.detectSpike(timeDistribution.map((t: any) => t.doc_count));

      if (count > 50 || servicesAffected > 3 || isSpike) {
        anomalies.push({
          type: 'error_pattern',
          service: `${servicesAffected} services`,
          severity: count > 100 || servicesAffected > 5 ? 'critical' : 'warning',
          description: `Frequent error pattern: "${message}" (${count} occurrences across ${servicesAffected} services)`,
          value: count,
          threshold: 50,
          timeRange
        });
      }
    }

    return anomalies;
  }

  private async detectLogVolumeAnomalies(
    timeRange: { start: Date; end: Date }
  ): Promise<LogAnomaly[]> {
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
        volume_over_time: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: '5m'
          },
          aggs: {
            services: {
              terms: {
                field: 'service.keyword',
                size: 20
              }
            }
          }
        }
      }
    };

    const response = await this.elasticsearchClient.search({
      index: 'microservices-logs',
      body: query
    });

    const anomalies: LogAnomaly[] = [];
    const timeBuckets = response.body.aggregations.volume_over_time.buckets;

    // サービスごとのログボリューム変化を分析
    const serviceVolumes: Record<string, number[]> = {};

    timeBuckets.forEach((bucket: any) => {
      bucket.services.buckets.forEach((serviceBucket: any) => {
        const service = serviceBucket.key;
        const volume = serviceBucket.doc_count;

        if (!serviceVolumes[service]) {
          serviceVolumes[service] = [];
        }
        serviceVolumes[service].push(volume);
      });
    });

    // 各サービスのボリューム異常を検出
    Object.entries(serviceVolumes).forEach(([service, volumes]) => {
      const isVolumeAnomaly = this.detectVolumeAnomaly(volumes);
      
      if (isVolumeAnomaly) {
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxVolume = Math.max(...volumes);
        
        anomalies.push({
          type: 'log_volume',
          service,
          severity: maxVolume > avgVolume * 5 ? 'critical' : 'warning',
          description: `Abnormal log volume detected: avg=${avgVolume.toFixed(0)}, max=${maxVolume}`,
          value: maxVolume,
          threshold: avgVolume * 2,
          timeRange
        });
      }
    });

    return anomalies;
  }

  private isStatisticalAnomaly(currentValue: number, historicalValues: number[]): boolean {
    if (historicalValues.length < 3) return false;

    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    // 2標準偏差を超える場合は異常
    return Math.abs(currentValue - mean) > 2 * stdDev;
  }

  private calculateConfidence(value: number, historicalValues: number[]): number {
    if (historicalValues.length < 3) return 0.5;

    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    const zScore = Math.abs(value - mean) / stdDev;
    
    // Z-scoreから信頼度を計算（0.5-1.0の範囲）
    return Math.min(0.5 + (zScore / 4), 1.0);
  }

  private detectSpike(values: number[]): boolean {
    if (values.length < 3) return false;

    const recent = values.slice(-3);
    const earlier = values.slice(0, -3);

    if (earlier.length === 0) return false;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    // 最近の値が過去の平均の3倍以上の場合はスパイク
    return recentAvg > earlierAvg * 3;
  }

  private detectVolumeAnomaly(volumes: number[]): boolean {
    if (volumes.length < 5) return false;

    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const stdDev = Math.sqrt(volumes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / volumes.length);

    // いずれかの値が2標準偏差を超える場合は異常
    return volumes.some(v => Math.abs(v - mean) > 2 * stdDev);
  }
}

// インターフェース定義
interface LogAnomaly {
  type: string;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  value: number;
  threshold: number;
  timeRange: { start: Date; end: Date };
  confidence?: number;
}
```

### 2. 自動レポート生成システム

```typescript
// shared/analytics/report-generator.ts
export class AdvancedReportGenerator {
  constructor(
    private logAnalyzer: AdvancedLogAnalyzer,
    private basicStats: BasicLogStatistics,
    private notificationService: NotificationService
  ) {}

  async generateComprehensiveReport(
    timeRange: { start: Date; end: Date },
    reportType: 'hourly' | 'daily' | 'weekly'
  ): Promise<ComprehensiveReport> {
    const [volumeStats, errorStats, performanceStats, anomalies] = await Promise.all([
      this.basicStats.getLogVolumeStats(timeRange),
      this.basicStats.getErrorAnalysis(timeRange),
      this.basicStats.getPerformanceBasics(timeRange),
      this.logAnalyzer.detectAnomalies(timeRange)
    ]);

    const report: ComprehensiveReport = {
      timeRange,
      reportType,
      generatedAt: new Date(),
      summary: {
        totalLogs: volumeStats.totalLogs,
        totalErrors: errorStats.totalErrors,
        overallErrorRate: errorStats.totalErrors / volumeStats.totalLogs,
        avgResponseTime: performanceStats.avgDuration,
        anomaliesDetected: anomalies.length,
        servicesAnalyzed: Object.keys(volumeStats.logsByService).length
      },
      volumeAnalysis: {
        topServices: this.getTopServices(volumeStats.logsByService),
        logLevelDistribution: volumeStats.logsByLevel,
        volumeTrend: this.calculateTrend(volumeStats.logsOverTime),
        peakHours: this.identifyPeakHours(volumeStats.logsOverTime)
      },
      errorAnalysis: {
        topErrorServices: this.getTopServices(errorStats.errorsByService),
        commonErrorPatterns: errorStats.commonErrors.slice(0, 10),
        errorTrend: this.calculateTrend(errorStats.errorsOverTime),
        criticalErrors: errorStats.commonErrors.filter(e => e.count > 100)
      },
      performanceAnalysis: {
        slowestServices: this.getSlowestServices(performanceStats.performanceByService),
        responseTimeDistribution: performanceStats.durationDistribution,
        performanceTrend: 'stable' // 簡略化
      },
      anomalies: anomalies.sort((a, b) => 
        this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity)
      ),
      recommendations: this.generateRecommendations(volumeStats, errorStats, performanceStats, anomalies)
    };

    return report;
  }

  async generateAndSendReport(
    timeRange: { start: Date; end: Date },
    reportType: 'hourly' | 'daily' | 'weekly'
  ): Promise<void> {
    const report = await this.generateComprehensiveReport(timeRange, reportType);
    const reportText = this.formatReportAsText(report);
    const reportHtml = this.formatReportAsHtml(report);

    // 重要度に応じて通知チャネルを選択
    const channels = this.selectNotificationChannels(report);

    for (const channel of channels) {
      await this.notificationService.send(channel, {
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Log Analysis Report`,
        message: channel === 'email' ? reportHtml : reportText,
        metadata: { 
          reportType, 
          severity: this.calculateReportSeverity(report),
          attachments: channel === 'email' ? [await this.generateReportPdf(report)] : undefined
        }
      });
    }
  }

  private getTopServices(serviceData: Record<string, number>): Array<{ service: string; count: number }> {
    return Object.entries(serviceData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([service, count]) => ({ service, count }));
  }

  private calculateTrend(timeSeriesData: Array<{ timestamp: Date; count: number }>): 'increasing' | 'decreasing' | 'stable' {
    if (timeSeriesData.length < 3) return 'stable';

    const first = timeSeriesData.slice(0, Math.floor(timeSeriesData.length / 3));
    const last = timeSeriesData.slice(-Math.floor(timeSeriesData.length / 3));

    const firstAvg = first.reduce((a, b) => a + b.count, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b.count, 0) / last.length;

    const change = (lastAvg - firstAvg) / firstAvg;
    
    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'stable';
  }

  private identifyPeakHours(timeSeriesData: Array<{ timestamp: Date; count: number }>): number[] {
    const hourlyData: Record<number, number[]> = {};
    
    timeSeriesData.forEach(data => {
      const hour = data.timestamp.getHours();
      if (!hourlyData[hour]) hourlyData[hour] = [];
      hourlyData[hour].push(data.count);
    });

    const hourlyAverages = Object.entries(hourlyData).map(([hour, counts]) => ({
      hour: parseInt(hour),
      avgCount: counts.reduce((a, b) => a + b, 0) / counts.length
    }));

    return hourlyAverages
      .sort((a, b) => b.avgCount - a.avgCount)
      .slice(0, 3)
      .map(h => h.hour);
  }

  private getSlowestServices(performanceData: Record<string, { avg: number; max: number }>): Array<{ service: string; avgDuration: number; maxDuration: number }> {
    return Object.entries(performanceData)
      .sort((a, b) => b[1].avg - a[1].avg)
      .slice(0, 5)
      .map(([service, perf]) => ({
        service,
        avgDuration: perf.avg,
        maxDuration: perf.max
      }));
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 3;
      case 'warning': return 2;
      case 'info': return 1;
      default: return 0;
    }
  }

  private generateRecommendations(
    volumeStats: any,
    errorStats: any,
    performanceStats: any,
    anomalies: LogAnomaly[]
  ): string[] {
    const recommendations: string[] = [];

    // エラー率の推奨事項
    if (errorStats.totalErrors / volumeStats.totalLogs > 0.05) {
      recommendations.push('エラー率が高い状態です。エラーログの詳細分析と対策の実施を推奨します。');
    }

    // パフォーマンスの推奨事項
    if (performanceStats.p95Duration > 10000) {
      recommendations.push('レスポンス時間のP95が10秒を超えています。パフォーマンス最適化を検討してください。');
    }

    // 異常検知の推奨事項
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    if (criticalAnomalies.length > 0) {
      recommendations.push(`${criticalAnomalies.length}件の重要な異常が検出されました。早急な対応が必要です。`);
    }

    // ボリュームの推奨事項
    const topService = Object.entries(volumeStats.logsByService)[0];
    if (topService && topService[1] > volumeStats.totalLogs * 0.5) {
      recommendations.push(`${topService[0]}サービスがログ全体の50%以上を占めています。ログレベルの見直しを推奨します。`);
    }

    return recommendations;
  }

  private selectNotificationChannels(report: ComprehensiveReport): string[] {
    const severity = this.calculateReportSeverity(report);
    
    switch (severity) {
      case 'critical':
        return ['slack', 'email', 'pagerduty'];
      case 'warning':
        return ['slack', 'email'];
      default:
        return ['slack'];
    }
  }

  private calculateReportSeverity(report: ComprehensiveReport): 'info' | 'warning' | 'critical' {
    if (report.anomalies.some(a => a.severity === 'critical')) return 'critical';
    if (report.summary.overallErrorRate > 0.05 || report.anomalies.length > 5) return 'warning';
    return 'info';
  }

  private formatReportAsText(report: ComprehensiveReport): string {
    return `
Log Analysis Report - ${report.reportType}
Generated: ${report.generatedAt.toISOString()}
Time Range: ${report.timeRange.start.toISOString()} - ${report.timeRange.end.toISOString()}

SUMMARY:
- Total Logs: ${report.summary.totalLogs.toLocaleString()}
- Error Rate: ${(report.summary.overallErrorRate * 100).toFixed(2)}%
- Avg Response Time: ${report.summary.avgResponseTime.toFixed(0)}ms
- Anomalies: ${report.summary.anomaliesDetected}

TOP ISSUES:
${report.anomalies.slice(0, 5).map((a, i) => `${i + 1}. ${a.type} - ${a.service}: ${a.description}`).join('\n')}

RECOMMENDATIONS:
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
  }

  private formatReportAsHtml(report: ComprehensiveReport): string {
    // HTML形式のレポート生成（簡略化）
    return this.formatReportAsText(report).replace(/\n/g, '<br>');
  }

  private async generateReportPdf(report: ComprehensiveReport): Promise<Buffer> {
    // PDF生成の実装（簡略化）
    return Buffer.from(this.formatReportAsText(report));
  }
}

// レポート関連のインターフェース
interface ComprehensiveReport {
  timeRange: { start: Date; end: Date };
  reportType: 'hourly' | 'daily' | 'weekly';
  generatedAt: Date;
  summary: {
    totalLogs: number;
    totalErrors: number;
    overallErrorRate: number;
    avgResponseTime: number;
    anomaliesDetected: number;
    servicesAnalyzed: number;
  };
  volumeAnalysis: {
    topServices: Array<{ service: string; count: number }>;
    logLevelDistribution: Record<string, number>;
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    peakHours: number[];
  };
  errorAnalysis: {
    topErrorServices: Array<{ service: string; count: number }>;
    commonErrorPatterns: Array<{ message: string; count: number; services: string[] }>;
    errorTrend: 'increasing' | 'decreasing' | 'stable';
    criticalErrors: Array<{ message: string; count: number; services: string[] }>;
  };
  performanceAnalysis: {
    slowestServices: Array<{ service: string; avgDuration: number; maxDuration: number }>;
    responseTimeDistribution: Array<{ range: string; count: number }>;
    performanceTrend: 'increasing' | 'decreasing' | 'stable';
  };
  anomalies: LogAnomaly[];
  recommendations: string[];
}
```

これらの高度な異常検知と自動レポート機能により、マイクロサービス環境での包括的なログ監視と迅速な問題対応を実現できます。機械学習的アプローチと統計的手法を組み合わせることで、より精度の高い異常検知が可能になります。