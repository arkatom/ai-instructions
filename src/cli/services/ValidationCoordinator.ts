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

    // Validate project name
    if (typeof initArgs.projectName === 'string') {
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
}