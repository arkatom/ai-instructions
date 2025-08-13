/**
 * Framework Detector
 * Detects frameworks used in the project
 */

import { join } from 'path';
import { ProjectContext } from '../types';
import { FileSystemHelper } from './file-system-helper';

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
 * FrameworkDetector class
 * Responsible for detecting frameworks and project category
 */
export class FrameworkDetector {
  private projectPath: string;
  private context: Partial<ProjectContext>;
  private fileHelper: FileSystemHelper;

  constructor(projectPath: string, context: Partial<ProjectContext>) {
    this.projectPath = projectPath;
    this.context = context;
    this.fileHelper = new FileSystemHelper(context);
  }

  /**
   * Detect frameworks used in the project
   */
  async detectFrameworks(): Promise<void> {
    const frameworks: string[] = [];

    // For Node.js/TypeScript projects
    if (this.context.projectType === 'nodejs') {
      await this.detectNodeFrameworks(frameworks);
    }

    // For Python projects
    if (this.context.projectType === 'python') {
      await this.detectPythonFrameworks(frameworks);
    }

    this.context.frameworks = frameworks;
  }

  /**
   * Detect Node.js frameworks
   */
  private async detectNodeFrameworks(frameworks: string[]): Promise<void> {
    const packageJsonPath = join(this.projectPath, 'package.json');
    
    try {
      const packageJson = await this.fileHelper.readJsonFile(packageJsonPath);
      if (!packageJson) return; // No package.json, can't detect Node frameworks
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for each framework
      for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
        if (config.dependencies) {
          for (const dep of config.dependencies) {
            if (allDeps[dep]) {
              frameworks.push(framework);
              break;
            }
          }
        }
      }

      // Check for mongoose (for framework detection)
      if (allDeps.mongoose && !frameworks.includes('mongoose')) {
        frameworks.push('mongoose');
      }
    } catch {
      // Ignore errors in reading package.json
    }
  }

  /**
   * Detect Python frameworks
   */
  private async detectPythonFrameworks(frameworks: string[]): Promise<void> {
    // Check for Django
    if (await this.fileHelper.fileExists(join(this.projectPath, 'manage.py'))) {
      frameworks.push('django');
    }
    
    // Check for Flask
    const requirementsPath = join(this.projectPath, 'requirements.txt');
    if (await this.fileHelper.fileExists(requirementsPath)) {
      try {
        const requirements = await this.fileHelper.readTextFile(requirementsPath);
        if (requirements) {
          if (requirements.toLowerCase().includes('flask')) {
            frameworks.push('flask');
          }
          if (requirements.toLowerCase().includes('django') && !frameworks.includes('django')) {
            frameworks.push('django');
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Detect project category based on frameworks
   */
  detectProjectCategory(): void {
    const frontendFrameworks = ['react', 'vue', 'angular', 'svelte', 'nextjs'];
    const backendFrameworks = ['express', 'django', 'flask', 'fastapi'];
    
    const hasFrontend = this.context.frameworks?.some(f => 
      frontendFrameworks.includes(f)
    );
    const hasBackend = this.context.frameworks?.some(f => 
      backendFrameworks.includes(f)
    );

    if (hasFrontend && hasBackend) {
      this.context.projectCategory = 'fullstack';
    } else if (hasFrontend) {
      this.context.projectCategory = 'frontend';
    } else if (hasBackend) {
      this.context.projectCategory = 'backend';
    }
    // If no frameworks detected, leave projectCategory undefined
  }
}