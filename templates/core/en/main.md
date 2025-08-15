---
description: Development Instructions - {{projectName}}
globs: [
  "**/*.css",
  "**/*.html",
  "**/*.json",
  "**/*.md",
  "**/*.txt",
  "**/*.xml",
  "**/*.yaml",
  "**/*.yml",
  "**/.env",
  "**/.gitignore",
  "**/CHANGELOG*",
  "**/Dockerfile",
  "**/LICENSE*",
  "**/README*",
  "**/docker-compose.yml"
]
alwaysApply: true
---

# Development Instructions - {{projectName}}

## 🔄 Execution Flow

1. Load base rules → Confirm absolute requirements
2. Load context-specific files → Review detailed execution rules
3. Execute → Work according to the rules

## 🚨 Core Principles (Required)

Must be loaded before all tasks, commands, and tool executions

- [Base Rules](./instructions/core/base.md) - Absolute requirements
- [Deep Thinking](./instructions/core/deep-think.md)

## 📋 Context-Specific Required Files

### Git & GitHub Related

- [Complete Git & GitHub Guide](./instructions/workflows/git-complete.md) - Integrated Git operation guide

### Development Process

- [Pre-Implementation Analysis Protocol](./instructions/methodologies/implementation-analysis.md) - **Mandatory Execution**
- [TDD Development Style](./instructions/methodologies/tdd.md)
- [Github Issue Driven Development](./instructions/methodologies/github-idd.md)

### Recording & Management

- [Notes & Logs](./instructions/note.md) - How to record work