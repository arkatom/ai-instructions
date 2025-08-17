/**
 * Enhanced parallel operations for common generator patterns
 * Extracted from parallel-generator.ts for modular architecture
 * Issue #91: Modular refactoring - ParallelGeneratorOperations
 */

import { join } from 'path';
import { FileUtils } from '../../utils/file-utils';
import { 
  type SupportedLanguage, 
  DEFAULT_VALUES 
} from '../types';
import { type GenerateFilesOptions } from '../base';
import { 
  ParallelFileGenerator,
  type ParallelOperationStats 
} from '../parallel-generator';

/**
 * Enhanced parallel operations for common generator patterns
 * High-level operations built on top of ParallelFileGenerator
 */
export class ParallelGeneratorOperations {
  /**
   * Copy instructions directory with parallel operations using unified structure
   */
  static async copyInstructionsDirectoryParallel(
    targetDir: string,
    _lang: SupportedLanguage = DEFAULT_VALUES.LANGUAGE,
    options?: GenerateFilesOptions
  ): Promise<ParallelOperationStats> {
    const instructionsSourcePath = join(__dirname, '../../../templates/instructions');
    const instructionsTargetPath = join(targetDir, 'instructions');
    
    if (await FileUtils.fileExists(instructionsSourcePath)) {
      return await ParallelFileGenerator.copyDirectoryParallel(
        instructionsSourcePath, 
        instructionsTargetPath, 
        options
      );
    } else {
      console.warn(`⚠️  Instructions directory not found at ${instructionsSourcePath}`);
    }
    
    // Return empty stats if no instructions found
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalExecutionTimeMs: 0,
      averageTaskTimeMs: 0,
      concurrency: 10 // Default concurrency
    };
  }

  /**
   * Generate multiple specialized files for tools like Cline in parallel
   */
  static async generateMultipleSpecializedFilesParallel(
    baseContent: string,
    fileSpecs: ReadonlyArray<{
      filename: string;
      title: string;
      outputDirectory: string;
    }>,
    options?: GenerateFilesOptions,
    toolName = 'AI'
  ): Promise<ParallelOperationStats> {
    // Create template tasks for parallel generation
    const templateTasks = fileSpecs.map(spec => {
      const task: {
        templateName: string;
        outputPath: string;
        content: string;
        options?: GenerateFilesOptions;
      } = {
        templateName: spec.filename,
        outputPath: join(spec.outputDirectory, spec.filename),
        content: this.createSpecializedContent(baseContent, spec.title, toolName)
      };
      
      // Only add options if they exist
      if (options) {
        task.options = options;
      }
      
      return task;
    });
    
    return await ParallelFileGenerator.generateTemplateFilesParallel(templateTasks);
  }

  /**
   * Create specialized content for different file types
   */
  private static createSpecializedContent(baseContent: string, title: string, toolName = 'AI'): string {
    const header = `# ${title} - ${toolName} Integration

This file contains specialized development instructions.

---

`;
    
    return header + baseContent;
  }

  /**
   * Batch process multiple directories in parallel
   */
  static async batchProcessDirectoriesParallel(
    directories: ReadonlyArray<{
      source: string;
      target: string;
      options?: GenerateFilesOptions;
    }>
  ): Promise<ParallelOperationStats[]> {
    const operations = directories.map(dir => 
      ParallelFileGenerator.copyDirectoryParallel(dir.source, dir.target, dir.options)
    );
    
    return await Promise.all(operations);
  }

  /**
   * Generate multiple template variations in parallel
   */
  static async generateTemplateVariationsParallel(
    baseTemplate: string,
    variations: ReadonlyArray<{
      name: string;
      outputPath: string;
      replacements: Record<string, string>;
      options?: GenerateFilesOptions;
    }>
  ): Promise<ParallelOperationStats> {
    const templateTasks = variations.map(variation => {
      let content = baseTemplate;
      
      // Apply replacements
      for (const [placeholder, replacement] of Object.entries(variation.replacements)) {
        content = content.replace(new RegExp(placeholder, 'g'), replacement);
      }
      
      const task: {
        templateName: string;
        outputPath: string;
        content: string;
        options?: GenerateFilesOptions;
      } = {
        templateName: variation.name,
        outputPath: variation.outputPath,
        content
      };
      
      // Only add options if they exist
      if (variation.options) {
        task.options = variation.options;
      }
      
      return task;
    });
    
    return await ParallelFileGenerator.generateTemplateFilesParallel(templateTasks);
  }
}