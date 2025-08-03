import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, readFile, access, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { GeneratorFactory, SupportedTool } from '../src/generators/factory';
import { BaseGenerator } from '../src/generators/base';

describe('Multi-Tool Support', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-instructions-multi-tool-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('GeneratorFactory', () => {
    it('should create Claude generator', () => {
      const generator = GeneratorFactory.createGenerator('claude');
      expect(generator).toBeDefined();
      expect(generator.getToolName()).toBe('claude');
    });

    it('should create GitHub Copilot generator', () => {
      const generator = GeneratorFactory.createGenerator('github-copilot');
      expect(generator).toBeDefined();
      expect(generator.getToolName()).toBe('github-copilot');
    });

    it('should create Cursor generator', () => {
      const generator = GeneratorFactory.createGenerator('cursor');
      expect(generator).toBeDefined();
      expect(generator.getToolName()).toBe('cursor');
    });

    it('should throw error for unsupported tool', () => {
      expect(() => {
        GeneratorFactory.createGenerator('unsupported' as SupportedTool);
      }).toThrow('Unsupported tool: unsupported');
    });

    it('should return list of supported tools', () => {
      const supportedTools = GeneratorFactory.getSupportedTools();
      expect(supportedTools).toEqual(['claude', 'github-copilot', 'cursor']);
    });

    it('should validate tool names correctly', () => {
      expect(GeneratorFactory.isValidTool('claude')).toBe(true);
      expect(GeneratorFactory.isValidTool('github-copilot')).toBe(true);
      expect(GeneratorFactory.isValidTool('cursor')).toBe(true);
      expect(GeneratorFactory.isValidTool('invalid')).toBe(false);
    });
  });

  describe('Claude Generator', () => {
    let generator: BaseGenerator;

    beforeEach(() => {
      generator = GeneratorFactory.createGenerator('claude');
    });

    it('should generate CLAUDE.md and instructions directory', async () => {
      await generator.generateFiles(tempDir, { projectName: 'test-project' });

      // Check CLAUDE.md exists
      await expect(access(join(tempDir, 'CLAUDE.md'))).resolves.not.toThrow();

      // Check instructions directory exists
      await expect(access(join(tempDir, 'instructions'))).resolves.not.toThrow();
    });

    it('should replace project name variables in CLAUDE.md', async () => {
      const projectName = 'my-test-project';
      await generator.generateFiles(tempDir, { projectName });

      const claudeContent = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeContent).toContain(projectName);
    });
  });

  describe('GitHub Copilot Generator', () => {
    let generator: BaseGenerator;

    beforeEach(() => {
      generator = GeneratorFactory.createGenerator('github-copilot');
    });

    it('should generate .github/instructions/ directory structure', async () => {
      await generator.generateFiles(tempDir, { projectName: 'test-project' });

      // Check .github/instructions directory exists
      await expect(access(join(tempDir, '.github', 'instructions'))).resolves.not.toThrow();

      // Check main.md exists
      await expect(access(join(tempDir, '.github', 'instructions', 'main.md'))).resolves.not.toThrow();
    });

    it('should replace project name variables in main.md', async () => {
      const projectName = 'github-copilot-project';
      await generator.generateFiles(tempDir, { projectName });

      const mainContent = await readFile(join(tempDir, '.github', 'instructions', 'main.md'), 'utf-8');
      expect(mainContent).toContain(projectName);
      expect(mainContent).toContain('GitHub Copilot Custom Instructions');
    });

    it('should contain GitHub Copilot specific instructions', async () => {
      await generator.generateFiles(tempDir, { projectName: 'test-project' });

      const mainContent = await readFile(join(tempDir, '.github', 'instructions', 'main.md'), 'utf-8');
      expect(mainContent).toContain('Test-Driven Development');
      expect(mainContent).toContain('GitHub Flow');
      expect(mainContent).toContain('Code Generation Guidelines');
    });
  });

  describe('Cursor Generator', () => {
    let generator: BaseGenerator;

    beforeEach(() => {
      generator = GeneratorFactory.createGenerator('cursor');
    });

    it('should generate .cursor/rules/ directory structure', async () => {
      await generator.generateFiles(tempDir, { projectName: 'test-project' });

      // Check .cursor/rules directory exists
      await expect(access(join(tempDir, '.cursor', 'rules'))).resolves.not.toThrow();

      // Check main.mdc exists
      await expect(access(join(tempDir, '.cursor', 'rules', 'main.mdc'))).resolves.not.toThrow();
    });

    it('should replace project name variables in main.mdc', async () => {
      const projectName = 'cursor-project';
      await generator.generateFiles(tempDir, { projectName });

      const mainContent = await readFile(join(tempDir, '.cursor', 'rules', 'main.mdc'), 'utf-8');
      expect(mainContent).toContain(projectName);
    });

    it('should contain Cursor MDC format with metadata', async () => {
      await generator.generateFiles(tempDir, { projectName: 'test-project' });

      const mainContent = await readFile(join(tempDir, '.cursor', 'rules', 'main.mdc'), 'utf-8');
      expect(mainContent).toContain('---');
      expect(mainContent).toContain('description:');
      expect(mainContent).toContain('globs:');
      expect(mainContent).toContain('alwaysApply: true');
      expect(mainContent).toContain('Test-Driven Development');
    });
  });

  describe('Cross-Tool Integration', () => {
    it('should generate different file structures for different tools', async () => {
      const projectName = 'integration-test';

      // Generate Claude files
      const claudeGenerator = GeneratorFactory.createGenerator('claude');
      const claudeDir = join(tempDir, 'claude');
      await claudeGenerator.generateFiles(claudeDir, { projectName });

      // Generate GitHub Copilot files
      const copilotGenerator = GeneratorFactory.createGenerator('github-copilot');
      const copilotDir = join(tempDir, 'copilot');
      await copilotGenerator.generateFiles(copilotDir, { projectName });

      // Generate Cursor files
      const cursorGenerator = GeneratorFactory.createGenerator('cursor');
      const cursorDir = join(tempDir, 'cursor');
      await cursorGenerator.generateFiles(cursorDir, { projectName });

      // Verify different file structures
      await expect(access(join(claudeDir, 'CLAUDE.md'))).resolves.not.toThrow();
      await expect(access(join(claudeDir, 'instructions'))).resolves.not.toThrow();

      await expect(access(join(copilotDir, '.github', 'instructions', 'main.md'))).resolves.not.toThrow();

      await expect(access(join(cursorDir, '.cursor', 'rules', 'main.mdc'))).resolves.not.toThrow();
    });

    it('should handle project name replacement consistently across tools', async () => {
      const projectName = 'consistency-test-project';

      const generators = [
        GeneratorFactory.createGenerator('claude'),
        GeneratorFactory.createGenerator('github-copilot'),
        GeneratorFactory.createGenerator('cursor')
      ];

      for (const generator of generators) {
        const toolDir = join(tempDir, generator.getToolName());
        await generator.generateFiles(toolDir, { projectName });

        // Each tool should have its main file containing the project name
        let mainFilePath: string;
        switch (generator.getToolName()) {
          case 'claude':
            mainFilePath = join(toolDir, 'CLAUDE.md');
            break;
          case 'github-copilot':
            mainFilePath = join(toolDir, '.github', 'instructions', 'main.md');
            break;
          case 'cursor':
            mainFilePath = join(toolDir, '.cursor', 'rules', 'main.mdc');
            break;
          default:
            throw new Error(`Unknown tool: ${generator.getToolName()}`);
        }

        const content = await readFile(mainFilePath, 'utf-8');
        expect(content).toContain(projectName);
      }
    });
  });
});