# ai-instructions

CLI tool for scaffolding AI development instructions and deploying specialized agents

**English** | [日本語](./README.ja.md)

[![NPM Version](https://img.shields.io/npm/v/@arkatom/ai-instructions)](https://www.npmjs.com/package/@arkatom/ai-instructions)

## What it does

`ai-instructions` helps you work with AI coding assistants by providing:
- Complete instruction templates for Claude Code, Cursor, GitHub Copilot, and Cline
- 90 specialized agents for different development tasks (orchestrator, code-reviewer, rapid-prototyper, even a joker for team morale!)
- Multi-language support (English, Japanese, Chinese)
- Smart file conflict handling when updating existing projects

## Installation

```bash
# Global install (recommended)
npm install -g @arkatom/ai-instructions

# Or use directly
npx @arkatom/ai-instructions init
```

## CI/CD & Releases

This project uses automated releases via GitHub Actions. Every merge to main automatically:
- Runs tests
- Bumps version
- Publishes to npm
- Creates GitHub release

See [Release Documentation](./docs/RELEASE.md) for details.

## Quick Start

### 1. Generate instruction templates

```bash
# Generate comprehensive AI instructions for your project
ai-instructions init

# With custom project name
ai-instructions init --project-name "my-awesome-app"

# For Japanese projects
ai-instructions init --lang ja
```

This creates a structured set of instructions that guide AI assistants to follow your development standards.

### 2. Deploy specialized agents (90 available!)

Want an AI that writes tests? Or reviews code? Or even tells programming jokes? We've got you covered:

```bash
# Deploy the master orchestrator (coordinates other agents)
ai-instructions agents deploy orchestrator

# Deploy ALL 90 agents at once for Claude Code
ai-instructions agents deploy-all

# Build a quality-focused team
ai-instructions agents deploy code-reviewer test-writer-fixer

# For rapid development
ai-instructions agents deploy rapid-prototyper frontend-developer

# Need some fun?
ai-instructions agents deploy joker whimsy-injector

# Create custom agents dynamically!
ai-instructions agents deploy agent-generator
```

See [full agent list](./docs/agents-list.md) | [日本語版](./docs/agents-list.ja.md)

## Generated Files

When you run `init`, here's what you get:

### Claude Code (default)
```
your-project/
├── CLAUDE.md                    # Main instructions file
└── instructions/                # Comprehensive guides (included in ALL formats)
    ├── core/                    # Core development rules
    │   ├── base.md             # Fundamental principles
    │   └── deep-think.md       # Quality-first methodology
    ├── workflows/              # Git, GitHub workflows
    ├── methodologies/          # TDD, Scrum, etc.
    └── patterns/               # Language-specific patterns
```

### GitHub Copilot
```
your-project/
├── .github/
│   └── copilot-instructions.md # GitHub Copilot 2024 standard
└── instructions/                # Same comprehensive guides
```

### Cursor
```
your-project/
├── .cursor/
│   └── rules/
│       └── main.mdc            # Cursor-specific format
└── instructions/                # Same comprehensive guides
```

### Cline
```
your-project/
├── .clinerules/                # Cline-specific rules
│   ├── 01-coding.md
│   └── 02-documentation.md
└── instructions/                # Same comprehensive guides
```

**Note**: The `instructions/` directory with all development guides is generated for ALL tools, providing consistent development standards across different AI assistants.

## Agent System Details

### How agents work

**Important**: The agent system provides metadata and prompts for AI assistants. The actual agent functionality depends on your AI tool's capabilities:

- **Claude Code**: Automatically reads agents from `.claude/agents/` directory on startup
- **Other tools**: Agent files serve as reference prompts and templates
- When you "deploy" an agent for Claude Code, MD files are placed in `.claude/agents/`
- Frontmatter is automatically stripped for Claude Code to save tokens
- Use `agents deploy-all` to deploy all 90 agents at once

### 一部紹介

- **orchestrator** - The master conductor, manages multi-agent workflows
- **rapid-prototyper** - Build MVPs in hours, not days
- **code-reviewer** - Your strict but fair code quality guardian
- **agent-generator** - Creates new custom agents on demand
- **joker** - Keeps team morale high with programming humor
- **whimsy-injector** - Adds delightful touches to your UI

### Agent commands

```bash
# See all 90 available agents
ai-instructions agents list

# Get detailed info about any agent
ai-instructions agents info orchestrator

# Get recommendations based on your project
ai-instructions agents recommend

# Analyze your project and suggest agents
ai-instructions agents profile ./my-project
```

## Real-world Usage Examples

### Starting a new TikTok-viral app
```bash
# Set up the project
ai-instructions init --project-name "viral-video-app"

# Deploy specialized agents for your needs
ai-instructions agents deploy \
  trend-researcher \
  tiktok-strategist \
  mobile-app-builder \
  app-store-optimizer
```

### Building an enterprise application
```bash
# Initialize with proper structure
ai-instructions init --project-name "enterprise-dashboard"

# Deploy enterprise-focused agents
ai-instructions agents deploy \
  orchestrator \
  backend-architect \
  security-auditor \
  technical-writer
```

### Quick prototype for a hackathon
```bash
# Fast setup
ai-instructions init --project-name "hackathon-project" --conflict-resolution skip

# Deploy speed-focused agents
ai-instructions agents deploy rapid-prototyper frontend-developer
```

## File Safety Options

When updating existing projects:

```bash
# Smart merge (recommended) - keeps your changes + adds new content
ai-instructions init --conflict-resolution merge

# Create backups before updating
ai-instructions init --conflict-resolution backup

# Preview what will happen
ai-instructions init --preview
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--lang` | Language (en, ja, ch) | `en` |
| `--output` | Output directory | Current dir |
| `--project-name` | Your project name | `my-project` |
| `--tool` | AI tool type | `claude` |
| `--conflict-resolution` | How to handle existing files | `backup` |
| `--preview` | Preview changes without writing | `false` |

## Development

```bash
# Clone and install
git clone https://github.com/arkatom/ai-instructions.git
cd ai-instructions
npm install

# Run tests (780+ tests!)
npm test

# Build
npm run build

# Test locally
npm run dev init
```

## Why use this?

- **Save hours**: Stop writing the same instructions for every project
- **Consistency**: Your AI assistant follows YOUR standards
- **90 specialized agents**: Like having a full development team
- **Battle-tested**: Used in production, with comprehensive test coverage

## License

MIT

---

[GitHub](https://github.com/arkatom/ai-instructions) | [npm](https://www.npmjs.com/package/@arkatom/ai-instructions) | [Issues](https://github.com/arkatom/ai-instructions/issues)