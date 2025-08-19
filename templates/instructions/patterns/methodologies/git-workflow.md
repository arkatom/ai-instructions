# Git Workflow

Efficient Git patterns for team development.

## Branch Strategy

### Git Flow
```bash
main            # Production
├── develop     # Development integration
├── feature/*   # Feature development
├── release/*   # Release preparation
└── hotfix/*    # Emergency fixes
```

### GitHub Flow (Recommended)
```bash
main                    # Always deployable
└── feature/issue-123   # Feature branch
```

## Commit Convention

### Conventional Commits
```bash
# Format: <type>(<scope>): <subject>
feat(auth): add OAuth2 login
fix(api): handle null response
docs(readme): update installation guide
refactor(user): simplify validation logic
test(cart): add integration tests
chore(deps): update dependencies
```

### Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance
- `perf`: Performance
- `style`: Formatting

## Pull Requests

### PR Template
```markdown
## Summary
Implements #123

## Changes
- Added OAuth2 login
- Improved error handling

## Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] CHANGELOG updated
```

### Review Criteria
```typescript
// ✅ Good: Small changes
// 1 PR = 1 feature or 1 fix

// ❌ Bad: Large PRs
// Multiple features, 1000+ lines
```

## Merge Strategy

### Squash and Merge (Recommended)
```bash
# Combines PR commits into one
# Maintains clean history
git merge --squash feature/branch
```

### Rebase and Merge
```bash
# Linear history
# Preserves commits
git rebase main feature/branch
```

## Conflict Resolution

### During Rebase
```bash
# 1. Start rebase
git rebase main

# 2. Resolve conflicts
git status  # Check conflicted files
# Edit files

# 3. Continue
git add .
git rebase --continue
```

### During Merge
```bash
# 1. Merge
git merge feature/branch

# 2. Resolve
# <<<<<<< HEAD
# Current branch content
# =======
# Merging branch content
# >>>>>>> feature/branch

# 3. Commit
git add .
git commit
```

## Automation

### Pre-commit Hooks
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

### CI/CD Integration
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

## Best Practices

### Commit Granularity
```bash
# ✅ Good: Atomic commits
git commit -m "feat: add user validation"
git commit -m "test: add validation tests"

# ❌ Bad: Large commits
git commit -m "WIP: lots of changes"
```

### Branch Naming
```bash
# ✅ Good
feature/123-user-authentication
bugfix/456-null-pointer
hotfix/789-critical-error

# ❌ Bad
my-branch
test
fix
```

## Checklist
- [ ] Branch strategy chosen
- [ ] Commit convention followed
- [ ] PR template used
- [ ] Reviews conducted
- [ ] Automation configured
- [ ] Merge strategy defined