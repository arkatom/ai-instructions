/**
 * AgentsCommand - Agent deployment and management CLI commands
 * Issue #93: Agent deployment CLI commands implementation
 */

import { Command } from '../interfaces/Command';
import { CommandArgs, AgentCommandArgs } from '../interfaces/CommandArgs';
import { CommandResult } from '../interfaces/CommandResult';
import { ValidationResult } from '../interfaces/ValidationResult';
import { AgentValidator } from '../validators/AgentValidator';
import { SecurityValidator } from '../validators/SecurityValidator';
import { AgentMetadataLoader } from '../../agents/metadata-loader';
import { 
  RecommendationEngine, 
  RecommendationResult,
  RecommendationOptions 
} from '../../agents/recommendation-engine';
import { DependencyResolver } from '../../agents/dependency-resolver';
import { AgentMetadata, ProjectContext } from '../../agents/types';
import type { AgentFileLocation } from '../../agents/agent-file-finder';
import { Logger } from '../../utils/logger';
import { SafeOperation, ErrorFormatter } from '../../utils/error-helpers';
import { join } from 'path';

/**
 * Deployment result interface
 */
interface DeploymentResult {
  deployed: string[];
  outputPath: string;
  action?: string;
  generated?: {
    files: string[];
    timestamp: string;
  };
}

/**
 * Profile result interface
 */
interface ProfileResult {
  projectContext: ProjectContext;
  recommended: RecommendationResult;
  detailedAnalysis?: {
    files: string[];
    dependencies: string[];
    testingTools: string[];
  };
}

/**
 * Command Pattern implementation for agents command with subcommands
 */
export class AgentsCommand implements Command {
  private agentValidator: AgentValidator;
  private securityValidator: SecurityValidator;
  private metadataLoader: AgentMetadataLoader;
  private recommendationEngine: RecommendationEngine | null = null;
  private dependencyResolver: DependencyResolver | null = null;

  // Display formatting constants
  private readonly TABLE_SEPARATOR_LENGTH = 60;
  private readonly TREE_BRANCH = '├──';
  private readonly TREE_LAST_BRANCH = '└──';
  private readonly TREE_VERTICAL = '│';
  private readonly TAB_SEPARATOR = '\t\t';

  constructor() {
    this.agentValidator = new AgentValidator();
    this.securityValidator = new SecurityValidator();
    
    // Initialize metadata loader
    const agentsBasePath = join(__dirname, '../../../agents');
    this.metadataLoader = new AgentMetadataLoader(agentsBasePath);
  }

  /**
   * Initialize recommendation engine with loaded agents
   */
  private async initializeRecommendationEngine(): Promise<void> {
    if (!this.recommendationEngine) {
      const agents = await this.metadataLoader.loadAllMetadata();
      this.recommendationEngine = new RecommendationEngine(agents);
    }
  }

  /**
   * Initialize dependency resolver with loaded agents
   */
  private async initializeDependencyResolver(): Promise<void> {
    if (!this.dependencyResolver) {
      const agents = await this.metadataLoader.loadAllMetadata();
      const agentsMap = new Map(agents.map(agent => [agent.name, agent]));
      this.dependencyResolver = new DependencyResolver(agentsMap);
    }
  }

  /**
   * Validate agent command arguments
   */
  validate(args: CommandArgs): ValidationResult {
    const agentArgs = args as AgentCommandArgs;
    const errors: string[] = [];

    // Validate subcommand
    const validSubcommands = ['list', 'recommend', 'deploy', 'deploy-all', 'info', 'profile'];
    if (!agentArgs.subcommand || !validSubcommands.includes(agentArgs.subcommand)) {
      errors.push(`Invalid subcommand. Valid subcommands: ${validSubcommands.join(', ')}`);
    }

    // Validate format if provided
    if (agentArgs.format) {
      const validFormats = ['table', 'json', 'tree'];
      if (!validFormats.includes(agentArgs.format)) {
        errors.push(`Invalid format. Valid formats: ${validFormats.join(', ')}`);
      }
    }

    // Validate agent names if provided (with security checks)
    if (agentArgs.agents && Array.isArray(agentArgs.agents)) {
      for (const agentName of agentArgs.agents) {
        if (typeof agentName === 'string') {
          // Security validation first
          const securityValidation = this.securityValidator.validateAgentName(agentName);
          if (!securityValidation.isValid) {
            errors.push(...securityValidation.errors);
          }
          
          // Then business logic validation
          const agentValidation = this.agentValidator.validate(agentName);
          if (!agentValidation.isValid) {
            errors.push(...agentValidation.errors);
          }
        }
      }
    }

    // Validate single agent name if provided (with security checks)
    if (agentArgs.name) {
      // Security validation first
      const securityValidation = this.securityValidator.validateAgentName(agentArgs.name);
      if (!securityValidation.isValid) {
        errors.push(...securityValidation.errors);
      }
      
      // Then business logic validation
      const agentValidation = this.agentValidator.validate(agentArgs.name);
      if (!agentValidation.isValid) {
        errors.push(...agentValidation.errors);
      }
    }

    // Validate required parameters for specific subcommands
    if (agentArgs.subcommand === 'info' && !agentArgs.name) {
      errors.push('Agent name is required for info subcommand');
    }

    if (agentArgs.subcommand === 'deploy') {
      if (!agentArgs.agents || agentArgs.agents.length === 0) {
        errors.push('At least one agent name is required for deploy subcommand');
      }
    }

    if (agentArgs.subcommand === 'profile') {
      if (!agentArgs.project) {
        errors.push('Project directory is required for profile subcommand');
      } else {
        // Check if project directory exists
        const { existsSync } = require('fs');
        if (!existsSync(agentArgs.project)) {
          errors.push('Project directory does not exist: ' + agentArgs.project);
        }
      }
    }

    // Validate output path security if provided
    if (agentArgs.output) {
      const pathValidation = this.securityValidator.validatePath(agentArgs.output);
      if (!pathValidation.isValid) {
        errors.push(...pathValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute agents command based on subcommand
   */
  async execute(args: CommandArgs): Promise<CommandResult> {
    const agentArgs = args as AgentCommandArgs;
    
    try {
      // Validate arguments first
      const validation = this.validate(args);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join('; ')
        };
      }

      // Route to appropriate subcommand handler
      switch (agentArgs.subcommand) {
        case 'list':
          return await this.executeListCommand(agentArgs);
        case 'recommend':
          return await this.executeRecommendCommand(agentArgs);
        case 'deploy':
          return await this.executeDeployCommand(agentArgs);
        case 'deploy-all':
          return await this.executeDeployAllCommand(agentArgs);
        case 'info':
          return await this.executeInfoCommand(agentArgs);
        case 'profile':
          return await this.executeProfileCommand(agentArgs);
        default:
          return {
            success: false,
            error: `Unknown subcommand: ${agentArgs.subcommand}`
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Agent command failed: ${errorMessage}`);
      
      return {
        success: false,
        error: `Agent command failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute 'agents list' subcommand
   */
  private async executeListCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      const format = args.format || 'table';
      
      // Get agents (filtered by category if specified)
      let agents: AgentMetadata[];
      if (args.category) {
        agents = await this.metadataLoader.getAgentsByCategory(args.category);
      } else {
        agents = await this.metadataLoader.loadAllMetadata();
      }

      // Format and display results
      const result = this.formatAgentList(agents, format);
      Logger.info(result);
      
      return {
        success: true,
        data: agents
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to list agents: ${errorMessage}`
      };
    }
  }

  /**
   * Execute 'agents recommend' subcommand
   */
  private async executeRecommendCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      // Initialize recommendation engine
      await this.initializeRecommendationEngine();
      
      if (!this.recommendationEngine) {
        return {
          success: false,
          error: 'Failed to initialize recommendation engine'
        };
      }

      // Create project context for recommendations
      const context: ProjectContext = {
        projectType: 'unknown',
        frameworks: [],
        developmentPhase: 'initial-setup'
      };

      // Add optional projectCategory if provided and valid
      if (args.category && ['frontend', 'backend', 'fullstack'].includes(args.category)) {
        context.projectCategory = args.category as 'frontend' | 'backend' | 'fullstack';
      }

      // Use recommendation engine to get recommendations
      const recommendationOptions: RecommendationOptions = {
        exclude: args.agents || [],
        includeExplanations: true
      };
      
      // Add categories only if provided
      if (args.category) {
        recommendationOptions.categories = [args.category];
      }

      const recommendations: RecommendationResult = this.recommendationEngine.recommend(context, recommendationOptions);

      const format = args.format || 'table';
      const result = this.formatRecommendations(recommendations, format);
      Logger.info(result);
      
      return {
        success: true,
        data: recommendations
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to get recommendations: ${errorMessage}`
      };
    }
  }

  /**
   * Execute 'agents deploy' subcommand
   */
  private async executeDeployCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      if (!args.agents || args.agents.length === 0) {
        return {
          success: false,
          error: 'At least one agent name is required for deploy subcommand'
        };
      }

      // Validate all agents exist
      const agentMetadataList: AgentMetadata[] = [];
      for (const agentName of args.agents) {
        const exists = await this.agentValidator.validateExists(agentName);
        if (!exists.isValid) {
          return {
            success: false,
            error: `Agent not found: ${agentName}`
          };
        }

        const metadata = await this.metadataLoader.loadAgentMetadata(agentName);
        if (!metadata) {
          return {
            success: false,
            error: `Agent not found: ${agentName}`
          };
        }
        agentMetadataList.push(metadata);
      }

      // Initialize dependency resolver
      await this.initializeDependencyResolver();
      if (!this.dependencyResolver) {
        return {
          success: false,
          error: 'Failed to initialize dependency resolver'
        };
      }

      // Resolve dependencies and check for conflicts
      const resolution = this.dependencyResolver.resolve(args.agents);
      
      // Check for conflicts
      if (resolution.conflicts && resolution.conflicts.length > 0) {
        const conflictMessages = resolution.conflicts.map(c => 
          `${c.agent1} conflicts with ${c.agent2}: ${c.reason || 'incompatible agents'}`
        );
        return {
          success: false,
          error: `Deployment conflicts detected: ${conflictMessages.join('; ')}`
        };
      }

      // Prepare deployment
      const deployedAgents = [...new Set([...args.agents, ...resolution.requiredAgents])];
      const outputPath = args.output || './agents';

      // Validate output path (additional security check)
      if (args.output) {
        const pathValidation = this.securityValidator.validatePath(args.output);
        if (!pathValidation.isValid) {
          Logger.error(`Output path validation failed: ${pathValidation.errors.join('; ')}`);
          return {
            success: false,
            error: `Output path security violation: ${pathValidation.errors.join('; ')}`
          };
        }
      }

      // Create output directory atomically if it doesn't exist
      const { promises: fs } = require('fs');
      const { join } = require('path');
      
      try {
        await fs.mkdir(outputPath, { recursive: true });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
          Logger.error(`Failed to create output directory: ${error.message}`);
          return {
            success: false,
            error: `Failed to create output directory: ${error.message}`
          };
        }
        // EEXIST is okay - directory already exists
      }

      // Deploy agent files
      const deployedFiles: string[] = [];
      const isClaudeCodeDeployment = outputPath.includes('.claude/agents');
      
      for (const agentName of deployedAgents) {
        try {
          // Find the source MD file with location information
          const { findAgentFileWithLocation } = require('../../agents/agent-file-finder');
          const { readFileSync } = require('fs');
          const path = require('path');
          const agentsDir = join(__dirname, '../../../templates/agents');
          
          const agentLocation = findAgentFileWithLocation(agentsDir, agentName);
          
          if (!agentLocation) {
            Logger.warn(`Agent file not found: ${agentName}.md`);
            continue;
          }
          
          // Read the source content
          let content = readFileSync(agentLocation.fullPath, 'utf-8');
          
          // For Claude Code, strip frontmatter to save tokens
          if (isClaudeCodeDeployment) {
            const frontmatterRegex = /^---\n[\s\S]*?\n---\n\n?/;
            content = content.replace(frontmatterRegex, '');
          }
          
          // Preserve the directory structure when deploying
          const outputFile = join(outputPath, agentLocation.relativePath);
          const outputDir = path.dirname(outputFile);
          
          // Ensure the output directory exists
          await fs.mkdir(outputDir, { recursive: true });
          
          // Write to output preserving structure
          await fs.writeFile(outputFile, content, 'utf-8');
          deployedFiles.push(outputFile);
          
        } catch (error) {
          const formattedError = ErrorFormatter.formatError(error, `Deploy agent ${agentName}`);
          Logger.error(formattedError);
          return {
            success: false,
            error: formattedError
          };
        }
      }

      const deploymentResult: DeploymentResult = {
        deployed: deployedAgents,
        outputPath: outputPath
      };

      // Handle action option
      if (args.action === 'generate') {
        deploymentResult.action = 'generate';
        deploymentResult.generated = {
          files: deployedFiles,
          timestamp: new Date().toISOString()
        };
      }

      // Log deployment success
      Logger.info(`Successfully deployed ${deployedAgents.length} agents to ${outputPath}`);
      deployedAgents.forEach(agent => {
        Logger.info(`  - ${agent}`);
      });

      return {
        success: true,
        data: deploymentResult
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to deploy agents: ${errorMessage}`
      };
    }
  }

  /**
   * Execute 'agents deploy-all' subcommand
   */
  private async executeDeployAllCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      // Get all available agents
      const { readdirSync } = require('fs');
      const { join } = require('path');
      const path = require('path');
      
      const agentsDir = join(__dirname, '../../../templates/agents');
      
      // Use the new location-aware function to get all agents
      const { findAllAgentFilesWithLocation, AgentFileLocation } = require('../../agents/agent-file-finder');
      const agentLocations = findAllAgentFilesWithLocation(agentsDir);
      const allAgents: string[] = agentLocations.map((loc: AgentFileLocation) => loc.agentName);
      
      if (allAgents.length === 0) {
        return {
          success: false,
          error: 'No agents found in templates directory'
        };
      }
      
      // Deploy all agents
      const deployArgs = {
        ...args,
        agents: allAgents
      };
      
      Logger.info(`Deploying all ${allAgents.length} agents...`);
      return await this.executeDeployCommand(deployArgs);
      
    } catch (error) {
      const errorMessage = ErrorFormatter.formatError(error, 'Deploy all agents');
      Logger.error(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }


  /**
   * Execute 'agents info' subcommand
   */
  private async executeInfoCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      // Validate agent name exists (already validated format in validate())
      if (!args.name) {
        return {
          success: false,
          error: 'Agent name is required for info subcommand'
        };
      }

      // Check if agent exists
      const agentExists = await this.agentValidator.validateExists(args.name);
      if (!agentExists.isValid) {
        return {
          success: false,
          error: 'Agent metadata not found: ' + args.name
        };
      }

      // Load agent metadata
      const agent = await this.metadataLoader.loadAgentMetadata(args.name);
      if (!agent) {
        return {
          success: false,
          error: 'Agent metadata not found: ' + args.name
        };
      }

      // Format and display results
      const format = args.format || 'table';
      const result = this.formatAgentInfo(agent, format);
      Logger.info(result);

      return {
        success: true,
        data: agent
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to get agent info: ${errorMessage}`
      };
    }
  }

  /**
   * Execute 'agents profile' subcommand
   */
  private async executeProfileCommand(args: AgentCommandArgs): Promise<CommandResult> {
    try {
      if (!args.project) {
        return {
          success: false,
          error: 'Project directory is required for profile subcommand'
        };
      }

      // Analyze project
      const projectContext = await this.analyzeProject(args.project);
      
      // Initialize recommendation engine
      await this.initializeRecommendationEngine();
      
      if (!this.recommendationEngine) {
        return {
          success: false,
          error: 'Failed to initialize recommendation engine'
        };
      }

      // Get recommendations based on project analysis
      const recommendationOptions: RecommendationOptions = {
        includeExplanations: true,
        includeScores: args.verbose || false
      };
      
      const recommendations = this.recommendationEngine.recommend(
        projectContext, 
        recommendationOptions
      );

      // Build result data
      const resultData: ProfileResult = {
        projectContext,
        recommended: recommendations
      };

      // Add detailed analysis if verbose
      if (args.verbose) {
        resultData.detailedAnalysis = {
          files: await this.getProjectFiles(args.project),
          dependencies: await this.getProjectDependencies(args.project),
          testingTools: projectContext.testingTools || []
        };
      }

      // Format output
      const format = args.format || 'table';
      const output = this.formatProfileResult(resultData, format);
      Logger.info(output);

      return {
        success: true,
        data: resultData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to profile project: ${errorMessage}`
      };
    }
  }

  /**
   * Analyze project to determine context
   */
  private async analyzeProject(projectPath: string): Promise<ProjectContext> {
    const { existsSync, readFileSync } = require('fs');
    const { join } = require('path');
    
    // Default context
    const context: ProjectContext = {
      projectType: 'unknown',
      frameworks: [],
      developmentPhase: 'active-development'
    };

    // Check for package.json
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Detect project type
        if (packageJson.dependencies || packageJson.devDependencies) {
          context.projectType = 'nodejs';
          
          // Detect frameworks
          const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };
          
          if (deps.react) context.frameworks.push('react');
          if (deps.vue) context.frameworks.push('vue');
          if (deps.angular) context.frameworks.push('angular');
          if (deps.express) context.frameworks.push('express');
          if (deps.next) context.frameworks.push('nextjs');
          
          // Detect testing tools
          context.testingTools = [];
          if (deps.jest) context.testingTools.push('jest');
          if (deps.mocha) context.testingTools.push('mocha');
          if (deps.cypress) context.testingTools.push('cypress');
          
          // Detect build tools
          context.buildTools = [];
          if (deps.webpack) context.buildTools.push('webpack');
          if (deps.vite) context.buildTools.push('vite');
          if (deps.typescript) context.buildTools.push('typescript');
        }
      } catch (error) {
        Logger.error(ErrorFormatter.formatError(error, `Parse package.json at ${packageJsonPath}`));
        // Continue with defaults but log the error
      }
    }

    // Check for requirements.txt (Python)
    const requirementsPath = join(projectPath, 'requirements.txt');
    if (existsSync(requirementsPath)) {
      context.projectType = 'python';
      
      try {
        const requirements = readFileSync(requirementsPath, 'utf-8');
        if (requirements.includes('django')) context.frameworks.push('django');
        if (requirements.includes('flask')) context.frameworks.push('flask');
        if (requirements.includes('pytest')) {
          context.testingTools = context.testingTools || [];
          context.testingTools.push('pytest');
        }
      } catch (error) {
        Logger.error(ErrorFormatter.formatError(error, `Parse requirements.txt at ${requirementsPath}`));
        // Continue with defaults but log the error
      }
    }

    return context;
  }

  /**
   * Get project files for detailed analysis
   */
  private async getProjectFiles(projectPath: string): Promise<string[]> {
    const { readdirSync, statSync } = require('fs');
    const { join } = require('path');
    
    try {
      const files: string[] = [];
      const items = readdirSync(projectPath);
      
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;
        
        const fullPath = join(projectPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isFile()) {
          files.push(item);
        }
      }
      
      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get project dependencies for detailed analysis
   */
  private async getProjectDependencies(projectPath: string): Promise<string[]> {
    const { existsSync, readFileSync } = require('fs');
    const { join } = require('path');
    
    const dependencies: string[] = [];
    
    // Check package.json
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.dependencies) {
          dependencies.push(...Object.keys(packageJson.dependencies));
        }
      } catch (error) {
        Logger.error(ErrorFormatter.formatError(error, `Read dependencies from ${packageJsonPath}`));
        // Continue with empty array but log the error
      }
    }
    
    return dependencies;
  }

  /**
   * Format profile result for display
   */
  private formatProfileResult(data: ProfileResult, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'tree':
        let result = 'Project Profile\n';
        result += `├── Type: ${data.projectContext.projectType}\n`;
        result += `├── Phase: ${data.projectContext.developmentPhase}\n`;
        if (data.projectContext.frameworks.length > 0) {
          result += `├── Frameworks:\n`;
          data.projectContext.frameworks.forEach((fw: string, idx: number) => {
            const isLast = idx === data.projectContext.frameworks.length - 1;
            result += `│   ${isLast ? '└──' : '├──'} ${fw}\n`;
          });
        }
        result += `└── Recommended Agents:\n`;
        if (data.recommended.primary.length > 0) {
          result += `    ├── Primary:\n`;
          data.recommended.primary.forEach((agent: string, idx: number) => {
            const isLast = idx === data.recommended.primary.length - 1;
            result += `    │   ${isLast ? '└──' : '├──'} ${agent}\n`;
          });
        }
        if (data.recommended.suggested.length > 0) {
          result += `    └── Suggested:\n`;
          data.recommended.suggested.forEach((agent: string, idx: number) => {
            const isLast = idx === data.recommended.suggested.length - 1;
            result += `        ${isLast ? '└──' : '├──'} ${agent}\n`;
          });
        }
        return result;
      case 'table':
      default:
        let table = 'Project Profile\n';
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        table += `Project Type:\t${data.projectContext.projectType}\n`;
        table += `Development Phase:\t${data.projectContext.developmentPhase}\n`;
        if (data.projectContext.frameworks.length > 0) {
          table += `Frameworks:\t${data.projectContext.frameworks.join(', ')}\n`;
        }
        table += '\nRecommended Agents:\n';
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        if (data.recommended.primary.length > 0) {
          table += `Primary:\t${data.recommended.primary.join(', ')}\n`;
        }
        if (data.recommended.suggested.length > 0) {
          table += `Suggested:\t${data.recommended.suggested.join(', ')}\n`;
        }
        return table;
    }
  }

  /**
   * Format agent list for display
   */
  private formatAgentList(agents: AgentMetadata[], format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(agents, null, 2);
      case 'tree':
        // Group by category and display as tree
        const categories: Record<string, AgentMetadata[]> = {};
        agents.forEach(agent => {
          if (!categories[agent.category]) {
            categories[agent.category] = [];
          }
          categories[agent.category]!.push(agent);
        });
        
        let result = 'Available Agents:\n';
        for (const [category, categoryAgents] of Object.entries(categories)) {
          result += `${this.TREE_BRANCH} ${category}\n`;
          categoryAgents.forEach((agent, index) => {
            const isLast = index === categoryAgents.length - 1;
            const prefix = isLast ? this.TREE_LAST_BRANCH : this.TREE_BRANCH;
            result += `${this.TREE_VERTICAL}   ${prefix} ${agent.name}: ${agent.description}\n`;
          });
        }
        return result;
      case 'table':
      default:
        // Simple table format
        let table = 'Available Agents\n';
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        table += `Name${this.TAB_SEPARATOR}Category${this.TAB_SEPARATOR}Description\n`;
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        agents.forEach(agent => {
          table += `${agent.name}${this.TAB_SEPARATOR}${agent.category}${this.TAB_SEPARATOR}${agent.description}\n`;
        });
        return table;
    }
  }

  /**
   * Format agent info for display
   */
  private formatAgentInfo(agent: AgentMetadata, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(agent, null, 2);
      case 'tree':
        let result = `Agent: ${agent.name}\n`;
        result += `├── Category: ${agent.category}\n`;
        result += `├── Description: ${agent.description}\n`;
        result += `├── Tags: ${agent.tags.join(', ')}\n`;
        result += `└── Relationships:\n`;
        
        if (agent.relationships.requires.length > 0) {
          result += `    ├── Requires: ${agent.relationships.requires.join(', ')}\n`;
        }
        if (agent.relationships.enhances.length > 0) {
          result += `    ├── Enhances: ${agent.relationships.enhances.join(', ')}\n`;
        }
        if (agent.relationships.collaborates_with.length > 0) {
          result += `    ├── Collaborates with: ${agent.relationships.collaborates_with.join(', ')}\n`;
        }
        if (agent.relationships.conflicts_with.length > 0) {
          result += `    └── Conflicts with: ${agent.relationships.conflicts_with.join(', ')}\n`;
        }
        
        return result;
      case 'table':
      default:
        // Simple table format
        let table = 'Agent Information\n';
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        table += `Name:${this.TAB_SEPARATOR}${agent.name}\n`;
        table += `Category:\t${agent.category}\n`;
        table += `Description:\t${agent.description}\n`;
        table += `Tags:${this.TAB_SEPARATOR}${agent.tags.join(', ')}\n`;
        
        table += '\nRelationships:\n';
        if (agent.relationships.requires.length > 0) {
          table += `  Requires:${this.TAB_SEPARATOR}${agent.relationships.requires.join(', ')}\n`;
        }
        if (agent.relationships.enhances.length > 0) {
          table += `  Enhances:${this.TAB_SEPARATOR}${agent.relationships.enhances.join(', ')}\n`;
        }
        if (agent.relationships.collaborates_with.length > 0) {
          table += `  Collaborates:${this.TAB_SEPARATOR}${agent.relationships.collaborates_with.join(', ')}\n`;
        }
        if (agent.relationships.conflicts_with.length > 0) {
          table += `  Conflicts:${this.TAB_SEPARATOR}${agent.relationships.conflicts_with.join(', ')}\n`;
        }
        
        return table;
    }
  }

  /**
   * Format recommendations for display
   */
  private formatRecommendations(recommendations: RecommendationResult, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(recommendations, null, 2);
      case 'tree':
        let result = 'Recommended Agents:\n';
        result += '├── Primary Recommendations:\n';
        recommendations.primary.forEach((agentName, index) => {
          const isLast = index === recommendations.primary.length - 1;
          const prefix = isLast ? '└──' : '├──';
          const explanation = recommendations.explanations?.[agentName] || 'No explanation available';
          result += `│   ${prefix} ${agentName}: ${explanation}\n`;
        });
        if (recommendations.suggested.length > 0) {
          result += '└── Suggested Agents:\n';
          recommendations.suggested.forEach((agentName, index) => {
            const isLast = index === recommendations.suggested.length - 1;
            const prefix = isLast ? '└──' : '├──';
            const explanation = recommendations.explanations?.[agentName] || 'No explanation available';
            result += `    ${prefix} ${agentName}: ${explanation}\n`;
          });
        }
        return result;
      case 'table':
      default:
        let table = 'Recommended Agents\n';
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        table += `Type${this.TAB_SEPARATOR}Agent${this.TAB_SEPARATOR}Explanation\n`;
        table += '─'.repeat(this.TABLE_SEPARATOR_LENGTH) + '\n';
        recommendations.primary.forEach(agentName => {
          const explanation = recommendations.explanations?.[agentName] || 'No explanation';
          table += `Primary${this.TAB_SEPARATOR}${agentName}${this.TAB_SEPARATOR}${explanation}\n`;
        });
        recommendations.suggested.forEach(agentName => {
          const explanation = recommendations.explanations?.[agentName] || 'No explanation';
          table += `Suggested\t${agentName}${this.TAB_SEPARATOR}${explanation}\n`;
        });
        return table;
    }
  }
}