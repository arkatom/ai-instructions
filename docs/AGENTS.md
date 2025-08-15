# Agent Deployment System Documentation

## Overview

The Agent Deployment System provides a comprehensive CLI interface for discovering, recommending, and deploying AI development agents to your projects. This system is part of the `@arkatom/ai-instructions` toolkit.

## Features

- **Agent Discovery**: Browse available agents with detailed metadata
- **Smart Recommendations**: Get agent suggestions based on your project profile
- **Dependency Management**: Automatic resolution of agent dependencies and conflict detection
- **Multiple Output Formats**: Support for table, JSON, and tree display formats
- **Project Profiling**: Analyze projects to recommend suitable agents

## CLI Commands

### `agents list`
List all available agents in the system.

```bash
ai-instructions agents list [options]

Options:
  -c, --category <category>  Filter by category (development, quality, etc.)
  -f, --format <format>      Output format: table, json, tree (default: table)
```

Example:
```bash
# List all agents
ai-instructions agents list

# List only quality-focused agents
ai-instructions agents list --category quality

# Get JSON output for programmatic use
ai-instructions agents list --format json
```

### `agents info <name>`
Display detailed information about a specific agent.

```bash
ai-instructions agents info <name> [options]

Options:
  -f, --format <format>  Output format: table, json, tree (default: table)
```

Example:
```bash
# Get info about test-writer-fixer agent
ai-instructions agents info test-writer-fixer

# Get info in JSON format
ai-instructions agents info code-reviewer --format json
```

### `agents recommend`
Get agent recommendations based on current context.

```bash
ai-instructions agents recommend [options]

Options:
  -c, --category <category>  Filter recommendations by category
  -f, --format <format>      Output format: table, json, tree (default: table)
```

Example:
```bash
# Get general recommendations
ai-instructions agents recommend

# Get frontend-specific recommendations
ai-instructions agents recommend --category development
```

### `agents deploy <agents...>`
Deploy one or more agents to your project.

```bash
ai-instructions agents deploy <agents...> [options]

Options:
  -o, --output <path>    Output directory (default: ./agents)
  --action <action>      Deployment action (generate, etc.)
```

Example:
```bash
# Deploy a single agent
ai-instructions agents deploy test-writer-fixer

# Deploy multiple agents
ai-instructions agents deploy test-writer-fixer code-reviewer

# Deploy to custom directory
ai-instructions agents deploy react-pro --output ./my-agents
```

### `agents profile <project>`
Profile a project directory and get agent recommendations.

```bash
ai-instructions agents profile <project> [options]

Options:
  -f, --format <format>  Output format: table, json, tree (default: table)
  -v, --verbose          Show detailed analysis
```

Example:
```bash
# Profile current directory
ai-instructions agents profile .

# Profile specific project with details
ai-instructions agents profile /path/to/project --verbose

# Get profile in JSON format
ai-instructions agents profile . --format json
```

## Available Agents

### Quality Category

#### test-writer-fixer
- **Description**: Test writing and fixing agent
- **Tags**: testing, quality, jest, tdd
- **Relationships**:
  - Enhances: code-reviewer
  - Collaborates with: rapid-prototyper

#### code-reviewer
- **Description**: Code review agent
- **Tags**: quality, review, best-practices, security
- **Relationships**:
  - Collaborates with: test-writer-fixer

### Development Category

#### react-pro
- **Description**: React development expert
- **Tags**: react, frontend, javascript, hooks
- **Relationships**:
  - Conflicts with: angular-expert

#### angular-expert
- **Description**: Angular development expert
- **Tags**: angular, frontend, typescript, rxjs
- **Relationships**:
  - Conflicts with: react-pro

#### rapid-prototyper
- **Description**: Rapid prototyping and MVP development
- **Tags**: prototyping, mvp, agile, fullstack
- **Relationships**:
  - Collaborates with: test-writer-fixer

## Agent Relationships

Agents can have four types of relationships:

1. **Requires**: Dependencies that must be deployed together
2. **Enhances**: Agents that provide additional value when used together
3. **Collaborates With**: Agents that work well in tandem
4. **Conflicts With**: Mutually exclusive agents (e.g., React vs Angular)

The system automatically handles these relationships during deployment:
- Required dependencies are automatically included
- Conflicts are detected and prevent incompatible deployments
- Collaborative agents are suggested together

## Project Profiling

The profile command analyzes your project to determine:

- **Project Type**: Node.js, Python, etc.
- **Frameworks**: React, Vue, Angular, Express, Django, Flask
- **Development Phase**: Initial setup, active development, maintenance
- **Testing Tools**: Jest, Mocha, Cypress, Pytest
- **Build Tools**: Webpack, Vite, TypeScript

Based on this analysis, the system recommends agents that best fit your project's needs.

## Integration Testing

The system includes comprehensive integration tests covering:

- Complete workflow scenarios
- Error handling and edge cases
- Output format validation
- Dependency resolution
- Performance benchmarks

Run tests with:
```bash
npm test -- test/integration/agents-e2e.test.ts
npm test -- test/integration/agents-dependencies.test.ts
```

## Quality Validation

A validation script ensures all agents meet quality standards:

```bash
npx ts-node scripts/validate-agents.ts
```

This validates:
- Required fields presence
- Relationship integrity
- Bidirectional conflicts
- Category consistency
- Description quality
- Tag relevance

## Architecture

The agent system follows a modular architecture:

```
src/
├── agents/
│   ├── types.ts              # TypeScript interfaces
│   ├── metadata-loader.ts    # YAML loading and caching
│   ├── dependency-resolver.ts # Dependency management
│   └── recommendation-engine.ts # Smart recommendations
├── cli/
│   └── commands/
│       └── AgentsCommand.ts  # CLI command implementation
└── scripts/
    └── validate-agents.ts    # Quality validation
```

## Best Practices

1. **Always profile before deploying**: Use `agents profile` to understand your project needs
2. **Check for conflicts**: The system prevents conflicting deployments automatically
3. **Use appropriate formats**: JSON for automation, tree for visualization, table for quick reading
4. **Validate custom agents**: Run the validation script after adding new agents
5. **Keep metadata updated**: Ensure agent metadata reflects current capabilities

## Contributing

To add new agents:

1. Create a YAML file in `agents/metadata/`
2. Include all required fields (name, category, description, tags, relationships)
3. Ensure bidirectional conflict relationships
4. Run validation script to verify quality
5. Add integration tests for new agent relationships
6. Update this documentation

## Testing

The system includes multiple test levels:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflows
- **Dependency Tests**: Relationship validation
- **Quality Tests**: Metadata validation

Run all tests:
```bash
npm test
```

## Future Enhancements

- [ ] Agent versioning support
- [ ] Remote agent repository integration
- [ ] Custom agent templates
- [ ] Agent update notifications
- [ ] Performance metrics collection
- [ ] Agent usage analytics