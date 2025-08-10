#!/bin/bash

# Import agents from stretchcloud/claude-code-unified-agents repository
echo "Importing agents from stretchcloud/claude-code-unified-agents..."

# Base URL for raw GitHub content
BASE_URL="https://raw.githubusercontent.com/stretchcloud/claude-code-unified-agents/main/claude-code-unified-agents/.claude/agents"

# Create agents directory structure
mkdir -p templates/agents/{business,creative,data-ai,development,infrastructure,quality,specialized}

# Business agents
echo "Importing business agents..."
curl -s "${BASE_URL}/business/api-designer.md" -o "templates/agents/business/api-designer.md"
curl -s "${BASE_URL}/business/business-analyst.md" -o "templates/agents/business/business-analyst.md"
curl -s "${BASE_URL}/business/product-strategist.md" -o "templates/agents/business/product-strategist.md"
curl -s "${BASE_URL}/business/project-manager.md" -o "templates/agents/business/project-manager.md"
curl -s "${BASE_URL}/business/requirements-analyst.md" -o "templates/agents/business/requirements-analyst.md"
curl -s "${BASE_URL}/business/technical-writer.md" -o "templates/agents/business/technical-writer.md"

# Get all other directories content
echo "Importing creative agents..."
curl -s "${BASE_URL}/creative/content-strategist.md" -o "templates/agents/creative/content-strategist.md"
curl -s "${BASE_URL}/creative/creative-director.md" -o "templates/agents/creative/creative-director.md"
curl -s "${BASE_URL}/creative/design-system-architect.md" -o "templates/agents/creative/design-system-architect.md"
curl -s "${BASE_URL}/creative/product-designer.md" -o "templates/agents/creative/product-designer.md"
curl -s "${BASE_URL}/creative/ui-designer.md" -o "templates/agents/creative/ui-designer.md"
curl -s "${BASE_URL}/creative/ux-researcher.md" -o "templates/agents/creative/ux-researcher.md"

echo "Importing data-ai agents..."
curl -s "${BASE_URL}/data-ai/ai-engineer.md" -o "templates/agents/data-ai/ai-engineer.md"
curl -s "${BASE_URL}/data-ai/computer-vision-engineer.md" -o "templates/agents/data-ai/computer-vision-engineer.md"
curl -s "${BASE_URL}/data-ai/data-analyst.md" -o "templates/agents/data-ai/data-analyst.md"
curl -s "${BASE_URL}/data-ai/data-engineer.md" -o "templates/agents/data-ai/data-engineer.md"
curl -s "${BASE_URL}/data-ai/data-scientist.md" -o "templates/agents/data-ai/data-scientist.md"
curl -s "${BASE_URL}/data-ai/machine-learning-engineer.md" -o "templates/agents/data-ai/machine-learning-engineer.md"
curl -s "${BASE_URL}/data-ai/nlp-engineer.md" -o "templates/agents/data-ai/nlp-engineer.md"

echo "Importing development agents..."
curl -s "${BASE_URL}/development/backend-engineer.md" -o "templates/agents/development/backend-engineer.md"
curl -s "${BASE_URL}/development/blockchain-developer.md" -o "templates/agents/development/blockchain-developer.md"
curl -s "${BASE_URL}/development/code-reviewer.md" -o "templates/agents/development/code-reviewer.md"
curl -s "${BASE_URL}/development/database-architect.md" -o "templates/agents/development/database-architect.md"
curl -s "${BASE_URL}/development/devops-engineer.md" -o "templates/agents/development/devops-engineer.md"
curl -s "${BASE_URL}/development/frontend-engineer.md" -o "templates/agents/development/frontend-engineer.md"
curl -s "${BASE_URL}/development/full-stack-developer.md" -o "templates/agents/development/full-stack-developer.md"
curl -s "${BASE_URL}/development/game-developer.md" -o "templates/agents/development/game-developer.md"
curl -s "${BASE_URL}/development/mobile-developer.md" -o "templates/agents/development/mobile-developer.md"
curl -s "${BASE_URL}/development/system-architect.md" -o "templates/agents/development/system-architect.md"

echo "Importing infrastructure agents..."
curl -s "${BASE_URL}/infrastructure/cloud-architect.md" -o "templates/agents/infrastructure/cloud-architect.md"
curl -s "${BASE_URL}/infrastructure/kubernetes-specialist.md" -o "templates/agents/infrastructure/kubernetes-specialist.md"
curl -s "${BASE_URL}/infrastructure/network-engineer.md" -o "templates/agents/infrastructure/network-engineer.md"
curl -s "${BASE_URL}/infrastructure/platform-engineer.md" -o "templates/agents/infrastructure/platform-engineer.md"
curl -s "${BASE_URL}/infrastructure/security-engineer.md" -o "templates/agents/infrastructure/security-engineer.md"
curl -s "${BASE_URL}/infrastructure/site-reliability-engineer.md" -o "templates/agents/infrastructure/site-reliability-engineer.md"

echo "Importing quality agents..."
curl -s "${BASE_URL}/quality/accessibility-specialist.md" -o "templates/agents/quality/accessibility-specialist.md"
curl -s "${BASE_URL}/quality/performance-engineer.md" -o "templates/agents/quality/performance-engineer.md"
curl -s "${BASE_URL}/quality/qa-automation-engineer.md" -o "templates/agents/quality/qa-automation-engineer.md"
curl -s "${BASE_URL}/quality/qa-test-lead.md" -o "templates/agents/quality/qa-test-lead.md"
curl -s "${BASE_URL}/quality/security-auditor.md" -o "templates/agents/quality/security-auditor.md"

echo "Importing specialized agents..."
curl -s "${BASE_URL}/specialized/agile-coach.md" -o "templates/agents/specialized/agile-coach.md"
curl -s "${BASE_URL}/specialized/aws-specialist.md" -o "templates/agents/specialized/aws-specialist.md"
curl -s "${BASE_URL}/specialized/azure-specialist.md" -o "templates/agents/specialized/azure-specialist.md"
curl -s "${BASE_URL}/specialized/gcp-specialist.md" -o "templates/agents/specialized/gcp-specialist.md"
curl -s "${BASE_URL}/specialized/go-specialist.md" -o "templates/agents/specialized/go-specialist.md"
curl -s "${BASE_URL}/specialized/java-specialist.md" -o "templates/agents/specialized/java-specialist.md"
curl -s "${BASE_URL}/specialized/javascript-specialist.md" -o "templates/agents/specialized/javascript-specialist.md"
curl -s "${BASE_URL}/specialized/python-specialist.md" -o "templates/agents/specialized/python-specialist.md"
curl -s "${BASE_URL}/specialized/react-specialist.md" -o "templates/agents/specialized/react-specialist.md"
curl -s "${BASE_URL}/specialized/rust-specialist.md" -o "templates/agents/specialized/rust-specialist.md"
curl -s "${BASE_URL}/specialized/solutions-architect.md" -o "templates/agents/specialized/solutions-architect.md"
curl -s "${BASE_URL}/specialized/typescript-specialist.md" -o "templates/agents/specialized/typescript-specialist.md"

echo "Importing orchestrator agent..."
curl -s "${BASE_URL}/orchestrator.md" -o "templates/agents/orchestrator.md"

# Remove old placeholder agents
rm -f templates/agents/backend-developer.md
rm -f templates/agents/frontend-developer.md

echo "✅ Successfully imported 54 agents from stretchcloud/claude-code-unified-agents"

# Now import agents from contains-studio/agents
echo -e "\nImporting agents from contains-studio/agents..."

# Base URL for contains-studio agents
CS_BASE_URL="https://raw.githubusercontent.com/contains-studio/agents/main"

# Create contains-studio directory structure
mkdir -p templates/agents/contains-studio/{bonus,design,engineering,marketing,product,project-management,studio-operations,testing}

# Engineering agents
echo "Importing engineering agents from contains-studio..."
curl -s "${CS_BASE_URL}/engineering/ai-engineer.md" -o "templates/agents/contains-studio/engineering/ai-engineer.md"
curl -s "${CS_BASE_URL}/engineering/backend-architect.md" -o "templates/agents/contains-studio/engineering/backend-architect.md"
curl -s "${CS_BASE_URL}/engineering/devops-automator.md" -o "templates/agents/contains-studio/engineering/devops-automator.md"
curl -s "${CS_BASE_URL}/engineering/frontend-developer.md" -o "templates/agents/contains-studio/engineering/frontend-developer.md"
curl -s "${CS_BASE_URL}/engineering/mobile-app-builder.md" -o "templates/agents/contains-studio/engineering/mobile-app-builder.md"
curl -s "${CS_BASE_URL}/engineering/rapid-prototyper.md" -o "templates/agents/contains-studio/engineering/rapid-prototyper.md"
curl -s "${CS_BASE_URL}/engineering/test-writer-fixer.md" -o "templates/agents/contains-studio/engineering/test-writer-fixer.md"

# Design agents
echo "Importing design agents from contains-studio..."
curl -s "${CS_BASE_URL}/design/design-system-architect.md" -o "templates/agents/contains-studio/design/design-system-architect.md"
curl -s "${CS_BASE_URL}/design/ui-ux-designer.md" -o "templates/agents/contains-studio/design/ui-ux-designer.md"

# Product agents
echo "Importing product agents from contains-studio..."
curl -s "${CS_BASE_URL}/product/feature-builder.md" -o "templates/agents/contains-studio/product/feature-builder.md"
curl -s "${CS_BASE_URL}/product/product-analyst.md" -o "templates/agents/contains-studio/product/product-analyst.md"
curl -s "${CS_BASE_URL}/product/product-strategist.md" -o "templates/agents/contains-studio/product/product-strategist.md"

# Marketing agents
echo "Importing marketing agents from contains-studio..."
curl -s "${CS_BASE_URL}/marketing/content-creator.md" -o "templates/agents/contains-studio/marketing/content-creator.md"
curl -s "${CS_BASE_URL}/marketing/copywriter.md" -o "templates/agents/contains-studio/marketing/copywriter.md"
curl -s "${CS_BASE_URL}/marketing/marketing-strategist.md" -o "templates/agents/contains-studio/marketing/marketing-strategist.md"

# Project Management agents
echo "Importing project management agents from contains-studio..."
curl -s "${CS_BASE_URL}/project-management/agile-coach.md" -o "templates/agents/contains-studio/project-management/agile-coach.md"
curl -s "${CS_BASE_URL}/project-management/project-manager.md" -o "templates/agents/contains-studio/project-management/project-manager.md"
curl -s "${CS_BASE_URL}/project-management/requirements-analyst.md" -o "templates/agents/contains-studio/project-management/requirements-analyst.md"

# Studio Operations agents
echo "Importing studio operations agents from contains-studio..."
curl -s "${CS_BASE_URL}/studio-operations/operations-manager.md" -o "templates/agents/contains-studio/studio-operations/operations-manager.md"
curl -s "${CS_BASE_URL}/studio-operations/pitch-perfect-specialist.md" -o "templates/agents/contains-studio/studio-operations/pitch-perfect-specialist.md"
curl -s "${CS_BASE_URL}/studio-operations/research-guru.md" -o "templates/agents/contains-studio/studio-operations/research-guru.md"

# Testing agents
echo "Importing testing agents from contains-studio..."
curl -s "${CS_BASE_URL}/testing/qa-automation-specialist.md" -o "templates/agents/contains-studio/testing/qa-automation-specialist.md"
curl -s "${CS_BASE_URL}/testing/test-strategist.md" -o "templates/agents/contains-studio/testing/test-strategist.md"

# Bonus agents
echo "Importing bonus agents from contains-studio..."
curl -s "${CS_BASE_URL}/bonus/code-reviewer-extreme.md" -o "templates/agents/contains-studio/bonus/code-reviewer-extreme.md"
curl -s "${CS_BASE_URL}/bonus/debugging-master.md" -o "templates/agents/contains-studio/bonus/debugging-master.md"

echo "✅ Successfully imported agents from contains-studio/agents"
echo "✅ Agent import complete!"