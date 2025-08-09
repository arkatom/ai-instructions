import { ClineGenerator } from '../../src/generators/cline';
import { join } from 'path';
import { existsSync } from 'fs';
import { rm, readFile, readdir } from 'fs/promises';

describe('ClineGenerator (Issue #23)', () => {
  const testOutputDir = join(__dirname, './temp-test-cline');

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Cline Directory Structure Generation', () => {
    it('should generate .clinerules directory structure', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-cline-project', 
        lang: 'en' 
      });
      
      // .clinerules ディレクトリが生成されることを確認
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      expect(existsSync(clinerulesDirPath)).toBe(true);
    });

    it('should generate multiple markdown files in .clinerules directory', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-multi-files', 
        lang: 'en' 
      });
      
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      const files = await readdir(clinerulesDirPath);
      
      // 複数のマークダウンファイルが存在することを確認
      expect(files.length).toBeGreaterThan(1);
      expect(files.some(file => file.endsWith('.md'))).toBe(true);
      
      // 期待される基本ファイルの存在確認
      expect(files).toContain('01-coding.md');
      expect(files).toContain('02-documentation.md');
    });

    it('should copy instructions directory to project root', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-instructions', 
        lang: 'en' 
      });
      
      // instructions ディレクトリが生成されることを確認
      const instructionsPath = join(testOutputDir, 'instructions');
      expect(existsSync(instructionsPath)).toBe(true);
      expect(existsSync(join(instructionsPath, 'base.md'))).toBe(true);
    });
  });

  describe('Template Variable Replacement', () => {
    it('should replace template variables correctly in multiple files', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'my-awesome-cline-project', 
        lang: 'en' 
      });
      
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      const files = await readdir(clinerulesDirPath);
      
      // 各マークダウンファイルでプロジェクト名が置換されていることを確認
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await readFile(join(clinerulesDirPath, file), 'utf-8');
          expect(content).toContain('my-awesome-cline-project');
          expect(content).not.toContain('{{projectName}}');
        }
      }
    });

    it('should replace toolName placeholder correctly', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'tool-name-test', 
        lang: 'en' 
      });
      
      const codingFile = join(testOutputDir, '.clinerules', '01-coding.md');
      const content = await readFile(codingFile, 'utf-8');
      
      // ツール名が'Cline'に置換されていることを確認
      expect(content).toContain('Cline');
      expect(content).not.toContain('{{toolName}}');
    });
  });

  describe('Multi-language Support', () => {
    it('should generate Japanese templates correctly', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'テストプロジェクト', 
        lang: 'ja' 
      });
      
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      expect(existsSync(clinerulesDirPath)).toBe(true);
      
      const codingFile = join(clinerulesDirPath, '01-coding.md');
      const content = await readFile(codingFile, 'utf-8');
      
      // 日本語コンテンツが含まれることを確認
      expect(content).toContain('テストプロジェクト');
      expect(content).toContain('開発指示');
    });

    it('should generate Chinese templates correctly', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: '测试项目', 
        lang: 'ch' 
      });
      
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      expect(existsSync(clinerulesDirPath)).toBe(true);
      
      const codingFile = join(clinerulesDirPath, '01-coding.md');
      const content = await readFile(codingFile, 'utf-8');
      
      // 中国語コンテンツが含まれることを確認
      expect(content).toContain('测试项目');
      expect(content).toContain('开发');
    });
  });

  describe('File Content Quality', () => {
    it('should generate complete and valid Cline instructions', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'quality-test',
        lang: 'en'
      });
      
      const codingFile = join(testOutputDir, '.clinerules', '01-coding.md');
      const docFile = join(testOutputDir, '.clinerules', '02-documentation.md');
      
      const codingContent = await readFile(codingFile, 'utf-8');
      const docContent = await readFile(docFile, 'utf-8');
      
      // 必要なセクションが含まれることを確認
      expect(codingContent).toContain('Development Instructions');
      expect(codingContent).toContain('TDD Rules');
      expect(docContent).toContain('Documentation');
      
      // ファイルが空でないことを確認
      expect(codingContent.length).toBeGreaterThan(100);
      expect(docContent.length).toBeGreaterThan(100);
    });

    it('should maintain consistency with project patterns', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'consistency-test',
        lang: 'en'
      });
      
      const clinerulesDirPath = join(testOutputDir, '.clinerules');
      const files = await readdir(clinerulesDirPath);
      
      // ファイル命名パターンの確認
      const markdownFiles = files.filter(file => file.endsWith('.md'));
      expect(markdownFiles.length).toBeGreaterThan(0);
      
      // 数字付きプレフィックスパターンの確認
      expect(markdownFiles.some(file => /^\d\d-/.test(file))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported languages', async () => {
      const generator = new ClineGenerator();
      
      await expect(generator.generateFiles(testOutputDir, { 
        projectName: 'error-test', 
        lang: 'nonexistent' as any 
      })).rejects.toThrow();
    });

    it('should create .clinerules directory if it does not exist', async () => {
      const generator = new ClineGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'directory-test' 
      });
      
      expect(existsSync(join(testOutputDir, '.clinerules'))).toBe(true);
    });

    it('should handle missing template gracefully', async () => {
      const generator = new ClineGenerator();
      
      // プロジェクト名なしでもエラーにならないことを確認
      await expect(generator.generateFiles(testOutputDir, { 
        lang: 'en'
      })).resolves.not.toThrow();
    });
  });

  describe('API Compatibility', () => {
    it('should maintain backward compatibility for CLI integration', async () => {
      const generator = new ClineGenerator();
      
      // 既存のAPIインターフェースが変更されていないことを確認
      expect(typeof generator.generateFiles).toBe('function');
      
      // オプションパラメータが正しく処理されることを確認
      await generator.generateFiles(testOutputDir, { 
        projectName: 'api-test',
        force: true,
        lang: 'en'
      });
      
      expect(existsSync(join(testOutputDir, '.clinerules'))).toBe(true);
    });
  });
});