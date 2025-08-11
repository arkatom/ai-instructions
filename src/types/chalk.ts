/**
 * Chalk utility type definitions
 * Issue #49: Eliminate 'any' types - Proper Chalk interface
 */

/**
 * Basic Chalk color functions interface
 */
export interface ChalkInstance {
  red: (text: string) => string;
  blue: (text: string) => string;
  yellow?: (text: string) => string;
  green?: (text: string) => string;
}

/**
 * Chalk fallback type for when chalk is not available
 */
export type ChalkFallback = ChalkInstance;