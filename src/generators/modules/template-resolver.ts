/**
 * Template resolution and loading module
 * Extracted from BaseGenerator for single responsibility principle
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../../utils/file-utils';
import { ErrorHandler } from '../../utils/error-handler';
import {
  TemplateNotFoundError,
  TemplateParsingError,
  FileSystemError,
  UnsupportedLanguageError
} from '../errors';
import {
  TypeGuards,
  SUPPORTED_LANGUAGES,
  DEFAULT_VALUES,
  type SupportedLanguage
} from '../types';
import { type GenerateFilesOptions } from '../base';

/**
 * Template path with metadata for fallback handling
 */
interface TemplatePathInfo {
  readonly path: string;
  readonly description: string;
}

/**
 * Handles template resolution, loading, and fallback logic
 * Responsibility: Find and load templates with language fallback support
 */
export class TemplateResolver {
  constructor(private readonly templatesDir: string) {}

  /**
   * Build prioritized template search paths with fallback strategy
   * Priority: 1. Requested language 2. English fallback 3. Legacy location
   */
  buildTemplatePaths(templateName: string, lang: SupportedLanguage): ReadonlyArray<TemplatePathInfo> {
    const paths: TemplatePathInfo[] = [
      { 
        path: join(this.templatesDir, lang, templateName), 
        description: `${lang} version` 
      },
    ];
    
    // Add English fallback if not already English
    if (lang !== 'en') {
      paths.push({ 
        path: join(this.templatesDir, 'en', templateName), 
        description: 'English fallback' 
      });
    }
    
    // Add legacy fallback (template directly in templateDir)
    paths.push({ 
      path: join(this.templatesDir, templateName), 
      description: 'legacy version' 
    });
    
    return Object.freeze(paths);
  }

  /**
   * Attempt to read template from a single path
   * Returns null if file doesn't exist, throws on read errors
   */
  async tryReadTemplate(templatePath: string, templateName: string): Promise<string | null> {
    if (!await FileUtils.fileExists(templatePath)) {
      return null;
    }
    
    try {
      return await readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new TemplateParsingError(templateName, ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Show appropriate fallback warning to user
   * Provides helpful feedback when templates are not found in preferred language
   */
  private showFallbackWarning(templateName: string, lang: SupportedLanguage, description: string): void {
    if (description === 'English fallback') {
      console.warn(`⚠️  Template ${templateName} not found for ${lang}, using English version`);
    } else if (description === 'legacy version' && lang !== 'en') {
      console.warn(`⚠️  Using legacy template ${templateName} (no language support yet)`);
    }
  }

  /**
   * Load template with language fallback support
   * Main entry point for template loading with comprehensive error handling
   */
  async loadTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    const lang = options?.lang || DEFAULT_VALUES.LANGUAGE;
    
    // Validate language support
    if (!TypeGuards.isSupportedLanguage(lang)) {
      throw new UnsupportedLanguageError(lang, [...SUPPORTED_LANGUAGES]);
    }
    
    const templatePaths = this.buildTemplatePaths(templateName, lang);
    const searchPaths: string[] = templatePaths.map(p => p.path);
    
    try {
      // Try each template path in priority order
      for (const { path: templatePath, description } of templatePaths) {
        const content = await this.tryReadTemplate(templatePath, templateName);
        if (content !== null) {
          this.showFallbackWarning(templateName, lang, description);
          return content;
        }
      }
      
      // No template found in any search path
      throw new TemplateNotFoundError(templateName, lang, searchPaths);
      
    } catch (error) {
      // Re-throw our specific errors
      if (error instanceof TemplateNotFoundError || 
          error instanceof TemplateParsingError ||
          error instanceof UnsupportedLanguageError) {
        throw error;
      }
      
      // Handle unexpected filesystem errors
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new FileSystemError('read_template', this.templatesDir, normalizedError);
    }
  }
}