/**
 * Project Type Detector
 * Pure functions for detecting project type and primary language
 */

import { join } from 'path';
import { fileExists, readJsonFile, FileError } from './file-system-utils';
import { ProjectType } from '../types';

/**
 * Package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Result of project type detection
 */
export interface ProjectTypeResult {
  projectType: ProjectType;
  primaryLanguage: string;
  packageManager?: string;
  errors: FileError[];
}

/**
 * Detect the primary project type and language
 */
export async function detectProjectType(projectPath: string): Promise<ProjectTypeResult> {
  const errors: FileError[] = [];

  // Check for Node.js project
  const nodeResult = await detectNodejsProject(projectPath);
  if (nodeResult) {
    return {
      ...nodeResult,
      errors: errors.concat(nodeResult.errors)
    };
  }

  // Check for Python project
  if (await detectPythonProject(projectPath)) {
    return {
      projectType: 'python' as ProjectType,
      primaryLanguage: 'python',
      errors
    };
  }

  // Check for Rust project
  if (await fileExists(join(projectPath, 'Cargo.toml'))) {
    return {
      projectType: 'rust' as ProjectType,
      primaryLanguage: 'rust',
      errors
    };
  }

  // Check for Go project
  if (await fileExists(join(projectPath, 'go.mod'))) {
    return {
      projectType: 'go' as ProjectType,
      primaryLanguage: 'go',
      errors
    };
  }

  // Default to unknown
  return {
    projectType: 'unknown' as ProjectType,
    primaryLanguage: 'unknown',
    errors
  };
}

/**
 * Detect Node.js project characteristics
 */
async function detectNodejsProject(projectPath: string): Promise<ProjectTypeResult | null> {
  const packageJsonPath = join(projectPath, 'package.json');
  
  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const result = await readJsonFile<PackageJson>(packageJsonPath);
  const packageJson = result.data;

  // Handle broken package.json files
  if (!packageJson && result.errors.length > 0) {
    return handleBrokenPackageJson(projectPath, result.errors);
  }

  if (!packageJson) {
    return null;
  }

  return buildNodejsResult(projectPath, packageJson, result.errors);
}

/**
 * Handle broken package.json files
 */
async function handleBrokenPackageJson(
  projectPath: string,
  errors: FileError[]
): Promise<ProjectTypeResult | null> {
  const errorTypes = errors.map(e => e.error);
  const knownJsonErrors = [
    'Empty JSON file',
    'Invalid JSON format',
    'JSON file too large (>5MB)',
    'Null bytes detected in JSON'
  ];
  
  if (errorTypes.some(error => knownJsonErrors.includes(error))) {
    const packageManager = await detectPackageManager(projectPath);
    
    return {
      projectType: 'nodejs' as ProjectType,
      primaryLanguage: 'javascript',
      ...(packageManager && { packageManager }),
      errors
    };
  }
  
  return null;
}

/**
 * Build Node.js project result
 */
async function buildNodejsResult(
  projectPath: string,
  packageJson: PackageJson,
  errors: FileError[]
): Promise<ProjectTypeResult> {
  const packageManager = await detectPackageManager(projectPath);
  const hasTypeScript = Boolean(
    packageJson.devDependencies?.typescript || 
    packageJson.dependencies?.typescript
  );

  return {
    projectType: 'nodejs' as ProjectType,
    primaryLanguage: hasTypeScript ? 'typescript' : 'javascript',
    ...(packageManager && { packageManager }),
    errors
  };
}

/**
 * Detect Python project
 */
async function detectPythonProject(projectPath: string): Promise<boolean> {
  const pythonFiles = [
    'requirements.txt',
    'pyproject.toml',
    'setup.py'
  ];

  for (const file of pythonFiles) {
    if (await fileExists(join(projectPath, file))) {
      return true;
    }
  }

  return false;
}

/**
 * Detect package manager for Node.js projects
 */
async function detectPackageManager(projectPath: string): Promise<string | undefined> {
  const lockFiles = [
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'package-lock.json', manager: 'npm' }
  ];

  for (const { file, manager } of lockFiles) {
    if (await fileExists(join(projectPath, file))) {
      return manager;
    }
  }

  return undefined;
}