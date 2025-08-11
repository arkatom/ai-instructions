/**
 * Type guard utility tests
 * Issue #67: Replace typeof abuse with proper type guards
 */

import { describe, it, expect } from '@jest/globals';
import { 
  isString, 
  isStringOrUndefined, 
  isBoolean, 
  isNumber, 
  isObject, 
  isArray, 
  isStringArray,
  getStringValue,
  getOptionalStringValue
} from '../../src/utils/type-guards';

describe('Type Guards', () => {
  describe('isString', () => {
    it('should return true for non-empty strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('a')).toBe(true);
      expect(isString(' ')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isString('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString(123)).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString(true)).toBe(false);
    });
  });

  describe('isStringOrUndefined', () => {
    it('should return true for strings', () => {
      expect(isStringOrUndefined('hello')).toBe(true);
      expect(isStringOrUndefined('')).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isStringOrUndefined(undefined)).toBe(true);
    });

    it('should return false for other types', () => {
      expect(isStringOrUndefined(null)).toBe(false);
      expect(isStringOrUndefined(123)).toBe(false);
      expect(isStringOrUndefined([])).toBe(false);
      expect(isStringOrUndefined({})).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('should return true for boolean values', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('should return false for non-boolean values', () => {
      expect(isBoolean('true')).toBe(false);
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean(null)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it('should return false for NaN and non-numbers', () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for null, arrays, and other types', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('object')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(['a', 'b'])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('array')).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
    });
  });

  describe('isStringArray', () => {
    it('should return true for arrays of strings', () => {
      expect(isStringArray([])).toBe(true);
      expect(isStringArray(['hello', 'world'])).toBe(true);
      expect(isStringArray(['', 'non-empty'])).toBe(true);
    });

    it('should return false for arrays with non-strings', () => {
      expect(isStringArray([1, 2, 3])).toBe(false);
      expect(isStringArray(['hello', 123])).toBe(false);
      expect(isStringArray([null])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isStringArray('not array')).toBe(false);
      expect(isStringArray({})).toBe(false);
    });
  });

  describe('getStringValue', () => {
    it('should return the string value if valid', () => {
      expect(getStringValue('hello', 'fallback')).toBe('hello');
      expect(getStringValue('valid', 'default')).toBe('valid');
    });

    it('should return fallback for invalid values', () => {
      expect(getStringValue('', 'fallback')).toBe('fallback');
      expect(getStringValue(null, 'fallback')).toBe('fallback');
      expect(getStringValue(undefined, 'fallback')).toBe('fallback');
      expect(getStringValue(123, 'fallback')).toBe('fallback');
    });
  });

  describe('getOptionalStringValue', () => {
    it('should return string values including empty strings', () => {
      expect(getOptionalStringValue('hello', 'fallback')).toBe('hello');
      expect(getOptionalStringValue('', 'fallback')).toBe('');
    });

    it('should return fallback for non-string values', () => {
      expect(getOptionalStringValue(null, 'fallback')).toBe('fallback');
      expect(getOptionalStringValue(undefined, 'fallback')).toBe('fallback');
      expect(getOptionalStringValue(123, 'fallback')).toBe('fallback');
      expect(getOptionalStringValue({}, 'fallback')).toBe('fallback');
    });
  });
});