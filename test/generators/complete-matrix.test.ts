/**
 * TDD Test Suite - Dynamic Template Generation System
 * Phase 4: Complete Matrix Test (3 tools × 3 languages = 9 combinations)
 * 
 * Integration test to ensure all tool-language combinations work correctly
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 */

import { GeneratorFactory } from '../../src/generators/factory';
import { SupportedTool, SupportedLanguage } from '../../src/generators/types';
// BaseGenerator import removed - not used
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

describe('Dynamic Template Generation - Complete Matrix Test', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'matrix-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete Tool × Language Matrix (3×3=9)', () => {
    const tools = ['cursor', 'github-copilot', 'claude'] as const;
    const languages = ['ja', 'en', 'ch'] as const;

    // Generate test for each combination
    tools.forEach(tool => {
      languages.forEach(lang => {
        test(`should generate valid template for ${tool} in ${lang}`, async () => {
          // ARRANGE
          const generator = GeneratorFactory.createGenerator(tool);
          
          // ACT
          const result = await generator.loadDynamicTemplate('main.md', { 
            lang, 
            projectName: `test-project-${tool}-${lang}`,
            languageConfig: 'javascript'
          });
          
          // ASSERT - Common validation for all combinations
          expect(result).toBeTruthy();
          expect(result.length).toBeGreaterThan(200);
          
          // Language-specific content validation
          switch(lang) {
            case 'ja':
              expect(result).toContain('🚨 核心原則（必須）');
              expect(result).toContain('基本ルール');
              expect(result).toContain('深層思考');
              expect(result).toContain('memory');
              break;
            case 'en':
              expect(result).toContain('🚨 Core Principles (MANDATORY)');
              expect(result).toContain('Basic Rules');
              expect(result).toContain('Deep Thinking');
              expect(result).toContain('Memory');
              break;
            case 'ch':
              expect(result).toContain('🚨 核心原则（必须）');
              expect(result).toContain('基本规则');
              expect(result).toContain('深度思考');
              expect(result).toContain('内存');
              break;
          }
          
          // Tool-specific content validation
          switch(tool) {
            case 'cursor':
              expect(result).not.toContain('{{toolName}}');
              expect(result).toContain('**/*.mdc');
              break;
            case 'github-copilot':
              expect(result).not.toContain('{{toolName}}');
              // github-copilot uses universal globs (no specific additional globs)
              break;
            case 'claude':
              expect(result).not.toContain('{{toolName}}');
              // claude uses universal globs (no specific additional globs)
              break;
          }
          
          // Project name integration
          expect(result).toContain(`test-project-${tool}-${lang}`);
          
          // Dynamic globs integration - now only present if tool config specifies additional globs
          if (tool === 'cursor') {
            expect(result).toContain('**/*.mdc'); // Cursor-specific additional globs
            expect(result).toContain('**/.cursor/**');
          }
          
          // Required instruction references
          const requiredInstructions = [
            'instructions/base.md',
            'instructions/deep-think.md', 
            'instructions/memory.md',
            'instructions/command.md',
            'instructions/git.md',
            'instructions/commit-rules.md',
            'instructions/pr-rules.md',
            'instructions/develop.md',
            'instructions/KentBeck-tdd-rules.md'
          ];
          
          requiredInstructions.forEach(instruction => {
            expect(result).toContain(instruction);
          });
        });
      });
    });
  });

  describe('Matrix Consistency Validation', () => {
    test('should maintain consistent structure across all combinations', async () => {
      // ARRANGE
      const tools = ['cursor', 'github-copilot', 'claude'] as const;
      const languages = ['ja', 'en', 'ch'] as const;
      const results = new Map<string, string>();
      
      // ACT - Generate all 9 combinations
      for (const tool of tools) {
        for (const lang of languages) {
          const generator = GeneratorFactory.createGenerator(tool);
          const result = await generator.loadDynamicTemplate('main.md', { 
            lang, 
            projectName: 'consistency-test',
            languageConfig: 'javascript'
          });
          results.set(`${tool}-${lang}`, result);
        }
      }
      
      // ASSERT - Consistency checks
      expect(results.size).toBe(9);
      
      // All results should have similar structure
      results.forEach((result, _key) => {
        expect(result).toContain('🚨'); // Core principles marker
        expect(result).toContain('📋'); // Reference files marker
        expect(result).toContain('🔄'); // Execution flow marker
        expect(result).toContain('consistency-test'); // Project name
        expect(result).toContain('instructions/base.md');
        expect(result.length).toBeGreaterThan(200);
      });
    });

    test('should generate unique content for different tools in same language', async () => {
      // ARRANGE
      const lang = 'ja';
      const results: string[] = [];
      
      // ACT
      for (const tool of ['cursor', 'github-copilot', 'claude'] as const) {
        const generator = GeneratorFactory.createGenerator(tool);
        const result = await generator.loadDynamicTemplate('main.md', { 
          lang,
          projectName: 'uniqueness-test',
          languageConfig: 'javascript'
        });
        results.push(result);
      }
      
      // ASSERT - Tools with different configs should generate different content
      expect(results[0]).not.toEqual(results[1]); // cursor vs github-copilot (cursor has additional globs)
      // Note: github-copilot and claude use same universal config, so they generate identical content
      expect(results[1]).toEqual(results[2]); // github-copilot vs claude (both use universal config)
      expect(results[0]).not.toEqual(results[2]); // cursor vs claude (different configs)
      
      // But all should contain common elements
      results.forEach(result => {
        expect(result).toContain('🚨 核心原則（必須）');
        expect(result).toContain('uniqueness-test');
      });
    });

    test('should generate unique content for same tool in different languages', async () => {
      // ARRANGE
      const tool = 'cursor';
      const results: string[] = [];
      
      // ACT
      for (const lang of ['ja', 'en', 'ch'] as const) {
        const generator = GeneratorFactory.createGenerator(tool);
        const result = await generator.loadDynamicTemplate('main.md', { 
          lang,
          projectName: 'language-test',
          languageConfig: 'javascript'
        });
        results.push(result);
      }
      
      // ASSERT - Each language should generate different content
      expect(results[0]).not.toEqual(results[1]); // ja vs en
      expect(results[1]).not.toEqual(results[2]); // en vs ch
      expect(results[0]).not.toEqual(results[2]); // ja vs ch
      
      // But all should contain common tool-specific elements
      results.forEach(result => {
        expect(result).not.toContain('{{toolName}}'); // Tool name placeholder should be replaced
        expect(result).toContain('language-test');
        expect(result).toContain('**/*.mdc'); // Cursor-specific globs
      });
    });
  });

  describe('Performance Matrix Test', () => {
    test('should handle all 9 combinations within reasonable time', async () => {
      // ARRANGE
      const startTime = Date.now();
      const tools = ['cursor', 'github-copilot', 'claude'] as const;
      const languages = ['ja', 'en', 'ch'] as const;
      const promises: Promise<string>[] = [];
      
      // ACT - Generate all combinations concurrently
      tools.forEach(tool => {
        languages.forEach(lang => {
          const generator = GeneratorFactory.createGenerator(tool);
          promises.push(
            generator.loadDynamicTemplate('main.md', { 
              lang,
              projectName: 'performance-test',
              languageConfig: 'javascript'
            })
          );
        });
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // ASSERT
      expect(results).toHaveLength(9);
      expect(totalTime).toBeLessThan(500); // All 9 combinations within 500ms
      
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(200);
      });
    });

    test('should handle high load with multiple concurrent matrix tests', async () => {
      // ARRANGE
      const concurrentTests = 3;
      const matrixPromises: Promise<string[]>[] = [];
      
      // ACT - Run multiple matrix tests concurrently
      for (let i = 0; i < concurrentTests; i++) {
        const singleMatrixPromises: Promise<string>[] = [];
        
        ['cursor', 'github-copilot', 'claude'].forEach(tool => {
          ['ja', 'en', 'ch'].forEach(lang => {
            const generator = GeneratorFactory.createGenerator(tool as SupportedTool);
            singleMatrixPromises.push(
              generator.loadDynamicTemplate('main.md', { 
                lang: lang as SupportedLanguage,
                projectName: `load-test-${i}`,
                languageConfig: 'javascript'
              })
            );
          });
        });
        
        matrixPromises.push(Promise.all(singleMatrixPromises));
      }
      
      const allResults = await Promise.all(matrixPromises);
      
      // ASSERT
      expect(allResults).toHaveLength(concurrentTests);
      allResults.forEach(matrixResults => {
        expect(matrixResults).toHaveLength(9);
        matrixResults.forEach(result => {
          expect(result).toBeTruthy();
          expect(result.length).toBeGreaterThan(200);
        });
      });
    });
  });

  describe('Error Handling Matrix', () => {
    test('should handle invalid tool-language combinations gracefully', async () => {
      // ARRANGE
      const _validTools = ['cursor', 'github-copilot', 'claude'];
      const _validLanguages = ['ja', 'en', 'ch'];
      
      // ACT & ASSERT - Invalid tool
      expect(() => GeneratorFactory.createGenerator('invalid-tool' as never))
        .toThrow('Unsupported tool: invalid-tool');
      
      // ACT & ASSERT - Invalid language (should throw error)
      const generator = GeneratorFactory.createGenerator('cursor');
      await expect(generator.loadDynamicTemplate('main.md', { 
        lang: 'invalid-lang' as never,
        projectName: 'error-test',
        languageConfig: 'javascript'
      })).rejects.toThrow('Unsupported language: invalid-lang');
    });

    test('should validate all combinations handle missing config gracefully', async () => {
      // ARRANGE
      const tools = ['cursor', 'github-copilot', 'claude'] as const;
      const languages = ['ja', 'en', 'ch'] as const;
      
      // ACT & ASSERT
      for (const tool of tools) {
        for (const lang of languages) {
          const generator = GeneratorFactory.createGenerator(tool);
          
          // Should not throw when languageConfig is missing
          const result = await generator.loadDynamicTemplate('main.md', { 
            lang,
            projectName: 'config-missing-test'
            // languageConfig intentionally omitted
          });
          
          expect(result).toBeTruthy();
          expect(result).toContain('config-missing-test');
        }
      }
    });
  });
});

/**
 * TDD Implementation Notes - Cycle 4:
 * 
 * RED PHASE (Current):
 * - These matrix tests will initially pass if Cycles 1-3 were implemented correctly
 * - This is the final integration test phase
 * 
 * GREEN PHASE (Expected):
 * - All 9 combinations (3 tools × 3 languages) should work
 * - Performance should be within acceptable limits
 * - Error handling should be robust
 * 
 * REFACTOR PHASE (Final):
 * - Optimize any performance bottlenecks discovered
 * - Enhance error messages if needed
 * - Add any missing edge case handling
 * 
 * SUCCESS CRITERIA:
 * - All matrix combinations generate valid templates
 * - Performance is under 500ms for all 9 combinations
 * - Error handling is graceful for invalid inputs
 * - Content is correctly customized per tool and language
 */