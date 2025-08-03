# ai-instructions

🤖 **Professional CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more**

[![NPM Version](https://img.shields.io/npm/v/@arkatom/ai-instructions)](https://www.npmjs.com/package/@arkatom/ai-instructions)
[![Tests](https://img.shields.io/badge/tests-22%20passing-brightgreen)](./test)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 📋 Overview

`ai-instructions` streamlines the setup of AI-driven development environments by generating comprehensive instruction templates and configuration files. Perfect for teams and individual developers who want to standardize their AI assistant interactions across projects.

### ✨ Key Benefits

- **🚀 Instant Setup**: Generate complete instruction sets in seconds
- **📚 Comprehensive Templates**: Full collection of development methodology guides (TDD, Git workflow, etc.)
- **🌐 Multi-language Support**: Unicode and Japanese character support
- **⚙️ Highly Configurable**: Customizable project names and output directories
- **🔒 Validated Input**: Built-in validation for project names and paths
- **🧪 Battle-tested**: 22 comprehensive tests ensuring reliability

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

When you run `ai-instructions init`, the following structure is created:

```
your-project/
├── CLAUDE.md                    # Main AI assistant instructions
└── instructions/
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

- **Kent Beck** for Test-Driven Development methodology
- **ClaudeCode team** for inspiration on AI-assisted development
- **Open source community** for tools and libraries used

---

**Made with ❤️ for AI-assisted development workflows**
