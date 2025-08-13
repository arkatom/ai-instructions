/**
 * File System Helper for Context Analysis
 * Handles file reading and validation operations
 */

import { readFile, stat } from 'fs/promises';
import { ProjectContext } from '../types';

/**
 * Type definition for package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * FileSystemHelper class
 * Encapsulates file system operations with error handling
 */
export class FileSystemHelper {
  private context: Partial<ProjectContext>;

  constructor(context: Partial<ProjectContext>) {
    this.context = context;
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse a JSON file with comprehensive error handling
   */
  async readJsonFile(filePath: string): Promise<PackageJson | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Check for empty file
      if (!content || content.trim() === '') {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Empty JSON file'
        });
        return null;
      }
      
      // Check for file size (5MB limit)
      if (content.length > 5 * 1024 * 1024) {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'JSON file too large (>5MB)'
        });
        return null;
      }
      
      // Check for null bytes
      if (content.includes('\u0000')) {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Null bytes detected in JSON'
        });
        return null;
      }
      
      // Try to parse JSON
      try {
        return JSON.parse(content);
      } catch {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Invalid JSON format'
        });
        return null;
      }
    } catch {
      // File doesn't exist or can't be read - this is ok, just return null
      return null;
    }
  }

  /**
   * Read text file content
   */
  async readTextFile(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}