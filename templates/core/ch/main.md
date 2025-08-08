# AI开发助手 行动指令 - {{projectName}}

## 🚨 核心原则（必须）

执行任何任务、命令或工具之前必须阅读

- [基本规则](./instructions/base.md) - 绝对要求
- [深度思考](./instructions/deep-think.md)
- [记忆](./instructions/memory.md)

{{toolSpecificFeatures}}

## 项目特定的架构、规则和文档

- [项目文档索引](./docs/README.md)

## 📋 场景参考文件

### 执行环境

- [命令执行](./instructions/command.md) - Shell、执行规则

### Git和提交

- [Git规则](./instructions/git.md) - GitHub操作、Issues、分支策略
- [提交约定](./instructions/commit-rules.md) - 提交消息格式
- [PR规则](./instructions/pr-rules.md) - 拉取请求创建规则

### 开发流程

- [开发风格](./instructions/develop.md) - Issue驱动、TDD、Scrum
- [TDD规则](./instructions/KentBeck-tdd-rules.md) - 测试驱动开发
- [Scrum开发](./instructions/scrum.md) - Sprint管理

### 术语和标准化

- [领域术语](./instructions/domain-terms.md) - 统一术语
- [术语更新工作流](./instructions/domain-term-workflow.md) - 新术语提案

### 调查和搜索

- [搜索模式](./instructions/search-patterns.md) - Git搜索命令
- [故障排除](./instructions/troubleshooting.md) - 问题解决程序

### 记录和管理

- [笔记和日志](./instructions/note.md) - 工作记录指南

{{additionalInstructions}}

## 🔄 执行流程

1. 加载基本规则 → 确认绝对要求
2. 加载特定场景文件 → 确认具体执行规则

- 示例：实施期间 → 参考项目文档索引

3. 显示参考确认 → 显示 `✅️:{filename.md}`
4. 执行 → 根据规则工作