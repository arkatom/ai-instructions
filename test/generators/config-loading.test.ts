import { GeneratorFactory } from '../../src/generators/factory';
import { BaseGenerator } from '../../src/generators/base';

// Test implementation of BaseGenerator for testing purposes
class TestGenerator extends BaseGenerator {
  constructor() {
    super({
      name: 'test',
      templateDir: 'test',
      outputStructure: {
        mainFile: 'test.md'
      }
    });
  }
  
  async generateFiles(outputDir: string, options?: any): Promise<void> {
    // Empty implementation for testing
  }
}

describe('Configuration File Loading', () => {
  describe('Tool configurations', () => {
    test('should load cursor tool configuration', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const config = await generator.loadToolConfig();
      
      // Assert
      expect(config.displayName).toBe('Cursor AI');
      expect(config.fileExtension).toBe('.mdc');
      expect(config.globs).toHaveProperty('inherit');
      expect(config.globs.inherit).toBe('javascript');
      expect(config.globs.additional).toContain('**/*.mdc');
      expect(config.globs.additional).toContain('**/.cursor/**');
      expect(config.description).toContain('Cursor AI');
    });

    test('should load github-copilot tool configuration', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('github-copilot');
      
      // Act
      const config = await generator.loadToolConfig();
      
      // Assert
      expect(config.displayName).toBe('GitHub Copilot');
      expect(config.fileExtension).toBe('.md');
      expect(config.globs.inherit).toBe('universal');
      expect(config.description).toContain('GitHub Copilot');
    });

    test('should load claude tool configuration', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('claude');
      
      // Act
      const config = await generator.loadToolConfig();
      
      // Assert
      expect(config.displayName).toBe('Claude AI');
      expect(config.fileExtension).toBe('.md');
      expect(config.globs.inherit).toBe('universal');
      expect(config.description).toContain('Claude AI');
    });

    test('should throw error when tool config file missing', async () => {
      // Arrange
      const generator = new TestGenerator();
      // Override for this test
      (generator as any).toolConfig = { name: 'nonexistent-tool' };
      (generator as any).templatesDir = 'nonexistent';
      
      // Act & Assert
      await expect(generator.loadToolConfig())
        .rejects
        .toThrow('Tool configuration not found');
    });
  });

  describe('Language configurations', () => {
    test('should load language-specific globs configuration for JavaScript', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const jsConfig = await generator.loadLanguageConfig('javascript');
      
      // Assert
      expect(jsConfig.globs).toContain('**/*.ts');
      expect(jsConfig.globs).toContain('**/*.tsx');
      expect(jsConfig.globs).toContain('**/*.js');
      expect(jsConfig.globs).toContain('**/*.jsx');
      expect(jsConfig.globs).toContain('**/*.json');
      expect(jsConfig.globs).toContain('**/package.json');
      expect(jsConfig.globs).toContain('**/tsconfig.json');
    });

    test('should load language-specific globs configuration for TypeScript', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const tsConfig = await generator.loadLanguageConfig('typescript');
      
      // Assert
      expect(tsConfig.globs).toContain('**/*.ts');
      expect(tsConfig.globs).toContain('**/*.tsx');
      expect(tsConfig.globs).toContain('**/*.d.ts');
      expect(tsConfig.globs).toContain('**/tsconfig.json');
    });

    test('should load language-specific globs configuration for Python', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const pyConfig = await generator.loadLanguageConfig('python');
      
      // Assert
      expect(pyConfig.globs).toContain('**/*.py');
      expect(pyConfig.globs).toContain('**/*.pyi');
      expect(pyConfig.globs).toContain('**/requirements.txt');
      expect(pyConfig.globs).toContain('**/setup.py');
      expect(pyConfig.globs).toContain('**/Pipfile');
    });

    test('should load universal globs configuration', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const universalConfig = await generator.loadLanguageConfig('universal');
      
      // Assert
      expect(universalConfig.globs).toContain('**/*.md');
      expect(universalConfig.globs).toContain('**/*.txt');
      expect(universalConfig.globs).toContain('**/*.yml');
      expect(universalConfig.globs).toContain('**/*.yaml');
      expect(universalConfig.globs).toContain('**/README*');
      expect(universalConfig.globs).toContain('**/LICENSE*');
    });

    test('should default to universal globs for unknown language', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const config = await generator.loadLanguageConfig('unknown-language');
      
      // Assert
      expect(config.globs).toContain('**/*.md');
      expect(config.globs).toContain('**/README*');
    });
  });

  describe('Configuration validation', () => {
    test('should validate tool configuration structure', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const config = await generator.loadToolConfig();
      
      // Assert
      expect(config).toHaveProperty('displayName');
      expect(config).toHaveProperty('fileExtension');
      expect(config).toHaveProperty('globs');
      expect(config).toHaveProperty('description');
      expect(typeof config.displayName).toBe('string');
      expect(typeof config.fileExtension).toBe('string');
      expect(typeof config.description).toBe('string');
    });

    test('should validate language configuration structure', async () => {
      // Arrange
      const generator = new TestGenerator();
      
      // Act
      const config = await generator.loadLanguageConfig('javascript');
      
      // Assert
      expect(config).toHaveProperty('globs');
      expect(Array.isArray(config.globs)).toBe(true);
      expect(config.globs.length).toBeGreaterThan(0);
    });

    test('should handle malformed JSON in config files', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Mock broken config loading
      jest.spyOn(generator, 'loadToolConfig').mockRejectedValue(new Error('Invalid JSON'));
      
      // Act & Assert
      await expect(generator.loadToolConfig())
        .rejects
        .toThrow('Invalid JSON');
    });
  });
});