# CD Strategies

## Blue-Green Deployment

```yaml
# .github/workflows/blue-green.yml
name: Blue-Green Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Determine current slot
        id: slot
        run: |
          CURRENT=$(curl -s https://api.myapp.com/health | jq -r '.slot // "blue"')
          TARGET=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")
          echo "current=$CURRENT" >> $GITHUB_OUTPUT
          echo "target=$TARGET" >> $GITHUB_OUTPUT
      
      - name: Deploy to target slot
        run: |
          az webapp deployment slot swap \
            --name myapp \
            --resource-group production \
            --slot ${{ steps.slot.outputs.target }}
      
      - name: Validate deployment
        run: |
          TARGET_URL="https://myapp-${{ steps.slot.outputs.target }}.azurewebsites.net"
          for i in {1..30}; do
            if curl -f "$TARGET_URL/health"; then
              echo "Health check passed"
              break
            fi
            sleep 10
          done
      
      - name: Switch traffic
        run: |
          az webapp traffic-routing set \
            --name myapp \
            --resource-group production \
            --distribution ${{ steps.slot.outputs.target }}=100
```

## Canary Deployment Strategy

```typescript
interface CanaryConfig {
  stages: { percentage: number; duration: number; healthCheck: string }[];
  rollbackTriggers: { errorRate: number; latencyP99: number };
  targetEnvironment: string;
}

class CanaryDeployment {
  constructor(private config: CanaryConfig) {}

  async deploy(version: string): Promise<void> {
    for (const stage of this.config.stages) {
      await this.deployStage(version, stage);
      await this.monitorStage(stage);
      
      if (await this.shouldRollback(stage)) {
        await this.rollback();
        throw new Error(`Canary deployment failed at ${stage.percentage}%`);
      }
    }
    
    await this.promoteToProduction(version);
  }

  private async deployStage(version: string, stage: any): Promise<void> {
    const command = `kubectl set image deployment/app app=${version} && 
                     kubectl patch service app-service -p '{"spec":{"selector":{"version":"${version}"}}}'`;
    
    // Set traffic percentage
    await this.setTrafficPercentage(stage.percentage, version);
    console.log(`Deployed ${version} to ${stage.percentage}% traffic`);
  }

  private async monitorStage(stage: any): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < stage.duration) {
      const health = await this.checkHealth(stage.healthCheck);
      const metrics = await this.getMetrics();
      
      if (metrics.errorRate > this.config.rollbackTriggers.errorRate) {
        throw new Error(`Error rate exceeded: ${metrics.errorRate}%`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30s intervals
    }
  }
}
```

## Feature Flag Integration

```javascript
// Feature flag-driven deployment
class FeatureFlaggedDeployment {
  constructor(flagProvider) {
    this.flags = flagProvider;
  }

  async deployWithFlags(version, features) {
    // Deploy new version with features disabled
    await this.deployVersion(version, features.map(f => ({ ...f, enabled: false })));
    
    // Gradual feature rollout
    for (const feature of features) {
      await this.rolloutFeature(feature, [
        { percentage: 1, duration: 300 },    // 1% for 5 minutes
        { percentage: 5, duration: 600 },    // 5% for 10 minutes
        { percentage: 25, duration: 1800 },  // 25% for 30 minutes
        { percentage: 100, duration: 0 }     // Full rollout
      ]);
    }
  }

  async rolloutFeature(feature, stages) {
    for (const stage of stages) {
      await this.flags.updatePercentage(feature.key, stage.percentage);
      
      if (stage.duration > 0) {
        await this.monitorFeature(feature, stage.duration);
      }
    }
  }

  async monitorFeature(feature, duration) {
    const metrics = await this.collectMetrics(feature.key, duration);
    
    if (metrics.errorRate > feature.errorThreshold) {
      await this.flags.disable(feature.key);
      throw new Error(`Feature ${feature.key} error rate: ${metrics.errorRate}%`);
    }
  }
}
```

## Rolling Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 3          # 30% additional pods during update
      maxUnavailable: 2    # 20% pods can be unavailable
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: app-service
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

## Environment Promotion Pipeline

```bash
#!/bin/bash
# Environment promotion script

promote_environment() {
  local source_env=$1
  local target_env=$2
  local version=$3
  
  echo "Promoting from $source_env to $target_env"
  
  # Pre-deployment validation
  validate_environment $source_env $version
  
  # Database migration check
  check_migrations $target_env $version
  
  # Deploy with validation
  deploy_to_environment $target_env $version
  
  # Post-deployment verification
  run_smoke_tests $target_env
  verify_metrics $target_env
  
  echo "Successfully promoted $version to $target_env"
}

validate_environment() {
  local env=$1
  local version=$2
  
  # Check environment health
  curl -f "https://$env.myapp.com/health" || exit 1
  
  # Validate version compatibility
  local current_version=$(kubectl get deployment app -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)
  validate_version_compatibility $current_version $version
}

run_smoke_tests() {
  local env=$1
  
  # Run critical path tests
  newman run tests/smoke-tests.json \
    --env-var "base_url=https://$env.myapp.com" \
    --reporters cli,junit \
    --reporter-junit-export smoke-results.xml
}
```

## Infrastructure as Code Integration

```terraform
# Deployment infrastructure
resource "aws_codedeploy_application" "app" {
  name = "my-application"
  compute_platform = "ECS"
}

resource "aws_codedeploy_deployment_config" "blue_green" {
  deployment_config_name = "custom-blue-green"
  compute_platform       = "ECS"

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    terminate_blue_instances_on_deployment_success {
      action                         = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }
}

resource "aws_codedeploy_deployment_group" "production" {
  deployment_group_name  = "production"
  service_role_arn      = aws_iam_role.codedeploy.arn
  deployment_config_name = aws_codedeploy_deployment_config.blue_green.id

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    alarms  = ["deployment-errors", "deployment-latency"]
    enabled = true
  }
}
```

## Deployment Validation Framework

```typescript
interface DeploymentValidator {
  validate(): Promise<ValidationResult>;
}

class ComprehensiveValidator {
  private validators: DeploymentValidator[] = [
    new HealthCheckValidator(),
    new MetricsValidator(),
    new SecurityValidator(),
    new PerformanceValidator()
  ];

  async validateDeployment(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.validators.map(v => v.validate())
    );

    const failures = results
      .filter(r => r.status === 'rejected' || !r.value.success)
      .map(r => r.status === 'rejected' ? r.reason : r.value.error);

    if (failures.length > 0) {
      console.error('Deployment validation failed:', failures);
      return false;
    }

    return true;
  }
}

class HealthCheckValidator implements DeploymentValidator {
  async validate(): Promise<ValidationResult> {
    const endpoints = ['/health', '/ready', '/metrics'];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${process.env.BASE_URL}${endpoint}`);
      if (!response.ok) {
        return { success: false, error: `${endpoint} health check failed` };
      }
    }
    
    return { success: true };
  }
}
```

## Best Practices

1. **Progressive Rollouts**: Start with small traffic percentages
2. **Health Validation**: Implement comprehensive health checks
3. **Automated Rollback**: Define clear rollback triggers and automation
4. **Feature Flags**: Decouple deployment from feature release
5. **Environment Parity**: Keep staging and production identical
6. **Monitoring Integration**: Track deployment metrics and business KPIs
7. **Infrastructure Versioning**: Version infrastructure changes with code