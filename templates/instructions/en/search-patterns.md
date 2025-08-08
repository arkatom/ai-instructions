# Search Pattern Collection

## Basic Search Commands

### Domain-specific Search

```bash
git log --grep="\[domain:authentication\]" --oneline
git log --grep="\[domain:user\]" --oneline
git log --grep="\[domain:session\]" --oneline
git log --grep="\[domain:agent\]" --oneline
```

### Feature-specific Search

```bash
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*timeout.*\]" --oneline
```

### Problem Investigation

```bash
git log --grep="fix.*\[domain:.*\]" --oneline        # Bug fix history
git log --grep="feat.*\[domain:.*\]" --oneline       # Feature addition history
```

## Scenario-specific Search

### When Investigating Bugs

```bash
# 1. Identify related domain from error message
# 2. Check recent changes in that domain
git log --grep="\[domain:DOMAIN_NAME\]" --since="1 week ago"

# 3. Investigate related fix commits
git log --grep="fix.*\[domain:DOMAIN_NAME\]" --oneline
```

### When Adding Features

```bash
# 1. Check implementation of similar features
git log --grep="\[tags:.*FEATURE_NAME.*\]" --oneline

# 2. Check design patterns of related domains
git log --grep="\[domain:DOMAIN_NAME\]" --oneline
```