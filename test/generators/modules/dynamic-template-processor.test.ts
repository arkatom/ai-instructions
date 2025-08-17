/**
 * TDD Test Suite for DynamicTemplateProcessor Module
 * Verifies dynamic template processing, variable replacement, and glob generation
 * Achieving comprehensive coverage for modular architecture
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFile } from 'fs/promises';
import { DynamicTemplateProcessor } from '../../../src/generators/modules/dynamic-template-processor';
import { TemplateResolver } from '../../../src/generators/modules/template-resolver';
import { ConfigurationManager, type ConfigurableToolConfig, type FileStructureConfig } from '../../../src/generators/config-manager';
import { TypeGuards } from '../../../src/generators/types';
import { FileUtils } from '../../../src/utils/file-utils';
import {
  DynamicTemplateError,
  ConfigurationNotFoundError,
  UnsupportedLanguageError
} from '../../../src/generators/errors';
import type {
  StrictLanguageConfiguration
} from '../../../src/generators/types';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../src/generators/modules/template-resolver');
jest.mock('../../../src/utils/file-utils', () => ({
  FileUtils: {
    fileExists: jest.fn()
  }
}));
jest.mock('../../../src/generators/types');

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockTemplateResolver = TemplateResolver as jest.MockedClass<typeof TemplateResolver>;
const mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;
// Mock ConfigurationManager static methods
jest.mock('../../../src/generators/config-manager');

// Get mocked ConfigurationManager
const mockConfigurationManager = jest.mocked(ConfigurationManager);

const mockTypeGuards = TypeGuards as jest.Mocked<typeof TypeGuards>;

describe('DynamicTemplateProcessor', () => {
  let dynamicProcessor: DynamicTemplateProcessor;
  let mockTemplateResolverInstance: jest.Mocked<TemplateResolver>;


  const mockFileStructure: FileStructureConfig = {
    outputDirectory: '.claude',
    mainFileName: 'CLAUDE.md',
    subdirectories: ['agents'],
    fileNamingPattern: undefined,
    includeInstructionsDirectory: true
  };

  const mockToolConfig: ConfigurableToolConfig = {
    displayName: 'Claude AI',
    fileExtension: '.md',
    globs: {
      inherit: 'universal',
      additional: ['**/*.claude.md', '**/.claude/*']
    },
    description: 'Claude AI development assistant',
    fileStructure: mockFileStructure
  };

  const mockLanguageConfig: StrictLanguageConfiguration = {
    globs: ['**/*.ts', '**/*.js', '**/*.json'],
    description: 'TypeScript/JavaScript development',
    languageFeatures: ['types', 'async/await', 'modules']
  };

  beforeEach(() => {
    mockTemplateResolverInstance = {
      loadTemplate: jest.fn(),
      buildTemplatePaths: jest.fn(),
      tryReadTemplate: jest.fn()
    } as unknown as jest.Mocked<TemplateResolver>;
    
    jest.clearAllMocks();
    
    mockTemplateResolver.mockImplementation(() => mockTemplateResolverInstance);
    
    // Mock FileUtils.fileExists to return true by default
    mockFileUtils.fileExists.mockResolvedValue(true);
    
    // Set up default successful mock responses
    mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
    mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
    mockTypeGuards.isSupportedTool.mockReturnValue(true);
    mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
    mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
    mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);
    
    dynamicProcessor = new DynamicTemplateProcessor('/test/templates', mockTemplateResolverInstance);

  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadDynamicTemplate', () => {
    test('should successfully load and process dynamic template', async () => {
      const coreTemplate = `
# {{projectName}} Instructions
Tool: {{toolName}}
Globs: {{dynamicGlobs}}
Extension: {{fileExtension}}
`;
      const expectedResult = `
# MyProject Instructions
Tool: 
Globs: [
  \\"**/*.claude.md\\",
  \\"**/*.js\\",
  \\"**/*.json\\",
  \\"**/*.ts\\",
  \\"**/.claude/*\\"
]
Extension: .md
`;

      mockReadFile.mockResolvedValue(coreTemplate);
      mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
      mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);

      const result = await dynamicProcessor.loadDynamicTemplate(
        'main.md',
        'claude',
        { projectName: 'MyProject', lang: 'en' }
      );

      expect(result.trim()).toBe(expectedResult.trim());
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('/core/en/main.md'),
        'utf-8'
      );
    });

    test('should handle template loading with fallback to default language', async () => {
      const coreTemplate = '# Default Template\nGlobs: {{dynamicGlobs}}';
      
      mockReadFile.mockResolvedValue(coreTemplate);
      mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
      mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);

      const result = await dynamicProcessor.loadDynamicTemplate('main.md', 'claude');

      expect(result).toContain('Default Template');
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('/core/en/main.md'),
        'utf-8'
      );
    });

    test('should throw UnsupportedLanguageError for invalid language', async () => {
      mockTypeGuards.isSupportedLanguage.mockReturnValue(false);

      await expect(
        dynamicProcessor.loadDynamicTemplate('main.md', 'claude', { lang: 'invalid' as 'en' | 'ja' | 'ch' })
      ).rejects.toThrow(UnsupportedLanguageError);
    });

    test('should throw ConfigurationNotFoundError for unsupported tool', async () => {
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isSupportedTool.mockReturnValue(false);

      await expect(
        dynamicProcessor.loadDynamicTemplate('main.md', 'unsupported-tool')
      ).rejects.toThrow(ConfigurationNotFoundError);
    });

    test('should handle core template not found', async () => {
      const templateError = new Error('Template not found');
      mockReadFile.mockRejectedValue(templateError);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);

      await expect(
        dynamicProcessor.loadDynamicTemplate('nonexistent.md', 'claude')
      ).rejects.toThrow(DynamicTemplateError);
    });

    test('should handle configuration loading failures gracefully', async () => {
      const configError = new ConfigurationNotFoundError('tool', 'claude', 'file not found');
      
      mockReadFile.mockResolvedValue('# Template');
      mockConfigurationManager.loadConfigurableToolConfig.mockRejectedValue(configError);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);

      await expect(
        dynamicProcessor.loadDynamicTemplate('main.md', 'claude')
      ).rejects.toThrow(ConfigurationNotFoundError);
    });
  });

  describe('applyDynamicReplacements', () => {
    const templateContext = {
      toolConfig: mockToolConfig,
      languageConfig: mockLanguageConfig,
      options: { projectName: 'TestProject', lang: 'en' as const }
    };

    beforeEach(() => {
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);
    });

    test('should replace all template variables correctly', () => {
      const template = `
# {{projectName}} Project
Tool: {{toolName}}
Globs: {{dynamicGlobs}}
Extension: {{fileExtension}}
Features: {{toolSpecificFeatures}}
Instructions: {{additionalInstructions}}
`;

      const result = dynamicProcessor.applyDynamicReplacements(template, templateContext);

      expect(result).toContain('# TestProject Project');
      expect(result).toContain('Tool: '); // toolName should be empty
      expect(result).toContain('Extension: .md');
      expect(result).toContain('Features: '); // toolSpecificFeatures should be empty
      expect(result).toContain('Instructions: '); // additionalInstructions should be empty
      expect(result).toContain('\\"**/*.ts\\"'); // Should contain language globs (escaped)
      expect(result).toContain('\\"**/*.claude.md\\"'); // Should contain tool globs (escaped)
    });

    test('should handle template without project name', () => {
      const template = 'Welcome to {{projectName}}!';
      const contextWithoutProject = {
        ...templateContext,
        options: { lang: 'en' as const }
      };

      const result = dynamicProcessor.applyDynamicReplacements(template, contextWithoutProject);

      expect(result).toBe('Welcome to {{projectName}}!'); // Should remain unchanged
    });

    test('should handle file extension without leading dot', () => {
      const contextWithBadExtension = {
        ...templateContext,
        toolConfig: {
          ...mockToolConfig,
          fileExtension: 'md' as `.${string}` // Force invalid type for test
        }
      };

      const template = 'Extension: {{fileExtension}}';
      const result = dynamicProcessor.applyDynamicReplacements(template, contextWithBadExtension);

      expect(result).toBe('Extension: {{fileExtension}}'); // Should not replace
    });

    test('should throw error for invalid tool configuration', () => {
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(false);
      
      const template = 'Test {{toolName}}';
      
      expect(() => {
        dynamicProcessor.applyDynamicReplacements(template, templateContext);
      }).toThrow('Invalid tool configuration passed to applyDynamicReplacements');
    });

    test('should throw error for invalid language configuration', () => {
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(false);
      
      const template = 'Test {{projectName}}';
      
      expect(() => {
        dynamicProcessor.applyDynamicReplacements(template, templateContext);
      }).toThrow('Invalid language configuration passed to applyDynamicReplacements');
    });

    test('should generate dynamic globs correctly', () => {
      const template = 'Globs: {{dynamicGlobs}}';
      const result = dynamicProcessor.applyDynamicReplacements(template, templateContext);

      expect(result).toContain('\\"**/*.ts\\"');
      expect(result).toContain('\\"**/*.js\\"');
      expect(result).toContain('\\"**/*.json\\"');
      expect(result).toContain('\\"**/.claude/*\\"');
      expect(result).toContain('\\"**/*.claude.md\\"');
    });

    test('should handle template with multiple instances of same variable', () => {
      const template = `
{{projectName}} - {{projectName}} Development
File: {{fileExtension}}, Extension: {{fileExtension}}
`;
      
      const result = dynamicProcessor.applyDynamicReplacements(template, templateContext);

      expect(result).toContain('TestProject - TestProject Development');
      expect(result).toContain('File: .md, Extension: .md');
    });
  });

  describe('generateDynamicGlobs static method', () => {
    test('should merge language and tool globs correctly', () => {
      const result = DynamicTemplateProcessor.generateDynamicGlobs(mockToolConfig, mockLanguageConfig);

      expect(result).toEqual([
        '**/*.claude.md',
        '**/*.js',
        '**/*.json',
        '**/*.ts',
        '**/.claude/*'
      ]); // Sorted alphabetically as per implementation
    });

    test('should handle tool config without additional globs', () => {
      const toolConfigWithoutGlobs = {
        ...mockToolConfig,
        globs: { inherit: 'universal' }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(toolConfigWithoutGlobs, mockLanguageConfig);

      expect(result).toEqual([
        '**/*.js',
        '**/*.json',
        '**/*.ts'
      ]); // Sorted alphabetically
    });

    test('should handle empty language globs', () => {
      const emptyLanguageConfig = {
        ...mockLanguageConfig,
        globs: []
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(mockToolConfig, emptyLanguageConfig);

      expect(result).toEqual([
        '**/*.claude.md',
        '**/.claude/*'
      ]);
    });

    test('should handle both configs without globs', () => {
      const emptyToolConfig = {
        ...mockToolConfig,
        globs: { inherit: 'universal' }
      };
      const emptyLanguageConfig = {
        ...mockLanguageConfig,
        globs: []
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(emptyToolConfig, emptyLanguageConfig);

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle complex template with all features', async () => {
      const complexTemplate = `
# {{projectName}} - Advanced Template
---
description: Template for {{toolName}}
globs: {{dynamicGlobs}}
extension: {{fileExtension}}
features: {{toolSpecificFeatures}}
instructions: {{additionalInstructions}}
---

Welcome to {{projectName}}!
`;

      mockReadFile.mockResolvedValue(complexTemplate);
      mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
      mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);

      const result = await dynamicProcessor.loadDynamicTemplate(
        'complex.md',
        'claude',
        { projectName: 'ComplexProject', lang: 'ja' }
      );

      expect(result).toContain('# ComplexProject - Advanced Template');
      expect(result).toContain('Welcome to ComplexProject!');
    });

    test('should handle template with special characters in project name', async () => {
      const template = '# {{projectName}} Project';
      
      mockReadFile.mockResolvedValue(template);
      mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
      mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);

      const result = await dynamicProcessor.loadDynamicTemplate(
        'main.md',
        'claude',
        { projectName: 'My-Special_Project@2024', lang: 'en' }
      );

      expect(result).toContain('# My-Special_Project@2024 Project');
    });

    test('should handle very large template processing', async () => {
      const largeTemplate = 'Project: {{projectName}}\n'.repeat(10000) + 'Globs: {{dynamicGlobs}}';
      
      mockReadFile.mockResolvedValue(largeTemplate);
      mockConfigurationManager.loadConfigurableToolConfig.mockResolvedValue(mockToolConfig);
      mockConfigurationManager.loadLanguageConfig.mockResolvedValue(mockLanguageConfig);
      mockTypeGuards.isSupportedTool.mockReturnValue(true);
      mockTypeGuards.isSupportedLanguage.mockReturnValue(true);
      mockTypeGuards.isStrictToolConfiguration.mockReturnValue(true);
      mockTypeGuards.isStrictLanguageConfiguration.mockReturnValue(true);

      const result = await dynamicProcessor.loadDynamicTemplate(
        'large.md',
        'claude',
        { projectName: 'LargeProject', lang: 'en' }
      );

      expect(result).toContain('Project: LargeProject');
      expect(result.split('Project: LargeProject').length - 1).toBe(10000);
    });
  });
});