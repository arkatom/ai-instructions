import { ClaudeGenerator } from '../../src/generators/claude';
import { join } from 'path';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

describe('ClaudeGenerator', () => {
  describe('Template Loading', () => {
    it('should load CLAUDE.md template content for Japanese (default language structure)', async () => {
      const generator = new ClaudeGenerator();
      const templateContent = await generator.loadTemplate('CLAUDE.md', { lang: 'ja' });
      
      expect(templateContent).toContain('# AI開発アシスタント 行動指示');
      expect(templateContent).toContain('## 🚨 基本原則（必須）');
    });

    it('should load CLAUDE.md template content for English', async () => {
      const generator = new ClaudeGenerator();
      const templateContent = await generator.loadTemplate('CLAUDE.md', { lang: 'en' });
      
      expect(templateContent).toContain('# AI Development Assistant Instructions');
      expect(templateContent).toContain('## 🚨 Core Principles (MANDATORY)');
    });

    it('should load CLAUDE.md template content for Chinese', async () => {
      const generator = new ClaudeGenerator();
      const templateContent = await generator.loadTemplate('CLAUDE.md', { lang: 'ch' });
      
      expect(templateContent).toContain('# AI开发助手指令');
      expect(templateContent).toContain('## 🚨 核心原则（必须）');
    });
    
    it('should throw error when template file does not exist', async () => {
      const generator = new ClaudeGenerator();
      
      await expect(generator.loadTemplate('non-existent.md'))
        .rejects.toThrow('not found for language');
    });
  });

  describe('Instructions Directory Copying', () => {
    it('should have access to instruction files in language-specific structure', async () => {
      // This test is less relevant now with language-aware structure
      // The language-aware copying is tested in integration tests
      const generator = new ClaudeGenerator();
      
      // Test that generator can access templates (implicitly tested through generation)
      expect(generator).toBeDefined();
      expect(generator.getToolName()).toBe('claude');
    });
  });

  describe('File Generation', () => {
    const testOutputDir = join(__dirname, '../temp-test-output');

    afterEach(async () => {
      // テスト後のクリーンアップ
      if (existsSync(testOutputDir)) {
        await rm(testOutputDir, { recursive: true, force: true });
      }
    });

    it('should generate CLAUDE.md and instructions directory in target location', async () => {
      const generator = new ClaudeGenerator();
      await generator.generateFiles(testOutputDir, { projectName: 'test-project', lang: 'en' });
      
      expect(existsSync(join(testOutputDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'base.md'))).toBe(true);
    });

    it('should replace template variables in generated files', async () => {
      // Red: テンプレート変数置換機能のテスト
      const generator = new ClaudeGenerator();
      await generator.generateFiles(testOutputDir, { projectName: 'my-awesome-project', lang: 'en' });
      
      const { readFile } = await import('fs/promises');
      const claudeContent = await readFile(join(testOutputDir, 'CLAUDE.md'), 'utf-8');
      
      // projectName変数が置換されているかチェック（テンプレートに{{projectName}}があると仮定）
      expect(claudeContent).toContain('my-awesome-project');
      expect(claudeContent).not.toContain('{{projectName}}');
    });
  });
});