import { ClaudeGenerator } from '../../src/generators/claude';
import { join } from 'path';
import { existsSync } from 'fs';
import { rm, readFile } from 'fs/promises';

describe('Template Restructure (Issue #19)', () => {
  const testOutputDir = join(__dirname, './temp-test-restructure');

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('New Template Structure', () => {
    it('should copy instructions from unified instructions directory', async () => {
      const generator = new ClaudeGenerator();
      
      // TDD RED: 新しい統一構造でのファイル生成をテスト
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // 期待される構造：
      // testOutputDir/
      // ├── CLAUDE.md (日本語版)
      // └── instructions/ (統一instructionsディレクトリから)
      //     ├── core/
      //     │   ├── base.md
      //     │   ├── deep-think.md
      //     │   └── memory.md
      //     ├── workflows/
      //     ├── methodologies/
      //     └── patterns/
      
      expect(existsSync(join(testOutputDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'core'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'core', 'base.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'core', 'deep-think.md'))).toBe(true);
    });

    it('should copy instructions from unified structure instead of language-specific directories', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // 統一構造のbase.mdの内容を確認
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'core', 'base.md'), 'utf-8');
      
      // 日本語のファイルであることを確認
      expect(baseContent).toContain('超基本ルール');
      expect(baseContent).toContain('絶対厳守');
    });

    it('should work with any language using unified instructions', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'en' 
      });
      
      // 統一構造では言語に関係なく同じ内容
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'core', 'base.md'), 'utf-8');
      
      // 統一された日本語のファイルであることを確認
      expect(baseContent).toContain('超基本ルール');
      expect(baseContent).toContain('絶対厳守');
    });

    it('should support all configured languages with unified instructions', async () => {
      const generator = new ClaudeGenerator();
      
      // 統一構造ではサポートされている言語なら正常に動作する
      await expect(generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ch' // サポートされている言語
      })).resolves.not.toThrow();
      
      expect(existsSync(join(testOutputDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
    });

    it('should use unified instructions directory structure', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // instructions ディレクトリが存在することを確認
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
      
      // 新しい統一構造が正しくコピーされているかチェック
      const { readdir } = await import('fs/promises');
      const instructionDirs = await readdir(join(testOutputDir, 'instructions'));
      
      // 統一構造のディレクトリが存在することを確認
      expect(instructionDirs).toContain('core');
      expect(instructionDirs).toContain('workflows');
      expect(instructionDirs).toContain('methodologies');
      expect(instructionDirs).toContain('patterns');
      
      // コアファイルが正しく配置されていることを確認
      const coreFiles = await readdir(join(testOutputDir, 'instructions', 'core'));
      expect(coreFiles).toContain('base.md');
      expect(coreFiles).toContain('deep-think.md');
      expect(coreFiles).toContain('memory.md');
    });
  });

  describe('Template Variable Replacement', () => {
    it('should replace projectName in CLAUDE.md from shared template', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'my-restructured-project', 
        lang: 'ja' 
      });
      
      const claudeContent = await readFile(join(testOutputDir, 'CLAUDE.md'), 'utf-8');
      
      // プロジェクト名が正しく置換されていることを確認
      expect(claudeContent).toContain('my-restructured-project');
      expect(claudeContent).not.toContain('{{projectName}}');
    });
  });
});