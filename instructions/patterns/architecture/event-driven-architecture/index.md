# Event-Driven Architecture

## 🎯 Quick Access by Topic

### Core Implementation
- **Event Modeling**: `01-event-modeling.md` - Domain events, event storming
- **Event Store**: `02-event-store.md` - Persistence, versioning, snapshots
- **Message Bus**: `03-message-bus.md` - Event publishing, subscribers, brokers

### Advanced Patterns
- **CQRS**: `04-cqrs.md` - Command/query separation, read models
- **Projections**: `05-projections.md` - View materialization, denormalization
- **Saga Patterns**: `06-saga-patterns.md` - Process managers, orchestration

### Production
- **Monitoring**: `07-monitoring.md` - Observability, metrics, debugging

## 📚 Learning Path

### 1. Event Foundation (Start Here)
```yaml
01-event-modeling.md:
  understand: Domain events, event storming techniques
  implement: Base event classes, domain modeling
```

### 2. Event Persistence
```yaml
02-event-store.md:
  implement: Event storage, versioning strategies
  optimize: Snapshots, performance tuning
```

### 3. Event Communication
```yaml
03-message-bus.md:
  implement: In-memory and distributed event buses
  integrate: Message brokers, pub/sub patterns
```

### 4. Read/Write Separation
```yaml
04-cqrs.md:
  implement: Command handlers, query services
  design: Separate read/write models
```

### 5. View Materialization
```yaml
05-projections.md:
  implement: Event handlers, view updates
  optimize: Incremental updates, rebuilding
```

### 6. Process Orchestration
```yaml
06-saga-patterns.md:
  implement: Long-running processes, compensation
  coordinate: Multi-service transactions
```

### 7. Production Operations
```yaml
07-monitoring.md:
  monitor: Event flow, processing lag
  debug: Event replay, correlation tracking
```