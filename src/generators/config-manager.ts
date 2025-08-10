/**
 * Configuration management for file structures and tool configurations
 * Issue #35: Code Review - Make file structure configurable instead of hard-coded
 */

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
    
    if (this.CONFIG_CACHE.has(cacheKey)) {
      return this.CONFIG_CACHE.get(cacheKey)!;
    }

    const toolConfigPath = join(__dirname, '../../templates/configs/tools', `${toolName}.json`);
    
    try {
      if (!await FileUtils.fileExists(toolConfigPath)) {
        throw new ConfigurationNotFoundError('tool', toolName, toolConfigPath);
      }
      
      let configContent: string;
      try {
        configContent = await readFile(toolConfigPath, 'utf-8');
      } catch (error) {
        throw new FileSystemError('read', toolConfigPath, error as Error);
      }
      
      let parsedConfig: unknown;
      try {
        parsedConfig = JSON.parse(configContent);
      } catch (error) {
        throw new Error(`Failed to parse tool configuration for ${toolName}: ${(error as Error).message}`);
      }
      
      // Enhance basic tool config with configurable file structure
      const enhancedConfig = this.enhanceToolConfigWithDefaults(parsedConfig as StrictToolConfiguration, toolName);
      
      // Validate the enhanced configuration
      const validationErrors = this.validateConfigurableToolConfig(enhancedConfig);
      if (validationErrors.length > 0) {
        throw new ConfigurationValidationError('tool', toolName, validationErrors);
      }
      
      // Cache and return
      this.CONFIG_CACHE.set(cacheKey, enhancedConfig);
      return enhancedConfig;
      
    } catch (error) {
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof FileSystemError ||
          error instanceof TemplateParsingError) {
        throw error;
      }
      
      throw new FileSystemError('load_configurable_tool_config', toolConfigPath, error as Error);
    }
  }

  /**
   * Load language configuration with caching
   */
  static async loadLanguageConfig(languageName: string): Promise<StrictLanguageConfiguration> {
    const cacheKey = `lang:${languageName}`;
    
    if (this.LANG_CONFIG_CACHE.has(cacheKey)) {
      return this.LANG_CONFIG_CACHE.get(cacheKey)!;
    }

    const langConfigPath = join(__dirname, '../../templates/configs/languages', `${languageName}.json`);
    
    try {
      if (!await FileUtils.fileExists(langConfigPath)) {
        // Fallback to universal configuration for unknown languages
        if (languageName !== 'universal') {
          return this.loadLanguageConfig('universal');
        }
        throw new ConfigurationNotFoundError('language', languageName, langConfigPath);
      }
      
      let configContent: string;
      try {
        configContent = await readFile(langConfigPath, 'utf-8');
      } catch (error) {
        throw new FileSystemError('read', langConfigPath, error as Error);
      }
      
      let parsedConfig: unknown;
      try {
        parsedConfig = JSON.parse(configContent);
      } catch (error) {
        throw new TemplateParsingError(`language config ${languageName}.json`, error as Error);
      }
      
      // Validate the configuration
      if (!TypeGuards.isStrictLanguageConfiguration(parsedConfig)) {
        throw new ConfigurationValidationError(
          'language', 
          languageName, 
          ['Configuration does not match StrictLanguageConfiguration schema']
        );
      }
      
      const config = parsedConfig as StrictLanguageConfiguration;
      
      // Cache and return
      this.LANG_CONFIG_CACHE.set(cacheKey, config);
      return config;
      
    } catch (error) {
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof FileSystemError ||
          error instanceof TemplateParsingError) {
        throw error;
      }
      
      throw new FileSystemError('load_language_config', langConfigPath, error as Error);
    }
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
      mainFileName: undefined as string | undefined,
      subdirectories: [] as ReadonlyArray<string>,
      fileNamingPattern: undefined as string | undefined,
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
      const fs = config.fileStructure;
      
      if (typeof fs.outputDirectory !== 'string') {
        errors.push('fileStructure.outputDirectory must be a string');
      }
      
      if (fs.mainFileName !== undefined && typeof fs.mainFileName !== 'string') {
        errors.push('fileStructure.mainFileName must be a string or undefined');
      }
      
      if (!Array.isArray(fs.subdirectories)) {
        errors.push('fileStructure.subdirectories must be an array');
      } else if (!fs.subdirectories.every(dir => typeof dir === 'string')) {
        errors.push('fileStructure.subdirectories must be an array of strings');
      }
      
      if (typeof fs.includeInstructionsDirectory !== 'boolean') {
        errors.push('fileStructure.includeInstructionsDirectory must be a boolean');
      }
    }
    
    return errors;
  }
}