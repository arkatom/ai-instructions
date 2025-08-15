/**
 * Context Analyzer for Intelligent Agent Recommendation System
 * Analyzes project characteristics to recommend optimal agents
 * 
 * Refactored to use pure functions following Single Responsibility Principle
 */

import { ProjectContext } from './types';
import { validatePathSecurity } from './utils/path-security-validator';
import { detectProjectType } from './utils/project-type-detector';
import { detectFrameworks } from './utils/framework-detector';
import { detectDevelopmentPhase } from './utils/development-phase-detector';
import { detectDevelopmentTools } from './utils/tools-detector';
import { FileError } from './utils/file-system-utils';

/**
 * Context Analyzer class
 * Orchestrates project analysis using specialized pure function utilities
 */
export class ContextAnalyzer {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    // Path Traversal Prevention using pure function
    this.projectPath = validatePathSecurity(projectPath);
  }

  /**
   * Analyze the entire project and return context
   * @returns Complete project context
   */
  async analyzeProject(): Promise<ProjectContext> {
    const allErrors: FileError[] = [];

    // Detect project type using pure function
    const projectTypeResult = await detectProjectType(this.projectPath);
    allErrors.push(...projectTypeResult.errors);

    // Detect frameworks using pure function
    const frameworkResult = await detectFrameworks(
      this.projectPath,
      projectTypeResult.projectType
    );
    allErrors.push(...frameworkResult.errors);

    // Detect development phase using pure function
    const phaseResult = await detectDevelopmentPhase(
      this.projectPath,
      projectTypeResult.projectType
    );
    allErrors.push(...phaseResult.errors);

    // Detect development tools using pure function
    const toolsResult = await detectDevelopmentTools(
      this.projectPath,
      projectTypeResult.projectType
    );
    allErrors.push(...toolsResult.errors);

    // Compose final context
    const context: ProjectContext = {
      projectType: projectTypeResult.projectType,
      frameworks: frameworkResult.frameworks,
      developmentPhase: phaseResult.developmentPhase,
      buildTools: toolsResult.buildTools,
      lintingTools: toolsResult.lintingTools,
      testingTools: toolsResult.testingTools,
      ...(projectTypeResult.primaryLanguage && { primaryLanguage: projectTypeResult.primaryLanguage }),
      ...(projectTypeResult.packageManager && { packageManager: projectTypeResult.packageManager }),
      ...(frameworkResult.projectCategory && { projectCategory: frameworkResult.projectCategory }),
      ...(phaseResult.hasTests && { hasTests: phaseResult.hasTests }),
      ...(phaseResult.hasCI && { hasCI: phaseResult.hasCI }),
      ...(allErrors.length > 0 && { errors: allErrors })
    };

    return context;
  }

  /**
   * Get the project path (for testing purposes)
   */
  getProjectPath(): string {
    return this.projectPath;
  }
}