# ai-instructions

🤖 **Professional CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more**

[![NPM Version](https://img.shields.io/npm/v/@arkatom/ai-instructions)](https://www.npmjs.com/package/@arkatom/ai-instructions)
[![Tests](https://img.shields.io/badge/tests-43%20passing-brightgreen)](./test)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Semantic Versioning](https://img.shields.io/badge/semver-2.0.0-blue)](https://semver.org/)

## 📋 Overview

`ai-instructions` streamlines the setup of AI-driven development environments by generating comprehensive instruction templates and configuration files. Perfect for teams and individual developers who want to standardize their AI assistant interactions across projects.

### ✨ Key Benefits

- **🚀 Instant Setup**: Generate complete instruction sets in seconds
- **🛠️ Multi-Tool Support**: Claude Code, GitHub Copilot, and Cursor AI IDE support
- **📚 Comprehensive Templates**: Full collection of development methodology guides (TDD, Git workflow, etc.)
- **🌐 Multi-language Support**: Unicode and Japanese character support
- **⚙️ Highly Configurable**: Customizable project names and output directories
- **🔒 Validated Input**: Built-in validation for project names and paths
- **🧪 Battle-tested**: 43 comprehensive tests ensuring reliability

## ⚠️ Important Safety Notice (v0.2.1)

**🚨 CAUTION: This tool will overwrite existing files without confirmation in the target directory.**

### 🛡️ Safe Usage Patterns

```bash
# ✅ RECOMMENDED: Preview changes before applying
ai-instructions init --preview

# ✅ SAFE: Use in empty directories or new projects
mkdir my-new-project && cd my-new-project
ai-instructions init --project-name "My New Project"

# ⚠️ DANGEROUS: Force overwrite (use with extreme caution)
ai-instructions init --force

# ✅ DEFAULT: Shows warnings for existing files
ai-instructions init  # Will display warnings before overwriting
```

### 🔒 File Conflict Handling

When existing files are detected, the tool will:
1. **Display warnings** showing file details (size, modification date)
2. **Proceed with overwrite** after showing warnings
3. **Provide guidance** on safer alternatives

### 🚧 Upcoming Safety Features (v0.3.0)

- **Interactive conflict resolution** with 5 choice options:
  - 🔄 Merge existing + template content
  - 📝 Rename existing file (create backup)
  - 🆕 Rename new file (save as .new)
  - ❌ Cancel operation
  - 💥 Overwrite (with explicit confirmation)
- **Intelligent backup creation**
- **Smart content merging**

> **💡 Pro Tip**: Always use version control (git) before running `ai-instructions init` in existing projects!

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g @arkatom/ai-instructions
```

### Local Project Installation

```bash
npm install --save-dev @arkatom/ai-instructions
```

### Usage without Installation

```bash
npx @arkatom/ai-instructions init
```

## 🚀 Quick Start

### Basic Usage

```bash
ai-instructions init
```

This creates a complete set of AI development instructions in your current directory.

### Custom Project Setup

```bash
ai-instructions init --project-name "my-awesome-project" --output ./my-project
```

### Multi-Tool Support

Generate instructions for different AI development tools:

```bash
# Generate Claude Code instructions (default)
ai-instructions init --tool claude

# Generate GitHub Copilot instructions
ai-instructions init --tool github-copilot --project-name "my-project"

# Generate Cursor AI IDE instructions  
ai-instructions init --tool cursor --project-name "my-project"
```

### Real-world Examples

```bash
# Setup for a React project
ai-instructions init --project-name "react-dashboard" --output ./projects/dashboard

# Setup for a Japanese project  
ai-instructions init --project-name "プロジェクト名" --output ./日本語プロジェクト

# Setup with spaces in name
ai-instructions init --project-name "My Enterprise App" --output ./enterprise
```

## 📁 Generated File Structure

The file structure varies depending on the AI tool you select:

### Claude Code (Default)
```
your-project/
├── CLAUDE.md                    # Main ClaudeCode instructions
└── instructions/                # Comprehensive development guides
    ├── base.md                  # Core development rules (MUST READ)
    ├── deep-think.md           # Deep thinking methodology  
    ├── memory.md               # Memory management instructions
    ├── KentBeck-tdd-rules.md   # Test-Driven Development rules
    ├── commit-rules.md         # Git commit conventions
    ├── pr-rules.md             # Pull request guidelines
    ├── git.md                  # Git workflow instructions
    ├── develop.md              # Development process guide
    ├── command.md              # Shell command execution rules
    └── memo/
        └── index.md            # Project memo template
```

### GitHub Copilot (`--tool github-copilot`)
```
your-project/
└── .github/
    └── instructions/
        └── main.md             # GitHub Copilot custom instructions
```

### Cursor AI IDE (`--tool cursor`)
```
your-project/
└── .cursor/
    └── rules/
        └── main.mdc            # Cursor AI rules with metadata
```

### File Descriptions

| File | Purpose | Key Content |
|------|---------|-------------|
| `CLAUDE.md` | Main entry point for AI assistants | Project-specific instructions with {{projectName}} replaced |
| `base.md` | Core development principles | Fundamental rules that must be followed |
| `deep-think.md` | Thinking methodology | Quality-first approach and analytical thinking |
| `memory.md` | Memory management | How to store and retrieve project information |
| `KentBeck-tdd-rules.md` | TDD methodology | Kent Beck's Test-Driven Development principles |
| `commit-rules.md` | Git commit standards | Semantic commit message format with domain tags |
| `pr-rules.md` | Pull request rules | PR creation guidelines and review process |

## ⚙️ Configuration Options

### Command Line Options

| Option | Alias | Description | Default | Example |
|--------|-------|-------------|---------|---------|
| `--output` | `-o` | Output directory | Current directory | `--output ./my-project` |
| `--project-name` | `-n` | Project name for templates | `my-project` | `--project-name "My App"` |
| `--tool` | `-t` | AI tool type | `claude` | `--tool cursor` |
| `--force` | | ⚠️ Force overwrite existing files (DANGEROUS) | `false` | `--force` |
| `--preview` | | 🔍 Preview files that would be created/modified | `false` | `--preview` |
| `--version` | | Show version number | | |
| `--help` | | Display help information | | |

### Project Name Validation

The CLI validates project names to ensure filesystem compatibility:

- ✅ **Allowed**: Letters, numbers, spaces, hyphens, underscores, Unicode characters
- ❌ **Forbidden**: `<`, `>`, `|` characters
- ❌ **Invalid**: Empty strings or whitespace-only names

### Examples of Valid Project Names

```bash
ai-instructions init --project-name "My Project"           # ✅ Spaces
ai-instructions init --project-name "my-awesome_project-v2" # ✅ Hyphens & underscores  
ai-instructions init --project-name "プロジェクト名"          # ✅ Unicode/Japanese
ai-instructions init --project-name "Project123"           # ✅ Numbers
```

## 🛠️ Development

### Prerequisites

- Node.js 16+ 
- npm 7+
- TypeScript 5.0+

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/arkatom/ai-instructions.git
cd ai-instructions

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Test CLI locally
npm run cli init --help
```

### Running Tests

```bash
# Run all tests (22 test suites)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Our comprehensive test suite includes:

- **Basic CLI functionality** (version, help, commands)
- **Error handling** (invalid inputs, filesystem errors)  
- **Edge cases** (Unicode names, very long names, empty strings)
- **Content verification** (generated file structure and content)
- **Integration testing** (end-to-end CLI workflows)

### Build and Distribution

```bash
# Build TypeScript to JavaScript
npm run build

# Create distribution package
npm pack

# Publish to npm (maintainers only)
npm publish
```

## 📌 Versioning

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (SemVer). Version numbers follow the format `MAJOR.MINOR.PATCH`:

- **MAJOR**: Incompatible API changes or breaking changes
- **MINOR**: New functionality in a backwards compatible manner
- **PATCH**: Backwards compatible bug fixes

For example:
- `0.3.0` → `0.3.1`: Bug fixes or minor improvements
- `0.3.1` → `0.4.0`: New features or enhancements
- `0.4.0` → `1.0.0`: Breaking changes or major redesign

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow TDD** principles - write tests first
4. **Implement** your changes with proper TypeScript types
5. **Test** thoroughly (`npm test`)
6. **Commit** using our [commit conventions](./instructions/commit-rules.md)
7. **Submit** a pull request

### Code Quality Standards

- **TDD Required**: All new features must have tests
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code style enforcement
- **100% Test Coverage**: For new features
- **Documentation**: Update README for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/arkatom/ai-instructions/issues)
- **Documentation**: This README and generated instruction files
- **Examples**: See the [examples](./examples) directory

## 🙏 Acknowledgments

- **Kent Beck** for the foundational Test-Driven Development methodology
  - *"Test-Driven Development: By Example"* (2003) - The seminal work that defined TDD
  - *"Tidy First?"* (2023) - Modern approach to structural vs behavioral changes
  - The three rules of TDD that guide our development process
- **Martin Fowler** for documenting and evangelizing TDD practices
- **ClaudeCode team** for inspiration on AI-assisted development workflows
- **Open source community** for the excellent tools and libraries that make this possible

---

**Made with ❤️ for AI-assisted development workflows**
