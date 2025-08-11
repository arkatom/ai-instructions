/**
 * Project name validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';

export class ProjectNameValidator implements Validator<string> {
  validate(projectName: string): ValidationResult {
    const errors: string[] = [];

    // Check for empty string
    if (!projectName || projectName.trim() === '') {
      errors.push('Project name cannot be empty');
    }

    // Check for forbidden characters
    const invalidChars = /[<>|]/;
    if (invalidChars.test(projectName)) {
      errors.push('Project name contains forbidden characters (<, >, |)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}