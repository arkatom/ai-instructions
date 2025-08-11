/**
 * TDD RED PHASE: ValidationCoordinator Tests
 * Issue #50: Extract validation logic from InitCommand
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
});