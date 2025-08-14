/**
 * Security Tests for ContextAnalyzer
 * Testing Path Traversal and JSON Parse Error handling
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { ContextAnalyzer } from '../../src/agents/context-analyzer';
import { SecurityError } from '../../src/errors/custom-errors';

// Mock fs module
jest.mock('fs');
// Mock fs/promises module
jest.mock('fs/promises');

describe('ContextAnalyzer Security Tests', () => {
  describe('Path Traversal Prevention', () => {
    test('should reject path traversal attempts with ../', () => {
      // ARRANGE
      const maliciousPath = '../../etc/passwd';
      
      // ACT & ASSERT
      expect(() => {
        new ContextAnalyzer(maliciousPath);
      }).toThrow(SecurityError);
    });

    test('should reject absolute paths outside project', () => {
      // ARRANGE
      const maliciousPath = '/etc/passwd';
      
      // ACT & ASSERT
      expect(() => {
        new ContextAnalyzer(maliciousPath);
      }).toThrow(SecurityError);
    });

    test('should reject symbolic link attempts', () => {
      // ARRANGE
      const symlinkPath = './symlink-to-sensitive';
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.lstatSync.mockReturnValue({
        isSymbolicLink: () => true
      } as any);
      
      // ACT & ASSERT
      expect(() => {
        new ContextAnalyzer(symlinkPath);
      }).toThrow(SecurityError);
    });

    test('should accept valid relative paths within project', () => {
      // ARRANGE
      const validPath = './src/agents';
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.lstatSync.mockReturnValue({
        isSymbolicLink: () => false
      } as any);
      
      // ACT & ASSERT
      expect(() => {
        new ContextAnalyzer(validPath);
      }).not.toThrow();
    });
  });

  describe('JSON Parse Error Handling', () => {
    let analyzer: ContextAnalyzer;
    
    beforeEach(() => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.lstatSync.mockReturnValue({
        isSymbolicLink: () => false
      } as any);
      analyzer = new ContextAnalyzer('./test-project');
    });

    test('should handle malformed JSON in package.json', async () => {
      // ARRANGE
      const mockedFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
      mockedFsPromises.readFile.mockResolvedValue('{invalid json}');
      mockedFsPromises.stat.mockResolvedValue({ } as any);
      
      // ACT
      const context = await analyzer.analyzeProject();
      
      // ASSERT
      expect(context.projectType).toBe('nodejs'); // Broken package.json still indicates nodejs
      expect(context.errors).toContainEqual({
        file: 'package.json',
        error: 'Invalid JSON format'
      });
    });

    test('should handle empty JSON files', async () => {
      // ARRANGE
      const mockedFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
      mockedFsPromises.readFile.mockResolvedValue('');
      mockedFsPromises.stat.mockResolvedValue({ } as any);
      
      // ACT
      const context = await analyzer.analyzeProject();
      
      // ASSERT
      expect(context.projectType).toBe('nodejs'); // Empty package.json still indicates nodejs
      expect(context.errors).toContainEqual({
        file: 'package.json',
        error: 'Empty JSON file'
      });
    });

    test('should handle JSON with null bytes', async () => {
      // ARRANGE
      const mockedFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
      mockedFsPromises.readFile.mockResolvedValue('{"test": "value\u0000"}');
      mockedFsPromises.stat.mockResolvedValue({ } as any);
      
      // ACT
      const context = await analyzer.analyzeProject();
      
      // ASSERT
      expect(context.errors).toContainEqual({
        file: 'package.json',
        error: 'Null bytes detected in JSON'
      });
    });

    test('should handle extremely large JSON files', async () => {
      // ARRANGE
      const largeJson = JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024) }); // 10MB
      const mockedFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
      mockedFsPromises.readFile.mockResolvedValue(largeJson);
      mockedFsPromises.stat.mockResolvedValue({ } as any);
      
      // ACT
      const context = await analyzer.analyzeProject();
      
      // ASSERT
      expect(context.errors).toContainEqual({
        file: 'package.json',
        error: 'JSON file too large (>5MB)'
      });
    });

    test('should continue analysis even with JSON errors', async () => {
      // ARRANGE
      const mockedFsPromises = fsPromises as jest.Mocked<typeof fsPromises>;
      mockedFsPromises.readFile
        .mockResolvedValueOnce('{invalid}') // package.json
        .mockResolvedValue('test content'); // other files
      
      mockedFsPromises.stat.mockResolvedValue({ } as any);
      
      // ACT
      const context = await analyzer.analyzeProject();
      
      // ASSERT
      expect(context.errors).toBeDefined();
      expect(context.errors?.length).toBeGreaterThan(0);
      // Should still attempt to detect other things
      expect(context.developmentPhase).toBeDefined();
    });
  });
});