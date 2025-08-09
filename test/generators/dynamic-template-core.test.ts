/**
 * TDD Test Suite - Dynamic Template Generation System
 * Phase 1: Core Template Loading Tests
 * 
 * RED PHASE: These tests will fail initially as loadDynamicTemplate() doesn't exist yet
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 */

import { GeneratorFactory } from '../../src/generators/factory';
// BaseGenerator import removed - not used
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

describe('Dynamic Template Generation - Core Template Loading', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'dynamic-template-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Core Template Loading by Language', () => {
    test('should load Japanese core template', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // Verify Japanese-specific content
      expect(result).toContain('🚨 核心原則（必須）');
      expect(result).toContain('基本ルール');
      expect(result).toContain('深層思考');
      expect(result).toContain('memory');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });

    test('should load English core template', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // Verify English-specific content
      expect(result).toContain('🚨 Core Principles (MANDATORY)');
      expect(result).toContain('Basic Rules');
      expect(result).toContain('Deep Thinking');
      expect(result).toContain('Memory');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });

    test('should load Chinese core template', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ch' });
      
      // Verify Chinese-specific content
      expect(result).toContain('🚨 核心原则（必须）');
      expect(result).toContain('基本规则');
      expect(result).toContain('深度思考');
      expect(result).toContain('记忆');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });

    test('should default to English when language not specified', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - This will FAIL initially (Red Phase)
      const result = await generator.loadDynamicTemplate('main.md');
      
      // Should default to English content
      expect(result).toContain('Core Principles (MANDATORY)');
      expect(result).not.toContain('核心原則');
      expect(result).not.toContain('核心原则');
    });
  });

  describe('Template Path Resolution', () => {
    test('should resolve core template path correctly for each language', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('github-copilot');
      
      // ACT & ASSERT - Testing path resolution logic
      const jaResult = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      const enResult = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      const chResult = await generator.loadDynamicTemplate('main.md', { lang: 'ch' });
      
      // Each result should be different (language-specific content)
      expect(jaResult).not.toEqual(enResult);
      expect(enResult).not.toEqual(chResult);
      expect(jaResult).not.toEqual(chResult);
      
      // But all should contain common structural elements
      [jaResult, enResult, chResult].forEach(result => {
        expect(result).toContain('🚨');
        expect(result).toContain('📋');
        expect(result).toContain('🔄');
        expect(result).toContain('instructions/base.md');
        expect(result).toContain('instructions/deep-think.md');
      });
    });
  });

  describe('Core Template Content Validation', () => {
    test('should contain all required instruction file references', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // ASSERT - Verify all required instruction references
      const requiredInstructions = [
        'instructions/base.md',
        'instructions/deep-think.md', 
        'instructions/memory.md',
        'instructions/command.md',
        'instructions/git.md',
        'instructions/commit-rules.md',
        'instructions/pr-rules.md',
        'instructions/develop.md',
        'instructions/KentBeck-tdd-rules.md',
        'instructions/scrum.md',
        'instructions/domain-terms.md',
        'instructions/domain-term-workflow.md',
        'instructions/search-patterns.md',
        'instructions/troubleshooting.md',
        'instructions/note.md'
      ];

      requiredInstructions.forEach(instruction => {
        expect(result).toContain(instruction);
      });
    });

    test('should contain placeholder markers in raw core template', async () => {
      // ARRANGE
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs/promises');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      
      // ACT - Read raw core template directly (not processed)
      const templatePath = path.join(__dirname, '../../templates/core/en/main.md');
      const rawTemplate = await fs.readFile(templatePath, 'utf-8');
      
      // ASSERT - Raw template should contain placeholders for dynamic replacement
      expect(rawTemplate).toContain('{{projectName}}');
      expect(rawTemplate).toContain('{{toolSpecificFeatures}}');
      expect(rawTemplate).toContain('{{additionalInstructions}}');
      expect(rawTemplate).toContain('{{dynamicGlobs}}');
    });
  });

  describe('Error Handling for Missing Core Templates', () => {
    test('should throw descriptive error when core template file missing', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - Should throw specific error for missing template
      await expect(generator.loadDynamicTemplate('nonexistent.md', { lang: 'ja' }))
        .rejects
        .toThrow('Template "nonexistent.md" not found for language "ja"');
    });

    test('should throw error when core template directory missing', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // ACT & ASSERT - Should handle missing core template directory
      await expect(generator.loadDynamicTemplate('main.md', { lang: 'nonexistent' as any }))
        .rejects
        .toThrow('Unsupported language: nonexistent');
    });
  });

  describe('Performance Requirements', () => {
    test('should load core template within reasonable time', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const startTime = Date.now();
      
      // ACT
      await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      const loadTime = Date.now() - startTime;
      
      // ASSERT - Should load within 100ms (reasonable for file I/O)
      expect(loadTime).toBeLessThan(100);
    });

    test('should handle multiple concurrent loads efficiently', async () => {
      // ARRANGE
      const generator = GeneratorFactory.createGenerator('cursor');
      const promises = [];
      
      // ACT - Load multiple templates concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(generator.loadDynamicTemplate('main.md', { 
          lang: i % 2 === 0 ? 'ja' : 'en' 
        }));
      }
      
      const results = await Promise.all(promises);
      
      // ASSERT - All loads should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(100);
      });
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - All these tests will FAIL because loadDynamicTemplate() method doesn't exist
 * - This is expected and correct according to TDD principles
 * 
 * GREEN PHASE (Next):
 * - Implement minimal loadDynamicTemplate() method in BaseGenerator
 * - Create core template files in templates/core/{lang}/main.md
 * - Make tests pass with simplest possible implementation
 * 
 * REFACTOR PHASE (Later):
 * - Optimize performance with caching
 * - Improve error handling
 * - Add configuration validation
 * - Clean up code structure
 */