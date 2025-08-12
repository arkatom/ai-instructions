/**
 * Test suite for ErrorHandler utility
 * Issue #46: Error handling improvement
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ErrorHandler } from '../../src/utils/error-handler';
import {
  ConfigValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  ValidationError
} from '../../src/errors/custom-errors';
import chalk from 'chalk';

describe('ErrorHandler', () => {
  let mockConsoleError: jest.SpiedFunction<typeof console.error>;
  let mockConsoleWarn: jest.SpiedFunction<typeof console.warn>;
  let mockProcessExit: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    // Mock console methods for each test
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Create a custom mock for process.exit that doesn't actually exit
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('displayError', () => {
    test('should handle ConfigValidationError correctly', () => {
      const error = new ConfigValidationError('Invalid configuration', { field: 'test' });
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Configuration Error:'),
        'Invalid configuration'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('💡 Tip: Check your .ai-instructions.json format')
      );
    });

    test('should handle FileSystemError with path', () => {
      const error = new FileSystemError('File not found', '/path/to/file');
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(3);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ File System Error:'),
        'File not found'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('📁 Path: /path/to/file')
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('💡 Tip: Check file permissions and path')
      );
    });

    test('should handle NetworkError with status code', () => {
      const error = new NetworkError('Request failed', 404);
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(4);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Network Error:'),
        'Request failed'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('🌐 Status Code: 404')
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('💡 Tip: Check your internet connection and API endpoints')
      );
    });

    test('should handle SecurityError', () => {
      const error = new SecurityError('path_traversal', 'Unauthorized access', '../../../etc');
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(5);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('🔒 Security Error:'),
        'Unauthorized access'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('⚠️  Violation Type: path_traversal')
      );
    });

    test('should handle ValidationError with field info', () => {
      const error = new ValidationError('Invalid input', 'email', 'not-an-email');
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(6);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Validation Error:'),
        'Invalid input'
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('📝 Field: email')
      );
    });

    test('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(99);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Unexpected Error:'),
        error
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('💡 Please report this issue: https://github.com/arkatom/ai-instructions/issues')
      );
    });

    test('should show debug info when DEBUG env is set', () => {
      process.env.DEBUG = 'true';
      const error = new ConfigValidationError('Test error', { testData: 'value' });
      
      const exitCode = ErrorHandler.displayError(error);
      
      expect(exitCode).toBe(2);
      
      // Should include debug information - check if the debug line was called
      const calls = mockConsoleError.mock.calls;
      const hasDebugInfo = calls.some(call => 
        call[0] === chalk.gray('\n📊 Debug Information:')
      );
      expect(hasDebugInfo).toBe(true);
      
      delete process.env.DEBUG;
    });
  });

  describe('handleError', () => {
    test('should call process.exit with correct code', () => {
      const error = new ConfigValidationError('Test error');
      
      expect(() => ErrorHandler.handleError(error)).toThrow('process.exit(2)');
      expect(mockProcessExit).toHaveBeenCalledWith(2);
    });
  });

  describe('handleWithRetry', () => {
    test('should succeed on first try', async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue('success');
      
      const result = await ErrorHandler.handleWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and succeed', async () => {
      const operation = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new NetworkError('fail 1'))  // Use retryable error
        .mockRejectedValueOnce(new NetworkError('fail 2'))  // Use retryable error
        .mockResolvedValue('success');
      
      const result = await ErrorHandler.handleWithRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('⏳ Retrying... (1/3)')
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        chalk.yellow('⏳ Retrying... (2/3)')
      );
    });

    test('should throw after max retries', async () => {
      const error = new NetworkError('persistent failure');  // Use retryable error
      const operation = jest.fn<() => Promise<void>>().mockRejectedValue(error);
      
      await expect(ErrorHandler.handleWithRetry(operation, 3, 10))
        .rejects.toThrow('persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should not retry for non-retryable errors', async () => {
      const error = new ValidationError('Invalid input');
      const operation = jest.fn<() => Promise<void>>().mockRejectedValue(error);
      
      await expect(ErrorHandler.handleWithRetry(operation, 3, 10))
        .rejects.toThrow('Invalid input');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable errors', () => {
      expect(ErrorHandler.isRetryableError(new NetworkError('timeout'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new FileSystemError('ENOENT'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    test('should identify non-retryable errors', () => {
      expect(ErrorHandler.isRetryableError(new ValidationError('invalid'))).toBe(false);
      expect(ErrorHandler.isRetryableError(new ConfigValidationError('invalid'))).toBe(false);
      expect(ErrorHandler.isRetryableError(new SecurityError('violation', 'test'))).toBe(false);
    });
  });
});