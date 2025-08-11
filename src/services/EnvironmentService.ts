/**
 * EnvironmentService - Dependency injection wrapper for process.cwd()
 * Issue #67: Replace process.cwd() direct usage with injectable service
 */

export class EnvironmentService {
  /**
   * Get current working directory
   * @returns Current working directory path
   */
  getCurrentWorkingDirectory(): string {
    return process.cwd();
  }
}