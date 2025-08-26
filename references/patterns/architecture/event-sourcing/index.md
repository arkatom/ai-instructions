# Event Sourcing Pattern

## 🎯 Quick Access by Topic

### Core Implementation
- **Event Store**: `03-event-store.md` - Database, stream management, snapshots
- **Aggregates**: `04-aggregates.md` - State reconstruction, command validation
- **Projections**: `05-projections.md` - Read models, denormalization, CQRS

### Event Handling
- **Event Design**: `02-event-modeling.md` - Schema, metadata, versioning
- **Command Processing**: `04-aggregates.md#command-handlers` - Validation, business rules
- **Event Replay**: `06-advanced-patterns.md#replay` - Temporal queries, debugging

### Production Concerns
- **Performance**: `06-advanced-patterns.md#optimization` - Snapshots, caching
- **Schema Evolution**: `06-advanced-patterns.md#evolution` - Versioning strategies
- **Testing**: `06-advanced-patterns.md#testing` - Event verification, replay testing

## 📚 Learning Path

### 1. Foundation (Start Here)
```yaml
01-core-concepts.md:
  understand: Event sourcing philosophy, benefits vs challenges
  implement: Basic event structure, immutability patterns
```

### 2. Event Design
```yaml
02-event-modeling.md:
  design: Domain events, metadata, correlation
  implement: Event base classes, versioning
```

### 3. Storage Layer
```yaml
03-event-store.md:
  implement: Event persistence, stream management
  optimize: Snapshots, partitioning strategies
```

### 4. Domain Logic
```yaml
04-aggregates.md:
  implement: Event-sourced aggregates, command handlers
  validate: Business rules, invariants
```

### 5. Read Models
```yaml
05-projections.md:
  implement: Projections, denormalized views
  integrate: CQRS pattern, eventual consistency
```

### 6. Advanced Patterns
```yaml
06-advanced-patterns.md:
  master: Schema evolution, temporal queries
  optimize: Performance tuning, production deployment
```