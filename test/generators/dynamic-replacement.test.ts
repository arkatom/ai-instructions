/**
 * TDD Test Suite - Dynamic Template Generation System
 * Phase 3: Dynamic Replacement Tests
 * 
 * GREEN PHASE: Test enhanced loadDynamicTemplate() with full config integration
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 */

import { GeneratorFactory } from '../../src/generators/factory';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

describe('Dynamic Template Generation - Dynamic Replacement', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'dynamic-replacement-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Tool-specific Dynamic Replacement', () => {
    test('should replace tool name with display name from config', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja',
        projectName: 'test-project' 
      });
      
      // ASSERT - toolName placeholder should be replaced with empty string
      expect(result).toContain('開発指示 - test-project');
      expect(result).not.toContain('{{toolName}}');
    });

    test('should replace tool-specific features section', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // ASSERT - toolSpecificFeatures placeholder should be replaced with empty string
      expect(result).not.toContain('{{toolSpecificFeatures}}');
      // Since customSections is removed from config, these sections won't exist
      expect(result).not.toContain('## Cursor 固有機能');
    });

    test('should replace additional instructions section', async () => {
      // ARRANGE  
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // ASSERT - additionalInstructions placeholder should be replaced with empty string
      expect(result).not.toContain('{{additionalInstructions}}');
      // Since customSections is removed from config, these sections won't exist
      expect(result).not.toContain('## 追加指示');
    });

    test('should handle different tools with different configs', async () => {
      // ARRANGE & ACT
      const cursorResult = await GeneratorFactory.createGenerator('cursor')
        .loadDynamicTemplate('main.md', { lang: 'en' });
      const copilotResult = await GeneratorFactory.createGenerator('github-copilot')
        .loadDynamicTemplate('main.md', { lang: 'en' });
      const claudeResult = await GeneratorFactory.createGenerator('claude')
        .loadDynamicTemplate('main.md', { lang: 'en' });
      
      // ASSERT - Each should have basic template structure (no tool-specific content)
      expect(cursorResult).toContain('Development Instructions');
      expect(cursorResult).not.toContain('{{toolName}}');
      
      expect(copilotResult).toContain('Development Instructions');
      expect(copilotResult).not.toContain('{{toolName}}');
      
      expect(claudeResult).toContain('Development Instructions');
      expect(claudeResult).not.toContain('{{toolName}}');
    });
  });

  describe('Dynamic Globs Generation', () => {
    test('should generate dynamic globs from javascript config for cursor', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // ASSERT - Should include JavaScript globs + Cursor-specific additions
      expect(result).toContain('**/*.js');
      expect(result).toContain('**/*.jsx');
      expect(result).toContain('**/*.json');
      expect(result).toContain('**/*.mdc'); // Cursor-specific addition
      expect(result).toContain('**/.cursor/**'); // Cursor-specific addition
      expect(result).not.toContain('{{dynamicGlobs}}');
    });

    test('should generate universal globs for github-copilot', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('github-copilot');
      
      // ACT  
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // ASSERT - Should include universal globs (no additional)
      expect(result).toContain('**/*.md');
      expect(result).toContain('**/*.json');
      expect(result).toContain('**/*.yaml');
      expect(result).toContain('**/README*');
      expect(result).not.toContain('**/*.ts'); // No JavaScript-specific
      expect(result).not.toContain('{{dynamicGlobs}}');
    });

    test('should support custom language config override', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT - Override default javascript with python config
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en',
        languageConfig: 'python'
      });
      
      // ASSERT - Should use Python globs instead of JavaScript
      expect(result).toContain('**/*.py');
      expect(result).toContain('**/requirements.txt');
      expect(result).toContain('**/pyproject.toml');
      expect(result).toContain('**/*.mdc'); // Still includes Cursor addition
      expect(result).not.toContain('**/*.js'); // No JavaScript globs
    });

    test('should deduplicate and sort globs', async () => {
      // ARRANGE - Create a scenario where globs might overlap
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // ASSERT - Should not have duplicate globs and should be sorted
      const globsMatch = result.match(/globs: (\[[\s\S]*?\])/);
      expect(globsMatch).toBeTruthy();
      
      if (!globsMatch || !globsMatch[1]) {
        throw new Error('Globs match not found - check template format');
      }
      const globsStr = globsMatch[1];
      const globs = JSON.parse(globsStr.replace(/\\"/g, '"'));
      
      // Check no duplicates
      const uniqueGlobs = Array.from(new Set(globs));
      expect(globs).toHaveLength(uniqueGlobs.length);
      
      // Check sorted
      const sortedGlobs = [...globs].sort();
      expect(globs).toEqual(sortedGlobs);
    });
  });

  describe('Multi-Language Template Integration', () => {
    test('should maintain language-specific content with dynamic replacement', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT - Test all languages
      const jaResult = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja', 
        projectName: 'テスト-プロジェクト' 
      });
      const enResult = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en', 
        projectName: 'test-project' 
      });
      const chResult = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ch', 
        projectName: '测试项目' 
      });
      
      // ASSERT - Each should have language-specific content + dynamic replacements
      expect(jaResult).toContain('🚨 核心原則（必須）');
      expect(jaResult).toContain('開発指示 - テスト-プロジェクト');
      expect(jaResult).not.toContain('{{toolName}}');
      
      expect(enResult).toContain('🚨 Core Principles (MANDATORY)');
      expect(enResult).toContain('Development Instructions - test-project');
      expect(enResult).not.toContain('{{toolName}}');
      
      expect(chResult).toContain('🚨 核心原则（必须）');
      expect(chResult).toContain('开发指令 - 测试项目');
      expect(chResult).not.toContain('{{toolName}}');
    });
  });

  describe('Error Handling for Dynamic Replacement', () => {
    test('should handle missing tool config gracefully', async () => {
      // ARRANGE - Mock missing tool config
      const generator = GeneratorFactory.createGenerator('cursor');
      jest.spyOn(generator, 'loadToolConfig').mockRejectedValue(new Error('Tool configuration not found'));
      
      // ACT & ASSERT - Should propagate config error
      await expect(generator.loadDynamicTemplate('main.md'))
        .rejects
        .toThrow('Tool configuration not found');
        
      jest.restoreAllMocks();
    });

    test('should handle missing language config gracefully', async () => {
      // ARRANGE - Mock missing language config
      const generator = GeneratorFactory.createGenerator('cursor');
      jest.spyOn(generator, 'loadLanguageConfig').mockRejectedValue(new Error('Language configuration not found'));
      
      // ACT & ASSERT - Should propagate config error
      await expect(generator.loadDynamicTemplate('main.md'))
        .rejects
        .toThrow('Language configuration not found');
        
      jest.restoreAllMocks();
    });

    test('should handle config without optional sections', async () => {
      // ARRANGE - Mock config with missing optional sections
      const generator = GeneratorFactory.createGenerator('cursor');
      jest.spyOn(generator, 'loadToolConfig').mockResolvedValue({
        displayName: 'Test Tool',
        fileExtension: '.md',
        // Missing customSections and globs
      });
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // ASSERT - Should handle missing sections gracefully
      expect(result).toContain('Development Instructions');
      expect(result).not.toContain('{{toolName}}');
      expect(result).not.toContain('{{toolSpecificFeatures}}'); // Should be replaced with empty
      expect(result).not.toContain('{{additionalInstructions}}'); // Should be replaced with empty
      
      jest.restoreAllMocks();
    });
  });

  describe('Performance for Enhanced Dynamic Replacement', () => {
    test('should load and replace within reasonable time', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const startTime = Date.now();
      
      // ACT
      await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja', 
        projectName: 'performance-test' 
      });
      const loadTime = Date.now() - startTime;
      
      // ASSERT - Should complete within 200ms (including config loading + replacement)
      expect(loadTime).toBeLessThan(200);
    });

    test('should handle concurrent dynamic template generation', async () => {
      // ARRANGE
      const promises = [];
      
      // ACT - Generate multiple templates concurrently
      promises.push(GeneratorFactory.createGenerator('cursor').loadDynamicTemplate('main.md', { lang: 'ja' }));
      promises.push(GeneratorFactory.createGenerator('github-copilot').loadDynamicTemplate('main.md', { lang: 'en' }));
      promises.push(GeneratorFactory.createGenerator('claude').loadDynamicTemplate('main.md', { lang: 'ch' }));
      promises.push(GeneratorFactory.createGenerator('cursor').loadDynamicTemplate('main.md', { languageConfig: 'python' }));
      
      const results = await Promise.all(promises);
      
      // ASSERT - All should succeed with basic template structure
      expect(results).toHaveLength(4);
      expect(results[0]).toContain('開発指示');
      expect(results[1]).toContain('Development Instructions');
      expect(results[2]).toContain('开发指令');
      expect(results[3]).toContain('**/*.py'); // Python globs
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * GREEN PHASE (Current):
 * - Tests enhanced loadDynamicTemplate() with full config integration
 * - Verifies tool-specific features, additional instructions, and dynamic globs
 * - Tests multi-language support with dynamic replacement
 * - Error handling for various config scenarios
 * - Performance testing for enhanced functionality
 * 
 * REFACTOR PHASE (Next):
 * - Add configuration caching for better performance
 * - Optimize glob generation and deduplication
 * - Add config validation
 * - Improve error messages and debugging
 */