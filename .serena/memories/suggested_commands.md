# Suggested Commands

## Development Commands
```bash
# Start the CLI tool
npm start

# Run tests  
npm test
# Note: Tests configured with Jest but no test files exist yet

# Build (no build step required)
npm run build

# Lint (not configured yet)
npm run lint
```

## CLI Usage
```bash
# Run the CLI tool directly
./src/cli.js

# Install and use globally
npm install -g .
ai-instructions

# Show help
ai-instructions --help

# Initialize instructions (planned for Issue #3)
ai-instructions init
ai-instructions init --tool claude
ai-instructions init --all
ai-instructions init --interactive
```

## Git Commands (following project conventions)
```bash
# Status check
git status

# Commit with proper format
git commit -m "type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]"

# Examples:
git commit -m "feat(cli): #3 implement init command [domain:cli] [tags:scaffolding,templates]"
git commit -m "fix(templates): #4 resolve template generation issue [domain:templates] [tags:generation,fix]"
```

## System Commands (Darwin/macOS)
```bash
# File listing
ls -la
find . -name "*.js" -type f

# Search in files  
grep -r "pattern" .
rg "pattern"  # ripgrep if available

# Directory navigation
cd path/to/directory
```

## Project Exploration
```bash
# View project structure
tree -I node_modules
find . -type f -name "*.js" -o -name "*.json" -o -name "*.md" | head -20
```