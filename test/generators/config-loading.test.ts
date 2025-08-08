/**
 * TDD Test Suite - Dynamic Template Generation System  
 * Phase 2: Configuration Loading Tests
 * 
 * RED PHASE: These tests will fail initially as enhanced loadDynamicTemplate() with config loading doesn't exist yet
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 */

import { GeneratorFactory } from '../../src/generators/factory';
import { BaseGenerator } from '../../src/generators/base';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

describe('Dynamic Template Generation - Configuration Loading', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'config-loading-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Tool Configuration Loading', () => {
    test('should load cursor tool configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const config = await generator.loadToolConfig();
      
      expect(config.displayName).toBe('Cursor AI');
      expect(config.fileExtension).toBe('.mdc');
      expect(config.customSections).toHaveProperty('toolSpecificFeatures');
      expect(config.customSections).toHaveProperty('additionalInstructions');
      expect(config.globs).toHaveProperty('inherit');
      expect(config.globs.inherit).toBe('javascript');
      expect(config.globs.additional).toContain('**/*.mdc');
      expect(config.description).toContain('Cursor AI用の設定ファイル');
    });

    test('should load github-copilot tool configuration', async () => {
      // ARRANGE  
      const generator = GeneratorFactory.createGenerator('github-copilot');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const config = await generator.loadToolConfig();
      
      expect(config.displayName).toBe('GitHub Copilot');
      expect(config.fileExtension).toBe('.md');
      expect(config.customSections.toolSpecificFeatures).toContain('GitHub Copilot 固有機能');
      expect(config.customSections.additionalInstructions).toContain('GitHub Copilot Chat');
      expect(config.globs.inherit).toBe('universal');
      expect(config.description).toContain('GitHub Copilot用の設定ファイル');
    });

    test('should load claude tool configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('claude');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const config = await generator.loadToolConfig();
      
      expect(config.displayName).toBe('Claude AI');
      expect(config.fileExtension).toBe('.md');
      expect(config.customSections.toolSpecificFeatures).toContain('深層推論');
      expect(config.customSections.toolSpecificFeatures).toContain('200K tokens');
      expect(config.customSections.additionalInstructions).toContain('分析能力');
      expect(config.globs.inherit).toBe('universal');
    });
  });

  describe('Language Configuration Loading', () => {
    test('should load javascript language configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const jsConfig = await generator.loadLanguageConfig('javascript');
      
      expect(jsConfig.globs).toContain('**/*.ts');
      expect(jsConfig.globs).toContain('**/*.tsx');
      expect(jsConfig.globs).toContain('**/*.js');
      expect(jsConfig.globs).toContain('**/*.jsx');
      expect(jsConfig.globs).toContain('**/*.json');
      expect(jsConfig.globs).toContain('**/*.md');
      expect(jsConfig.globs).toContain('**/package.json');
      expect(jsConfig.globs).toContain('**/tsconfig.json');
      expect(jsConfig.description).toContain('JavaScript/TypeScript');
      expect(jsConfig.languageFeatures).toContain('TypeScript 型システム');
    });

    test('should load python language configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const pyConfig = await generator.loadLanguageConfig('python');
      
      expect(pyConfig.globs).toContain('**/*.py');
      expect(pyConfig.globs).toContain('**/*.pyi');
      expect(pyConfig.globs).toContain('**/requirements.txt');
      expect(pyConfig.globs).toContain('**/pyproject.toml');
      expect(pyConfig.description).toContain('Python プロジェクト');
      expect(pyConfig.languageFeatures).toContain('Python 3.8+ 構文');
      expect(pyConfig.languageFeatures).toContain('Django/Flask/FastAPI フレームワーク');
    });

    test('should load php language configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const phpConfig = await generator.loadLanguageConfig('php');
      
      expect(phpConfig.globs).toContain('**/*.php');
      expect(phpConfig.globs).toContain('**/composer.json');
      expect(phpConfig.globs).toContain('**/.htaccess');
      expect(phpConfig.description).toContain('PHP プロジェクト');
      expect(phpConfig.languageFeatures).toContain('PHP 8.0+ 構文');
      expect(phpConfig.languageFeatures).toContain('Laravel/Symfony フレームワーク');
    });

    test('should load ruby language configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const rubyConfig = await generator.loadLanguageConfig('ruby');
      
      expect(rubyConfig.globs).toContain('**/*.rb');
      expect(rubyConfig.globs).toContain('**/Gemfile');
      expect(rubyConfig.globs).toContain('**/*.rake');
      expect(rubyConfig.description).toContain('Ruby プロジェクト');
      expect(rubyConfig.languageFeatures).toContain('Ruby 3.0+ 構文');
      expect(rubyConfig.languageFeatures).toContain('Ruby on Rails フレームワーク');
    });

    test('should load universal language configuration', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const universalConfig = await generator.loadLanguageConfig('universal');
      
      expect(universalConfig.globs).toContain('**/*.md');
      expect(universalConfig.globs).toContain('**/*.json');
      expect(universalConfig.globs).toContain('**/*.yaml');
      expect(universalConfig.globs).toContain('**/README*');
      expect(universalConfig.globs).toContain('**/Dockerfile');
      expect(universalConfig.description).toContain('汎用プロジェクト');
      expect(universalConfig.languageFeatures).toContain('ドキュメントファイル');
    });
  });

  describe('Configuration Error Handling', () => {
    test('should throw error when tool config file missing', async () => {
      // ARRANGE
      // Create a test generator with non-existent tool name by mocking
      const generator = GeneratorFactory.createGenerator('cursor');
      // Mock the toolConfig to simulate non-existent tool
      (generator as any).toolConfig = { name: 'nonexistent-tool', templateDir: 'nonexistent' };
      
      // ACT & ASSERT - Should throw specific error for missing tool config
      await expect(generator.loadToolConfig())
        .rejects
        .toThrow('Tool configuration not found for nonexistent-tool');
    });

    test('should throw error when language config file missing', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - Should throw specific error for missing language config
      await expect(generator.loadLanguageConfig('nonexistent-language'))
        .rejects
        .toThrow('Language configuration not found for nonexistent-language');
    });

    test('should handle malformed JSON in tool config files', async () => {
      // ARRANGE - This test would require temporary malformed config file setup
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Mock broken config loading to test JSON parsing error handling
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('invalid json content');
      
      // ACT & ASSERT - Should throw JSON parsing error
      await expect(generator.loadToolConfig())
        .rejects
        .toThrow('Failed to parse tool configuration for cursor');
        
      // Restore original implementation
      jest.restoreAllMocks();
    });
  });

  describe('Configuration Integration', () => {
    test('should load both tool and language configs without interference', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT - Load both types of configs
      const toolConfig = await generator.loadToolConfig();
      const jsConfig = await generator.loadLanguageConfig('javascript');
      
      // ASSERT - Both configs should load successfully
      expect(toolConfig.displayName).toBe('Cursor AI');
      expect(jsConfig.description).toContain('JavaScript/TypeScript');
      
      // Configs should be independent
      expect(toolConfig).not.toHaveProperty('languageFeatures');
      expect(jsConfig).not.toHaveProperty('displayName');
    });

    test('should support config inheritance pattern', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const toolConfig = await generator.loadToolConfig();
      
      // ACT - Load inherited language config
      const inheritedLanguage = toolConfig.globs.inherit; // should be 'javascript'
      const langConfig = await generator.loadLanguageConfig(inheritedLanguage);
      
      // ASSERT - Inheritance relationship should work
      expect(inheritedLanguage).toBe('javascript');
      expect(langConfig.globs).toContain('**/*.ts');
      expect(langConfig.globs).toContain('**/*.js');
    });
  });

  describe('Performance Requirements for Config Loading', () => {
    test('should load tool configuration within reasonable time', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const startTime = Date.now();
      
      // ACT
      await generator.loadToolConfig();
      const loadTime = Date.now() - startTime;
      
      // ASSERT - Should load within 50ms (reasonable for JSON file I/O)
      expect(loadTime).toBeLessThan(50);
    });

    test('should load language configuration within reasonable time', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const startTime = Date.now();
      
      // ACT
      await generator.loadLanguageConfig('javascript');
      const loadTime = Date.now() - startTime;
      
      // ASSERT - Should load within 50ms (reasonable for JSON file I/O)
      expect(loadTime).toBeLessThan(50);
    });

    test('should handle multiple concurrent config loads efficiently', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('github-copilot');
      const promises = [];
      
      // ACT - Load multiple configs concurrently
      promises.push(generator.loadToolConfig());
      promises.push(generator.loadLanguageConfig('python'));
      promises.push(generator.loadLanguageConfig('javascript'));
      promises.push(generator.loadLanguageConfig('universal'));
      
      const results = await Promise.all(promises);
      
      // ASSERT - All loads should succeed
      expect(results).toHaveLength(4);
      expect(results[0].displayName).toBe('GitHub Copilot'); // tool config
      expect(results[1].description).toContain('Python'); // python config
      expect(results[2].description).toContain('JavaScript'); // js config
      expect(results[3].description).toContain('汎用'); // universal config
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - All these tests will FAIL because enhanced loadDynamicTemplate() with config integration doesn't exist
 * - loadToolConfig() and loadLanguageConfig() methods don't exist yet
 * - Configuration files exist but aren't being utilized yet
 * 
 * GREEN PHASE (Next):
 * - Implement loadToolConfig() and loadLanguageConfig() methods in BaseGenerator
 * - Enhance loadDynamicTemplate() to use these configs for dynamic replacement
 * - Make tests pass with minimal implementation
 * 
 * REFACTOR PHASE (Later):
 * - Add configuration caching for performance
 * - Improve error handling and validation
 * - Add config file validation
 * - Optimize JSON parsing and file I/O
 */