# Pre-Implementation Analysis Protocol

Mandatory execution for all implementation and code change tasks

## Phase 1: Requirements Analysis

□ Extract input→processing→output from Issue/requirements
□ Register all work items with TodoWrite tool
□ Ask questions at this stage if there are uncertainties (record decisions in Issue)
□ Investigate existing implementations of similar features
✅Output: Issue record "Requirements analysis complete: [X main features, decisions]"

## Phase 2: Impact Scope Identification

□ Identify change targets (functions/classes/types/interfaces) with find_symbol
□ Track including exported types and generics
□ Cover referencing sources with find_referencing_symbols
□ Check string usage with grep/search_for_pattern (including tests)
□ Check external type dependencies in package.json and @types/*
✅Output: Issue record "Impact scope: [X files, Y types, Z functions]"

## Phase 3: Design and Planning

□ Determine error handling policy
□ Determine type safety methods (type inference, generics utilization)
□ Design necessary and sufficient test cases (only valuable tests)
□ Determine implementation order (small unit division)
✅Output: Issue record "Design complete, next step: [specific task name]"

## Phase 4: Incremental Implementation

□ Implementation in small units (1 feature = 1 commit)
□ Test execution and pass confirmation for each unit
□ TodoWrite update
✅Output: Issue record "Phase 4 in progress: [completed tasks], next: [next task]"

## Phase 5: Agent Quality Verification

□ Execute code review agent
□ Execute test quality agent (focus on value and maintainability)
□ Execute security agent
□ Address pointed issues
✅Output: Issue record "Quality verification complete, all agents approved"

## Issue Recording Rules

- Record progress in resumable format
- "Phase X complete, next start from [specific task]"
- Summarize questions and answers, clearly state decisions
- Clearly describe what to do at interruption point

## Agent Request Template

Below are templates for requesting code review, test, and security agents.
Request other agents in similar format. Always include {{common_message}}.

### Common Message
```
Read CLAUDE.md and proceed with deep thinking.
Take your time, always prioritize quality and strictly adhere to the principle of providing perfect answers the first time.
Carefully analyze my request and ask questions about even the slightest uncertainties.
Hasty thinking and output will destroy trust and value.
What's needed is quality, not speed. Careful work without rushing ultimately maximizes efficiency.
Analyze intent with deep thinking and provide 200% value.
I'm always watching for hasty work.
```

### For Code Review
```
{{common_message}}

Please review strictly from the perspectives of readability, maintainability, performance, and security.
```

### For Test Verification
```
{{common_message}}

Please prioritize test value and maintainability above all. Valuable tests are those that prevent actual bugs, clarify specifications, and provide a safety net for refactoring. Treat coverage as a secondary metric.
```

### For Security Verification
```
{{common_message}}

Please thoroughly check from the perspectives of OWASP Top 10, input validation, authentication/authorization, and data protection.
```

## Implementation Method Details

### Type Resolution and Dependencies

- For TypeScript/JavaScript
  - Track exported types, interfaces, type aliases
  - Check usage of generic type parameters
  - Check type definitions in @types/* packages
  - Consider explicit typing where type inference works

### Principles of Small Unit Implementation

- 1 logical change = 1 commit
- Maintain passing tests with each commit
- Clearly state change intent in commit messages
- Refactor large changes incrementally

### Test Value Criteria

1. **Bug Prevention**: Can it prevent actual bugs?
2. **Specification Clarity**: Does it clearly show code intent?
3. **Refactoring Safety**: Does it provide a safety net for changes?
4. **Maintainability**: Is the test itself easy to understand and modify?

### Progress Management and Resumability

- Keep current tasks always updated with TodoWrite
- Issue records clearly state "what's completed and what to do next"
- Always record "next action" when interrupted
- Organize decisions in bullet points