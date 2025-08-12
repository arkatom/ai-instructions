/**
 * Error handler utility for consistent error handling
 * Issue #46: Error handling improvement
 */

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
   * Display ConfigValidationError
   */
  private static displayConfigError(error: ConfigValidationError): void {
    console.error(chalk.red('❌ Configuration Error:'), error.message);
    console.warn(chalk.yellow('💡 Tip: Check your .ai-instructions.json format'));
    if (error.details && process.env.DEBUG) {
      console.error(chalk.gray('\n📊 Debug Information:'));
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }
  }
  
  /**
   * Display FileSystemError
   */
  private static displayFileSystemError(error: FileSystemError): void {
    console.error(chalk.red('❌ File System Error:'), error.message);
    if (error.path) {
      console.warn(chalk.yellow(`📁 Path: ${error.path}`));
    }
    console.warn(chalk.yellow('💡 Tip: Check file permissions and path'));
  }
  
  /**
   * Display NetworkError
   */
  private static displayNetworkError(error: NetworkError): void {
    console.error(chalk.red('❌ Network Error:'), error.message);
    if (error.statusCode) {
      console.warn(chalk.yellow(`🌐 Status Code: ${error.statusCode}`));
    }
    console.warn(chalk.yellow('💡 Tip: Check your internet connection and API endpoints'));
  }
  
  /**
   * Display SecurityError
   */
  private static displaySecurityError(error: SecurityError): void {
    console.error(chalk.red('🔒 Security Error:'), error.message);
    console.warn(chalk.yellow(`⚠️  Violation Type: ${error.violationType}`));
    if (error.context && process.env.DEBUG) {
      console.error(chalk.gray('\n📊 Debug Information:'));
      console.error(chalk.gray(`Context: ${error.context}`));
    }
  }
  
  /**
   * Display ValidationError
   */
  private static displayValidationError(error: ValidationError): void {
    console.error(chalk.red('❌ Validation Error:'), error.message);
    if (error.field) {
      console.warn(chalk.yellow(`📝 Field: ${error.field}`));
    }
    if (error.value && process.env.DEBUG) {
      console.error(chalk.gray('\n📊 Debug Information:'));
      console.error(chalk.gray(`Value: ${JSON.stringify(error.value)}`));
    }
  }
  
  /**
   * Display unknown error
   */
  private static displayUnknownError(error: Error): void {
    console.error(chalk.red('❌ Unexpected Error:'), error);
    console.warn(chalk.yellow('💡 Please report this issue: https://github.com/arkatom/ai-instructions/issues'));
  }
  
  /**
   * Display debug info for errors
   */
  private static displayDebugInfo(error: Error): void {
    if (process.env.DEBUG) {
      if (!(error instanceof ApplicationError) || 
          (!('details' in error) && !('context' in error) && !('value' in error))) {
        console.error(chalk.gray('\n📊 Debug Information:'));
        console.error(chalk.gray(error.stack || error.toString()));
      }
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
    this.displayDebugInfo(error);
    
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
   * Handle command execution errors
   */
  static handleCommandError(
    error: unknown,
    context?: Record<string, unknown>,
    shouldExit: boolean = true
  ): { success: false; error: string } {
    const err = error as Error;
    
    // Display error
    const exitCode = this.displayError(err);
    
    // Log context in debug mode
    if (context && process.env.DEBUG) {
      console.error(chalk.gray('\n📊 Context:'));
      console.error(chalk.gray(JSON.stringify(context, null, 2)));
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
   * Execute an operation with retry logic
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
        lastError = error as Error;
        
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
      
      // Wrap unknown errors
      const message = errorMessage || 'Operation failed';
      throw new ApplicationError('OPERATION_FAILED', `${message}: ${(error as Error).message}`);
    }
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