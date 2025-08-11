/**
 * Result of command execution
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
export interface CommandResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: unknown;
}