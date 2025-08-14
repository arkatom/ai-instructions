/**
 * Type guard utility functions
 * Issue #67: Replace typeof abuse with proper type guards
 * Enhanced for CLI type safety
 */

import { GeneratorFactory, SupportedTool } from '../generators/factory';
import { ConverterFactory, OutputFormat } from '../converters';
import {
  SupportedLanguage,
  ConflictResolutionStrategy,
  RawInitOptions,
  ValidatedInitOptions,
  CliValidationResult,
  ValidationError,
  CLI_DEFAULTS,
  SUPPORTED_LANGUAGES,
  CONFLICT_RESOLUTION_STRATEGIES
} from '../types/cli-types';

/**
 * Type guard to check if a value is a non-empty string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a string or undefined
 */
export function isStringOrUndefined(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Type guard to check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is an object (but not null or array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Safely get a string value with fallback
 */
export function getStringValue(value: unknown, fallback: string): string {
  return isString(value) ? value : fallback;
}

/**
 * Safely get a string value from optional input with fallback
 */
export function getOptionalStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

// =============================================================================
// CLI-Specific Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a supported language
 */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Type guard to check if a value is a supported tool
 */
export function isSupportedTool(value: unknown): value is string {
  return typeof value === 'string' && GeneratorFactory.isValidTool(value);
}

/**
 * Type guard to check if a value is a supported output format
 */
export function isSupportedOutputFormat(value: unknown): value is string {
  return typeof value === 'string' && ConverterFactory.isFormatSupported(value);
}

/**
 * Type guard to check if a value is a supported conflict resolution strategy
 */
export function isSupportedConflictResolution(value: unknown): value is ConflictResolutionStrategy {
  return typeof value === 'string' && (CONFLICT_RESOLUTION_STRATEGIES as readonly string[]).includes(value);
}

/**
 * Type guard to check if a value is a valid project name
 */
export function isValidProjectName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.trim() === '') return false;
  
  // Check for forbidden characters
  const invalidChars = /[<>|]/;
  return !invalidChars.test(value);
}

/**
 * Type guard to check if a value is a valid output directory path
 */
export function isValidOutputPath(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('\0') && value.trim() !== '';
}

/**
 * Validates and converts raw CLI options to type-safe options
 */
export function validateCliOptions(rawOptions: RawInitOptions, currentWorkingDirectory: string): CliValidationResult {
  const errors: ValidationError[] = [];
  
  // Validate output path
  const output = getOptionalStringValue(rawOptions.output, currentWorkingDirectory);
  if (!isValidOutputPath(output)) {
    errors.push({
      field: 'output',
      message: 'Invalid output directory path',
      received: rawOptions.output,
      expected: ['valid directory path']
    });
  }
  
  // Validate project name
  const projectName = getOptionalStringValue(rawOptions.projectName, CLI_DEFAULTS.projectName);
  if (!isValidProjectName(projectName)) {
    errors.push({
      field: 'projectName',
      message: 'Invalid project name: cannot be empty or contain forbidden characters (<, >, |)',
      received: rawOptions.projectName,
      expected: ['non-empty string without forbidden characters']
    });
  }
  
  // Validate tool
  const tool = getOptionalStringValue(rawOptions.tool, CLI_DEFAULTS.tool);
  if (!isSupportedTool(tool)) {
    errors.push({
      field: 'tool',
      message: `Unsupported tool: ${tool}`,
      received: rawOptions.tool,
      expected: GeneratorFactory.getSupportedTools()
    });
  }
  
  // Validate language
  const lang = getOptionalStringValue(rawOptions.lang, CLI_DEFAULTS.lang);
  if (!isSupportedLanguage(lang)) {
    errors.push({
      field: 'lang',
      message: `Unsupported language: ${lang}`,
      received: rawOptions.lang,
      expected: [...SUPPORTED_LANGUAGES]
    });
  }
  
  // Validate output format
  const outputFormat = getOptionalStringValue(rawOptions.outputFormat, CLI_DEFAULTS.outputFormat);
  if (!isSupportedOutputFormat(outputFormat)) {
    errors.push({
      field: 'outputFormat',
      message: `Unsupported output format: ${outputFormat}`,
      received: rawOptions.outputFormat,
      expected: ConverterFactory.getAvailableFormats()
    });
  }
  
  // Validate conflict resolution
  const conflictResolution = getOptionalStringValue(rawOptions.conflictResolution, CLI_DEFAULTS.conflictResolution);
  if (!isSupportedConflictResolution(conflictResolution)) {
    errors.push({
      field: 'conflictResolution',
      message: `Unsupported conflict resolution strategy: ${conflictResolution}`,
      received: rawOptions.conflictResolution,
      expected: [...CONFLICT_RESOLUTION_STRATEGIES]
    });
  }
  
  // Validate boolean flags
  const force = typeof rawOptions.force === 'boolean' ? rawOptions.force : CLI_DEFAULTS.force;
  const preview = typeof rawOptions.preview === 'boolean' ? rawOptions.preview : CLI_DEFAULTS.preview;
  const interactive = typeof rawOptions.interactive === 'boolean' ? rawOptions.interactive : CLI_DEFAULTS.interactive;
  const backup = typeof rawOptions.backup === 'boolean' ? rawOptions.backup : CLI_DEFAULTS.backup;
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }
  
  // All fields have been validated by type guards above
  const validatedOptions: ValidatedInitOptions = {
    output,
    projectName,
    tool: tool as SupportedTool, // Type-safe after isSupportedTool validation
    lang: lang as SupportedLanguage, // Type-safe after isSupportedLanguage validation  
    outputFormat: outputFormat as OutputFormat, // Type-safe after isSupportedOutputFormat validation
    force,
    preview,
    conflictResolution: conflictResolution as ConflictResolutionStrategy, // Type-safe after validation
    interactive,
    backup
  };
  
  return {
    isValid: true,
    errors: [],
    validatedOptions
  };
}

/**
 * Type guard to check if validation result contains valid options
 */
export function hasValidatedOptions(result: CliValidationResult): result is CliValidationResult & { validatedOptions: ValidatedInitOptions } {
  return result.isValid && result.validatedOptions !== undefined;
}