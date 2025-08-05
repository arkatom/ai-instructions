import { ClaudeGenerator } from '../../src/generators/claude';
import { join } from 'path';
import { existsSync } from 'fs';
import { rm, readFile } from 'fs/promises';

describe('Template Restructure (Issue #19)', () => {
  const testOutputDir = join(__dirname, '../temp-test-restructure');

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('New Template Structure', () => {
    it('should copy instructions from shared language-specific directories', async () => {
      const generator = new ClaudeGenerator();
      
      // TDD RED: 新しい構造でのファイル生成をテスト
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // 期待される構造：
      // testOutputDir/
      // ├── CLAUDE.md (日本語版)
      // └── instructions/ (日本語版の共通instructionsディレクトリから)
      //     ├── base.md
      //     ├── deep-think.md
      //     └── ... その他のファイル
      
      expect(existsSync(join(testOutputDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'base.md'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'instructions', 'deep-think.md'))).toBe(true);
    });

    it('should copy instructions from templates/shared/instructions/ja/ instead of templates/claude/ja/instructions/', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // 日本語のbase.mdの内容を確認（共通ディレクトリから来ているかチェック）
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'base.md'), 'utf-8');
      
      // 日本語のファイルであることを確認
      expect(baseContent).toContain('超基本ルール');
      expect(baseContent).toContain('絶対厳守');
    });

    it('should copy instructions from templates/shared/instructions/en/ for English', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'en' 
      });
      
      // 英語のbase.mdの内容を確認（共通ディレクトリから来ているかチェック）
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'base.md'), 'utf-8');
      
      // 英語のファイルであることを確認
      expect(baseContent).toContain('Core Rules');
      expect(baseContent).toContain('Absolute Requirements');
    });

    it('should copy instructions from templates/shared/instructions/ch/ for Chinese', async () => {
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ch' 
      });
      
      // 中国語のbase.mdの内容を確認（共通ディレクトリから来ているかチェック）
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'base.md'), 'utf-8');
      
      // 中国語のファイルであることを確認
      expect(baseContent).toContain('超级基本规则');
      expect(baseContent).toContain('必须');
    });

    it('should fall back to English if language-specific shared instructions not found', async () => {
      const generator = new ClaudeGenerator();
      
      // 存在しない言語でテスト
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'fr' as any // フランス語（存在しない）
      });
      
      // 英語版にフォールバックすることを確認
      const baseContent = await readFile(join(testOutputDir, 'instructions', 'base.md'), 'utf-8');
      expect(baseContent).toContain('Core Rules');
    });

    it('should use shared instructions that are not duplicated across tools', async () => {
      // この test は実装後に有効になる
      // 現在は claude/ja/instructions/ と claude/en/instructions/ が存在するが
      // 新しい構造では templates/shared/instructions/ja/ と templates/shared/instructions/en/ のみが存在する
      
      const generator = new ClaudeGenerator();
      
      await generator.generateFiles(testOutputDir, { 
        projectName: 'test-project', 
        lang: 'ja' 
      });
      
      // instructions ディレクトリが存在することを確認
      expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
      
      // ファイル数が適切かチェック（重複がないこと）
      const { readdir } = await import('fs/promises');
      const instructionFiles = await readdir(join(testOutputDir, 'instructions'));
      
      // 最低限必要なファイルが存在することを確認
      expect(instructionFiles).toContain('base.md');
      expect(instructionFiles).toContain('deep-think.md');
      expect(instructionFiles).toContain('memory.md');
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