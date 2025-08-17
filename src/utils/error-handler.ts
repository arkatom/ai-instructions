/**
 * Error handler utility for consistent error handling
 * Issue #46: Error handling improvement
 */

// Error handling with reduced complexity using strategy pattern

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

/**
 * Error display strategy interface
 */
interface ErrorDisplayStrategy {
  display(error: Error): void;
}

/**
 * Base error display strategy with common functionality
 */
abstract class BaseErrorDisplay implements ErrorDisplayStrategy {
  protected displayMainError(icon: string, type: string, message: string): void {
    console.error(chalk.red(`${icon} ${type}:`), message);
  }
  
  protected displayWarning(icon: string, content: string): void {
    console.warn(chalk.yellow(`${icon} ${content}`));
  }
  
  static displayDebugInfo(data: unknown, label: string = 'Debug Information'): void {
    if (process.env.DEBUG) {
      console.error(chalk.gray(`\n📊 ${label}:`));
      console.error(chalk.gray(typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
    }
  }

  abstract display(error: Error): void;
}

/**
 * Configuration error display strategy
 */
class ConfigErrorDisplay extends BaseErrorDisplay {
  display(error: ConfigValidationError): void {
    this.displayMainError('❌', 'Configuration Error', error.message);
    this.displayWarning('💡', 'Tip: Check your .ai-instructions.json format');
    if (error.details) {
      BaseErrorDisplay.displayDebugInfo(error.details);
    }
  }
}

/**
 * File system error display strategy
 */
class FileSystemErrorDisplay extends BaseErrorDisplay {
  display(error: FileSystemError): void {
    this.displayMainError('❌', 'File System Error', error.message);
    if (error.path) {
      this.displayWarning('📁', `Path: ${error.path}`);
    }
    this.displayWarning('💡', 'Tip: Check file permissions and path');
  }
}

/**
 * Network error display strategy
 */
class NetworkErrorDisplay extends BaseErrorDisplay {
  display(error: NetworkError): void {
    this.displayMainError('❌', 'Network Error', error.message);
    if (error.statusCode) {
      this.displayWarning('🌐', `Status Code: ${error.statusCode}`);
    }
    this.displayWarning('💡', 'Tip: Check your internet connection and API endpoints');
  }
}

/**
 * Security error display strategy
 */
class SecurityErrorDisplay extends BaseErrorDisplay {
  display(error: SecurityError): void {
    this.displayMainError('🔒', 'Security Error', error.message);
    this.displayWarning('⚠️ ', `Violation Type: ${error.violationType}`);
    if (error.context) {
      BaseErrorDisplay.displayDebugInfo(`Context: ${error.context}`);
    }
  }
}

/**
 * Validation error display strategy
 */
class ValidationErrorDisplay extends BaseErrorDisplay {
  display(error: ValidationError): void {
    this.displayMainError('❌', 'Validation Error', error.message);
    if (error.field) {
      this.displayWarning('📝', `Field: ${error.field}`);
    }
    if (error.value) {
      BaseErrorDisplay.displayDebugInfo(`Value: ${JSON.stringify(error.value)}`);
    }
  }
}

/**
 * Unknown error display strategy
 */
class UnknownErrorDisplay extends BaseErrorDisplay {
  display(error: Error): void {
    console.error(chalk.red('❌ Unexpected Error:'), error);
    this.displayWarning('💡', 'Please report this issue: https://github.com/arkatom/ai-instructions/issues');
  }
}

export class ErrorHandler {
  /**
   * Error display strategies map
   */
  private static readonly ERROR_DISPLAY_STRATEGIES = new Map<string, ErrorDisplayStrategy>([
    ['ConfigValidationError', new ConfigErrorDisplay()],
    ['FileSystemError', new FileSystemErrorDisplay()],
    ['NetworkError', new NetworkErrorDisplay()],
    ['SecurityError', new SecurityErrorDisplay()],
    ['ValidationError', new ValidationErrorDisplay()],
    ['default', new UnknownErrorDisplay()]
  ]);
  
  /**
   * Get appropriate error display strategy
   */
  private static getErrorDisplayStrategy(error: Error): ErrorDisplayStrategy {
    const errorType = error.constructor.name;
    return this.ERROR_DISPLAY_STRATEGIES.get(errorType) || 
           this.ERROR_DISPLAY_STRATEGIES.get('default')!;
  }
  

  /**
   * Display generic debug info for errors
   */
  private static displayGenericDebugInfo(error: Error): void {
    if (!(error instanceof ApplicationError) || 
        (!('details' in error) && !('context' in error) && !('value' in error))) {
      BaseErrorDisplay.displayDebugInfo(error.stack || error.toString());
    }
  }
  
  /**
   * Display error message and return exit code
   */
  static displayError(error: Error): number {
    const exitCode = getExitCode(error);
    
    // Use strategy pattern to display error
    const strategy = this.getErrorDisplayStrategy(error);
    strategy.display(error);
    
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
      BaseErrorDisplay.displayDebugInfo(context, 'Context');
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
    return this.isNetworkErrorRetryable(error) ||
           this.isFileSystemErrorRetryable(error) ||
           this.hasRetryableNetworkPattern(error);
  }

  /**
   * Check if network error is retryable
   */
  private static isNetworkErrorRetryable(error: Error): boolean {
    return error instanceof NetworkError;
  }

  /**
   * Check if file system error is retryable
   */
  private static isFileSystemErrorRetryable(error: Error): boolean {
    if (!(error instanceof FileSystemError)) {
      return false;
    }
    
    const retryableMessages = ['ENOENT', 'EACCES', 'EMFILE', 'ENFILE'];
    return retryableMessages.some(msg => error.message.includes(msg));
  }

  /**
   * Check if error message contains retryable network patterns
   */
  private static hasRetryableNetworkPattern(error: Error): boolean {
    const retryablePatterns = [
      'ETIMEDOUT',
      'ECONNREFUSED', 
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'timeout',
      'socket hang up'
    ];
    
    const message = error.message.toLowerCase();
    return retryablePatterns.some(pattern => 
      message.includes(pattern.toLowerCase())
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
   * Extract message from error object
   */
  private static extractErrorMessage(errorObj: Record<string, unknown>): string {
    return typeof errorObj.message === 'string' 
      ? errorObj.message 
      : 'Unknown error occurred';
  }

  /**
   * Create error from object
   */
  private static createErrorFromObject(errorObj: Record<string, unknown>): Error {
    const message = this.extractErrorMessage(errorObj);
    const stack = typeof errorObj.stack === 'string' ? errorObj.stack : undefined;
    
    const newError = new Error(message);
    if (stack) {
      newError.stack = stack;
    }
    return newError;
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
      return this.createErrorFromObject(error as Record<string, unknown>);
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