/**
 * Parallel file generation utilities for improved performance
 * Issue #35: Code Review - Implement parallel file generation for performance
 */

// Modular parallel processing using extracted components

import { FileUtils } from '../utils/file-utils';
import { type GenerateFilesOptions } from './base';

// Re-export GenerateFilesOptions for module usage
export { type GenerateFilesOptions } from './base';
import {
  FileSystemError,
  DynamicTemplateError
} from './errors';
import { ErrorHandler } from '../utils/error-handler';
import {
  TaskExecutionEngine,
  FileOperationHandler,
  TaskBuilder,
  OperationStatsCalculator
} from './modules';

// Re-export ParallelGeneratorOperations for backward compatibility
export { ParallelGeneratorOperations } from './modules/parallel-generator-operations';

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
 * Refactored to use modular architecture with dependency injection
 */
export class ParallelFileGenerator {
  private static readonly DEFAULT_CONCURRENCY = 10;
  private static readonly MAX_CONCURRENCY = 20;
  
  private static taskExecutionEngine: TaskExecutionEngine;
  private static fileOperationHandler: FileOperationHandler;
  private static taskBuilder: TaskBuilder;
  private static statsCalculator: OperationStatsCalculator;
  
  /**
   * Initialize static dependencies
   */
  private static initializeDependencies(concurrency: number = this.DEFAULT_CONCURRENCY): void {
    if (!this.taskExecutionEngine) {
      this.taskExecutionEngine = new TaskExecutionEngine(concurrency);
      this.fileOperationHandler = new FileOperationHandler();
      this.taskBuilder = new TaskBuilder();
      this.statsCalculator = new OperationStatsCalculator();
    }
  }

  /**
   * Execute multiple file operations in parallel with controlled concurrency
   */
  static async executeParallel(
    tasks: ReadonlyArray<FileOperationTask>,
    concurrency: number = this.DEFAULT_CONCURRENCY
  ): Promise<ParallelOperationStats> {
    if (tasks.length === 0) {
      this.initializeDependencies(concurrency);
      return this.statsCalculator.createEmptyStats(concurrency);
    }

    const validConcurrency = Math.min(Math.max(1, concurrency), this.MAX_CONCURRENCY);
    this.initializeDependencies(validConcurrency);
    
    const startTime = performance.now();
    
    // Execute tasks using TaskExecutionEngine
    const results = await this.taskExecutionEngine.executeBatchesWithConcurrency(tasks);
    
    const endTime = performance.now();
    const totalExecutionTime = endTime - startTime;
    
    // Calculate statistics using OperationStatsCalculator
    return this.statsCalculator.calculateStatistics(tasks, results, totalExecutionTime, validConcurrency);
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
      this.initializeDependencies();
      
      // Ensure target directory exists
      await FileUtils.ensureDirectory(targetPath);
      
      // Build list of copy tasks using TaskBuilder
      const copyTasks = await this.taskBuilder.buildCopyTasks(sourcePath, targetPath, options);
      
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
      options?: GenerateFilesOptions;
    }>
  ): Promise<ParallelOperationStats> {
    try {
      this.initializeDependencies();
      
      // Convert template tasks to file operation tasks using TaskBuilder
      const fileOpTasks = this.taskBuilder.buildTemplateGenerationTasks(templateTasks);
      
      // Execute all template file generations in parallel
      return await this.executeParallel(fileOpTasks);
      
    } catch (error) {
      throw new DynamicTemplateError('parallel_template_generation', 'processing', ErrorHandler.normalizeToError(error));
    }
  }
}