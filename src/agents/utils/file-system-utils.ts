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
  } catch {
    // Any error means file is not accessible
    return false;
  }
}

/**
 * Validate JSON content
 */
function validateJsonContent<T>(
  content: string,
  fileName: string
): JsonReadResult<T> {
  const errors: FileError[] = [];
  
  // Check for empty file
  if (!content || content.trim() === '') {
    errors.push({ file: fileName, error: 'Empty JSON file' });
    return { data: null, errors };
  }
  
  // Check for file size (5MB limit)
  if (content.length > 5 * 1024 * 1024) {
    errors.push({ file: fileName, error: 'JSON file too large (>5MB)' });
    return { data: null, errors };
  }
  
  // Check for null bytes
  if (content.includes('\u0000')) {
    errors.push({ file: fileName, error: 'Null bytes detected in JSON' });
    return { data: null, errors };
  }
  
  // Try to parse JSON
  try {
    const data = JSON.parse(content) as T;
    return { data, errors };
  } catch {
    errors.push({ file: fileName, error: 'Invalid JSON format' });
    return { data: null, errors };
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
  const fileName = filePath.split('/').pop() || filePath;

  try {
    const content = await readFile(filePath, 'utf-8');
    return validateJsonContent<T>(content, fileName);
  } catch (error) {
    // File access error
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // File doesn't exist - this is ok
      return { data: null, errors: [] };
    }
    return { 
      data: null, 
      errors: [{ 
        file: fileName, 
        error: `File read error: ${error instanceof Error ? error.message : 'Unknown'}`
      }]
    };
  }
}

/**
 * Read text file content
 * @param filePath - Path to the text file
 * @returns Promise<string | null>
 */
export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Check for null bytes for security
    if (content && content.includes('\u0000')) {
      console.warn(`Null bytes detected in text file ${filePath}`);
      return null;
    }
    
    return content;
  } catch (error) {
    // Log the actual error for debugging while returning null
    // ENOENT is expected, other errors might indicate issues
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.warn(`Failed to read text file ${filePath}: ${error.message}`);
    }
    return null;
  }
}