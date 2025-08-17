/**
 * Error Handling Utilities
 * Issue #93: Centralized error handling and logging helpers
 */

import { Logger } from './logger';

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Safe wrapper for operations that can throw
 */
export class SafeOperation {
  
  /**
   * Safely executes an async operation with logging
   * 
   * @param operation - The operation to execute
   * @param errorContext - Context for error logging
   * @returns Result with success/error state
   */
  static async execute<T>(
    operation: () => Promise<T>,
    errorContext: string
  ): Promise<Result<T>> {
    try {
      const value = await operation();
      return { success: true, value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`${errorContext}: ${errorMessage}`);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Safely executes a sync operation with logging
   * 
   * @param operation - The operation to execute
   * @param errorContext - Context for error logging
   * @returns Result with success/error state
   */
  static executeSync<T>(
    operation: () => T,
    errorContext: string
  ): Result<T> {
    try {
      const value = operation();
      return { success: true, value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`${errorContext}: ${errorMessage}`);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  
  /**
   * Safely parses JSON with proper error handling
   * 
   * @param jsonString - JSON string to parse
   * @param filePath - File path for error context
   * @returns Parsed object or null on error
   */
  static parseJson<T = unknown>(jsonString: string, filePath?: string): T | null {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      const context = filePath ? `Failed to parse JSON from ${filePath}` : 'Failed to parse JSON';
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`${context}: ${errorMessage}`);
      return null;
    }
  }
  
  /**
   * Safely reads and parses a file
   * 
   * @param filePath - Path to the file
   * @param readOperation - Function to read the file
   * @returns File contents or null on error
   */
  static async readFile<T>(
    filePath: string,
    readOperation: () => Promise<string>
  ): Promise<T | null> {
    try {
      const content = await readOperation();
      return this.parseJson<T>(content, filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to read file ${filePath}: ${errorMessage}`);
      return null;
    }
  }
}

/**
 * Error formatting utilities
 */
export class ErrorFormatter {
  
  /**
   * Creates a user-friendly error message
   * 
   * @param error - The error to format
   * @param operation - The operation that failed
   * @returns Formatted error message
   */
  static formatError(error: unknown, operation: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Common error patterns and their user-friendly messages
    if (errorMessage.includes('ENOENT')) {
      return `${operation} failed: File or directory not found`;
    }
    
    if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
      return `${operation} failed: Permission denied`;
    }
    
    if (errorMessage.includes('ENOTDIR')) {
      return `${operation} failed: Not a directory`;
    }
    
    if (errorMessage.includes('EISDIR')) {
      return `${operation} failed: Is a directory`;
    }
    
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      return `${operation} failed: Invalid JSON format`;
    }
    
    return `${operation} failed: ${errorMessage}`;
  }
  
  /**
   * Extracts meaningful error information for logging
   * 
   * @param error - The error to analyze
   * @returns Error details object
   */
  static extractErrorDetails(error: unknown): {
    message: string;
    code?: string;
    stack?: string;
  } {
    if (error instanceof Error) {
      const details: { message: string; code?: string; stack?: string } = {
        message: error.message
      };
      
      if ('code' in error && error.code) {
        details.code = String(error.code);
      }
      
      if (error.stack) {
        details.stack = error.stack;
      }
      
      return details;
    }
    
    return {
      message: String(error)
    };
  }
}