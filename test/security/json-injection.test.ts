/**
 * Security test suite for JSON injection vulnerabilities
 * Tests that prevent malicious JSON from executing code or corrupting data
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { JsonValidator } from '../../src/utils/security';

describe('JSON Injection Security Tests', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(__dirname, '../test-security-json');
    
    // Ensure clean test environment
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Malicious JSON content protection', () => {
    test('should reject JSON with prototype pollution attempt', () => {
      const maliciousJson = JSON.stringify({
        name: 'Claude Tool',
        description: 'AI Tool',
        __proto__: {
          isAdmin: true,
          executeCommand: "() => { require('child_process').exec('rm -rf /'); }"
        },
        constructor: {
          prototype: {
            isAdmin: true
          }
        }
      });
      
      expect(() => {
        JsonValidator.secureJsonParse(maliciousJson);
      }).toThrow(/Dangerous JSON content detected/);
    });

    test('should reject JSON with function constructors', () => {
      const maliciousJson = `{
        "name": "Evil Tool",
        "description": "Tool with function",
        "maliciousCode": "function() { return require('fs').readFileSync('/etc/passwd'); }"
      }`;
      
      expect(() => {
        JsonValidator.secureJsonParse(maliciousJson);
      }).toThrow(/Dangerous JSON content detected/);
    });

    test('should reject JSON with eval-like content', () => {
      const maliciousJson = JSON.stringify({
        name: 'Eval Tool',
        description: 'Tool with eval',
        maliciousEval: 'eval("console.log(process.env)")',
        code: '${process.env.SECRET}'
      });
      
      expect(() => {
        JsonValidator.secureJsonParse(maliciousJson);
      }).toThrow(/Dangerous JSON content detected/);
    });

    test('should reject JSON with require/import statements', () => {
      const maliciousJson = JSON.stringify({
        name: 'Import Tool',
        description: 'Tool with imports',
        command: 'require("child_process").spawn("ls", ["-la"])',
        imports: 'import { exec } from "child_process"'
      });
      
      expect(() => {
        JsonValidator.secureJsonParse(maliciousJson);
      }).toThrow(/Dangerous JSON content detected/);
    });

    test('should reject JSON with Unicode-encoded dangerous patterns', () => {
      const unicodeAttacks = [
        // Unicode-encoded __proto__
        JSON.stringify({
          name: 'Unicode Tool',
          '\\u005f\\u005f\\u0070\\u0072\\u006f\\u0074\\u006f\\u005f\\u005f': {
            isAdmin: true
          }
        }),
        // Unicode-encoded constructor
        JSON.stringify({
          name: 'Unicode Tool',
          '\\u0063\\u006f\\u006e\\u0073\\u0074\\u0072\\u0075\\u0063\\u0074\\u006f\\u0072': {
            prototype: { isAdmin: true }
          }
        }),
        // Unicode-encoded eval patterns
        JSON.stringify({
          name: 'Unicode Tool',
          code: '\\u0065\\u0076\\u0061\\u006c("malicious code")'
        })
      ];
      
      for (const maliciousJson of unicodeAttacks) {
        expect(() => {
          JsonValidator.secureJsonParse(maliciousJson);
        }).toThrow(/Dangerous JSON content detected/);
      }
    });
  });

  describe('JSON security validation', () => {
    test('should accept valid, clean JSON configuration', () => {
      const validJson = `{
        "name": "Valid Tool",
        "description": "A clean, safe tool configuration",
        "version": "1.0.0",
        "files": ["CLAUDE.md", "instructions/base.md"]
      }`;
      
      expect(() => {
        const config = JsonValidator.secureJsonParse(validJson);
        expect(config).toHaveProperty('name', 'Valid Tool');
        expect(config).toHaveProperty('description', 'A clean, safe tool configuration');
      }).not.toThrow();
    });
  });

  describe('JSON parsing limits', () => {
    test('should reject extremely large JSON files', () => {
      // Create a JSON with extremely large content to test DoS protection
      const largeArray = new Array(100000).fill('a'.repeat(1000));
      const largeJson = JSON.stringify({
        name: 'Large Tool',
        description: 'Tool with large data',
        data: largeArray
      });
      
      expect(() => {
        JsonValidator.secureJsonParse(largeJson);
      }).toThrow(/Configuration file too large/);
    });

    test('should reject deeply nested JSON objects', () => {
      // Create deeply nested object to prevent stack overflow
      let deepObject: any = { name: 'Deep Tool' };
      for (let i = 0; i < 100; i++) { // Reduced for test performance
        deepObject = { nested: deepObject };
      }
      
      const deepJson = JSON.stringify(deepObject);
      
      expect(() => {
        JsonValidator.secureJsonParse(deepJson);
      }).toThrow(/JSON structure too deeply nested/);
    });
  });

  describe('Malformed JSON handling', () => {
    test('should handle syntax errors gracefully', () => {
      const malformedJson = '{ name: "Missing Quotes", description: }';
      
      expect(() => {
        JsonValidator.secureJsonParse(malformedJson);
      }).toThrow(/Invalid JSON syntax/);
    });

    test('should reject JSON with comments (potential injection vector)', () => {
      const jsonWithComments = `{
        "name": "Commented Tool",
        // This comment could hide malicious code
        "description": "Tool with comments"
      }`;
      
      expect(() => {
        JsonValidator.secureJsonParse(jsonWithComments);
      }).toThrow(/Dangerous JSON content detected/);
    });
  });
});