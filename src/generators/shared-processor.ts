/**
 * Shared template processing logic for code reuse across generators
 * Issue #35: Code Review - Extract shared template processing logic
 */

/* eslint-disable complexity */
// Template processing requires complex conditional logic

import { join } from 'path';
import { readFile } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { 
  type SupportedLanguage,
  type StrictToolConfiguration,
  type StrictLanguageConfiguration,
  TypeGuards,
  DEFAULT_VALUES
} from './types';
import { type GenerateFilesOptions } from './base';
import { ConfigurationManager } from './config-manager';
import { ParallelGeneratorOperations, ParallelFileGenerator } from './parallel-generator';
import { DynamicTemplateProcessor } from './modules';
import { ErrorHandler } from '../utils/error-handler';
import {
  TemplateNotFoundError,
  TemplateParsingError,
  DynamicTemplateError,
  UnsupportedLanguageError,
  FileSystemError
} from './errors';

/**
 * Template replacement context for shared processing
 */
export interface TemplateReplacementContext {
  readonly projectName: string;
  readonly toolName: string;
  readonly lang: SupportedLanguage;
  readonly fileExtension: string;
  readonly dynamicGlobs: ReadonlyArray<string>;
  readonly customReplacements?: Record<string, string>;
}

/**
 * Shared template processing utilities
 */
export class SharedTemplateProcessor {
  
  /**
   * Load and process dynamic template with shared logic
   */
  static async loadAndProcessDynamicTemplate(
    templateName: string,
    toolName: string,
    options?: GenerateFilesOptions
  ): Promise<string> {
    // Enhanced type validation
    const lang = options?.lang || DEFAULT_VALUES.LANGUAGE;
    
    if (!TypeGuards.isSupportedLanguage(lang)) {
      throw new UnsupportedLanguageError(lang, ['en', 'ja', 'ch']);
    }
    
    try {
      // Phase 1: Load core template
      const coreTemplate = await this.loadCoreTemplate(templateName, lang);
      
      // Phase 2: Load tool configuration first
      const toolConfig = await this.loadToolConfigSafely(toolName);
      
      // Phase 3: Load language configuration using tool config
      const languageConfig = await this.loadLanguageConfigSafely(
        options?.languageConfig || toolConfig.globs?.inherit || 'universal'
      );
      
      // Phase 4: Apply shared template replacements
      return this.applySharedReplacements(coreTemplate, {
        projectName: options?.projectName || 'ai-project',
        toolName: toolConfig.displayName || toolName,
        lang,
        fileExtension: toolConfig.fileExtension || '.md',
        dynamicGlobs: DynamicTemplateProcessor.generateDynamicGlobs(toolConfig, languageConfig),
        customReplacements: this.extractCustomReplacements(options)
      });
      
    } catch (error) {
      if (error instanceof TemplateNotFoundError || 
          error instanceof UnsupportedLanguageError ||
          error instanceof DynamicTemplateError) {
        throw error;
      }
      
      throw new DynamicTemplateError(templateName, 'loading', ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Type-safe extraction of custom replacements from options
   */
  private static extractCustomReplacements(options?: GenerateFilesOptions): Record<string, string> {
    if (!options || typeof options !== 'object') {
      return {};
    }

    // Only extract string properties that could be custom replacements
    const result: Record<string, string> = {};
    const knownOptionKeys = ['projectName', 'force', 'lang', 'outputFormat', 'conflictResolution', 'interactive', 'backup', 'languageConfig'];
    
    for (const [key, value] of Object.entries(options)) {
      if (!knownOptionKeys.includes(key) && typeof value === 'string') {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Apply shared template variable replacements
   */
  static applySharedReplacements(
    template: string,
    context: TemplateReplacementContext
  ): string {
    let result = template;
    
    // Core replacements
    const replacements: Record<string, string> = {
      '{{projectName}}': context.projectName,
      '{{toolName}}': context.toolName,
      '{{fileExtension}}': context.fileExtension,
      '{{dynamicGlobs}}': JSON.stringify(context.dynamicGlobs, null, 2).replace(/"/g, '\\"'),
      '{{toolSpecificFeatures}}': '', // Removed in shared processor
      '{{additionalInstructions}}': '' // Removed in shared processor
    };
    
    // Apply custom replacements if provided
    if (context.customReplacements) {
      Object.assign(replacements, context.customReplacements);
    }
    
    // Apply all replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
    
    return result;
  }
  
  /**
   * Copy instructions directory with shared logic and parallel optimization
   */
  static async copyInstructionsDirectory(
    targetDir: string,
    lang: SupportedLanguage = DEFAULT_VALUES.LANGUAGE,
    options?: GenerateFilesOptions
  ): Promise<void> {
    try {
      // Use parallel operations for better performance
      const stats = await ParallelGeneratorOperations.copyInstructionsDirectoryParallel(
        targetDir, 
        lang, 
        options
      );
      
      // Log performance if in development mode
      if (process.env.NODE_ENV === 'development' && stats.totalTasks > 0) {
        console.warn(`🚀 Copied ${stats.totalTasks} instruction files in ${stats.totalExecutionTimeMs.toFixed(2)}ms`);
      }
      
    } catch (error) {
      throw new FileSystemError('copy_instructions', targetDir, ErrorHandler.normalizeToError(error));
    }
  }
  
  /**
   * Create specialized content for different file types (shared logic)
   */
  static createSpecializedContent(baseContent: string, title: string, toolName?: string): string {
    const header = `# ${title}${toolName ? ` - ${toolName} Integration` : ''}

This file contains specialized development instructions.

---

`;
    
    return header + baseContent;
  }
  
  /**
   * Generate multiple files with shared processing
   */
  static async generateMultipleFiles(
    baseContent: string,
    fileSpecs: ReadonlyArray<{
      filename: string;
      title: string;
      outputPath: string;
    }>,
    options?: GenerateFilesOptions
  ): Promise<void> {
    try {
      // Use parallel generation for better performance
      const templateTasks = fileSpecs.map(spec => {
        const task: {
          templateName: string;
          outputPath: string;
          content: string;
          options?: GenerateFilesOptions;
        } = {
          templateName: spec.filename,
          outputPath: spec.outputPath,
          content: this.createSpecializedContent(baseContent, spec.title)
        };
        
        // Only add options if they exist
        if (options) {
          task.options = options;
        }
        
        return task;
      });
      
      const stats = await ParallelFileGenerator.generateTemplateFilesParallel(templateTasks);
      
      // Log performance if enabled
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🚀 Generated ${stats.totalTasks} files in parallel (${stats.totalExecutionTimeMs.toFixed(2)}ms)`);
      }
      
      // Handle failures
      if (stats.failedTasks > 0) {
        console.warn(`⚠️  ${stats.failedTasks} out of ${stats.totalTasks} files failed to generate`);
      }
      
    } catch (error) {
      throw new DynamicTemplateError('multiple_files', 'processing', ErrorHandler.normalizeToError(error));
    }
  }
  
  /**
   * Load core template with shared error handling
   */
  private static async loadCoreTemplate(templateName: string, lang: SupportedLanguage): Promise<string> {
    const coreTemplatePath = join(__dirname, '../../templates/core', lang, templateName);
    
    try {
      if (!await FileUtils.fileExists(coreTemplatePath)) {
        const coreDir = join(__dirname, '../../templates/core', lang);
        if (!await FileUtils.fileExists(coreDir)) {
          throw new TemplateNotFoundError(templateName, lang, [coreDir]);
        }
        throw new TemplateNotFoundError(templateName, lang, [coreTemplatePath]);
      }
      
      return await readFile(coreTemplatePath, 'utf-8');
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      throw new TemplateParsingError(templateName, ErrorHandler.normalizeToError(error));
    }
  }
  
  /**
   * Load tool configuration with safe error handling
   */
  private static async loadToolConfigSafely(toolName: string): Promise<StrictToolConfiguration> {
    try {
      if (TypeGuards.isSupportedTool(toolName)) {
        const configurable = await ConfigurationManager.loadConfigurableToolConfig(toolName);
        return {
          displayName: configurable.displayName,
          fileExtension: configurable.fileExtension,
          globs: configurable.globs,
          description: configurable.description
        };
      }
      
      // Fallback for unsupported tools
      return {
        displayName: toolName,
        fileExtension: '.md',
        globs: { inherit: 'universal' },
        description: `Configuration for ${toolName}`
      };
    } catch {
      // Return fallback configuration
      return {
        displayName: toolName,
        fileExtension: '.md',
        globs: { inherit: 'universal' },
        description: `Fallback configuration for ${toolName}`
      };
    }
  }
  
  /**
   * Load language configuration with safe error handling
   */
  private static async loadLanguageConfigSafely(languageName: string): Promise<StrictLanguageConfiguration> {
    try {
      return await ConfigurationManager.loadLanguageConfig(languageName);
    } catch {
      // Return fallback universal configuration
      return {
        globs: [
          '**/*.md',
          '**/*.txt', 
          '**/*.json',
          '**/*.yaml',
          '**/*.yml'
        ],
        description: `Fallback configuration for ${languageName}`,
        languageFeatures: ['universal']
      };
    }
  }
  
}