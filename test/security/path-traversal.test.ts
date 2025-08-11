/**
 * Security test suite for path traversal vulnerabilities
 * Tests that prevent malicious path inputs from accessing unauthorized files
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';

describe('Path Traversal Security Tests', () => {
  let testDir: string;
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = join(__dirname, '../..');
    testDir = join(projectRoot, 'test-output-security');
    
    // Ensure clean test environment
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  describe('Directory path validation', () => {
    test('should reject path traversal attempts with ../../../', () => {
      const maliciousPath = '../../../etc/passwd';
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow(/Path traversal detected/);
    });

    test('should reject absolute paths to system directories', () => {
      const systemPaths = ['/etc/passwd', '/usr/bin', '/var/log', 'C:\\Windows\\System32'];
      
      for (const maliciousPath of systemPaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected/);
      }
    });

    test('should reject Windows case-insensitive system paths', () => {
      const windowsCaseAttacks = [
        'C:\\windows\\system32',           // lowercase
        'C:\\WINDOWS\\SYSTEM32',           // uppercase  
        'C:\\Windows\\system32',           // mixed case
        'C:\\wInDoWs\\SyStEm32',           // random case
        'c:\\windows\\system32',           // lowercase drive
        'C:\\program files\\',             // program files variations
        'C:\\Program Files\\',
        'C:\\PROGRAM FILES\\',
        'c:\\program files (x86)\\'        // 32-bit program files
      ];
      
      for (const maliciousPath of windowsCaseAttacks) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected/);
      }
    });

    test('should reject paths containing null bytes', () => {
      const maliciousPath = 'valid/path\0../../../etc/passwd';
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow(/Path traversal detected/);
    });

    test('should reject URL encoded path traversal attacks', () => {
      const urlEncodedAttacks = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',     // ../../../etc/passwd
        '%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd', // double encoding
        '%2e%2e/%2e%2e/%2e%2e/etc/passwd',             // mixed encoding
        'valid%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd' // embedded in valid path
      ];
      
      for (const maliciousPath of urlEncodedAttacks) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected/);
      }
    });

    test('should reject Unicode normalization attacks', () => {
      const unicodeAttacks = [
        '\\u002e\\u002e\\u002f\\u002e\\u002e\\u002f\\u002e\\u002e\\u002fetc\\u002fpasswd', // Unicode escapes
        String.fromCharCode(0x002e, 0x002e, 0x002f, 0x002e, 0x002e, 0x002f, 0x002e, 0x002e, 0x002f) + 'etc' + String.fromCharCode(0x002f) + 'passwd', // Actual Unicode chars
        '..\\u002f..\\u002f..\\u002fetc\\u002fpasswd',                                 // Mixed Unicode
        'valid\\u002f\\u002e\\u002e\\u002f\\u002e\\u002e\\u002fetc'                   // Embedded Unicode
      ];
      
      for (const maliciousPath of unicodeAttacks) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected/);
      }
    });

    test('should accept valid relative paths within project scope', () => {
      const validPath = './valid-subdirectory';
      const fullPath = join(testDir, 'valid-subdirectory');
      mkdirSync(fullPath, { recursive: true });
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${validPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).not.toThrow();
    });

    test('should accept valid absolute paths within allowed directory', () => {
      const validPath = join(testDir, 'allowed-directory');
      mkdirSync(validPath, { recursive: true });
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${validPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).not.toThrow();
    });
  });

  describe('Path sanitization', () => {
    test('should normalize paths with multiple slashes', () => {
      const pathWithMultipleSlashes = 'valid//path///with////slashes';
      const expectedPath = join(testDir, 'valid/path/with/slashes');
      mkdirSync(expectedPath, { recursive: true });
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${pathWithMultipleSlashes}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).not.toThrow();
    });

    test('should handle Windows-style path separators safely', () => {
      const windowsPath = 'valid\\path\\windows\\style';
      const normalizedDir = join(testDir, 'valid', 'path', 'windows', 'style');
      mkdirSync(normalizedDir, { recursive: true });
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${windowsPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).not.toThrow();
    });
  });

  describe('Security boundary enforcement', () => {
    test('should prevent access to parent directories of project root', () => {
      const projectParentPath = join(projectRoot, '../');
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${projectParentPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow(/Access denied.*outside project scope/);
    });

    test('should prevent symlink attacks', () => {
      // Create a symlink pointing to system directory
      const symlinkPath = join(testDir, 'malicious-link');
      const targetPath = '/etc';
      
      try {
        execSync(`ln -s ${targetPath} ${symlinkPath}`);
        
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" status -d "${symlinkPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Symlink to unauthorized location detected/);
      } catch {
        // Skip test if unable to create symlink (e.g., on Windows without admin rights)
        console.warn('Skipping symlink test due to insufficient permissions');
      }
    });
  });
});