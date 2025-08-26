# Monitoring

## Pipeline Metrics Collection

```typescript
interface PipelineMetrics {
  buildId: string;
  duration: number;
  status: 'success' | 'failed' | 'cancelled';
  stages: StageMetric[];
  resources: ResourceUsage;
  testResults: TestMetrics;
}

class MetricsCollector {
  private prometheus = new PrometheusRegistry();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.buildDuration = new Histogram({
      name: 'ci_build_duration_seconds',
      help: 'Build duration in seconds',
      labelNames: ['branch', 'status', 'stage'],
      buckets: [30, 60, 300, 600, 1800, 3600]
    });

    this.testCoverage = new Gauge({
      name: 'ci_test_coverage_percent',
      help: 'Test coverage percentage',
      labelNames: ['project', 'type']
    });

    this.deploymentFrequency = new Counter({
      name: 'cd_deployments_total',
      help: 'Total number of deployments',
      labelNames: ['environment', 'status']
    });
  }

  async recordBuild(metrics: PipelineMetrics): Promise<void> {
    this.buildDuration
      .labels(metrics.branch, metrics.status)
      .observe(metrics.duration);

    if (metrics.testResults) {
      this.testCoverage
        .labels(metrics.project, 'unit')
        .set(metrics.testResults.coverage);
    }

    await this.pushToGateway(metrics);
  }
}
```

## Alerting Configuration

```yaml
# alertmanager.yml
groups:
  - name: ci-cd-alerts
    rules:
      - alert: BuildFailureRate
        expr: |
          (
            rate(ci_builds_failed_total[5m]) / 
            rate(ci_builds_total[5m])
          ) * 100 > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High build failure rate detected"
          description: "Build failure rate is {{ $value }}% over the last 5 minutes"
      
      - alert: DeploymentStuck
        expr: |
          (time() - cd_last_successful_deployment) > 86400
        labels:
          severity: critical
        annotations:
          summary: "No deployments in 24 hours"
          description: "Last successful deployment was {{ $value | humanizeDuration }} ago"
      
      - alert: TestCoverageDropped
        expr: |
          ci_test_coverage_percent < 80
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Test coverage below threshold"
          description: "Coverage is {{ $value }}%, threshold is 80%"

# Alert routing
route:
  group_by: ['alertname', 'environment']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'ci-cd-team'
  routes:
    - match:
        severity: critical
      receiver: 'oncall-pager'
    - match:
        alertname: DeploymentStuck
      receiver: 'deployment-team'

receivers:
  - name: 'ci-cd-team'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#ci-cd-alerts'
        title: 'CI/CD Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

## Dashboard as Code

```javascript
// Grafana dashboard configuration
const createCICDDashboard = () => ({
  dashboard: {
    id: null,
    title: "CI/CD Pipeline Monitoring",
    tags: ["ci", "cd", "devops"],
    timezone: "browser",
    panels: [
      {
        id: 1,
        title: "Build Success Rate",
        type: "stat",
        targets: [
          {
            expr: `(
              sum(rate(ci_builds_success_total[24h])) /
              sum(rate(ci_builds_total[24h]))
            ) * 100`,
            legendFormat: "Success Rate %"
          }
        ],
        fieldConfig: {
          defaults: {
            min: 0,
            max: 100,
            thresholds: {
              steps: [
                { color: "red", value: 0 },
                { color: "yellow", value: 85 },
                { color: "green", value: 95 }
              ]
            }
          }
        }
      },
      
      {
        id: 2,
        title: "Build Duration Trends",
        type: "timeseries",
        targets: [
          {
            expr: "histogram_quantile(0.95, ci_build_duration_seconds)",
            legendFormat: "95th Percentile"
          },
          {
            expr: "histogram_quantile(0.50, ci_build_duration_seconds)",
            legendFormat: "Median"
          }
        ]
      },
      
      {
        id: 3,
        title: "Deployment Frequency",
        type: "graph",
        targets: [
          {
            expr: "sum(rate(cd_deployments_total[1d])) by (environment)",
            legendFormat: "{{ environment }}"
          }
        ]
      }
    ],
    
    templating: {
      list: [
        {
          name: "environment",
          type: "query",
          query: "label_values(cd_deployments_total, environment)",
          refresh: 1
        }
      ]
    }
  }
});

// Auto-deploy dashboard
async function deployDashboard() {
  const dashboard = createCICDDashboard();
  
  const response = await fetch(`${GRAFANA_URL}/api/dashboards/db`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GRAFANA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dashboard)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to deploy dashboard: ${response.statusText}`);
  }
}
```

## Log Aggregation and Analysis

```yaml
# fluent-bit.conf for CI/CD log collection
[SERVICE]
    Flush         1
    Log_Level     info
    Daemon        off

[INPUT]
    Name              tail
    Path              /var/log/ci/*.log
    Tag               ci.build
    Parser            json
    Refresh_Interval  5

[INPUT]
    Name              tail
    Path              /var/log/cd/*.log
    Tag               cd.deploy
    Parser            json

[FILTER]
    Name                kubernetes
    Match               ci.*
    Annotations         On
    Labels              On

[FILTER]
    Name                record_modifier
    Match               *
    Record              cluster_name ${CLUSTER_NAME}
    Record              environment ${ENVIRONMENT}

[OUTPUT]
    Name                elasticsearch
    Match               *
    Host                ${ES_HOST}
    Port                9200
    Index               ci-cd-logs
    Type                _doc
    Time_Key            @timestamp
    Time_Key_Format     %Y-%m-%dT%H:%M:%S
```

## Performance Tracking

```typescript
class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();

  trackDeploymentTime(environment: string, duration: number): void {
    const key = `deployment_${environment}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(duration);
  }

  trackTestExecutionTime(suite: string, duration: number): void {
    const key = `test_${suite}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(duration);
  }

  generatePerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {
      deploymentMetrics: {},
      testMetrics: {},
      trends: {},
      recommendations: []
    };

    for (const [key, values] of this.metrics.entries()) {
      const stats = this.calculateStatistics(values);
      
      if (key.startsWith('deployment_')) {
        const env = key.replace('deployment_', '');
        report.deploymentMetrics[env] = stats;
        
        if (stats.p95 > 600) { // 10 minutes
          report.recommendations.push(
            `Consider optimizing deployment process for ${env} environment`
          );
        }
      }
    }

    return report;
  }

  private calculateStatistics(values: number[]) {
    const sorted = values.sort((a, b) => a - b);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      average: values.reduce((a, b) => a + b, 0) / values.length
    };
  }
}
```

## Health Check Monitoring

```bash
#!/bin/bash
# health-monitor.sh - Comprehensive health monitoring

monitor_pipeline_health() {
    local status_file="/tmp/pipeline-health.json"
    
    # Check CI/CD system health
    check_jenkins_health
    check_runners_availability
    check_artifact_storage
    check_deployment_targets
    
    # Aggregate results
    generate_health_report > $status_file
    
    # Alert if unhealthy
    if ! jq -e '.status == "healthy"' $status_file >/dev/null; then
        send_alert "$(cat $status_file)"
    fi
}

check_jenkins_health() {
    local jenkins_url="https://jenkins.company.com"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$jenkins_url/api/json")
    
    if [[ $response != "200" ]]; then
        echo "Jenkins unhealthy: HTTP $response"
        return 1
    fi
    
    # Check queue length
    local queue_length=$(curl -s "$jenkins_url/queue/api/json" | jq '.items | length')
    if [[ $queue_length -gt 10 ]]; then
        echo "Jenkins queue backed up: $queue_length items"
        return 1
    fi
}

check_runners_availability() {
    # GitHub Actions runners
    local available_runners=$(gh api /repos/owner/repo/actions/runners --jq '.runners[] | select(.status == "online") | .name' | wc -l)
    
    if [[ $available_runners -lt 2 ]]; then
        echo "Insufficient runners available: $available_runners"
        return 1
    fi
}
```

## Business Metrics Integration

```typescript
interface BusinessMetrics {
  leadTime: number;           // Commit to production
  deploymentFrequency: number; // Deployments per week
  mttr: number;              // Mean time to recovery
  changeFailureRate: number;  // Percentage
}

class DORAMetrics {
  async calculateLeadTime(): Promise<number> {
    const commits = await this.getRecentCommits();
    const deployments = await this.getRecentDeployments();
    
    const leadTimes = commits.map(commit => {
      const deployment = deployments.find(d => d.sha === commit.sha);
      return deployment 
        ? deployment.timestamp - commit.timestamp 
        : null;
    }).filter(Boolean);
    
    return leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length;
  }

  async calculateMTTR(): Promise<number> {
    const incidents = await this.getProductionIncidents();
    
    const recoveryTimes = incidents
      .filter(i => i.resolvedAt)
      .map(i => i.resolvedAt - i.createdAt);
    
    return recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
  }
}
```

## Best Practices

1. **Multi-layered Monitoring**: Monitor infrastructure, application, and business metrics
2. **Proactive Alerting**: Set meaningful thresholds with context-aware alerts  
3. **Dashboard Automation**: Version control and automate dashboard deployment
4. **Log Correlation**: Connect CI/CD logs with application and infrastructure logs
5. **Performance Trending**: Track performance over time to identify degradation
6. **SLA Tracking**: Monitor and report on CI/CD service level agreements
7. **Incident Integration**: Connect monitoring to incident management workflows