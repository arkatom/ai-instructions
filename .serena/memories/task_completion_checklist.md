# Task Completion Checklist

## Pre-Task (MUST)
- [ ] Read base.md - absolute requirements
- [ ] Read relevant instruction files for the task context
- [ ] Display `✅️:{filename.md}` for each referenced file
- [ ] Check current issue and understand requirements

## During Task
- [ ] Use all available tools actively (prioritize over commands)
- [ ] Record any important information that might be forgotten
- [ ] Rate "適当度" (carelessness level) 1-10, redo if ≥5
- [ ] Follow TDD approach for any code changes
- [ ] Eliminate code duplication and scattered code

## Code Quality Requirements
- [ ] Readability and maintainability
- [ ] Proper error handling
- [ ] Test coverage (when applicable)
- [ ] Remove unused files/directories
- [ ] Follow naming conventions from domain-terms.md

## Testing & Validation
```bash
# Run tests (when available)
npm test

# Test CLI functionality
npm start
./src/cli.js --help

# Lint code (when configured)
npm run lint
```

## Documentation Updates
- [ ] Update docs/ directory if architecture changed
- [ ] Update directory structure documentation
- [ ] Update relevant instruction files
- [ ] Commit documentation changes

## Final Steps
- [ ] Deep investigation using file search, ls, find commands
- [ ] Ensure comprehensive information for next actions
- [ ] Commit with proper format: `type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]`
- [ ] Push changes if explicitly requested

## Git Workflow
```bash
git status
git add <files>
git commit -m "type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]"
```