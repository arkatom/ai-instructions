/**
 * Unified Context Analyzer Tests
 * Testing path traversal prevention, JSON error handling, and core functionality
 * Using project-relative test directories to maintain security
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import * as fs from 'fs';
import { ContextAnalyzer } from '../../src/agents/context-analyzer';
import { SecurityError } from '../../src/errors/custom-errors';

// Test utilities
async function createTestDir(name: string): Promise<string> {
  const testDir = `./test-temp-${name}`;
  await mkdir(testDir, { recursive: true });
  return testDir;
}

async function cleanupTestDir(testDir: string): Promise<void> {
  await rm(testDir, { recursive: true, force: true });
}

describe('ContextAnalyzer - Path Traversal Prevention', () => {
  test('should reject path traversal attempts with ../', () => {
    expect(() => new ContextAnalyzer('../../etc/passwd')).toThrow(SecurityError);
  });

  test('should reject absolute paths outside project', () => {
    expect(() => new ContextAnalyzer('/etc/passwd')).toThrow(SecurityError);
  });

  test.skip('should reject symbolic link attempts', () => {
    const linkPath = './test-symlink';
    
    const originalLstatSync = Object.getOwnPropertyDescriptor(fs, 'lstatSync');
    const originalExistsSync = Object.getOwnPropertyDescriptor(fs, 'existsSync');
    
    Object.defineProperty(fs, 'existsSync', {
      value: jest.fn().mockReturnValue(true),
      configurable: true
    });
    
    Object.defineProperty(fs, 'lstatSync', {
      value: jest.fn().mockReturnValue({ isSymbolicLink: () => true }),
      configurable: true
    });
    
    expect(() => new ContextAnalyzer(linkPath)).toThrow(SecurityError);
    
    if (originalLstatSync) Object.defineProperty(fs, 'lstatSync', originalLstatSync);
    if (originalExistsSync) Object.defineProperty(fs, 'existsSync', originalExistsSync);
  });

  test('should accept valid relative paths within project', () => {
    expect(() => new ContextAnalyzer('./src')).not.toThrow();
  });
});

describe('ContextAnalyzer - JSON Parse Error Handling (Basic)', () => {
  let testDir: string;
  let analyzer: ContextAnalyzer;

  beforeEach(async () => {
    testDir = await createTestDir('json-security');
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  test('should handle malformed JSON in package.json', async () => {
    await writeFile(join(testDir, 'package.json'), '{ invalid json }');
    analyzer = new ContextAnalyzer(testDir);
    
    const context = await analyzer.analyzeProject();
    
    expect(context.projectType).toBe('nodejs');
    expect(context.errors).toContainEqual({
      file: 'package.json',
      error: 'Invalid JSON format'
    });
  });

  test('should handle empty JSON files', async () => {
    await writeFile(join(testDir, 'package.json'), '');
    analyzer = new ContextAnalyzer(testDir);
    
    const context = await analyzer.analyzeProject();
    
    expect(context.projectType).toBe('nodejs');
    expect(context.errors).toContainEqual({
      file: 'package.json',
      error: 'Empty JSON file'
    });
  });
});

describe('ContextAnalyzer - JSON Parse Error Handling (Advanced)', () => {
  let testDir: string;
  let analyzer: ContextAnalyzer;

  beforeEach(async () => {
    testDir = await createTestDir('json-security-2');
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  test('should handle JSON with null bytes', async () => {
    const nullByteContent = '{"test": "value' + String.fromCharCode(0) + '"}';
    await writeFile(join(testDir, 'package.json'), nullByteContent);
    analyzer = new ContextAnalyzer(testDir);
    
    const context = await analyzer.analyzeProject();
    
    expect(context.errors).toBeDefined();
    expect(context.errors).toContainEqual({
      file: 'package.json',
      error: 'Null bytes detected in JSON'
    });
  });

  test('should handle extremely large JSON files', async () => {
    const largeContent = '{"data": "' + 'x'.repeat(6 * 1024 * 1024) + '"}';
    await writeFile(join(testDir, 'package.json'), largeContent);
    analyzer = new ContextAnalyzer(testDir);
    
    const context = await analyzer.analyzeProject();
    
    expect(context.errors).toContainEqual({
      file: 'package.json',
      error: 'JSON file too large (>5MB)'
    });
  });

  test('should continue analysis with JSON errors', async () => {
    await writeFile(join(testDir, 'package.json'), '{ bad json }');
    await writeFile(join(testDir, 'requirements.txt'), 'django==4.2.0\npytest==7.0.0');
    
    analyzer = new ContextAnalyzer(testDir);
    const context = await analyzer.analyzeProject();
    
    expect(context.errors).toBeDefined();
    expect(context.errors?.length).toBeGreaterThan(0);
    expect(context.errors).toContainEqual({
      file: 'package.json',
      error: 'Invalid JSON format'
    });
    expect(context.projectType).toBe('nodejs');
    expect(context.developmentPhase).toBeDefined();
  });
});

describe('ContextAnalyzer - Core Functionality', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir('functionality');
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  test('should detect Node.js project with TypeScript', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      devDependencies: { typescript: '^4.0.0', '@types/node': '^16.0.0' },
      dependencies: { react: '^18.0.0' }
    }));
    await writeFile(join(testDir, 'package-lock.json'), '{}');

    const analyzer = new ContextAnalyzer(testDir);
    const context = await analyzer.analyzeProject();

    expect(context.projectType).toBe('nodejs');
    expect(context.primaryLanguage).toBe('typescript');
    expect(context.packageManager).toBe('npm');
    expect(context.frameworks).toContain('react');
    expect(context.buildTools).toContain('typescript');
  });

  test('should detect Python project with Django', async () => {
    await writeFile(join(testDir, 'requirements.txt'), 'django==4.2.0\npytest==7.0.0');
    await writeFile(join(testDir, 'manage.py'), '# Django manage.py');

    const analyzer = new ContextAnalyzer(testDir);
    const context = await analyzer.analyzeProject();

    expect(context.projectType).toBe('python');
    expect(context.primaryLanguage).toBe('python');
    expect(context.frameworks).toContain('django');
    expect(context.testingTools).toContain('pytest');
  });

  test('should handle unknown project type gracefully', async () => {
    const analyzer = new ContextAnalyzer(testDir);
    const context = await analyzer.analyzeProject();

    expect(context.projectType).toBe('unknown');
    expect(context.primaryLanguage).toBe('unknown');
    expect(context.frameworks).toEqual([]);
    expect(context.developmentPhase).toBe('initial-setup');
  });
});

describe('ContextAnalyzer - Development Phase Detection', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir('phase');
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  test('should detect testing phase correctly', async () => {
    await mkdir(join(testDir, 'src'), { recursive: true });
    await writeFile(join(testDir, 'src', 'index.js'), 'console.log("hello");');
    await mkdir(join(testDir, 'test'), { recursive: true });
    await writeFile(join(testDir, 'test', 'index.test.js'), 'test("hello", () => {});');
    await mkdir(join(testDir, '.github', 'workflows'), { recursive: true });
    await writeFile(join(testDir, '.github', 'workflows', 'ci.yml'), 'name: CI');

    const analyzer = new ContextAnalyzer(testDir);
    const context = await analyzer.analyzeProject();

    expect(context.hasTests).toBe(true);
    expect(context.hasCI).toBe(true);
    expect(context.developmentPhase).toBe('testing-phase');
  });
});

describe('ContextAnalyzer - Pure Function Architecture', () => {
  test('should not maintain state between analyses', async () => {
    const testDir1 = await createTestDir('pure1');
    const testDir2 = await createTestDir('pure2');

    try {
      await writeFile(join(testDir1, 'package.json'), '{"name": "test1"}');
      await writeFile(join(testDir2, 'requirements.txt'), 'flask==2.0.0');

      const analyzer1 = new ContextAnalyzer(testDir1);
      const analyzer2 = new ContextAnalyzer(testDir2);
      const context1 = await analyzer1.analyzeProject();
      const context2 = await analyzer2.analyzeProject();

      expect(context1.projectType).toBe('nodejs');
      expect(context2.projectType).toBe('python');
      expect(context1.frameworks).not.toContain('flask');
      expect(context2.frameworks).toContain('flask');
    } finally {
      await cleanupTestDir(testDir1);
      await cleanupTestDir(testDir2);
    }
  });
});