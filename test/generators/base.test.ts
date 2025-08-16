/**
 * TDD Test Suite for BaseGenerator Abstract Class
 * Verifies core generator functionality and module delegation
 * Achieving comprehensive coverage for the main generator base class
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { join } from 'path';
import { BaseGenerator, type GenerateFilesOptions, type ToolConfig, stringToConflictResolution } from '../../src/generators/base';
import { ConflictResolution } from '../../src/utils/file-conflict-handler';
import { FileUtils } from '../../src/utils/file-utils';
import { TemplateResolver, FileStructureBuilder, DynamicTemplateProcessor } from '../../src/generators/modules';
import {
  FileSystemError
} from '../../src/generators/errors';

// Mock dependencies
jest.mock('../../src/utils/file-utils');
jest.mock('../../src/generators/modules/template-resolver');
jest.mock('../../src/generators/modules/file-structure-builder');
jest.mock('../../src/generators/modules/dynamic-template-processor');

const mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;
const mockTemplateResolver = TemplateResolver as jest.MockedClass<typeof TemplateResolver>;
const mockFileStructureBuilder = FileStructureBuilder as jest.MockedClass<typeof FileStructureBuilder>;
const mockDynamicTemplateProcessor = DynamicTemplateProcessor as jest.MockedClass<typeof DynamicTemplateProcessor>;

/**
 * Concrete implementation of BaseGenerator for testing
 * Since BaseGenerator is abstract, we need a concrete class for testing
 */
class TestGenerator extends BaseGenerator {
  async generateFiles(targetDir: string, options?: GenerateFilesOptions): Promise<void> {
    // Simple implementation for testing
    await this.safeWriteFile(join(targetDir, 'test.md'), '# Test Content', false, options);
  }
}

describe('BaseGenerator', () => {
  let generator: TestGenerator;
  let mockTemplateResolverInstance: jest.Mocked<TemplateResolver>;
  let mockFileStructureBuilderInstance: jest.Mocked<FileStructureBuilder>;
  let mockDynamicTemplateProcessorInstance: jest.Mocked<DynamicTemplateProcessor>;

  const mockToolConfig: ToolConfig = {
    name: 'claude',
    templateDir: 'core',
    outputStructure: {
      mainFile: 'claude-instructions.md',
      directory: 'claude-output'
    }
  };


  beforeEach(() => {
    // Setup mock instances
    mockTemplateResolverInstance = {
      loadTemplate: jest.fn(),
      buildTemplatePaths: jest.fn(),
      tryReadTemplate: jest.fn()
    } as any;

    mockFileStructureBuilderInstance = {
      generateOutputDirectoryStructure: jest.fn(),
      getFileStructureConfig: jest.fn()
    } as any;

    mockDynamicTemplateProcessorInstance = {
      loadDynamicTemplate: jest.fn(),
      applyDynamicReplacements: jest.fn()
    } as any;

    // Clear previous mocks before setting up new test
    jest.clearAllMocks();
    
    // Configure mock constructors
    mockTemplateResolver.mockImplementation(() => mockTemplateResolverInstance);
    mockFileStructureBuilder.mockImplementation(() => mockFileStructureBuilderInstance);
    mockDynamicTemplateProcessor.mockImplementation(() => mockDynamicTemplateProcessorInstance);

    generator = new TestGenerator(mockToolConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct tool configuration', () => {
      expect(generator).toBeDefined();
      expect(generator.getToolName()).toBe('claude');
    });

    test('should construct template directory path correctly', () => {
      const expectedPath = join(__dirname, '../../templates', 'core');
      // We can't directly access templateDir, but we can verify through constructor calls
      expect(mockTemplateResolver).toHaveBeenCalledWith(expectedPath);
    });

    test('should initialize all module instances', () => {
      expect(mockTemplateResolver).toHaveBeenCalledTimes(1);
      expect(mockFileStructureBuilder).toHaveBeenCalledTimes(1);
      expect(mockDynamicTemplateProcessor).toHaveBeenCalledTimes(1);
    });

    test('should handle different tool configurations', () => {
      const customConfig: ToolConfig = {
        name: 'cursor',
        templateDir: 'cursor',
        outputStructure: {
          mainFile: 'cursor.mdc',
          directory: '.cursor'
        }
      };

      const customGenerator = new TestGenerator(customConfig);
      expect(customGenerator.getToolName()).toBe('cursor');
    });
  });

  describe('stringToConflictResolution function', () => {
    test('should convert valid string values to ConflictResolution enum', () => {
      expect(stringToConflictResolution('backup')).toBe(ConflictResolution.BACKUP);
      expect(stringToConflictResolution('merge')).toBe(ConflictResolution.MERGE);
      expect(stringToConflictResolution('interactive')).toBe(ConflictResolution.INTERACTIVE);
      expect(stringToConflictResolution('skip')).toBe(ConflictResolution.SKIP);
      expect(stringToConflictResolution('overwrite')).toBe(ConflictResolution.OVERWRITE);
    });

    test('should handle case insensitive conversion', () => {
      expect(stringToConflictResolution('BACKUP')).toBe(ConflictResolution.BACKUP);
      expect(stringToConflictResolution('Merge')).toBe(ConflictResolution.MERGE);
      expect(stringToConflictResolution('INTERACTIVE')).toBe(ConflictResolution.INTERACTIVE);
    });

    test('should return default for invalid values', () => {
      expect(stringToConflictResolution('invalid')).toBe(ConflictResolution.BACKUP);
      expect(stringToConflictResolution('')).toBe(ConflictResolution.BACKUP);
      expect(stringToConflictResolution(undefined as any)).toBe(ConflictResolution.BACKUP);
    });
  });

  describe('loadTemplate method', () => {
    test('should delegate to TemplateResolver', async () => {
      const mockContent = '# Test Template';
      const options: GenerateFilesOptions = { lang: 'en' };
      
      mockTemplateResolverInstance.loadTemplate.mockResolvedValue(mockContent);

      const result = await generator.loadTemplate('main.md', options);

      expect(result).toBe(mockContent);
      expect(mockTemplateResolverInstance.loadTemplate).toHaveBeenCalledWith('main.md', options);
    });

    test('should work without options', async () => {
      const mockContent = '# Default Template';
      mockTemplateResolverInstance.loadTemplate.mockResolvedValue(mockContent);

      const result = await generator.loadTemplate('default.md');

      expect(result).toBe(mockContent);
      expect(mockTemplateResolverInstance.loadTemplate).toHaveBeenCalledWith('default.md', undefined);
    });

    test('should propagate errors from TemplateResolver', async () => {
      const error = new Error('Template not found');
      mockTemplateResolverInstance.loadTemplate.mockRejectedValue(error);

      await expect(generator.loadTemplate('nonexistent.md')).rejects.toThrow('Template not found');
    });
  });

  describe('loadDynamicTemplate method', () => {
    test('should delegate to DynamicTemplateProcessor', async () => {
      const mockContent = '# Dynamic Template';
      const options: GenerateFilesOptions = { projectName: 'TestProject' };
      
      mockDynamicTemplateProcessorInstance.loadDynamicTemplate.mockResolvedValue(mockContent);

      const result = await generator.loadDynamicTemplate('main.md', options);

      expect(result).toBe(mockContent);
      expect(mockDynamicTemplateProcessorInstance.loadDynamicTemplate).toHaveBeenCalledWith(
        'main.md', 
        'claude', 
        options
      );
    });

    test('should use tool name from config', async () => {
      const mockContent = '# Tool Specific Template';
      mockDynamicTemplateProcessorInstance.loadDynamicTemplate.mockResolvedValue(mockContent);

      await generator.loadDynamicTemplate('tool.md');

      expect(mockDynamicTemplateProcessorInstance.loadDynamicTemplate).toHaveBeenCalledWith(
        'tool.md',
        'claude',
        undefined
      );
    });
  });

  describe('generateOutputDirectoryStructure method', () => {
    test('should delegate to FileStructureBuilder', async () => {
      const expectedPaths = ['/output/claude', '/output/instructions'];
      mockFileStructureBuilderInstance.generateOutputDirectoryStructure.mockResolvedValue(expectedPaths);

      const result = await generator.generateOutputDirectoryStructure('/output');

      expect(result).toEqual(expectedPaths);
      expect(mockFileStructureBuilderInstance.generateOutputDirectoryStructure).toHaveBeenCalledWith(
        mockToolConfig,
        '/output'
      );
    });

    test('should handle directory creation failures', async () => {
      const error = new FileSystemError('create_directory', '/output', new Error('Permission denied'));
      mockFileStructureBuilderInstance.generateOutputDirectoryStructure.mockRejectedValue(error);

      await expect(generator.generateOutputDirectoryStructure('/readonly')).rejects.toThrow(FileSystemError);
    });
  });

  describe('safeWriteFile method', () => {
    test('should use advanced file writing with conflict resolution options', async () => {
      const options: GenerateFilesOptions = {
        conflictResolution: 'merge',
        interactive: true,
        backup: true
      };

      mockFileUtils.writeFileContentAdvanced.mockResolvedValue(undefined);

      await generator['safeWriteFile']('/path/test.md', 'content', false, options);

      expect(mockFileUtils.writeFileContentAdvanced).toHaveBeenCalledWith(
        '/path/test.md',
        'content',
        {
          force: false,
          interactive: true,
          defaultResolution: ConflictResolution.MERGE,
          backup: true
        }
      );
    });

    test('should fall back to legacy safe writing when no conflict options', async () => {
      mockFileUtils.writeFileContentSafe.mockResolvedValue(undefined);

      await generator['safeWriteFile']('/path/test.md', 'content', true);

      expect(mockFileUtils.writeFileContentSafe).toHaveBeenCalledWith(
        '/path/test.md',
        'content',
        true
      );
    });

    test('should handle interactive: false option', async () => {
      const options: GenerateFilesOptions = {
        interactive: false,
        backup: false
      };

      mockFileUtils.writeFileContentAdvanced.mockResolvedValue(undefined);

      await generator['safeWriteFile']('/path/test.md', 'content', false, options);

      expect(mockFileUtils.writeFileContentAdvanced).toHaveBeenCalledWith(
        '/path/test.md',
        'content',
        {
          force: false,
          interactive: false,
          defaultResolution: ConflictResolution.BACKUP,
          backup: false
        }
      );
    });
  });

  describe('getToolName method', () => {
    test('should return tool name from configuration', () => {
      expect(generator.getToolName()).toBe('claude');
    });

    test('should work with different tool names', () => {
      const cursorConfig: ToolConfig = {
        name: 'cursor',
        templateDir: 'cursor',
        outputStructure: {}
      };
      
      const cursorGenerator = new TestGenerator(cursorConfig);
      expect(cursorGenerator.getToolName()).toBe('cursor');
    });
  });

  describe('Configuration Loading Methods (Integration)', () => {
    // These methods use ConfigurationManager which involves complex mocking,
    // so we test error handling and basic structure
    
    test('should handle loadToolConfig errors gracefully', async () => {
      // Since loadToolConfig uses ConfigurationManager, we test it throws appropriate errors
      // This tests the error handling wrapper logic
      
      // The actual implementation should throw when configuration is not found
      await expect(async () => {
        await generator.loadToolConfig();
      }).rejects.toThrow();
    });

    test('should handle loadLanguageConfig errors gracefully', async () => {
      // Similar to loadToolConfig, test error handling
      await expect(async () => {
        await generator.loadLanguageConfig('invalid-language');
      }).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty tool configuration', () => {
      const emptyConfig: ToolConfig = {
        name: '',
        templateDir: '',
        outputStructure: {}
      };

      const emptyGenerator = new TestGenerator(emptyConfig);
      expect(emptyGenerator.getToolName()).toBe('');
    });

    test('should handle special characters in tool configuration', () => {
      const specialConfig: ToolConfig = {
        name: 'tool-with_special.chars',
        templateDir: 'special/path',
        outputStructure: {
          mainFile: 'file with spaces.md'
        }
      };

      const specialGenerator = new TestGenerator(specialConfig);
      expect(specialGenerator.getToolName()).toBe('tool-with_special.chars');
    });

    test('should handle concurrent template loading', async () => {
      const mockContent1 = '# Template 1';
      const mockContent2 = '# Template 2';
      
      mockTemplateResolverInstance.loadTemplate
        .mockResolvedValueOnce(mockContent1)
        .mockResolvedValueOnce(mockContent2);

      const [result1, result2] = await Promise.all([
        generator.loadTemplate('template1.md'),
        generator.loadTemplate('template2.md')
      ]);

      expect(result1).toBe(mockContent1);
      expect(result2).toBe(mockContent2);
    });

    test('should maintain consistent state across multiple operations', async () => {
      // Test that multiple operations don't interfere with each other
      mockTemplateResolverInstance.loadTemplate.mockResolvedValue('# Content');
      mockFileStructureBuilderInstance.generateOutputDirectoryStructure.mockResolvedValue(['/path']);

      await generator.loadTemplate('test1.md');
      await generator.generateOutputDirectoryStructure('/output');
      await generator.loadTemplate('test2.md');

      expect(generator.getToolName()).toBe('claude');
      expect(mockTemplateResolverInstance.loadTemplate).toHaveBeenCalledTimes(2);
      expect(mockFileStructureBuilderInstance.generateOutputDirectoryStructure).toHaveBeenCalledTimes(1);
    });
  });
});