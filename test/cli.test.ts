import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
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