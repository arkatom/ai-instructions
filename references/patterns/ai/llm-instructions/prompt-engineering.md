# プロンプトエンジニアリング技法

高度なプロンプト設計テクニック。

## Chain of Thought (CoT)

```markdown
Let's solve step-by-step:
1. Understand → 2. Break down → 3. Consider constraints → 4. Design → 5. Implement
Think through each step before proceeding.
```

## Few-Shot Learning

```markdown
Example 1: "user auth" → JWT with refresh tokens
Example 2: "data cache" → Redis with TTL
Now for: "session management" → [Model follows pattern]
```

## Zero-Shot CoT

```markdown
Question: How to optimize database queries?
Let's think: analyze bottlenecks → indexing → query optimization → caching
```

## Self-Consistency

```markdown
Solve using 3 approaches:
1. Functional programming | 2. Object-oriented | 3. Procedural
Compare and select best solution.
```

## Role Prompting

```markdown
You are a security expert with OWASP, penetration testing, secure coding expertise.
Analyze this code for vulnerabilities.
```

## Prompt Chaining

```markdown
Step 1: Analyze requirements → Requirements doc
Step 2: Design architecture ← Requirements → Architecture
Step 3: Implement ← Architecture → Code
```

## Constrained Generation

```markdown
Generate REST API with:
- Max 5 endpoints | JSON only | JWT auth | <100ms response | <50MB memory
```

## Meta-Prompting

```markdown
First, generate optimal prompt for: "Create scalable microservice"
Then use that prompt to solve the problem.
```

## Temperature Control

```python
creative_tasks = 0.8    # Higher creativity
code_generation = 0.3   # Deterministic
analysis = 0.5          # Balanced
```

## Advanced Techniques

```markdown
# Emotional Prompting
This is critical for production. Please be extremely careful.

# Instruction Following
IMPORTANT: Never use deprecated APIs | Always handle errors | Include tests

# Output Formatting
Return as JSON: { "analysis": {...}, "solution": {...}, "risks": [...] }
```

→ 詳細: [構造化プロンプト](./structured-prompts.md)