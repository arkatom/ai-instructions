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
  ValidationError,
  ApplicationError
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

  describe('handleCommandError', () => {
    test('should display error and exit when shouldExit is true', () => {
      const error = new ConfigValidationError('Command failed');
      const context = { command: 'test-command', args: ['--test'] };
      
      expect(() => ErrorHandler.handleCommandError(error, context, true)).toThrow('process.exit(2)');
      expect(mockProcessExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Configuration Error:'),
        'Command failed'
      );
    });

    test('should display error and return result when shouldExit is false', () => {
      const error = new FileSystemError('File not found', '/test/path');
      const context = { operation: 'read' };
      
      const result = ErrorHandler.handleCommandError(error, context, false);
      
      expect(result).toEqual({
        success: false,
        error: 'File not found'
      });
      expect(mockProcessExit).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ File System Error:'),
        'File not found'
      );
    });

    test('should display context in debug mode', () => {
      process.env.DEBUG = 'true';
      const error = new NetworkError('Request failed', 500);
      const context = { url: 'http://example.com', timeout: 5000 };
      
      const result = ErrorHandler.handleCommandError(error, context, false);
      
      expect(result).toEqual({
        success: false,
        error: 'Request failed'
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.gray('\n📊 Context:')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.gray(JSON.stringify(context, null, 2))
      );
      
      delete process.env.DEBUG;
    });

    test('should not display context when DEBUG is not set', () => {
      delete process.env.DEBUG;
      const error = new SecurityError('path_traversal', 'Unauthorized access');
      const context = { path: '../../../etc/passwd' };
      
      const result = ErrorHandler.handleCommandError(error, context, false);
      
      expect(result).toEqual({
        success: false,
        error: 'Unauthorized access'
      });
      // Should not show context debug info
      const contextCalls = mockConsoleError.mock.calls.filter(call => 
        call[0] === chalk.gray('\n📊 Context:')
      );
      expect(contextCalls).toHaveLength(0);
    });

    test('should work without context parameter', () => {
      const error = new ValidationError('Invalid input', 'email');
      
      const result = ErrorHandler.handleCommandError(error, undefined, false);
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid input'
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        chalk.red('❌ Validation Error:'),
        'Invalid input'
      );
    });

    test('should use default shouldExit value of true', () => {
      const error = new ApplicationError('TEST_ERROR', 'Test message');
      
      expect(() => ErrorHandler.handleCommandError(error)).toThrow('process.exit(1)');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
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

    test('should identify retryable file system errors', () => {
      expect(ErrorHandler.isRetryableError(new FileSystemError('EACCES'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new FileSystemError('EMFILE'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new FileSystemError('ENFILE'))).toBe(true);
    });

    test('should identify retryable network error patterns', () => {
      expect(ErrorHandler.isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new Error('ENOTFOUND'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new Error('socket hang up'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new Error('EAI_AGAIN'))).toBe(true);
      expect(ErrorHandler.isRetryableError(new Error('ENETUNREACH'))).toBe(true);
    });
  });

  describe('wrapAsync', () => {
    test('should return result on successful operation', async () => {
      const operation = () => Promise.resolve('success');
      
      const result = await ErrorHandler.wrapAsync(operation);
      
      expect(result).toBe('success');
    });

    test('should preserve ApplicationError when thrown', async () => {
      const configError = new ConfigValidationError('Invalid config');
      const operation = () => Promise.reject(configError);
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow(ConfigValidationError);
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow('Invalid config');
    });

    test('should wrap unknown error in ApplicationError', async () => {
      const operation = () => Promise.reject(new Error('Unknown error'));
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow(ApplicationError);
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow('Operation failed: Unknown error');
    });

    test('should use custom error message when provided', async () => {
      const operation = () => Promise.reject(new Error('Database connection failed'));
      
      await expect(ErrorHandler.wrapAsync(operation, 'Database operation failed'))
        .rejects.toThrow('Database operation failed: Database connection failed');
    });

    test('should handle non-error rejections', async () => {
      const operation = () => Promise.reject('String rejection');
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow('Operation failed: String rejection');
    });

    test('should handle null/undefined rejections', async () => {
      const operation = () => Promise.reject(null);
      
      await expect(ErrorHandler.wrapAsync(operation))
        .rejects.toThrow(ApplicationError);
    });
  });

  describe('formatUserMessage', () => {
    test('should return message for ApplicationError', () => {
      const error = new ConfigValidationError('Invalid configuration');
      const formatted = ErrorHandler.formatUserMessage(error);
      expect(formatted).toBe('Invalid configuration');
    });

    test('should simplify file system error messages', () => {
      const enoentError = new Error('ENOENT: no such file or directory, open \'/path/file.txt\'');
      const formatted = ErrorHandler.formatUserMessage(enoentError);
      expect(formatted).toBe('File or directory not found');
    });

    test('should simplify permission error messages', () => {
      const eaccesError = new Error('EACCES: permission denied, mkdir \'/root/test\'');
      const formatted = ErrorHandler.formatUserMessage(eaccesError);
      expect(formatted).toBe('Permission denied');
    });

    test('should simplify file exists error messages', () => {
      const eexistError = new Error('EEXIST: file already exists, mkdir \'/path/dir\'');
      const formatted = ErrorHandler.formatUserMessage(eexistError);
      expect(formatted).toBe('File already exists');
    });

    test('should handle directory operation error messages', () => {
      const eisdirError = new Error('EISDIR: illegal operation on a directory, read');
      const formatted = ErrorHandler.formatUserMessage(eisdirError);
      expect(formatted).toBe('Cannot perform this operation on a directory');
    });

    test('should handle disk space error messages', () => {
      const enospcError = new Error('ENOSPC: no space left on device, write');
      const formatted = ErrorHandler.formatUserMessage(enospcError);
      expect(formatted).toBe('Not enough disk space');
    });

    test('should handle read-only filesystem error messages', () => {
      const erofsError = new Error('EROFS: read-only file system, mkdir \'/path\'');
      const formatted = ErrorHandler.formatUserMessage(erofsError);
      expect(formatted).toBe('File system is read-only');
    });

    test('should return original message for unrecognized errors', () => {
      const customError = new Error('Custom error message');
      const formatted = ErrorHandler.formatUserMessage(customError);
      expect(formatted).toBe('Custom error message');
    });
  });
});