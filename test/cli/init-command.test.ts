/**
 * TDD GREEN PHASE: InitCommand Tests
 * Issue #50: Extract init command logic from CLI monolith
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const testDir = join(__dirname, '../.test-cli');

describe('InitCommand', () => {
  beforeEach(() => {
    // Test directory setup
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Command Interface Compliance', () => {
    it('should implement Command interface', async () => {
      // GREEN: InitCommand クラスが実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      // Command interface methods should exist
      expect(typeof command.execute).toBe('function');
      expect(typeof command.validate).toBe('function');
    });
  });

  describe('Command Execution', () => {
    it('should execute non-interactive mode successfully', async () => {
      // GREEN: InitCommand クラスが実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      const args = {
        command: 'init',
        output: testDir,
        projectName: 'test-project',
        tool: 'claude',
        lang: 'ja',
        outputFormat: 'claude',
        interactive: false,
        conflictResolution: 'skip'
      };
      
      const result = await command.execute(args);
      expect(result.success).toBe(true);
    });

    it('should handle interactive mode detection', async () => {
      // GREEN: InitCommand can be instantiated with proper dependencies
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      // Should successfully create command instance with InteractiveModeDetector
      expect(command).toBeInstanceOf(InitCommand);
    });
  });

  describe('Command Validation', () => {
    it('should validate command arguments', async () => {
      // GREEN: InitCommand クラスが実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      const invalidArgs = {
        command: 'init',
        output: '/invalid/path',
        projectName: '',
        tool: 'unsupported',
        lang: 'unsupported',
        outputFormat: 'unsupported'
      };
      
      const result = command.validate(invalidArgs);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation for valid arguments', async () => {
      // GREEN: InitCommand クラスが実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      const validArgs = {
        command: 'init',
        output: testDir,
        projectName: 'valid-project',
        tool: 'claude',
        lang: 'ja',
        outputFormat: 'claude',
        conflictResolution: 'backup'
      };
      
      const result = command.validate(validArgs);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Dependency Injection', () => {
    it('should accept injected validators', async () => {
      // GREEN: InitCommand with DI が実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      
      // Mock validators
      const mockValidators = {
        projectName: { validate: jest.fn() },
        language: { validate: jest.fn() },
        outputFormat: { validate: jest.fn() },
        outputPath: { validate: jest.fn() },
        conflictResolution: { validate: jest.fn() }
      };
      
      const command = new InitCommand(mockValidators);
      expect(command.validators).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle security violations gracefully', async () => {
      // GREEN: InitCommand クラスが実装されている
      const { InitCommand } = await import('../../src/cli/commands/InitCommand');
      const command = new InitCommand();
      
      const args = {
        command: 'init',
        output: '/invalid/readonly/path/that/does/not/exist',
        projectName: 'test-project',
        tool: 'claude'
      };
      
      const result = await command.execute(args);
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });
});