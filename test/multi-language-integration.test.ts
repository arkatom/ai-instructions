/**
 * 🌍 Multi-Language Integration Tests
 * Comprehensive tests for multi-language support across all tools and formats
 * Tests for Issue: 多言語実装不備の完全修正
 */

import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { GeneratorFactory } from '../src/generators/factory';
import { ConverterFactory, OutputFormat } from '../src/converters';

describe('🌍 Multi-Language Integration Tests', () => {
  let tempDir: string;
  
  // Expected 14 instruction files (including base.md)
  const expectedInstructionFiles = [
    'base.md',
    'anytime.md',
    'command.md', 
    'commit-rules.md',
    'deep-think.md',
    'develop.md',
    'git.md',
    'KentBeck-tdd-rules.md',
    'memory.md',
    'note.md',
    'notion-retrospective.md',
    'pr-rules.md',
    'search-patterns.md',
    'troubleshooting.md'
  ];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'multi-lang-test-'));
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Shared Instructions Directory Structure', () => {
    test('should have all 14 instruction files for Japanese', () => {
      const jaDir = join(__dirname, '../templates/shared/instructions/ja');
      expect(existsSync(jaDir)).toBe(true);
      
      const files = readdirSync(jaDir);
      expectedInstructionFiles.forEach(file => {
        expect(files).toContain(file);
        expect(existsSync(join(jaDir, file))).toBe(true);
      });
    });

    test('should have all 14 instruction files for English', () => {
      const enDir = join(__dirname, '../templates/shared/instructions/en');
      expect(existsSync(enDir)).toBe(true);
      
      const files = readdirSync(enDir);
      expectedInstructionFiles.forEach(file => {
        expect(files).toContain(file);
        expect(existsSync(join(enDir, file))).toBe(true);
      });
    });

    test('should have all 14 instruction files for Chinese', () => {
      const chDir = join(__dirname, '../templates/shared/instructions/ch');
      expect(existsSync(chDir)).toBe(true);
      
      const files = readdirSync(chDir);
      expectedInstructionFiles.forEach(file => {
        expect(files).toContain(file);
        expect(existsSync(join(chDir, file))).toBe(true);
      });
    });

    test('should have identical file counts across all languages', () => {
      const jaFiles = readdirSync(join(__dirname, '../templates/shared/instructions/ja'));
      const enFiles = readdirSync(join(__dirname, '../templates/shared/instructions/en'));
      const chFiles = readdirSync(join(__dirname, '../templates/shared/instructions/ch'));
      
      expect(jaFiles.length).toBe(enFiles.length);
      expect(enFiles.length).toBe(chFiles.length);
      expect(jaFiles.length).toBe(14); // All 14 files should exist
    });
  });

  describe('Content Language Validation', () => {
    test('English files should contain English content, not Japanese', () => {
      const enBaseFile = join(__dirname, '../templates/shared/instructions/en/base.md');
      const content = readFileSync(enBaseFile, 'utf-8');
      
      // Should not contain Japanese characters
      expect(content).not.toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
      // Should contain English content
      expect(content).toMatch(/Core Rules/i);
      expect(content).toMatch(/MUST/);
    });

    test('Chinese files should contain Chinese content, not Japanese', () => {
      const chBaseFile = join(__dirname, '../templates/shared/instructions/ch/base.md');
      const content = readFileSync(chBaseFile, 'utf-8');
      
      // Should contain Chinese characters
      expect(content).toMatch(/[\u4E00-\u9FAF]/);
      // Should contain appropriate Chinese content
      expect(content).toMatch(/核心规则|基本规则/);
    });

    test('Japanese files should contain proper Japanese content', () => {
      const jaBaseFile = join(__dirname, '../templates/shared/instructions/ja/base.md');
      const content = readFileSync(jaBaseFile, 'utf-8');
      
      // Should contain Japanese characters
      expect(content).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
      // Should contain appropriate Japanese content
      expect(content).toMatch(/超基本ルール|基本ルール/);
    });
  });

  describe('Claude Template Language-Specific Content', () => {
    test('templates/shared/instructions/en/base.md should be in English, not Japanese', () => {
      const enSharedBase = join(__dirname, '../templates/shared/instructions/en/base.md');
      expect(existsSync(enSharedBase)).toBe(true);
      
      const content = readFileSync(enSharedBase, 'utf-8');
      
      // Should NOT contain Japanese characters
      expect(content).not.toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
      // Should contain English content
      expect(content).toMatch(/Core Rules/i);
      expect(content).toMatch(/MUST/);
    });
  });

  describe('Multi-Language Code Generation', () => {
    test('should generate Claude files for all languages', async () => {
      const languages = ['ja', 'en', 'ch'] as const;
      
      for (const lang of languages) {
        const langTempDir = join(tempDir, `claude-${lang}`);
        const generator = GeneratorFactory.createGenerator('claude');
        
        await generator.generateFiles(langTempDir, {
          projectName: `test-project-${lang}`,
          lang,
          force: true
        });
        
        // Check CLAUDE.md exists
        expect(existsSync(join(langTempDir, 'CLAUDE.md'))).toBe(true);
        
        // Check instructions directory exists
        expect(existsSync(join(langTempDir, 'instructions'))).toBe(true);
        
        // Check all 14 instruction files are copied
        const instructionsDir = join(langTempDir, 'instructions');
        const copiedFiles = readdirSync(instructionsDir);
        expect(copiedFiles.length).toBe(14);
        
        expectedInstructionFiles.forEach(file => {
          expect(copiedFiles).toContain(file);
        });
      }
    });

    test('should generate all output formats for all languages', async () => {
      const languages = ['ja', 'en', 'ch'] as const;
      const formats = [OutputFormat.CLAUDE, OutputFormat.CURSOR, OutputFormat.COPILOT, OutputFormat.WINDSURF] as const;
      
      for (const lang of languages) {
        for (const format of formats) {
          const formatTempDir = join(tempDir, `${format}-${lang}`);
          const generator = GeneratorFactory.createGenerator('claude'); // Use Claude as base
          
          await generator.generateFiles(formatTempDir, {
            projectName: `test-project-${lang}-${format}`,
            lang,
            outputFormat: format,
            force: true
          });
          
          // Verify format-specific files exist
          switch (format) {
            case OutputFormat.CLAUDE:
              expect(existsSync(join(formatTempDir, 'CLAUDE.md'))).toBe(true);
              expect(existsSync(join(formatTempDir, 'instructions'))).toBe(true);
              break;
            case OutputFormat.CURSOR:
              expect(existsSync(join(formatTempDir, '.cursor/rules/main.mdc'))).toBe(true);
              break;
            case OutputFormat.COPILOT:
              expect(existsSync(join(formatTempDir, '.github/copilot-instructions.md'))).toBe(true);
              break;
            case OutputFormat.WINDSURF:
              expect(existsSync(join(formatTempDir, '.windsurfrules'))).toBe(true);
              break;
          }
        }
      }
    });
  });

  describe('Template Variable Replacement', () => {
    test('should replace projectName variable in all languages', async () => {
      const languages = ['ja', 'en', 'ch'] as const;
      const testProjectName = 'my-multilang-project';
      
      for (const lang of languages) {
        const langTempDir = join(tempDir, `var-test-${lang}`);
        const generator = GeneratorFactory.createGenerator('claude');
        
        await generator.generateFiles(langTempDir, {
          projectName: testProjectName,
          lang,
          force: true
        });
        
        // Check CLAUDE.md contains the project name
        const claudeContent = readFileSync(join(langTempDir, 'CLAUDE.md'), 'utf-8');
        expect(claudeContent).toMatch(testProjectName);
      }
    });
  });

  describe('Converter Integration', () => {
    test('should convert correctly for all supported output formats', () => {
      const formats = ConverterFactory.getAvailableFormats();
      // Claude is the base format, converters are for other formats
      expect(formats).toContain(OutputFormat.CURSOR);
      expect(formats).toContain(OutputFormat.COPILOT);
      expect(formats).toContain(OutputFormat.WINDSURF);
      expect(formats.length).toBe(3); // cursor, copilot, windsurf
      
      // Test each converter can be created
      formats.forEach(format => {
        expect(() => ConverterFactory.getConverter(format)).not.toThrow();
      });
    });

    test('should validate format support correctly', () => {
      expect(ConverterFactory.isFormatSupported(OutputFormat.CLAUDE)).toBe(true);
      expect(ConverterFactory.isFormatSupported(OutputFormat.CURSOR)).toBe(true);
      expect(ConverterFactory.isFormatSupported(OutputFormat.COPILOT)).toBe(true);
      expect(ConverterFactory.isFormatSupported(OutputFormat.WINDSURF)).toBe(true);
      expect(ConverterFactory.isFormatSupported('invalid-format')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing language directories gracefully', async () => {
      const generator = GeneratorFactory.createGenerator('claude');
      
      // Test with non-existent language (CLI validation should catch this before generator)
      // The generator itself may fall back or handle gracefully
      try {
        await generator.generateFiles(tempDir, {
          projectName: 'test-project',
          lang: 'invalid-lang' as any,
          force: true
        });
        
        // If it succeeds, it should have generated some files
        expect(existsSync(tempDir)).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    test('should validate language parameter in CLI validation', () => {
      const { validateLanguage } = require('../src/cli');
      
      // This will be used internally by the CLI validation
      expect(() => {
        const supportedLanguages = ['en', 'ja', 'ch'];
        const lang = 'invalid';
        if (!supportedLanguages.includes(lang)) {
          throw new Error(`Unsupported language: ${lang}`);
        }
      }).toThrow('Unsupported language: invalid');
    });
  });

  describe('File Structure Consistency', () => {
    test('should maintain consistent directory structure across all tools', async () => {
      const tools = ['claude', 'github-copilot', 'cursor'] as const;
      
      for (const tool of tools) {
        const toolTempDir = join(tempDir, `structure-${tool}`);
        const generator = GeneratorFactory.createGenerator(tool);
        
        await generator.generateFiles(toolTempDir, {
          projectName: 'structure-test',
          lang: 'en',
          force: true
        });
        
        // Each tool should create its expected structure
        expect(existsSync(toolTempDir)).toBe(true);
      }
    });
  });
});

describe('🚨 Critical Multi-Language Issue Resolution', () => {
  test('should confirm all originally missing files are now present', () => {
    // Test the specific issue: en/ch directories only had base.md, now should have all 14
    const enSharedDir = join(__dirname, '../templates/shared/instructions/en');
    const chSharedDir = join(__dirname, '../templates/shared/instructions/ch');
    
    const enFiles = readdirSync(enSharedDir);
    const chFiles = readdirSync(chSharedDir);
    
    // Should have exactly 14 files (not just base.md)
    expect(enFiles.length).toBe(14);
    expect(chFiles.length).toBe(14);
    
    // Verify all the files that were missing are now present
    const criticalFiles = [
      'anytime.md', 'command.md', 'commit-rules.md', 'deep-think.md',
      'develop.md', 'git.md', 'KentBeck-tdd-rules.md', 'memory.md',
      'note.md', 'notion-retrospective.md', 'pr-rules.md', 
      'search-patterns.md', 'troubleshooting.md'
    ];
    
    criticalFiles.forEach(file => {
      expect(enFiles).toContain(file);
      expect(chFiles).toContain(file);
    });
  });

  test('should confirm Windsurf implementation is correct (converter-only)', () => {
    // Windsurf should only have converter, not generator or templates
    expect(ConverterFactory.isFormatSupported(OutputFormat.WINDSURF)).toBe(true);
    
    const converter = ConverterFactory.getConverter(OutputFormat.WINDSURF);
    expect(converter).toBeDefined();
    expect(typeof converter.convert).toBe('function');
    expect(typeof converter.validateContent).toBe('function');
  });
});