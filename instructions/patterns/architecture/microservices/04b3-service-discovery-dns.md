# Microservices - Service Discovery DNS-based

> DNS SRVレコード、動的DNS更新、DNS-based Service Discovery

## 概要

DNS-based Service Discoveryは、標準的なDNSプロトコルを使用してサービス発見を実現するアプローチです。SRVレコードを活用することで、サービスの位置、ポート、優先度、重みを動的に管理でき、既存のDNSインフラストラクチャを活用した軽量なService Discovery機能を提供します。

## 関連ファイル
- [Service Discovery基礎](./04-service-discovery-basics.md) - 基本概念とクライアントサイド実装
- [Service Discoveryサーバーサイド](./04b-service-discovery-server.md) - サーバーサイド実装概要
- [Service Discovery API Gateway](./04b1-service-discovery-gateway.md) - API Gateway統合パターン
- [Service Discovery Kubernetes](./04b2-service-discovery-k8s.md) - Kubernetes統合パターン

## DNS Service Discovery実装

### 1. DNS Service Discovery Core実装

```typescript
// shared/infrastructure/dns-service-discovery.ts
import * as dns from 'dns';
import { promisify } from 'util';

const resolveSrv = promisify(dns.resolveSrv);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveTxt = promisify(dns.resolveTxt);

export class DNSServiceDiscovery implements ServiceRegistry {
  private cache = new Map<string, CacheEntry>();
  private cacheTimeout = 300000; // 5分

  constructor(
    private dnsConfig: DNSConfig,
    private logger: Logger
  ) {}

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    const cacheKey = `service:${serviceName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.logger.debug('Returning cached service instances', { serviceName });
      return cached.instances;
    }

    try {
      // SRVレコードからサービス情報を取得
      const srvRecords = await this.resolveSRVRecords(serviceName);
      const instances: ServiceInstance[] = [];
      
      for (const record of srvRecords) {
        try {
          // IPv4アドレス解決
          const ipv4Addresses = await this.resolveIPv4(record.name);
          
          // IPv6アドレス解決（オプション）
          let ipv6Addresses: string[] = [];
          if (this.dnsConfig.enableIPv6) {
            try {
              ipv6Addresses = await this.resolveIPv6(record.name);
            } catch (error) {
              this.logger.debug('IPv6 resolution failed', { hostname: record.name });
            }
          }

          // TXTレコードから追加メタデータを取得
          const metadata = await this.resolveServiceMetadata(serviceName, record);

          // 各IPアドレスに対してインスタンスを作成
          const allAddresses = [...ipv4Addresses, ...ipv6Addresses];
          
          for (const ip of allAddresses) {
            const instance: ServiceInstance = {
              id: `${serviceName}-${record.name}-${record.port}-${ip}`,
              serviceName,
              host: ip,
              port: record.port,
              healthCheckUrl: `http://${ip}:${record.port}/health`,
              metadata: {
                priority: record.priority.toString(),
                weight: record.weight.toString(),
                hostname: record.name,
                ipVersion: ip.includes(':') ? 'ipv6' : 'ipv4',
                ...metadata
              },
              weight: record.weight,
              status: ServiceStatus.UP,
              lastHeartbeat: new Date()
            };

            instances.push(instance);
          }
        } catch (error) {
          this.logger.warn('Failed to resolve addresses for host', {
            hostname: record.name,
            error: error.message
          });
        }
      }

      // 優先度とウェイトで並び替え
      const sortedInstances = this.sortByPriorityAndWeight(instances);
      
      // キャッシュに保存
      this.cache.set(cacheKey, {
        instances: sortedInstances,
        timestamp: Date.now()
      });

      this.logger.info('DNS service discovery completed', {
        serviceName,
        instanceCount: sortedInstances.length,
        srvRecordCount: srvRecords.length
      });

      return sortedInstances;

    } catch (error) {
      this.logger.error('DNS service discovery failed', { serviceName, error });
      return [];
    }
  }

  private async resolveSRVRecords(serviceName: string): Promise<SRVRecord[]> {
    const srvName = `_${serviceName}._tcp.${this.dnsConfig.domain}`;
    this.logger.debug('Resolving SRV records', { srvName });
    
    try {
      const records = await resolveSrv(srvName);
      return records.sort((a, b) => {
        // 優先度順、同じ優先度なら重み順
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.weight - a.weight;
      });
    } catch (error) {
      throw new Error(`Failed to resolve SRV records for ${srvName}: ${error.message}`);
    }
  }

  private async resolveIPv4(hostname: string): Promise<string[]> {
    return await resolve4(hostname);
  }

  private async resolveIPv6(hostname: string): Promise<string[]> {
    return await resolve6(hostname);
  }

  private async resolveServiceMetadata(serviceName: string, record: SRVRecord): Promise<Record<string, string>> {
    try {
      const txtName = `_${serviceName}._tcp.${record.name}`;
      const txtRecords = await resolveTxt(txtName);
      
      const metadata: Record<string, string> = {};
      
      for (const record of txtRecords) {
        const txt = record.join('');
        const pairs = txt.split(';');
        
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            metadata[key.trim()] = value.trim();
          }
        }
      }
      
      return metadata;
    } catch (error) {
      // TXTレコードが存在しない場合は空のメタデータを返す
      return {};
    }
  }

  private sortByPriorityAndWeight(instances: ServiceInstance[]): ServiceInstance[] {
    return instances.sort((a, b) => {
      const priorityA = parseInt(a.metadata.priority || '0');
      const priorityB = parseInt(b.metadata.priority || '0');
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // 低い優先度が先
      }
      
      const weightA = parseInt(a.metadata.weight || '1');
      const weightB = parseInt(b.metadata.weight || '1');
      
      return weightB - weightA; // 高いウェイトが先
    });
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.discover(serviceName);
    if (instances.length === 0) {
      throw new Error(`No instances found for service: ${serviceName}`);
    }

    // 重みに基づく選択
    const instance = this.selectByWeight(instances);
    return `http://${instance.host}:${instance.port}`;
  }

  private selectByWeight(instances: ServiceInstance[]): ServiceInstance {
    // 優先度でグループ化
    const minPriority = Math.min(...instances.map(i => parseInt(i.metadata.priority || '0')));
    const highPriorityInstances = instances.filter(i => 
      parseInt(i.metadata.priority || '0') === minPriority
    );

    // 重み付きランダム選択
    const totalWeight = highPriorityInstances.reduce((sum, instance) => sum + (instance.weight || 1), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const instance of highPriorityInstances) {
      currentWeight += instance.weight || 1;
      if (random <= currentWeight) {
        return instance;
      }
    }
    
    return highPriorityInstances[0];
  }

  async refreshCache(serviceName?: string): Promise<void> {
    if (serviceName) {
      this.cache.delete(`service:${serviceName}`);
    } else {
      this.cache.clear();
    }
    this.logger.info('DNS cache refreshed', { serviceName });
  }

  getCacheStats(): CacheStats {
    const entries = Array.from(this.cache.entries());
    return {
      totalEntries: entries.length,
      entries: entries.map(([key, entry]) => ({
        key,
        instanceCount: entry.instances.length,
        age: Date.now() - entry.timestamp
      }))
    };
  }

  // DNS-basedでは以下は通常実装しない
  async register(instance: ServiceInstance): Promise<void> {
    throw new Error('Registration not supported in DNS-based discovery. Use dynamic DNS updates.');
  }

  async deregister(instanceId: string): Promise<void> {
    throw new Error('Deregistration not supported in DNS-based discovery. Use dynamic DNS updates.');
  }

  async heartbeat(instanceId: string): Promise<void> {
    // DNS-basedでは通常不要（TTLで管理）
  }
}

interface SRVRecord {
  priority: number;
  weight: number;
  port: number;
  name: string;
}

interface DNSConfig {
  domain: string;
  ttl: number;
  enableIPv6: boolean;
}

interface CacheEntry {
  instances: ServiceInstance[];
  timestamp: number;
}

interface CacheStats {
  totalEntries: number;
  entries: Array<{
    key: string;
    instanceCount: number;
    age: number;
  }>;
}
```

### 2. 動的DNS更新機能

```typescript
// shared/infrastructure/dynamic-dns-updater.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DynamicDNSUpdater {
  constructor(
    private config: DNSUpdateConfig,
    private logger: Logger
  ) {}

  async registerService(instance: ServiceInstance): Promise<void> {
    try {
      // SRVレコードの追加
      await this.addSRVRecord(instance);
      
      // Aレコードの追加
      await this.addARecord(instance);
      
      // TXTレコードの追加（メタデータ）
      if (Object.keys(instance.metadata || {}).length > 0) {
        await this.addTXTRecord(instance);
      }

      this.logger.info('Service registered in DNS', {
        serviceName: instance.serviceName,
        host: instance.host,
        port: instance.port
      });
    } catch (error) {
      this.logger.error('Failed to register service in DNS', {
        serviceName: instance.serviceName,
        error: error.message
      });
      throw error;
    }
  }

  async deregisterService(instance: ServiceInstance): Promise<void> {
    try {
      // レコードの削除
      await this.removeSRVRecord(instance);
      await this.removeARecord(instance);
      await this.removeTXTRecord(instance);

      this.logger.info('Service deregistered from DNS', {
        serviceName: instance.serviceName,
        host: instance.host
      });
    } catch (error) {
      this.logger.error('Failed to deregister service from DNS', {
        serviceName: instance.serviceName,
        error: error.message
      });
      throw error;
    }
  }

  private async addSRVRecord(instance: ServiceInstance): Promise<void> {
    const srvName = `_${instance.serviceName}._tcp.${this.config.domain}`;
    const srvValue = `${instance.weight || 10} ${instance.port} ${this.getHostname(instance)}.`;
    
    const command = this.buildNSUpdateCommand([
      `update add ${srvName} ${this.config.ttl} SRV ${srvValue}`
    ]);

    await this.executeNSUpdate(command);
  }

  private async addARecord(instance: ServiceInstance): Promise<void> {
    const hostname = `${this.getHostname(instance)}.${this.config.domain}`;
    
    const command = this.buildNSUpdateCommand([
      `update add ${hostname} ${this.config.ttl} A ${instance.host}`
    ]);

    await this.executeNSUpdate(command);
  }

  private async addTXTRecord(instance: ServiceInstance): Promise<void> {
    const txtName = `_${instance.serviceName}._tcp.${this.getHostname(instance)}.${this.config.domain}`;
    const metadata = instance.metadata || {};
    
    const txtValue = Object.entries(metadata)
      .map(([key, value]) => `${key}=${value}`)
      .join(';');

    if (txtValue) {
      const command = this.buildNSUpdateCommand([
        `update add ${txtName} ${this.config.ttl} TXT "${txtValue}"`
      ]);

      await this.executeNSUpdate(command);
    }
  }

  private async removeSRVRecord(instance: ServiceInstance): Promise<void> {
    const srvName = `_${instance.serviceName}._tcp.${this.config.domain}`;
    const srvValue = `${instance.weight || 10} ${instance.port} ${this.getHostname(instance)}.`;
    
    const command = this.buildNSUpdateCommand([
      `update delete ${srvName} SRV ${srvValue}`
    ]);

    await this.executeNSUpdate(command);
  }

  private async removeARecord(instance: ServiceInstance): Promise<void> {
    const hostname = `${this.getHostname(instance)}.${this.config.domain}`;
    
    const command = this.buildNSUpdateCommand([
      `update delete ${hostname} A ${instance.host}`
    ]);

    await this.executeNSUpdate(command);
  }

  private async removeTXTRecord(instance: ServiceInstance): Promise<void> {
    const txtName = `_${instance.serviceName}._tcp.${this.getHostname(instance)}.${this.config.domain}`;
    
    const command = this.buildNSUpdateCommand([
      `update delete ${txtName} TXT`
    ]);

    await this.executeNSUpdate(command);
  }

  private getHostname(instance: ServiceInstance): string {
    return `${instance.serviceName}-${instance.id.split('-').pop()}`;
  }

  private buildNSUpdateCommand(updates: string[]): string {
    const commands = [
      `server ${this.config.dnsServer}`,
      `zone ${this.config.domain}`,
      ...updates,
      'send'
    ];

    return commands.join('\n');
  }

  private async executeNSUpdate(command: string): Promise<void> {
    const nsUpdateCommand = `echo "${command}" | nsupdate`;
    
    if (this.config.keyFile) {
      nsUpdateCommand = `echo "${command}" | nsupdate -k ${this.config.keyFile}`;
    }

    try {
      const { stdout, stderr } = await execAsync(nsUpdateCommand);
      
      if (stderr && !stderr.includes('NOERROR')) {
        throw new Error(`nsupdate failed: ${stderr}`);
      }
      
      this.logger.debug('DNS update executed successfully', { stdout, stderr });
    } catch (error) {
      throw new Error(`Failed to execute nsupdate: ${error.message}`);
    }
  }

  async validateDNSConfig(): Promise<boolean> {
    try {
      // DNS設定の検証
      const testCommand = this.buildNSUpdateCommand([
        'prereq nxdomain test.validation.record'
      ]);
      
      await this.executeNSUpdate(testCommand);
      return true;
    } catch (error) {
      this.logger.error('DNS configuration validation failed', { error: error.message });
      return false;
    }
  }
}

interface DNSUpdateConfig {
  domain: string;
  dnsServer: string;
  ttl: number;
  keyFile?: string; // TSIG認証用のキーファイル
}
```

## DNS設定例

### 1. BIND DNS設定

```bash
# /etc/bind/named.conf.local - BIND DNS設定
zone "microservices.local" {
    type master;
    file "/var/lib/bind/microservices.local.zone";
    allow-update { key "microservices-key"; };
    notify yes;
};

# TSIG認証キー設定
key "microservices-key" {
    algorithm hmac-sha256;
    secret "base64-encoded-secret-key";
};
```

### 2. ゾーンファイル設定

```bash
# /var/lib/bind/microservices.local.zone
$ORIGIN microservices.local.
$TTL 300

@       IN      SOA     ns1.microservices.local. admin.microservices.local. (
                        2023082401      ; Serial
                        3600           ; Refresh
                        1800           ; Retry
                        1209600        ; Expire
                        300            ; Minimum TTL
                )

        IN      NS      ns1.microservices.local.

ns1     IN      A       192.168.1.10

; サービス定義（SRVレコード）
_user-service._tcp      SRV     10 10 3000 user-1
_user-service._tcp      SRV     10 10 3000 user-2
_user-service._tcp      SRV     20 5  3000 user-backup

_order-service._tcp     SRV     10 10 3001 order-1
_order-service._tcp     SRV     10 10 3001 order-2

_inventory-service._tcp SRV     10 15 3002 inventory-1
_inventory-service._tcp SRV     15 10 3002 inventory-2

; ホスト定義（Aレコード）
user-1          IN      A       192.168.1.11
user-2          IN      A       192.168.1.12
user-backup     IN      A       192.168.1.13

order-1         IN      A       192.168.1.21
order-2         IN      A       192.168.1.22

inventory-1     IN      A       192.168.1.31
inventory-2     IN      A       192.168.1.32

; サービスメタデータ（TXTレコード）
_user-service._tcp.user-1       TXT     "version=v1.2.0;environment=production;region=us-east-1"
_user-service._tcp.user-2       TXT     "version=v1.2.0;environment=production;region=us-east-1"
_user-service._tcp.user-backup  TXT     "version=v1.1.0;environment=production;region=us-west-1"

_order-service._tcp.order-1     TXT     "version=v2.0.0;environment=production;database=primary"
_order-service._tcp.order-2     TXT     "version=v2.0.0;environment=production;database=replica"
```

### 3. DNS設定の使用例

```typescript
// app/config/dns-discovery-setup.ts
export class DNSDiscoverySetup {
  static createDNSDiscovery(): DNSServiceDiscovery {
    const dnsConfig: DNSConfig = {
      domain: 'microservices.local',
      ttl: 300,
      enableIPv6: false
    };

    const logger = new Logger('dns-discovery');
    return new DNSServiceDiscovery(dnsConfig, logger);
  }

  static createDNSUpdater(): DynamicDNSUpdater {
    const updateConfig: DNSUpdateConfig = {
      domain: 'microservices.local',
      dnsServer: '192.168.1.10',
      ttl: 300,
      keyFile: '/etc/microservices/dns-key.conf'
    };

    const logger = new Logger('dns-updater');
    return new DynamicDNSUpdater(updateConfig, logger);
  }
}

// 使用例
const dnsDiscovery = DNSDiscoverySetup.createDNSDiscovery();
const instances = await dnsDiscovery.discover('user-service');

console.log(`Found ${instances.length} instances for user-service:`);
instances.forEach(instance => {
  console.log(`- ${instance.host}:${instance.port} (weight: ${instance.weight}, priority: ${instance.metadata.priority})`);
});
```

DNS-based Service Discoveryにより、標準的なDNSプロトコルを活用した軽量で堅牢なサービス発見機能を実現できます。