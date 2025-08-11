/**
 * Generator-specific error types for improved error handling and debugging
 * Issue #35: Code Review - Enhanced error handling for template loading failures
 */

/**
 * Base error class for generator-related errors
 */
export abstract class GeneratorError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'template' | 'configuration' | 'filesystem' | 'validation';
  
  constructor(message: string, public context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Template loading errors
 */
export class TemplateNotFoundError extends GeneratorError {
  readonly code = 'TEMPLATE_NOT_FOUND';
  readonly category = 'template' as const;

  constructor(templateName: string, lang: string, searchPaths: string[]) {
    super(`Template "${templateName}" not found for language "${lang}". Searched paths: ${searchPaths.join(', ')}`, 
      { templateName, lang, searchPaths });
  }
}

export class TemplateParsingError extends GeneratorError {
  readonly code = 'TEMPLATE_PARSING_ERROR';
  readonly category = 'template' as const;

  constructor(templateName: string, originalError: Error) {
    super(`Failed to parse template "${templateName}": ${originalError.message}`, 
      { templateName, originalError: originalError.message });
  }
}

/**
 * Configuration loading errors
 */
export class ConfigurationNotFoundError extends GeneratorError {
  readonly code = 'CONFIGURATION_NOT_FOUND';
  readonly category = 'configuration' as const;

  constructor(configType: 'tool' | 'language', configName: string, searchPath: string) {
    const capitalizedType = configType.charAt(0).toUpperCase() + configType.slice(1);
    super(`${capitalizedType} configuration not found for ${configName}`, 
      { configType, configName, searchPath });
  }
}

export class ConfigurationValidationError extends GeneratorError {
  readonly code = 'CONFIGURATION_VALIDATION_ERROR';
  readonly category = 'configuration' as const;

  constructor(configType: 'tool' | 'language' | 'security', configName: string, validationErrors: string[]) {
    super(`${configType} configuration "${configName}" is invalid: ${validationErrors.join(', ')}`,
      { configType, configName, validationErrors });
  }
}

/**
 * File system errors
 */
export class FileSystemError extends GeneratorError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly category = 'filesystem' as const;

  constructor(operation: string, path: string, originalError: Error) {
    super(`File system operation "${operation}" failed for path "${path}": ${originalError.message}`,
      { operation, path, originalError: originalError.message });
  }
}

/**
 * Validation errors
 */
export class ValidationError extends GeneratorError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = 'validation' as const;

  constructor(field: string, value: unknown, expectedType: string) {
    super(`Validation failed for field "${field}": expected ${expectedType}, got ${typeof value}`,
      { field, value, expectedType });
  }
}

/**
 * Language support errors
 */
export class UnsupportedLanguageError extends GeneratorError {
  readonly code = 'UNSUPPORTED_LANGUAGE';
  readonly category = 'validation' as const;

  constructor(lang: string, supportedLanguages: string[]) {
    super(`Unsupported language: ${lang}. Supported languages: ${supportedLanguages.join(', ')}`,
      { lang, supportedLanguages });
  }
}

/**
 * Dynamic template generation errors
 */
export class DynamicTemplateError extends GeneratorError {
  readonly code = 'DYNAMIC_TEMPLATE_ERROR';
  readonly category = 'template' as const;

  constructor(templateName: string, phase: 'loading' | 'processing' | 'replacement', originalError: Error) {
    super(`Dynamic template processing failed for "${templateName}" during ${phase}: ${originalError.message}`,
      { templateName, phase, originalError: originalError.message });
  }
}