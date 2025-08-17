/**
 * File operation handler for parallel processing
 * Extracted from parallel-generator.ts for modular architecture  
 * Issue #91: Modular refactoring - FileOperationHandler
 */

import { readFile } from 'fs/promises';
import { FileUtils } from '../../utils/file-utils';
import { ConflictResolution } from '../../utils/file-conflict-handler';
import { type FileOperationTask } from '../parallel-generator';

/**
 * Handler responsible for executing individual file operations
 * Supports read, write, copy, and mkdir operations
 */
export class FileOperationHandler {
  /**
   * Execute the specific operation for a task
   */
  async executeTaskOperation(task: FileOperationTask): Promise<string | undefined> {
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
  async executeReadOperation(task: FileOperationTask): Promise<string> {
    if (!task.sourcePath) {
      throw new Error('sourcePath is required for read operations');
    }
    return await readFile(task.sourcePath, 'utf-8');
  }

  /**
   * Execute write operation
   */
  async executeWriteOperation(task: FileOperationTask): Promise<void> {
    if (!task.content) {
      throw new Error('content is required for write operations');
    }
    await FileUtils.writeFileContentAdvanced(task.targetPath, task.content, {
      force: false,
      interactive: true,
      defaultResolution: ConflictResolution.BACKUP,
      backup: true
    });
  }

  /**
   * Execute copy operation
   */
  async executeCopyOperation(task: FileOperationTask): Promise<void> {
    if (!task.sourcePath) {
      throw new Error('sourcePath is required for copy operations');
    }
    const sourceContent = await readFile(task.sourcePath, 'utf-8');
    await FileUtils.writeFileContentAdvanced(task.targetPath, sourceContent, {
      force: false,
      interactive: true,
      defaultResolution: ConflictResolution.BACKUP,
      backup: true
    });
  }

  /**
   * Execute mkdir operation
   */
  async executeMkdirOperation(task: FileOperationTask): Promise<void> {
    await FileUtils.ensureDirectory(task.targetPath);
  }

  /**
   * Convenience method for executing read operation with path
   */
  async executeReadOperationByPath(path: string): Promise<string> {
    return await readFile(path, 'utf-8');
  }

  /**
   * Convenience method for executing write operation with path and content
   */
  async executeWriteOperationByPath(path: string, content: string): Promise<void> {
    await FileUtils.writeFileContentAdvanced(path, content, {
      force: false,
      interactive: true,
      defaultResolution: ConflictResolution.BACKUP,
      backup: true
    });
  }

  /**
   * Convenience method for executing copy operation with source and target paths
   */
  async executeCopyOperationByPath(sourcePath: string, targetPath: string): Promise<void> {
    const sourceContent = await readFile(sourcePath, 'utf-8');
    await FileUtils.writeFileContentAdvanced(targetPath, sourceContent, {
      force: false,
      interactive: true,
      defaultResolution: ConflictResolution.BACKUP,
      backup: true
    });
  }

  /**
   * Convenience method for executing mkdir operation with path
   */
  async executeMkdirOperationByPath(path: string): Promise<void> {
    await FileUtils.ensureDirectory(path);
  }
}