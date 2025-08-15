---
description: 开发指导 - {{projectName}}
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

# 开发指导 - {{projectName}}

## 🔄 执行流程

1. 加载基本规则 → 确认绝对要求
2. 加载特定场景文件 → 审查详细执行规则
3. 执行 → 按规则工作

## 🚨 核心原则（必需）

在所有任务、命令和工具执行之前必须加载

- [基本规则](./instructions/core/base.md) - 绝对要求
- [深度思考](./instructions/core/deep-think.md)

## 📋 场景特定必需文件

### Git和GitHub相关

- [完整的Git和GitHub指南](./instructions/workflows/git-complete.md) - 集成的Git操作指南

### 开发流程

- [实施前分析协议](./instructions/methodologies/implementation-analysis.md) - **强制执行**
- [TDD开发风格](./instructions/methodologies/tdd.md)
- [Github Issue驱动开发](./instructions/methodologies/github-idd.md)

### 记录和管理

- [笔记和日志](./instructions/note.md) - 如何记录工作