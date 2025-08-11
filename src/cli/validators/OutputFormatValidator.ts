/**
 * Output format validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';
import { ConverterFactory } from '../../converters';

export class OutputFormatValidator implements Validator<string> {
  validate(format: string): ValidationResult {
    const isSupported = ConverterFactory.isFormatSupported(format);
    
    return {
      isValid: isSupported,
      errors: isSupported ? [] : [
        `Unsupported output format: ${format}. Supported formats: ${ConverterFactory.getAvailableFormats().join(', ')}`
      ]
    };
  }
}