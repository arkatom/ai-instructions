import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';

/**
 * Options for file generation
 */
export interface GenerateFilesOptions {
  projectName?: string;
  force?: boolean;  // 🚨 EMERGENCY PATCH v0.2.1: Force overwrite flag
  lang?: 'en' | 'ja' | 'ch';  // Issue #11: Multi-language support
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
   */
  protected async safeWriteFile(targetPath: string, content: string, force: boolean = false): Promise<void> {
    await FileUtils.writeFileContentSafe(targetPath, content, force);
  }

  /**
   * Get tool name
   */
  getToolName(): string {
    return this.toolConfig.name;
  }
}