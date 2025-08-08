# Troubleshooting

## When Search Returns No Results

### 1. Check for Notation Variations

- Confirm if abbreviations are used
- Use unified terms from domain-terms.md

### 2. Search with Synonyms

```bash
# authentication related
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*auth.*\]" --oneline  # for old commits
```

### 3. Search by File Path

```bash
git log --name-only | grep auth
git log -- "src/auth/*"
```

### 4. Broaden Time Range

```bash
git log --grep="\[domain:authentication\]" --since="1 month ago"
git log --grep="\[domain:authentication\]" --since="3 months ago"
```

## When Related Information Cannot Be Found

### 1. Search with Higher-level Domain

When too specific, increase abstraction level

```bash
# Specific → Abstract
git log --grep="\[domain:jwt\]"           # none
git log --grep="\[domain:authentication\]" # exists
```

### 2. Cross-domain Search

When spanning multiple domains

```bash
git log --grep="\[domain:user\].*\[domain:session\]"
```

### 3. Track from Issue Numbers

Follow the trail from related Issues

```bash
git log --grep="#123"
```