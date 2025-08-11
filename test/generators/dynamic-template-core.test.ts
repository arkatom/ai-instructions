import { GeneratorFactory } from '../../src/generators/factory';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Core Template Loading', () => {
  describe('Language-specific templates', () => {
    test('should load Japanese core template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // Assert
      expect(result).toContain('🚨 核心原則（必須）');
      expect(result).toContain('基本ルール');
      expect(result).toContain('深層思考');
    });

    test('should load English core template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // Assert
      expect(result).toContain('🚨 Core Principles (MANDATORY)');
      expect(result).toContain('Basic Rules');
      expect(result).toContain('Deep Thinking');
    });

    test('should load Chinese core template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ch' });
      
      // Assert
      expect(result).toContain('🚨 核心原则（必须）');
      expect(result).toContain('基本规则');
      expect(result).toContain('深度思考');
    });

    test('should default to English when language not specified', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md');
      
      // Assert
      expect(result).toContain('Core Principles (MANDATORY)');
    });
  });

  describe('Template file existence', () => {
    test('should verify core template files exist', () => {
      // Arrange
      const templatesDir = join(__dirname, '../../templates');
      
      // Assert
      expect(existsSync(join(templatesDir, 'core/ja/main.md'))).toBe(true);
      expect(existsSync(join(templatesDir, 'core/en/main.md'))).toBe(true);
      expect(existsSync(join(templatesDir, 'core/ch/main.md'))).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should throw error when core template file missing', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act & Assert
      await expect(generator.loadDynamicTemplate('nonexistent.md'))
        .rejects
        .toThrow('Template "nonexistent.md" not found');
    });

    test('should throw error for invalid language code', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act & Assert
      await expect(generator.loadDynamicTemplate('main.md', { lang: 'invalid' as any }))
        .rejects
        .toThrow('Unsupported language: invalid');
    });
  });

  describe('Template content validation', () => {
    test('should have minimum content length', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
      
      // Assert
      expect(result.length).toBeGreaterThan(500);
    });

    test('should replace placeholders in template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja',
        projectName: 'test-project'
      });
      
      // Assert - These placeholders should be replaced
      expect(result).not.toContain('{{projectName}}');
      expect(result).not.toContain('{{dynamicGlobs}}');
      expect(result).toContain('test-project');
    });
  });
});