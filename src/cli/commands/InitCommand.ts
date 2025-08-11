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


import { OutputFormat } from '../../converters';
import { InteractiveInitializer, InteractiveUtils } from '../../init/interactive';
import { PathValidator, SecurityError } from '../../utils/security';
import { InteractiveModeDetector } from '../services/InteractiveModeDetector';
import { PreviewHandler } from '../services/PreviewHandler';
import { ForceWarningHandler } from '../services/ForceWarningHandler';
import { FileGenerationOrchestrator } from '../services/FileGenerationOrchestrator';
import { ValidationCoordinator } from '../services/ValidationCoordinator';

import { Logger } from '../../utils/logger';
import { EnvironmentService } from '../../services/EnvironmentService';

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
  private readonly interactiveModeDetector: InteractiveModeDetector;
  private readonly previewHandler: PreviewHandler;
  private readonly forceWarningHandler: ForceWarningHandler;
  private readonly fileGenerationOrchestrator: FileGenerationOrchestrator;
  private readonly validationCoordinator: ValidationCoordinator;
  private readonly environmentService: EnvironmentService;

  constructor(
    validators?: InitCommandValidators,
    interactiveModeDetector?: InteractiveModeDetector,
    previewHandler?: PreviewHandler,
    forceWarningHandler?: ForceWarningHandler,
    fileGenerationOrchestrator?: FileGenerationOrchestrator,
    validationCoordinator?: ValidationCoordinator,
    environmentService?: EnvironmentService
  ) {
    this.validators = validators || {
      projectName: new ProjectNameValidator(),
      language: new LanguageValidator(),
      outputFormat: new OutputFormatValidator(),
      outputPath: new OutputPathValidator(),
      conflictResolution: new ConflictResolutionValidator()
    };
    this.interactiveModeDetector = interactiveModeDetector || new InteractiveModeDetector();
    this.previewHandler = previewHandler || new PreviewHandler();
    this.forceWarningHandler = forceWarningHandler || new ForceWarningHandler();
    this.fileGenerationOrchestrator = fileGenerationOrchestrator || new FileGenerationOrchestrator();
    this.validationCoordinator = validationCoordinator || new ValidationCoordinator(this.validators);
    this.environmentService = environmentService || new EnvironmentService();
  }

  /**
   * Validate command arguments using ValidationCoordinator
   */
  validate(args: CommandArgs): ValidationResult {
    return this.validationCoordinator.validate(args);
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
      const output = (typeof initArgs.output === 'string') ? initArgs.output : this.environmentService.getCurrentWorkingDirectory();
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
      const useInteractive = this.interactiveModeDetector.shouldUseInteractiveMode(initArgs);

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
        return await this.previewHandler.handlePreviewMode({
          output: validatedOutputDir,
          tool,
          projectName,
          lang
        });
      }

      // Handle force mode warning
      if (initArgs.force) {
        await this.forceWarningHandler.showForceWarning();
      }

      // Generate files using orchestrator
      return await this.fileGenerationOrchestrator.generateFiles({
        tool,
        outputDir: validatedOutputDir,
        projectName,
        force: initArgs.force || false,
        lang: lang as 'en' | 'ja' | 'ch',
        outputFormat: outputFormat as OutputFormat,
        conflictResolution,
        interactive: initArgs.interactive !== false,
        backup: initArgs.backup !== false
      });

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
}