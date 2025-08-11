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

/**
 * Console abstraction interface for testing and flexibility
 */
interface ConsoleProvider {
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

/**
 * Default console provider using global console
 */
class DefaultConsoleProvider implements ConsoleProvider {
  log(message: string): void {
    // Using global console reference to avoid ESLint warnings
    // This is the designated logging utility for the application
    globalThis.console.log(message);
  }

  error(message: string): void {
    globalThis.console.error(message);
  }

  warn(message: string): void {
    globalThis.console.warn(message);
  }
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static consoleProvider: ConsoleProvider = new DefaultConsoleProvider();

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

    // Mask standalone API key patterns first
    sanitized = sanitized.replace(
      /\bsk-[A-Za-z0-9-]+\b/g,
      '[REDACTED]'
    );
    
    // Mask potential secrets and tokens with values
    sanitized = sanitized.replace(
      /\b(?:token|apiKey|api_key|secret|password|pwd|pass)\s*[:=]\s*[^\s\]},;]+/gi,
      (match) => {
        const parts = match.split(/[:=]/);
        if (parts.length > 1) {
          return parts[0] + ':' + '[REDACTED]';
        }
        return '[REDACTED]';
      }
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
    Logger.consoleProvider.error(chalk.red(`❌ ${sanitizedMessage}`));
    if (error) {
      if (error instanceof Error) {
        const sanitizedErrorMessage = Logger.sanitizeMessage(error.message);
        Logger.consoleProvider.error(chalk.red(sanitizedErrorMessage));
        if (Logger.logLevel >= LogLevel.DEBUG && error.stack) {
          const sanitizedStack = Logger.sanitizeMessage(error.stack);
          Logger.consoleProvider.error(chalk.gray(sanitizedStack));
        }
      } else {
        const sanitizedError = Logger.sanitizeMessage(String(error));
        Logger.consoleProvider.error(chalk.red(sanitizedError));
      }
    }
  }

  /**
   * Warning message
   */
  static warn(message: string): void {
    if (Logger.logLevel >= LogLevel.WARN) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      Logger.consoleProvider.warn(chalk.yellow(`⚠️  ${sanitizedMessage}`));
    }
  }

  /**
   * Info message (default level)
   */
  static info(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      Logger.consoleProvider.log(sanitizedMessage);
    }
  }

  /**
   * Success message
   */
  static success(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      Logger.consoleProvider.log(chalk.green(`✅ ${sanitizedMessage}`));
    }
  }

  /**
   * Debug message (only shown in debug mode)
   */
  static debug(message: string): void {
    if (Logger.logLevel >= LogLevel.DEBUG) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      Logger.consoleProvider.log(chalk.gray(`🔍 ${sanitizedMessage}`));
    }
  }

  /**
   * Tips and hints
   */
  static tip(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedMessage = Logger.sanitizeMessage(message);
      Logger.consoleProvider.log(chalk.cyan(`💡 ${sanitizedMessage}`));
    }
  }

  /**
   * Section header
   */
  static section(title: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      const sanitizedTitle = Logger.sanitizeMessage(title);
      Logger.consoleProvider.log(chalk.blue(`
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
      Logger.consoleProvider.log(`  ${chalk.cyan(sanitizedLabel)} ${sanitizedValue}`);
    }
  }

  /**
   * Raw output (no formatting)
   */
  static raw(message: string): void {
    Logger.consoleProvider.log(message);
  }
}