/**
 * Task builder for parallel file operations
 * Extracted from parallel-generator.ts for modular architecture
 * Issue #91: Modular refactoring - TaskBuilder
 */

import { join } from 'path';
import { readdir, stat } from 'fs/promises';
import { type FileOperationTask, type GenerateFilesOptions } from '../parallel-generator';
import { FileSystemError } from '../errors';
import { ErrorHandler } from '../../utils/error-handler';

/**
 * Builder responsible for constructing file operation tasks
 * Handles directory traversal and task generation
 */
export class TaskBuilder {
  /**
   * Build copy tasks for directory copying with recursive traversal
   */
  async buildCopyTasks(
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
   * Build batch tasks by dividing items into chunks
   */
  buildBatchTasks<T>(
    items: T[],
    batchSize: number
  ): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Build template generation tasks from specifications
   */
  buildTemplateGenerationTasks(
    templateSpecs: ReadonlyArray<{
      templateName: string;
      outputPath: string;
      content: string;
      options?: GenerateFilesOptions;
    }>
  ): FileOperationTask[] {
    return templateSpecs.map((spec, index) => ({
      id: `template-${index}-${spec.templateName}`,
      operation: 'write' as const,
      targetPath: spec.outputPath,
      content: spec.content,
      options: spec.options
    }));
  }

  /**
   * Build recursive file discovery tasks for directory scanning
   */
  async buildRecursiveFileTasks(
    rootPath: string,
    pattern?: string,
    taskPrefix: string = 'scan'
  ): Promise<FileOperationTask[]> {
    const tasks: FileOperationTask[] = [];
    
    try {
      const items = await readdir(rootPath);
      
      for (const item of items) {
        const itemPath = join(rootPath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          // Recursively scan subdirectories
          const subTasks = await this.buildRecursiveFileTasks(
            itemPath,
            pattern,
            `${taskPrefix}-${item}`
          );
          tasks.push(...subTasks);
        } else {
          // Add file task if matches pattern
          if (!pattern || item.match(pattern)) {
            const readTask: FileOperationTask = {
              id: `${taskPrefix}-read-${item}`,
              operation: 'read',
              sourcePath: itemPath,
              targetPath: itemPath // For read operations, target equals source
            };
            
            tasks.push(readTask);
          }
        }
      }
      
      return tasks;
      
    } catch (error) {
      throw new FileSystemError('build_recursive_tasks', rootPath, ErrorHandler.normalizeToError(error));
    }
  }

  /**
   * Build write tasks from content map
   */
  buildWriteTasks(
    contentMap: Record<string, string>,
    options?: GenerateFilesOptions,
    taskPrefix: string = 'write'
  ): FileOperationTask[] {
    return Object.entries(contentMap).map(([path, content], index) => ({
      id: `${taskPrefix}-${index}-${path.split('/').pop() || 'file'}`,
      operation: 'write' as const,
      targetPath: path,
      content: content,
      options: options
    }));
  }
}