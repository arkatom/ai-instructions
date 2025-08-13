/**
 * Project Type Detector
 * Detects project type and primary language
 */

import { join } from 'path';
import { ProjectContext, ProjectType } from '../types';
import { FileSystemHelper } from './file-system-helper';

/**
 * ProjectTypeDetector class
 * Responsible for detecting project type and package manager
 */
export class ProjectTypeDetector {
  private projectPath: string;
  private context: Partial<ProjectContext>;
  private fileHelper: FileSystemHelper;

  constructor(projectPath: string, context: Partial<ProjectContext>) {
    this.projectPath = projectPath;
    this.context = context;
    this.fileHelper = new FileSystemHelper(context);
  }

  /**
   * Detect the primary project type
   */
  async detectProjectType(): Promise<void> {
    try {
      // Check for Node.js project
      const packageJsonPath = join(this.projectPath, 'package.json');
      const packageJsonExists = await this.fileHelper.fileExists(packageJsonPath);
      
      if (packageJsonExists) {
        const packageJson = await this.fileHelper.readJsonFile(packageJsonPath);
        if (packageJson) {
          this.context.projectType = 'nodejs' as ProjectType;
        }
        const packageManager = await this.detectPackageManager();
        if (packageManager) {
          this.context.packageManager = packageManager;
        }
        
        // Check if it's primarily TypeScript or JavaScript
        if (packageJson && (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript)) {
          this.context.primaryLanguage = 'typescript';
        } else {
          this.context.primaryLanguage = 'javascript';
        }
        return;
      }

      // Check for Python project
      const requirementsPath = join(this.projectPath, 'requirements.txt');
      const pyprojectPath = join(this.projectPath, 'pyproject.toml');
      const setupPyPath = join(this.projectPath, 'setup.py');
      
      if (await this.fileHelper.fileExists(requirementsPath) || 
          await this.fileHelper.fileExists(pyprojectPath) || 
          await this.fileHelper.fileExists(setupPyPath)) {
        this.context.projectType = 'python' as ProjectType;
        this.context.primaryLanguage = 'python';
        return;
      }

      // Check for Rust project
      const cargoPath = join(this.projectPath, 'Cargo.toml');
      if (await this.fileHelper.fileExists(cargoPath)) {
        this.context.projectType = 'rust' as ProjectType;
        this.context.primaryLanguage = 'rust';
        return;
      }

      // Check for Go project
      const goModPath = join(this.projectPath, 'go.mod');
      if (await this.fileHelper.fileExists(goModPath)) {
        this.context.projectType = 'go' as ProjectType;
        this.context.primaryLanguage = 'go';
        return;
      }

      // Default to unknown
      this.context.projectType = 'unknown' as ProjectType;
      this.context.primaryLanguage = 'unknown';
    } catch {
      this.context.projectType = 'unknown' as ProjectType;
      this.context.primaryLanguage = 'unknown';
    }
  }

  /**
   * Detect package manager for Node.js projects
   */
  private async detectPackageManager(): Promise<string | undefined> {
    if (await this.fileHelper.fileExists(join(this.projectPath, 'yarn.lock'))) {
      return 'yarn';
    }
    if (await this.fileHelper.fileExists(join(this.projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (await this.fileHelper.fileExists(join(this.projectPath, 'package-lock.json'))) {
      return 'npm';
    }
    return undefined;
  }
}