/**
 * Error handler utility for consistent error handling
 * Issue #46: Error handling improvement
 */

/* eslint-disable sonarjs/cognitive-complexity */
// Error handling requires complex conditional logic

import chalk from 'chalk';
import {
  ApplicationError,
  ConfigValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  ValidationError,
  getExitCode
} from '../errors/custom-errors';

export class ErrorHandler {
  /**
   * Display main error message
   */
  private static displayMainError(icon: string, type: string, message: string): void {
    console.error(chalk.red(`${icon} ${type}:`), message);
  }
  
  /**
   * Display warning or additional information
   */
  private static displayWarning(icon: string, content: string): void {
    console.warn(chalk.yellow(`${icon} ${content}`));
  }
  
  /**
   * Display debug information
   */
  private static displayDebugInfo(data: unknown, label: string = 'Debug Information'): void {
    if (process.env.DEBUG) {
      console.error(chalk.gray(`\n📊 ${label}:`));
      console.error(chalk.gray(typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
    }
  }
  
  /**
   * Display ConfigValidationError
   */
  private static displayConfigError(error: ConfigValidationError): void {
    this.displayMainError('❌', 'Configuration Error', error.message);
    this.displayWarning('💡', 'Tip: Check your .ai-instructions.json format');
    if (error.details) {
      this.displayDebugInfo(error.details);
    }
  }
  
  /**
   * Display FileSystemError
   */
  private static displayFileSystemError(error: FileSystemError): void {
    this.displayMainError('❌', 'File System Error', error.message);
    if (error.path) {
      this.displayWarning('📁', `Path: ${error.path}`);
    }
    this.displayWarning('💡', 'Tip: Check file permissions and path');
  }
  
  /**
   * Display NetworkError
   */
  private static displayNetworkError(error: NetworkError): void {
    this.displayMainError('❌', 'Network Error', error.message);
    if (error.statusCode) {
      this.displayWarning('🌐', `Status Code: ${error.statusCode}`);
    }
    this.displayWarning('💡', 'Tip: Check your internet connection and API endpoints');
  }
  
  /**
   * Display SecurityError
   */
  private static displaySecurityError(error: SecurityError): void {
    this.displayMainError('🔒', 'Security Error', error.message);
    this.displayWarning('⚠️ ', `Violation Type: ${error.violationType}`);
    if (error.context) {
      this.displayDebugInfo(`Context: ${error.context}`);
    }
  }
  
  /**
   * Display ValidationError
   */
  private static displayValidationError(error: ValidationError): void {
    this.displayMainError('❌', 'Validation Error', error.message);
    if (error.field) {
      this.displayWarning('📝', `Field: ${error.field}`);
    }
    if (error.value) {
      this.displayDebugInfo(`Value: ${JSON.stringify(error.value)}`);
    }
  }
  
  /**
   * Display unknown error
   */
  private static displayUnknownError(error: Error): void {
    console.error(chalk.red('❌ Unexpected Error:'), error);
    this.displayWarning('💡', 'Please report this issue: https://github.com/arkatom/ai-instructions/issues');
  }
  
  /**
   * Display generic debug info for errors
   */
  private static displayGenericDebugInfo(error: Error): void {
    if (!(error instanceof ApplicationError) || 
        (!('details' in error) && !('context' in error) && !('value' in error))) {
      this.displayDebugInfo(error.stack || error.toString());
    }
  }
  
  /**
   * Display error message and return exit code
   */
  static displayError(error: Error): number {
    const exitCode = getExitCode(error);
    
    if (error instanceof ConfigValidationError) {
      this.displayConfigError(error);
    } else if (error instanceof FileSystemError) {
      this.displayFileSystemError(error);
    } else if (error instanceof NetworkError) {
      this.displayNetworkError(error);
    } else if (error instanceof SecurityError) {
      this.displaySecurityError(error);
    } else if (error instanceof ValidationError) {
      this.displayValidationError(error);
    } else {
      this.displayUnknownError(error);
    }
    
    // Show debug info for all errors when DEBUG is set
    this.displayGenericDebugInfo(error);
    
    return exitCode;
  }
  
  /**
   * Handle errors with appropriate messages and exit codes
   */
  static handleError(error: Error): never {
    const exitCode = this.displayError(error);
    process.exit(exitCode);
  }
  
  /**
   * Handle command execution errors with type-safe error processing
   */
  static handleCommandError(
    error: unknown,
    context?: Record<string, unknown>,
    shouldExit: boolean = true
  ): { success: false; error: string } {
    const err = this.normalizeToError(error);
    
    // Display error
    const exitCode = this.displayError(err);
    
    // Log context in debug mode
    if (context) {
      this.displayDebugInfo(context, 'Context');
    }
    
    // Exit if required
    if (shouldExit) {
      process.exit(exitCode);
    }
    
    // Return error result for command
    return {
      success: false,
      error: this.formatUserMessage(err)
    };
  }
  
  /**
   * Execute an operation with retry logic using type-safe error handling
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeToError(error);
        
        // Don't retry for non-retryable errors
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }
        
        if (i < maxRetries - 1) {
          console.warn(chalk.yellow(`⏳ Retrying... (${i + 1}/${maxRetries})`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Determine if an error is retryable
   */
  static isRetryableError(error: Error): boolean {
    // Network errors are typically retryable
    if (error instanceof NetworkError) {
      return true;
    }
    
    // Some file system errors are retryable
    if (error instanceof FileSystemError) {
      const retryableMessages = ['ENOENT', 'EACCES', 'EMFILE', 'ENFILE'];
      return retryableMessages.some(msg => error.message.includes(msg));
    }
    
    // Generic network-related error messages
    const retryablePatterns = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'timeout',
      'socket hang up'
    ];
    
    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  /**
   * Wrap an async operation with error handling
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      // Wrap unknown errors using type-safe normalization
      const message = errorMessage || 'Operation failed';
      const normalizedError = this.normalizeToError(error);
      throw new ApplicationError('OPERATION_FAILED', `${message}: ${normalizedError.message}`);
    }
  }
  
  /**
   * Type-safe conversion of unknown value to Error object
   */
  static normalizeToError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (error && typeof error === 'object') {
      // Handle error-like objects
      const errorObj = error as Record<string, unknown>;
      const message = typeof errorObj.message === 'string' 
        ? errorObj.message 
        : 'Unknown error occurred';
      const stack = typeof errorObj.stack === 'string' ? errorObj.stack : undefined;
      
      const newError = new Error(message);
      if (stack) {
        newError.stack = stack;
      }
      return newError;
    }
    
    // Fallback for any other type
    return new Error(error != null ? String(error) : 'Unknown error occurred');
  }

  /**
   * Create a user-friendly error message
   */
  static formatUserMessage(error: Error): string {
    if (error instanceof ApplicationError) {
      return error.message;
    }
    
    // Simplify technical error messages
    const technicalPatterns = new Map([
      [/ENOENT.*no such file or directory/i, 'File or directory not found'],
      [/EACCES.*permission denied/i, 'Permission denied'],
      [/EEXIST.*file already exists/i, 'File already exists'],
      [/EISDIR.*illegal operation on a directory/i, 'Cannot perform this operation on a directory'],
      [/ENOTDIR.*not a directory/i, 'Path is not a directory'],
      [/EMFILE.*too many open files/i, 'Too many files open'],
      [/ENOSPC.*no space left on device/i, 'Not enough disk space'],
      [/EROFS.*read-only file system/i, 'File system is read-only']
    ]);
    
    for (const [pattern, message] of technicalPatterns) {
      if (pattern.test(error.message)) {
        return message;
      }
    }
    
    return error.message;
  }
}