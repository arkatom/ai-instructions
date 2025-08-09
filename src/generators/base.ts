import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { ConflictResolution } from '../utils/file-conflict-handler';
import { OutputFormat } from '../converters';

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
 * Tool configuration structure
 */
export interface ToolConfiguration {
  displayName: string;
  fileExtension: string;
  globs: {
    inherit: string;
    additional?: string[];
  };
  description: string;
}

/**
 * Language configuration structure  
 */
export interface LanguageConfiguration {
  globs: string[];
  description: string;
  languageFeatures: string[];
}

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
  // 🚀 v0.6.0: Dynamic template generation options (Issue #29)
  languageConfig?: string;  // Override language config (e.g., 'python', 'javascript')
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
      
      // Load tool-specific configuration
      const toolConfig = await this.loadToolConfig();
      
      // Load language configuration (from tool config inheritance or options)
      const languageName = options?.languageConfig || toolConfig.globs?.inherit || 'universal';
      const languageConfig = await this.loadLanguageConfig(languageName);
      
      // Apply advanced dynamic replacements
      return this.applyDynamicReplacements(coreTemplate, toolConfig, languageConfig, options);
      
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('not found for language') ||
        error.message.includes('Core template directory not found') ||
        error.message.includes('Tool configuration not found') ||
        error.message.includes('Language configuration not found')
      )) {
        throw error;
      }
      throw new Error(`Failed to load dynamic template ${templateName}: ${error}`);
    }
  }

  /**
   * Apply advanced dynamic replacements using tool and language configurations
   * TDD Implementation: Green Phase - Complete dynamic replacement system
   */
  private applyDynamicReplacements(
    template: string, 
    toolConfig: ToolConfiguration, 
    languageConfig: LanguageConfiguration, 
    options?: GenerateFilesOptions
  ): string {
    let result = template;
    
    // 1. Project name replacement (existing)
    if (options?.projectName) {
      result = result.replace(/\{\{projectName\}\}/g, options.projectName);
    }
    
    // 2. Remove tool name placeholders (tool-specific naming removed)
    result = result.replace(/\{\{toolName\}\}/g, '');
    
    // 3. Dynamic globs replacement (NEW)
    const dynamicGlobs = this.generateDynamicGlobs(toolConfig, languageConfig);
    result = result.replace(/\{\{dynamicGlobs\}\}/g, JSON.stringify(dynamicGlobs, null, 2).replace(/"/g, '\\"'));
    
    // 4. Remove tool-specific features placeholders (customSections removed)
    result = result.replace(/\{\{toolSpecificFeatures\}\}/g, '');
    
    // 5. Remove additional instructions placeholders (customSections removed)
    result = result.replace(/\{\{additionalInstructions\}\}/g, '');
    
    // 6. File extension replacement (NEW)
    if (toolConfig.fileExtension) {
      result = result.replace(/\{\{fileExtension\}\}/g, toolConfig.fileExtension);
    }
    
    // 7. Apply existing template variable replacements
    return this.replaceTemplateVariables(result, options || {});
  }

  /**
   * Generate dynamic globs by merging language config and tool-specific additions
   * TDD Implementation: Green Phase - Intelligent globs combination
   */
  private generateDynamicGlobs(toolConfig: ToolConfiguration, languageConfig: LanguageConfiguration): string[] {
    const baseGlobs = languageConfig.globs || [];
    const additionalGlobs = toolConfig.globs?.additional || [];
    
    // Combine and deduplicate globs
    const allGlobs = [...baseGlobs, ...additionalGlobs];
    const uniqueGlobs = Array.from(new Set(allGlobs));
    
    return uniqueGlobs.sort(); // Sort for consistency
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
  async loadToolConfig(): Promise<ToolConfiguration> {
    try {
      const toolConfigPath = join(__dirname, '../../templates/configs/tools', `${this.toolConfig.name}.json`);
      
      if (!await FileUtils.fileExists(toolConfigPath)) {
        throw new Error(`Tool configuration not found for ${this.toolConfig.name}`);
      }
      
      const configContent = await readFile(toolConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tool configuration not found')) {
        throw error;
      }
      throw new Error(`Failed to parse tool configuration for ${this.toolConfig.name}: ${error}`);
    }
  }

  /**
   * Load language-specific configuration from JSON file
   * TDD Implementation: Green Phase - Language configuration support
   */
  async loadLanguageConfig(languageName: string): Promise<LanguageConfiguration> {
    try {
      const langConfigPath = join(__dirname, '../../templates/configs/languages', `${languageName}.json`);
      
      if (!await FileUtils.fileExists(langConfigPath)) {
        throw new Error(`Language configuration not found for ${languageName}`);
      }
      
      const configContent = await readFile(langConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Language configuration not found')) {
        throw error;
      }
      throw new Error(`Failed to parse language configuration for ${languageName}: ${error}`);
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