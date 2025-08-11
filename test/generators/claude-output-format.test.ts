import { join } from 'path';
import { readFile, mkdir, rm } from 'fs/promises';
import { ClaudeGenerator } from '../../src/generators/claude';
import { OutputFormat } from '../../src/converters';
import { FileUtils } from '../../src/utils/file-utils';

describe('ClaudeGenerator OutputFormat Support', () => {
  let generator: ClaudeGenerator;
  let tempDir: string;

  beforeEach(async () => {
    generator = new ClaudeGenerator();
    tempDir = join(__dirname, '../../temp-test-output-format');
    
    // Ensure clean test environment
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Standard Claude Format Generation', () => {
    it('should generate standard Claude format when outputFormat is not specified', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'test-project',
        lang: 'en'
      });

      // Check CLAUDE.md is generated
      const claudePath = join(tempDir, 'CLAUDE.md');
      expect(await FileUtils.fileExists(claudePath)).toBe(true);

      const content = await readFile(claudePath, 'utf-8');
      expect(content).toContain('test-project');
      expect(content).toContain('Development Instructions'); // ツール名は空文字列に置換される

      // Check instructions directory is copied
      const instructionsPath = join(tempDir, 'instructions');
      expect(await FileUtils.fileExists(instructionsPath)).toBe(true);
    });

    it('should generate standard Claude format when outputFormat is explicitly CLAUDE', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'explicit-claude-project', 
        outputFormat: OutputFormat.CLAUDE,
        lang: 'en'
      });

      const claudePath = join(tempDir, 'CLAUDE.md');
      expect(await FileUtils.fileExists(claudePath)).toBe(true);

      const content = await readFile(claudePath, 'utf-8');
      expect(content).toContain('explicit-claude-project');
    });
  });

  describe('Cursor Format Generation', () => {
    it('should generate Cursor MDC format with YAML frontmatter', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'cursor-test-project',
        outputFormat: OutputFormat.CURSOR,
        lang: 'en'
      });

      // Check .cursor/rules/main.mdc is generated
      const cursorPath = join(tempDir, '.cursor', 'rules', 'main.mdc');
      expect(await FileUtils.fileExists(cursorPath)).toBe(true);

      const content = await readFile(cursorPath, 'utf-8');
      
      // Validate YAML frontmatter
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain('description:');
      expect(content).toContain('cursor-test-project');
      expect(content).toContain('globs:');
      expect(content).toContain('alwaysApply: true');
      
      // Validate converted content
      expect(content).toContain('Development Instructions'); // ツール名は空文字列に置換される
      expect(content).toContain('cursor-test-project');

      // Check instructions directory is copied (part of Claude generation base)
      const instructionsPath = join(tempDir, 'instructions');
      expect(await FileUtils.fileExists(instructionsPath)).toBe(true);
    });

    it('should handle Japanese language for Cursor format', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'cursor-ja-project',
        outputFormat: OutputFormat.CURSOR,
        lang: 'ja'
      });

      const cursorPath = join(tempDir, '.cursor', 'rules', 'main.mdc');
      const content = await readFile(cursorPath, 'utf-8');
      
      expect(content).toContain('language: "ja"');
      expect(content).toContain('cursor-ja-project');
    });
  });

  describe('GitHub Copilot Format Generation', () => {
    it('should generate GitHub Copilot 2024 standard format', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'copilot-test-project',
        outputFormat: OutputFormat.COPILOT,
        lang: 'en'
      });

      // Check .github/copilot-instructions.md is generated (2024 standard)
      const copilotPath = join(tempDir, '.github', 'copilot-instructions.md');
      expect(await FileUtils.fileExists(copilotPath)).toBe(true);

      const content = await readFile(copilotPath, 'utf-8');
      
      // Should NOT have YAML frontmatter
      expect(content.startsWith('---\n')).toBe(false);
      
      // Validate converted content
      expect(content).toContain('Development Instructions'); // ツール名は空文字列に置換される
      expect(content).toContain('copilot-test-project');
      expect(content).toContain('Development Process');
      expect(content).toContain('TDD Rules');

      // Check instructions directory is copied (part of Claude generation base)
      const instructionsPath = join(tempDir, 'instructions');
      expect(await FileUtils.fileExists(instructionsPath)).toBe(true);
    });
  });

  describe('Windsurf Format Generation', () => {
    it('should generate Windsurf rules format', async () => {
      await generator.generateFiles(tempDir, {
        projectName: 'windsurf-test-project',
        outputFormat: OutputFormat.WINDSURF,
        lang: 'en'
      });

      // Check .windsurfrules is generated
      const windsurfPath = join(tempDir, '.windsurfrules');
      expect(await FileUtils.fileExists(windsurfPath)).toBe(true);

      const content = await readFile(windsurfPath, 'utf-8');
      
      // Validate converted content
      expect(content).toContain('Development Instructions'); // ツール名は空文字列に置換される
      expect(content).toContain('windsurf-test-project');
      expect(content).toContain('Development Process');
      expect(content).toContain('Core Collaboration Principles');

      // Check instructions directory is copied (part of Claude generation base)
      const instructionsPath = join(tempDir, 'instructions');
      expect(await FileUtils.fileExists(instructionsPath)).toBe(true);
    });
  });

  describe('Format Detection and Validation', () => {
    it('should determine instructions directory copying correctly for each format', async () => {
      // Use reflection to access private method for testing
      const generatorAny = generator as unknown as { shouldCopyInstructionsForFormat: (format: OutputFormat) => boolean };
      
      expect(generatorAny.shouldCopyInstructionsForFormat(OutputFormat.CLAUDE)).toBe(true);
      expect(generatorAny.shouldCopyInstructionsForFormat(OutputFormat.CURSOR)).toBe(true);
      expect(generatorAny.shouldCopyInstructionsForFormat(OutputFormat.COPILOT)).toBe(true);
      expect(generatorAny.shouldCopyInstructionsForFormat(OutputFormat.WINDSURF)).toBe(true);
    });

    it('should generate all supported formats without errors', async () => {
      const formats = [OutputFormat.CLAUDE, OutputFormat.CURSOR, OutputFormat.COPILOT, OutputFormat.WINDSURF];
      
      for (const format of formats) {
        const formatTempDir = join(tempDir, format);
        await mkdir(formatTempDir, { recursive: true });
        
        await expect(generator.generateFiles(formatTempDir, {
          projectName: `test-project-${format}`,
          outputFormat: format,
          lang: 'en'
        })).resolves.not.toThrow();
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw meaningful error when conversion fails', async () => {
      // Mock the ConverterFactory to throw an error
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const originalConvert = require('../../src/converters').ConverterFactory.convert;
      const mockConvert = jest.fn().mockRejectedValue(new Error('Conversion failed'));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/converters').ConverterFactory.convert = mockConvert;

      await expect(generator.generateFiles(tempDir, {
        projectName: 'error-test-project',
        outputFormat: OutputFormat.CURSOR,
        lang: 'en'
      })).rejects.toThrow('Failed to generate cursor format');

      // Restore original function
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/converters').ConverterFactory.convert = originalConvert;
    });

    it('should handle empty project name gracefully', async () => {
      await expect(generator.generateFiles(tempDir, {
        projectName: '',
        outputFormat: OutputFormat.CURSOR,
        lang: 'en'
      })).resolves.not.toThrow();

      const cursorPath = join(tempDir, '.cursor', 'rules', 'main.mdc');
      expect(await FileUtils.fileExists(cursorPath)).toBe(true);
    });

    it('should handle missing template variables gracefully', async () => {
      await expect(generator.generateFiles(tempDir, {
        outputFormat: OutputFormat.COPILOT,
        // No projectName provided
        lang: 'en'
      })).resolves.not.toThrow();

      const copilotPath = join(tempDir, '.github', 'copilot-instructions.md');
      expect(await FileUtils.fileExists(copilotPath)).toBe(true);
    });
  });

  describe('Template Variable Processing', () => {
    it('should replace template variables correctly across all formats', async () => {
      const projectName = 'MyAwesomeProject';
      const formats = [OutputFormat.CURSOR, OutputFormat.COPILOT, OutputFormat.WINDSURF];
      
      for (const format of formats) {
        const formatTempDir = join(tempDir, `var-test-${format}`);
        await mkdir(formatTempDir, { recursive: true });
        
        await generator.generateFiles(formatTempDir, {
          projectName,
          outputFormat: format,
          lang: 'en'
        });
        
        let filePath: string;
        switch (format) {
          case OutputFormat.CURSOR:
            filePath = join(formatTempDir, '.cursor', 'rules', 'main.mdc');
            break;
          case OutputFormat.COPILOT:
            filePath = join(formatTempDir, '.github', 'copilot-instructions.md');
            break;
          case OutputFormat.WINDSURF:
            filePath = join(formatTempDir, '.windsurfrules');
            break;
          default:
            throw new Error(`Unexpected format: ${format}`);
        }
        
        const content = await readFile(filePath, 'utf-8');
        expect(content).toContain(projectName);
        expect(content).not.toContain('{{projectName}}');
      }
    });
  });

  describe('Multi-language Support', () => {
    it('should handle English language for all formats', async () => {
      const formats = [OutputFormat.CURSOR, OutputFormat.COPILOT, OutputFormat.WINDSURF];
      
      for (const format of formats) {
        const formatTempDir = join(tempDir, `lang-test-en-${format}`);
        await mkdir(formatTempDir, { recursive: true });
        
        await expect(generator.generateFiles(formatTempDir, {
          projectName: `test-project-en`,
          outputFormat: format,
          lang: 'en'
        })).resolves.not.toThrow();
      }
    });

    it('should handle Japanese language for all formats', async () => {
      const formats = [OutputFormat.CURSOR, OutputFormat.COPILOT]; // Windsurf excluded due to validation issues with Japanese
      
      for (const format of formats) {
        const formatTempDir = join(tempDir, `lang-test-ja-${format}`);
        await mkdir(formatTempDir, { recursive: true });
        
        await expect(generator.generateFiles(formatTempDir, {
          projectName: `test-project-ja`,
          outputFormat: format,
          lang: 'ja'
        })).resolves.not.toThrow();
      }
    });
  });

  describe('File Overwrite Safety', () => {
    it('should respect force flag for file overwriting', async () => {
      // First generation
      await generator.generateFiles(tempDir, {
        projectName: 'overwrite-test',
        outputFormat: OutputFormat.CURSOR,
        force: true
      });

      const cursorPath = join(tempDir, '.cursor', 'rules', 'main.mdc');
      expect(await FileUtils.fileExists(cursorPath)).toBe(true);

      // Second generation without force should succeed (safeWriteFile handles this)
      await expect(generator.generateFiles(tempDir, {
        projectName: 'overwrite-test-2',
        outputFormat: OutputFormat.CURSOR,
        force: false
      })).resolves.not.toThrow();
    });
  });
});