/**
 * Logger utility for consistent output across the application
 * Provides methods for different log levels and supports chalk styling
 */

import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;

  /**
   * Set the global log level
   */
  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  /**
   * Sanitizes log messages to prevent exposure of sensitive information
   * @param message - Raw message that may contain sensitive data
   * @returns Sanitized message safe for logging
   */
  private static sanitizeMessage(message: string): string {
    let sanitized = message;

    // Remove or mask file paths with sensitive information
    sanitized = sanitized.replace(
      /\/Users\/[^/\s]+/g, 
      '/Users/[USER]'
    );
    sanitized = sanitized.replace(
      /\/home\/[^/\s]+/g, 
      '/home/[USER]'
    );
    sanitized = sanitized.replace(
      /C:\\Users\\[^\\\s]+/g, 
      'C:\\Users\\[USER]'
    );

    // Mask potential secrets and tokens
    sanitized = sanitized.replace(
      /(?:token|key|secret|password|pwd|pass)\s*[:=]\s*[^\s\]},;]+/gi,
      (match) => match.replace(/[^\s:=]{4,}/g, '[REDACTED]')
    );

    // Mask email addresses (keeping domain for context)
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
      '[EMAIL]@$1'
    );

    // Mask IP addresses (keeping last octet for context)
    sanitized = sanitized.replace(
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      'XXX.XXX.XXX.[IP]'
    );

    // Mask long alphanumeric strings that might be hashes or IDs
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9]{20,}\b/g, 
      '[HASH]'
    );

    // Remove internal system paths
    sanitized = sanitized.replace(
      /(?:\/usr\/local\/|\/opt\/|\/var\/lib\/|\/etc\/)[^\s]+/g,
      '[SYSTEM_PATH]'
    );

    return sanitized;
  }

  /**
   * Error message (always shown)
   */
  static error(message: string, error?: Error | unknown): void {
    const sanitizedMessage = Logger.sanitizeMessage(message);
    console.error(chalk.red(`❌ ${sanitizedMessage}`));
    if (error) {
      if (error instanceof Error) {
        const sanitizedErrorMessage = Logger.sanitizeMessage(error.message);
        console.error(chalk.red(sanitizedErrorMessage));
        if (Logger.logLevel >= LogLevel.DEBUG && error.stack) {
          const sanitizedStack = Logger.sanitizeMessage(error.stack);
          console.error(chalk.gray(sanitizedStack));
        }
      } else {
        const sanitizedError = Logger.sanitizeMessage(String(error));
        console.error(chalk.red(sanitizedError));
      }
    }
  }

  /**
   * Warning message
   */
  static warn(message: string): void {
    if (Logger.logLevel >= LogLevel.WARN) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      console.warn(chalk.yellow(`⚠️  ${sanitizedMessage}`));
    }
  }

  /**
   * Info message (default level)
   */
  static info(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      console.log(sanitizedMessage);
    }
  }

  /**
   * Success message
   */
  static success(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      console.log(chalk.green(`✅ ${sanitizedMessage}`));
    }
  }

  /**
   * Debug message (only shown in debug mode)
   */
  static debug(message: string): void {
    if (Logger.logLevel >= LogLevel.DEBUG) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      console.log(chalk.gray(`🔍 ${sanitizedMessage}`));
    }
  }

  /**
   * Tips and hints
   */
  static tip(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      console.log(chalk.cyan(`💡 ${sanitizedMessage}`));
    }
  }

  /**
   * Section header
   */
  static section(title: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedTitle = Logger.sanitizeMessage(title);
      console.log(chalk.blue(`
${sanitizedTitle}`));
    }
  }

  /**
   * List item
   */
  static item(label: string, value: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedLabel = Logger.sanitizeMessage(label);
      const sanitizedValue = Logger.sanitizeMessage(value);
      console.log(`  ${chalk.cyan(sanitizedLabel)} ${sanitizedValue}`);
    }
  }

  /**
   * Raw output (no formatting)
   */
  static raw(message: string): void {
    console.log(message);
  }
}