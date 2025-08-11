/**
 * Result of validation operations
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}