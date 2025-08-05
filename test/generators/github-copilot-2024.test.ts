import { GitHubCopilotGenerator } from '../../src/generators/github-copilot';
import { join } from 'path';
import { existsSync } from 'fs';
import { rm, readFile } from 'fs/promises';

describe('GitHub Copilot 2024 Standard (Issue #19)', () => {
  const testOutputDir = join(__dirname, '../temp-test-copilot-2024');

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('2024 Standard Path Structure', () => {
    it('should generate copilot-instructions.md directly in .github directory', async () => {
      const generator = new GitHubCopilotGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-copilot-2024', 
        lang: 'en' 
      });
      
      // 2024年標準: .github/copilot-instructions.md が生成されることを確認
      const expectedPath = join(testOutputDir, '.github', 'copilot-instructions.md');
      expect(existsSync(expectedPath)).toBe(true);
      
      // 旧標準パスが存在しないことを確認
      const oldPath = join(testOutputDir, '.github', 'instructions', 'main.md');
      expect(existsSync(oldPath)).toBe(false);
    });

    it('should replace template variables correctly in 2024 standard format', async () => {
      const generator = new GitHubCopilotGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'my-awesome-project', 
        lang: 'en' 
      });
      
      const copilotContent = await readFile(join(testOutputDir, '.github', 'copilot-instructions.md'), 'utf-8');
      
      // プロジェクト名が正しく置換されていることを確認
      expect(copilotContent).toContain('my-awesome-project');
      expect(copilotContent).not.toContain('{{projectName}}');
      
      // GitHub Copilot固有の内容が含まれることを確認
      expect(copilotContent).toContain('GitHub Copilot Custom Instructions');
      expect(copilotContent).toContain('Test-Driven Development');
    });

    it('should support multi-language templates with 2024 standard', async () => {
      const generator = new GitHubCopilotGenerator();
      
      // 日本語版のテスト
      await generator.generateFiles(testOutputDir, { 
        projectName: 'テストプロジェクト', 
        lang: 'ja' 
      });
      
      const japaneseContent = await readFile(join(testOutputDir, '.github', 'copilot-instructions.md'), 'utf-8');
      expect(japaneseContent).toContain('テストプロジェクト');
      
      // .github/copilot-instructions.md のパスは言語に関係なく同じ
      expect(existsSync(join(testOutputDir, '.github', 'copilot-instructions.md'))).toBe(true);
    });

    it('should maintain backward compatibility for CLI and API', async () => {
      const generator = new GitHubCopilotGenerator();
      
      // 既存のAPIインターフェースが変更されていないことを確認
      expect(typeof generator.generateFiles).toBe('function');
      
      // オプションパラメータが正しく処理されることを確認
      await generator.generateFiles(testOutputDir, { 
        projectName: 'compatibility-test',
        force: true,
        lang: 'en'
      });
      
      expect(existsSync(join(testOutputDir, '.github', 'copilot-instructions.md'))).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing template files gracefully', async () => {
      const generator = new GitHubCopilotGenerator();
      
      // 存在しない言語でもエラーが発生しないことを確認
      await expect(generator.generateFiles(testOutputDir, { 
        projectName: 'error-test', 
        lang: 'nonexistent' as any 
      })).resolves.not.toThrow();
      
      // 英語版にフォールバックされることを確認
      expect(existsSync(join(testOutputDir, '.github', 'copilot-instructions.md'))).toBe(true);
    });

    it('should create .github directory if it does not exist', async () => {
      const generator = new GitHubCopilotGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'directory-test' 
      });
      
      // .github ディレクトリが作成されることを確認
      expect(existsSync(join(testOutputDir, '.github'))).toBe(true);
      expect(existsSync(join(testOutputDir, '.github', 'copilot-instructions.md'))).toBe(true);
    });
  });

  describe('Content Quality Verification', () => {
    it('should generate complete and valid GitHub Copilot instructions', async () => {
      const generator = new GitHubCopilotGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'quality-test',
        lang: 'en'
      });
      
      const content = await readFile(join(testOutputDir, '.github', 'copilot-instructions.md'), 'utf-8');
      
      // 必要なセクションが含まれることを確認
      expect(content).toContain('Core Development Principles');
      expect(content).toContain('Code Generation Guidelines');
      expect(content).toContain('Architecture Patterns');
      expect(content).toContain('Quality Assurance');
      expect(content).toContain('Issue-Driven Development');
      
      // ファイルが空でないことを確認
      expect(content.length).toBeGreaterThan(500);
    });
  });
});