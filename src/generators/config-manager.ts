/**
 * Configuration management for file structures and tool configurations
 * Issue #35: Code Review - Make file structure configurable instead of hard-coded
 */

// Configuration loading with extracted methods for clarity

import { join } from 'path';
import { readFile } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import {
  type SupportedTool,
  type StrictToolConfiguration,
  type StrictLanguageConfiguration,
  TypeGuards,
  OUTPUT_DIRECTORIES
} from './types';
import {
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  TemplateParsingError,
  FileSystemError
} from './errors';
import { ErrorHandler } from '../utils/error-handler';

/**
 * Configuration structure for customizable file generation
 */
export interface FileStructureConfig {
  readonly outputDirectory: string;
  readonly mainFileName?: string | undefined;
  readonly subdirectories: ReadonlyArray<string>;
  readonly fileNamingPattern?: string | undefined;
  readonly includeInstructionsDirectory: boolean;
}

/**
 * Enhanced tool configuration with configurable file structure
 */
export interface ConfigurableToolConfig extends StrictToolConfiguration {
  readonly fileStructure: FileStructureConfig;
  readonly templateMappings?: Record<string, string>;
  readonly customReplacements?: Record<string, string>;
}

/**
 * Configuration manager for handling configurable file structures and tool settings
 */
export class ConfigurationManager {
  private static readonly CONFIG_CACHE = new Map<string, ConfigurableToolConfig>();
  private static readonly LANG_CONFIG_CACHE = new Map<string, StrictLanguageConfiguration>();

  /**
   * Load configurable tool configuration with file structure settings
   */
  static async loadConfigurableToolConfig(toolName: SupportedTool): Promise<ConfigurableToolConfig> {
    const cacheKey = `tool:${toolName}`;
    
    // Check cache first
    const cached = this.getCachedToolConfig(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const config = await this.loadAndProcessToolConfig(toolName);
      this.CONFIG_CACHE.set(cacheKey, config);
      return config;
    } catch (error) {
      return this.handleToolConfigError(error, toolName);
    }
  }

  /**
   * Get cached tool configuration
   */
  private static getCachedToolConfig(cacheKey: string): ConfigurableToolConfig | null {
    return this.CONFIG_CACHE.get(cacheKey) || null;
  }

  /**
   * Load and process tool configuration from file
   */
  private static async loadAndProcessToolConfig(toolName: SupportedTool): Promise<ConfigurableToolConfig> {
    const toolConfigPath = this.getToolConfigPath(toolName);
    
    // Verify file exists
    await this.verifyConfigFileExists(toolConfigPath, toolName);
    
    // Load and parse config
    const parsedConfig = await this.loadAndParseConfigFile(toolConfigPath, toolName);
    
    // Enhance and validate
    const enhancedConfig = this.enhanceToolConfigWithDefaults(parsedConfig, toolName);
    this.validateEnhancedConfig(enhancedConfig, toolName);
    
    return enhancedConfig;
  }

  /**
   * Get tool configuration file path
   */
  private static getToolConfigPath(toolName: SupportedTool): string {
    return join(__dirname, '../../templates/configs/tools', `${toolName}.json`);
  }

  /**
   * Verify configuration file exists
   */
  private static async verifyConfigFileExists(toolConfigPath: string, toolName: SupportedTool): Promise<void> {
    if (!await FileUtils.fileExists(toolConfigPath)) {
      throw new ConfigurationNotFoundError('tool', toolName, toolConfigPath);
    }
  }

  /**
   * Load and parse configuration file
   */
  private static async loadAndParseConfigFile(toolConfigPath: string, toolName: SupportedTool): Promise<StrictToolConfiguration> {
    const configContent = await this.readConfigFile(toolConfigPath);
    return this.parseConfigContent(configContent, toolName);
  }

  /**
   * Read configuration file content
   */
  private static async readConfigFile(toolConfigPath: string): Promise<string> {
    try {
      return await readFile(toolConfigPath, 'utf-8');
    } catch (error) {
      throw new FileSystemError('read', toolConfigPath, ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Parse configuration file content
   */
  private static parseConfigContent(content: string, toolName: SupportedTool): StrictToolConfiguration {
    try {
      return JSON.parse(content) as StrictToolConfiguration;
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new Error(`Failed to parse tool configuration for ${toolName}: ${normalizedError.message}`);
    }
  }

  /**
   * Validate enhanced configuration
   */
  private static validateEnhancedConfig(config: ConfigurableToolConfig, toolName: SupportedTool): void {
    const validationErrors = this.validateConfigurableToolConfig(config);
    if (validationErrors.length > 0) {
      throw new ConfigurationValidationError('tool', toolName, validationErrors);
    }
  }

  /**
   * Handle tool configuration loading errors
   */
  private static handleToolConfigError(error: unknown, toolName: SupportedTool): never {
    if (error instanceof ConfigurationNotFoundError || 
        error instanceof ConfigurationValidationError ||
        error instanceof FileSystemError ||
        error instanceof TemplateParsingError) {
      throw error;
    }
    
    const toolConfigPath = this.getToolConfigPath(toolName);
    const normalizedError = ErrorHandler.normalizeToError(error);
    throw new FileSystemError('load_configurable_tool_config', toolConfigPath, normalizedError);
  }

  /**
   * Load language configuration with caching
   */
  static async loadLanguageConfig(languageName: string): Promise<StrictLanguageConfiguration> {
    const cacheKey = `lang:${languageName}`;
    
    // Check cache first
    const cached = this.getCachedLanguageConfig(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const config = await this.loadAndProcessLanguageConfig(languageName);
      this.LANG_CONFIG_CACHE.set(cacheKey, config);
      return config;
    } catch (error) {
      return this.handleLanguageConfigError(error, languageName);
    }
  }

  /**
   * Get cached language configuration
   */
  private static getCachedLanguageConfig(cacheKey: string): StrictLanguageConfiguration | null {
    return this.LANG_CONFIG_CACHE.get(cacheKey) || null;
  }

  /**
   * Load and process language configuration
   */
  private static async loadAndProcessLanguageConfig(languageName: string): Promise<StrictLanguageConfiguration> {
    const langConfigPath = this.getLanguageConfigPath(languageName);
    
    // Handle fallback to universal config
    if (!await FileUtils.fileExists(langConfigPath)) {
      return this.handleMissingLanguageConfig(languageName);
    }
    
    // Load, parse and validate
    const parsedConfig = await this.loadAndParseLanguageFile(langConfigPath, languageName);
    this.validateLanguageConfig(parsedConfig, languageName);
    
    return parsedConfig as StrictLanguageConfiguration;
  }

  /**
   * Get language configuration file path
   */
  private static getLanguageConfigPath(languageName: string): string {
    return join(__dirname, '../../templates/configs/languages', `${languageName}.json`);
  }

  /**
   * Handle missing language configuration with fallback
   */
  private static async handleMissingLanguageConfig(languageName: string): Promise<StrictLanguageConfiguration> {
    // Fallback to universal configuration for unknown languages
    if (languageName !== 'universal') {
      return this.loadLanguageConfig('universal');
    }
    
    const langConfigPath = this.getLanguageConfigPath(languageName);
    throw new ConfigurationNotFoundError('language', languageName, langConfigPath);
  }

  /**
   * Load and parse language configuration file
   */
  private static async loadAndParseLanguageFile(langConfigPath: string, languageName: string): Promise<unknown> {
    const configContent = await this.readLanguageConfigFile(langConfigPath);
    return this.parseLanguageConfigContent(configContent, languageName);
  }

  /**
   * Read language configuration file
   */
  private static async readLanguageConfigFile(langConfigPath: string): Promise<string> {
    try {
      return await readFile(langConfigPath, 'utf-8');
    } catch (error) {
      throw new FileSystemError('read', langConfigPath, ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Parse language configuration content
   */
  private static parseLanguageConfigContent(content: string, languageName: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new TemplateParsingError(`language config ${languageName}.json`, ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Validate language configuration
   */
  private static validateLanguageConfig(parsedConfig: unknown, languageName: string): void {
    if (!TypeGuards.isStrictLanguageConfiguration(parsedConfig)) {
      throw new ConfigurationValidationError(
        'language', 
        languageName, 
        ['Configuration does not match StrictLanguageConfiguration schema']
      );
    }
  }

  /**
   * Handle language configuration loading errors
   */
  private static handleLanguageConfigError(error: unknown, languageName: string): never {
    if (error instanceof ConfigurationNotFoundError || 
        error instanceof ConfigurationValidationError ||
        error instanceof FileSystemError ||
        error instanceof TemplateParsingError) {
      throw error;
    }
    
    const langConfigPath = this.getLanguageConfigPath(languageName);
    const normalizedError = ErrorHandler.normalizeToError(error);
    throw new FileSystemError('load_language_config', langConfigPath, normalizedError);
  }

  /**
   * Get file structure configuration for a specific tool
   */
  static async getFileStructureConfig(toolName: SupportedTool): Promise<FileStructureConfig> {
    const toolConfig = await this.loadConfigurableToolConfig(toolName);
    return toolConfig.fileStructure;
  }

  /**
   * Create custom file structure configuration
   */
  static createCustomFileStructure(overrides: Partial<FileStructureConfig>): FileStructureConfig {
    const defaults = {
      outputDirectory: '',
      mainFileName: undefined,
      subdirectories: [] as ReadonlyArray<string>,
      fileNamingPattern: undefined,
      includeInstructionsDirectory: true
    };

    // Create final configuration with proper types
    const result: FileStructureConfig = {
      outputDirectory: overrides.outputDirectory ?? defaults.outputDirectory,
      mainFileName: overrides.mainFileName ?? defaults.mainFileName,
      subdirectories: Object.freeze([...(overrides.subdirectories || defaults.subdirectories)]),
      fileNamingPattern: overrides.fileNamingPattern ?? defaults.fileNamingPattern,
      includeInstructionsDirectory: overrides.includeInstructionsDirectory ?? defaults.includeInstructionsDirectory
    };
    
    return result;
  }

  /**
   * Clear configuration caches (useful for testing)
   */
  static clearCache(): void {
    this.CONFIG_CACHE.clear();
    this.LANG_CONFIG_CACHE.clear();
  }

  /**
   * Enhance basic tool config with default file structure settings
   */
  private static enhanceToolConfigWithDefaults(
    baseConfig: StrictToolConfiguration, 
    toolName: SupportedTool
  ): ConfigurableToolConfig {
    // Create default file structure based on tool type
    const defaultFileStructure = this.createDefaultFileStructure(toolName);
    
    return {
      ...baseConfig,
      fileStructure: defaultFileStructure,
      // Add any tool-specific template mappings or custom replacements here
    };
  }

  /**
   * Create default file structure configuration based on tool type
   */
  private static createDefaultFileStructure(toolName: SupportedTool): FileStructureConfig {
    const outputDirectory = OUTPUT_DIRECTORIES[toolName] || '';
    const mainFileName = this.getDefaultMainFileName(toolName);
    const subdirectories = this.getDefaultSubdirectories(toolName);
    
    // Build configuration with proper types including explicit undefined handling
    const config: FileStructureConfig = {
      outputDirectory,
      mainFileName: mainFileName ?? undefined,
      subdirectories: Object.freeze(subdirectories),
      fileNamingPattern: undefined,
      includeInstructionsDirectory: true
    };
    
    return config;
  }

  /**
   * Get default main file name for a tool
   */
  private static getDefaultMainFileName(toolName: SupportedTool): string | undefined {
    switch (toolName) {
      case 'claude':
        return 'CLAUDE.md';
      case 'cursor':
        return 'main.mdc';
      case 'github-copilot':
        return 'copilot-instructions.md';
      case 'windsurf':
        return '.windsurfrules';
      case 'cline':
        return undefined; // Cline uses multiple files, not a single main file
      default:
        return undefined;
    }
  }

  /**
   * Get default subdirectories for a tool
   */
  private static getDefaultSubdirectories(toolName: SupportedTool): string[] {
    switch (toolName) {
      case 'claude':
        return ['instructions'];
      case 'cursor':
        return [];
      case 'github-copilot':
        return [];
      case 'cline':
        return ['instructions']; // Cline generates .clinerules files + shared instructions
      case 'windsurf':
        return [];
      default:
        return [];
    }
  }

  /**
   * Validate file structure subdirectories
   */
  private static validateSubdirectories(subdirectories: unknown): string | null {
    if (!Array.isArray(subdirectories)) {
      return 'fileStructure.subdirectories must be an array';
    }
    if (!subdirectories.every(dir => typeof dir === 'string')) {
      return 'fileStructure.subdirectories must be an array of strings';
    }
    return null;
  }

  /**
   * Validate file structure fields
   */
  private static validateFileStructureFields(fs: FileStructureConfig): string[] {
    const errors: string[] = [];
    
    if (typeof fs.outputDirectory !== 'string') {
      errors.push('fileStructure.outputDirectory must be a string');
    }
    
    if (fs.mainFileName !== undefined && typeof fs.mainFileName !== 'string') {
      errors.push('fileStructure.mainFileName must be a string or undefined');
    }
    
    const subdirError = this.validateSubdirectories(fs.subdirectories);
    if (subdirError) errors.push(subdirError);
    
    if (typeof fs.includeInstructionsDirectory !== 'boolean') {
      errors.push('fileStructure.includeInstructionsDirectory must be a boolean');
    }
    
    return errors;
  }

  /**
   * Validate configurable tool configuration
   */
  private static validateConfigurableToolConfig(config: ConfigurableToolConfig): string[] {
    const errors: string[] = [];
    
    // Validate base configuration
    if (!TypeGuards.isStrictToolConfiguration(config)) {
      errors.push('Base tool configuration is invalid');
    }
    
    // Validate file structure
    if (!config.fileStructure) {
      errors.push('fileStructure is required');
    } else {
      errors.push(...this.validateFileStructureFields(config.fileStructure));
    }
    
    return errors;
  }
}