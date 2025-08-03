import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';

/**
 * Options for file generation
 */
export interface GenerateFilesOptions {
  projectName?: string;
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
  async loadTemplate(templateName: string): Promise<string> {
    try {
      const templatePath = join(this.templateDir, templateName);
      const content = await readFile(templatePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Template file not found: ${templateName}`);
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
   * Get tool name
   */
  getToolName(): string {
    return this.toolConfig.name;
  }
}