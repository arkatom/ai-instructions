/**
 * Generic validator interface
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { ValidationResult } from './ValidationResult';

export interface Validator<T> {
  /**
   * Validate input and return result
   */
  validate(input: T): ValidationResult;
}