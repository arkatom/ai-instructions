# Commit Conventions

## Commit Message Conventions

### Basic Format

```
type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]
```

### Examples

```bash
feat(authentication): #123 implement JWT user authentication [domain:authentication] [tags:jwt,login,session]
fix(session): #456 resolve session timeout issue [domain:session] [tags:timeout,cleanup]
refactor(user): #789 extract user profile service [domain:user] [tags:service,extraction]
```

### Required Elements

- **Issue Number**: Automatically inserted
- **Domain Tag**: `[domain:xxx]` (required for feat/fix)
- **AI Tags**: `[tags:xxx,yyy]` (recommended for searchability)
- **Unified Terms**: No abbreviations, follow domain-terms.md

## Commit Procedures (MUST)

- Check changes with git status
- Stage with appropriate context granularity using git add ...
- Commit with git commit -m "..."

## Commit Granularity Principles (MUST)

- Make commit granularity as small as possible
- Commit at the unit of "I want to return here if something goes wrong!"
- Commit at a unit where the "intent and purpose of changes" can be understood when looking back later (write in commit message)
- Commit at a unit that works normally (to avoid breaking when rolling back)