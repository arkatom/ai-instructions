/**
 * Interactive prompts for init command
 * Handles user interaction flow for configuration selection
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  ProjectConfig,
  ConfigManager,
  AVAILABLE_TOOLS,
  AVAILABLE_WORKFLOWS,
  AVAILABLE_METHODOLOGIES,
  AVAILABLE_LANGUAGES
} from './config';

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

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
  }

  /**
   * Run complete interactive configuration flow
   */
  async runInteractiveFlow(
    existingConfig?: ProjectConfig | null,
    defaultOutputDir: string = process.cwd()
  ): Promise<ProjectConfig> {
    console.log(chalk.blue('🤖 AI Instructions Interactive Setup'));
    console.log(chalk.gray('Configure your project with AI development instructions\n'));

    if (existingConfig) {
      console.log(chalk.yellow('📝 Found existing configuration:'));
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
      console.log(chalk.yellow('❌ Generation cancelled'));
      process.exit(0);
    }

    return this.createConfigFromResponses(responses);
  }

  /**
   * Collect all user responses through prompts
   */
  private async collectUserResponses(
    existingConfig?: ProjectConfig | null,
    defaultOutputDir: string = process.cwd()
  ): Promise<InteractiveResponses> {
    const questions = [
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

    // Agent selection (Claude only)
    questions.push({
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
      // @ts-expect-error - Inquirer types don't properly support validate function with answers parameter
      validate: (choices: string[], answers: Record<string, unknown>) => {
        const toolConfig = answers.tool ? AVAILABLE_TOOLS[answers.tool as string] : undefined;
        if (toolConfig && toolConfig.supportsAgents && choices.length === 0) {
          return 'Please select at least one agent for Claude';
        }
        return true;
      }
    });

    const responses = await inquirer.prompt(questions as unknown as Parameters<typeof inquirer.prompt>[0]);

    // Show configuration summary
    console.log(chalk.green('\n📋 Configuration Summary:'));
    const toolConfig = AVAILABLE_TOOLS[responses.tool];
    if (toolConfig) {
      console.log(`${chalk.cyan('Tool:')} ${toolConfig.name}`);
    } else {
      console.log(`${chalk.cyan('Tool:')} ${responses.tool}`);
    }
    console.log(`${chalk.cyan('Workflow:')} ${responses.workflow}`);
    console.log(`${chalk.cyan('Methodologies:')} ${responses.methodologies.join(', ')}`);
    console.log(`${chalk.cyan('Languages:')} ${responses.languages.join(', ')}`);
    if (responses.agents && responses.agents.length > 0) {
      console.log(`${chalk.cyan('Agents:')} ${responses.agents.join(', ')}`);
    }
    console.log(`${chalk.cyan('Output:')} ${responses.outputDirectory}\n`);

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
      agents: responses.agents,
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
      console.log(`  ${chalk.cyan('Tool:')} ${config.tool} (unknown)`);
    } else {
      console.log(`  ${chalk.cyan('Tool:')} ${toolConfig.name}`);
    }
    console.log(`  ${chalk.cyan('Workflow:')} ${config.workflow}`);
    console.log(`  ${chalk.cyan('Methodologies:')} ${config.methodologies.join(', ')}`);
    console.log(`  ${chalk.cyan('Languages:')} ${config.languages.join(', ')}`);
    if (config.agents && config.agents.length > 0) {
      console.log(`  ${chalk.cyan('Agents:')} ${config.agents.join(', ')}`);
    }
    console.log(`  ${chalk.cyan('Generated:')} ${new Date(config.generatedAt).toLocaleString()}`);
    console.log('');
  }

  /**
   * Show help information about available options
   */
  static showHelp(): void {
    console.log(chalk.blue('🤖 AI Instructions - Interactive Setup\n'));
    
    console.log(chalk.green('Available Tools:'));
    Object.entries(AVAILABLE_TOOLS).forEach(([key, config]) => {
      console.log(`  ${chalk.cyan(key.padEnd(15))} - ${config.description}`);
    });
    
    console.log(chalk.green('\nAvailable Workflows:'));
    AVAILABLE_WORKFLOWS.forEach(option => {
      console.log(`  ${chalk.cyan(option.value.padEnd(15))} - ${option.description}`);
    });
    
    console.log(chalk.green('\nAvailable Methodologies:'));
    AVAILABLE_METHODOLOGIES.forEach(option => {
      console.log(`  ${chalk.cyan(option.value.padEnd(15))} - ${option.description}`);
    });
    
    console.log(chalk.green('\nAvailable Languages:'));
    AVAILABLE_LANGUAGES.forEach(option => {
      console.log(`  ${chalk.cyan(option.value.padEnd(15))} - ${option.description}`);
    });

    console.log(chalk.gray('\nUsage:'));
    console.log('  ai-instructions init                    # Interactive mode');
    console.log('  ai-instructions init --tool claude     # Non-interactive mode');
    console.log('  ai-instructions init --help            # Show this help\n');
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