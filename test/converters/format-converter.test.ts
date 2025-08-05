import { 
  ConverterFactory, 
  OutputFormat, 
  ConversionMetadata 
} from '../../src/converters';

describe('Format Converter System', () => {
  const sampleContent = `# AI Development Assistant Instructions - {{projectName}}

## 🚨 Core Principles (MANDATORY)

Must be read before executing any task, command, or tool

- [Basic Rules](./instructions/base.md) - Absolute requirements
- [Deep Thinking](./instructions/deep-think.md)
- [Memory](./instructions/memory.md)

## Project-Specific Architecture, Rules & Documentation

- [Project Documentation Index](./docs/README.md)

## 📋 Situational Reference Files

### Execution Environment

- [Command Execution](./instructions/command.md) - Shell, execution rules

### Git & Commit Related

- [Git Rules](./instructions/git.md) - GitHub operations, Issues, branch strategy
- [Commit Conventions](./instructions/commit-rules.md) - Commit message format
- [PR Rules](./instructions/pr-rules.md) - Pull request creation guidelines

## 🔄 Execution Flow

1. Load basic rules → Confirm absolute requirements
2. Load situation-specific files → Confirm specific execution rules
3. Show reference confirmation → Display as \`✅️:{filename.md}\`
4. Execute → Perform work according to rules`;

  const sampleMetadata: ConversionMetadata = {
    projectName: 'test-project',
    lang: 'en',
    sourceContent: sampleContent,
    targetFormat: OutputFormat.CURSOR
  };

  beforeEach(() => {
    ConverterFactory.reset();
  });

  describe('ConverterFactory', () => {
    it('should initialize all converters automatically', () => {
      const availableFormats = ConverterFactory.getAvailableFormats();
      
      expect(availableFormats).toContain(OutputFormat.CURSOR);
      expect(availableFormats).toContain(OutputFormat.COPILOT);
      expect(availableFormats).toContain(OutputFormat.WINDSURF);
      expect(availableFormats.length).toBe(3);
    });

    it('should validate format support correctly', () => {
      expect(ConverterFactory.isFormatSupported('cursor')).toBe(true);
      expect(ConverterFactory.isFormatSupported('copilot')).toBe(true);
      expect(ConverterFactory.isFormatSupported('windsurf')).toBe(true);
      expect(ConverterFactory.isFormatSupported('invalid')).toBe(false);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        ConverterFactory.getConverter('invalid' as OutputFormat);
      }).toThrow('No converter available for format: invalid');
    });

    it('should provide format descriptions', () => {
      const descriptions = ConverterFactory.getFormatDescriptions();
      
      expect(descriptions[OutputFormat.CURSOR]).toContain('Cursor AI');
      expect(descriptions[OutputFormat.COPILOT]).toContain('GitHub Copilot');
      expect(descriptions[OutputFormat.WINDSURF]).toContain('Windsurf AI');
    });
  });

  describe('Cursor MDC Converter', () => {
    it('should convert Claude format to Cursor MDC with YAML frontmatter', async () => {
      const result = await ConverterFactory.convert(OutputFormat.CURSOR, {
        ...sampleMetadata,
        targetFormat: OutputFormat.CURSOR
      });

      expect(result.format).toBe(OutputFormat.CURSOR);
      expect(result.content).toMatch(/^---\n/); // Starts with YAML frontmatter
      expect(result.content).toContain('description:');
      expect(result.content).toContain('globs:');
      expect(result.content).toContain('alwaysApply: true');
      expect(result.content).toContain('test-project');
      expect(result.targetPath).toBe('.cursor/rules/main.mdc');
    });

    it('should validate Cursor MDC content correctly', () => {
      const validContent = `---
description: Test project
globs:
  - "**/*.ts"
alwaysApply: true
---

# Cursor AI Development Instructions

Content here...`;

      const invalidContent = `# No YAML Frontmatter
Content here...`;

      expect(ConverterFactory.validateContent(validContent, OutputFormat.CURSOR)).toBe(true);
      expect(ConverterFactory.validateContent(invalidContent, OutputFormat.CURSOR)).toBe(false);
    });

    it('should optimize content for Cursor AI context', async () => {
      const result = await ConverterFactory.convert(OutputFormat.CURSOR, {
        ...sampleMetadata,
        targetFormat: OutputFormat.CURSOR
      });

      expect(result.content).toContain('Cursor AI Development Instructions');
      expect(result.content).toContain('Code Completion Context');
      expect(result.content).toContain('Project Structure Context');
    });
  });

  describe('GitHub Copilot Converter', () => {
    it('should convert Claude format to GitHub Copilot markdown', async () => {
      const result = await ConverterFactory.convert(OutputFormat.COPILOT, {
        ...sampleMetadata,
        targetFormat: OutputFormat.COPILOT
      });

      expect(result.format).toBe(OutputFormat.COPILOT);
      expect(result.content).not.toMatch(/^---\n/); // No YAML frontmatter
      expect(result.content).toContain('GitHub Copilot Custom Instructions');
      expect(result.content).toContain('test-project');
      expect(result.targetPath).toBe('.github/copilot-instructions.md');
    });

    it('should validate GitHub Copilot content correctly', () => {
      const validContent = `# GitHub Copilot Custom Instructions - Project

## Code Generation Guidelines
Content here...`;

      const invalidContent = `---
description: Invalid
---
# With YAML frontmatter`;

      expect(ConverterFactory.validateContent(validContent, OutputFormat.COPILOT)).toBe(true);
      expect(ConverterFactory.validateContent(invalidContent, OutputFormat.COPILOT)).toBe(false);
    });

    it('should optimize content for GitHub Copilot context', async () => {
      const result = await ConverterFactory.convert(OutputFormat.COPILOT, {
        ...sampleMetadata,
        targetFormat: OutputFormat.COPILOT
      });

      expect(result.content).toContain('Test-Driven Development');
      expect(result.content).toContain('Code Generation Guidelines');
      expect(result.content).toContain('GitHub Flow');
    });
  });

  describe('Windsurf Converter', () => {
    it('should convert Claude format to Windsurf rules', async () => {
      const result = await ConverterFactory.convert(OutputFormat.WINDSURF, {
        ...sampleMetadata,
        targetFormat: OutputFormat.WINDSURF
      });

      expect(result.format).toBe(OutputFormat.WINDSURF);
      expect(result.content).toContain('Windsurf AI Pair Programming Rules');
      expect(result.content).toContain('test-project');
      expect(result.targetPath).toBe('.windsurfrules');
    });

    it('should validate Windsurf content correctly', () => {
      const validContent = `# Windsurf AI Pair Programming Rules - Project

## Collaborative Development
Content here...`;

      const invalidContent = `# Random content without Windsurf context`;

      expect(ConverterFactory.validateContent(validContent, OutputFormat.WINDSURF)).toBe(true);
      expect(ConverterFactory.validateContent(invalidContent, OutputFormat.WINDSURF)).toBe(false);
    });

    it('should optimize content for pair programming context', async () => {
      const result = await ConverterFactory.convert(OutputFormat.WINDSURF, {
        ...sampleMetadata,
        targetFormat: OutputFormat.WINDSURF
      });

      expect(result.content).toContain('Pair Programming Guidelines');
      expect(result.content).toContain('Real-Time Assistance');
      expect(result.content).toContain('Core Collaboration Principles');
    });
  });

  describe('Template Variable Replacement', () => {
    it('should replace template variables correctly across all formats', async () => {
      const metadata: ConversionMetadata = {
        projectName: 'MyAwesomeProject',
        lang: 'ja',
        sourceContent: sampleContent,
        targetFormat: OutputFormat.CURSOR,
        templateVariables: {
          customVar: 'CustomValue'
        }
      };

      const formats = [OutputFormat.CURSOR, OutputFormat.COPILOT, OutputFormat.WINDSURF];

      for (const format of formats) {
        const result = await ConverterFactory.convert(format, {
          ...metadata,
          targetFormat: format
        });

        expect(result.content).toContain('MyAwesomeProject');
        expect(result.content).not.toContain('{{projectName}}');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty project name gracefully', async () => {
      const metadata: ConversionMetadata = {
        projectName: '',
        sourceContent: sampleContent,
        targetFormat: OutputFormat.CURSOR
      };

      const result = await ConverterFactory.convert(OutputFormat.CURSOR, metadata);
      
      // Should still generate valid content, but with empty project name
      expect(result.content).toMatch(/^---\n/);
      expect(result.content).toContain('description:');
    });

    it('should validate empty content correctly', () => {
      // Test direct validation of empty content
      expect(ConverterFactory.validateContent('', OutputFormat.CURSOR)).toBe(false);
      expect(ConverterFactory.validateContent('   ', OutputFormat.COPILOT)).toBe(false);
      expect(ConverterFactory.validateContent('', OutputFormat.WINDSURF)).toBe(false);
    });

    it('should validate malformed YAML frontmatter for Cursor format', () => {
      const malformedContent = `---
invalid yaml structure
no proper key-value pairs
---

# Some content`;

      expect(ConverterFactory.validateContent(malformedContent, OutputFormat.CURSOR)).toBe(false);
    });
  });
});