# Multi-Environment Management

## Environment Configuration Matrix

```typescript
interface EnvironmentConfig {
  name: string;
  tier: 'development' | 'staging' | 'production';
  resources: ResourceConfiguration;
  scaling: ScalingConfiguration;
  monitoring: MonitoringConfiguration;
  security: SecurityConfiguration;
}

class EnvironmentManager {
  private environments: Map<string, EnvironmentConfig> = new Map();

  constructor() {
    this.initializeEnvironments();
  }

  private initializeEnvironments(): void {
    const configs: EnvironmentConfig[] = [
      {
        name: 'dev',
        tier: 'development',
        resources: { cpu: '500m', memory: '512Mi', replicas: 1 },
        scaling: { minReplicas: 1, maxReplicas: 3, targetCPU: 70 },
        monitoring: { logLevel: 'debug', metricsInterval: 60 },
        security: { tlsRequired: false, rateLimiting: false }
      },
      {
        name: 'staging',
        tier: 'staging',
        resources: { cpu: '1000m', memory: '1Gi', replicas: 2 },
        scaling: { minReplicas: 2, maxReplicas: 5, targetCPU: 60 },
        monitoring: { logLevel: 'info', metricsInterval: 30 },
        security: { tlsRequired: true, rateLimiting: true }
      },
      {
        name: 'production',
        tier: 'production',
        resources: { cpu: '2000m', memory: '2Gi', replicas: 3 },
        scaling: { minReplicas: 3, maxReplicas: 20, targetCPU: 50 },
        monitoring: { logLevel: 'warn', metricsInterval: 15 },
        security: { tlsRequired: true, rateLimiting: true }
      }
    ];

    configs.forEach(config => this.environments.set(config.name, config));
  }

  generateManifest(envName: string, application: string): string {
    const config = this.environments.get(envName);
    if (!config) throw new Error(`Environment ${envName} not found`);

    return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${application}
  namespace: ${envName}
  labels:
    app: ${application}
    environment: ${envName}
spec:
  replicas: ${config.resources.replicas}
  selector:
    matchLabels:
      app: ${application}
  template:
    metadata:
      labels:
        app: ${application}
        environment: ${envName}
    spec:
      containers:
      - name: ${application}
        image: ${application}:latest
        resources:
          requests:
            cpu: ${config.resources.cpu}
            memory: ${config.resources.memory}
          limits:
            cpu: ${config.resources.cpu}
            memory: ${config.resources.memory}
        env:
        - name: LOG_LEVEL
          value: "${config.monitoring.logLevel}"
        - name: ENVIRONMENT
          value: "${envName}"
    `;
  }
}
```

## Infrastructure as Code per Environment

```hcl
# environments/production/main.tf
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

locals {
  env_config = {
    development = {
      instance_type = "t3.micro"
      min_capacity  = 1
      max_capacity  = 3
      database_size = "db.t3.micro"
    }
    staging = {
      instance_type = "t3.small"
      min_capacity  = 2
      max_capacity  = 5
      database_size = "db.t3.small"
    }
    production = {
      instance_type = "t3.medium"
      min_capacity  = 3
      max_capacity  = 20
      database_size = "db.t3.large"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"
  
  environment = var.environment
  cidr_block  = "10.${local.env_config[var.environment].vpc_offset}.0.0/16"
}

module "application" {
  source = "../../modules/application"
  
  environment     = var.environment
  instance_type   = local.env_config[var.environment].instance_type
  min_capacity    = local.env_config[var.environment].min_capacity
  max_capacity    = local.env_config[var.environment].max_capacity
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
}

module "database" {
  source = "../../modules/rds"
  
  environment     = var.environment
  instance_class  = local.env_config[var.environment].database_size
  backup_retention = var.environment == "production" ? 30 : 7
  multi_az        = var.environment == "production"
}
```

## Configuration Drift Detection

```bash
#!/bin/bash
# drift-detection.sh

detect_configuration_drift() {
    local environment=$1
    
    echo "Detecting configuration drift for $environment"
    
    # Terraform drift detection
    terraform plan -detailed-exitcode \
        -var="environment=$environment" \
        -out=drift-plan.out \
        environments/$environment/
    
    local terraform_exit_code=$?
    
    # Kubernetes drift detection
    kubectl diff -f manifests/$environment/ || true
    local kubectl_exit_code=$?
    
    # Application configuration drift
    check_app_config_drift $environment
    local app_config_exit_code=$?
    
    # Generate drift report
    generate_drift_report $environment $terraform_exit_code $kubectl_exit_code $app_config_exit_code
}

check_app_config_drift() {
    local environment=$1
    local expected_config="config/$environment.json"
    local actual_config="/tmp/actual-$environment.json"
    
    # Fetch current configuration
    kubectl get configmap app-config -n $environment -o jsonpath='{.data}' > $actual_config
    
    # Compare configurations
    if ! diff -q $expected_config $actual_config > /dev/null; then
        echo "Configuration drift detected in $environment"
        diff $expected_config $actual_config
        return 1
    fi
    
    return 0
}

auto_remediate_drift() {
    local environment=$1
    
    echo "Auto-remediating drift for $environment"
    
    # Apply Terraform changes
    if [[ -f drift-plan.out ]]; then
        terraform apply drift-plan.out
    fi
    
    # Apply Kubernetes manifests
    kubectl apply -f manifests/$environment/
    
    # Update application configuration
    kubectl create configmap app-config \
        --from-file=config/$environment.json \
        --dry-run=client -o yaml | \
        kubectl apply -n $environment -f -
}
```

## Environment Promotion Pipeline

```yaml
# .github/workflows/environment-promotion.yml
name: Environment Promotion

on:
  workflow_dispatch:
    inputs:
      source_environment:
        type: choice
        description: 'Source environment'
        options: ['dev', 'staging']
        required: true
      target_environment:
        type: choice
        description: 'Target environment'
        options: ['staging', 'production']
        required: true
      version:
        description: 'Version to promote'
        required: true

jobs:
  validate-promotion:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate promotion path
        run: |
          source="${{ github.event.inputs.source_environment }}"
          target="${{ github.event.inputs.target_environment }}"
          
          # Validate promotion order
          if [[ "$source" == "staging" && "$target" == "dev" ]]; then
            echo "Cannot promote from staging to dev"
            exit 1
          fi
          
          if [[ "$source" == "dev" && "$target" == "production" ]]; then
            echo "Cannot promote directly from dev to production"
            exit 1
          fi

  run-promotion-tests:
    needs: validate-promotion
    runs-on: ubuntu-latest
    steps:
      - name: Environment-specific tests
        run: |
          case "${{ github.event.inputs.target_environment }}" in
            "staging")
              npm run test:integration
              npm run test:compatibility
              ;;
            "production")
              npm run test:full-suite
              npm run test:performance
              npm run test:security
              ;;
          esac

  promote-configuration:
    needs: run-promotion-tests
    runs-on: ubuntu-latest
    steps:
      - name: Update environment config
        run: |
          # Update Terraform variables
          sed -i "s/version = .*/version = \"${{ github.event.inputs.version }}\"/" \
            environments/${{ github.event.inputs.target_environment }}/terraform.tfvars
          
          # Update Kubernetes manifests
          yq eval '.spec.template.spec.containers[0].image = 
            "myapp:${{ github.event.inputs.version }}"' \
            -i manifests/${{ github.event.inputs.target_environment }}/deployment.yaml

  deploy-to-target:
    needs: promote-configuration
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.target_environment }}
    steps:
      - name: Deploy infrastructure
        run: |
          cd environments/${{ github.event.inputs.target_environment }}
          terraform init
          terraform plan -out=promotion.plan
          terraform apply promotion.plan
      
      - name: Deploy application
        run: |
          kubectl apply -f manifests/${{ github.event.inputs.target_environment }}/
          kubectl rollout status deployment/app -n ${{ github.event.inputs.target_environment }}

  post-promotion-validation:
    needs: deploy-to-target
    runs-on: ubuntu-latest
    steps:
      - name: Smoke tests
        run: |
          target="${{ github.event.inputs.target_environment }}"
          base_url="https://$target.myapp.com"
          
          # Health check
          curl -f "$base_url/health" || exit 1
          
          # Functional tests
          newman run tests/smoke-tests.json \
            --env-var "base_url=$base_url"
```

## Cross-Environment Data Sync

```typescript
class DataSynchronizer {
  async syncEnvironmentData(source: string, target: string, options: SyncOptions): Promise<void> {
    console.log(`Syncing data from ${source} to ${target}`);
    
    // Validate sync is safe
    await this.validateSyncSafety(source, target);
    
    // Create backup before sync
    const backupId = await this.createBackup(target);
    
    try {
      // Sync different data types
      await Promise.all([
        this.syncDatabaseData(source, target, options.tables),
        this.syncFileStorage(source, target, options.buckets),
        this.syncConfiguration(source, target, options.configs)
      ]);
      
      // Validate sync completion
      await this.validateSyncIntegrity(source, target);
      
    } catch (error) {
      // Rollback on failure
      await this.restoreBackup(target, backupId);
      throw error;
    }
  }

  private async syncDatabaseData(source: string, target: string, tables: string[]): Promise<void> {
    for (const table of tables) {
      const sourceConn = this.getDatabaseConnection(source);
      const targetConn = this.getDatabaseConnection(target);
      
      // Use pg_dump/pg_restore for PostgreSQL
      const dumpCommand = `pg_dump -h ${sourceConn.host} -t ${table} -f /tmp/${table}.sql`;
      const restoreCommand = `psql -h ${targetConn.host} -f /tmp/${table}.sql`;
      
      await this.executeCommand(dumpCommand);
      await this.executeCommand(restoreCommand);
    }
  }

  private async syncFileStorage(source: string, target: string, buckets: string[]): Promise<void> {
    for (const bucket of buckets) {
      // AWS S3 sync
      const syncCommand = `aws s3 sync s3://${source}-${bucket} s3://${target}-${bucket} --delete`;
      await this.executeCommand(syncCommand);
    }
  }
}
```

## Environment Health Monitoring

```javascript
// environment-health-monitor.js
const environments = ['dev', 'staging', 'production'];

class EnvironmentHealthMonitor {
  async checkAllEnvironments() {
    const results = await Promise.allSettled(
      environments.map(env => this.checkEnvironmentHealth(env))
    );

    const report = results.map((result, index) => ({
      environment: environments[index],
      status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: result.status === 'fulfilled' ? result.value : result.reason
    }));

    await this.generateHealthReport(report);
    await this.sendAlertsIfNeeded(report);
  }

  async checkEnvironmentHealth(env) {
    const checks = [
      this.checkApplicationHealth(env),
      this.checkDatabaseHealth(env),
      this.checkInfrastructureHealth(env),
      this.checkSecurityHealth(env)
    ];

    const results = await Promise.all(checks);
    return {
      application: results[0],
      database: results[1],
      infrastructure: results[2],
      security: results[3],
      overall: results.every(r => r.healthy) ? 'healthy' : 'degraded'
    };
  }
}

// Schedule health checks
setInterval(async () => {
  const monitor = new EnvironmentHealthMonitor();
  await monitor.checkAllEnvironments();
}, 300000); // Every 5 minutes
```

## Best Practices

1. **Environment Parity**: Keep environments as similar as possible to production
2. **Configuration Management**: Use centralized configuration with environment overrides
3. **Automated Provisioning**: Use Infrastructure as Code for consistent environments
4. **Drift Detection**: Monitor and automatically remediate configuration drift
5. **Promotion Gates**: Implement validation gates between environment promotions
6. **Data Management**: Carefully plan data synchronization and privacy requirements
7. **Health Monitoring**: Continuously monitor all environments for degradation