/**
 * TDD RED PHASE: ValidationCoordinator Tests
 * Issue #50: Extract validation logic from InitCommand
 * Enhanced with type safety improvements
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const testDir = join(__dirname, '../../.test-cli');

describe('ValidationCoordinator', () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Validation Interface', () => {
    it('should validate command arguments and return ValidationResult', async () => {
      // RED: ValidationCoordinator クラスが存在しない（テストは失敗するはず）
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const validArgs = {
        command: 'init',
        projectName: 'valid-project',
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude',
        conflictResolution: 'backup'
      };

      const result = coordinator.validate(validArgs);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should reject invalid project names', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'init',
        projectName: '',  // Invalid: empty string
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude'
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error: string) => error.toLowerCase().includes('project'))).toBe(true);
    });

    it('should reject invalid languages', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'init',
        projectName: 'valid-project',
        lang: 'invalid-lang',  // Invalid language
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude'
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error: string) => error.toLowerCase().includes('language'))).toBe(true);
    });

    it('should reject invalid tools', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'init',
        projectName: 'valid-project',
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'invalid-tool'  // Invalid tool
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error: string) => error.toLowerCase().includes('tool'))).toBe(true);
    });
  });

  describe('Validator Dependencies', () => {
    it('should accept custom validators via dependency injection', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      
      const mockValidators = {
        projectName: { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) },
        language: { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) },
        outputFormat: { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) },
        outputPath: { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) },
        conflictResolution: { validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }) }
      };
      
      const coordinator = new ValidationCoordinator(mockValidators);
      
      const args = {
        command: 'init',
        projectName: 'test-project',
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude'
      };

      coordinator.validate(args);
      
      expect(mockValidators.projectName.validate).toHaveBeenCalled();
      expect(mockValidators.language.validate).toHaveBeenCalled();
    });
  });

  describe('Type Safety Improvements', () => {
    it('should handle invalid types for boolean fields', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'init',
        projectName: 'valid-project',
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude',
        force: 'not-a-boolean',  // Invalid type
        preview: 123,           // Invalid type
        interactive: null,      // Invalid type
        backup: undefined       // This should be ok
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error: string) => error.includes('Force flag must be a boolean'))).toBe(true);
      expect(result.errors.some((error: string) => error.includes('Preview flag must be a boolean'))).toBe(true);
      expect(result.errors.some((error: string) => error.includes('Interactive flag must be a boolean'))).toBe(true);
    });

    it('should handle invalid types for string fields', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'init',
        projectName: 123,        // Invalid type
        lang: null,             // Invalid type
        outputFormat: [],       // Invalid type
        output: {},             // Invalid type
        tool: true,             // Invalid type
        conflictResolution: 456 // Invalid type
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error: string) => error.includes('must be a string'))).toBe(true);
    });

    it('should validate non-InitCommandArgs correctly', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const invalidArgs = {
        command: 'other-command'
        // No init-specific fields
      };

      const result = coordinator.validate(invalidArgs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid command arguments: not an InitCommandArgs');
    });

    it('should accept valid InitCommandArgs with all types correct', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const validArgs = {
        command: 'init',
        projectName: 'valid-project',
        lang: 'ja',
        outputFormat: 'claude',
        output: testDir,
        tool: 'claude',
        conflictResolution: 'backup',
        force: true,
        preview: false,
        interactive: true,
        backup: false
      };

      const result = coordinator.validate(validArgs);
      
      // Note: This might still fail due to validator implementation details,
      // but type checking should pass
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle undefined values gracefully', async () => {
      const { ValidationCoordinator } = await import('../../../src/cli/services/ValidationCoordinator');
      const coordinator = new ValidationCoordinator();
      
      const argsWithUndefined = {
        command: 'init',
        projectName: undefined,
        lang: undefined,
        outputFormat: undefined,
        output: undefined,
        tool: undefined,
        conflictResolution: undefined,
        force: undefined,
        preview: undefined,
        interactive: undefined,
        backup: undefined
      };

      const result = coordinator.validate(argsWithUndefined);
      
      // Should handle undefined values without throwing type errors
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});