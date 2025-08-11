/**
 * TDD GREEN PHASE: EnvironmentService Tests
 * Issue #67: Replace process.cwd() with dependency injection
 */

import { describe, it, expect } from '@jest/globals';
import { EnvironmentService } from '../../src/services/EnvironmentService';

describe('EnvironmentService', () => {
  describe('getCurrentWorkingDirectory', () => {
    it('should return current working directory', () => {
      const envService = new EnvironmentService();
      
      const cwd = envService.getCurrentWorkingDirectory();
      expect(typeof cwd).toBe('string');
      expect(cwd.length).toBeGreaterThan(0);
    });

    it('should return absolute path', () => {
      const envService = new EnvironmentService();
      
      const cwd = envService.getCurrentWorkingDirectory();
      expect(cwd).toMatch(/^(\/|[A-Z]:)/); // Unix absolute or Windows drive letter
    });
  });

  describe('interface compliance', () => {
    it('should implement EnvironmentService interface', () => {
      const envService = new EnvironmentService();
      
      expect(typeof envService.getCurrentWorkingDirectory).toBe('function');
    });
  });
});