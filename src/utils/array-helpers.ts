/**
 * Type-safe array utility functions
 * Provides type-safe wrappers for JavaScript array methods without type assertions
 * 
 * These functions eliminate the need for type assertions in type guards
 * by providing proper type inference through generic constraints
 */

/**
 * Type-safe includes check for readonly arrays with literal types
 * Pure implementation without any type assertions
 * Uses manual iteration to ensure complete type safety
 */
export function includesTypeSafe<T extends readonly unknown[]>(
  array: T,
  value: unknown
): value is T[number] {
  // Manual iteration avoids any type assertions
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true;
    }
  }
  return false;
}

/**
 * Type-safe includes check for string literal union types
 * Specifically designed for const assertions and readonly string arrays
 * Pure implementation without any type assertions
 */
export function includesStringLiteral<T extends readonly string[]>(
  array: T,
  value: unknown
): value is T[number] {
  // Early string type check for optimization
  if (typeof value !== 'string') {
    return false;
  }
  
  // Manual iteration avoids type assertions entirely
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true;
    }
  }
  return false;
}

/**
 * Type-safe every check with type predicate
 * Ensures all elements in array satisfy the predicate function
 */
export function everyTypeSafe<T, U extends T>(
  array: readonly T[],
  predicate: (item: T) => item is U
): array is readonly U[] {
  return array.every(predicate);
}

/**
 * Type-safe some check with type predicate
 * Checks if at least one element in array satisfies the predicate function
 */
export function someTypeSafe<T>(
  array: readonly T[],
  predicate: (item: T) => boolean
): boolean {
  return array.some(predicate);
}

/**
 * Type-safe find with type predicate
 * Returns the first element that satisfies the predicate, with proper typing
 */
export function findTypeSafe<T, U extends T>(
  array: readonly T[],
  predicate: (item: T) => item is U
): U | undefined {
  return array.find(predicate);
}

/**
 * Type-safe filter with type predicate
 * Returns a new array with elements that satisfy the predicate, with proper typing
 */
export function filterTypeSafe<T, U extends T>(
  array: readonly T[],
  predicate: (item: T) => item is U
): readonly U[] {
  return array.filter(predicate);
}

/**
 * Check if a value is a member of a const-asserted tuple/array
 * This is the safest way to check membership without type assertions
 */
export function isMemberOf<const T extends readonly unknown[]>(
  array: T,
  value: unknown
): value is T[number] {
  return includesTypeSafe(array, value);
}

/**
 * Create a type predicate function for checking membership in a const array
 * Returns a reusable type guard function - completely type assertion free
 */
export function createMembershipCheck<const T extends readonly string[]>(
  array: T
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] => {
    return typeof value === 'string' && includesStringLiteral(array, value);
  };
}

/**
 * Type-safe array validation that preserves tuple types
 * Validates that all elements in an array are of a specific type
 */
export function validateArrayElements<T>(
  array: readonly unknown[],
  validator: (item: unknown) => item is T
): array is readonly T[] {
  return everyTypeSafe(array, validator);
}

/**
 * Safe array access with bounds checking
 * Returns undefined for out-of-bounds access instead of throwing
 */
export function safeArrayAccess<T>(
  array: readonly T[],
  index: number
): T | undefined {
  return index >= 0 && index < array.length ? array[index] : undefined;
}

/**
 * Type-safe array equality check
 * Compares two arrays for deep equality with proper typing
 */
export function arraysEqual<T>(
  array1: readonly T[],
  array2: readonly T[],
  compareFn?: (a: T, b: T) => boolean
): boolean {
  if (array1.length !== array2.length) {
    return false;
  }
  
  const compare = compareFn ?? ((a, b) => a === b);
  return array1.every((item, index) => compare(item, array2[index]!));
}

/**
 * Type-safe cast function that works with type guards
 * Only performs the cast if the type guard validates the value
 */
export function safeCast<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T
): T {
  if (typeGuard(value)) {
    return value;
  }
  throw new Error(`Type cast failed: value does not satisfy type guard`);
}

/**
 * Type-safe cast function that returns undefined on failure
 * Safer alternative to safeCast that doesn't throw
 */
export function tryCast<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T
): T | undefined {
  return typeGuard(value) ? value : undefined;
}

/**
 * Pure functional includes implementation using for...of
 * Completely type assertion free alternative
 */
export function includesPure<T extends readonly unknown[]>(
  array: T,
  value: unknown
): value is T[number] {
  for (const item of array) {
    if (item === value) {
      return true;
    }
  }
  return false;
}

/**
 * High-performance includes implementation using some()
 * Type assertion free with proper type guard semantics
 */
export function includesWithSome<T extends readonly unknown[]>(
  array: T,
  value: unknown
): value is T[number] {
  return array.some(item => item === value);
}

/**
 * Recursive includes implementation for educational purposes
 * Demonstrates pure functional approach without type assertions
 */
export function includesRecursive<T extends readonly unknown[]>(
  array: T,
  value: unknown,
  index: number = 0
): value is T[number] {
  if (index >= array.length) {
    return false;
  }
  
  if (array[index] === value) {
    return true;
  }
  
  return includesRecursive(array, value, index + 1);
}