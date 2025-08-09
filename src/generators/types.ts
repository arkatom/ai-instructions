/**
 * Enhanced type definitions for improved type safety
 * Issue #35: Code Review - Enhance type safety with proper enums/const assertions
 */

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
 */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function isSupportedTool(value: unknown): value is SupportedTool {
  return typeof value === 'string' && SUPPORTED_TOOLS.includes(value as SupportedTool);
}

export function isTemplatePhase(value: unknown): value is TemplatePhase {
  return typeof value === 'string' && TEMPLATE_PHASES.includes(value as TemplatePhase);
}

export function isConfigurationType(value: unknown): value is ConfigurationType {
  return typeof value === 'string' && CONFIG_TYPES.includes(value as ConfigurationType);
}

export function isFileOperation(value: unknown): value is FileOperation {
  return typeof value === 'string' && FILE_OPERATIONS.includes(value as FileOperation);
}

export function isStrictToolConfiguration(value: unknown): value is StrictToolConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as Record<string, unknown>;
  return (
    typeof config.displayName === 'string' &&
    typeof config.fileExtension === 'string' &&
    config.fileExtension.startsWith('.') &&
    typeof config.globs === 'object' &&
    config.globs !== null &&
    typeof (config.globs as Record<string, unknown>).inherit === 'string' &&
    typeof config.description === 'string'
  );
}

export function isStrictLanguageConfiguration(value: unknown): value is StrictLanguageConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as Record<string, unknown>;
  return (
    Array.isArray(config.globs) &&
    config.globs.every(item => typeof item === 'string') &&
    typeof config.description === 'string' &&
    Array.isArray(config.languageFeatures) &&
    config.languageFeatures.every(item => typeof item === 'string')
  );
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