/**
 * Dynamic template processing and variable replacement module
 * Extracted from BaseGenerator for single responsibility principle
 * Consolidates duplicate logic from shared-processor.ts
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../../utils/file-utils';
import { ErrorHandler } from '../../utils/error-handler';
import { TemplateResolver } from './template-resolver';
import {
  TemplateNotFoundError,
  DynamicTemplateError,
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  UnsupportedLanguageError
} from '../errors';
import {
  TypeGuards,
  DEFAULT_VALUES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type SupportedTool,
  type StrictToolConfiguration,
  type StrictLanguageConfiguration
} from '../types';
import { type GenerateFilesOptions } from '../base';
import { ConfigurationManager } from '../config-manager';

/**
 * Context for template processing operations
 */
interface TemplateContext {
  readonly toolConfig: StrictToolConfiguration;
  readonly languageConfig: StrictLanguageConfiguration;
  readonly options?: GenerateFilesOptions;
}

/**
 * Handles dynamic template processing, variable replacement, and glob generation
 * Responsibility: Load and process dynamic templates with tool-specific customization
 */
export class DynamicTemplateProcessor {
  
  constructor(
    private readonly templatesDir: string,
    private readonly templateResolver: TemplateResolver
  ) {}

  /**
   * Load dynamic template from core templates with tool-specific customization
   * Main entry point for dynamic template processing
   */
  async loadDynamicTemplate(
    templateName: string, 
    toolConfigName: string,
    options?: GenerateFilesOptions
  ): Promise<string> {
    const lang = this.validateLanguage(options?.lang);
    
    try {
      const coreTemplate = await this.loadCoreTemplate(templateName, lang);
      const toolConfig = await this.loadAndValidateToolConfig(toolConfigName, templateName);
      const languageConfig = await this.loadAndValidateLanguageConfig(toolConfig, options, templateName);
      
      return this.processTemplate(coreTemplate, toolConfig, languageConfig, options);
      
    } catch (error) {
      return this.handleLoadingError(error, templateName);
    }
  }

  /**
   * Apply advanced dynamic replacements using tool and language configurations
   * Central processing logic for template variable substitution
   */
  applyDynamicReplacements(template: string, context: TemplateContext): string {
    let result = template;
    
    // Validate inputs with type guards
    if (!TypeGuards.isStrictToolConfiguration(context.toolConfig)) {
      throw new Error('Invalid tool configuration passed to applyDynamicReplacements');
    }
    
    if (!TypeGuards.isStrictLanguageConfiguration(context.languageConfig)) {
      throw new Error('Invalid language configuration passed to applyDynamicReplacements');
    }
    
    // 1. Project name replacement
    if (context.options?.projectName) {
      result = result.replace(/\{\{projectName\}\}/g, context.options.projectName);
    }
    
    // 2. Remove tool name placeholders (tool-specific naming removed)
    result = result.replace(/\{\{toolName\}\}/g, '');
    
    // 3. Dynamic globs replacement with enhanced type safety
    const dynamicGlobs = DynamicTemplateProcessor.generateDynamicGlobs(context.toolConfig, context.languageConfig);
    const globsJson = JSON.stringify(dynamicGlobs, null, 2).replace(/"/g, '\\"');
    result = result.replace(/\{\{dynamicGlobs\}\}/g, globsJson);
    
    // 4. Remove tool-specific features placeholders
    result = result.replace(/\{\{toolSpecificFeatures\}\}/g, '');
    
    // 5. Remove additional instructions placeholders
    result = result.replace(/\{\{additionalInstructions\}\}/g, '');
    
    // 6. File extension replacement with type validation
    if (context.toolConfig.fileExtension && context.toolConfig.fileExtension.startsWith('.')) {
      result = result.replace(/\{\{fileExtension\}\}/g, context.toolConfig.fileExtension);
    }
    
    // 7. Apply existing template variable replacements
    return this.replaceTemplateVariables(result, context.options || {});
  }

  /**
   * Generate dynamic globs by merging language config and tool-specific additions
   * CONSOLIDATED: Eliminates duplicate logic from shared-processor.ts
   */
  static generateDynamicGlobs(
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
   * Validate language parameter
   */
  private validateLanguage(lang?: string): SupportedLanguage {
    const validatedLang = lang || DEFAULT_VALUES.LANGUAGE;
    
    if (!TypeGuards.isSupportedLanguage(validatedLang)) {
      throw new UnsupportedLanguageError(validatedLang, [...SUPPORTED_LANGUAGES]);
    }
    
    return validatedLang;
  }

  /**
   * Load core template file
   */
  private async loadCoreTemplate(templateName: string, lang: SupportedLanguage): Promise<string> {
    const coreTemplatePath = join(__dirname, '../../../templates/core', lang, templateName);
    
    if (!await FileUtils.fileExists(coreTemplatePath)) {
      const coreDir = join(__dirname, '../../../templates/core', lang);
      if (!await FileUtils.fileExists(coreDir)) {
        throw new TemplateNotFoundError(templateName, lang, [coreDir]);
      }
      throw new TemplateNotFoundError(templateName, lang, [coreTemplatePath]);
    }
    
    try {
      return await readFile(coreTemplatePath, 'utf-8');
    } catch (error) {
      throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Load and validate tool configuration
   */
  private async loadAndValidateToolConfig(toolConfigName: string, templateName: string): Promise<StrictToolConfiguration> {
    try {
      const rawToolConfig = await this.loadToolConfig(toolConfigName);
      
      if (!TypeGuards.isStrictToolConfiguration(rawToolConfig)) {
        throw new ConfigurationValidationError(
          'tool', 
          toolConfigName, 
          ['Configuration does not match StrictToolConfiguration schema']
        );
      }
      
      return rawToolConfig;
    } catch (error) {
      // Re-throw specific configuration errors
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof TemplateNotFoundError) {
        throw error;
      }
      throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Load and validate language configuration
   */
  private async loadAndValidateLanguageConfig(
    toolConfig: StrictToolConfiguration, 
    options?: GenerateFilesOptions,
    templateName?: string
  ): Promise<StrictLanguageConfiguration> {
    const languageName = options?.languageConfig || toolConfig.globs?.inherit || 'universal';
    
    try {
      const rawLanguageConfig = await ConfigurationManager.loadLanguageConfig(languageName);
      
      if (!TypeGuards.isStrictLanguageConfiguration(rawLanguageConfig)) {
        throw new ConfigurationValidationError(
          'language', 
          languageName, 
          ['Configuration does not match StrictLanguageConfiguration schema']
        );
      }
      
      return rawLanguageConfig;
    } catch (error) {
      // Re-throw specific configuration errors to preserve type information
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError ||
          error instanceof TemplateNotFoundError) {
        throw error;
      }
      // Only wrap generic errors as DynamicTemplateError
      throw new DynamicTemplateError(templateName || 'unknown', 'loading', ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Process template with configurations
   */
  private processTemplate(
    coreTemplate: string,
    toolConfig: StrictToolConfiguration,
    languageConfig: StrictLanguageConfiguration,
    options?: GenerateFilesOptions
  ): string {
    const context: TemplateContext = {
      toolConfig,
      languageConfig,
      options: options || {}
    };
    return this.applyDynamicReplacements(coreTemplate, context);
  }

  /**
   * Handle loading errors
   */
  private handleLoadingError(error: unknown, templateName: string): never {
    if (error instanceof TemplateNotFoundError || 
        error instanceof DynamicTemplateError ||
        error instanceof ConfigurationNotFoundError ||
        error instanceof ConfigurationValidationError ||
        error instanceof UnsupportedLanguageError) {
      throw error;
    }
    
    const normalizedError = ErrorHandler.normalizeToError(error);
    throw new DynamicTemplateError(templateName, 'loading', normalizedError);
  }

  /**
   * Replace template variables in content
   * Basic variable substitution support
   */
  private replaceTemplateVariables(content: string, options: GenerateFilesOptions): string {
    let processedContent = content;
    
    if (options.projectName) {
      processedContent = processedContent.replace(/\{\{projectName\}\}/g, options.projectName);
    }
    
    return processedContent;
  }

  /**
   * Load tool-specific configuration from JSON file
   * Private helper for configuration loading
   */
  private async loadToolConfig(toolConfigName: string): Promise<StrictToolConfiguration> {
    try {
      // Use ConfigurationManager for enhanced configuration loading
      if (!TypeGuards.isSupportedTool(toolConfigName)) {
        throw new ConfigurationNotFoundError('tool', toolConfigName, 'not a supported tool');
      }
      
      // Type-safe: we've validated toolConfigName is a SupportedTool above
      const configurableConfig = await ConfigurationManager.loadConfigurableToolConfig(toolConfigName);
      
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
          error instanceof ConfigurationValidationError) {
        throw error;
      }
      
      // Handle unexpected errors using type-safe error handling
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new ConfigurationNotFoundError('tool', toolConfigName, normalizedError.message);
    }
  }
}