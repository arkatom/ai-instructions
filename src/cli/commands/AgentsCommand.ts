/**
 * AgentsCommand - Agent deployment and management CLI commands
 * Issue #93: Agent deployment CLI commands implementation
 */

import { Command } from '../interfaces/Command';
import { CommandArgs, AgentCommandArgs } from '../interfaces/CommandArgs';
import { CommandResult } from '../interfaces/CommandResult';
import { ValidationResult } from '../interfaces/ValidationResult';
import { AgentValidator } from '../validators/AgentValidator';
import { AgentMetadataLoader } from '../../agents/metadata-loader';
import { RecommendationEngine, RecommendationResult } from '../../agents/recommendation-engine';
import { AgentMetadata, ProjectContext } from '../../agents/types';
import { Logger } from '../../utils/logger';
import { join } from 'path';

/**
 * Command Pattern implementation for agents command with subcommands
 */
export class AgentsCommand implements Command {
  private agentValidator: AgentValidator;
  private metadataLoader: AgentMetadataLoader;
  private recommendationEngine: RecommendationEngine | null = null;

  constructor() {
    this.agentValidator = new AgentValidator();
    
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
   * Validate agent command arguments
   */
  validate(args: CommandArgs): ValidationResult {
    const agentArgs = args as AgentCommandArgs;
    const errors: string[] = [];

    // Validate subcommand
    const validSubcommands = ['list', 'recommend', 'deploy', 'info', 'profile'];
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

    // Validate agent names if provided (basic validation only)
    if (agentArgs.agents && Array.isArray(agentArgs.agents)) {
      for (const agentName of agentArgs.agents) {
        if (typeof agentName === 'string') {
          const agentValidation = this.agentValidator.validate(agentName);
          if (!agentValidation.isValid) {
            errors.push(...agentValidation.errors);
          }
        }
      }
    }

    // Validate single agent name if provided
    if (agentArgs.name) {
      const agentValidation = this.agentValidator.validate(agentArgs.name);
      if (!agentValidation.isValid) {
        errors.push(...agentValidation.errors);
      }
    }

    // Validate required parameters for specific subcommands
    if (agentArgs.subcommand === 'info' && !agentArgs.name) {
      errors.push('Agent name is required for info subcommand');
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
      const recommendationOptions: any = {
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
    // TODO: Implement in Phase 4-7
    return {
      success: false,
      error: 'Deploy command not yet implemented'
    };
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
    // TODO: Implement in Phase 4-8
    return {
      success: false,
      error: 'Profile command not yet implemented'
    };
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
          result += `├── ${category}\n`;
          categoryAgents.forEach((agent, index) => {
            const isLast = index === categoryAgents.length - 1;
            const prefix = isLast ? '└──' : '├──';
            result += `│   ${prefix} ${agent.name}: ${agent.description}\n`;
          });
        }
        return result;
      case 'table':
      default:
        // Simple table format
        let table = 'Name\t\tCategory\t\tDescription\n';
        table += '─'.repeat(60) + '\n';
        agents.forEach(agent => {
          table += `${agent.name}\t\t${agent.category}\t\t${agent.description}\n`;
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
        table += '─'.repeat(60) + '\n';
        table += `Name:\t\t${agent.name}\n`;
        table += `Category:\t${agent.category}\n`;
        table += `Description:\t${agent.description}\n`;
        table += `Tags:\t\t${agent.tags.join(', ')}\n`;
        
        table += '\nRelationships:\n';
        if (agent.relationships.requires.length > 0) {
          table += `  Requires:\t\t${agent.relationships.requires.join(', ')}\n`;
        }
        if (agent.relationships.enhances.length > 0) {
          table += `  Enhances:\t\t${agent.relationships.enhances.join(', ')}\n`;
        }
        if (agent.relationships.collaborates_with.length > 0) {
          table += `  Collaborates:\t\t${agent.relationships.collaborates_with.join(', ')}\n`;
        }
        if (agent.relationships.conflicts_with.length > 0) {
          table += `  Conflicts:\t\t${agent.relationships.conflicts_with.join(', ')}\n`;
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
        let table = 'Type\t\tAgent\t\tExplanation\n';
        table += '─'.repeat(60) + '\n';
        recommendations.primary.forEach(agentName => {
          const explanation = recommendations.explanations?.[agentName] || 'No explanation';
          table += `Primary\t\t${agentName}\t\t${explanation}\n`;
        });
        recommendations.suggested.forEach(agentName => {
          const explanation = recommendations.explanations?.[agentName] || 'No explanation';
          table += `Suggested\t${agentName}\t\t${explanation}\n`;
        });
        return table;
    }
  }
}