// Core generator infrastructure - modular architecture implementation

import { readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { ConflictResolution } from '../utils/file-conflict-handler';
import { OutputFormat } from '../converters';
import { ErrorHandler } from '../utils/error-handler';
import {
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  FileSystemError,
  TemplateParsingError
} from './errors';
import {
  type StrictToolConfiguration,
  type StrictLanguageConfiguration,
  type StrictGenerateFilesOptions,
  TypeGuards
} from './types';
import { 
  ConfigurationManager, 
  type ConfigurableToolConfig, 
  type FileStructureConfig 
} from './config-manager';
import { TemplateResolver, FileStructureBuilder, DynamicTemplateProcessor } from './modules';
import { ValidationHelper } from './validation-helper';

/**
 * Convert string to ConflictResolution enum
 * @param resolution - String representation of conflict resolution strategy
 * @returns ConflictResolution enum value
 */
export function stringToConflictResolution(resolution: string): ConflictResolution {
  switch (resolution?.toLowerCase()) {
    case 'backup': return ConflictResolution.BACKUP;
    case 'merge': return ConflictResolution.MERGE;
    case 'interactive': return ConflictResolution.INTERACTIVE;
    case 'skip': return ConflictResolution.SKIP;
    case 'overwrite': return ConflictResolution.OVERWRITE;
    default: return ConflictResolution.BACKUP; // Safe default
  }
}

/**
 * Tool configuration structure (backward compatible)
 * @deprecated Use StrictToolConfiguration for enhanced type safety
 */
export type ToolConfiguration = StrictToolConfiguration;

/**
 * Language configuration structure (backward compatible)
 * @deprecated Use StrictLanguageConfiguration for enhanced type safety
 */
export type LanguageConfiguration = StrictLanguageConfiguration;

/**
 * Options for file generation (backward compatible)
 * @deprecated Use StrictGenerateFilesOptions for enhanced type safety
 */
export interface GenerateFilesOptions extends Omit<StrictGenerateFilesOptions, 'lang' | 'outputFormat'> {
  lang?: 'en' | 'ja' | 'ch';  // Issue #11: Multi-language support
  outputFormat?: OutputFormat;  // Issue #19: Multi-format output support
}

/**
 * Configuration for each AI tool
 */
/**
 * Configuration for each AI tool (backward compatible)  
 * @deprecated Use StrictToolConfig for enhanced type safety
 */
export interface ToolConfig {
  name: string;
  templateDir: string;
  outputStructure: {
    mainFile?: string;
    directory?: string;
  };
}

/**
 * Abstract base class for AI instruction generators
 */
export abstract class BaseGenerator {
  protected templateDir: string;
  protected toolConfig: ToolConfig;
  private templateResolver: TemplateResolver;
  private fileStructureBuilder: FileStructureBuilder;
  private dynamicTemplateProcessor: DynamicTemplateProcessor;

  constructor(toolConfig: ToolConfig) {
    this.toolConfig = toolConfig;
    this.templateDir = join(__dirname, '../../templates', toolConfig.templateDir);
    this.templateResolver = new TemplateResolver(this.templateDir);
    this.fileStructureBuilder = new FileStructureBuilder();
    this.dynamicTemplateProcessor = new DynamicTemplateProcessor(this.templateDir, this.templateResolver);
  }

  /**
   * Load template file content
   * Delegates to TemplateResolver for modular architecture
   */

  async loadTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    return this.templateResolver.loadTemplate(templateName, options);
  }

  /**
   * Load dynamic template from core templates with tool-specific customization
   * Delegates to DynamicTemplateProcessor for modular architecture
   */
  async loadDynamicTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    return this.dynamicTemplateProcessor.loadDynamicTemplate(templateName, this.toolConfig.name, options);
  }



  /**
   * Get display name for the tool (helper method for dynamic template generation)
   */
  private getToolDisplayName(): string {
    switch (this.toolConfig.name) {
      case 'cursor':
        return 'Cursor AI';
      case 'github-copilot':
        return 'GitHub Copilot';
      case 'claude':
        return 'Claude AI';
      default:
        return this.toolConfig.name;
    }
  }

  /**
   * Load tool-specific configuration from JSON file
   * TDD Implementation: Green Phase - Configuration loading support
   */
  async loadToolConfig(): Promise<StrictToolConfiguration> {
    try {
      // Use ConfigurationManager for enhanced configuration loading
      if (!TypeGuards.isSupportedTool(this.toolConfig.name)) {
        throw new ConfigurationNotFoundError('tool', this.toolConfig.name, 'not a supported tool');
      }
      
      // Type-safe: we've validated this.toolConfig.name is a SupportedTool above
      const configurableConfig = await ConfigurationManager.loadConfigurableToolConfig(this.toolConfig.name);
      
      // Return the base tool configuration (without file structure for backward compatibility)
      return {
        displayName: configurableConfig.displayName,
        fileExtension: configurableConfig.fileExtension,
        globs: configurableConfig.globs,
        description: configurableConfig.description
      };
      
    } catch (error) {
      // Re-throw our specific errors
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof FileSystemError ||
          error instanceof TemplateParsingError) {
        throw error;
      }
      
      // Handle unexpected errors using type-safe error handling
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new FileSystemError('load_tool_config', `tool:${this.toolConfig.name}`, normalizedError);
    }
  }

  /**
   * Load language-specific configuration from JSON file
   * TDD Implementation: Green Phase - Language configuration support
   */
  async loadLanguageConfig(languageName: string): Promise<StrictLanguageConfiguration> {
    try {
      // Use ConfigurationManager for enhanced configuration loading with caching
      return await ConfigurationManager.loadLanguageConfig(languageName);
      
    } catch (error) {
      // Re-throw our specific errors
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof FileSystemError ||
          error instanceof TemplateParsingError) {
        throw error;
      }
      
      // Handle unexpected errors using type-safe error handling
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new FileSystemError('load_language_config', languageName, normalizedError);
    }
  }

  /**
   * Get configurable file structure for this tool
   * Delegates to FileStructureBuilder for modular architecture
   */
  async getFileStructureConfig(): Promise<FileStructureConfig> {
    return this.fileStructureBuilder.getFileStructureConfig(this.toolConfig.name);
  }

  /**
   * Get configurable tool configuration with enhanced settings
   */
  async getConfigurableToolConfig(): Promise<ConfigurableToolConfig> {
    try {
      if (!TypeGuards.isSupportedTool(this.toolConfig.name)) {
        throw new ConfigurationNotFoundError('tool', this.toolConfig.name, 'not a supported tool');
      }
      
      // Type-safe: we've validated this.toolConfig.name is a SupportedTool above
      return await ConfigurationManager.loadConfigurableToolConfig(this.toolConfig.name);
    } catch (error) {
      // Re-throw configuration errors
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError) {
        throw error;
      }
      
      // Handle other errors using type-safe error handling
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new FileSystemError('load_configurable_tool_config', this.toolConfig.name, normalizedError);
    }
  }

  /**
   * Generate output directory structure based on configurable file structure
   * Delegates to FileStructureBuilder for modular architecture
   */
  async generateOutputDirectoryStructure(baseOutputDir: string): Promise<string[]> {
    return this.fileStructureBuilder.generateOutputDirectoryStructure(this.toolConfig, baseOutputDir);
  }

  /**
   * Validate tool configuration structure and required fields
   * Delegates to ValidationHelper for centralized validation logic
   */
  private validateToolConfiguration(config: unknown): string[] {
    return ValidationHelper.validateToolConfiguration(config);
  }

  /**
   * Validate language configuration structure and required fields
   * Delegates to ValidationHelper for centralized validation logic
   */
  private validateLanguageConfiguration(config: unknown): string[] {
    return ValidationHelper.validateLanguageConfiguration(config);
  }


  /**
   * Get instruction files from template directory
   */
  async getInstructionFiles(): Promise<string[]> {
    try {
      const instructionsPath = join(this.templateDir, 'instructions');
      const files = await readdir(instructionsPath);
      return files.filter(file => file.endsWith('.md'));
    } catch {
      throw new Error('Instructions directory not found');
    }
  }

  /**
   * Generate files for the specific AI tool
   * Must be implemented by concrete classes
   */
  abstract generateFiles(targetDir: string, options?: GenerateFilesOptions): Promise<void>;

  /**
   * 🚨 EMERGENCY PATCH v0.2.1: Safe file writing with conflict warnings
   * 🚀 v0.5.0: Enhanced with advanced conflict resolution (Issue #26)
   */
  protected async safeWriteFile(targetPath: string, content: string, force: boolean = false, options?: GenerateFilesOptions): Promise<void> {
    if (options && (options.conflictResolution || options.interactive !== undefined || options.backup !== undefined)) {
      // Use advanced file writing with conflict resolution
      const { conflictResolution, interactive, backup } = options;
      await FileUtils.writeFileContentAdvanced(targetPath, content, {
        force,
        interactive: interactive !== false,
        defaultResolution: conflictResolution ? stringToConflictResolution(conflictResolution) : ConflictResolution.BACKUP,
        backup: backup !== false
      });
    } else {
      // Fallback to legacy safe writing for backward compatibility
      await FileUtils.writeFileContentSafe(targetPath, content, force);
    }
  }

  /**
   * Get tool name
   */
  getToolName(): string {
    return this.toolConfig.name;
  }
}