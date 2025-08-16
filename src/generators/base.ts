/* eslint-disable complexity, sonarjs/cognitive-complexity, max-lines-per-function, max-lines */
// Core generator infrastructure - complex by necessity for template processing

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { ConflictResolution } from '../utils/file-conflict-handler';
import { OutputFormat } from '../converters';
import { ErrorHandler } from '../utils/error-handler';
import { 
  TemplateNotFoundError, 
  TemplateParsingError, 
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  FileSystemError,
  UnsupportedLanguageError,
  DynamicTemplateError 
} from './errors';
import {
  type StrictToolConfiguration,
  type StrictLanguageConfiguration,
  type StrictGenerateFilesOptions,
  type SupportedTool,
  TypeGuards,
  SUPPORTED_LANGUAGES,
  DEFAULT_VALUES
} from './types';
import { 
  ConfigurationManager, 
  type ConfigurableToolConfig, 
  type FileStructureConfig 
} from './config-manager';
import { TemplateResolver, FileStructureBuilder } from './modules';

/**
 * Convert string to ConflictResolution enum
 * @param resolution - String representation of conflict resolution strategy
 * @returns ConflictResolution enum value
 */
function stringToConflictResolution(resolution: string): ConflictResolution {
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

  constructor(toolConfig: ToolConfig) {
    this.toolConfig = toolConfig;
    this.templateDir = join(__dirname, '../../templates', toolConfig.templateDir);
    this.templateResolver = new TemplateResolver(this.templateDir);
    this.fileStructureBuilder = new FileStructureBuilder();
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
   * TDD Implementation: Green Phase - Minimal implementation to make tests pass
   */
  async loadDynamicTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    // Enhanced type validation
    const lang = options?.lang || DEFAULT_VALUES.LANGUAGE;
    
    if (!TypeGuards.isSupportedLanguage(lang)) {
      throw new UnsupportedLanguageError(lang, [...SUPPORTED_LANGUAGES]);
    }
    
    try {
      // Phase 1: Load core template
      const coreTemplatePath = join(__dirname, '../../templates/core', lang, templateName);
      let coreTemplate: string;
      
      // Check if core template exists
      if (!await FileUtils.fileExists(coreTemplatePath)) {
        // Handle missing core template directory
        const coreDir = join(__dirname, '../../templates/core', lang);
        if (!await FileUtils.fileExists(coreDir)) {
          throw new TemplateNotFoundError(templateName, lang, [coreDir]);
        }
        throw new TemplateNotFoundError(templateName, lang, [coreTemplatePath]);
      }
      
      try {
        coreTemplate = await readFile(coreTemplatePath, 'utf-8');
      } catch (error) {
        throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
      }
      
      // Phase 2: Load tool-specific configuration with validation
      let toolConfig: StrictToolConfiguration;
      try {
        const rawToolConfig = await this.loadToolConfig();
        
        if (!TypeGuards.isStrictToolConfiguration(rawToolConfig)) {
          throw new ConfigurationValidationError(
            'tool', 
            this.toolConfig.name, 
            ['Configuration does not match StrictToolConfiguration schema']
          );
        }
        
        toolConfig = rawToolConfig;
      } catch (error) {
        throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
      }
      
      // Phase 3: Load language configuration with validation
      const languageName = options?.languageConfig || toolConfig.globs?.inherit || 'universal';
      let languageConfig: StrictLanguageConfiguration;
      try {
        const rawLanguageConfig = await this.loadLanguageConfig(languageName);
        
        if (!TypeGuards.isStrictLanguageConfiguration(rawLanguageConfig)) {
          throw new ConfigurationValidationError(
            'language', 
            languageName, 
            ['Configuration does not match StrictLanguageConfiguration schema']
          );
        }
        
        languageConfig = rawLanguageConfig;
      } catch (error) {
        throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
      }
      
      // Phase 4: Apply dynamic replacements with enhanced type safety
      try {
        return this.applyDynamicReplacements(coreTemplate, toolConfig, languageConfig, options);
      } catch (error) {
        throw new DynamicTemplateError(templateName, 'processing', ErrorHandler.normalizeToError(error));
      }
      
    } catch (error) {
      // Re-throw our specific errors
      if (error instanceof TemplateNotFoundError || 
          error instanceof DynamicTemplateError ||
          error instanceof ConfigurationNotFoundError ||
          error instanceof ConfigurationValidationError ||
          error instanceof UnsupportedLanguageError) {
        throw error;
      }
      
      // Handle unexpected errors using type-safe error handling
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new DynamicTemplateError(templateName, 'loading', normalizedError);
    }
  }

  /**
   * Apply advanced dynamic replacements using tool and language configurations
   * TDD Implementation: Green Phase - Complete dynamic replacement system
   */
  private applyDynamicReplacements(
    template: string, 
    toolConfig: StrictToolConfiguration, 
    languageConfig: StrictLanguageConfiguration, 
    options?: GenerateFilesOptions
  ): string {
    let result = template;
    
    // Validate inputs with type guards
    if (!TypeGuards.isStrictToolConfiguration(toolConfig)) {
      throw new Error('Invalid tool configuration passed to applyDynamicReplacements');
    }
    
    if (!TypeGuards.isStrictLanguageConfiguration(languageConfig)) {
      throw new Error('Invalid language configuration passed to applyDynamicReplacements');
    }
    
    // 1. Project name replacement (existing)
    if (options?.projectName) {
      result = result.replace(/\{\{projectName\}\}/g, options.projectName);
    }
    
    // 2. Remove tool name placeholders (tool-specific naming removed)
    result = result.replace(/\{\{toolName\}\}/g, '');
    
    // 3. Dynamic globs replacement (NEW) with enhanced type safety
    const dynamicGlobs = this.generateDynamicGlobs(toolConfig, languageConfig);
    const globsJson = JSON.stringify(dynamicGlobs, null, 2).replace(/"/g, '\\"');
    result = result.replace(/\{\{dynamicGlobs\}\}/g, globsJson);
    
    // 4. Remove tool-specific features placeholders (customSections removed)
    result = result.replace(/\{\{toolSpecificFeatures\}\}/g, '');
    
    // 5. Remove additional instructions placeholders (customSections removed)
    result = result.replace(/\{\{additionalInstructions\}\}/g, '');
    
    // 6. File extension replacement (NEW) with type validation
    if (toolConfig.fileExtension && toolConfig.fileExtension.startsWith('.')) {
      result = result.replace(/\{\{fileExtension\}\}/g, toolConfig.fileExtension);
    }
    
    // 7. Apply existing template variable replacements
    return this.replaceTemplateVariables(result, options || {});
  }

  /**
   * Generate dynamic globs by merging language config and tool-specific additions
   * TDD Implementation: Green Phase - Intelligent globs combination
   */
  private generateDynamicGlobs(
    toolConfig: StrictToolConfiguration, 
    languageConfig: StrictLanguageConfiguration
  ): ReadonlyArray<string> {
    // Validate inputs with type safety
    const baseGlobs = [...(languageConfig.globs || [])];
    const additionalGlobs = [...(toolConfig.globs?.additional || [])];
    
    // Combine and deduplicate globs with enhanced type safety
    const allGlobs = [...baseGlobs, ...additionalGlobs];
    const uniqueGlobs = Array.from(new Set(allGlobs));
    
    // Return as readonly array for immutability
    return Object.freeze(uniqueGlobs.sort()); // Sort for consistency
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
      const configurableConfig = await ConfigurationManager.loadConfigurableToolConfig(this.toolConfig.name as SupportedTool);
      
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
      return await ConfigurationManager.loadConfigurableToolConfig(this.toolConfig.name as SupportedTool);
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
   */
  /**
   * Required field validators for tool configuration
   */
  private static readonly TOOL_CONFIG_VALIDATORS = [
    { field: 'displayName', type: 'string', message: 'displayName must be a string' },
    { field: 'fileExtension', type: 'string', message: 'fileExtension must be a string' },  
    { field: 'description', type: 'string', message: 'description must be a string' }
  ];

  /**
   * Validates required fields of tool configuration
   */
  private validateRequiredFields(config: unknown): string[] {
    if (!config || typeof config !== 'object') {
      return ['Configuration must be an object'];
    }
    
    const toolConfig = config as Record<string, unknown>;
    const errors: string[] = [];
    
    for (const validator of BaseGenerator.TOOL_CONFIG_VALIDATORS) {
      if (typeof toolConfig[validator.field] !== validator.type) {
        errors.push(validator.message);
      }
    }
    
    return errors;
  }

  /**
   * Validates globs structure in tool configuration
   */
  private validateGlobsStructure(config: unknown): string[] {
    if (!config || typeof config !== 'object') {
      return ['Configuration must be an object'];
    }
    
    const toolConfig = config as Record<string, unknown>;
    const errors: string[] = [];
    const globs = toolConfig.globs;
    
    if (globs === undefined) return errors;
    
    if (typeof globs !== 'object' || globs === null) {
      errors.push('globs must be an object');
      return errors;
    }
    
    // Type-safe access to globs properties
    const globsRecord = globs as Record<string, unknown>;
    
    if (globsRecord.inherit !== undefined && typeof globsRecord.inherit !== 'string') {
      errors.push('globs.inherit must be a string');
    }
    
    if (globsRecord.additional !== undefined) {
      if (!Array.isArray(globsRecord.additional)) {
        errors.push('globs.additional must be an array');
      } else if (!globsRecord.additional.every(item => typeof item === 'string')) {
        errors.push('globs.additional must be an array of strings');
      }
    }
    
    return errors;
  }

  private validateToolConfiguration(config: unknown): string[] {
    const errors: string[] = [];
    
    // Validate required fields and globs structure
    errors.push(...this.validateRequiredFields(config));
    errors.push(...this.validateGlobsStructure(config));
    
    return errors;
  }

  /**
   * Validate language configuration structure and required fields
   */
  private validateLanguageConfiguration(config: unknown): string[] {
    const errors: string[] = [];
    
    if (typeof config !== 'object' || config === null) {
      errors.push('Configuration must be an object');
      return errors;
    }
    
    const langConfig = config as Record<string, unknown>;
    
    // Validate required fields
    if (!Array.isArray(langConfig.globs)) {
      errors.push('globs must be an array');
    } else {
      if (!langConfig.globs.every(item => typeof item === 'string')) {
        errors.push('globs must be an array of strings');
      }
    }
    
    if (typeof langConfig.description !== 'string') {
      errors.push('description must be a string');
    }
    
    // Validate optional fields
    if (langConfig.languageFeatures !== undefined) {
      if (!Array.isArray(langConfig.languageFeatures)) {
        errors.push('languageFeatures must be an array');
      } else {
        if (!langConfig.languageFeatures.every(item => typeof item === 'string')) {
          errors.push('languageFeatures must be an array of strings');
        }
      }
    }
    
    return errors;
  }

  /**
   * Replace template variables in content
   */
  protected replaceTemplateVariables(content: string, options: GenerateFilesOptions): string {
    let processedContent = content;
    
    if (options.projectName) {
      processedContent = processedContent.replace(/\{\{projectName\}\}/g, options.projectName);
    }
    
    return processedContent;
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