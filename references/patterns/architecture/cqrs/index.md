# CQRS (Command Query Responsibility Segregation) Patterns

## 📚 Topic Navigation

### Core Concepts
- [Fundamentals](./01-fundamentals.md) - CQRS原則と基本実装
- [Command Handlers](./02-command-handlers.md) - コマンド処理パターン
- [Query Handlers](./03-query-handlers.md) - クエリ処理パターン

### Integration & Persistence
- [Event Sourcing Integration](./04-event-sourcing.md) - イベントソーシング統合
- [Read Models](./05-read-models.md) - 読み取りモデル設計
- [Consistency Patterns](./06-consistency.md) - 整合性管理

### Production Readiness
- [Testing Strategies](./07-testing.md) - テスト戦略
- [Performance Optimization](./08-performance.md) - パフォーマンス最適化
- [Production Deployment](./09-production.md) - 本番環境デプロイ

## 🎯 Learning Paths

### Beginner Path (2-3 days)
1. **Day 1**: [Fundamentals](./01-fundamentals.md) - 基本概念理解
2. **Day 2**: [Command Handlers](./02-command-handlers.md) - 基本実装
3. **Day 3**: [Query Handlers](./03-query-handlers.md) - 読み取り側実装

### Intermediate Path (1 week)
1. **基礎**: Beginner Path全体
2. **統合**: [Event Sourcing](./04-event-sourcing.md) - イベント駆動連携
3. **永続化**: [Read Models](./05-read-models.md) - 投影実装
4. **品質**: [Testing](./07-testing.md) - テスト設計

### Advanced Path (2 weeks)
1. **全基礎**: Intermediate Path全体
2. **整合性**: [Consistency](./06-consistency.md) - 分散システム対応
3. **最適化**: [Performance](./08-performance.md) - スケーラビリティ
4. **本番化**: [Production](./09-production.md) - 運用考慮事項

## 🔧 Quick Reference

| Pattern | Use Case | Complexity | File |
|---------|----------|------------|------|
| Simple CQRS | 読み書き分離 | Low | [01-fundamentals.md](./01-fundamentals.md) |
| Command Bus | コマンド処理統一 | Medium | [02-command-handlers.md](./02-command-handlers.md) |
| Query Optimization | 読み取り最適化 | Medium | [03-query-handlers.md](./03-query-handlers.md) |
| Event Sourcing | 完全な監査証跡 | High | [04-event-sourcing.md](./04-event-sourcing.md) |
| CQRS + ES | 複雑なドメイン | Very High | [04-event-sourcing.md](./04-event-sourcing.md) |

## 🚀 Implementation Checklist

- [ ] コマンドとクエリの明確な分離
- [ ] 適切なバス実装の選択
- [ ] 読み取りモデルの設計
- [ ] 整合性戦略の決定
- [ ] テストカバレッジの確保
- [ ] パフォーマンス測定の実装
- [ ] 監視・ロギングの設定
- [ ] エラーハンドリング戦略