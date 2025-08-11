/**
 * Interactive init command orchestrator
 * Handles the complete interactive flow from prompts to file generation
 */

import { join, resolve } from 'path';
import { existsSync } from 'fs';

import { ProjectConfig, ConfigManager, AVAILABLE_TOOLS } from './config';
import { InteractivePrompts } from './prompts';
import { GeneratorFactory, SupportedTool } from '../generators/factory';
import { OutputFormat } from '../converters';
import { Logger } from '../utils/logger';
import { EnvironmentService } from '../services/EnvironmentService';

export interface InteractiveOptions {
  outputDirectory?: string;
  templatesDir?: string;
  skipConfirmation?: boolean;
  verbose?: boolean;
}

export class InteractiveInitializer {
  private templatesDir: string;
  private prompts: InteractivePrompts;
  private environmentService: EnvironmentService;

  constructor(templatesDir?: string) {
    // Default to templates directory relative to this file
    this.templatesDir = templatesDir || resolve(join(__dirname, '../../templates'));
    this.prompts = new InteractivePrompts(this.templatesDir);
    this.environmentService = new EnvironmentService();
  }

  /**
   * Run complete interactive initialization
   */
  async initialize(options: InteractiveOptions = {}): Promise<void> {
    try {
      const outputDir = options.outputDirectory || this.environmentService.getCurrentWorkingDirectory();
      
      // Check for existing configuration
      const existingConfig = ConfigManager.loadConfig(outputDir);
      
      if (options.verbose) {
        Logger.debug(`Templates directory: ${this.templatesDir}`);
        Logger.debug(`Output directory: ${outputDir}`);
        if (existingConfig) {
          Logger.debug('Found existing configuration');
        }
      }

      // Run interactive flow
      const config = await this.prompts.runInteractiveFlow(existingConfig, outputDir);
      
      // Generate files
      await this.generateFiles(config, options);
      
      // Save configuration
      ConfigManager.saveConfig(config.outputDirectory, config);
      
      Logger.success('Configuration saved successfully!');
      Logger.info(`Configuration saved to: ${join(config.outputDirectory, '.ai-instructions.json')}`);
      
    } catch (error) {
      Logger.error('Interactive initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Generate files based on configuration
   */
  private async generateFiles(config: ProjectConfig, options: InteractiveOptions): Promise<void> {
    Logger.section('Generating files...');
    
    try {
      // Use existing generator system with enhanced options
      const generator = GeneratorFactory.createGenerator(config.tool as SupportedTool);
      
      // Prepare generation options
      const generatorOptions = {
        projectName: config.projectName,
        force: false, // Interactive mode should not force overwrite
        lang: 'ja' as const, // TODO: Add language selection to interactive prompts
        outputFormat: 'claude' as OutputFormat, // TODO: Map tool to output format
        conflictResolution: 'backup' as const,
        interactive: true,
        backup: true
      };

      if (options.verbose) {
        Logger.debug(`Generator options: ${JSON.stringify(generatorOptions, null, 2)}`);
      }

      await generator.generateFiles(config.outputDirectory, generatorOptions);
      
      Logger.success(`Generated ${generator.getToolName()} configuration files`);
      
      // Display generated files summary
      this.displayGeneratedFiles(config);
      
    } catch (error) {
      Logger.error('File generation failed:', error);
      throw error;
    }
  }

  /**
   * Display summary of generated files
   */
  private displayGeneratedFiles(config: ProjectConfig): void {
    const toolConfig = AVAILABLE_TOOLS[config.tool];
    
    Logger.section('Generated Files');
    if (toolConfig) {
      Logger.item('Main config:', toolConfig.configFile);
    }
    Logger.item('Instructions:', 'instructions/');
    
    if (config.methodologies.length > 0) {
      Logger.item('Methodologies:', config.methodologies.map(m => `instructions/methodologies/${m}.md`).join(', '));
    }
    
    if (config.languages.length > 0) {
      Logger.item('Language patterns:', config.languages.map(l => `instructions/patterns/${l}/`).join(', '));
    }
    
    if (config.agents && config.agents.length > 0) {
      Logger.item('Agents:', config.agents.map(a => `${a}.md`).join(', '));
    }

    Logger.info(`All files created in: ${config.outputDirectory}`);
    
    // Show next steps
    Logger.section('Next Steps');
    if (toolConfig) {
      Logger.info(`1. Review generated ${toolConfig.configFile}`);
    }
    Logger.info('2. Customize instructions for your project');
    Logger.info('3. Start using your AI tool with enhanced instructions');
    
    if (config.tool === 'claude') {
      Logger.tip('Use /serena to activate agents in Claude');
    }
  }

  /**
   * Validate prerequisites for interactive initialization
   */
  static validatePrerequisites(templatesDir?: string): boolean {
    const templatePath = templatesDir || resolve(join(__dirname, '../../templates'));
    
    if (!existsSync(templatePath)) {
      Logger.error(`Templates directory not found: ${templatePath}`);
      return false;
    }

    const requiredDirs = [
      'instructions',
      'agents',
      'configs'
    ];

    for (const dir of requiredDirs) {
      if (!existsSync(join(templatePath, dir))) {
        Logger.error(`Required template directory missing: ${dir}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current directory already has configuration
   */
  static hasExistingConfig(directory: string = new EnvironmentService().getCurrentWorkingDirectory()): boolean {
    return ConfigManager.loadConfig(directory) !== null;
  }

  /**
   * Display quick status of current directory
   */
  static showStatus(directory: string = new EnvironmentService().getCurrentWorkingDirectory()): void {
    const config = ConfigManager.loadConfig(directory);
    
    if (config) {
      Logger.section('Current Configuration');
      const toolConfig = AVAILABLE_TOOLS[config.tool];
      if (toolConfig) {
        Logger.item('Tool:', toolConfig.name);
      } else {
        Logger.item('Tool:', `${config.tool} (unknown)`);
      }
      Logger.item('Project:', config.projectName);
      Logger.item('Generated:', new Date(config.generatedAt).toLocaleString());
      
      // Check for config files
      if (toolConfig) {
        const configExists = existsSync(join(directory, toolConfig.configFile));
        Logger.item('Config file:', `${configExists ? '✅' : '❌'} ${toolConfig.configFile}`);
      }
      
    } else {
      Logger.warn('No configuration found in current directory');
      Logger.info('Run "ai-instructions init" to set up AI instructions');
    }
  }
}

/**
 * Utility functions for interactive mode
 */
export class InteractiveUtils {
  /**
   * Check if running in CI environment
   */
  static isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_HOME ||
      process.env.BUILDKITE ||
      process.env.CIRCLECI
    );
  }

  /**
   * Check if TTY is available for interactive prompts
   */
  static canRunInteractive(): boolean {
    return !this.isCI() && process.stdin.isTTY && process.stdout.isTTY;
  }

  /**
   * Show warning when interactive mode is not available
   */
  static showInteractiveWarning(): void {
    Logger.warn('Interactive mode not available in this environment');
    Logger.info('Use command-line options for non-interactive setup:');
    Logger.info('  ai-instructions init --tool claude --lang ja');
    Logger.info('  ai-instructions init --help');
  }
}