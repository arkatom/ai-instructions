/**
 * Type guard utility functions
 * Issue #67: Replace typeof abuse with proper type guards
 * Enhanced for CLI type safety
 */

import { ConverterFactory, OutputFormat } from '../converters';
import { GeneratorFactory, SupportedTool } from '../generators/factory';
import {
  CLI_DEFAULTS,
  CliValidationResult,
  CONFLICT_RESOLUTION_STRATEGIES,
  ConflictResolutionStrategy,
  RawInitOptions,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  ValidatedInitOptions,
  ValidationError
} from '../types/cli-types';
import { includesStringLiteral } from './array-helpers';

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
 * Uses type-safe array helper to avoid type assertions
 */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return includesStringLiteral(SUPPORTED_LANGUAGES, value);
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
 * Uses type-safe array helper to avoid type assertions
 */
export function isSupportedConflictResolution(value: unknown): value is ConflictResolutionStrategy {
  return includesStringLiteral(CONFLICT_RESOLUTION_STRATEGIES, value);
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
 * Uses a pattern where validation and construction are combined for type safety
 */
export function validateCliOptions(rawOptions: RawInitOptions, currentWorkingDirectory: string): CliValidationResult {
  const errors: ValidationError[] = [];
  
  // Type-safe validation and extraction
  const result = validateAndExtractOptions(rawOptions, currentWorkingDirectory, errors);
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }
  
  return {
    isValid: true,
    errors: [],
    validatedOptions: result
  };
}

/**
 * Internal function that validates and extracts options with proper type narrowing
 * Uses explicit typing approach to avoid any type assertions
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function validateAndExtractOptions(
  rawOptions: RawInitOptions, 
  currentWorkingDirectory: string,
  errors: ValidationError[]
): ValidatedInitOptions {
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

  // Validate tool - using explicit switch/case for type safety
  let tool: SupportedTool;
  const toolString = typeof rawOptions.tool === 'string' ? rawOptions.tool : CLI_DEFAULTS.tool;
  switch (toolString) {
    case 'claude':
    case 'cursor':
    case 'windsurf':
    case 'github-copilot':
    case 'cline':
      tool = toolString;
      break;
    default:
      tool = CLI_DEFAULTS.tool;
      if (typeof rawOptions.tool === 'string') {
        errors.push({
          field: 'tool',
          message: `Unsupported tool: ${rawOptions.tool}`,
          received: rawOptions.tool,
          expected: [...GeneratorFactory.getSupportedTools()]
        });
      }
      break;
  }

  // Validate language - using explicit switch/case for type safety
  let lang: SupportedLanguage;
  const langString = typeof rawOptions.lang === 'string' ? rawOptions.lang : CLI_DEFAULTS.lang;
  switch (langString) {
    case 'en':
    case 'ja':
    case 'ch':
      lang = langString;
      break;
    default:
      lang = CLI_DEFAULTS.lang;
      if (typeof rawOptions.lang === 'string') {
        errors.push({
          field: 'lang',
          message: `Unsupported language: ${rawOptions.lang}`,
          received: rawOptions.lang,
          expected: [...SUPPORTED_LANGUAGES]
        });
      }
      break;
  }

  // Validate output format - using explicit switch/case for type safety
  let outputFormat: OutputFormat;
  const outputFormatString = typeof rawOptions.outputFormat === 'string' ? rawOptions.outputFormat : CLI_DEFAULTS.outputFormat;
  switch (outputFormatString) {
    case 'claude':
    case 'cursor':
    case 'copilot':
    case 'windsurf':
      outputFormat = outputFormatString;
      break;
    default:
      outputFormat = CLI_DEFAULTS.outputFormat;
      if (typeof rawOptions.outputFormat === 'string') {
        errors.push({
          field: 'outputFormat',
          message: `Unsupported output format: ${rawOptions.outputFormat}`,
          received: rawOptions.outputFormat,
          expected: ConverterFactory.getAvailableFormats()
        });
      }
      break;
  }

  // Validate conflict resolution - using explicit switch/case for type safety
  let conflictResolution: ConflictResolutionStrategy;
  const conflictResolutionString = typeof rawOptions.conflictResolution === 'string' ? rawOptions.conflictResolution : CLI_DEFAULTS.conflictResolution;
  switch (conflictResolutionString) {
    case 'backup':
    case 'merge':
    case 'skip':
    case 'overwrite':
      conflictResolution = conflictResolutionString;
      break;
    default:
      conflictResolution = CLI_DEFAULTS.conflictResolution;
      if (typeof rawOptions.conflictResolution === 'string') {
        errors.push({
          field: 'conflictResolution',
          message: `Unsupported conflict resolution strategy: ${rawOptions.conflictResolution}`,
          received: rawOptions.conflictResolution,
          expected: [...CONFLICT_RESOLUTION_STRATEGIES]
        });
      }
      break;
  }

  // Validate boolean flags
  const force = typeof rawOptions.force === 'boolean' ? rawOptions.force : CLI_DEFAULTS.force;
  const preview = typeof rawOptions.preview === 'boolean' ? rawOptions.preview : CLI_DEFAULTS.preview;
  const interactive = typeof rawOptions.interactive === 'boolean' ? rawOptions.interactive : CLI_DEFAULTS.interactive;
  const backup = typeof rawOptions.backup === 'boolean' ? rawOptions.backup : CLI_DEFAULTS.backup;

  // Return validated options with proper types
  return {
    output,
    projectName,
    tool,
    lang,
    outputFormat,
    force,
    preview,
    conflictResolution,
    interactive,
    backup
  };
}

/**
 * Type guard to check if validation result contains valid options
 */
export function hasValidatedOptions(result: CliValidationResult): result is CliValidationResult & { validatedOptions: ValidatedInitOptions } {
  return result.isValid && result.validatedOptions !== undefined;
}
