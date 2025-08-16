/**
 * TDD Test Suite for FileStructureBuilder Module
 * Verifies file structure generation and directory management
 * Achieving comprehensive coverage for modular architecture
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { join } from 'path';
import { FileStructureBuilder } from '../../../src/generators/modules/file-structure-builder';
import { FileUtils } from '../../../src/utils/file-utils';
import { ConfigurationManager, type FileStructureConfig } from '../../../src/generators/config-manager';
import {
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  FileSystemError
} from '../../../src/generators/errors';
import { TypeGuards } from '../../../src/generators/types';

// Mock dependencies
jest.mock('../../../src/utils/file-utils');
jest.mock('../../../src/generators/config-manager');
jest.mock('../../../src/generators/types');

const mockEnsureDirectory = FileUtils.ensureDirectory as jest.MockedFunction<typeof FileUtils.ensureDirectory>;
const mockGetFileStructureConfig = ConfigurationManager.getFileStructureConfig as jest.MockedFunction<typeof ConfigurationManager.getFileStructureConfig>;
const mockCreateCustomFileStructure = ConfigurationManager.createCustomFileStructure as jest.MockedFunction<typeof ConfigurationManager.createCustomFileStructure>;
const mockIsSupportedTool = TypeGuards.isSupportedTool as jest.MockedFunction<typeof TypeGuards.isSupportedTool>;

describe('FileStructureBuilder', () => {
  let fileStructureBuilder: FileStructureBuilder;
  let consoleSpy: jest.SpiedFunction<typeof console.warn>;

  const mockToolConfig = {
    name: 'claude',
    outputStructure: {
      mainFile: 'claude-instructions.md',
      directory: 'claude-output'
    }
  };

  const mockFileStructureConfig: FileStructureConfig = {
    outputDirectory: 'claude',
    subdirectories: ['instructions', 'configs', 'agents'],
    includeInstructionsDirectory: true
  };

  beforeEach(() => {
    fileStructureBuilder = new FileStructureBuilder();
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateOutputDirectoryStructure', () => {
    test('should create main directory and subdirectories successfully', async () => {
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        mockToolConfig,
        '/test/output'
      );

      expect(result).toHaveLength(4); // 1 main + 3 subdirectories
      expect(result[0]).toBe(join('/test/output', 'claude'));
      expect(result[1]).toBe(join('/test/output', 'instructions'));
      expect(result[2]).toBe(join('/test/output', 'configs'));
      expect(result[3]).toBe(join('/test/output', 'agents'));

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(4);
      expect(mockEnsureDirectory).toHaveBeenCalledWith(join('/test/output', 'claude'));
      expect(mockEnsureDirectory).toHaveBeenCalledWith(join('/test/output', 'instructions'));
    });

    test('should handle config without outputDirectory', async () => {
      const configWithoutMainDir: FileStructureConfig = {
        outputDirectory: '',
        subdirectories: ['configs', 'templates'],
        includeInstructionsDirectory: false
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(configWithoutMainDir);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        mockToolConfig,
        '/test/output'
      );

      expect(result).toHaveLength(2); // Only subdirectories
      expect(result[0]).toBe(join('/test/output', 'configs'));
      expect(result[1]).toBe(join('/test/output', 'templates'));

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(2);
    });

    test('should handle empty subdirectories array', async () => {
      const configWithMainDirOnly: FileStructureConfig = {
        outputDirectory: 'main-only',
        subdirectories: [],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(configWithMainDirOnly);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        mockToolConfig,
        '/test/output'
      );

      expect(result).toHaveLength(1); // Only main directory
      expect(result[0]).toBe(join('/test/output', 'main-only'));

      expect(mockEnsureDirectory).toHaveBeenCalledTimes(1);
    });

    test('should throw FileSystemError when directory creation fails', async () => {
      const fsError = new Error('Permission denied');
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);
      mockEnsureDirectory.mockRejectedValue(fsError);

      await expect(
        fileStructureBuilder.generateOutputDirectoryStructure(mockToolConfig, '/readonly/output')
      ).rejects.toThrow(FileSystemError);

      expect(mockEnsureDirectory).toHaveBeenCalled();
    });

    test('should handle partial directory creation failure correctly', async () => {
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);
      mockEnsureDirectory
        .mockResolvedValueOnce(undefined) // Main directory succeeds
        .mockRejectedValueOnce(new Error('Subdirectory creation failed')); // First subdirectory fails

      await expect(
        fileStructureBuilder.generateOutputDirectoryStructure(mockToolConfig, '/test/output')
      ).rejects.toThrow(FileSystemError);
    });

    test('should handle complex nested subdirectories', async () => {
      const complexConfig: FileStructureConfig = {
        outputDirectory: 'complex',
        subdirectories: ['deep/nested/dir', 'another/path/structure'],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(complexConfig);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        mockToolConfig,
        '/test/output'
      );

      expect(result).toContain(join('/test/output', 'deep/nested/dir'));
      expect(result).toContain(join('/test/output', 'another/path/structure'));
    });
  });

  describe('getFileStructureConfig', () => {
    test('should return file structure config for supported tool', async () => {
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);

      const result = await fileStructureBuilder.getFileStructureConfig('claude');

      expect(result).toEqual(mockFileStructureConfig);
      expect(mockIsSupportedTool).toHaveBeenCalledWith('claude');
      expect(mockGetFileStructureConfig).toHaveBeenCalledWith('claude');
    });

    test('should handle unsupported tool with fallback', async () => {
      const fallbackConfig: FileStructureConfig = {
        outputDirectory: '',
        subdirectories: [],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(false);
      mockCreateCustomFileStructure.mockReturnValue(fallbackConfig);

      const result = await fileStructureBuilder.getFileStructureConfig('unsupported-tool');

      expect(result).toEqual(fallbackConfig);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Failed to load file structure config for unsupported-tool, using defaults'
      );
      expect(mockGetFileStructureConfig).not.toHaveBeenCalled();
      expect(mockCreateCustomFileStructure).toHaveBeenCalled();
    });

    test('should handle ConfigurationNotFoundError with fallback', async () => {
      const fallbackConfig: FileStructureConfig = {
        outputDirectory: '',
        subdirectories: [],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockRejectedValue(
        new ConfigurationNotFoundError('tool', 'test-tool', 'config file not found')
      );
      mockCreateCustomFileStructure.mockReturnValue(fallbackConfig);

      const result = await fileStructureBuilder.getFileStructureConfig('test-tool');

      expect(result).toEqual(fallbackConfig);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Failed to load file structure config for test-tool, using defaults'
      );
      expect(mockCreateCustomFileStructure).toHaveBeenCalledWith({
        outputDirectory: '',
        subdirectories: [],
        includeInstructionsDirectory: true
      });
    });

    test('should handle ConfigurationValidationError with fallback', async () => {
      const fallbackConfig: FileStructureConfig = {
        outputDirectory: '',
        subdirectories: [],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockRejectedValue(
        new ConfigurationValidationError('tool', 'test-tool', ['Invalid configuration structure'])
      );
      mockCreateCustomFileStructure.mockReturnValue(fallbackConfig);

      const result = await fileStructureBuilder.getFileStructureConfig('cursor');

      expect(result).toEqual(fallbackConfig);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Failed to load file structure config for cursor, using defaults'
      );
    });

    test('should re-throw non-configuration errors', async () => {
      const systemError = new Error('System filesystem error');
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockRejectedValue(systemError);

      await expect(
        fileStructureBuilder.getFileStructureConfig('claude')
      ).rejects.toThrow('System filesystem error');

      expect(mockCreateCustomFileStructure).not.toHaveBeenCalled();
    });

    test('should handle various tool names correctly', async () => {
      const tools = ['claude', 'cursor', 'github-copilot', 'cline'];
      
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);

      for (const tool of tools) {
        await fileStructureBuilder.getFileStructureConfig(tool);
        expect(mockIsSupportedTool).toHaveBeenCalledWith(tool);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle tool config with special characters', async () => {
      const specialToolConfig = {
        name: 'test-tool_v2.0',
        outputStructure: {
          mainFile: 'special-chars_file.md',
          directory: 'special-output'
        }
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        specialToolConfig,
        '/test/output'
      );

      expect(result).toBeDefined();
      expect(mockGetFileStructureConfig).toHaveBeenCalledWith('test-tool_v2.0');
    });

    test('should handle very long paths correctly', async () => {
      const longPathConfig: FileStructureConfig = {
        outputDirectory: 'very/long/nested/directory/structure/for/testing',
        subdirectories: ['extremely/deep/nested/subdirectory/path/structure'],
        includeInstructionsDirectory: true
      };

      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(longPathConfig);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const result = await fileStructureBuilder.generateOutputDirectoryStructure(
        mockToolConfig,
        '/test/output'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('very/long/nested/directory/structure/for/testing');
      expect(result[1]).toContain('extremely/deep/nested/subdirectory/path/structure');
    });

    test('should handle concurrent structure generation requests', async () => {
      mockIsSupportedTool.mockReturnValue(true);
      mockGetFileStructureConfig.mockResolvedValue(mockFileStructureConfig);
      mockEnsureDirectory.mockResolvedValue(undefined);

      const [result1, result2] = await Promise.all([
        fileStructureBuilder.generateOutputDirectoryStructure(mockToolConfig, '/test/output1'),
        fileStructureBuilder.generateOutputDirectoryStructure(mockToolConfig, '/test/output2')
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1).not.toEqual(result2); // Different paths
    });
  });
});