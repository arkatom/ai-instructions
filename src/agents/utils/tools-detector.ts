/**
 * Tools Detector
 * Pure functions for detecting development tools (build, linting, testing)
 */

import { join } from 'path';
import { fileExists, readJsonFile, readTextFile, FileError } from './file-system-utils';
import { ProjectType } from '../types';
import { PackageJson } from './project-type-detector';

/**
 * Development tools detection result
 */
export interface ToolsResult {
  buildTools: string[];
  lintingTools: string[];
  testingTools: string[];
  errors: FileError[];
}

/**
 * Detect development tools (build, linting, testing)
 */
export async function detectDevelopmentTools(
  projectPath: string,
  projectType: ProjectType
): Promise<ToolsResult> {
  const buildTools: string[] = [];
  const lintingTools: string[] = [];
  const testingTools: string[] = [];
  const errors: FileError[] = [];

  if (projectType === 'nodejs') {
    const nodeResult = await detectNodeTools(projectPath);
    buildTools.push(...nodeResult.buildTools);
    lintingTools.push(...nodeResult.lintingTools);
    testingTools.push(...nodeResult.testingTools);
    errors.push(...nodeResult.errors);
  }

  if (projectType === 'python') {
    const pythonResult = await detectPythonTools(projectPath);
    lintingTools.push(...pythonResult.lintingTools);
    testingTools.push(...pythonResult.testingTools);
  }

  return { buildTools, lintingTools, testingTools, errors };
}

/**
 * Detect Node.js development tools
 */
async function detectNodeTools(projectPath: string): Promise<ToolsResult> {
  const buildTools: string[] = [];
  const lintingTools: string[] = [];
  const testingTools: string[] = [];

  const packageJsonPath = join(projectPath, 'package.json');
  const result = await readJsonFile<PackageJson>(packageJsonPath);
  const packageJson = result.data;

  if (!packageJson) {
    return { buildTools, lintingTools, testingTools, errors: result.errors };
  }
  
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  detectBuildTools(allDeps, buildTools);
  
  if (packageJson.scripts) {
    detectBuildToolsFromScripts(packageJson.scripts, buildTools);
  }

  detectLintingTools(allDeps, lintingTools);
  detectTestingTools(allDeps, testingTools);

  return { buildTools, lintingTools, testingTools, errors: result.errors };
}

/**
 * Detect build tools from dependencies
 */
function detectBuildTools(deps: Record<string, unknown>, buildTools: string[]): void {
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

  detectToolsFromDeps(deps, buildToolMap, buildTools);
}

/**
 * Detect build tools from scripts
 */
function detectBuildToolsFromScripts(scripts: Record<string, string>, buildTools: string[]): void {
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
function detectLintingTools(deps: Record<string, unknown>, lintingTools: string[]): void {
  const lintToolMap: Record<string, string> = {
    eslint: 'eslint',
    prettier: 'prettier',
    tslint: 'tslint',
    stylelint: 'stylelint',
    '@typescript-eslint/parser': 'typescript-eslint'
  };

  detectToolsFromDeps(deps, lintToolMap, lintingTools);
}

/**
 * Detect testing tools from dependencies
 */
function detectTestingTools(deps: Record<string, unknown>, testingTools: string[]): void {
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

  detectToolsFromDeps(deps, testToolMap, testingTools);
}

/**
 * Generic tool detection from dependencies
 */
function detectToolsFromDeps(
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
 * Detect Python development tools
 */
async function detectPythonTools(
  projectPath: string
): Promise<{lintingTools: string[], testingTools: string[]}> {
  const lintingTools: string[] = [];
  const testingTools: string[] = [];

  const requirementsPath = join(projectPath, 'requirements.txt');
  
  if (await fileExists(requirementsPath)) {
    const requirements = await readTextFile(requirementsPath);
    
    if (requirements) {
      extractPythonTestTools(requirements, testingTools);
      extractPythonLintTools(requirements, lintingTools);
    }
  }

  return { lintingTools, testingTools };
}

/**
 * Extract Python testing tools from requirements
 */
function extractPythonTestTools(requirements: string, testingTools: string[]): void {
  const pythonTestTools = ['pytest', 'unittest', 'nose'];
  
  for (const tool of pythonTestTools) {
    if (requirements.includes(tool)) {
      testingTools.push(tool);
    }
  }
}

/**
 * Extract Python linting tools from requirements
 */
function extractPythonLintTools(requirements: string, lintingTools: string[]): void {
  const pythonLintTools = ['pylint', 'flake8', 'black', 'mypy'];
  
  for (const tool of pythonLintTools) {
    if (requirements.includes(tool)) {
      lintingTools.push(tool);
    }
  }
}