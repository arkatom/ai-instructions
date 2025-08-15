/**
 * Test suite for type assertion free array helper implementations
 * Validates that the pure implementations work correctly with const assertions
 */

import {
  includesTypeSafe,
  includesStringLiteral,
  includesPure,
  includesWithSome,
  includesRecursive,
  createMembershipCheck
} from '../src/utils/array-helpers';

// Test data with const assertions
const LANGUAGES = ['en', 'ja', 'ch'] as const;
const TOOLS = ['claude', 'cursor', 'github-copilot'] as const;
const NUMBERS = [1, 2, 3, 42] as const;
const MIXED = ['hello', 42, true, null] as const;

describe('Type Assertion Free Array Helpers', () => {
  describe('includesTypeSafe', () => {
    it('should correctly identify members of const arrays', () => {
      expect(includesTypeSafe(LANGUAGES, 'en')).toBe(true);
      expect(includesTypeSafe(LANGUAGES, 'ja')).toBe(true);
      expect(includesTypeSafe(LANGUAGES, 'fr')).toBe(false);
      expect(includesTypeSafe(LANGUAGES, 123)).toBe(false);
    });

    it('should work with mixed type arrays', () => {
      expect(includesTypeSafe(MIXED, 'hello')).toBe(true);
      expect(includesTypeSafe(MIXED, 42)).toBe(true);
      expect(includesTypeSafe(MIXED, true)).toBe(true);
      expect(includesTypeSafe(MIXED, null)).toBe(true);
      expect(includesTypeSafe(MIXED, 'missing')).toBe(false);
    });

    it('should work with number arrays', () => {
      expect(includesTypeSafe(NUMBERS, 1)).toBe(true);
      expect(includesTypeSafe(NUMBERS, 42)).toBe(true);
      expect(includesTypeSafe(NUMBERS, 99)).toBe(false);
    });
  });

  describe('includesStringLiteral', () => {
    it('should correctly identify string members', () => {
      expect(includesStringLiteral(LANGUAGES, 'en')).toBe(true);
      expect(includesStringLiteral(LANGUAGES, 'ja')).toBe(true);
      expect(includesStringLiteral(LANGUAGES, 'fr')).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(includesStringLiteral(LANGUAGES, 123)).toBe(false);
      expect(includesStringLiteral(LANGUAGES, true)).toBe(false);
      expect(includesStringLiteral(LANGUAGES, null)).toBe(false);
      expect(includesStringLiteral(LANGUAGES, undefined)).toBe(false);
    });

    it('should work with tool names', () => {
      expect(includesStringLiteral(TOOLS, 'claude')).toBe(true);
      expect(includesStringLiteral(TOOLS, 'cursor')).toBe(true);
      expect(includesStringLiteral(TOOLS, 'unknown-tool')).toBe(false);
    });
  });

  describe('includesPure', () => {
    it('should work identically to includesTypeSafe', () => {
      const testValues = ['en', 'ja', 'fr', 123, true, null];
      
      testValues.forEach(value => {
        expect(includesPure(LANGUAGES, value)).toBe(includesTypeSafe(LANGUAGES, value));
        expect(includesPure(MIXED, value)).toBe(includesTypeSafe(MIXED, value));
      });
    });
  });

  describe('includesWithSome', () => {
    it('should work identically to includesTypeSafe', () => {
      const testValues = ['en', 'ja', 'fr', 123, true, null];
      
      testValues.forEach(value => {
        expect(includesWithSome(LANGUAGES, value)).toBe(includesTypeSafe(LANGUAGES, value));
        expect(includesWithSome(MIXED, value)).toBe(includesTypeSafe(MIXED, value));
      });
    });
  });

  describe('includesRecursive', () => {
    it('should work identically to includesTypeSafe', () => {
      const testValues = ['en', 'ja', 'fr', 123, true, null];
      
      testValues.forEach(value => {
        expect(includesRecursive(LANGUAGES, value)).toBe(includesTypeSafe(LANGUAGES, value));
        expect(includesRecursive(MIXED, value)).toBe(includesTypeSafe(MIXED, value));
      });
    });

    it('should handle empty arrays', () => {
      const empty = [] as const;
      expect(includesRecursive(empty, 'test')).toBe(false);
    });
  });

  describe('createMembershipCheck', () => {
    it('should create reusable type guard functions', () => {
      const isLanguage = createMembershipCheck(LANGUAGES);
      const isTool = createMembershipCheck(TOOLS);

      expect(isLanguage('en')).toBe(true);
      expect(isLanguage('ja')).toBe(true);
      expect(isLanguage('fr')).toBe(false);
      expect(isLanguage(123)).toBe(false);

      expect(isTool('claude')).toBe(true);
      expect(isTool('cursor')).toBe(true);
      expect(isTool('unknown')).toBe(false);
    });
  });

  describe('Type Guard Functionality', () => {
    it('should properly narrow types in conditional blocks', () => {
      const testValue: unknown = 'en';
      
      if (includesStringLiteral(LANGUAGES, testValue)) {
        // TypeScript should infer testValue as 'en' | 'ja' | 'ch'
        const narrowed: typeof LANGUAGES[number] = testValue;
        expect(narrowed).toBe('en');
      }
    });

    it('should work with function parameters', () => {
      function processLanguage(input: unknown): string {
        if (includesStringLiteral(LANGUAGES, input)) {
          // input is now typed as 'en' | 'ja' | 'ch'
          return `Processing language: ${input}`;
        }
        return 'Unknown language';
      }

      expect(processLanguage('en')).toBe('Processing language: en');
      expect(processLanguage('fr')).toBe('Unknown language');
      expect(processLanguage(123)).toBe('Unknown language');
    });
  });

  describe('Performance Comparison', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
    const searchValue = 'item-500';

    it('should have similar performance across implementations', () => {
      const implementations = [
        includesTypeSafe,
        includesPure,
        includesWithSome,
        includesRecursive
      ];

      implementations.forEach(impl => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          impl(largeArray, searchValue);
        }
        const end = performance.now();
        
        // All implementations should complete within reasonable time
        expect(end - start).toBeLessThan(100); // 100ms threshold
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      const empty = [] as const;
      expect(includesTypeSafe(empty, 'test')).toBe(false);
      expect(includesStringLiteral(empty, 'test')).toBe(false);
    });

    it('should handle arrays with undefined and null', () => {
      const withNulls = [null, undefined, 'value'] as const;
      expect(includesTypeSafe(withNulls, null)).toBe(true);
      expect(includesTypeSafe(withNulls, undefined)).toBe(true);
      expect(includesTypeSafe(withNulls, 'value')).toBe(true);
      expect(includesTypeSafe(withNulls, 'missing')).toBe(false);
    });

    it('should handle special numeric values', () => {
      const numbers = [0, -0, NaN, Infinity, -Infinity] as const;
      expect(includesTypeSafe(numbers, 0)).toBe(true);
      expect(includesTypeSafe(numbers, -0)).toBe(true);
      // NaN !== NaN in JavaScript, so this should be false
      expect(includesTypeSafe(numbers, NaN)).toBe(false);
      expect(includesTypeSafe(numbers, Infinity)).toBe(true);
      expect(includesTypeSafe(numbers, -Infinity)).toBe(true);
    });
  });
});