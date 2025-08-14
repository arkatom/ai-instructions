/**
 * TDD GREEN PHASE: ValidationCoordinator Implementation
 * Issue #50: Extract validation logic from InitCommand
 */

import { CommandArgs, InitCommandArgs } from '../interfaces/CommandArgs';
import { ValidationResult } from '../interfaces/ValidationResult';
import { Validator } from '../interfaces/Validator';
import { isStringOrUndefined, isBoolean } from '../../utils/type-guards';

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
    value: unknown,
    validator: { validate: (value: string) => ValidationResult },
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
  private validateTool(tool: unknown, errors: string[]): void {
    if (typeof tool !== 'string' || tool.length === 0) return;
    
    if (!GeneratorFactory.isValidTool(tool)) {
      errors.push(`Unsupported tool: ${tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
    }
  }

  /**
   * Type guard to check if CommandArgs is InitCommandArgs
   */
  private isInitCommandArgs(args: CommandArgs): args is InitCommandArgs {
    return 'projectName' in args || 'tool' in args || 'lang' in args;
  }

  /**
   * Validate command arguments and return comprehensive result
   */
  validate(args: CommandArgs): ValidationResult {
    if (!this.isInitCommandArgs(args)) {
      return {
        isValid: false,
        errors: ['Invalid command arguments: not an InitCommandArgs']
      };
    }
    
    const initArgs = args;
    const errors: string[] = [];

    // Validate project name (validate if string provided, including empty strings)
    if (isStringOrUndefined(initArgs.projectName)) {
      this.validateField(initArgs.projectName, this.validators.projectName, errors, false);
    } else if (initArgs.projectName !== undefined) {
      errors.push('Project name must be a string or undefined');
    }

    // Validate language (only validate non-empty strings)
    if (isStringOrUndefined(initArgs.lang)) {
      this.validateField(initArgs.lang, this.validators.language, errors);
    } else if (initArgs.lang !== undefined) {
      errors.push('Language must be a string or undefined');
    }

    // Validate output format (only validate non-empty strings)
    if (isStringOrUndefined(initArgs.outputFormat)) {
      this.validateField(initArgs.outputFormat, this.validators.outputFormat, errors);
    } else if (initArgs.outputFormat !== undefined) {
      errors.push('Output format must be a string or undefined');
    }

    // Validate output path (only validate non-empty strings)
    if (isStringOrUndefined(initArgs.output)) {
      this.validateField(initArgs.output, this.validators.outputPath, errors);
    } else if (initArgs.output !== undefined) {
      errors.push('Output path must be a string or undefined');
    }

    // Validate conflict resolution (only validate non-empty strings)
    if (isStringOrUndefined(initArgs.conflictResolution)) {
      this.validateField(initArgs.conflictResolution, this.validators.conflictResolution, errors);
    } else if (initArgs.conflictResolution !== undefined) {
      errors.push('Conflict resolution must be a string or undefined');
    }

    // Validate tool (only validate non-empty strings)
    if (isStringOrUndefined(initArgs.tool)) {
      this.validateTool(initArgs.tool, errors);
    } else if (initArgs.tool !== undefined) {
      errors.push('Tool must be a string or undefined');
    }

    // Validate boolean flags
    if (initArgs.force !== undefined && !isBoolean(initArgs.force)) {
      errors.push('Force flag must be a boolean');
    }
    if (initArgs.preview !== undefined && !isBoolean(initArgs.preview)) {
      errors.push('Preview flag must be a boolean');
    }
    if (initArgs.interactive !== undefined && !isBoolean(initArgs.interactive)) {
      errors.push('Interactive flag must be a boolean');
    }
    if (initArgs.backup !== undefined && !isBoolean(initArgs.backup)) {
      errors.push('Backup flag must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}