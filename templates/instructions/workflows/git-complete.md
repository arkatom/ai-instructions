# Complete Git & GitHub Workflow Guide

Complete Git & GitHub operational guide based on GitHub Flow

## 🔄 Basic Workflow

### 1. Issue-Driven Development
- All work starts from GitHub Issues
- Apply appropriate labels when creating Issues
- Split into max 5 story points (exceptionally allow up to 8)

### 2. Branch Strategy
```bash
# Branch naming convention
{type}/{issue-number}_{description}

# Examples
feature/123_user_authentication
fix/456_session_timeout
refactor/789_extract_service
```

### 3. Development Process
```bash
# 1. Create branch from Issue
git checkout -b feature/123_description

# 2. Make changes and commit frequently
git status                    # Review changes
git add .                    # Stage related changes
git commit -m "message"      # Commit with proper format

# 3. Push and create PR
git push -u origin feature/123_description
gh pr create --title "#123: Brief description"
```

## 📝 Commit Message Format

### Required Convention
```
type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]
```

### Examples
```bash
feat(auth): #123 implement JWT authentication [domain:authentication] [tags:jwt,login]
fix(session): #456 resolve timeout issue [domain:session] [tags:timeout,cleanup]
refactor(user): #789 extract user service [domain:user] [tags:service,extraction]
```

### Commit Guidelines
- Keep commits atomic and focused
- Each commit should leave code in working state
- Write descriptive messages explaining the "why"
- Commit at logical checkpoints

## 🔍 Pull Request Rules

### Single PR Policy (CRITICAL)
- **Only one open PR allowed at a time**
- Complete current PR before starting new work
- Prevents merge conflicts and maintains quality

### PR Creation Process
1. **Title Format**: `#Issue-number: Brief description`
2. **Description Template**:
```markdown
## Overview
Brief summary of what, why, and how

## Changes
- Detailed change 1
- Detailed change 2

## Related Issues
Closes #123

## Testing
- [ ] Local tests passed
- [ ] CI checks green
```

### Review & Merge Process
1. Create PR with proper description
2. Wait for CI checks to pass
3. Address review feedback:
   - If within Issue scope: Fix immediately
   - If outside scope: Create new Issue
4. Merge after approval
5. Delete branch and close Issue

## 🔧 Commands & Tools

### Preferred Tools Priority
1. GitHub API tools (when available)
2. `gh` CLI command
3. Web interface for complex operations

### Common Git Commands
```bash
# Status and staging
git status
git add {files}
git add .

# Committing
git commit -m "type(scope): #issue description [domain:xxx] [tags:keywords]"

# Branch management
git checkout -b feature/123_description
git checkout main
git pull

# PR management
gh pr create --title "#123: Description" --body "..."
gh pr status
gh pr merge --squash
```

### Search Patterns for Git History
```bash
# By domain
git log --grep="[domain:authentication]" --oneline
git log --grep="[domain:user]" --oneline

# By tags
git log --grep="[tags:.*login.*]" --oneline
git log --grep="[tags:.*jwt.*]" --oneline

# By issue
git log --grep="#123"

# By type
git log --grep="feat.*[domain:.*]" --oneline
git log --grep="fix.*[domain:.*]" --oneline
```

## 📊 GitHub Issue Management

### Issue Structure
```markdown
## Problem
Clear description of the problem

## Solution
Proposed approach

## Acceptance Criteria
- [ ] Specific outcome 1
- [ ] Specific outcome 2

## Story Points
1-5 (max 8 for exceptional cases)
```

### Labels & Organization
- Apply appropriate labels consistently
- Link Issues to PRs properly
- Update Issue status throughout development
- Close Issues after PR merge

## 🚨 Persistent Documentation Requirements

### Critical for AI Continuity
As an AI without conversation continuity, you MUST:

1. **Immediately document** all discoveries in GitHub Issues
2. **Include specific details**: file names, line numbers, exact problems
3. **Propose solutions** or investigation paths
4. **Update existing Issues** with progress
5. **Record interruptions** with current state and next steps

### Documentation Standards
- Create Issues for all TODOs and improvements
- Comment on Issues with significant findings
- Link related Issues for traceability
- Record decisions and their rationale

## ⚡ Troubleshooting & Optimization

### Performance Investigation
```bash
# Find commits by domain and timeframe
git log --grep="[domain:authentication]" --since="1 month ago"
git log --grep="[domain:user]" --since="3 months ago"

# Investigate specific features
git log --name-only | grep auth
git log -- "src/auth/*"

# Cross-reference multiple domains
git log --grep="[domain:user].*[domain:session]"
```

### Quality Checks
- Ensure all commits reference Issues
- Verify proper domain/tag usage
- Check for atomic, logical commits
- Validate PR descriptions are complete

This consolidated guide replaces the previous scattered Git documentation and provides a single source of truth for all Git & GitHub operations.