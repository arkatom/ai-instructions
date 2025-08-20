# 構造化プロンプト

体系的で再利用可能なプロンプト構造。

## マークダウン構造

```markdown
# System Role
Technical architect with 10+ years experience

## Expertise
- Cloud Architecture (AWS, GCP)
- Microservices
- DevOps

## Task
Design scalable API architecture

### Requirements
1. Handle 10K requests/second
2. 99.9% uptime
3. Sub-100ms latency

### Deliverables
- [ ] Architecture diagram
- [ ] Technical specification
- [ ] Implementation plan
```

## JSON構造

```json
{
  "role": "Code Reviewer",
  "context": {
    "language": "TypeScript",
    "framework": "React",
    "standards": ["ESLint", "Prettier"]
  },
  "task": {
    "action": "review",
    "focus": ["security", "performance"],
    "depth": "detailed"
  },
  "output": {
    "format": "markdown",
    "sections": ["issues", "suggestions", "code"]
  }
}
```

## YAML構造

```yaml
system:
  role: DevOps Engineer
  experience: Senior

context:
  infrastructure: Kubernetes
  cloud: AWS
  tools:
    - Terraform
    - ArgoCD
    - Prometheus

task:
  type: deployment
  requirements:
    - zero-downtime
    - rollback-capable
    - monitoring-enabled

output:
  format: step-by-step
  include:
    - commands
    - configurations
    - validation
```

## テンプレート変数

```markdown
# Template with Variables
Role: {{role}}
Project: {{project_name}}
Stack: {{tech_stack}}

Task: Implement {{feature}}
- Language: {{language}}
- Framework: {{framework}}
- Testing: {{test_framework}}

Constraints:
- Deadline: {{deadline}}
- Budget: {{budget}}
- Team size: {{team_size}}
```

## 条件付き構造

```markdown
# Conditional Instructions
IF (codebase_size > 10000_lines):
  - Use architectural patterns
  - Implement monitoring
  - Add documentation

ELIF (codebase_size > 1000_lines):
  - Apply SOLID principles
  - Add unit tests

ELSE:
  - Keep it simple
  - Focus on functionality
```

## 階層的プロンプト

```markdown
# Level 1: High-level
Design a web application

## Level 2: Components
- Frontend: React SPA
- Backend: Node.js API
- Database: PostgreSQL

### Level 3: Details
Frontend:
  - State: Redux Toolkit
  - Routing: React Router
  - UI: Material-UI
```

→ 詳細: [プロンプトエンジニアリング](./prompt-engineering.md)