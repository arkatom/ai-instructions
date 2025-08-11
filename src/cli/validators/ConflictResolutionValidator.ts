/**
 * Conflict resolution strategy validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';

export class ConflictResolutionValidator implements Validator<string> {
  private readonly supportedStrategies = ['backup', 'merge', 'skip', 'overwrite'];

  validate(strategy: string): ValidationResult {
    const isSupported = this.supportedStrategies.includes(strategy);
    
    return {
      isValid: isSupported,
      errors: isSupported ? [] : [
        `Unsupported conflict resolution strategy: ${strategy}. Supported strategies: ${this.supportedStrategies.join(', ')}`
      ]
    };
  }
}