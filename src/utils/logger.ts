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
   * Error message (always shown)
   */
  static error(message: string, error?: Error | unknown): void {
    console.error(chalk.red(`❌ ${message}`));
    if (error) {
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
        if (Logger.logLevel >= LogLevel.DEBUG && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      } else {
        console.error(chalk.red(String(error)));
      }
    }
  }

  /**
   * Warning message
   */
  static warn(message: string): void {
    if (Logger.logLevel >= LogLevel.WARN) {
      console.warn(chalk.yellow(`⚠️  ${message}`));
    }
  }

  /**
   * Info message (default level)
   */
  static info(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      console.log(message);
    }
  }

  /**
   * Success message
   */
  static success(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      console.log(chalk.green(`✅ ${message}`));
    }
  }

  /**
   * Debug message (only shown in debug mode)
   */
  static debug(message: string): void {
    if (Logger.logLevel >= LogLevel.DEBUG) {
      console.log(chalk.gray(`🔍 ${message}`));
    }
  }

  /**
   * Tips and hints
   */
  static tip(message: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      console.log(chalk.cyan(`💡 ${message}`));
    }
  }

  /**
   * Section header
   */
  static section(title: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      console.log(chalk.blue(`\n${title}`));
    }
  }

  /**
   * List item
   */
  static item(label: string, value: string): void {
    if (Logger.logLevel >= LogLevel.INFO) {
      console.log(`  ${chalk.cyan(label)} ${value}`);
    }
  }

  /**
   * Raw output (no formatting)
   */
  static raw(message: string): void {
    console.log(message);
  }
}