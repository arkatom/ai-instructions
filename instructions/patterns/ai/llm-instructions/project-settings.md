# プロジェクト設定

プロジェクト固有のカスタムインストラクション管理。

## CLAUDE.md形式

```markdown
---
description: プロジェクト固有設定
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# プロジェクトルール
- Next.js 14 + TypeScript + Tailwind
- 関数型・早期リターン・境界エラー処理
```

## .gptrc設定

```json
{
  "project": "e-commerce",
  "preferences": {
    "language": "typescript",
    "framework": "nextjs"
  },
  "rules": [
    "Use arrow functions",
    "No any types",
    "Test coverage > 80%"
  ]
}
```

## VS Code設定

```json
// .vscode/settings.json
{
  "ai.instructions": {
    "role": "Senior Developer",
    "project": { "type": "SaaS", "stage": "MVP" },
    "guidelines": ["Performance", "Mobile", "A11y"]
  }
}
```

## 環境別設定

```yaml
# .ai/config.yml
development:
  focus: rapid_prototyping
  quality: balanced

production:
  focus: stability
  quality: maximum
```

## チーム規約

```markdown
## Git
- Conventional commits + feature branches

## Code Review  
- PR required + 2 approvals

## Documentation
- JSDoc + README + ADR
```

## カスタムコマンド

```json
{
  "commands": {
    "review": {
      "prompt": "Review for security, performance, style"
    },
    "refactor": {
      "prompt": "Refactor for maintainability",
      "constraints": ["preserve API"]
    }
  }
}
```

→ 詳細: [基本原則](./basic-principles.md)