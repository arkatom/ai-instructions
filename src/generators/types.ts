/**
 * Enhanced type definitions for improved type safety
 * Issue #35: Code Review - Enhance type safety with proper enums/const assertions
 */

// Type validation functions with extracted helper methods for clarity

import { includesStringLiteral } from '../utils/array-helpers';

/**
 * Supported language codes with proper const assertion
 */
export const SUPPORTED_LANGUAGES = ['en', 'ja', 'ch'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Supported AI tools with proper const assertion
 */
export const SUPPORTED_TOOLS = ['claude', 'cursor', 'github-copilot', 'cline', 'windsurf'] as const;
export type SupportedTool = typeof SUPPORTED_TOOLS[number];

/**
 * Template processing phases
 */
export const TEMPLATE_PHASES = ['loading', 'processing', 'replacement', 'validation'] as const;
export type TemplatePhase = typeof TEMPLATE_PHASES[number];

/**
 * Configuration types  
 */
export const CONFIG_TYPES = ['tool', 'language'] as const;
export type ConfigurationType = typeof CONFIG_TYPES[number];

/**
 * File system operations
 */
export const FILE_OPERATIONS = ['read', 'write', 'copy', 'mkdir', 'stat'] as const;
export type FileOperation = typeof FILE_OPERATIONS[number];

/**
 * Enhanced tool configuration with strict typing
 */
export interface StrictToolConfiguration {
  readonly displayName: string;
  readonly fileExtension: `.${string}`; // Enforce dot prefix
  readonly globs: {
    readonly inherit: string;
    readonly additional?: ReadonlyArray<string>;
  };
  readonly description: string;
}

/**
 * Enhanced language configuration with strict typing
 */
export interface StrictLanguageConfiguration {
  readonly globs: ReadonlyArray<string>;
  readonly description: string;
  readonly languageFeatures: ReadonlyArray<string>;
}

/**
 * Enhanced output structure with strict typing
 */
export interface StrictOutputStructure {
  readonly mainFile?: string;
  readonly directory?: string;
}

/**
 * Enhanced tool config with strict typing
 */
export interface StrictToolConfig {
  readonly name: SupportedTool;
  readonly templateDir: string;
  readonly outputStructure: StrictOutputStructure;
}

/**
 * Enhanced generation options with strict typing
 */
export interface StrictGenerateFilesOptions {
  readonly projectName?: string;
  readonly force?: boolean;
  readonly lang?: SupportedLanguage;
  readonly outputFormat?: SupportedTool;
  readonly conflictResolution?: string;
  readonly interactive?: boolean;
  readonly backup?: boolean;
  readonly languageConfig?: string;
}

/**
 * Template replacement context
 */
export interface TemplateContext {
  readonly projectName: string;
  readonly toolName: string;
  readonly lang: SupportedLanguage;
  readonly fileExtension: string;
  readonly dynamicGlobs: ReadonlyArray<string>;
  readonly toolSpecificFeatures: string;
  readonly additionalInstructions: string;
}

/**
 * Error context for enhanced error reporting
 */
export interface ErrorContext {
  readonly operation: FileOperation;
  readonly path: string;
  readonly lang?: SupportedLanguage;
  readonly tool?: SupportedTool;
  readonly phase?: TemplatePhase;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings?: ReadonlyArray<string>;
}

/**
 * Type guards for runtime type checking
 * Uses type-safe array helpers to avoid type assertions
 */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return includesStringLiteral(SUPPORTED_LANGUAGES, value);
}

export function isSupportedTool(value: unknown): value is SupportedTool {
  return includesStringLiteral(SUPPORTED_TOOLS, value);
}

export function isTemplatePhase(value: unknown): value is TemplatePhase {
  return includesStringLiteral(TEMPLATE_PHASES, value);
}

export function isConfigurationType(value: unknown): value is ConfigurationType {
  return includesStringLiteral(CONFIG_TYPES, value);
}

export function isFileOperation(value: unknown): value is FileOperation {
  return includesStringLiteral(FILE_OPERATIONS, value);
}

export function isStrictToolConfiguration(value: unknown): value is StrictToolConfiguration {
  if (!TypeValidationHelpers.isNonNullObject(value)) return false;
  
  return TypeValidationHelpers.hasValidDisplayName(value) &&
         TypeValidationHelpers.hasValidFileExtension(value) &&
         TypeValidationHelpers.hasValidGlobsObject(value) &&
         TypeValidationHelpers.hasValidDescription(value);
}

export function isStrictLanguageConfiguration(value: unknown): value is StrictLanguageConfiguration {
  if (!TypeValidationHelpers.isNonNullObject(value)) return false;
  
  return TypeValidationHelpers.hasValidGlobsArray(value) &&
         TypeValidationHelpers.hasValidDescription(value) &&
         TypeValidationHelpers.hasValidLanguageFeatures(value);
}

/**
 * Type validation helper methods
 */
class TypeValidationHelpers {
  /**
   * Check if value is a non-null object
   */
  static isNonNullObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Check if object has valid displayName property
   */
  static hasValidDisplayName(obj: Record<string, unknown>): boolean {
    return 'displayName' in obj && typeof obj.displayName === 'string';
  }

  /**
   * Check if object has valid fileExtension property
   */
  static hasValidFileExtension(obj: Record<string, unknown>): boolean {
    return 'fileExtension' in obj && 
           typeof obj.fileExtension === 'string' && 
           obj.fileExtension.startsWith('.');
  }

  /**
   * Check if object has valid globs object property
   */
  static hasValidGlobsObject(obj: Record<string, unknown>): boolean {
    if (!('globs' in obj) || typeof obj.globs !== 'object' || obj.globs === null) {
      return false;
    }
    
    const globs = obj.globs as Record<string, unknown>;
    return 'inherit' in globs && typeof globs.inherit === 'string';
  }

  /**
   * Check if object has valid description property
   */
  static hasValidDescription(obj: Record<string, unknown>): boolean {
    return 'description' in obj && typeof obj.description === 'string';
  }

  /**
   * Check if object has valid globs array property
   */
  static hasValidGlobsArray(obj: Record<string, unknown>): boolean {
    if (!('globs' in obj) || !Array.isArray(obj.globs)) {
      return false;
    }
    
    return obj.globs.every((item: unknown) => typeof item === 'string');
  }

  /**
   * Check if object has valid languageFeatures property
   */
  static hasValidLanguageFeatures(obj: Record<string, unknown>): boolean {
    if (!('languageFeatures' in obj) || !Array.isArray(obj.languageFeatures)) {
      return false;
    }
    
    return obj.languageFeatures.every((item: unknown) => typeof item === 'string');
  }
}

/**
 * Type guards collection for backward compatibility
 */
export const TypeGuards = {
  isSupportedLanguage,
  isSupportedTool,
  isTemplatePhase,
  isConfigurationType,
  isFileOperation,
  isStrictToolConfiguration,
  isStrictLanguageConfiguration
} as const;

/**
 * Constants with proper readonly assertions
 */
export const DEFAULT_VALUES = {
  LANGUAGE: 'en' as const,
  PROJECT_NAME: 'ai-project' as const,
  FORCE: false as const,
  INTERACTIVE: true as const,
  BACKUP: true as const,
} as const;

/**
 * File extension mappings with strict typing
 */
export const FILE_EXTENSIONS: Record<SupportedTool, `.${string}`> = {
  claude: '.md',
  cursor: '.mdc', 
  'github-copilot': '.md',
  cline: '.md',
  windsurf: '.windsurfrules'
} as const;

/**
 * Output directory mappings with strict typing
 */
export const OUTPUT_DIRECTORIES: Record<SupportedTool, string> = {
  claude: '',
  cursor: '.cursor/rules',
  'github-copilot': '.github',
  cline: '.clinerules', 
  windsurf: ''
} as const;

/**
 * Template directory mappings with strict typing
 */
export const TEMPLATE_DIRECTORIES: Record<SupportedTool, string> = {
  claude: 'core',
  cursor: 'core',
  'github-copilot': 'core',
  cline: 'core',
  windsurf: 'core'
} as const;