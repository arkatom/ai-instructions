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
  getOptionalStringValue,
  // CLI-specific type guards
  isSupportedLanguage,
  isSupportedTool,
  isSupportedOutputFormat,
  isSupportedConflictResolution,
  isValidProjectName,
  isValidOutputPath,
  validateCliOptions,
  hasValidatedOptions
} from '../../src/utils/type-guards';
import { RawInitOptions } from '../../src/types/cli-types';

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

  // =============================================================================
  // CLI-Specific Type Guards Tests
  // =============================================================================

  describe('CLI Type Guards', () => {
    describe('isSupportedLanguage', () => {
      it('should return true for supported languages', () => {
        expect(isSupportedLanguage('en')).toBe(true);
        expect(isSupportedLanguage('ja')).toBe(true);
        expect(isSupportedLanguage('ch')).toBe(true);
      });

      it('should return false for unsupported languages', () => {
        expect(isSupportedLanguage('fr')).toBe(false);
        expect(isSupportedLanguage('de')).toBe(false);
        expect(isSupportedLanguage('')).toBe(false);
        expect(isSupportedLanguage(123)).toBe(false);
        expect(isSupportedLanguage(null)).toBe(false);
        expect(isSupportedLanguage(undefined)).toBe(false);
      });
    });

    describe('isSupportedTool', () => {
      it('should return true for supported tools', () => {
        expect(isSupportedTool('claude')).toBe(true);
        expect(isSupportedTool('cursor')).toBe(true);
        expect(isSupportedTool('github-copilot')).toBe(true);
        expect(isSupportedTool('cline')).toBe(true);
      });

      it('should return false for unsupported tools', () => {
        expect(isSupportedTool('unknown-tool')).toBe(false);
        expect(isSupportedTool('')).toBe(false);
        expect(isSupportedTool(123)).toBe(false);
        expect(isSupportedTool(null)).toBe(false);
        expect(isSupportedTool(undefined)).toBe(false);
      });
    });

    describe('isSupportedOutputFormat', () => {
      it('should return true for supported output formats', () => {
        expect(isSupportedOutputFormat('claude')).toBe(true);
        expect(isSupportedOutputFormat('cursor')).toBe(true);
        expect(isSupportedOutputFormat('copilot')).toBe(true);
        expect(isSupportedOutputFormat('windsurf')).toBe(true);
      });

      it('should return false for unsupported output formats', () => {
        expect(isSupportedOutputFormat('unknown-format')).toBe(false);
        expect(isSupportedOutputFormat('')).toBe(false);
        expect(isSupportedOutputFormat(123)).toBe(false);
        expect(isSupportedOutputFormat(null)).toBe(false);
        expect(isSupportedOutputFormat(undefined)).toBe(false);
      });
    });

    describe('isSupportedConflictResolution', () => {
      it('should return true for supported conflict resolution strategies', () => {
        expect(isSupportedConflictResolution('backup')).toBe(true);
        expect(isSupportedConflictResolution('merge')).toBe(true);
        expect(isSupportedConflictResolution('skip')).toBe(true);
        expect(isSupportedConflictResolution('overwrite')).toBe(true);
      });

      it('should return false for unsupported strategies', () => {
        expect(isSupportedConflictResolution('unknown-strategy')).toBe(false);
        expect(isSupportedConflictResolution('')).toBe(false);
        expect(isSupportedConflictResolution(123)).toBe(false);
        expect(isSupportedConflictResolution(null)).toBe(false);
        expect(isSupportedConflictResolution(undefined)).toBe(false);
      });
    });

    describe('isValidProjectName', () => {
      it('should return true for valid project names', () => {
        expect(isValidProjectName('my-project')).toBe(true);
        expect(isValidProjectName('project123')).toBe(true);
        expect(isValidProjectName('project_name')).toBe(true);
        expect(isValidProjectName('project.name')).toBe(true);
      });

      it('should return false for invalid project names', () => {
        expect(isValidProjectName('')).toBe(false);
        expect(isValidProjectName('   ')).toBe(false);
        expect(isValidProjectName('project<name')).toBe(false);
        expect(isValidProjectName('project>name')).toBe(false);
        expect(isValidProjectName('project|name')).toBe(false);
        expect(isValidProjectName(123)).toBe(false);
        expect(isValidProjectName(null)).toBe(false);
        expect(isValidProjectName(undefined)).toBe(false);
      });
    });

    describe('isValidOutputPath', () => {
      it('should return true for valid output paths', () => {
        expect(isValidOutputPath('/valid/path')).toBe(true);
        expect(isValidOutputPath('./relative/path')).toBe(true);
        expect(isValidOutputPath('simple-path')).toBe(true);
        expect(isValidOutputPath('/path with spaces')).toBe(true);
      });

      it('should return false for invalid output paths', () => {
        expect(isValidOutputPath('')).toBe(false);
        expect(isValidOutputPath('   ')).toBe(false);
        expect(isValidOutputPath('path\x00with-null')).toBe(false);
        expect(isValidOutputPath(123)).toBe(false);
        expect(isValidOutputPath(null)).toBe(false);
        expect(isValidOutputPath(undefined)).toBe(false);
      });
    });

    describe('validateCliOptions', () => {
      const currentWorkingDir = '/test/directory';

      it('should validate and return valid options for correct input', () => {
        const rawOptions: RawInitOptions = {
          output: '/valid/path',
          projectName: 'valid-project',
          tool: 'claude',
          lang: 'ja',
          outputFormat: 'claude',
          force: false,
          preview: false,
          conflictResolution: 'backup',
          interactive: true,
          backup: true
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(true);
        expect(hasValidatedOptions(result)).toBe(true);
        if (hasValidatedOptions(result)) {
          expect(result.validatedOptions.projectName).toBe('valid-project');
          expect(result.validatedOptions.tool).toBe('claude');
          expect(result.validatedOptions.lang).toBe('ja');
        }
      });

      it('should use defaults for undefined values', () => {
        const rawOptions: RawInitOptions = {};

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(true);
        if (hasValidatedOptions(result)) {
          expect(result.validatedOptions.output).toBe(currentWorkingDir);
          expect(result.validatedOptions.projectName).toBe('my-project');
          expect(result.validatedOptions.tool).toBe('claude');
          expect(result.validatedOptions.lang).toBe('ja');
          expect(result.validatedOptions.outputFormat).toBe('claude');
          expect(result.validatedOptions.force).toBe(false);
          expect(result.validatedOptions.conflictResolution).toBe('backup');
        }
      });

      it('should return validation errors for invalid project name', () => {
        const rawOptions: RawInitOptions = {
          projectName: 'invalid<project>name'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const projectNameError = result.errors.find(e => e.field === 'projectName');
        expect(projectNameError).toBeDefined();
        expect(projectNameError?.message).toContain('Invalid project name');
      });

      it('should return validation errors for invalid tool', () => {
        const rawOptions: RawInitOptions = {
          tool: 'invalid-tool'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const toolError = result.errors.find(e => e.field === 'tool');
        expect(toolError).toBeDefined();
        expect(toolError?.message).toContain('Unsupported tool');
      });

      it('should return validation errors for invalid language', () => {
        const rawOptions: RawInitOptions = {
          lang: 'invalid-lang'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const langError = result.errors.find(e => e.field === 'lang');
        expect(langError).toBeDefined();
        expect(langError?.message).toContain('Unsupported language');
      });

      it('should return validation errors for invalid output format', () => {
        const rawOptions: RawInitOptions = {
          outputFormat: 'invalid-format'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const outputFormatError = result.errors.find(e => e.field === 'outputFormat');
        expect(outputFormatError).toBeDefined();
        expect(outputFormatError?.message).toContain('Unsupported output format');
      });

      it('should return validation errors for invalid conflict resolution', () => {
        const rawOptions: RawInitOptions = {
          conflictResolution: 'invalid-strategy'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const conflictResolutionError = result.errors.find(e => e.field === 'conflictResolution');
        expect(conflictResolutionError).toBeDefined();
        expect(conflictResolutionError?.message).toContain('Unsupported conflict resolution strategy');
      });

      it('should return multiple validation errors for multiple invalid fields', () => {
        const rawOptions: RawInitOptions = {
          projectName: 'invalid<name',
          tool: 'invalid-tool',
          lang: 'invalid-lang'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors.map(e => e.field)).toEqual(
          expect.arrayContaining(['projectName', 'tool', 'lang'])
        );
      });

      it('should handle edge cases for output path validation', () => {
        const rawOptions: RawInitOptions = {
          output: 'path\x00with-null'
        };

        const result = validateCliOptions(rawOptions, currentWorkingDir);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const outputError = result.errors.find(e => e.field === 'output');
        expect(outputError).toBeDefined();
        expect(outputError?.message).toContain('Invalid output directory path');
      });
    });

    describe('hasValidatedOptions', () => {
      it('should return true for valid results with validated options', () => {
        const validResult = {
          isValid: true,
          errors: [],
          validatedOptions: {
            output: '/test',
            projectName: 'test',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tool: 'claude' as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lang: 'ja' as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            outputFormat: 'claude' as any,
            force: false,
            preview: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            conflictResolution: 'backup' as any,
            interactive: true,
            backup: true
          }
        };

        expect(hasValidatedOptions(validResult)).toBe(true);
      });

      it('should return false for invalid results', () => {
        const invalidResult = {
          isValid: false,
          errors: [{ field: 'test', message: 'error' }]
        };

        expect(hasValidatedOptions(invalidResult)).toBe(false);
      });

      it('should return false for results without validated options', () => {
        const resultWithoutOptions = {
          isValid: true,
          errors: []
        };

        expect(hasValidatedOptions(resultWithoutOptions)).toBe(false);
      });
    });
  });
});