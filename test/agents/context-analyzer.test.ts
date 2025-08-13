/**
 * TDD Test Suite - Intelligent Agent Recommendation System
 * Phase 1: Context Analyzer
 * 
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 * Tests for project context analysis and detection
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { ContextAnalyzer } from '../../src/agents/context-analyzer';
// Types are imported in the implementation file

describe('Context Analyzer', () => {
  let tempDir: string;
  let analyzer: ContextAnalyzer;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'context-analyzer-test-'));
    analyzer = new ContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Project Type Detection', () => {
    test('should detect Node.js project from package.json', async () => {
      // ARRANGE
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('nodejs');
      expect(context.primaryLanguage).toBe('javascript');
    });

    test('should detect TypeScript project from tsconfig.json', async () => {
      // ARRANGE
      const packageJson = {
        name: 'ts-project',
        devDependencies: {
          typescript: '^5.0.0'
        }
      };
      const tsConfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await writeFile(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('nodejs');
      expect(context.primaryLanguage).toBe('typescript');
    });

    test('should detect Python project from requirements.txt', async () => {
      // ARRANGE
      const requirements = `
django==4.2.0
pytest==7.3.0
black==23.3.0
`;
      await writeFile(join(tempDir, 'requirements.txt'), requirements);

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('python');
      expect(context.primaryLanguage).toBe('python');
    });

    test('should detect Rust project from Cargo.toml', async () => {
      // ARRANGE
      const cargoToml = `
[package]
name = "rust-project"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
`;
      await writeFile(join(tempDir, 'Cargo.toml'), cargoToml);

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('rust');
      expect(context.primaryLanguage).toBe('rust');
    });

    test('should detect Go project from go.mod', async () => {
      // ARRANGE
      const goMod = `
module github.com/user/project

go 1.20

require (
    github.com/gin-gonic/gin v1.9.0
)
`;
      await writeFile(join(tempDir, 'go.mod'), goMod);

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('go');
      expect(context.primaryLanguage).toBe('go');
    });
  });

  describe('Framework Detection', () => {
    test('should detect React framework', async () => {
      // ARRANGE
      const packageJson = {
        name: 'react-app',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.frameworks).toContain('react');
      expect(context.projectCategory).toBe('frontend');
    });

    test('should detect Vue framework', async () => {
      // ARRANGE
      const packageJson = {
        name: 'vue-app',
        dependencies: {
          vue: '^3.3.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.frameworks).toContain('vue');
      expect(context.projectCategory).toBe('frontend');
    });

    test('should detect Express framework', async () => {
      // ARRANGE
      const packageJson = {
        name: 'express-api',
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.frameworks).toContain('express');
      expect(context.projectCategory).toBe('backend');
    });

    test('should detect Django framework', async () => {
      // ARRANGE
      const requirements = `
django==4.2.0
djangorestframework==3.14.0
`;
      await writeFile(join(tempDir, 'requirements.txt'), requirements);

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.frameworks).toContain('django');
      expect(context.projectCategory).toBe('backend');
    });

    test('should detect multiple frameworks', async () => {
      // ARRANGE
      const packageJson = {
        name: 'fullstack-app',
        dependencies: {
          react: '^18.2.0',
          express: '^4.18.0',
          'next': '^13.4.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.frameworks).toContain('react');
      expect(context.frameworks).toContain('express');
      expect(context.frameworks).toContain('nextjs');
      expect(context.projectCategory).toBe('fullstack');
    });
  });

  describe('Development Phase Detection', () => {
    test('should detect initial setup phase', async () => {
      // ARRANGE - Minimal package.json, no node_modules
      const packageJson = {
        name: 'new-project',
        version: '0.0.1',
        dependencies: {}
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.developmentPhase).toBe('initial-setup');
    });

    test('should detect active development phase', async () => {
      // ARRANGE
      const packageJson = {
        name: 'active-project',
        version: '0.3.0',
        dependencies: {
          react: '^18.2.0'
        },
        devDependencies: {
          jest: '^29.5.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src', 'index.js'), '// Source code');

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.developmentPhase).toBe('active-development');
    });

    test('should detect testing phase', async () => {
      // ARRANGE
      const packageJson = {
        name: 'tested-project',
        version: '0.9.0',
        scripts: {
          test: 'jest'
        },
        devDependencies: {
          jest: '^29.5.0',
          '@testing-library/react': '^14.0.0'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await mkdir(join(tempDir, 'test'), { recursive: true });
      await mkdir(join(tempDir, '__tests__'), { recursive: true });

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.developmentPhase).toBe('testing-phase');
    });

    test('should detect production maintenance phase', async () => {
      // ARRANGE
      const packageJson = {
        name: 'production-app',
        version: '2.1.3',
        scripts: {
          start: 'node dist/server.js',
          build: 'webpack --mode production'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await mkdir(join(tempDir, 'dist'), { recursive: true });
      await writeFile(join(tempDir, '.env.production'), 'NODE_ENV=production');

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.developmentPhase).toBe('production-maintenance');
    });
  });

  describe('Comprehensive Context Analysis', () => {
    test('should provide complete project context', async () => {
      // ARRANGE - Complex project setup
      const packageJson = {
        name: 'fullstack-app',
        version: '1.2.0',
        dependencies: {
          react: '^18.2.0',
          express: '^4.18.0',
          mongoose: '^7.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.5.0',
          eslint: '^8.40.0'
        },
        scripts: {
          test: 'jest',
          lint: 'eslint .',
          build: 'tsc && webpack'
        }
      };
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await writeFile(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: {} })
      );
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'test'), { recursive: true });

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context).toMatchObject({
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: expect.arrayContaining(['react', 'express', 'mongoose']),
        projectCategory: 'fullstack',
        developmentPhase: 'testing-phase',
        testingTools: expect.arrayContaining(['jest']),
        buildTools: expect.arrayContaining(['webpack', 'typescript']),
        lintingTools: expect.arrayContaining(['eslint'])
      });
    });

    test('should handle missing or incomplete project files gracefully', async () => {
      // ARRANGE - Empty directory

      // ACT
      const context = await analyzer.analyzeProject();

      // ASSERT
      expect(context.projectType).toBe('unknown');
      expect(context.primaryLanguage).toBe('unknown');
      expect(context.frameworks).toEqual([]);
      expect(context.developmentPhase).toBe('initial-setup');
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - Tests define expected behavior for context analysis
 * - Tests will fail until ContextAnalyzer is implemented
 * 
 * GREEN PHASE (Next):
 * - Implement ContextAnalyzer class in src/agents/context-analyzer.ts
 * - Make all tests pass with minimal implementation
 * 
 * REFACTOR PHASE (After Green):
 * - Optimize detection algorithms
 * - Add caching for repeated analyses
 * - Improve error handling
 */