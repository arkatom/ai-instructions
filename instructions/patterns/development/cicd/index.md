# CI/CD (Continuous Integration/Continuous Deployment) Patterns

## 📚 Topic Navigation

### Foundation
- [CI Fundamentals](./01-ci-fundamentals.md) - 基本概念とCI/CD哲学
- [GitHub Actions](./02-github-actions.md) - GitHub Actions詳細パターン
- [Testing Pipeline](./03-testing-pipeline.md) - テストパイプライン戦略

### Implementation
- [Build Optimization](./04-build-optimization.md) - ビルド最適化テクニック
- [CD Strategies](./05-cd-strategies.md) - デプロイメント戦略
- [Monitoring](./06-monitoring.md) - 監視と可観測性

### Operations
- [Rollback Strategies](./07-rollback.md) - ロールバック戦略
- [Security](./08-security.md) - CI/CDセキュリティ
- [Multi-Environment](./09-multi-env.md) - マルチ環境管理
- [Best Practices](./10-best-practices.md) - ベストプラクティス

## 🎯 Learning Paths

### Beginner Path (1 week)
1. **Day 1-2**: [CI Fundamentals](./01-ci-fundamentals.md) - 基本概念理解
2. **Day 3-4**: [GitHub Actions](./02-github-actions.md) - 実践的パイプライン作成
3. **Day 5-7**: [Testing Pipeline](./03-testing-pipeline.md) - テスト自動化

### Intermediate Path (2 weeks)
1. **基礎**: Beginner Path全体
2. **最適化**: [Build Optimization](./04-build-optimization.md) - 高速化技術
3. **デプロイ**: [CD Strategies](./05-cd-strategies.md) - デプロイ戦略
4. **監視**: [Monitoring](./06-monitoring.md) - メトリクス収集

### Advanced Path (3 weeks)
1. **全基礎**: Intermediate Path全体
2. **運用**: [Rollback Strategies](./07-rollback.md) - 障害対応
3. **セキュリティ**: [Security](./08-security.md) - セキュア開発
4. **エンタープライズ**: [Multi-Environment](./09-multi-env.md) - 複雑環境管理
5. **マスタリー**: [Best Practices](./10-best-practices.md) - 包括的理解

## 🔧 Quick Reference

| Platform | Use Case | Complexity | File |
|----------|----------|------------|------|
| GitHub Actions | OSS・スタートアップ | Low-Medium | [02-github-actions.md](./02-github-actions.md) |
| GitLab CI | 統合開発環境 | Medium | [02-github-actions.md](./02-github-actions.md) |
| Jenkins | エンタープライズ | High | [04-build-optimization.md](./04-build-optimization.md) |
| Azure DevOps | Microsoft環境 | Medium-High | [09-multi-env.md](./09-multi-env.md) |
| CircleCI | 高速CI/CD | Medium | [04-build-optimization.md](./04-build-optimization.md) |

## 🚀 Implementation Checklist

- [ ] CI基本概念の理解
- [ ] プラットフォーム選定
- [ ] パイプライン設計
- [ ] テスト自動化の実装
- [ ] ビルド最適化
- [ ] デプロイ戦略の決定
- [ ] 監視・アラートの設定
- [ ] セキュリティ対策の実装
- [ ] ロールバック手順の準備
- [ ] 運用ドキュメントの作成