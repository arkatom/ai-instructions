/**
 * Unified error handler tests
 * Issue #67: Standardize error handling across CLI commands
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ErrorHandler } from '../../src/utils/error-handler';
import { SecurityError } from '../../src/utils/security';

// Mock the Logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  Logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    tip: jest.fn()
  }
}));

// Mock InteractiveUtils
jest.mock('../../src/init/interactive', () => ({
  InteractiveUtils: {
    canRunInteractive: jest.fn().mockReturnValue(false)
  }
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCommandError', () => {
    it('should re-throw error in test environment', () => {
      const error = new Error('Test error');
      
      expect(() => {
        ErrorHandler.handleCommandError(error, undefined, true);
      }).toThrow('Test error');
    });

    it('should handle SecurityError with special formatting', () => {
      const securityError = new SecurityError('path_traversal', 'Path traversal detected', 'details');
      
      const result = ErrorHandler.handleCommandError(securityError, { operation: 'file validation' }, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Security violation during file validation: Path traversal detected');
    });

    it('should handle validation errors', () => {
      const validationError = new Error('Invalid project name');
      
      const result = ErrorHandler.handleCommandError(validationError, undefined, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error: Invalid project name');
    });

    it('should handle file system errors', () => {
      const fileError = new Error('ENOENT: no such file or directory');
      
      const result = ErrorHandler.handleCommandError(fileError, { operation: 'file creation' }, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error during file creation: ENOENT: no such file or directory');
    });

    it('should provide suggestions when given', () => {
      const error = new Error('Generic error');
      const context = {
        operation: 'initialization',
        suggestions: ['Try using --force flag', 'Check file permissions']
      };
      
      const result = ErrorHandler.handleCommandError(error, context, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during initialization: Generic error');
    });

    it('should handle unknown error types', () => {
      const unknownError = 'String error';
      
      const result = ErrorHandler.handleCommandError(unknownError, undefined, false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error: String error');
    });
  });

  describe('handleValidationError', () => {
    it('should format validation errors properly', () => {
      const errors = ['Project name is invalid', 'Language not supported'];
      
      const result = ErrorHandler.handleValidationError(errors, 'command validation');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed during command validation: Project name is invalid; Language not supported');
    });

    it('should handle single validation error', () => {
      const errors = ['Output path is required'];
      
      const result = ErrorHandler.handleValidationError(errors);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed: Output path is required');
    });
  });

  describe('handleSecurityError', () => {
    it('should handle SecurityError with details', () => {
      const securityError = new SecurityError('unauthorized_access', 'Access denied', 'Attempted to access /etc/passwd');
      
      const result = ErrorHandler.handleSecurityError(securityError, 'path validation');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Security violation during path validation: Access denied');
    });

    it('should handle SecurityError without details', () => {
      const securityError = new SecurityError('json_injection', 'Malicious JSON detected');
      
      const result = ErrorHandler.handleSecurityError(securityError);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Security violation: Malicious JSON detected');
    });
  });
});