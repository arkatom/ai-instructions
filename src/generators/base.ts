import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { OutputFormat } from '../converters';

/**
 * Options for file generation
 */
export interface GenerateFilesOptions {
  projectName?: string;
  force?: boolean;  // 🚨 EMERGENCY PATCH v0.2.1: Force overwrite flag
  lang?: 'en' | 'ja' | 'ch';  // Issue #11: Multi-language support
  outputFormat?: OutputFormat;  // Issue #19: Multi-format output support
  // 🚀 v0.5.0: Advanced file conflict resolution options (Issue #26)
  conflictResolution?: string;
  interactive?: boolean;
  backup?: boolean;
}

/**
 * Configuration for each AI tool
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

  constructor(toolConfig: ToolConfig) {
    this.toolConfig = toolConfig;
    this.templateDir = join(__dirname, '../../templates', toolConfig.templateDir);
  }

  /**
   * Load template file content
   */
  async loadTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    const lang = options?.lang || 'en';
    
    try {
      // Try language-specific path first
      const langPath = join(this.templateDir, lang, templateName);
      if (await FileUtils.fileExists(langPath)) {
        return await readFile(langPath, 'utf-8');
      }
      
      // Fallback to English if not the requested language
      if (lang !== 'en') {
        const enPath = join(this.templateDir, 'en', templateName);
        if (await FileUtils.fileExists(enPath)) {
          console.warn(`⚠️  Template ${templateName} not found for ${lang}, using English version`);
          return await readFile(enPath, 'utf-8');
        }
      }
      
      // Legacy fallback (for migration period)
      const legacyPath = join(this.templateDir, templateName);
      if (await FileUtils.fileExists(legacyPath)) {
        if (lang !== 'en') {
          console.warn(`⚠️  Using legacy template ${templateName} (no language support yet)`);
        }
        return await readFile(legacyPath, 'utf-8');
      }
      
      throw new Error(`Template ${templateName} not found for language ${lang}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found for language')) {
        throw error;
      }
      throw new Error(`Failed to load template ${templateName}: ${error}`);
    }
  }

  /**
   * Load dynamic template from core templates with tool-specific customization
   * TDD Implementation: Green Phase - Minimal implementation to make tests pass
   */
  async loadDynamicTemplate(templateName: string, options?: GenerateFilesOptions): Promise<string> {
    const lang = options?.lang || 'en';
    
    try {
      // Load core template from templates/core/{lang}/templateName
      const coreTemplatePath = join(__dirname, '../../templates/core', lang, templateName);
      
      // Check if core template exists
      if (!await FileUtils.fileExists(coreTemplatePath)) {
        // Handle missing core template directory
        const coreDir = join(__dirname, '../../templates/core', lang);
        if (!await FileUtils.fileExists(coreDir)) {
          throw new Error(`Core template directory not found for language ${lang}`);
        }
        throw new Error(`Core template ${templateName} not found for language ${lang}`);
      }
      
      const coreTemplate = await readFile(coreTemplatePath, 'utf-8');
      
      // Apply basic placeholder replacement for now (minimal implementation)
      let processedContent = coreTemplate;
      
      // Replace project name
      if (options?.projectName) {
        processedContent = processedContent.replace(/\{\{projectName\}\}/g, options.projectName);
      }
      
      // Replace tool name with a basic implementation
      const toolName = this.getToolDisplayName();
      processedContent = processedContent.replace(/\{\{toolName\}\}/g, toolName);
      
      // For now, just remove other placeholders to make tests pass
      // (These will be properly implemented in later TDD cycles)
      processedContent = processedContent.replace(/\{\{toolSpecificFeatures\}\}/g, '');
      processedContent = processedContent.replace(/\{\{additionalInstructions\}\}/g, '');
      processedContent = processedContent.replace(/\{\{dynamicGlobs\}\}/g, '["**/*.ts", "**/*.js", "**/*.md"]');
      
      return processedContent;
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('not found for language') ||
        error.message.includes('Core template directory not found')
      )) {
        throw error;
      }
      throw new Error(`Failed to load dynamic template ${templateName}: ${error}`);
    }
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
    } catch (error) {
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
        defaultResolution: conflictResolution as any || 'backup',
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