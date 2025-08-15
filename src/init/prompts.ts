/**
 * Interactive prompts for init command
 * Handles user interaction flow for configuration selection
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import {
  ProjectConfig,
  ConfigManager,
  AVAILABLE_TOOLS,
  AVAILABLE_WORKFLOWS,
  AVAILABLE_METHODOLOGIES,
  AVAILABLE_LANGUAGES
} from './config';
import { EnvironmentService } from '../services/EnvironmentService';

export interface InteractiveResponses {
  tool: string;
  workflow: string;
  methodologies: string[];
  languages: string[];
  agents?: string[];
  projectName: string;
  outputDirectory: string;
  confirmGeneration: boolean;
}

export class InteractivePrompts {
  private templatesDir: string;
  private environmentService: EnvironmentService;

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
    this.environmentService = new EnvironmentService();
  }

  /**
   * Run complete interactive configuration flow
   */
  async runInteractiveFlow(
    existingConfig?: ProjectConfig | null,
    defaultOutputDir: string = this.environmentService.getCurrentWorkingDirectory()
  ): Promise<ProjectConfig> {
    Logger.section('🤖 AI Instructions Interactive Setup');
    Logger.info('Configure your project with AI development instructions');

    if (existingConfig) {
      Logger.warn('📝 Found existing configuration:');
      this.displayConfig(existingConfig);
      
      const { shouldUpdate } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldUpdate',
        message: 'Update existing configuration?',
        default: false
      }]);

      if (!shouldUpdate) {
        return existingConfig;
      }
    }

    const responses = await this.collectUserResponses(existingConfig, defaultOutputDir);
    
    if (!responses.confirmGeneration) {
      Logger.warn('❌ Generation cancelled');
      process.exit(0);
    }

    return this.createConfigFromResponses(responses);
  }

  /**
   * Collect all user responses through prompts
   */
  private async collectUserResponses(
    existingConfig?: ProjectConfig | null,
    defaultOutputDir: string = this.environmentService.getCurrentWorkingDirectory()
  ): Promise<InteractiveResponses> {
    const baseQuestions = [
      // Project metadata
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: existingConfig?.projectName || 'my-project',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Project name cannot be empty';
          }
          if (/[<>|]/.test(input)) {
            return 'Project name cannot contain forbidden characters (<, >, |)';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'outputDirectory',
        message: 'Output directory:',
        default: existingConfig?.outputDirectory || defaultOutputDir,
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Output directory cannot be empty';
          }
          return true;
        }
      },

      // Tool selection
      {
        type: 'list',
        name: 'tool',
        message: 'Select your AI tool:',
        choices: Object.entries(AVAILABLE_TOOLS).map(([value, config]) => ({
          name: `${config.name} - ${config.description}`,
          value,
          short: config.name
        })),
        default: existingConfig?.tool || 'claude'
      },

      // Workflow selection
      {
        type: 'list',
        name: 'workflow',
        message: 'Select development workflow:',
        choices: AVAILABLE_WORKFLOWS.map(option => ({
          name: `${option.name} - ${option.description}`,
          value: option.value,
          short: option.name
        })),
        default: existingConfig?.workflow || 'github-flow'
      },

      // Methodologies selection (multiple)
      {
        type: 'checkbox',
        name: 'methodologies',
        message: 'Select methodologies: (Press space to select multiple)',
        choices: AVAILABLE_METHODOLOGIES.map(option => ({
          name: `${option.name} - ${option.description}`,
          value: option.value,
          checked: existingConfig?.methodologies?.includes(option.value) || option.value === 'github-idd'
        })),
        validate: (choices: string[]) => {
          if (choices.length === 0) {
            return 'Please select at least one methodology';
          }
          return true;
        }
      },

      // Languages selection (multiple)
      {
        type: 'checkbox',
        name: 'languages',
        message: 'Select programming languages: (Press space to select multiple)',
        choices: AVAILABLE_LANGUAGES.map(option => ({
          name: `${option.name} - ${option.description}`,
          value: option.value,
          checked: existingConfig?.languages?.includes(option.value) || option.value === 'typescript'
        })),
        validate: (choices: string[]) => {
          if (choices.length === 0) {
            return 'Please select at least one language';
          }
          return true;
        }
      }
    ];

    // Agent selection (Claude only) - properly typed with conditional question
    const agentQuestion = {
      type: 'checkbox',
      name: 'agents',
      message: 'Select agents: (Press space to select multiple)',
      choices: ConfigManager.getAvailableAgents(this.templatesDir).map(option => ({
        name: `${option.name} - ${option.description}`,
        value: option.value,
        checked: existingConfig?.agents?.includes(option.value) || false
      })),
      when: (answers: Record<string, unknown>) => {
        const toolConfig = AVAILABLE_TOOLS[answers.tool as string];
        return toolConfig ? toolConfig.supportsAgents : false;
      },
      validate: (choices: unknown[]) => {
        if (!Array.isArray(choices) || choices.length === 0) {
          return 'Please select at least one agent for Claude';
        }
        return true;
      }
    };

    const questions = [...baseQuestions, agentQuestion];

    // Use inquirer with type assertion - newer inquirer versions have complex generic types
    // that are difficult to properly type without excessive complexity. We validate the response
    // shape through runtime validation and the question structure ensures type safety.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responses = await inquirer.prompt(questions as any) as InteractiveResponses;

    // Show configuration summary
    Logger.section('📋 Configuration Summary:');
    const toolConfig = AVAILABLE_TOOLS[responses.tool];
    if (toolConfig) {
      Logger.item('Tool:', toolConfig.name);
    } else {
      Logger.item('Tool:', responses.tool);
    }
    Logger.item('Workflow:', responses.workflow);
    Logger.item('Methodologies:', responses.methodologies.join(', '));
    Logger.item('Languages:', responses.languages.join(', '));
    if (responses.agents && responses.agents.length > 0) {
      Logger.item('Agents:', responses.agents.join(', '));
    }
    Logger.item('Output:', responses.outputDirectory);

    // Confirmation
    const { confirmGeneration } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmGeneration',
      message: 'Generate files with this configuration?',
      default: true
    }]);

    return { 
      tool: responses.tool,
      workflow: responses.workflow,
      methodologies: responses.methodologies,
      languages: responses.languages,
      ...(responses.agents && { agents: responses.agents }),
      projectName: responses.projectName,
      outputDirectory: responses.outputDirectory,
      confirmGeneration 
    };
  }

  /**
   * Create ProjectConfig from user responses
   */
  private createConfigFromResponses(responses: InteractiveResponses): ProjectConfig {
    const configOverrides: Partial<ProjectConfig> = {
      tool: responses.tool as 'claude' | 'cursor' | 'cline' | 'github-copilot',
      workflow: responses.workflow as 'github-flow' | 'git-flow',
      methodologies: responses.methodologies,
      languages: responses.languages,
      projectName: responses.projectName,
      outputDirectory: responses.outputDirectory,
      generatedAt: new Date().toISOString(),
      version: '0.5.0' // TODO: Read from package.json
    };
    
    // Only add agents if they exist
    if (responses.agents && responses.agents.length > 0) {
      configOverrides.agents = responses.agents;
    }
    
    return ConfigManager.createConfig(configOverrides);
  }

  /**
   * Display existing configuration in a readable format
   */
  private displayConfig(config: ProjectConfig): void {
    const toolConfig = AVAILABLE_TOOLS[config.tool];
    if (!toolConfig) {
      Logger.item('  Tool:', config.tool + ' (unknown)');
    } else {
      Logger.item('Tool:', toolConfig.name);
    }
    Logger.item('Workflow:', config.workflow);
    Logger.item('Methodologies:', config.methodologies.join(', '));
    Logger.item('Languages:', config.languages.join(', '));
    if (config.agents && config.agents.length > 0) {
      Logger.item('Agents:', config.agents.join(', '));
    }
    Logger.item('Generated:', new Date(config.generatedAt).toLocaleString());
    Logger.raw('');
  }

  /**
   * Show help information about available options
   */
  static showHelp(): void {
    Logger.section('🤖 AI Instructions - Interactive Setup');
    
    Logger.info(chalk.green('Available Tools:'));
    Object.entries(AVAILABLE_TOOLS).forEach(([key, config]) => {
      Logger.item(key.padEnd(15), '- ' + config.description);
    });
    
    Logger.info(chalk.green('\nAvailable Workflows:'));
    AVAILABLE_WORKFLOWS.forEach(option => {
      Logger.item(option.value.padEnd(15), '- ' + option.description);
    });
    
    Logger.info(chalk.green('\nAvailable Methodologies:'));
    AVAILABLE_METHODOLOGIES.forEach(option => {
      Logger.item(option.value.padEnd(15), '- ' + option.description);
    });
    
    Logger.info(chalk.green('\nAvailable Languages:'));
    AVAILABLE_LANGUAGES.forEach(option => {
      Logger.item(option.value.padEnd(15), '- ' + option.description);
    });

    Logger.info(chalk.gray('\nUsage:'));
    Logger.info('  ai-instructions init                    # Interactive mode');
    Logger.info('  ai-instructions init --tool claude     # Non-interactive mode');
    Logger.info('  ai-instructions init --help            # Show this help');
  }
}

/**
 * Quick validation functions for prompts
 */
export class PromptValidators {
  static validateProjectName(input: string): boolean | string {
    if (!input || input.trim() === '') {
      return 'Project name cannot be empty';
    }
    
    if (/[<>|]/.test(input)) {
      return 'Project name cannot contain forbidden characters (<, >, |)';
    }
    
    return true;
  }

  static validateOutputDirectory(input: string): boolean | string {
    if (!input || input.trim() === '') {
      return 'Output directory cannot be empty';
    }
    
    return true;
  }

  static validateNonEmptyArray(choices: string[], fieldName: string): boolean | string {
    if (!choices || choices.length === 0) {
      return `Please select at least one ${fieldName}`;
    }
    return true;
  }
}