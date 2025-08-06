# GitHub Copilot Custom Instructions - {{projectName}}

## 🚨 Core Principles (MANDATORY)

Must be read before executing any task, command, or tool

- [Basic Rules](./instructions/base.md) - Absolute requirements
- [Deep Thinking](./instructions/deep-think.md)
- [Memory](./instructions/memory.md)

## Project-Specific Architecture, Rules & Documentation

- [Project Documentation Index](./docs/README.md)

## 📋 Situational Reference Files

### Execution Environment

- [Command Execution](./instructions/command.md) - Shell, execution rules

### Git & Commit

- [Git Rules](./instructions/git.md) - GitHub operations, issues, branch strategy
- [Commit Convention](./instructions/commit-rules.md) - Commit message format
- [PR Rules](./instructions/pr-rules.md) - Pull request creation rules

### Development Process

- [Development Style](./instructions/develop.md) - Issue-driven, TDD, Scrum
- [TDD Rules](./instructions/KentBeck-tdd-rules.md) - Test-driven development
- [Scrum Development](./instructions/scrum.md) - Sprint management

### Terminology & Standardization

- [Domain Terms](./instructions/domain-terms.md) - Unified terminology
- [Term Update Workflow](./instructions/domain-term-workflow.md) - New term proposals

### Investigation & Search

- [Search Patterns](./instructions/search-patterns.md) - Git search commands
- [Troubleshooting](./instructions/troubleshooting.md) - Problem-solving procedures

### Recording & Management

- [Notes & Logs](./instructions/note.md) - Work record guidelines

## 🔄 Execution Flow

1. Load basic rules → Confirm absolute requirements
2. Load situation-specific files → Confirm concrete execution rules

- Example: During implementation → Refer to Project Documentation Index

3. Show reference confirmation → Display `✅️:{filename.md}`
4. Execute → Work according to rules