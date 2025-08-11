/**
 * Unified error handling utility
 * Issue #67: Standardize error handling across CLI commands
 */

import { SecurityError } from './security';
import { Logger } from './logger';
import { InteractiveUtils } from '../init/interactive';
import { CommandResult } from '../cli/interfaces/CommandResult';

/**
 * Error types for categorization
 */
export enum ErrorType {
  SECURITY = 'security',
  VALIDATION = 'validation',
  FILE_SYSTEM = 'filesystem', 
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown'
}

/**
 * Error context for detailed error handling
 */
export interface ErrorContext {
  operation: string;
  details?: string;
  suggestions?: string[];
  isRecoverable?: boolean;
}

/**
 * Unified error handler for CLI commands
 */
export class ErrorHandler {
  /**
   * Handle errors uniformly across CLI commands
   * @param error - The error to handle
   * @param context - Optional context for better error messages
   * @param isTestEnvironment - Whether we're in test mode (throws instead of logging)
   * @returns CommandResult for CLI commands
   */
  static handleCommandError(
    error: unknown, 
    context?: ErrorContext, 
    isTestEnvironment?: boolean
  ): CommandResult {
    // In test environment, re-throw for proper test handling
    // Explicit isTestEnvironment parameter takes precedence
    if (isTestEnvironment === true || (isTestEnvironment === undefined && process.env.NODE_ENV === 'test')) {
      throw error;
    }

    const errorType = this.categorizeError(error);
    const errorMessage = this.formatErrorMessage(error, errorType, context);
    
    // Log appropriate level based on error type
    switch (errorType) {
      case ErrorType.SECURITY:
        Logger.error(errorMessage);
        if (error instanceof SecurityError && error.details) {
          Logger.debug(`Security details: ${error.details}`);
        }
        break;
      
      case ErrorType.VALIDATION:
        Logger.warn(errorMessage);
        break;
        
      case ErrorType.FILE_SYSTEM:
        Logger.error(errorMessage);
        break;
        
      default:
        Logger.error(errorMessage);
        
        // Provide interactive mode tip for general errors
        if (!InteractiveUtils.canRunInteractive()) {
          Logger.tip('Interactive mode unavailable. Use command-line options.');
        }
    }

    // Add suggestions if provided
    if (context?.suggestions) {
      context.suggestions.forEach(suggestion => Logger.tip(suggestion));
    }

    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * Categorize error by type for appropriate handling
   */
  private static categorizeError(error: unknown): ErrorType {
    if (error instanceof SecurityError) {
      return ErrorType.SECURITY;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('validation') || message.includes('invalid')) {
        return ErrorType.VALIDATION;
      }
      
      if (message.includes('enoent') || message.includes('file') || message.includes('directory')) {
        return ErrorType.FILE_SYSTEM;
      }
      
      if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return ErrorType.NETWORK;
      }
      
      if (message.includes('config') || message.includes('setting')) {
        return ErrorType.CONFIGURATION;
      }
    }
    
    return ErrorType.UNKNOWN;
  }

  /**
   * Format error message consistently
   */
  private static formatErrorMessage(
    error: unknown, 
    errorType: ErrorType, 
    context?: ErrorContext
  ): string {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const operation = context?.operation ? ` during ${context.operation}` : '';
    
    switch (errorType) {
      case ErrorType.SECURITY:
        return `Security violation${operation}: ${baseMessage}`;
        
      case ErrorType.VALIDATION:
        return `Validation error${operation}: ${baseMessage}`;
        
      case ErrorType.FILE_SYSTEM:
        return `File system error${operation}: ${baseMessage}`;
        
      case ErrorType.NETWORK:
        return `Network error${operation}: ${baseMessage}`;
        
      case ErrorType.CONFIGURATION:
        return `Configuration error${operation}: ${baseMessage}`;
        
      default:
        return `Error${operation}: ${baseMessage}`;
    }
  }

  /**
   * Handle validation errors specifically
   */
  static handleValidationError(
    errors: string[], 
    operation?: string
  ): CommandResult {
    const errorMessage = `Validation failed${operation ? ` during ${operation}` : ''}: ${errors.join('; ')}`;
    Logger.warn(errorMessage);
    
    return {
      success: false,
      error: errorMessage
    };
  }

  /**
   * Handle security errors with extra details
   */
  static handleSecurityError(
    error: SecurityError, 
    operation?: string
  ): CommandResult {
    const errorMessage = `Security violation${operation ? ` during ${operation}` : ''}: ${error.message}`;
    
    Logger.error(errorMessage);
    
    if (error.details) {
      Logger.debug(`Security details: ${error.details}`);
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}