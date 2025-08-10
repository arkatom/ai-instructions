import { GeneratorFactory } from '../../src/generators/factory';

describe('Dynamic Template Replacement', () => {
  describe('Project name replacement', () => {
    test('should replace project name placeholder', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        projectName: 'my-awesome-project',
        lang: 'en'
      });
      
      // Assert
      expect(result).toContain('my-awesome-project');
      expect(result).not.toContain('{{projectName}}');
    });

    test('should handle project name with special characters', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        projectName: '@company/project-name_v2.0',
        lang: 'en'
      });
      
      // Assert
      expect(result).toContain('@company/project-name_v2.0');
      expect(result).not.toContain('{{projectName}}');
    });

    test('should use default project name when not specified', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en'
      });
      
      // Assert
      // When no projectName is specified, the placeholder remains for later replacement
      expect(result).toContain('{{projectName}}');
    });
  });

  describe('Tool name replacement (empty per design)', () => {
    test('should replace tool name placeholder with empty string', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja',
        projectName: 'test-project' 
      });
      
      // Assert
      // Per design update: toolName is replaced with empty string for token efficiency
      expect(result).not.toContain('{{toolName}}');
      expect(result).not.toContain('Cursor AI 開発指示'); // Should not include tool name
      expect(result).toContain('開発指示'); // Should have generic title
    });
  });

  describe('Tool-specific features replacement (empty per design)', () => {
    test('should replace tool-specific features placeholder with empty string', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja'
      });
      
      // Assert
      // Per design update: toolSpecificFeatures is replaced with empty string
      expect(result).not.toContain('{{toolSpecificFeatures}}');
      expect(result).not.toContain('Cursor Specific Features');
      expect(result).not.toContain('Advanced code completion');
    });
  });

  describe('Additional instructions replacement (empty per design)', () => {
    test('should replace additional instructions placeholder with empty string', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'ja'
      });
      
      // Assert
      // Per design update: additionalInstructions is replaced with empty string
      expect(result).not.toContain('{{additionalInstructions}}');
    });
  });

  describe('Dynamic globs replacement', () => {
    test('should replace dynamic globs based on language config', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en',
        languageConfig: 'javascript'
      });
      
      // Assert
      expect(result).not.toContain('{{dynamicGlobs}}');
      expect(result).toContain('**/*.ts');
      expect(result).toContain('**/*.js');
      expect(result).toContain('**/*.mdc'); // Additional from cursor config
    });

    test('should merge tool-specific and language-specific globs', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en',
        languageConfig: 'typescript'
      });
      
      // Assert
      expect(result).not.toContain('{{dynamicGlobs}}');
      expect(result).toContain('**/*.ts');
      expect(result).toContain('**/*.tsx');
      expect(result).toContain('**/*.d.ts');
      expect(result).toContain('**/*.mdc'); // From cursor config
      expect(result).toContain('**/.cursor/**'); // From cursor config
    });

    test('should use universal globs when no language specified', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('github-copilot');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en'
      });
      
      // Assert
      expect(result).not.toContain('{{dynamicGlobs}}');
      expect(result).toContain('**/*.md');
      expect(result).toContain('**/README*');
      expect(result).toContain('**/LICENSE*');
    });
  });

  describe('File extension replacement', () => {
    test('should replace file extension placeholder for cursor', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en'
      });
      
      // Assert
      expect(result).not.toContain('{{fileExtension}}');
      if (result.includes('file extension')) {
        expect(result).toContain('.mdc');
      }
    });

    test('should replace file extension placeholder for claude', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('claude');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang: 'en'
      });
      
      // Assert
      expect(result).not.toContain('{{fileExtension}}');
      if (result.includes('file extension')) {
        expect(result).toContain('.md');
      }
    });
  });

  describe('Multiple replacements', () => {
    test('should handle all replacements in single template', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        projectName: 'multi-replace-test',
        lang: 'ja',
        languageConfig: 'typescript'
      });
      
      // Assert
      // No placeholders should remain
      expect(result).not.toContain('{{projectName}}');
      expect(result).not.toContain('{{toolName}}');
      expect(result).not.toContain('{{dynamicGlobs}}');
      expect(result).not.toContain('{{toolSpecificFeatures}}');
      expect(result).not.toContain('{{additionalInstructions}}');
      expect(result).not.toContain('{{fileExtension}}');
      
      // Content should be present
      expect(result).toContain('multi-replace-test');
      expect(result).toContain('**/*.ts');
      expect(result.length).toBeGreaterThan(500);
    });

    test('should maintain template structure after replacements', async () => {
      // Arrange
      const generator = GeneratorFactory.createGenerator('cursor');
      
      // Act
      const result = await generator.loadDynamicTemplate('main.md', { 
        projectName: 'structure-test',
        lang: 'ja',
        languageConfig: 'javascript'
      });
      
      // Assert
      // Check that main sections are present
      expect(result).toContain('核心原則');
      expect(result).toContain('基本ルール');
      expect(result).toContain('深層思考');
      expect(result).toContain('structure-test');
      
      // Check markdown structure is maintained
      expect(result).toMatch(/^#/m); // Has headers
      expect(result).toMatch(/^-\s/m); // Has list items
    });
  });
});