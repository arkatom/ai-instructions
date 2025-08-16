/**
 * Parallel file generation utilities for improved performance
 * Issue #35: Code Review - Implement parallel file generation for performance
 */

/* eslint-disable max-lines */
// Parallel processing requires comprehensive task management infrastructure

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
import { ErrorHandler } from '../utils/error-handler';

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
      throw new FileSystemError('parallel_copy', sourcePath, ErrorHandler.normalizeToError(error));
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
        return {
          id: `template-${index}-${task.templateName}`,
          operation: 'write',
          targetPath: task.outputPath,
          content: task.content,
          options: task.options
        };
      });
      
      // Execute all template file generations in parallel
      return await this.executeParallel(fileOpTasks);
      
    } catch (error) {
      throw new DynamicTemplateError('parallel_template_generation', 'processing', ErrorHandler.normalizeToError(error));
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
      const content = await this.executeTaskOperation(task);
      const endTime = performance.now();
      
      return {
        taskId: task.id,
        success: true,
        executionTimeMs: endTime - startTime,
        content
      };
      
    } catch (error) {
      const endTime = performance.now();
      
      return {
        taskId: task.id,
        success: false,
        error: ErrorHandler.normalizeToError(error),
        executionTimeMs: endTime - startTime
      };
    }
  }

  /**
   * Execute the specific operation for a task
   */
  private static async executeTaskOperation(task: FileOperationTask): Promise<string | undefined> {
    switch (task.operation) {
      case 'read':
        return await this.executeReadOperation(task);
      case 'write':
        await this.executeWriteOperation(task);
        return undefined;
      case 'copy':
        await this.executeCopyOperation(task);
        return undefined;
      case 'mkdir':
        await this.executeMkdirOperation(task);
        return undefined;
      default: {
        const unknownTask = task as FileOperationTask & { operation: string };
        throw new Error(`Unsupported operation: ${unknownTask.operation}`);
      }
    }
  }

  /**
   * Execute read operation
   */
  private static async executeReadOperation(task: FileOperationTask): Promise<string> {
    if (!task.sourcePath) {
      throw new Error('sourcePath is required for read operations');
    }
    return await readFile(task.sourcePath, 'utf-8');
  }

  /**
   * Execute write operation
   */
  private static async executeWriteOperation(task: FileOperationTask): Promise<void> {
    if (!task.content) {
      throw new Error('content is required for write operations');
    }
    await FileUtils.writeFileContent(task.targetPath, task.content);
  }

  /**
   * Execute copy operation
   */
  private static async executeCopyOperation(task: FileOperationTask): Promise<void> {
    if (!task.sourcePath) {
      throw new Error('sourcePath is required for copy operations');
    }
    const sourceContent = await readFile(task.sourcePath, 'utf-8');
    await FileUtils.writeFileContent(task.targetPath, sourceContent);
  }

  /**
   * Execute mkdir operation
   */
  private static async executeMkdirOperation(task: FileOperationTask): Promise<void> {
    await FileUtils.ensureDirectory(task.targetPath);
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
            targetPath: targetItemPath,
            options: options
          };
          
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
            targetPath: targetItemPath,
            options: options
          };
          
          tasks.push(copyTask);
        }
      }
      
      return tasks;
      
    } catch (error) {
      throw new FileSystemError('build_copy_tasks', sourcePath, ErrorHandler.normalizeToError(error));
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
    options?: GenerateFilesOptions,  // Use legacy type for compatibility
    toolName = 'AI'  // Add toolName parameter with default
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
}