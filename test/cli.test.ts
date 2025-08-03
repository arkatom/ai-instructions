import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { rm } from 'fs/promises';

describe('CLI Basic Functionality', () => {
  const cliPath = join(__dirname, '../src/cli.ts');

  it('should display version when --version flag is used', () => {
    // Arrange
    const expectedVersion = '0.1.0';
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" --version`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expect(result.trim()).toBe(expectedVersion);
  });

  it('should display help when --help flag is used', () => {
    // Arrange
    const expectedContent = 'CLI tool to scaffold AI development instructions';
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" --help`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expect(result).toContain(expectedContent);
    expect(result).toContain('Commands:');
    expect(result).toContain('init');
  });

  it('should execute init command and generate files in current directory', () => {
    // Arrange
    const expectedMessages = [
      'Generated Claude Code template files',
      'CLAUDE.md and instructions/ directory created',
      'Project name: my-project'
    ];
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" init`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expectedMessages.forEach(message => {
      expect(result).toContain(message);
    });
  });
});

describe('CLI Error Handling', () => {
  const cliPath = join(__dirname, '../src/cli.ts');

  it('should display error when output directory is invalid', () => {
    // Red: 無効なディレクトリパスでエラーメッセージを表示すべき
    const invalidPath = '/invalid/readonly/path/that/does/not/exist';
    
    expect(() => {
      execSync(`npx ts-node "${cliPath}" init --output "${invalidPath}"`, { 
        encoding: 'utf-8',
        cwd: join(__dirname, '..')
      });
    }).toThrow();
  });

  it('should validate project name and show error for invalid characters', () => {
    // Red: 無効なプロジェクト名文字でエラーメッセージを表示すべき  
    const invalidProjectName = 'invalid<>project|name';
    const testOutputDir = join(__dirname, '../temp-invalid-test');
    
    expect(() => {
      execSync(`npx ts-node "${cliPath}" init --output "${testOutputDir}" --project-name "${invalidProjectName}"`, { 
        encoding: 'utf-8',
        cwd: join(__dirname, '..')
      });
    }).toThrow();
  });
});

describe('CLI Isolated Environment Testing', () => {
  const cliPath = join(__dirname, '../src/cli.ts');
  const isolatedTestDir = join(__dirname, '../temp-isolated-test');

  afterEach(async () => {
    // 完全にクリーンアップ
    if (existsSync(isolatedTestDir)) {
      await rm(isolatedTestDir, { recursive: true, force: true });
    }
  });

  it('should generate complete file structure in isolated directory', () => {
    // Red: 分離環境で完全なディレクトリ構造・ファイル生成を検証
    const projectName = 'isolated-test-project';
    
    execSync(`npx ts-node "${cliPath}" init --output "${isolatedTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    // 必須ファイル・ディレクトリ構造確認
    expect(existsSync(join(isolatedTestDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(isolatedTestDir, 'instructions'))).toBe(true);
    expect(existsSync(join(isolatedTestDir, 'instructions', 'base.md'))).toBe(true);
    expect(existsSync(join(isolatedTestDir, 'instructions', 'deep-think.md'))).toBe(true);
    expect(existsSync(join(isolatedTestDir, 'instructions', 'KentBeck-tdd-rules.md'))).toBe(true);
  });

  it('should properly replace template variables in generated CLAUDE.md', () => {
    // Red: テンプレート変数置換の完全性を検証
    const projectName = 'variable-replacement-test';
    
    execSync(`npx ts-node "${cliPath}" init --output "${isolatedTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    const claudeContent = readFileSync(join(isolatedTestDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain(`# AI開発アシスタント 行動指示 - ${projectName}`);
    expect(claudeContent).not.toContain('{{projectName}}');
  });
});

describe('CLI Edge Case Project Names', () => {
  const cliPath = join(__dirname, '../src/cli.ts');
  const edgeCaseTestDir = join(__dirname, '../temp-edge-case-test');

  afterEach(async () => {
    if (existsSync(edgeCaseTestDir)) {
      await rm(edgeCaseTestDir, { recursive: true, force: true });
    }
  });

  it('should handle project names with spaces correctly', () => {
    // Red: スペース含みプロジェクト名の処理確認
    const projectNameWithSpaces = 'my project name';
    
    const result = execSync(`npx ts-node "${cliPath}" init --output "${edgeCaseTestDir}" --project-name "${projectNameWithSpaces}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    expect(result).toContain(`Project name: ${projectNameWithSpaces}`);
    
    const claudeContent = readFileSync(join(edgeCaseTestDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain(`# AI開発アシスタント 行動指示 - ${projectNameWithSpaces}`);
  });

  it('should handle project names with hyphens and underscores', () => {
    // Red: ハイフン・アンダースコア含みプロジェクト名確認
    const projectNameWithDashes = 'my-awesome_project-2024';
    
    const result = execSync(`npx ts-node "${cliPath}" init --output "${edgeCaseTestDir}" --project-name "${projectNameWithDashes}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    expect(result).toContain(`Project name: ${projectNameWithDashes}`);
  });

  it('should handle Unicode/Japanese project names', () => {
    // Red: Unicode・日本語プロジェクト名確認
    const japaneseProjectName = 'プロジェクト名テスト';
    
    const result = execSync(`npx ts-node "${cliPath}" init --output "${edgeCaseTestDir}" --project-name "${japaneseProjectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    expect(result).toContain(`Project name: ${japaneseProjectName}`);
    
    const claudeContent = readFileSync(join(edgeCaseTestDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain(`# AI開発アシスタント 行動指示 - ${japaneseProjectName}`);
  });

  it('should reject empty project names', () => {
    // Red: 空文字プロジェクト名拒否確認
    expect(() => {
      execSync(`npx ts-node "${cliPath}" init --output "${edgeCaseTestDir}" --project-name ""`, { 
        encoding: 'utf-8',
        cwd: join(__dirname, '..')
      });
    }).toThrow();
  });

  it('should handle very long project names appropriately', () => {
    // Red: 極端に長いプロジェクト名処理確認
    const longProjectName = 'a'.repeat(100) + '-very-long-project-name';
    
    const result = execSync(`npx ts-node "${cliPath}" init --output "${edgeCaseTestDir}" --project-name "${longProjectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    expect(result).toContain(`Project name: ${longProjectName}`);
  });
});

describe('CLI Deep Content Verification', () => {
  const cliPath = join(__dirname, '../src/cli.ts');
  const contentTestDir = join(__dirname, '../temp-content-test');

  afterEach(async () => {
    if (existsSync(contentTestDir)) {
      await rm(contentTestDir, { recursive: true, force: true });
    }
  });

  it('should generate complete instructions directory structure with all required files', () => {
    // Red: instructions/の完全なディレクトリ構造・必要ファイル検証
    const projectName = 'content-verification-test';
    
    execSync(`npx ts-node "${cliPath}" init --output "${contentTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    // 必須instructionsファイル群確認
    const requiredFiles = [
      'instructions/base.md',
      'instructions/deep-think.md', 
      'instructions/memory.md',
      'instructions/KentBeck-tdd-rules.md',
      'instructions/commit-rules.md',
      'instructions/pr-rules.md',
      'instructions/git.md',
      'instructions/develop.md',
      'instructions/command.md'
    ];

    requiredFiles.forEach(file => {
      const filePath = join(contentTestDir, file);
      expect(existsSync(filePath)).toBe(true);
      
      // ファイルが空でないことを確認
      const content = readFileSync(filePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
      expect(content.trim()).not.toBe('');
    });
  });

  it('should verify generated files contain expected content structures', () => {
    // Red: 生成ファイルの期待コンテンツ構造検証
    const projectName = 'structure-test';
    
    execSync(`npx ts-node "${cliPath}" init --output "${contentTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    // CLAUDE.md構造確認
    const claudeContent = readFileSync(join(contentTestDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain('# AI開発アシスタント 行動指示');
    expect(claudeContent).toContain('## 🚨 基本原則（必須）');
    expect(claudeContent).toContain('[基本ルール](./instructions/base.md)');
    expect(claudeContent).toContain('[深層思考](./instructions/deep-think.md)');

    // base.md構造確認
    const baseContent = readFileSync(join(contentTestDir, 'instructions/base.md'), 'utf-8');
    expect(baseContent).toContain('# 超基本ルール(MUST)');
    expect(baseContent).toContain('## 絶対厳守事項');
    expect(baseContent).toContain('適当度');

    // KentBeck-tdd-rules.md確認
    const tddContent = readFileSync(join(contentTestDir, 'instructions/KentBeck-tdd-rules.md'), 'utf-8');
    expect(tddContent).toContain('# ROLE AND EXPERTISE');
    expect(tddContent).toContain('Red → Green → Refactor');
  });

  it('should ensure all instruction file links and references are valid', () => {
    // Red: 指示ファイル間のリンク・参照整合性検証
    const projectName = 'link-verification';
    
    execSync(`npx ts-node "${cliPath}" init --output "${contentTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    const claudeContent = readFileSync(join(contentTestDir, 'CLAUDE.md'), 'utf-8');
    
    // リンク先ファイル存在確認
    const links = [
      './instructions/base.md',
      './instructions/deep-think.md',
      './instructions/memory.md',
      './instructions/command.md',
      './instructions/git.md',
      './instructions/commit-rules.md',
      './instructions/pr-rules.md',
      './instructions/develop.md',
      './instructions/KentBeck-tdd-rules.md'
    ];

    links.forEach(link => {
      expect(claudeContent).toContain(link);
      
      // 相対パスからの実際のファイル存在確認
      const resolvedPath = join(contentTestDir, link);
      expect(existsSync(resolvedPath)).toBe(true);
    });
  });

  it('should maintain proper UTF-8 encoding and content integrity', () => {
    // Red: UTF-8エンコーディング・コンテンツ整合性確認
    const projectName = 'エンコーディングテスト'; // Unicode project name
    
    execSync(`npx ts-node "${cliPath}" init --output "${contentTestDir}" --project-name "${projectName}"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });

    // UTF-8エンコーディング確認
    const claudeContent = readFileSync(join(contentTestDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain(`# AI開発アシスタント 行動指示 - ${projectName}`);
    
    // 日本語文字が正しく保持されていることを確認
    const baseContent = readFileSync(join(contentTestDir, 'instructions/base.md'), 'utf-8');
    expect(baseContent).toContain('超基本ルール');
    expect(baseContent).toContain('絶対厳守事項');
    expect(baseContent).toContain('適当度');
  });
});

describe('CLI Init Command Integration', () => {
  const cliPath = join(__dirname, '../src/cli.ts');
  const testOutputDir = join(__dirname, '../temp-cli-test');

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should generate Claude Code template files with init command', () => {
    // Red: CLI initコマンドがClaudeGenerator統合で実際にファイル生成
    const result = execSync(`npx ts-node "${cliPath}" init --output "${testOutputDir}" --project-name "test-cli-project"`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    expect(result).toContain('Generated Claude Code template');
    expect(existsSync(join(testOutputDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(testOutputDir, 'instructions'))).toBe(true);
  });
});