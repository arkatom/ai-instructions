/**
 * Context Analyzer for Intelligent Agent Recommendation System
 * Analyzes project characteristics to recommend optimal agents
 */

import { readFile, stat } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import * as fs from 'fs';
import { ProjectContext, ProjectType, DevelopmentPhase } from './types';
import { SecurityError } from '../errors/custom-errors';

/**
 * Development phase constants
 */
const PHASE_INITIAL_SETUP = 'initial-setup' as const;
const PHASE_ACTIVE_DEV = 'active-development' as const;
const PHASE_TESTING = 'testing-phase' as const;
const PHASE_PRODUCTION = 'production-maintenance' as const;

/**
 * Type for phase scores
 */
type PhaseScores = {
  [PHASE_INITIAL_SETUP]: number;
  [PHASE_ACTIVE_DEV]: number;
  [PHASE_TESTING]: number;
  [PHASE_PRODUCTION]: number;
};

/**
 * Type definition for package.json structure
 */
interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

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
 * Context Analyzer class
 * Analyzes project structure and characteristics
 */
export class ContextAnalyzer {
  private projectPath: string;
  private context: Partial<ProjectContext>;

  constructor(projectPath: string = process.cwd()) {
    // Path Traversal Prevention
    const basePath = process.cwd();
    const safePath = normalize(resolve(basePath, projectPath));
    
    // Check if path is outside project boundary
    if (!safePath.startsWith(basePath)) {
      throw new SecurityError('PATH_TRAVERSAL', 'Path traversal detected');
    }
    
    // Check for absolute paths outside project
    if (projectPath.startsWith('/') && !projectPath.startsWith(basePath)) {
      throw new SecurityError('ABSOLUTE_PATH', 'Absolute path outside project boundary');
    }
    
    // Check for symbolic links
    try {
      if (fs.existsSync(safePath) && fs.lstatSync(safePath).isSymbolicLink()) {
        throw new SecurityError('SYMLINK', 'Symbolic links not allowed');
      }
    } catch (error) {
      // If we can't check, it's safer to reject
      if (!(error instanceof SecurityError)) {
        throw new SecurityError('PATH_VALIDATION', 'Unable to validate path security');
      }
      throw error;
    }
    
    this.projectPath = safePath;
    this.context = {};
  }

  /**
   * Analyze the entire project and return context
   * @returns Complete project context
   */
  async analyzeProject(): Promise<ProjectContext> {
    this.context = {
      frameworks: [],
      developmentPhase: PHASE_INITIAL_SETUP,
      projectType: 'unknown' as ProjectType,
      buildTools: [],
      lintingTools: [],
      testingTools: []
    };

    // Detect project type
    await this.detectProjectType();

    // Detect frameworks
    await this.detectFrameworks();

    // Detect project category based on frameworks
    this.detectProjectCategory();

    // Detect development phase
    await this.detectDevelopmentPhase();

    // Detect additional characteristics
    await this.detectAdditionalFeatures();

    // Detect development tools
    await this.detectDevelopmentTools();

    return this.context as ProjectContext;
  }

  /**
   * Detect the primary project type
   */
  private async detectProjectType(): Promise<void> {
    try {
      // Check for Node.js project
      const packageJsonPath = join(this.projectPath, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);
      
      if (packageJsonExists) {
        const packageJson = await this.readJsonFile(packageJsonPath);
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
      
      if (await this.fileExists(requirementsPath) || 
          await this.fileExists(pyprojectPath) || 
          await this.fileExists(setupPyPath)) {
        this.context.projectType = 'python' as ProjectType;
        this.context.primaryLanguage = 'python';
        return;
      }

      // Check for Rust project
      const cargoPath = join(this.projectPath, 'Cargo.toml');
      if (await this.fileExists(cargoPath)) {
        this.context.projectType = 'rust' as ProjectType;
        this.context.primaryLanguage = 'rust';
        return;
      }

      // Check for Go project
      const goModPath = join(this.projectPath, 'go.mod');
      if (await this.fileExists(goModPath)) {
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
   * Detect frameworks used in the project
   */
  private async detectFrameworks(): Promise<void> {
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
      const packageJson = await this.readJsonFile(packageJsonPath);
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
    } catch {
      // Ignore errors in reading package.json
    }
  }

  /**
   * Detect Python frameworks
   */
  private async detectPythonFrameworks(frameworks: string[]): Promise<void> {
    // Check for Django
    if (await this.fileExists(join(this.projectPath, 'manage.py'))) {
      frameworks.push('django');
    }
    
    // Check for Flask
    const requirementsPath = join(this.projectPath, 'requirements.txt');
    if (await this.fileExists(requirementsPath)) {
      try {
        const requirements = await readFile(requirementsPath, 'utf-8');
        if (requirements.toLowerCase().includes('flask')) {
          frameworks.push('flask');
        }
        if (requirements.toLowerCase().includes('django') && !frameworks.includes('django')) {
          frameworks.push('django');
        }
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Detect project category based on frameworks
   */
  private detectProjectCategory(): void {
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

  /**
   * Detect the current development phase
   */
  private async detectDevelopmentPhase(): Promise<void> {
    const phaseScores: PhaseScores = {
      [PHASE_INITIAL_SETUP]: 0,
      [PHASE_ACTIVE_DEV]: 0,
      [PHASE_TESTING]: 0,
      [PHASE_PRODUCTION]: 0
    };

    // Check various indicators for phase detection
    await this.checkSourceDirectories(phaseScores);
    await this.checkProductionIndicators(phaseScores);
    await this.checkTestingIndicators(phaseScores);
    await this.checkCIConfiguration(phaseScores);
    await this.checkDockerConfiguration(phaseScores);
    await this.checkDeploymentConfiguration(phaseScores);
    await this.checkPackageScripts(phaseScores);

    // Determine phase based on scores
    const detectedPhase = this.determinePhase(phaseScores);
    this.context.developmentPhase = detectedPhase;
  }

  /**
   * Check source directory indicators
   */
  private async checkSourceDirectories(phaseScores: PhaseScores): Promise<void> {
    const srcExists = await this.fileExists(join(this.projectPath, 'src'));
    if (!srcExists) {
      phaseScores[PHASE_INITIAL_SETUP] += 2;
    } else {
      phaseScores[PHASE_ACTIVE_DEV] += 1;
    }
  }

  /**
   * Check production build indicators
   */
  private async checkProductionIndicators(phaseScores: PhaseScores): Promise<void> {
    const distExists = await this.fileExists(join(this.projectPath, 'dist'));
    const buildExists = await this.fileExists(join(this.projectPath, 'build'));
    if (distExists || buildExists) {
      phaseScores[PHASE_PRODUCTION] += 2;
    }
  }

  /**
   * Check testing infrastructure
   */
  private async checkTestingIndicators(phaseScores: PhaseScores): Promise<void> {
    const testDirs = ['test', 'tests', '__tests__', 'spec'];
    for (const testDir of testDirs) {
      if (await this.fileExists(join(this.projectPath, testDir))) {
        phaseScores[PHASE_TESTING] += 2;
        this.context.hasTests = true;
        break;
      }
    }
  }

  /**
   * Check CI/CD configuration
   */
  private async checkCIConfiguration(phaseScores: PhaseScores): Promise<void> {
    const ciFiles = [
      '.github/workflows',
      '.gitlab-ci.yml',
      '.travis.yml',
      'Jenkinsfile',
      '.circleci/config.yml'
    ];
    
    for (const ciFile of ciFiles) {
      if (await this.fileExists(join(this.projectPath, ciFile))) {
        phaseScores[PHASE_TESTING] += 1;
        phaseScores[PHASE_PRODUCTION] += 1;
        this.context.hasCI = true;
        break;
      }
    }
  }

  /**
   * Check Docker configuration
   */
  private async checkDockerConfiguration(phaseScores: PhaseScores): Promise<void> {
    if (await this.fileExists(join(this.projectPath, 'Dockerfile')) ||
        await this.fileExists(join(this.projectPath, 'docker-compose.yml'))) {
      phaseScores[PHASE_PRODUCTION] += 2;
    }
  }

  /**
   * Check deployment configuration files
   */
  private async checkDeploymentConfiguration(phaseScores: PhaseScores): Promise<void> {
    const deploymentFiles = [
      'kubernetes.yaml',
      'k8s.yaml',
      'deployment.yaml',
      '.env.production',
      'nginx.conf'
    ];
    
    for (const deployFile of deploymentFiles) {
      if (await this.fileExists(join(this.projectPath, deployFile))) {
        phaseScores[PHASE_PRODUCTION] += 2;
        break;
      }
    }
  }

  /**
   * Check package.json scripts for phase indicators
   */
  private async checkPackageScripts(phaseScores: PhaseScores): Promise<void> {
    if (this.context.projectType === 'nodejs') {
      try {
        const packageJson = await this.readJsonFile(join(this.projectPath, 'package.json'));
        if (packageJson && packageJson.scripts) {
          if (packageJson.scripts.test) {
            phaseScores[PHASE_TESTING] += 1;
          }
          if (packageJson.scripts.build || packageJson.scripts.start) {
            phaseScores[PHASE_ACTIVE_DEV] += 1;
          }
          if (packageJson.scripts.deploy || packageJson.scripts.production) {
            phaseScores[PHASE_PRODUCTION] += 1;
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Determine development phase from scores
   */
  private determinePhase(phaseScores: PhaseScores): DevelopmentPhase {
    let maxScore = 0;
    let detectedPhase: DevelopmentPhase = PHASE_INITIAL_SETUP;
    
    for (const [phase, score] of Object.entries(phaseScores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedPhase = phase as DevelopmentPhase;
      }
    }

    // Special case: if we have tests and CI, likely in testing phase
    if (this.context.hasTests && this.context.hasCI) {
      detectedPhase = PHASE_TESTING;
    }

    // Special case: if we have Docker and deployment configs, likely in production
    if (phaseScores[PHASE_PRODUCTION] >= 3) {
      detectedPhase = PHASE_PRODUCTION;
    }

    return detectedPhase;
  }

  /**
   * Detect additional project features
   */
  private async detectAdditionalFeatures(): Promise<void> {
    // Team size can be inferred from git contributors (not implemented in test environment)
    // For now, we'll leave it undefined
  }

  /**
   * Detect package manager for Node.js projects
   */
  private async detectPackageManager(): Promise<string | undefined> {
    if (await this.fileExists(join(this.projectPath, 'yarn.lock'))) {
      return 'yarn';
    }
    if (await this.fileExists(join(this.projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (await this.fileExists(join(this.projectPath, 'package-lock.json'))) {
      return 'npm';
    }
    return undefined;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse a JSON file
   */
  private async readJsonFile(filePath: string): Promise<PackageJson | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Check for empty file
      if (!content || content.trim() === '') {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Empty JSON file'
        });
        return null;
      }
      
      // Check for file size (5MB limit)
      if (content.length > 5 * 1024 * 1024) {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'JSON file too large (>5MB)'
        });
        return null;
      }
      
      // Check for null bytes
      if (content.includes('\u0000')) {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Null bytes detected in JSON'
        });
        return null;
      }
      
      // Try to parse JSON
      try {
        return JSON.parse(content);
      } catch {
        if (!this.context.errors) this.context.errors = [];
        this.context.errors.push({
          file: filePath.split('/').pop() || filePath,
          error: 'Invalid JSON format'
        });
        return null;
      }
    } catch {
      // File doesn't exist or can't be read - this is ok, just return null
      return null;
    }
  }

  /**
   * Detect development tools (build, linting, testing)
   */
  private async detectDevelopmentTools(): Promise<void> {
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
   * Detect Node.js development tools
   */
  private async detectNodeTools(
    buildTools: string[],
    lintingTools: string[],
    testingTools: string[]
  ): Promise<void> {
    try {
      const packageJsonPath = join(this.projectPath, 'package.json');
      const packageJson = await this.readJsonFile(packageJsonPath);
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

      // Check for mongoose (for framework detection)
      if (allDeps.mongoose) {
        if (!this.context.frameworks?.includes('mongoose')) {
          this.context.frameworks?.push('mongoose');
        }
      }
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

    for (const [dep, tool] of Object.entries(buildToolMap)) {
      if (deps[dep] && !buildTools.includes(tool)) {
        buildTools.push(tool);
      }
    }
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

    for (const [dep, tool] of Object.entries(lintToolMap)) {
      if (deps[dep]) {
        lintingTools.push(tool);
      }
    }
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

    for (const [dep, tool] of Object.entries(testToolMap)) {
      if (deps[dep]) {
        testingTools.push(tool);
      }
    }
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
      if (await this.fileExists(requirementsPath)) {
        const requirements = await readFile(requirementsPath, 'utf-8');
        
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
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get the analyzed context (for testing purposes)
   */
  getContext(): Partial<ProjectContext> {
    return this.context;
  }
}