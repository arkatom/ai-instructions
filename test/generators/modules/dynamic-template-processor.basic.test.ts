/**
 * Basic TDD Test Suite for DynamicTemplateProcessor Module
 * Focuses on core functionality with minimal mocking complexity
 * Achieves coverage improvement for modular architecture
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DynamicTemplateProcessor } from '../../../src/generators/modules/dynamic-template-processor';
import { TemplateResolver } from '../../../src/generators/modules/template-resolver';
import type {
  StrictToolConfiguration,
  StrictLanguageConfiguration
} from '../../../src/generators/types';

describe('DynamicTemplateProcessor - Basic Tests', () => {
  let dynamicProcessor: DynamicTemplateProcessor;
  let mockTemplateResolver: jest.Mocked<TemplateResolver>;

  const mockToolConfig: StrictToolConfiguration = {
    displayName: 'Claude AI',
    fileExtension: '.md',
    globs: {
      inherit: 'universal',
      additional: ['**/*.claude.md', '**/.claude/*']
    },
    description: 'Claude AI development assistant'
  };

  const mockLanguageConfig: StrictLanguageConfiguration = {
    globs: ['**/*.ts', '**/*.js', '**/*.json'],
    description: 'TypeScript/JavaScript development',
    languageFeatures: ['types', 'async/await', 'modules']
  };

  beforeEach(() => {
    mockTemplateResolver = {
      loadTemplate: jest.fn(),
      buildTemplatePaths: jest.fn(),
      tryReadTemplate: jest.fn()
    } as any;
    
    dynamicProcessor = new DynamicTemplateProcessor('/test/templates', mockTemplateResolver);
    jest.clearAllMocks();
  });

  describe('generateDynamicGlobs static method', () => {
    test('should merge language and tool globs correctly', () => {
      const result = DynamicTemplateProcessor.generateDynamicGlobs(mockToolConfig, mockLanguageConfig);

      expect(result).toContain('**/*.ts');
      expect(result).toContain('**/*.js');
      expect(result).toContain('**/*.json');
      expect(result).toContain('**/*.claude.md');
      expect(result).toContain('**/.claude/*');
      expect(result).toHaveLength(5);
    });

    test('should handle tool config without additional globs', () => {
      const toolConfigWithoutGlobs = {
        ...mockToolConfig,
        globs: { inherit: 'universal' }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(toolConfigWithoutGlobs, mockLanguageConfig);

      expect(result).toEqual(expect.arrayContaining([
        '**/*.ts',
        '**/*.js',
        '**/*.json'
      ]));
      expect(result).toHaveLength(3);
    });

    test('should handle empty language globs', () => {
      const emptyLanguageConfig = {
        ...mockLanguageConfig,
        globs: []
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(mockToolConfig, emptyLanguageConfig);

      expect(result).toEqual(expect.arrayContaining([
        '**/*.claude.md',
        '**/.claude/*'
      ]));
      expect(result).toHaveLength(2);
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

    test('should return sorted and deduplicated globs', () => {
      const toolConfigWithDuplicates = {
        ...mockToolConfig,
        globs: {
          inherit: 'universal',
          additional: ['**/*.ts', '**/*.claude.md'] // **/*.ts is already in language config
        }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(toolConfigWithDuplicates, mockLanguageConfig);

      // Should be deduplicated and sorted
      const sortedResult = [...result].sort();
      expect(result).toEqual(sortedResult);
      
      // Count of unique globs
      const uniqueGlobs = new Set(result);
      expect(uniqueGlobs.size).toBe(result.length);
    });

    test('should handle complex glob patterns', () => {
      const complexToolConfig = {
        ...mockToolConfig,
        globs: {
          inherit: 'universal',
          additional: [
            '**/test/**/*.spec.ts',
            '**/*.stories.js',
            '**/docs/**/*.md'
          ]
        }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(complexToolConfig, mockLanguageConfig);

      expect(result).toContain('**/test/**/*.spec.ts');
      expect(result).toContain('**/*.stories.js');
      expect(result).toContain('**/docs/**/*.md');
    });
  });

  describe('Constructor and basic functionality', () => {
    test('should initialize with template directory and resolver', () => {
      expect(dynamicProcessor).toBeDefined();
      expect(dynamicProcessor).toBeInstanceOf(DynamicTemplateProcessor);
    });

    test('should accept different template directories', () => {
      const customProcessor = new DynamicTemplateProcessor('/custom/templates', mockTemplateResolver);
      expect(customProcessor).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle undefined globs gracefully', () => {
      const configWithUndefinedGlobs = {
        ...mockToolConfig,
        globs: undefined as any
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(configWithUndefinedGlobs, mockLanguageConfig);

      expect(result).toEqual(expect.arrayContaining([
        '**/*.ts',
        '**/*.js',
        '**/*.json'
      ]));
    });

    test('should handle null additional globs', () => {
      const configWithNullAdditional = {
        ...mockToolConfig,
        globs: {
          inherit: 'universal',
          additional: null as any
        }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(configWithNullAdditional, mockLanguageConfig);

      expect(result).toEqual(expect.arrayContaining([
        '**/*.ts',
        '**/*.js',
        '**/*.json'
      ]));
    });

    test('should handle very long glob lists', () => {
      const manyGlobs = Array.from({ length: 100 }, (_, i) => `**/*.type${i}`);
      const configWithManyGlobs = {
        ...mockToolConfig,
        globs: {
          inherit: 'universal',
          additional: manyGlobs
        }
      };

      const result = DynamicTemplateProcessor.generateDynamicGlobs(configWithManyGlobs, mockLanguageConfig);

      expect(result.length).toBeGreaterThan(100);
      expect(result).toContain('**/*.type0');
      expect(result).toContain('**/*.type99');
    });
  });
});