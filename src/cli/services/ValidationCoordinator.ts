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
   * Validate a single field with a validator
   */
  private validateField(
    value: any,
    validator: { validate: (value: any) => ValidationResult },
    errors: string[],
    requireNonEmpty = true
  ): void {
    if (typeof value !== 'string') return;
    if (requireNonEmpty && value.length === 0) return;
    
    const result = validator.validate(value);
    if (!result.isValid) {
      errors.push(...result.errors);
    }
  }

  /**
   * Validate tool separately due to different validation logic
   */
  private validateTool(tool: any, errors: string[]): void {
    if (typeof tool !== 'string' || tool.length === 0) return;
    
    if (!GeneratorFactory.isValidTool(tool)) {
      errors.push(`Unsupported tool: ${tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
    }
  }

  /**
   * Validate command arguments and return comprehensive result
   */
  validate(args: CommandArgs): ValidationResult {
    const initArgs = args as InitCommandArgs;
    const errors: string[] = [];

    // Validate project name (validate if string provided, including empty strings)
    this.validateField(initArgs.projectName, this.validators.projectName, errors, false);

    // Validate language (only validate non-empty strings)
    this.validateField(initArgs.lang, this.validators.language, errors);

    // Validate output format (only validate non-empty strings)
    this.validateField(initArgs.outputFormat, this.validators.outputFormat, errors);

    // Validate output path (only validate non-empty strings)
    this.validateField(initArgs.output, this.validators.outputPath, errors);

    // Validate conflict resolution (only validate non-empty strings)
    this.validateField(initArgs.conflictResolution, this.validators.conflictResolution, errors);

    // Validate tool (only validate non-empty strings)
    this.validateTool(initArgs.tool, errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}