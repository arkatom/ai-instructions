/**
 * Framework Detector
 * Utility functions for detecting frameworks and project categories
 * Note: These functions perform filesystem I/O operations
 */

import { join } from 'path';
import { fileExists, readJsonFile, readTextFile, FileError } from './file-system-utils';
import { ProjectType } from '../types';
import { PackageJson } from './project-type-detector';

/**
 * Framework detection patterns
 */
interface FrameworkPattern {
  dependencies?: string[];
  files?: string[];
  patterns?: string[];
}

const FRAMEWORK_PATTERNS: Record<string, FrameworkPattern> = {
  react: {
    dependencies: ['react', 'react-dom'],
    files: ['src/App.tsx', 'src/App.jsx', 'src/App.js']
  },
  vue: {
    dependencies: ['vue'],
    files: ['src/App.vue', 'src/main.js']
  },
  angular: {
    dependencies: ['@angular/core'],
    files: ['angular.json', 'src/app/app.module.ts']
  },
  express: {
    dependencies: ['express'],
    patterns: ['app.js', 'server.js', 'index.js']
  },
  django: {
    files: ['manage.py', 'settings.py'],
    patterns: ['django']
  },
  flask: {
    dependencies: ['flask'],
    files: ['app.py', 'application.py']
  },
  nextjs: {
    dependencies: ['next'],
    files: ['next.config.js', 'next.config.ts', 'pages/_app.tsx']
  },
  svelte: {
    dependencies: ['svelte'],
    files: ['src/App.svelte']
  }
};

/**
 * Framework detection result
 */
export interface FrameworkResult {
  frameworks: string[];
  projectCategory?: 'frontend' | 'backend' | 'fullstack';
  errors: FileError[];
}

/**
 * Detect frameworks used in the project
 * @param projectPath - Path to the project directory
 * @param projectType - Type of the project
 * @returns Promise<FrameworkResult>
 */
export async function detectFrameworks(
  projectPath: string,
  projectType: ProjectType
): Promise<FrameworkResult> {
  const frameworks: string[] = [];
  const errors: FileError[] = [];

  // For Node.js/TypeScript projects
  if (projectType === 'nodejs') {
    const nodeResult = await detectNodeFrameworks(projectPath);
    frameworks.push(...nodeResult.frameworks);
    errors.push(...nodeResult.errors);
  }

  // For Python projects
  if (projectType === 'python') {
    const pythonFrameworks = await detectPythonFrameworks(projectPath);
    frameworks.push(...pythonFrameworks);
  }

  const projectCategory = detectProjectCategory(frameworks);

  return {
    frameworks,
    ...(projectCategory && { projectCategory }),
    errors
  };
}

/**
 * Detect Node.js frameworks
 * @param projectPath - Path to the project directory
 * @returns Promise<{frameworks: string[], errors: FileError[]}>
 */
async function detectNodeFrameworks(
  projectPath: string
): Promise<{frameworks: string[], errors: FileError[]}> {
  const frameworks: string[] = [];
  const packageJsonPath = join(projectPath, 'package.json');
  
  const result = await readJsonFile<PackageJson>(packageJsonPath);
  const packageJson = result.data;

  if (!packageJson) {
    return { frameworks, errors: result.errors };
  }
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  // Check for each framework
  detectFrameworksFromDeps(allDeps, frameworks);

  return { frameworks, errors: result.errors };
}

/**
 * Extract framework detection logic to reduce complexity
 */
function detectFrameworksFromDeps(
  allDeps: Record<string, unknown>,
  frameworks: string[]
): void {
  for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
    if (config.dependencies && hasAnyDependency(allDeps, config.dependencies)) {
      frameworks.push(framework);
    }
  }

  // Check for mongoose (for framework detection)  
  if (allDeps.mongoose && !frameworks.includes('mongoose')) {
    frameworks.push('mongoose');
  }
}

/**
 * Check if any of the required dependencies exist
 */
function hasAnyDependency(
  allDeps: Record<string, unknown>,
  requiredDeps: string[]
): boolean {
  return requiredDeps.some(dep => allDeps[dep]);
}

/**
 * Detect Python frameworks
 * @param projectPath - Path to the project directory
 * @returns Promise<string[]>
 */
async function detectPythonFrameworks(projectPath: string): Promise<string[]> {
  const frameworks: string[] = [];

  // Check for Django
  if (await fileExists(join(projectPath, 'manage.py'))) {
    frameworks.push('django');
  }
  
  // Check requirements.txt for Python frameworks
  await checkRequirementsForFrameworks(projectPath, frameworks);

  return frameworks;
}

/**
 * Check requirements.txt for framework dependencies
 */
async function checkRequirementsForFrameworks(
  projectPath: string,
  frameworks: string[]
): Promise<void> {
  const requirementsPath = join(projectPath, 'requirements.txt');
  if (!(await fileExists(requirementsPath))) {
    return;
  }

  const requirements = await readTextFile(requirementsPath);
  if (!requirements) {
    return;
  }

  const lowerRequirements = requirements.toLowerCase();
  
  if (lowerRequirements.includes('flask')) {
    frameworks.push('flask');
  }
  
  if (lowerRequirements.includes('django') && !frameworks.includes('django')) {
    frameworks.push('django');
  }
}

/**
 * Detect project category based on frameworks
 * @param frameworks - List of detected frameworks
 * @returns Project category or undefined
 */
function detectProjectCategory(
  frameworks: string[]
): 'frontend' | 'backend' | 'fullstack' | undefined {
  const frontendFrameworks = ['react', 'vue', 'angular', 'svelte', 'nextjs'];
  const backendFrameworks = ['express', 'django', 'flask', 'fastapi'];
  
  const hasFrontend = frameworks.some(f => frontendFrameworks.includes(f));
  const hasBackend = frameworks.some(f => backendFrameworks.includes(f));

  if (hasFrontend && hasBackend) {
    return 'fullstack';
  } else if (hasFrontend) {
    return 'frontend';
  } else if (hasBackend) {
    return 'backend';
  }

  return undefined;
}