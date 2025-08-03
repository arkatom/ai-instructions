# Development Workflow

## Core Methodology
- **Issue-driven development**: Always start with GitHub Issues
- **Test-Driven Development (TDD)**: Follow Kent Beck's TDD rules
- **Scrum methodology**: Sprint-based development
- **MCP tools priority**: Use all available MCP server tools

## Workflow Steps

### 1. Issue Analysis
- Read and understand the GitHub Issue
- Reference relevant instruction files
- Plan implementation approach

### 2. Implementation Process
- Follow TDD cycle: Red → Green → Refactor
- Use semantic code editing tools when possible
- Prioritize code quality over "working" code
- Eliminate duplication and scattered code

### 3. Quality Assurance
- Comprehensive error handling
- Readable and maintainable code
- Proper test coverage
- Documentation updates

### 4. Git Workflow
```bash
# Check current status
git status

# Stage changes appropriately
git add <files>

# Commit with proper format
git commit -m "type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]"
```

## Branch Strategy
- Current branch: `feature/2_npm_project_initialization`
- Main branch: `main` (for PRs)
- Follow issue-based branch naming

## Key Principles from CLAUDE.md
- Deep investigation using all available tools
- Reference instruction files explicitly with `✅️:{filename.md}`
- Rate work quality (avoid "適当度" ≥5)
- Complete documentation and cleanup
- No unused files or directories