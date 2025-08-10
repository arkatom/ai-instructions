/**
 * Interactive init command orchestrator
 * Handles the complete interactive flow from prompts to file generation
 */

import { join, resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { ProjectConfig, ConfigManager, AVAILABLE_TOOLS } from './config';
import { InteractivePrompts } from './prompts';
import { GeneratorFactory, SupportedTool } from '../generators/factory';
import { OutputFormat } from '../converters';

export interface InteractiveOptions {
  outputDirectory?: string;
  templatesDir?: string;
  skipConfirmation?: boolean;
  verbose?: boolean;
}

export class InteractiveInitializer {
  private templatesDir: string;
  private prompts: InteractivePrompts;

  constructor(templatesDir?: string) {
    // Default to templates directory relative to this file
    this.templatesDir = templatesDir || resolve(join(__dirname, '../../templates'));
    this.prompts = new InteractivePrompts(this.templatesDir);
  }

  /**
   * Run complete interactive initialization
   */
  async initialize(options: InteractiveOptions = {}): Promise<void> {
    try {
      const outputDir = options.outputDirectory || process.cwd();
      
      // Check for existing configuration
      const existingConfig = ConfigManager.loadConfig(outputDir);
      
      if (options.verbose) {
        console.log(chalk.gray(`Templates directory: ${this.templatesDir}`));
        console.log(chalk.gray(`Output directory: ${outputDir}`));
        if (existingConfig) {
          console.log(chalk.gray('Found existing configuration\n'));
        }
      }

      // Run interactive flow
      const config = await this.prompts.runInteractiveFlow(existingConfig, outputDir);
      
      // Generate files
      await this.generateFiles(config, options);
      
      // Save configuration
      ConfigManager.saveConfig(config.outputDirectory, config);
      
      console.log(chalk.green('✅ Configuration saved successfully!'));
      console.log(chalk.gray(`Configuration saved to: ${join(config.outputDirectory, '.ai-instructions.json')}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Interactive initialization failed:'), error);
      process.exit(1);
    }
  }

  /**
   * Generate files based on configuration
   */
  private async generateFiles(config: ProjectConfig, options: InteractiveOptions): Promise<void> {
    console.log(chalk.blue('📁 Generating files...'));
    
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
        console.log(chalk.gray('Generator options:'), generatorOptions);
      }

      await generator.generateFiles(config.outputDirectory, generatorOptions);
      
      console.log(chalk.green(`✅ Generated ${generator.getToolName()} configuration files`));
      
      // Display generated files summary
      this.displayGeneratedFiles(config);
      
    } catch (error) {
      console.error(chalk.red('❌ File generation failed:'), error);
      throw error;
    }
  }

  /**
   * Display summary of generated files
   */
  private displayGeneratedFiles(config: ProjectConfig): void {
    const toolConfig = AVAILABLE_TOOLS[config.tool];
    
    console.log(chalk.green('\n📋 Generated Files:'));
    if (toolConfig) {
      console.log(`  ${chalk.cyan('Main config:')} ${toolConfig.configFile}`);
    }
    console.log(`  ${chalk.cyan('Instructions:')} instructions/`);
    
    if (config.methodologies.length > 0) {
      console.log(`  ${chalk.cyan('Methodologies:')} ${config.methodologies.map(m => `instructions/methodologies/${m}.md`).join(', ')}`);
    }
    
    if (config.languages.length > 0) {
      console.log(`  ${chalk.cyan('Language patterns:')} ${config.languages.map(l => `instructions/patterns/${l}/`).join(', ')}`);
    }
    
    if (config.agents && config.agents.length > 0) {
      console.log(`  ${chalk.cyan('Agents:')} ${config.agents.map(a => `${a}.md`).join(', ')}`);
    }

    console.log(chalk.gray(`\n📍 All files created in: ${config.outputDirectory}`));
    
    // Show next steps
    console.log(chalk.blue('\n🚀 Next Steps:'));
    if (toolConfig) {
      console.log(`  1. Review generated ${toolConfig.configFile}`);
    }
    console.log('  2. Customize instructions for your project');
    console.log('  3. Start using your AI tool with enhanced instructions');
    
    if (config.tool === 'claude') {
      console.log(chalk.cyan('  💡 Tip: Use /serena to activate agents in Claude'));
    }
  }

  /**
   * Validate prerequisites for interactive initialization
   */
  static validatePrerequisites(templatesDir?: string): boolean {
    const templatePath = templatesDir || resolve(join(__dirname, '../../templates'));
    
    if (!existsSync(templatePath)) {
      console.error(chalk.red(`❌ Templates directory not found: ${templatePath}`));
      return false;
    }

    const requiredDirs = [
      'instructions',
      'agents',
      'configs'
    ];

    for (const dir of requiredDirs) {
      if (!existsSync(join(templatePath, dir))) {
        console.error(chalk.red(`❌ Required template directory missing: ${dir}`));
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current directory already has configuration
   */
  static hasExistingConfig(directory: string = process.cwd()): boolean {
    return ConfigManager.loadConfig(directory) !== null;
  }

  /**
   * Display quick status of current directory
   */
  static showStatus(directory: string = process.cwd()): void {
    const config = ConfigManager.loadConfig(directory);
    
    if (config) {
      console.log(chalk.green('📋 Current Configuration:'));
      const toolConfig = AVAILABLE_TOOLS[config.tool];
      if (toolConfig) {
        console.log(`  ${chalk.cyan('Tool:')} ${toolConfig.name}`);
      } else {
        console.log(`  ${chalk.cyan('Tool:')} ${config.tool} (unknown)`);
      }
      console.log(`  ${chalk.cyan('Project:')} ${config.projectName}`);
      console.log(`  ${chalk.cyan('Generated:')} ${new Date(config.generatedAt).toLocaleString()}`);
      
      // Check for config files
      if (toolConfig) {
        const configExists = existsSync(join(directory, toolConfig.configFile));
        console.log(`  ${chalk.cyan('Config file:')} ${configExists ? '✅' : '❌'} ${toolConfig.configFile}`);
      }
      
    } else {
      console.log(chalk.yellow('📋 No configuration found in current directory'));
      console.log(chalk.gray('Run "ai-instructions init" to set up AI instructions'));
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
    console.log(chalk.yellow('⚠️  Interactive mode not available in this environment'));
    console.log(chalk.gray('Use command-line options for non-interactive setup:'));
    console.log(chalk.gray('  ai-instructions init --tool claude --lang ja'));
    console.log(chalk.gray('  ai-instructions init --help'));
  }
}