# Project Structure

## Directory Layout
```
ai-instructions/
├── src/                    # Source code
│   ├── cli.js             # Main CLI entry point
│   ├── utils/             # Utility functions (empty)
│   └── generators/        # Template generators (empty)
├── instructions/          # AI development instructions
│   ├── base.md           # Core rules (MUST read)
│   ├── command.md        # Shell execution rules
│   ├── commit-rules.md   # Git commit conventions
│   ├── develop.md        # Development methodology
│   ├── git.md            # Git workflow rules
│   ├── pr-rules.md       # Pull request guidelines
│   ├── deep-think.md     # Deep thinking approach
│   ├── memory.md         # Memory management
│   └── memo/             # Additional memos
├── templates/            # Template files for AI tools
│   ├── claude/          # Claude-specific templates (empty)
│   └── shared/          # Shared templates (empty)
├── test/                # Test files (empty)
├── .claude/             # Claude Code configuration
│   ├── settings.local.json
│   ├── agents/
│   └── commands/
├── docs/                # Project documentation (referenced but missing)
├── CLAUDE.md           # Main AI assistant instructions
├── package.json        # NPM configuration
└── README.md          # Project overview
```

## Key Files
- **CLAUDE.md**: Central instruction file for AI assistants
- **src/cli.js**: Main CLI implementation using commander.js
- **instructions/**: Comprehensive development guidelines
- **templates/**: Future home for AI tool templates
- **package.json**: Defines CLI binary and scripts

## Current Implementation Status
- ✅ NPM project structure established
- ✅ CLI framework with commander.js
- ✅ Comprehensive instruction system
- 🚧 Core functionality (Issue #3)
- 🚧 Template generation system
- 🚧 Test suite setup