# Code Style & Conventions

## Based on CLAUDE.md Instructions

### File Organization
- Source code in `src/` directory
- Instructions and documentation in `instructions/` directory  
- Templates in `templates/` directory
- Tests in `test/` directory (currently empty)

### JavaScript Style
- Uses CommonJS modules (`require`/`module.exports`)
- JSDoc comments for main functions
- CLI entry point with shebang `#!/usr/bin/env node`
- Functional programming style with commander.js

### Naming Conventions
- kebab-case for CLI commands (`ai-instructions init`)
- camelCase for JavaScript variables and functions
- Descriptive variable names (avoid abbreviations per domain-terms.md)

### Project Conventions (from CLAUDE.md)
- **Code Duplication**: Absolutely forbidden - "死罪に値する"
- **File Cleanup**: Unused files/directories must be deleted
- **Documentation**: All docs in `docs/` directory
- **Deep Investigation**: Always use tools for thorough investigation
- **Completion Standards**: Beyond "working" - focus on readability, maintainability, error handling, tests

### Commit Standards
- Issue-driven development
- TDD approach (Test-Driven Development)
- Scrum methodology
- Use all available MCP server tools

### Error Handling
- Comprehensive error handling required
- User-friendly error messages with chalk styling
- Graceful degradation for missing functionality