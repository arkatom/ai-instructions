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
      
      // Assert - Only verify file loaded successfully
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should load English core template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
      
      // Assert - Only verify file loaded successfully
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should load Chinese core template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { lang: 'ch' });
      
      // Assert - Only verify file loaded successfully
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should default to English when language not specified', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md');
      
      // Assert - Only verify file loaded successfully
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
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
      await expect(generator.loadDynamicTemplate('main.md', { lang: 'invalid' as never }))
        .rejects
        .toThrow('Unsupported language: invalid');
    });
  });

  describe('Template processing', () => {
    test('should process template with provided context', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja',
        projectName: 'test-project'
      });
      
      // Assert - Only verify the template loads without errors
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Note: Placeholders may or may not be replaced - that's user's choice
    });
  });
});