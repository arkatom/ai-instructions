/**
 * Type guard utility functions
 * Issue #67: Replace typeof abuse with proper type guards
 */

/**
 * Type guard to check if a value is a non-empty string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a string or undefined
 */
export function isStringOrUndefined(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Type guard to check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is an object (but not null or array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Safely get a string value with fallback
 */
export function getStringValue(value: unknown, fallback: string): string {
  return isString(value) ? value : fallback;
}

/**
 * Safely get a string value from optional input with fallback
 */
export function getOptionalStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}