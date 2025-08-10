# GitHub Flow Workflow

A comprehensive guide for GitHub Flow development process, combining Git operations, commit conventions, and pull request rules.

## Workflow Overview

GitHub Flow is a simple, branch-based workflow that:
1. Works directly from the main branch
2. Creates feature branches for changes
3. Opens pull requests for discussion and review
4. Merges after review and CI checks
5. Deploys immediately from main

## Branch Strategy

### Branch Naming Convention
```
{type}/{issue-number}_{description}
```

**Types:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation changes
- `test/` - Test additions/modifications
- `chore/` - Maintenance tasks

**Examples:**
- `feature/123_user_authentication`
- `fix/456_session_timeout`
- `refactor/789_extract_user_service`

### Branch Rules
- Always create a new branch from main for each Issue
- One Issue = One Branch = One PR
- Delete branches after merging
- Keep branch names concise but descriptive

## Commit Conventions

### Message Format
```
type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]
```

### Required Elements
- **Issue number**: Must reference the related Issue
- **Domain tag**: `[domain:xxx]` required for feat/fix commits
- **AI tags**: `[tags:xxx,yyy]` recommended for searchability
- **Terminology**: Use full terms from domain-terms.md, no abbreviations

### Examples
```bash
feat(authentication): #123 implement JWT user authentication [domain:authentication] [tags:jwt,login,session]
fix(session): #456 resolve session timeout issue [domain:session] [tags:timeout,cleanup]
refactor(user): #789 extract user profile service [domain:user] [tags:service,extraction]
```

### Commit Guidelines
- Keep commits atomic and focused
- Commit at logical checkpoints ("I might want to return here")
- Each commit should leave the code in a working state
- Write descriptive messages explaining the "why"

### Commit Process
1. `git status` - Review changes
2. `git add` - Stage related changes together
3. `git commit -m "..."` - Commit with proper message

## Pull Request Rules

### PR Creation

#### Title Format
```
#Issue-number: Brief description
```

Examples:
- `#123: Implement user authentication`
- `#456: Fix session timeout issue`

#### PR Description Template
```markdown
## Overview
Brief summary of what, why, and how

## Changes
- Detailed change 1
- Detailed change 2
- ...

## Related Issues
Closes #123

## Review Focus
Areas requiring special attention

## Testing
- [ ] Local tests passed
- [ ] CI checks green
- [ ] Manual testing completed
```

### Single PR Policy

**CRITICAL**: Only one open PR is allowed at a time

**Reasons:**
- Prevents merge conflicts
- Maintains review quality
- Reduces CI/CD load
- Ensures focused development

**Process:**
1. Complete current PR before starting new work
2. Wait for review and merge
3. Update main branch locally
4. Start next Issue/PR

**Exceptions:**
- Emergency fixes (requires team lead approval)
- Documented dependencies between PRs

### PR Checklist

Before creating a PR:
- [ ] Code tested locally
- [ ] Code style consistent
- [ ] Debug code removed
- [ ] No other open PRs
- [ ] Description complete
- [ ] Issue referenced

### Review Process

1. **Create PR**: Link to Issue, add description
2. **CI Checks**: Wait for automated tests
3. **Review**: Address feedback promptly
   - If changes are within Issue scope: Fix immediately
   - If outside scope: Create new Issue and link in PR
4. **Approval**: Wait for reviewer approval
5. **Merge**: Merge to main after approval
6. **Cleanup**: Delete branch, close Issue

## GitHub Operations

### Preferred Tools
- Use GitHub API tools when available
- `gh` CLI as secondary option
- Web interface for complex operations

### Issue Management
- Apply appropriate labels
- Keep Issues under 5 story points (8 max for complex tasks)
- Link Issues to PRs
- Update Issue status throughout development

## Persistent Documentation

**CRITICAL**: As an AI with no conversation continuity, you MUST:

1. **Immediately document** all discovered issues, improvements, and TODOs in GitHub Issues
2. **Include in Issues:**
   - Exact details (file names, line numbers)
   - Proposed solutions or options
   - Priority and difficulty assessment
3. **Comment on existing Issues** with updates
4. **Document interruptions** with current state and next steps
5. **Record deferred items** for future reference

Remember: Documentation is for "the next person" (including future you), not for yourself.

## Quick Reference

### Common Commands
```bash
# Create feature branch
git checkout -b feature/123_description

# Commit with convention
git commit -m "feat(auth): #123 add login [domain:auth] [tags:login]"

# Create PR
gh pr create --title "#123: Add login" --body "..."

# Check PR status
gh pr status

# Merge PR
gh pr merge --squash
```

### Workflow Summary
1. Pick Issue → Create branch
2. Make changes → Commit frequently
3. Push branch → Create PR
4. Review → Address feedback
5. Merge → Delete branch
6. Deploy → Monitor