/**
 * Custom error classes for better error handling
 * Issue #46: Error handling improvement
 */

/**
 * Base application error class
 */
export class ApplicationError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super('CONFIG_VALIDATION_ERROR', message);
  }
}

/**
 * File system operation error
 */
export class FileSystemError extends ApplicationError {
  constructor(
    message: string,
    public readonly path?: string
  ) {
    super('FILESYSTEM_ERROR', message);
  }
}

/**
 * Network request error
 */
export class NetworkError extends ApplicationError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super('NETWORK_ERROR', message);
  }
}

/**
 * Security violation error
 */
export class SecurityError extends ApplicationError {
  constructor(
    public readonly violationType: string,
    message: string,
    public readonly context?: string
  ) {
    super('SECURITY_ERROR', message);
  }
}

/**
 * Input validation error
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super('VALIDATION_ERROR', message);
  }
}

/**
 * Error codes for process exit
 */
export enum ErrorCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  CONFIG_ERROR = 2,
  FILESYSTEM_ERROR = 3,
  NETWORK_ERROR = 4,
  SECURITY_ERROR = 5,
  VALIDATION_ERROR = 6,
  UNKNOWN_ERROR = 99
}

/**
 * Maps error types to exit codes
 */
export function getExitCode(error: Error): number {
  if (error instanceof ConfigValidationError) {
    return ErrorCode.CONFIG_ERROR;
  }
  if (error instanceof FileSystemError) {
    return ErrorCode.FILESYSTEM_ERROR;
  }
  if (error instanceof NetworkError) {
    return ErrorCode.NETWORK_ERROR;
  }
  if (error instanceof SecurityError) {
    return ErrorCode.SECURITY_ERROR;
  }
  if (error instanceof ValidationError) {
    return ErrorCode.VALIDATION_ERROR;
  }
  if (error instanceof ApplicationError) {
    return ErrorCode.GENERAL_ERROR;
  }
  return ErrorCode.UNKNOWN_ERROR;
}