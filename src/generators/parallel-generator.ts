/**
 * Parallel file generation utilities for improved performance
 * Issue #35: Code Review - Implement parallel file generation for performance
 */

import { join } from 'path';
import { readFile, readdir, stat } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { 
  type SupportedLanguage, 
  DEFAULT_VALUES 
} from './types';
import { type GenerateFilesOptions } from './base';
import {
  FileSystemError,
  DynamicTemplateError
} from './errors';

/**
 * File operation task for parallel execution
 */
export interface FileOperationTask {
  readonly id: string;
  readonly operation: 'read' | 'write' | 'copy' | 'mkdir';
  readonly sourcePath?: string | undefined;
  readonly targetPath: string;
  readonly content?: string | undefined;
  readonly options?: GenerateFilesOptions | undefined;
}

/**
 * Result of a parallel file operation
 */
export interface FileOperationResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly content?: string | undefined;
  readonly error?: Error | undefined;
  readonly executionTimeMs: number;
}

/**
 * Statistics for parallel operations
 */
export interface ParallelOperationStats {
  readonly totalTasks: number;
  readonly successfulTasks: number;
  readonly failedTasks: number;
  readonly totalExecutionTimeMs: number;
  readonly averageTaskTimeMs: number;
  readonly concurrency: number;
}

/**
 * Parallel file generator for improved performance
 */
export class ParallelFileGenerator {
  private static readonly DEFAULT_CONCURRENCY = 10;
  private static readonly MAX_CONCURRENCY = 20;

  /**
   * Execute multiple file operations in parallel with controlled concurrency
   */
  static async executeParallel(
    tasks: ReadonlyArray<FileOperationTask>,
    concurrency: number = this.DEFAULT_CONCURRENCY
  ): Promise<ParallelOperationStats> {
    if (tasks.length === 0) {
      return this.createEmptyStats(concurrency);
    }

    const validConcurrency = Math.min(Math.max(1, concurrency), this.MAX_CONCURRENCY);
    const startTime = performance.now();
    
    // Execute tasks in batches with controlled concurrency
    const results = await this.executeBatchesWithConcurrency(tasks, validConcurrency);
    
    const endTime = performance.now();
    const totalExecutionTime = endTime - startTime;
    
    // Calculate statistics
    return this.calculateStatistics(tasks, results, totalExecutionTime, validConcurrency);
  }

  /**
   * Copy directory with parallel file operations
   */
  static async copyDirectoryParallel(
    sourcePath: string, 
    targetPath: string, 
    options?: GenerateFilesOptions
  ): Promise<ParallelOperationStats> {
    try {
      // Ensure target directory exists
      await FileUtils.ensureDirectory(targetPath);
      
      // Build list of copy tasks
      const copyTasks = await this.buildCopyTasks(sourcePath, targetPath, options);
      
      // Execute all copy operations in parallel
      return await this.executeParallel(copyTasks);
      
    } catch (error) {
      throw new FileSystemError('parallel_copy', sourcePath, error as Error);
    }
  }

  /**
   * Generate multiple template files in parallel
   */
  static async generateTemplateFilesParallel(
    templateTasks: ReadonlyArray<{
      templateName: string;
      outputPath: string;
      content: string;
      options?: GenerateFilesOptions;  // Use legacy type for compatibility
    }>
  ): Promise<ParallelOperationStats> {
    try {
      // Convert template tasks to file operation tasks
      const fileOpTasks: FileOperationTask[] = templateTasks.map((task, index) => {
        const baseTask: FileOperationTask = {
          id: `template-${index}-${task.templateName}`,
          operation: 'write',
          targetPath: task.outputPath,
          content: task.content
        };
        
        // Only add options if they exist
        if (task.options) {
          (baseTask as any).options = task.options;
        }
        
        return baseTask;
      });
      
      // Execute all template file generations in parallel
      return await this.executeParallel(fileOpTasks);
      
    } catch (error) {
      throw new DynamicTemplateError('parallel_template_generation', 'processing', error as Error);
    }
  }

  /**
   * Execute file operation tasks in batches with controlled concurrency
   */
  private static async executeBatchesWithConcurrency(
    tasks: ReadonlyArray<FileOperationTask>,
    concurrency: number
  ): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = [];
    
    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      
      // Execute batch in parallel
      const batchPromises = batch.map(task => this.executeTask(task));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results from batch
      const processedResults = batchResults.map((result, index) => {
        const currentTask = batch[index];
        if (!currentTask) {
          throw new Error(`Batch task at index ${index} is undefined`);
        }
        
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Handle rejected promises
          return {
            taskId: currentTask.id,
            success: false,
            error: result.reason,
            executionTimeMs: 0
          };
        }
      });
      
      results.push(...processedResults);
    }
    
    return results;
  }

  /**
   * Execute a single file operation task
   */
  private static async executeTask(task: FileOperationTask): Promise<FileOperationResult> {
    const startTime = performance.now();
    
    try {
      let content: string | undefined = undefined;
      
      switch (task.operation) {
        case 'read':
          if (!task.sourcePath) {
            throw new Error('sourcePath is required for read operations');
          }
          content = await readFile(task.sourcePath, 'utf-8');
          break;
          
        case 'write':
          if (!task.content) {
            throw new Error('content is required for write operations');
          }
          // Use FileUtils.writeFileContent for consistency
          await FileUtils.writeFileContent(task.targetPath, task.content);
          break;
          
        case 'copy': {
          if (!task.sourcePath) {
            throw new Error('sourcePath is required for copy operations');
          }
          // Read source and write to target
          const sourceContent = await readFile(task.sourcePath, 'utf-8');
          await FileUtils.writeFileContent(task.targetPath, sourceContent);
          break;
        }
          
        case 'mkdir':
          await FileUtils.ensureDirectory(task.targetPath);
          break;
          
        default: {
          const unknownTask = task as FileOperationTask & { operation: string };
          throw new Error(`Unsupported operation: ${unknownTask.operation}`);
        }
      }
      
      const endTime = performance.now();
      
      const result: FileOperationResult = {
        taskId: task.id,
        success: true,
        executionTimeMs: endTime - startTime
      };
      
      // Only include content if it was actually read
      if (content !== undefined) {
        (result as any).content = content;
      }
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      
      return {
        taskId: task.id,
        success: false,
        error: error as Error,
        executionTimeMs: endTime - startTime
      };
    }
  }

  /**
   * Build copy tasks for directory copying
   */
  private static async buildCopyTasks(
    sourcePath: string,
    targetPath: string,
    options?: GenerateFilesOptions,
    taskPrefix: string = 'copy'
  ): Promise<FileOperationTask[]> {
    const tasks: FileOperationTask[] = [];
    
    try {
      const items = await readdir(sourcePath);
      
      for (const item of items) {
        const sourceItemPath = join(sourcePath, item);
        const targetItemPath = join(targetPath, item);
        const itemStat = await stat(sourceItemPath);
        
        if (itemStat.isDirectory()) {
          // Create directory task
          const mkdirTask: FileOperationTask = {
            id: `${taskPrefix}-mkdir-${item}`,
            operation: 'mkdir',
            targetPath: targetItemPath
          };
          
          // Only add options if they exist
          if (options) {
            (mkdirTask as any).options = options;
          }
          
          tasks.push(mkdirTask);
          
          // Recursively add tasks for subdirectory
          const subTasks = await this.buildCopyTasks(
            sourceItemPath, 
            targetItemPath, 
            options, 
            `${taskPrefix}-${item}`
          );
          tasks.push(...subTasks);
        } else {
          // Create file copy task
          const copyTask: FileOperationTask = {
            id: `${taskPrefix}-file-${item}`,
            operation: 'copy',
            sourcePath: sourceItemPath,
            targetPath: targetItemPath
          };
          
          // Only add options if they exist
          if (options) {
            (copyTask as any).options = options;
          }
          
          tasks.push(copyTask);
        }
      }
      
      return tasks;
      
    } catch (error) {
      throw new FileSystemError('build_copy_tasks', sourcePath, error as Error);
    }
  }

  /**
   * Calculate statistics from parallel operation results
   */
  private static calculateStatistics(
    tasks: ReadonlyArray<FileOperationTask>,
    results: FileOperationResult[],
    totalExecutionTime: number,
    concurrency: number
  ): ParallelOperationStats {
    const successfulTasks = results.filter(r => r.success).length;
    const failedTasks = results.filter(r => !r.success).length;
    const totalTaskTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    const averageTaskTime = results.length > 0 ? totalTaskTime / results.length : 0;
    
    return {
      totalTasks: tasks.length,
      successfulTasks,
      failedTasks,
      totalExecutionTimeMs: totalExecutionTime,
      averageTaskTimeMs: averageTaskTime,
      concurrency
    };
  }

  /**
   * Create empty statistics for edge cases
   */
  private static createEmptyStats(concurrency: number): ParallelOperationStats {
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalExecutionTimeMs: 0,
      averageTaskTimeMs: 0,
      concurrency
    };
  }
}

/**
 * Enhanced parallel operations for common generator patterns
 */
export class ParallelGeneratorOperations {
  /**
   * Copy instructions directory with parallel operations using unified structure
   */
  static async copyInstructionsDirectoryParallel(
    targetDir: string,
    _lang: SupportedLanguage = DEFAULT_VALUES.LANGUAGE,
    options?: GenerateFilesOptions  // Change back to GenerateFilesOptions for compatibility
  ): Promise<ParallelOperationStats> {
    const instructionsSourcePath = join(__dirname, '../../templates/instructions');
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
    return ParallelFileGenerator['createEmptyStats'](ParallelFileGenerator['DEFAULT_CONCURRENCY']);
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
    options?: GenerateFilesOptions  // Use legacy type for compatibility
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
        content: this.createSpecializedContent(baseContent, spec.title)
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
  private static createSpecializedContent(baseContent: string, title: string): string {
    const header = `# ${title} - AI Integration

This file contains specialized development instructions.

---

`;
    
    return header + baseContent;
  }
}