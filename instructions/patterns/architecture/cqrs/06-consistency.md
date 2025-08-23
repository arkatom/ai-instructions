# Consistency Patterns

## 一貫性モデル

### 結果整合性
- **定義**: 最終的にすべてのノードが同じ状態に収束
- **適用**: 読み込みモデル、分散システム
- **SLA**: 通常数秒〜数分以内

### 強一貫性領域
```typescript
// アグリゲート内は強一貫性
class Order {
  private items: OrderItem[] = [];
  
  addItem(item: OrderItem): void {
    // アグリゲート境界内は即座に一貫性保証
    if (this.getTotalItems() + item.quantity > 100) {
      throw new Error('Order limit exceeded');
    }
    this.items.push(item);
  }
}
```

## Sagaパターン

### コレオグラフィー型
```typescript
// イベント駆動で自律的に協調
class InventorySaga {
  @EventHandler(OrderCreated)
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.reserveInventory(event.items);
      await this.publish(new InventoryReservedEvent(event.orderId));
    } catch (error) {
      await this.publish(new InventoryReservationFailedEvent(event.orderId));
    }
  }
}

class PaymentSaga {
  @EventHandler(InventoryReserved)
  async handleInventoryReserved(event: InventoryReservedEvent): Promise<void> {
    // 次のステップを自律的に実行
    await this.processPayment(event.orderId);
  }
}
```

### オーケストレーション型
```typescript
class OrderSagaOrchestrator {
  async execute(orderId: string): Promise<void> {
    const saga = new SagaDefinition()
      .step('reserve-inventory', ReserveInventoryCommand)
      .compensate('cancel-reservation', CancelReservationCommand)
      .step('process-payment', ProcessPaymentCommand)
      .compensate('refund-payment', RefundPaymentCommand)
      .step('ship-order', ShipOrderCommand);
    
    await this.sagaExecutor.run(saga, { orderId });
  }
}
```

## 補償トランザクション

```typescript
class CompensatingTransaction {
  async execute(actions: Action[]): Promise<void> {
    const executed: Action[] = [];
    
    try {
      for (const action of actions) {
        await action.execute();
        executed.push(action);
      }
    } catch (error) {
      // 実行済みアクションを逆順で補償
      for (const action of executed.reverse()) {
        await action.compensate();
      }
      throw error;
    }
  }
}
```

## 冪等性保証

```typescript
class IdempotentEventHandler {
  async handle(event: DomainEvent): Promise<void> {
    // イベントIDで処理済みチェック
    const processed = await this.db.exists(
      'processed_events',
      { event_id: event.id }
    );
    
    if (processed) return;
    
    await this.db.transaction(async (tx) => {
      // ビジネスロジック実行
      await this.processEvent(event, tx);
      
      // 処理済みマーク
      await tx.insert('processed_events', {
        event_id: event.id,
        processed_at: new Date()
      });
    });
  }
}
```

## バージョン管理

### 楽観的ロック
```typescript
class OptimisticLocking {
  async update(aggregate: Aggregate): Promise<void> {
    const currentVersion = await this.getVersion(aggregate.id);
    
    if (currentVersion !== aggregate.version) {
      throw new ConcurrencyException('Version mismatch');
    }
    
    aggregate.incrementVersion();
    await this.save(aggregate);
  }
}
```

## 同期化パターン

### Pull型同期
```typescript
class PullSynchronization {
  async sync(): Promise<void> {
    const lastSync = await this.getLastSyncTime();
    const events = await this.eventStore.getEventsSince(lastSync);
    
    for (const event of events) {
      await this.projection.handle(event);
    }
    
    await this.updateLastSyncTime(new Date());
  }
}
```

### Push型同期
```typescript
class PushSynchronization {
  constructor(private subscribers: Subscriber[]) {}
  
  async publishEvent(event: DomainEvent): Promise<void> {
    // 全サブスクライバーに並列プッシュ
    await Promise.allSettled(
      this.subscribers.map(s => s.notify(event))
    );
  }
}
```

## 整合性チェック

```typescript
class ConsistencyChecker {
  async validateConsistency(): Promise<ConsistencyReport> {
    const writeData = await this.getWriteModelState();
    const readData = await this.getReadModelState();
    
    const discrepancies = [];
    
    for (const entity of writeData) {
      const readEntity = readData.find(r => r.id === entity.id);
      
      if (!readEntity || !this.isConsistent(entity, readEntity)) {
        discrepancies.push({
          entityId: entity.id,
          writeState: entity,
          readState: readEntity
        });
      }
    }
    
    return {
      totalEntities: writeData.length,
      discrepancies,
      consistencyRate: 1 - (discrepancies.length / writeData.length)
    };
  }
}
```

## 監視とアラート

```yaml
alerts:
  - name: high_consistency_lag
    expr: consistency_lag_seconds > 60
    severity: warning
  - name: saga_failure_rate
    expr: rate(saga_failures[5m]) > 0.01
    severity: critical
```

## ベストプラクティス

✅ **推奨**:
- アグリゲート境界の明確化
- 冪等性の保証
- 補償処理の実装
- 一貫性SLAの定義
- 定期的な整合性検証

❌ **避けるべき**:
- 分散トランザクション
- 同期的な全体更新
- 無限リトライ
- バージョン管理の欠如
- 補償処理なしのSaga