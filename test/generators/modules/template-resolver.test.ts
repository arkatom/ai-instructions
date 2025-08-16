/**
 * TDD Test Suite for TemplateResolver Module
 * Verifies template resolution, loading, and fallback logic
 * Achieving comprehensive coverage for modular architecture
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { TemplateResolver } from '../../../src/generators/modules/template-resolver';
import { FileUtils } from '../../../src/utils/file-utils';
import {
  TemplateNotFoundError,
  TemplateParsingError,
  FileSystemError,
  UnsupportedLanguageError
} from '../../../src/generators/errors';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../src/utils/file-utils');

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockFileExists = FileUtils.fileExists as jest.MockedFunction<typeof FileUtils.fileExists>;

describe('TemplateResolver', () => {
  let templateResolver: TemplateResolver;
  let consoleSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    templateResolver = new TemplateResolver('/test/templates');
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildTemplatePaths', () => {
    test('should build paths with correct priority for non-English language', () => {
      const paths = templateResolver.buildTemplatePaths('main.md', 'ja');
      
      expect(paths).toHaveLength(3);
      expect(paths[0]).toEqual({
        path: join('/test/templates', 'ja', 'main.md'),
        description: 'ja version'
      });
      expect(paths[1]).toEqual({
        path: join('/test/templates', 'en', 'main.md'),
        description: 'English fallback'
      });
      expect(paths[2]).toEqual({
        path: join('/test/templates', 'main.md'),
        description: 'legacy version'
      });
    });

    test('should build paths without English fallback for English language', () => {
      const paths = templateResolver.buildTemplatePaths('main.md', 'en');
      
      expect(paths).toHaveLength(2);
      expect(paths[0]).toEqual({
        path: join('/test/templates', 'en', 'main.md'),
        description: 'en version'
      });
      expect(paths[1]).toEqual({
        path: join('/test/templates', 'main.md'),
        description: 'legacy version'
      });
    });

    test('should build paths for Chinese language', () => {
      const paths = templateResolver.buildTemplatePaths('agent.md', 'ch');
      
      expect(paths).toHaveLength(3);
      expect(paths).toHaveLength(3);
      expect(paths[0]?.path).toContain('/ch/agent.md');
      expect(paths[1]?.path).toContain('/en/agent.md');
      expect(paths[2]?.path).toContain('/agent.md');
    });

    test('should return frozen/immutable array', () => {
      const paths = templateResolver.buildTemplatePaths('test.md', 'en');
      
      expect(Object.isFrozen(paths)).toBe(true);
    });
  });

  describe('tryReadTemplate', () => {
    test('should return content when file exists and is readable', async () => {
      const mockContent = '# Test Template Content';
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(mockContent);

      const result = await templateResolver.tryReadTemplate('/test/path/template.md', 'template.md');

      expect(result).toBe(mockContent);
      expect(mockFileExists).toHaveBeenCalledWith('/test/path/template.md');
      expect(mockReadFile).toHaveBeenCalledWith('/test/path/template.md', 'utf-8');
    });

    test('should return null when file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await templateResolver.tryReadTemplate('/nonexistent/template.md', 'template.md');

      expect(result).toBeNull();
      expect(mockFileExists).toHaveBeenCalledWith('/nonexistent/template.md');
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    test('should throw TemplateParsingError when file exists but read fails', async () => {
      const readError = new Error('Permission denied');
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockRejectedValue(readError);

      await expect(
        templateResolver.tryReadTemplate('/test/template.md', 'template.md')
      ).rejects.toThrow(TemplateParsingError);

      expect(mockFileExists).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalled();
    });

    test('should handle different file system errors appropriately', async () => {
      const fsError = new Error('EACCES: permission denied');
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockRejectedValue(fsError);

      await expect(
        templateResolver.tryReadTemplate('/protected/template.md', 'template.md')
      ).rejects.toThrow(TemplateParsingError);
    });
  });

  describe('loadTemplate', () => {
    test('should load template from first path when available', async () => {
      const mockContent = '# Japanese Template';
      mockFileExists.mockResolvedValueOnce(true);
      mockReadFile.mockResolvedValue(mockContent);

      const result = await templateResolver.loadTemplate('main.md', { lang: 'ja' });

      expect(result).toBe(mockContent);
      expect(consoleSpy).not.toHaveBeenCalled(); // No fallback warning
    });

    test('should fallback to English version with warning', async () => {
      const mockContent = '# English Template';
      mockFileExists
        .mockResolvedValueOnce(false) // Japanese version not found
        .mockResolvedValueOnce(true);  // English version found
      mockReadFile.mockResolvedValue(mockContent);

      const result = await templateResolver.loadTemplate('main.md', { lang: 'ja' });

      expect(result).toBe(mockContent);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Template main.md not found for ja, using English version'
      );
    });

    test('should fallback to legacy version with warning', async () => {
      const mockContent = '# Legacy Template';
      mockFileExists
        .mockResolvedValueOnce(false) // Japanese version not found
        .mockResolvedValueOnce(false) // English version not found
        .mockResolvedValueOnce(true);  // Legacy version found
      mockReadFile.mockResolvedValue(mockContent);

      const result = await templateResolver.loadTemplate('main.md', { lang: 'ja' });

      expect(result).toBe(mockContent);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Using legacy template main.md (no language support yet)'
      );
    });

    test('should use English default when no lang option provided', async () => {
      const mockContent = '# English Default';
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(mockContent);

      await templateResolver.loadTemplate('main.md');

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('/en/main.md'),
        'utf-8'
      );
    });

    test('should throw UnsupportedLanguageError for invalid language', async () => {
      await expect(
        templateResolver.loadTemplate('main.md', { lang: 'invalid' as any })
      ).rejects.toThrow(UnsupportedLanguageError);
    });

    test('should throw TemplateNotFoundError when no template found', async () => {
      mockFileExists.mockResolvedValue(false); // All paths fail

      await expect(
        templateResolver.loadTemplate('nonexistent.md', { lang: 'en' })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    test('should propagate TemplateParsingError from tryReadTemplate', async () => {
      const readError = new Error('Invalid encoding');
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockRejectedValue(readError);

      await expect(
        templateResolver.loadTemplate('invalid.md', { lang: 'en' })
      ).rejects.toThrow(TemplateParsingError);
    });

    test('should wrap unexpected errors as FileSystemError', async () => {
      const unexpectedError = new Error('Unexpected filesystem issue');
      mockFileExists.mockRejectedValue(unexpectedError);

      await expect(
        templateResolver.loadTemplate('main.md', { lang: 'en' })
      ).rejects.toThrow(FileSystemError);
    });

    test('should not show legacy warning for English language', async () => {
      const mockContent = '# Legacy English Template';
      mockFileExists
        .mockResolvedValueOnce(false) // English version not found
        .mockResolvedValueOnce(true);  // Legacy version found
      mockReadFile.mockResolvedValue(mockContent);

      await templateResolver.loadTemplate('main.md', { lang: 'en' });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty template content', async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue('');

      const result = await templateResolver.loadTemplate('empty.md', { lang: 'en' });
      expect(result).toBe('');
    });

    test('should handle template with special characters', async () => {
      const specialContent = '# 特殊文字 🎌 Test Template';
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(specialContent);

      const result = await templateResolver.loadTemplate('special.md', { lang: 'ja' });
      expect(result).toBe(specialContent);
    });

    test('should handle concurrent template loads correctly', async () => {
      const mockContent1 = '# Template 1';
      const mockContent2 = '# Template 2';
      
      mockFileExists.mockResolvedValue(true);
      mockReadFile
        .mockResolvedValueOnce(mockContent1)
        .mockResolvedValueOnce(mockContent2);

      const [result1, result2] = await Promise.all([
        templateResolver.loadTemplate('template1.md', { lang: 'en' }),
        templateResolver.loadTemplate('template2.md', { lang: 'ja' })
      ]);

      expect(result1).toBe(mockContent1);
      expect(result2).toBe(mockContent2);
    });
  });
});