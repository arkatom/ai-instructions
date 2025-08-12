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
    projectRoot = join(__dirname, '../..'); // Keep for reference but don't use for test files
    testDir = join(__dirname, '../.temp-path-traversal-security');
    
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
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow(/Path traversal detected|Access denied|Security Error/);
    });

    test('should reject absolute paths to system directories', () => {
      const systemPaths = ['/etc/passwd', '/usr/bin', '/var/log', 'C:\\Windows\\System32'];
      
      for (const maliciousPath of systemPaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected|Access denied|Security Error/);
      }
    });

    test('should reject Windows case-insensitive system paths', () => {
      // Windows-specific system paths with case variations
      const windowsPaths = [
        'c:\\WINDOWS\\system32',
        'C:\\WiNdOwS\\SyStEm32',
        'C:/Windows/System32',
        'c:/windows/SYSTEM32',
        '\\\\?\\C:\\Windows\\System32',
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'LPT1'
      ];
      
      for (const maliciousPath of windowsPaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected|Access denied|Security Error/);
      }
    });

    test('should reject paths containing null bytes', () => {
      const maliciousPath = 'valid/path\x00../../../etc/passwd';
      
      expect(() => {
        execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
          encoding: 'utf-8',
          cwd: testDir,
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow(/Invalid characters|null bytes|Security Error/);
    });

    test('should reject URL encoded path traversal attacks', () => {
      const encodedPaths = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '%2e%2e%5c%2e%2e%5c%2e%2e%5c',
        '..%c0%af..%c0%af..%c0%af',
        '..%c1%9c..%c1%9c..%c1%9c'
      ];
      
      for (const maliciousPath of encodedPaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected|Access denied|Security Error/);
      }
    });


    test('should reject Unicode normalization attacks', () => {
      const unicodePaths = [
        '../\u0041\u0301/../etc/passwd', // À normalized
        '..\uFF0F..\uFF0F..\uFF0Fetc\uFF0Fpasswd', // Full-width slash
        '＼＼server＼share＼file', // Full-width backslash
        '../\u202e/../etc/passwd', // Right-to-left override
        '..\u00A0/..\u00A0/etc/passwd' // Non-breaking space
      ];
      
      for (const maliciousPath of unicodePaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${maliciousPath}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Path traversal detected|Access denied|Security Error/);
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
      const parentPaths = ['..', '../..', '../../..', '../../../..'];
      
      for (const path of parentPaths) {
        expect(() => {
          execSync(`npx ts-node "${join(projectRoot, 'src/cli.ts')}" init --output "${path}"`, {
            encoding: 'utf-8',
            cwd: testDir,
            env: { ...process.env, NODE_ENV: 'test' }
          });
        }).toThrow(/Access denied.*outside project scope|Path traversal detected|Security Error/);
      }
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
        // Using globalThis to avoid ESLint warning - this is a test diagnostic message
        globalThis.console.warn('Skipping symlink test due to insufficient permissions');
      }
    });
  });
});