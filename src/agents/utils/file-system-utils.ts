/**
 * File System Utilities
 * Utility functions for file system operations with error handling
 * Note: These functions perform filesystem I/O operations
 */

import { readFile, stat } from 'fs/promises';

/**
 * Error information for file operations
 */
export interface FileError {
  file: string;
  error: string;
}

/**
 * Result of JSON file reading operation
 */
export interface JsonReadResult<T = Record<string, unknown>> {
  data: T | null;
  errors: FileError[];
}

/**
 * Check if a file exists
 * @param filePath - Path to the file
 * @returns Promise<boolean>
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    // ENOENT is expected when file doesn't exist
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    // For other errors (permission issues, etc.), file is not accessible
    return false;
  }
}

/**
 * Read and parse a JSON file with comprehensive error handling
 * @param filePath - Path to the JSON file
 * @returns Promise<JsonReadResult>
 */
export async function readJsonFile<T = Record<string, unknown>>(
  filePath: string
): Promise<JsonReadResult<T>> {
  const errors: FileError[] = [];
  const fileName = filePath.split('/').pop() || filePath;

  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Check for empty file
    if (!content || content.trim() === '') {
      errors.push({
        file: fileName,
        error: 'Empty JSON file'
      });
      return { data: null, errors };
    }
    
    // Check for file size (5MB limit)
    if (content.length > 5 * 1024 * 1024) {
      errors.push({
        file: fileName,
        error: 'JSON file too large (>5MB)'
      });
      return { data: null, errors };
    }
    
    // Check for null bytes
    if (content.includes('\u0000')) {
      errors.push({
        file: fileName,
        error: 'Null bytes detected in JSON'
      });
      return { data: null, errors };
    }
    
    // Try to parse JSON
    try {
      const data = JSON.parse(content) as T;
      return { data, errors };
    } catch (parseError) {
      errors.push({
        file: fileName,
        error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
      });
      return { data: null, errors };
    }
  } catch (error) {
    // File access error - report the specific issue
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        // File doesn't exist - this is ok, just return null
        return { data: null, errors };
      }
      errors.push({
        file: fileName,
        error: `File read error: ${error.message}`
      });
    }
    return { data: null, errors };
  }
}

/**
 * Read text file content
 * @param filePath - Path to the text file
 * @returns Promise<string | null>
 */
export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    // Log the actual error for debugging while returning null
    // ENOENT is expected, other errors might indicate issues
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.warn(`Failed to read text file ${filePath}: ${error.message}`);
    }
    return null;
  }
}