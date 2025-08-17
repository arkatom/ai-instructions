# Available Agents

## Overview

The ai-instructions project includes 90 specialized agents to enhance your AI development workflow. These agents can be deployed using the `agents deploy` command.

## Main Orchestrator

### 🌈 orchestrator
**The master conductor of all agents** - Coordinates multiple sub-agents for complex multi-domain tasks. When you need multiple specialists working together, the orchestrator manages the entire workflow.

## Categories

### 🚀 Development (20 agents)
Build features, implement systems, and create applications

- **rapid-prototyper** - Quickly build MVPs and proof-of-concepts
- **frontend-developer** - React, Vue, Angular UI implementation
- **backend-architect** - API design, microservices, system architecture
- **fullstack-engineer** - Complete application development
- **typescript-pro** - Advanced TypeScript development
- **python-pro** - Python expertise and best practices
- **javascript-pro** - Modern JavaScript development
- **react-pro** - React specialist with hooks and performance optimization
- **nextjs-pro** - Next.js 14+ App Router expert
- **vue-specialist** - Vue.js 3 Composition API expert
- **angular-expert** - Angular 17+ enterprise applications
- **golang-pro** - Go language and concurrent programming
- **rust-pro** - Rust systems programming
- **java-enterprise** - Spring Boot and enterprise Java
- **database-specialist** - SQL/NoSQL database design
- **mobile-app-builder** - React Native and mobile development
- **devops-automator** - CI/CD pipelines and automation
- **test-writer-fixer** - Comprehensive test creation and fixing
- **studio-backend-architect** - Studio-specific backend patterns
- **frontend-specialist** - Modern frontend frameworks

### ✅ Quality (11 agents)
Ensure code quality, security, and performance

- **code-reviewer** - Thorough code review and best practices
- **test-engineer** - Testing strategies and automation
- **security-auditor** - Vulnerability assessment and security
- **performance-tester** - Load testing and benchmarking
- **accessibility-auditor** - WCAG compliance and inclusive design
- **e2e-test-specialist** - Playwright and Cypress testing
- **api-tester** - API testing and contract validation
- **test-results-analyzer** - Test metrics and insights
- **performance-benchmarker** - Speed and optimization analysis
- **tool-evaluator** - Framework and tool assessment
- **studio-workflow-optimizer** - Workflow efficiency improvements

### 💼 Business (19 agents)
Product strategy, marketing, and growth

- **trend-researcher** - Market trends and viral opportunities
- **product-strategist** - Product roadmap and positioning
- **project-manager** - Sprint planning and coordination
- **business-analyst** - Requirements and process optimization
- **tiktok-strategist** - TikTok marketing and viral content
- **app-store-optimizer** - ASO and app store presence
- **growth-hacker** - User acquisition and retention
- **content-creator** - Content strategy and copywriting
- **feedback-synthesizer** - User feedback analysis
- **sprint-prioritizer** - Feature prioritization for 6-day cycles
- **project-shipper** - Launch coordination and go-to-market
- **studio-producer** - Cross-team coordination
- **experiment-tracker** - A/B testing and metrics
- **technical-writer** - Documentation and guides
- **api-designer** - API specification and design
- **requirements-analyst** - Requirements engineering
- **instagram-curator** - Instagram content strategy
- **reddit-community-builder** - Reddit community management
- **twitter-engager** - Twitter/X engagement strategy

### 🎨 Creative (6 agents)
Design, UX, and visual creativity

- **ui-designer** - Beautiful, functional interfaces
- **ux-designer** - User experience and interaction design
- **ux-researcher** - User research and validation
- **brand-guardian** - Brand consistency and guidelines
- **visual-storyteller** - Data visualization and infographics
- **whimsy-injector** - Add delight and personality to UIs

### 🏗️ Infrastructure (12 agents)
DevOps, cloud, and system management

- **cloud-architect** - AWS, GCP, Azure architecture
- **kubernetes-expert** - K8s cluster management
- **devops-engineer** - Infrastructure as code
- **monitoring-specialist** - Observability and alerting
- **deployment-manager** - Release orchestration
- **incident-responder** - Production issue resolution
- **infrastructure-maintainer** - System health and scaling
- **performance-engineer** - System optimization
- **support-responder** - Customer support automation
- **analytics-reporter** - Metrics and insights
- **finance-tracker** - Cost optimization and budgeting
- **legal-compliance-checker** - Regulatory compliance

### 🤖 Data & AI (7 agents)
Machine learning, data science, and AI integration

- **ai-engineer** - LLM integration and AI features
- **data-scientist** - Statistical analysis and ML
- **data-engineer** - Data pipelines and ETL
- **mlops-engineer** - ML deployment and operations
- **prompt-engineer** - Prompt optimization and RAG
- **analytics-engineer** - dbt and modern data stack
- **studio-ai-engineer** - Studio-specific AI implementations

### 🔧 Specialized (14 agents)
Unique and specialized capabilities

- **agent-generator** - Create new custom agents dynamically
- **joker** - Programming humor and team morale
- **error-detective** - Advanced debugging and root cause analysis
- **workflow-optimizer** - Human-AI collaboration efficiency
- **context-manager** - Session and memory management
- **documentation-writer** - Automated documentation
- **fintech-specialist** - Financial technology and payments
- **healthcare-dev** - HIPAA compliance and medical systems
- **game-developer** - Unity, Unreal, game mechanics
- **ecommerce-expert** - E-commerce platforms and checkout
- **embedded-engineer** - IoT and embedded systems
- **blockchain-developer** - Web3 and smart contracts
- **mobile-developer** - Native iOS and Android
- **studio-coach** - Agent performance coaching

## Usage Examples

```bash
# Deploy the orchestrator for complex tasks
ai-instructions agents deploy orchestrator

# Deploy a development team
ai-instructions agents deploy rapid-prototyper code-reviewer test-writer-fixer

# Deploy for TikTok app development
ai-instructions agents deploy tiktok-strategist mobile-app-builder app-store-optimizer

# Deploy specialized fun agents
ai-instructions agents deploy joker whimsy-injector

# Get detailed info about an agent
ai-instructions agents info agent-generator

# Get project-specific recommendations
ai-instructions agents recommend
```

## Agent Dependencies

Some agents work better together:
- `test-writer-fixer` + `code-reviewer` - Quality assurance team
- `ui-designer` + `frontend-developer` - Design implementation
- `orchestrator` + any specialists - Complex multi-domain tasks
- `trend-researcher` + `tiktok-strategist` - Viral content creation

## Notes

- For Claude Code: Agents are deployed as MD files to `./.claude/agents/` directory
- For other tools: Agents can be deployed to `./agents/` directory
- Use `agents list` to see all available agents
- Use `agents info <name>` for detailed agent information
- Use `agents deploy-all` to deploy all agents at once
- The orchestrator can coordinate multiple agents automatically