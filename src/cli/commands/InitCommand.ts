/**
 * InitCommand - Extract init command logic from CLI monolith
 * Issue #50: Single Responsibility Principle Violation Fix
 */

import { Command } from '../interfaces/Command';
import { CommandArgs, InitCommandArgs } from '../interfaces/CommandArgs';
import { CommandResult } from '../interfaces/CommandResult';
import { ValidationResult } from '../interfaces/ValidationResult';
import { Validator } from '../interfaces/Validator';

import { ProjectNameValidator } from '../validators/ProjectNameValidator';
import { LanguageValidator } from '../validators/LanguageValidator';
import { OutputFormatValidator } from '../validators/OutputFormatValidator';
import { OutputPathValidator } from '../validators/OutputPathValidator';
import { ConflictResolutionValidator } from '../validators/ConflictResolutionValidator';

import { GeneratorFactory, SupportedTool } from '../../generators/factory';
import { OutputFormat } from '../../converters';
import { InteractiveInitializer, InteractiveUtils } from '../../init/interactive';
import { PathValidator, SecurityError } from '../../utils/security';
import { Logger } from '../../utils/logger';

/**
 * InitCommand validators interface for dependency injection
 */
export interface InitCommandValidators {
  projectName: Validator<string>;
  language: Validator<string>;
  outputFormat: Validator<string>;
  outputPath: Validator<string>;
  conflictResolution: Validator<string>;
}

/**
 * Command Pattern implementation for init command
 */
export class InitCommand implements Command {
  public readonly validators: InitCommandValidators;

  constructor(validators?: InitCommandValidators) {
    this.validators = validators || {
      projectName: new ProjectNameValidator(),
      language: new LanguageValidator(),
      outputFormat: new OutputFormatValidator(),
      outputPath: new OutputPathValidator(),
      conflictResolution: new ConflictResolutionValidator()
    };
  }

  /**
   * Validate command arguments
   */
  validate(args: CommandArgs): ValidationResult {
    const initArgs = args as InitCommandArgs;
    const errors: string[] = [];

    // Validate project name
    if (initArgs.projectName && typeof initArgs.projectName === 'string') {
      const projectNameResult = this.validators.projectName.validate(initArgs.projectName);
      if (!projectNameResult.isValid) {
        errors.push(...projectNameResult.errors);
      }
    }

    // Validate language
    if (initArgs.lang && typeof initArgs.lang === 'string') {
      const languageResult = this.validators.language.validate(initArgs.lang);
      if (!languageResult.isValid) {
        errors.push(...languageResult.errors);
      }
    }

    // Validate output format
    if (initArgs.outputFormat && typeof initArgs.outputFormat === 'string') {
      const outputFormatResult = this.validators.outputFormat.validate(initArgs.outputFormat);
      if (!outputFormatResult.isValid) {
        errors.push(...outputFormatResult.errors);
      }
    }

    // Validate output path
    if (initArgs.output && typeof initArgs.output === 'string') {
      const outputPathResult = this.validators.outputPath.validate(initArgs.output);
      if (!outputPathResult.isValid) {
        errors.push(...outputPathResult.errors);
      }
    }

    // Validate conflict resolution
    if (initArgs.conflictResolution && typeof initArgs.conflictResolution === 'string') {
      const conflictResult = this.validators.conflictResolution.validate(initArgs.conflictResolution);
      if (!conflictResult.isValid) {
        errors.push(...conflictResult.errors);
      }
    }

    // Validate tool
    if (initArgs.tool && typeof initArgs.tool === 'string' && !GeneratorFactory.isValidTool(initArgs.tool)) {
      errors.push(`Unsupported tool: ${initArgs.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute init command
   */
  async execute(args: CommandArgs): Promise<CommandResult> {
    const initArgs = args as InitCommandArgs;
    try {
      // Validate arguments first
      const validation = this.validate(args);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join('; ')
        };
      }

      // Set defaults
      const output = (typeof initArgs.output === 'string') ? initArgs.output : process.cwd();
      const projectName = (typeof initArgs.projectName === 'string') ? initArgs.projectName : 'my-project';
      const tool = (typeof initArgs.tool === 'string') ? initArgs.tool : 'claude';
      const lang = (typeof initArgs.lang === 'string') ? initArgs.lang : 'ja';
      const outputFormat = (typeof initArgs.outputFormat === 'string') ? initArgs.outputFormat : 'claude';
      const conflictResolution = (typeof initArgs.conflictResolution === 'string') ? initArgs.conflictResolution : 'backup';

      // Validate output directory for security
      let validatedOutputDir: string;
      try {
        validatedOutputDir = PathValidator.validateCliPath(output);
      } catch (error) {
        return {
          success: false,
          error: `SecurityError: ${(error as Error).message}`
        };
      }

      // Determine if we should use interactive mode
      const useInteractive = this.shouldUseInteractiveMode(initArgs);

      if (useInteractive) {
        // Interactive mode
        Logger.info('🤖 Starting interactive setup...\n');
        
        // Check prerequisites
        if (!InteractiveInitializer.validatePrerequisites()) {
          return {
            success: false,
            error: 'Prerequisites not met for interactive mode'
          };
        }

        // Run interactive initialization
        const initializer = new InteractiveInitializer();
        await initializer.initialize({
          outputDirectory: validatedOutputDir,
          verbose: false
        });

        return { success: true };
      }

      // Non-interactive mode
      Logger.info('🤖 Using non-interactive mode with provided options...\n');

      // Handle preview mode
      if (initArgs.preview) {
        return this.handlePreviewMode({
          output: validatedOutputDir,
          tool,
          projectName,
          lang
        });
      }

      // Handle force mode warning
      if (initArgs.force) {
        await this.showForceWarning();
      }

      // Generate files
      const generator = GeneratorFactory.createGenerator(tool as SupportedTool);
      await generator.generateFiles(validatedOutputDir, { 
        projectName,
        force: initArgs.force || false,
        lang: lang as 'en' | 'ja' | 'ch',
        outputFormat: outputFormat as OutputFormat,
        conflictResolution,
        interactive: initArgs.interactive !== false,
        backup: initArgs.backup !== false
      });

      // Success logging
      Logger.success(`Generated ${generator.getToolName()} template files in ${validatedOutputDir}`);
      Logger.info(`📁 Files created for ${generator.getToolName()} AI tool`);
      Logger.item('🎯 Project name:', projectName);
      
      // Show format conversion message when output-format is used
      if (outputFormat && outputFormat !== 'claude') {
        Logger.info(`🔄 Converted from Claude format to ${outputFormat}`);
      }

      // Safety reminders
      if (!initArgs.force) {
        Logger.tip('Use --preview to check for conflicts before generating');
        Logger.tip('Use --force to skip warnings (be careful!)');
        Logger.tip('Run "ai-instructions init" without options for interactive setup');
      }

      return { success: true };

    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        // In test environment, throw the error so tests can catch it
        throw error;
      } else {
        let errorMessage: string;
        
        if (error instanceof SecurityError) {
          errorMessage = `Security violation: ${error.message}`;
          if (error.details) {
            Logger.debug(`Security details: ${error.details}`);
          }
        } else {
          errorMessage = `Failed to generate template files: ${error}`;
          if (!InteractiveUtils.canRunInteractive()) {
            Logger.tip('Interactive mode unavailable. Use command-line options.');
          }
        }
        
        Logger.error(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }
    }
  }

  /**
   * Determine if interactive mode should be used
   */
  shouldUseInteractiveMode(args: InitCommandArgs): boolean {
    // Check for raw args if available (for CLI integration)
    const rawArgs = process.argv.slice(2);
    
    // If any specific options are provided, use non-interactive mode
    const nonInteractiveOptions = [
      '--project-name', '-n',
      '--tool', '-t', 
      '--lang', '-l',
      '--output-format', '-f',
      '--force',
      '--preview',
      '--conflict-resolution', '-r',
      '--no-interactive',
      '--no-backup'
    ];

    const hasNonInteractiveOptions = rawArgs.some(arg => 
      nonInteractiveOptions.includes(arg) || arg.startsWith('--project-name=')
    );

    // Explicitly disabled
    if (args.interactive === false) {
      return false;
    }

    // Non-interactive environment or specific options provided
    if (!InteractiveUtils.canRunInteractive() || hasNonInteractiveOptions) {
      return false;
    }

    // Default to interactive if available
    return true;
  }

  /**
   * Handle preview mode
   */
  private handlePreviewMode(options: {
    output: string;
    tool: string;
    projectName: string;
    lang: string;
  }): CommandResult {
    try {
      // Try to use chalk for colors, fall back to plain text
      const chalk = require('chalk');
      Logger.info(chalk.blue('🔍 Preview mode: Analyzing potential file conflicts...'));
    } catch {
      Logger.info('🔍 Preview mode: Analyzing potential file conflicts...');
    }
    
    Logger.warn('Preview functionality will be enhanced in v0.3.0');
    Logger.warn('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
    Logger.item('📍 Target directory:', options.output);
    Logger.item('🤖 Tool:', options.tool);
    Logger.item('📦 Project name:', options.projectName);
    Logger.item('🌍 Language:', options.lang);
    
    return { success: true };
  }

  /**
   * Show force mode warning
   */
  private async showForceWarning(): Promise<void> {
    try {
      const chalk = require('chalk');
      Logger.raw(chalk.red('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!'));
      Logger.raw(chalk.red('💣 Proceeding in 2 seconds...'));
    } catch {
      Logger.raw('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!');
      Logger.raw('💣 Proceeding in 2 seconds...');
    }
    
    // Brief delay to let user see the warning
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}