# Production Deployment

## Deployment Architecture

```yaml
production_architecture:
  write_side:
    command_api:
      instances: 3
      load_balancer: nginx
      health_check: /health
    event_store:
      type: EventStore
      cluster_size: 3
      replication: synchronous
    command_processors:
      instances: 5
      scaling: auto
      
  read_side:
    query_api:
      instances: 10
      load_balancer: cloudflare
      cache: edge
    read_databases:
      primary:
        type: PostgreSQL
        replicas: 3
      cache:
        type: Redis
        cluster: true
    projections:
      workers: 5
      parallelism: 10
```

## Infrastructure as Code

```typescript
// Terraform configuration for CQRS deployment
const infrastructure = {
  // Write side infrastructure
  writeCluster: {
    type: 'kubernetes',
    nodes: 3,
    resources: {
      cpu: '4 cores',
      memory: '16GB',
      storage: 'SSD 500GB'
    }
  },

  // Read side infrastructure
  readCluster: {
    type: 'kubernetes',
    nodes: 5,
    resources: {
      cpu: '8 cores',
      memory: '32GB',
      storage: 'SSD 1TB'
    }
  },

  // Event store
  eventStore: {
    type: 'managed',
    provider: 'EventStore Cloud',
    size: 'production',
    backup: {
      frequency: 'hourly',
      retention: '30 days'
    }
  },

  // Monitoring
  monitoring: {
    prometheus: true,
    grafana: true,
    elasticStack: true
  }
};
```

## Health Checks and Monitoring

```typescript
class ProductionHealthCheck {
  async checkSystem(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkWriteSide(),
      this.checkReadSide(),
      this.checkEventStore(),
      this.checkProjections()
    ]);

    return {
      status: this.aggregateStatus(checks),
      components: checks,
      timestamp: new Date()
    };
  }

  private async checkWriteSide(): Promise<ComponentHealth> {
    const commandApiHealth = await this.pingCommandApi();
    const eventStoreHealth = await this.checkEventStoreConnection();
    
    return {
      name: 'WriteSide',
      status: commandApiHealth && eventStoreHealth ? 'healthy' : 'unhealthy',
      details: {
        commandApi: commandApiHealth,
        eventStore: eventStoreHealth
      }
    };
  }

  private async checkProjections(): Promise<ComponentHealth> {
    const lag = await this.getProjectionLag();
    const isHealthy = lag < 1000; // Less than 1000 events behind
    
    return {
      name: 'Projections',
      status: isHealthy ? 'healthy' : 'degraded',
      details: {
        lag,
        lastProcessed: await this.getLastProcessedEvent()
      }
    };
  }
}

// Metrics collection
class ProductionMetrics {
  private prometheus: PrometheusClient;

  recordCommandExecution(command: Command, duration: number, success: boolean): void {
    this.prometheus.histogram('cqrs_command_duration', duration, {
      command_type: command.type,
      success: success.toString()
    });

    this.prometheus.counter('cqrs_command_total', 1, {
      command_type: command.type,
      status: success ? 'success' : 'failure'
    });
  }

  recordQueryExecution(query: Query, duration: number, resultCount: number): void {
    this.prometheus.histogram('cqrs_query_duration', duration, {
      query_type: query.type
    });

    this.prometheus.histogram('cqrs_query_result_count', resultCount, {
      query_type: query.type
    });
  }
}
```

## Disaster Recovery

```typescript
class DisasterRecovery {
  async performBackup(): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    
    // Backup event store
    const eventBackup = await this.backupEventStore(backupId);
    
    // Backup read models
    const readBackup = await this.backupReadModels(backupId);
    
    // Store backup metadata
    await this.storeBackupMetadata({
      id: backupId,
      timestamp: new Date(),
      eventStoreBackup: eventBackup,
      readModelBackup: readBackup
    });

    return { backupId, status: 'completed' };
  }

  async restoreFromBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId);
    
    // Restore event store
    await this.restoreEventStore(metadata.eventStoreBackup);
    
    // Rebuild projections from events
    await this.rebuildProjections();
    
    // Verify integrity
    await this.verifySystemIntegrity();
  }

  private async rebuildProjections(): Promise<void> {
    console.log('Starting projection rebuild');
    
    // Clear existing read models
    await this.clearReadModels();
    
    // Replay all events
    const eventStream = await this.eventStore.getAllEvents();
    
    for await (const event of eventStream) {
      await this.projectionEngine.project(event);
    }
    
    console.log('Projection rebuild completed');
  }
}
```

## Security Configuration

```typescript
class ProductionSecurity {
  configureAuthentication(): AuthConfig {
    return {
      type: 'JWT',
      issuer: process.env.AUTH_ISSUER,
      audience: process.env.AUTH_AUDIENCE,
      algorithms: ['RS256'],
      publicKey: process.env.AUTH_PUBLIC_KEY
    };
  }

  configureAuthorization(): AuthzConfig {
    return {
      commandPermissions: {
        'CreateOrder': ['user', 'admin'],
        'CancelOrder': ['admin'],
        'UpdateInventory': ['inventory_manager', 'admin']
      },
      queryPermissions: {
        'GetOrder': ['user', 'admin'],
        'GetAllOrders': ['admin'],
        'GetInventory': ['inventory_viewer', 'admin']
      }
    };
  }

  configureEncryption(): EncryptionConfig {
    return {
      eventStore: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        keyManagement: 'AWS KMS'
      },
      readModels: {
        sensitiveFields: ['ssn', 'creditCard', 'email'],
        encryptionMethod: 'AES-256-GCM'
      }
    };
  }
}
```

## Deployment Checklist

```yaml
pre_deployment:
  - Run all tests
  - Check database migrations
  - Verify configuration
  - Review security settings
  - Backup current state

deployment:
  - Deploy command side first
  - Verify command processing
  - Deploy query side
  - Verify query responses
  - Enable projections
  - Monitor projection lag

post_deployment:
  - Verify health checks
  - Check monitoring dashboards
  - Run smoke tests
  - Monitor error rates
  - Document deployment

rollback_plan:
  - Keep previous version running
  - Blue-green deployment ready
  - Database rollback scripts prepared
  - Event store snapshot available
  - Communication plan ready
```

## Best Practices

1. **Blue-Green Deployment**: Use for zero-downtime deployments
2. **Health Checks**: Implement comprehensive health monitoring
3. **Backup Strategy**: Regular backups of event store and snapshots
4. **Security**: Implement proper authentication and authorization
5. **Monitoring**: Track all key metrics and set up alerts
6. **Documentation**: Maintain runbooks for common scenarios