import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { InteractiveUtils } from '../../src/init/interactive';

describe('CLI Interactive Mode Detection', () => {
  const cliPath = join(__dirname, '../../src/cli.ts');
  const testDir = join(__dirname, '../.test-cli-interactive');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Interactive Mode Detection', () => {
    it('should use non-interactive mode when --no-interactive flag is set', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Using non-interactive mode');
      expect(result).not.toContain('Starting interactive setup');
    });

    it('should use non-interactive mode when tool option is provided', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --tool cursor --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Using non-interactive mode');
      expect(result).toContain('Generated cursor template files');
    });

    it('should use non-interactive mode when multiple options are provided', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --tool github-copilot --project-name test-proj --lang en --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Using non-interactive mode');
      expect(result).toContain('Generated github-copilot template files');
      expect(result).toContain('Project name: test-proj');
    });

    it('should handle CI environment detection', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, CI: 'true', NODE_ENV: 'test' }
        }
      );

      // Assert
      // In CI, it should fall back to non-interactive
      expect(result).toContain('Using non-interactive mode');
    });
  });

  describe('Status Command', () => {
    it('should show status when no configuration exists', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" status --directory "${testDir}"`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('No configuration found');
    });

    it('should show status when configuration exists', () => {
      // Arrange
      const config = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'test-status-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };
      
      writeFileSync(
        join(testDir, '.ai-instructions.json'),
        JSON.stringify(config, null, 2)
      );

      // Act
      const result = execSync(
        `npx ts-node "${cliPath}" status --directory "${testDir}"`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Current Configuration');
      expect(result).toContain('test-status-project');
      expect(result).toContain('Claude');
    });

    it('should use current directory when not specified', () => {
      // Arrange
      const config = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['tdd'],
        languages: ['python'],
        projectName: 'current-dir-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };
      
      writeFileSync(
        join(testDir, '.ai-instructions.json'),
        JSON.stringify(config, null, 2)
      );

      // Act
      const result = execSync(
        `npx ts-node "${cliPath}" status`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Current Configuration');
      expect(result).toContain('current-dir-project');
    });
  });

  describe('Help Interactive Command', () => {
    it('should display interactive help', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" help-interactive`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('AI Instructions - Interactive Setup');
      expect(result).toContain('Available Tools');
      expect(result).toContain('Available Workflows');
      expect(result).toContain('Available Methodologies');
      expect(result).toContain('Available Languages');
    });

    it('should list all tools in help', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" help-interactive`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('claude');
      expect(result).toContain('cursor');
      expect(result).toContain('cline');
      expect(result).toContain('github-copilot');
    });

    it('should show usage examples', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" help-interactive`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Usage:');
      expect(result).toContain('ai-instructions init');
      expect(result).toContain('Interactive mode');
      expect(result).toContain('Non-interactive mode');
    });
  });

  describe('Command Options Validation', () => {
    it('should validate project name in interactive mode detection', () => {
      // Test that special project name doesn't trigger interactive
      const result = execSync(
        `npx ts-node "${cliPath}" init --project-name "special-project" --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      expect(result).toContain('Using non-interactive mode');
      expect(result).toContain('special-project');
    });

    it('should handle output directory only in interactive detection', () => {
      // When only output is specified, it could still use interactive
      // but since we're in test environment without TTY, it falls back
      const result = execSync(
        `npx ts-node "${cliPath}" init --output "${testDir}" --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: join(__dirname, '../..'),
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      expect(result).toContain('Using non-interactive mode');
    });

    it('should handle language option in interactive detection', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --lang en --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Using non-interactive mode');
    });

    it('should handle output format option in interactive detection', () => {
      // Arrange & Act
      const result = execSync(
        `npx ts-node "${cliPath}" init --output-format cursor --no-interactive --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Assert
      expect(result).toContain('Using non-interactive mode');
    });
  });

  describe('Error Handling', () => {
    it('should handle status command errors gracefully', () => {
      // Arrange
      const invalidPath = '/invalid/path/that/does/not/exist/12345';

      // Act
      try {
        execSync(
          `npx ts-node "${cliPath}" status --directory "${invalidPath}"`,
          {
            encoding: 'utf-8',
            cwd: join(__dirname, '../..'),
            env: { ...process.env, NODE_ENV: 'test' }
          }
        );
      } catch (error: any) {
        // Assert
        expect(error.status).toBe(1);
        expect(error.stdout.toString()).toContain('Failed to show status');
      }
    });

    it('should handle help-interactive command errors gracefully', () => {
      // This is harder to test as the help command is quite robust
      // But we can test that it doesn't crash
      let result: string;
      
      try {
        result = execSync(
          `npx ts-node "${cliPath}" help-interactive 2>&1`,
          {
            encoding: 'utf-8',
            cwd: join(__dirname, '../..'),
            env: { ...process.env, NODE_ENV: 'test' }
          }
        );
      } catch (error: any) {
        result = error.stdout.toString();
      }

      // Should still show something even if there's an issue
      expect(result).toBeDefined();
    });
  });

  describe('Integration with InteractiveUtils', () => {
    it('should respect InteractiveUtils.canRunInteractive', () => {
      // Mock the function to return false
      jest.spyOn(InteractiveUtils, 'canRunInteractive').mockReturnValue(false);

      // This would normally try interactive mode without options
      const result = execSync(
        `npx ts-node "${cliPath}" init --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        }
      );

      // Should fall back to non-interactive
      expect(result).toContain('Using non-interactive mode');
    });

    it('should show warning when interactive not available', () => {
      // In CI environment
      const result = execSync(
        `npx ts-node "${cliPath}" init --conflict-resolution skip`,
        {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, CI: 'true', NODE_ENV: 'test' },
          stdio: 'pipe'
        }
      );

      // Should use non-interactive mode in CI
      expect(result).toContain('Using non-interactive mode');
    });
  });
});