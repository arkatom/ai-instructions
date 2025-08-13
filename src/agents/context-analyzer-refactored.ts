/**
 * Context Analyzer for Intelligent Agent Recommendation System
 * Analyzes project characteristics to recommend optimal agents
 * 
 * Refactored to follow Single Responsibility Principle
 * Delegates specific responsibilities to helper classes
 */

import { normalize, resolve } from 'path';
import * as fs from 'fs';
import { ProjectContext, DevelopmentPhase } from './types';
import { SecurityError } from '../errors/custom-errors';
import { FileSystemHelper } from './helpers/file-system-helper';
import { ProjectTypeDetector } from './helpers/project-type-detector';
import { FrameworkDetector } from './helpers/framework-detector';
import { DevelopmentPhaseDetector } from './helpers/development-phase-detector';
import { ToolDetector } from './helpers/tool-detector';

/**
 * Context Analyzer class (Refactored)
 * Orchestrates project analysis using specialized detectors
 */
export class ContextAnalyzer {
  private projectPath: string;
  private context: Partial<ProjectContext>;
  private fileHelper: FileSystemHelper;
  private projectTypeDetector: ProjectTypeDetector;
  private frameworkDetector: FrameworkDetector;
  private phaseDetector: DevelopmentPhaseDetector;
  private toolDetector: ToolDetector;

  constructor(projectPath: string = process.cwd()) {
    // Path Traversal Prevention
    const basePath = process.cwd();
    const safePath = normalize(resolve(projectPath));
    
    // Allow paths in /tmp for testing
    const isTempPath = safePath.startsWith('/tmp/') || safePath.startsWith('/var/folders/');
    
    // Check if path is outside project boundary (except for temp paths)
    if (!isTempPath && !safePath.startsWith(basePath)) {
      // For relative paths, resolve them relative to basePath
      const resolvedPath = normalize(resolve(basePath, projectPath));
      if (!resolvedPath.startsWith(basePath)) {
        throw new SecurityError('PATH_TRAVERSAL', 'Path traversal detected');
      }
      // Use the resolved path
      this.projectPath = resolvedPath;
    } else {
      this.projectPath = safePath;
    }
    
    // Check for symbolic links
    try {
      if (fs.existsSync(this.projectPath) && fs.lstatSync(this.projectPath).isSymbolicLink()) {
        throw new SecurityError('SYMLINK', 'Symbolic links not allowed');
      }
    } catch (error) {
      // If we can't check, it's safer to reject
      if (!(error instanceof SecurityError)) {
        throw new SecurityError('PATH_VALIDATION', 'Unable to validate path security');
      }
      throw error;
    }
    
    this.context = {
      errors: []
    };
    
    // Initialize helper classes
    this.fileHelper = new FileSystemHelper(this.context);
    this.projectTypeDetector = new ProjectTypeDetector(this.projectPath, this.context);
    this.frameworkDetector = new FrameworkDetector(this.projectPath, this.context);
    this.phaseDetector = new DevelopmentPhaseDetector(this.projectPath, this.context);
    this.toolDetector = new ToolDetector(this.projectPath, this.context);
  }

  /**
   * Analyze the entire project and return context
   * @returns Complete project context
   */
  async analyzeProject(): Promise<ProjectContext> {
    // Initialize context with defaults (don't reset errors - they accumulate during analysis)
    this.context.frameworks = [];
    this.context.developmentPhase = 'initial-setup' as DevelopmentPhase;
    this.context.projectType = 'unknown';
    this.context.buildTools = [];
    this.context.lintingTools = [];
    this.context.testingTools = [];
    // Keep errors array from constructor

    // Detect project type
    await this.projectTypeDetector.detectProjectType();

    // Detect frameworks
    await this.frameworkDetector.detectFrameworks();

    // Detect project category based on frameworks
    this.frameworkDetector.detectProjectCategory();

    // Detect development phase
    await this.phaseDetector.detectDevelopmentPhase();

    // Detect development tools
    await this.toolDetector.detectDevelopmentTools();

    return this.context as ProjectContext;
  }

  /**
   * Get the analyzed context (for testing purposes)
   */
  getContext(): Partial<ProjectContext> {
    return this.context;
  }
}