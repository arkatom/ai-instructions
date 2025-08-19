# Git ワークフロー

効率的なチーム開発のためのGitパターン。

## ブランチ戦略

### Git Flow
```bash
main            # プロダクション
├── develop     # 開発統合
├── feature/*   # 機能開発
├── release/*   # リリース準備
└── hotfix/*    # 緊急修正
```

### GitHub Flow（推奨）
```bash
main                    # デプロイ可能な状態
└── feature/issue-123   # 機能ブランチ
```

## コミット規約

### Conventional Commits
```bash
# 形式: <type>(<scope>): <subject>
feat(auth): add OAuth2 login
fix(api): handle null response
docs(readme): update installation guide
refactor(user): simplify validation logic
test(cart): add integration tests
chore(deps): update dependencies
```

### タイプ一覧
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: 雑務
- `perf`: パフォーマンス改善
- `style`: フォーマット

## プルリクエスト

### PRテンプレート
```markdown
## 概要
Issue #123 の実装

## 変更内容
- OAuth2ログイン追加
- エラーハンドリング改善

## テスト
- [ ] ユニットテスト
- [ ] 統合テスト
- [ ] 手動テスト

## チェックリスト
- [ ] コードレビュー済み
- [ ] ドキュメント更新
- [ ] CHANGELOG更新
```

### レビュー基準
```typescript
// ✅ 良い: 小さな変更
// 1 PR = 1 機能 or 1 修正

// ❌ 悪い: 巨大PR
// 複数機能、1000行以上の変更
```

## マージ戦略

### Squash and Merge（推奨）
```bash
# PRのコミットを1つにまとめる
# クリーンな履歴を維持
git merge --squash feature/branch
```

### Rebase and Merge
```bash
# 線形履歴を維持
# コミット履歴を保持
git rebase main feature/branch
```

## コンフリクト解決

### リベース時の解決
```bash
# 1. リベース開始
git rebase main

# 2. コンフリクト解決
git status  # コンフリクトファイル確認
# ファイル編集

# 3. 続行
git add .
git rebase --continue
```

### マージ時の解決
```bash
# 1. マージ
git merge feature/branch

# 2. 解決
# <<<<<<< HEAD
# 現在のブランチの内容
# =======
# マージするブランチの内容
# >>>>>>> feature/branch

# 3. コミット
git add .
git commit
```

## 自動化

### pre-commit フック
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: eslint
        name: ESLint
        entry: npm run lint
        language: system
        files: \.(js|jsx|ts|tsx)$
```

### CI/CD統合
```yaml
# .github/workflows/pr.yml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      - run: npm run lint
```

## ベストプラクティス

### コミット粒度
```bash
# ✅ 良い: 原子的コミット
git commit -m "feat: add user validation"
git commit -m "test: add validation tests"

# ❌ 悪い: 巨大コミット
git commit -m "WIP: lots of changes"
```

### ブランチ命名
```bash
# ✅ 良い
feature/123-user-authentication
bugfix/456-null-pointer
hotfix/789-critical-error

# ❌ 悪い
my-branch
test
fix
```

## チェックリスト
- [ ] ブランチ戦略選択
- [ ] コミット規約遵守
- [ ] PRテンプレート使用
- [ ] レビュー実施
- [ ] 自動化設定
- [ ] マージ戦略決定