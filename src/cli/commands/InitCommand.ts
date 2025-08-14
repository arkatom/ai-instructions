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
import { InteractiveInitializer } from '../../init/interactive';
import { PathValidator } from '../../utils/security';
import { InteractiveModeDetector } from '../services/InteractiveModeDetector';
import { PreviewHandler } from '../services/PreviewHandler';
import { ForceWarningHandler } from '../services/ForceWarningHandler';
import { FileGenerationOrchestrator } from '../services/FileGenerationOrchestrator';
import { ValidationCoordinator } from '../services/ValidationCoordinator';

import { Logger } from '../../utils/logger';
import { EnvironmentService } from '../../services/EnvironmentService';
import { getOptionalStringValue } from '../../utils/type-guards';
import { ErrorHandler } from '../../utils/error-handler';

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

      // Set defaults using type guards
      const output = getOptionalStringValue(initArgs.output, this.environmentService.getCurrentWorkingDirectory());
      const projectName = getOptionalStringValue(initArgs.projectName, 'my-project');
      const tool = getOptionalStringValue(initArgs.tool, 'claude');
      const lang = getOptionalStringValue(initArgs.lang, 'ja');
      const outputFormat = getOptionalStringValue(initArgs.outputFormat, 'claude');
      
      // Validate output format
      const outputFormatValidation = this.validators.outputFormat.validate(outputFormat);
      if (!outputFormatValidation.isValid) {
        return {
          success: false,
          error: `Invalid output format: ${outputFormatValidation.errors.join('; ')}`
        };
      }
      const conflictResolution = getOptionalStringValue(initArgs.conflictResolution, 'backup');

      // Validate output directory for security
      let validatedOutputDir: string;
      try {
        validatedOutputDir = PathValidator.validateCliPath(output);
      } catch (error) {
        return ErrorHandler.handleCommandError(error, { operation: 'output path validation' }, false);
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
        outputFormat: outputFormat as OutputFormat, // Type-safe after validation above
        conflictResolution,
        interactive: initArgs.interactive !== false,
        backup: initArgs.backup !== false
      });

    } catch (error) {
      return ErrorHandler.handleCommandError(error, { 
        operation: 'template file generation',
        suggestions: ['Try using --force flag to skip warnings', 'Check file permissions in the output directory']
      }, false);
    }
  }
}