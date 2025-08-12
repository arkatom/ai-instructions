/**
 * Test suite for custom error classes
 * Issue #46: Error handling improvement
 */

import { describe, test, expect } from '@jest/globals';
import {
  ConfigValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  ValidationError,
  ApplicationError
} from '../../src/errors/custom-errors';

describe('Custom Error Classes', () => {
  describe('ConfigValidationError', () => {
    test('should create error with message and details', () => {
      const details = { field: 'projectName', value: null };
      const error = new ConfigValidationError('Invalid configuration', details);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.name).toBe('ConfigValidationError');
      expect(error.message).toBe('Invalid configuration');
      expect(error.details).toEqual(details);
      expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
    });

    test('should work without details', () => {
      const error = new ConfigValidationError('Missing required field');
      
      expect(error.details).toBeUndefined();
      expect(error.message).toBe('Missing required field');
    });
  });

  describe('FileSystemError', () => {
    test('should create error with path information', () => {
      const error = new FileSystemError('File not found', '/path/to/file.txt');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.name).toBe('FileSystemError');
      expect(error.message).toBe('File not found');
      expect(error.path).toBe('/path/to/file.txt');
      expect(error.code).toBe('FILESYSTEM_ERROR');
    });

    test('should work without path', () => {
      const error = new FileSystemError('Permission denied');
      
      expect(error.path).toBeUndefined();
      expect(error.message).toBe('Permission denied');
    });
  });

  describe('NetworkError', () => {
    test('should create error with status code', () => {
      const error = new NetworkError('Request failed', 404);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Request failed');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NETWORK_ERROR');
    });

    test('should work without status code', () => {
      const error = new NetworkError('Connection timeout');
      
      expect(error.statusCode).toBeUndefined();
      expect(error.message).toBe('Connection timeout');
    });
  });

  describe('SecurityError', () => {
    test('should create error with violation type', () => {
      const error = new SecurityError('path_traversal', 'Unauthorized access attempt', '../../../etc/passwd');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SecurityError);
      expect(error.name).toBe('SecurityError');
      expect(error.violationType).toBe('path_traversal');
      expect(error.message).toBe('Unauthorized access attempt');
      expect(error.context).toBe('../../../etc/passwd');
      expect(error.code).toBe('SECURITY_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('should create error with field and value', () => {
      const error = new ValidationError('Invalid email format', 'email', 'not-an-email');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    test('should work without field and value', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
    });
  });

  describe('ApplicationError', () => {
    test('should create base application error', () => {
      const error = new ApplicationError('APPLICATION_ERROR', 'Something went wrong');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.code).toBe('APPLICATION_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    test('should capture stack trace', () => {
      const error = new ApplicationError('TEST_ERROR', 'Test message');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApplicationError');
    });
  });

  describe('Error inheritance', () => {
    test('all custom errors should inherit from ApplicationError', () => {
      const configError = new ConfigValidationError('test');
      const fsError = new FileSystemError('test');
      const netError = new NetworkError('test');
      const secError = new SecurityError('test', 'test');
      const valError = new ValidationError('test');
      
      expect(configError).toBeInstanceOf(ApplicationError);
      expect(fsError).toBeInstanceOf(ApplicationError);
      expect(netError).toBeInstanceOf(ApplicationError);
      expect(secError).toBeInstanceOf(ApplicationError);
      expect(valError).toBeInstanceOf(ApplicationError);
    });
  });
});