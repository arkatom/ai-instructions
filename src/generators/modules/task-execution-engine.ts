/**
 * Task execution engine for parallel file operations
 * Extracted from parallel-generator.ts for modular architecture
 * Issue #91: Modular refactoring - TaskExecutionEngine
 */

import { type FileOperationTask, type FileOperationResult } from '../parallel-generator';
import { ErrorHandler } from '../../utils/error-handler';
import { FileOperationHandler } from './file-operation-handler';

/**
 * Engine responsible for executing file operation tasks in parallel batches
 * Handles concurrency control and batch processing
 */
export class TaskExecutionEngine {
  private static readonly DEFAULT_CONCURRENCY = 10;
  private static readonly MAX_CONCURRENCY = 20;
  private fileOperationHandler: FileOperationHandler;

  constructor(private concurrency: number = TaskExecutionEngine.DEFAULT_CONCURRENCY) {
    this.concurrency = Math.min(Math.max(1, concurrency), TaskExecutionEngine.MAX_CONCURRENCY);
    this.fileOperationHandler = new FileOperationHandler();
  }

  /**
   * Execute multiple tasks in parallel with controlled concurrency
   */
  async executeParallel<T>(
    tasks: ReadonlyArray<() => Promise<T>>
  ): Promise<T[]> {
    if (tasks.length === 0) {
      return [];
    }

    const results: T[] = [];
    
    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += this.concurrency) {
      const batch = tasks.slice(i, i + this.concurrency);
      
      // Execute batch in parallel
      const batchPromises = batch.map(task => this.executeTask(task));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results from batch
      const processedResults = batchResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          throw new Error(`Task ${i + index} failed: ${result.reason}`);
        }
      });
      
      results.push(...processedResults);
    }
    
    return results;
  }

  /**
   * Execute file operation tasks in batches with controlled concurrency
   */
  async executeBatchesWithConcurrency(
    tasks: ReadonlyArray<FileOperationTask>
  ): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = [];
    
    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += this.concurrency) {
      const batch = tasks.slice(i, i + this.concurrency);
      
      // Execute batch in parallel
      const batchPromises = batch.map(task => this.executeFileOperationTask(task));
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
          } as FileOperationResult;
        }
      });
      
      results.push(...processedResults);
    }
    
    return results;
  }

  /**
   * Execute a single task with error handling
   */
  private async executeTask<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      throw ErrorHandler.normalizeToError(error);
    }
  }

  /**
   * Execute a single file operation task with timing
   */
  private async executeFileOperationTask(task: FileOperationTask): Promise<FileOperationResult> {
    const startTime = performance.now();
    
    try {
      // This will be delegated to FileOperationHandler
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
   * Execute task operation using FileOperationHandler
   */
  private async executeTaskOperation(task: FileOperationTask): Promise<string | undefined> {
    return await this.fileOperationHandler.executeTaskOperation(task);
  }
}