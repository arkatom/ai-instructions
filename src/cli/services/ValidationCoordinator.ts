/**
 * TDD GREEN PHASE: ValidationCoordinator Implementation
 * Issue #50: Extract validation logic from InitCommand
 */

import { CommandArgs, InitCommandArgs } from '../interfaces/CommandArgs';
import { ValidationResult } from '../interfaces/ValidationResult';
import { Validator } from '../interfaces/Validator';

import { ProjectNameValidator } from '../validators/ProjectNameValidator';
import { LanguageValidator } from '../validators/LanguageValidator';
import { OutputFormatValidator } from '../validators/OutputFormatValidator';
import { OutputPathValidator } from '../validators/OutputPathValidator';
import { ConflictResolutionValidator } from '../validators/ConflictResolutionValidator';

import { GeneratorFactory } from '../../generators/factory';
import { isStringOrUndefined } from '../../utils/type-guards';

/**
 * ValidationCoordinator validators interface for dependency injection
 */
export interface ValidationCoordinatorValidators {
  projectName: Validator<string>;
  language: Validator<string>;
  outputFormat: Validator<string>;
  outputPath: Validator<string>;
  conflictResolution: Validator<string>;
}

/**
 * Coordinates validation of command arguments using multiple validators
 */
export class ValidationCoordinator {
  private readonly validators: ValidationCoordinatorValidators;

  constructor(validators?: ValidationCoordinatorValidators) {
    this.validators = validators || {
      projectName: new ProjectNameValidator(),
      language: new LanguageValidator(),
      outputFormat: new OutputFormatValidator(),
      outputPath: new OutputPathValidator(),
      conflictResolution: new ConflictResolutionValidator()
    };
  }

  /**
   * Validate command arguments and return comprehensive result
   */
  validate(args: CommandArgs): ValidationResult {
    const initArgs = args as InitCommandArgs;
    const errors: string[] = [];

    // Validate project name (validate if string provided, including empty strings)
    if (typeof initArgs.projectName === 'string') {
      const projectNameResult = this.validators.projectName.validate(initArgs.projectName);
      if (!projectNameResult.isValid) {
        errors.push(...projectNameResult.errors);
      }
    }

    // Validate language (only validate non-empty strings)
    if (typeof initArgs.lang === 'string' && initArgs.lang.length > 0) {
      const languageResult = this.validators.language.validate(initArgs.lang);
      if (!languageResult.isValid) {
        errors.push(...languageResult.errors);
      }
    }

    // Validate output format (only validate non-empty strings)
    if (typeof initArgs.outputFormat === 'string' && initArgs.outputFormat.length > 0) {
      const outputFormatResult = this.validators.outputFormat.validate(initArgs.outputFormat);
      if (!outputFormatResult.isValid) {
        errors.push(...outputFormatResult.errors);
      }
    }

    // Validate output path (only validate non-empty strings)
    if (typeof initArgs.output === 'string' && initArgs.output.length > 0) {
      const outputPathResult = this.validators.outputPath.validate(initArgs.output);
      if (!outputPathResult.isValid) {
        errors.push(...outputPathResult.errors);
      }
    }

    // Validate conflict resolution (only validate non-empty strings)
    if (typeof initArgs.conflictResolution === 'string' && initArgs.conflictResolution.length > 0) {
      const conflictResult = this.validators.conflictResolution.validate(initArgs.conflictResolution);
      if (!conflictResult.isValid) {
        errors.push(...conflictResult.errors);
      }
    }

    // Validate tool (only validate non-empty strings)
    if (typeof initArgs.tool === 'string' && initArgs.tool.length > 0 && !GeneratorFactory.isValidTool(initArgs.tool)) {
      errors.push(`Unsupported tool: ${initArgs.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}