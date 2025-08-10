#!/bin/bash
# Simplified agent import script without strict error handling

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
SUCCESS=0
FAILED=0

# Function to download and verify file
download_file() {
    local url=$1
    local output=$2
    local name=$3
    
    echo -n "  Downloading $name..."
    
    # Download file without -f flag
    if curl -sS "${url}" -o "${output}" 2>/dev/null; then
        # Check if file is not empty and not 404 error
        if [ -s "${output}" ]; then
            # Check for actual 404 error page (not content containing "404")
            if head -1 "${output}" | grep -qi "^404.*not found" 2>/dev/null; then
                echo -e " ${RED}✗ (404 error)${NC}"
                rm -f "${output}"
                ((FAILED++))
            else
                # Check minimum file size (should be > 100 bytes for real agent files)
                local filesize=$(wc -c < "${output}")
                if [ "$filesize" -gt 100 ]; then
                    echo -e " ${GREEN}✓ (${filesize} bytes)${NC}"
                    ((SUCCESS++))
                else
                    echo -e " ${RED}✗ (too small: ${filesize} bytes)${NC}"
                    rm -f "${output}"
                    ((FAILED++))
                fi
            fi
        else
            echo -e " ${RED}✗ (empty file)${NC}"
            rm -f "${output}"
            ((FAILED++))
        fi
    else
        echo -e " ${RED}✗ (download failed)${NC}"
        ((FAILED++))
    fi
    ((TOTAL++))
}

echo "========================================="
echo "Agent Import Script v2.0"
echo "========================================="
echo ""

# ==========================================
# Part 1: stretchcloud/claude-code-unified-agents (70 agents)
# ==========================================
echo -e "${YELLOW}[1/2] Importing from stretchcloud/claude-code-unified-agents...${NC}"
echo ""

BASE_URL="https://raw.githubusercontent.com/stretchcloud/claude-code-unified-agents/main/claude-code-unified-agents/.claude/agents"

# Create directory structure
mkdir -p templates/agents/{business,creative,data-ai,development,infrastructure,quality,specialized}

# Business agents (6)
echo "📁 Business agents (6):"
download_file "${BASE_URL}/business/api-designer.md" "templates/agents/business/api-designer.md" "api-designer.md"
download_file "${BASE_URL}/business/business-analyst.md" "templates/agents/business/business-analyst.md" "business-analyst.md"
download_file "${BASE_URL}/business/product-strategist.md" "templates/agents/business/product-strategist.md" "product-strategist.md"
download_file "${BASE_URL}/business/project-manager.md" "templates/agents/business/project-manager.md" "project-manager.md"
download_file "${BASE_URL}/business/requirements-analyst.md" "templates/agents/business/requirements-analyst.md" "requirements-analyst.md"
download_file "${BASE_URL}/business/technical-writer.md" "templates/agents/business/technical-writer.md" "technical-writer.md"
echo ""

# Creative agents (1) - ux-designer.mdのみ存在
echo "📁 Creative agents (1):"
download_file "${BASE_URL}/creative/ux-designer.md" "templates/agents/creative/ux-designer.md" "ux-designer.md"
echo ""

# Data-AI agents (6)
echo "📁 Data-AI agents (6):"
download_file "${BASE_URL}/data-ai/ai-engineer.md" "templates/agents/data-ai/ai-engineer.md" "ai-engineer.md"
download_file "${BASE_URL}/data-ai/analytics-engineer.md" "templates/agents/data-ai/analytics-engineer.md" "analytics-engineer.md"
download_file "${BASE_URL}/data-ai/data-engineer.md" "templates/agents/data-ai/data-engineer.md" "data-engineer.md"
download_file "${BASE_URL}/data-ai/data-scientist.md" "templates/agents/data-ai/data-scientist.md" "data-scientist.md"
download_file "${BASE_URL}/data-ai/mlops-engineer.md" "templates/agents/data-ai/mlops-engineer.md" "mlops-engineer.md"
download_file "${BASE_URL}/data-ai/prompt-engineer.md" "templates/agents/data-ai/prompt-engineer.md" "prompt-engineer.md"
echo ""

# Development agents (14)
echo "📁 Development agents (14):"
download_file "${BASE_URL}/development/angular-expert.md" "templates/agents/development/angular-expert.md" "angular-expert.md"
download_file "${BASE_URL}/development/backend-architect.md" "templates/agents/development/backend-architect.md" "backend-architect.md"
download_file "${BASE_URL}/development/database-specialist.md" "templates/agents/development/database-specialist.md" "database-specialist.md"
download_file "${BASE_URL}/development/frontend-specialist.md" "templates/agents/development/frontend-specialist.md" "frontend-specialist.md"
download_file "${BASE_URL}/development/fullstack-engineer.md" "templates/agents/development/fullstack-engineer.md" "fullstack-engineer.md"
download_file "${BASE_URL}/development/golang-pro.md" "templates/agents/development/golang-pro.md" "golang-pro.md"
download_file "${BASE_URL}/development/java-enterprise.md" "templates/agents/development/java-enterprise.md" "java-enterprise.md"
download_file "${BASE_URL}/development/javascript-pro.md" "templates/agents/development/javascript-pro.md" "javascript-pro.md"
download_file "${BASE_URL}/development/nextjs-pro.md" "templates/agents/development/nextjs-pro.md" "nextjs-pro.md"
download_file "${BASE_URL}/development/python-pro.md" "templates/agents/development/python-pro.md" "python-pro.md"
download_file "${BASE_URL}/development/react-pro.md" "templates/agents/development/react-pro.md" "react-pro.md"
download_file "${BASE_URL}/development/rust-pro.md" "templates/agents/development/rust-pro.md" "rust-pro.md"
download_file "${BASE_URL}/development/typescript-pro.md" "templates/agents/development/typescript-pro.md" "typescript-pro.md"
download_file "${BASE_URL}/development/vue-specialist.md" "templates/agents/development/vue-specialist.md" "vue-specialist.md"
echo ""

# Infrastructure agents (7)
echo "📁 Infrastructure agents (7):"
download_file "${BASE_URL}/infrastructure/cloud-architect.md" "templates/agents/infrastructure/cloud-architect.md" "cloud-architect.md"
download_file "${BASE_URL}/infrastructure/deployment-manager.md" "templates/agents/infrastructure/deployment-manager.md" "deployment-manager.md"
download_file "${BASE_URL}/infrastructure/devops-engineer.md" "templates/agents/infrastructure/devops-engineer.md" "devops-engineer.md"
download_file "${BASE_URL}/infrastructure/incident-responder.md" "templates/agents/infrastructure/incident-responder.md" "incident-responder.md"
download_file "${BASE_URL}/infrastructure/kubernetes-expert.md" "templates/agents/infrastructure/kubernetes-expert.md" "kubernetes-expert.md"
download_file "${BASE_URL}/infrastructure/monitoring-specialist.md" "templates/agents/infrastructure/monitoring-specialist.md" "monitoring-specialist.md"
download_file "${BASE_URL}/infrastructure/performance-engineer.md" "templates/agents/infrastructure/performance-engineer.md" "performance-engineer.md"
echo ""

# Quality agents (6)
echo "📁 Quality agents (6):"
download_file "${BASE_URL}/quality/accessibility-auditor.md" "templates/agents/quality/accessibility-auditor.md" "accessibility-auditor.md"
download_file "${BASE_URL}/quality/code-reviewer.md" "templates/agents/quality/code-reviewer.md" "code-reviewer.md"
download_file "${BASE_URL}/quality/e2e-test-specialist.md" "templates/agents/quality/e2e-test-specialist.md" "e2e-test-specialist.md"
download_file "${BASE_URL}/quality/performance-tester.md" "templates/agents/quality/performance-tester.md" "performance-tester.md"
download_file "${BASE_URL}/quality/security-auditor.md" "templates/agents/quality/security-auditor.md" "security-auditor.md"
download_file "${BASE_URL}/quality/test-engineer.md" "templates/agents/quality/test-engineer.md" "test-engineer.md"
echo ""

# Specialized agents (12)
echo "📁 Specialized agents (12):"
download_file "${BASE_URL}/specialized/agent-generator.md" "templates/agents/specialized/agent-generator.md" "agent-generator.md"
download_file "${BASE_URL}/specialized/blockchain-developer.md" "templates/agents/specialized/blockchain-developer.md" "blockchain-developer.md"
download_file "${BASE_URL}/specialized/context-manager.md" "templates/agents/specialized/context-manager.md" "context-manager.md"
download_file "${BASE_URL}/specialized/documentation-writer.md" "templates/agents/specialized/documentation-writer.md" "documentation-writer.md"
download_file "${BASE_URL}/specialized/ecommerce-expert.md" "templates/agents/specialized/ecommerce-expert.md" "ecommerce-expert.md"
download_file "${BASE_URL}/specialized/embedded-engineer.md" "templates/agents/specialized/embedded-engineer.md" "embedded-engineer.md"
download_file "${BASE_URL}/specialized/error-detective.md" "templates/agents/specialized/error-detective.md" "error-detective.md"
download_file "${BASE_URL}/specialized/fintech-specialist.md" "templates/agents/specialized/fintech-specialist.md" "fintech-specialist.md"
download_file "${BASE_URL}/specialized/game-developer.md" "templates/agents/specialized/game-developer.md" "game-developer.md"
download_file "${BASE_URL}/specialized/healthcare-dev.md" "templates/agents/specialized/healthcare-dev.md" "healthcare-dev.md"
download_file "${BASE_URL}/specialized/mobile-developer.md" "templates/agents/specialized/mobile-developer.md" "mobile-developer.md"
download_file "${BASE_URL}/specialized/workflow-optimizer.md" "templates/agents/specialized/workflow-optimizer.md" "workflow-optimizer.md"
echo ""

# Orchestrator agent (1)
echo "📁 Orchestrator agent (1):"
download_file "${BASE_URL}/orchestrator.md" "templates/agents/orchestrator.md" "orchestrator.md"
echo ""

# ==========================================
# Part 2: contains-studio/agents (42 agents)
# ==========================================
echo -e "${YELLOW}[2/2] Importing from contains-studio/agents...${NC}"
echo ""

CS_BASE_URL="https://raw.githubusercontent.com/contains-studio/agents/main"

# Create contains-studio directory structure
mkdir -p templates/agents/contains-studio/{bonus,design,engineering,marketing,product,project-management,studio-operations,testing}

# Bonus agents (2)
echo "📁 Bonus agents (2):"
download_file "${CS_BASE_URL}/bonus/joker.md" "templates/agents/contains-studio/bonus/joker.md" "joker.md"
download_file "${CS_BASE_URL}/bonus/studio-coach.md" "templates/agents/contains-studio/bonus/studio-coach.md" "studio-coach.md"
echo ""

# Design agents (5)
echo "📁 Design agents (5):"
download_file "${CS_BASE_URL}/design/brand-guardian.md" "templates/agents/contains-studio/design/brand-guardian.md" "brand-guardian.md"
download_file "${CS_BASE_URL}/design/ui-designer.md" "templates/agents/contains-studio/design/ui-designer.md" "ui-designer.md"
download_file "${CS_BASE_URL}/design/ux-researcher.md" "templates/agents/contains-studio/design/ux-researcher.md" "ux-researcher.md"
download_file "${CS_BASE_URL}/design/visual-storyteller.md" "templates/agents/contains-studio/design/visual-storyteller.md" "visual-storyteller.md"
download_file "${CS_BASE_URL}/design/whimsy-injector.md" "templates/agents/contains-studio/design/whimsy-injector.md" "whimsy-injector.md"
echo ""

# Engineering agents (7)
echo "📁 Engineering agents (7):"
download_file "${CS_BASE_URL}/engineering/ai-engineer.md" "templates/agents/contains-studio/engineering/ai-engineer.md" "ai-engineer.md"
download_file "${CS_BASE_URL}/engineering/backend-architect.md" "templates/agents/contains-studio/engineering/backend-architect.md" "backend-architect.md"
download_file "${CS_BASE_URL}/engineering/devops-automator.md" "templates/agents/contains-studio/engineering/devops-automator.md" "devops-automator.md"
download_file "${CS_BASE_URL}/engineering/frontend-developer.md" "templates/agents/contains-studio/engineering/frontend-developer.md" "frontend-developer.md"
download_file "${CS_BASE_URL}/engineering/mobile-app-builder.md" "templates/agents/contains-studio/engineering/mobile-app-builder.md" "mobile-app-builder.md"
download_file "${CS_BASE_URL}/engineering/rapid-prototyper.md" "templates/agents/contains-studio/engineering/rapid-prototyper.md" "rapid-prototyper.md"
download_file "${CS_BASE_URL}/engineering/test-writer-fixer.md" "templates/agents/contains-studio/engineering/test-writer-fixer.md" "test-writer-fixer.md"
echo ""

# Marketing agents (7)
echo "📁 Marketing agents (7):"
download_file "${CS_BASE_URL}/marketing/app-store-optimizer.md" "templates/agents/contains-studio/marketing/app-store-optimizer.md" "app-store-optimizer.md"
download_file "${CS_BASE_URL}/marketing/content-creator.md" "templates/agents/contains-studio/marketing/content-creator.md" "content-creator.md"
download_file "${CS_BASE_URL}/marketing/growth-hacker.md" "templates/agents/contains-studio/marketing/growth-hacker.md" "growth-hacker.md"
download_file "${CS_BASE_URL}/marketing/instagram-curator.md" "templates/agents/contains-studio/marketing/instagram-curator.md" "instagram-curator.md"
download_file "${CS_BASE_URL}/marketing/reddit-community-builder.md" "templates/agents/contains-studio/marketing/reddit-community-builder.md" "reddit-community-builder.md"
download_file "${CS_BASE_URL}/marketing/tiktok-strategist.md" "templates/agents/contains-studio/marketing/tiktok-strategist.md" "tiktok-strategist.md"
download_file "${CS_BASE_URL}/marketing/twitter-engager.md" "templates/agents/contains-studio/marketing/twitter-engager.md" "twitter-engager.md"
echo ""

# Product agents (3)
echo "📁 Product agents (3):"
download_file "${CS_BASE_URL}/product/feedback-synthesizer.md" "templates/agents/contains-studio/product/feedback-synthesizer.md" "feedback-synthesizer.md"
download_file "${CS_BASE_URL}/product/sprint-prioritizer.md" "templates/agents/contains-studio/product/sprint-prioritizer.md" "sprint-prioritizer.md"
download_file "${CS_BASE_URL}/product/trend-researcher.md" "templates/agents/contains-studio/product/trend-researcher.md" "trend-researcher.md"
echo ""

# Project Management agents (3)
echo "📁 Project Management agents (3):"
download_file "${CS_BASE_URL}/project-management/experiment-tracker.md" "templates/agents/contains-studio/project-management/experiment-tracker.md" "experiment-tracker.md"
download_file "${CS_BASE_URL}/project-management/project-shipper.md" "templates/agents/contains-studio/project-management/project-shipper.md" "project-shipper.md"
download_file "${CS_BASE_URL}/project-management/studio-producer.md" "templates/agents/contains-studio/project-management/studio-producer.md" "studio-producer.md"
echo ""

# Studio Operations agents (5)
echo "📁 Studio Operations agents (5):"
download_file "${CS_BASE_URL}/studio-operations/analytics-reporter.md" "templates/agents/contains-studio/studio-operations/analytics-reporter.md" "analytics-reporter.md"
download_file "${CS_BASE_URL}/studio-operations/finance-tracker.md" "templates/agents/contains-studio/studio-operations/finance-tracker.md" "finance-tracker.md"
download_file "${CS_BASE_URL}/studio-operations/infrastructure-maintainer.md" "templates/agents/contains-studio/studio-operations/infrastructure-maintainer.md" "infrastructure-maintainer.md"
download_file "${CS_BASE_URL}/studio-operations/legal-compliance-checker.md" "templates/agents/contains-studio/studio-operations/legal-compliance-checker.md" "legal-compliance-checker.md"
download_file "${CS_BASE_URL}/studio-operations/support-responder.md" "templates/agents/contains-studio/studio-operations/support-responder.md" "support-responder.md"
echo ""

# Testing agents (5)
echo "📁 Testing agents (5):"
download_file "${CS_BASE_URL}/testing/api-tester.md" "templates/agents/contains-studio/testing/api-tester.md" "api-tester.md"
download_file "${CS_BASE_URL}/testing/performance-benchmarker.md" "templates/agents/contains-studio/testing/performance-benchmarker.md" "performance-benchmarker.md"
download_file "${CS_BASE_URL}/testing/test-results-analyzer.md" "templates/agents/contains-studio/testing/test-results-analyzer.md" "test-results-analyzer.md"
download_file "${CS_BASE_URL}/testing/tool-evaluator.md" "templates/agents/contains-studio/testing/tool-evaluator.md" "tool-evaluator.md"
download_file "${CS_BASE_URL}/testing/workflow-optimizer.md" "templates/agents/contains-studio/testing/workflow-optimizer.md" "workflow-optimizer.md"
echo ""

# ==========================================
# Summary
# ==========================================
echo "========================================="
echo -e "${YELLOW}Import Summary:${NC}"
echo "========================================="
echo -e "Total files attempted: ${TOTAL}"
echo -e "Successfully downloaded: ${GREEN}${SUCCESS}${NC}"
echo -e "Failed downloads: ${RED}${FAILED}${NC}"

if [ ${FAILED} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All agents imported successfully!${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some files failed to download. Please check the errors above.${NC}"
fi

echo "========================================="