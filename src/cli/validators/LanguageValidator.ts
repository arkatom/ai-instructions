/**
 * Language validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';

export class LanguageValidator implements Validator<string> {
  private readonly supportedLanguages = ['en', 'ja', 'ch'];

  validate(lang: string): ValidationResult {
    const isSupported = this.supportedLanguages.includes(lang);
    
    return {
      isValid: isSupported,
      errors: isSupported ? [] : [`Unsupported language: ${lang}. Supported languages: ${this.supportedLanguages.join(', ')}`]
    };
  }
}