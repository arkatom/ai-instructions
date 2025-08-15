/**
 * CLI Type Definitions
 * Comprehensive type definitions for CLI operations
 * Replaces unsafe type assertions with proper type safety
 */

import { OutputFormat } from '../converters';
import { SupportedTool } from '../generators/factory';

/**
 * Supported languages for templates
 */
export type SupportedLanguage = 'en' | 'ja' | 'ch';

/**
 * Supported conflict resolution strategies
 */
export type ConflictResolutionStrategy = 'backup' | 'merge' | 'skip' | 'overwrite';

/**
 * Validated CLI initialization options
 * All properties are guaranteed to be type-safe after validation
 */
export interface ValidatedInitOptions {
  readonly output: string;
  readonly projectName: string;
  readonly tool: SupportedTool;
  readonly lang: SupportedLanguage;
  readonly outputFormat: OutputFormat;
  readonly force: boolean;
  readonly preview: boolean;
  readonly conflictResolution: ConflictResolutionStrategy;
  readonly interactive: boolean;
  readonly backup: boolean;
}

/**
 * Raw CLI options from Commander.js (may contain invalid values)
 */
export interface RawInitOptions {
  readonly output?: unknown;
  readonly projectName?: unknown;
  readonly tool?: unknown;
  readonly lang?: unknown;
  readonly outputFormat?: unknown;
  readonly force?: unknown;
  readonly preview?: unknown;
  readonly conflictResolution?: unknown;
  readonly interactive?: unknown;
  readonly backup?: unknown;
  readonly directory?: unknown;  // For status command
}

/**
 * Default values for CLI options
 * Using explicit literal types to avoid type assertions
 */
export const CLI_DEFAULTS = {
  projectName: 'my-project',
  tool: 'claude',
  lang: 'ja', 
  outputFormat: 'claude',
  force: false,
  preview: false,
  conflictResolution: 'backup',
  interactive: true,
  backup: true,
} as const satisfies {
  projectName: string;
  tool: SupportedTool;
  lang: SupportedLanguage;
  outputFormat: OutputFormat;
  force: boolean;
  preview: boolean;
  conflictResolution: ConflictResolutionStrategy;
  interactive: boolean;
  backup: boolean;
};

/**
 * Supported CLI languages
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'ja', 'ch'] as const;

/**
 * Supported conflict resolution strategies
 */
export const CONFLICT_RESOLUTION_STRATEGIES: readonly ConflictResolutionStrategy[] = [
  'backup', 'merge', 'skip', 'overwrite'
] as const;

/**
 * Validation error details
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly received?: unknown;
  readonly expected?: readonly string[];
}

/**
 * CLI validation result
 */
export interface CliValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly validatedOptions?: ValidatedInitOptions;
}
