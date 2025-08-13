/**
 * Tool Detector
 * Detects development tools (build, linting, testing)
 */

import { join } from 'path';
import { ProjectContext } from '../types';
import { FileSystemHelper } from './file-system-helper';

/**
 * ToolDetector class
 * Responsible for detecting development tools
 */
export class ToolDetector {
  private projectPath: string;
  private context: Partial<ProjectContext>;
  private fileHelper: FileSystemHelper;

  constructor(projectPath: string, context: Partial<ProjectContext>) {
    this.projectPath = projectPath;
    this.context = context;
    this.fileHelper = new FileSystemHelper(context);
  }

  /**
   * Detect development tools (build, linting, testing)
   */
  async detectDevelopmentTools(): Promise<void> {
    const buildTools: string[] = [];
    const lintingTools: string[] = [];
    const testingTools: string[] = [];

    // For Node.js/TypeScript projects
    if (this.context.projectType === 'nodejs') {
      await this.detectNodeTools(buildTools, lintingTools, testingTools);
    }

    // For Python projects
    if (this.context.projectType === 'python') {
      await this.detectPythonTools(lintingTools, testingTools);
    }

    this.context.buildTools = buildTools;
    this.context.lintingTools = lintingTools;
    this.context.testingTools = testingTools;
  }

  /**
   * Generic tool detection from dependencies
   */
  private detectToolsFromDeps(
    deps: Record<string, unknown>,
    toolMap: Record<string, string>,
    toolList: string[]
  ): void {
    for (const [dep, tool] of Object.entries(toolMap)) {
      if (deps[dep] && !toolList.includes(tool)) {
        toolList.push(tool);
      }
    }
  }

  /**
   * Detect Node.js development tools
   */
  private async detectNodeTools(
    buildTools: string[],
    lintingTools: string[],
    testingTools: string[]
  ): Promise<void> {
    try {
      const packageJsonPath = join(this.projectPath, 'package.json');
      const packageJson = await this.fileHelper.readJsonFile(packageJsonPath);
      if (!packageJson) return;
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Build tools
      this.detectBuildTools(allDeps, buildTools);
      
      // Also check scripts for build tools
      if (packageJson.scripts) {
        this.detectBuildToolsFromScripts(packageJson.scripts, buildTools);
      }

      // Linting tools
      this.detectLintingTools(allDeps, lintingTools);

      // Testing tools
      this.detectTestingTools(allDeps, testingTools);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Detect build tools from dependencies
   */
  private detectBuildTools(deps: Record<string, unknown>, buildTools: string[]): void {
    const buildToolMap: Record<string, string> = {
      webpack: 'webpack',
      vite: 'vite',
      rollup: 'rollup',
      parcel: 'parcel',
      esbuild: 'esbuild',
      typescript: 'typescript',
      '@swc/core': 'swc',
      babel: 'babel',
      '@babel/core': 'babel'
    };

    this.detectToolsFromDeps(deps, buildToolMap, buildTools);
  }

  /**
   * Detect build tools from scripts
   */
  private detectBuildToolsFromScripts(scripts: Record<string, string>, buildTools: string[]): void {
    const scriptsStr = JSON.stringify(scripts);
    const scriptTools = [
      { pattern: 'webpack', tool: 'webpack' },
      { pattern: 'vite', tool: 'vite' },
      { pattern: 'rollup', tool: 'rollup' }
    ];

    for (const { pattern, tool } of scriptTools) {
      if (scriptsStr.includes(pattern) && !buildTools.includes(tool)) {
        buildTools.push(tool);
      }
    }
  }

  /**
   * Detect linting tools from dependencies
   */
  private detectLintingTools(deps: Record<string, unknown>, lintingTools: string[]): void {
    const lintToolMap: Record<string, string> = {
      eslint: 'eslint',
      prettier: 'prettier',
      tslint: 'tslint',
      stylelint: 'stylelint',
      '@typescript-eslint/parser': 'typescript-eslint'
    };

    this.detectToolsFromDeps(deps, lintToolMap, lintingTools);
  }

  /**
   * Detect testing tools from dependencies
   */
  private detectTestingTools(deps: Record<string, unknown>, testingTools: string[]): void {
    const testToolMap: Record<string, string> = {
      jest: 'jest',
      mocha: 'mocha',
      chai: 'chai',
      jasmine: 'jasmine',
      vitest: 'vitest',
      '@testing-library/react': 'testing-library',
      cypress: 'cypress',
      playwright: 'playwright',
      puppeteer: 'puppeteer'
    };

    this.detectToolsFromDeps(deps, testToolMap, testingTools);
  }

  /**
   * Detect Python development tools
   */
  private async detectPythonTools(
    lintingTools: string[],
    testingTools: string[]
  ): Promise<void> {
    const requirementsPath = join(this.projectPath, 'requirements.txt');
    
    try {
      if (await this.fileHelper.fileExists(requirementsPath)) {
        const requirements = await this.fileHelper.readTextFile(requirementsPath);
        if (requirements) {
          // Testing tools
          const pythonTestTools = ['pytest', 'unittest', 'nose'];
          for (const tool of pythonTestTools) {
            if (requirements.includes(tool)) {
              testingTools.push(tool);
            }
          }
          
          // Linting tools
          const pythonLintTools = ['pylint', 'flake8', 'black', 'mypy'];
          for (const tool of pythonLintTools) {
            if (requirements.includes(tool)) {
              lintingTools.push(tool);
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }
}