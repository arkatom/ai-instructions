/**
 * Development Phase Detector
 * Detects the current development phase of the project
 */

import { join } from 'path';
import { ProjectContext, DevelopmentPhase } from '../types';
import { FileSystemHelper } from './file-system-helper';

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
 * DevelopmentPhaseDetector class
 * Responsible for detecting the current development phase
 */
export class DevelopmentPhaseDetector {
  private projectPath: string;
  private context: Partial<ProjectContext>;
  private fileHelper: FileSystemHelper;

  constructor(projectPath: string, context: Partial<ProjectContext>) {
    this.projectPath = projectPath;
    this.context = context;
    this.fileHelper = new FileSystemHelper(context);
  }

  /**
   * Detect the current development phase
   */
  async detectDevelopmentPhase(): Promise<void> {
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
    const srcExists = await this.fileHelper.fileExists(join(this.projectPath, 'src'));
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
    const distExists = await this.fileHelper.fileExists(join(this.projectPath, 'dist'));
    const buildExists = await this.fileHelper.fileExists(join(this.projectPath, 'build'));
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
      if (await this.fileHelper.fileExists(join(this.projectPath, testDir))) {
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
      if (await this.fileHelper.fileExists(join(this.projectPath, ciFile))) {
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
    if (await this.fileHelper.fileExists(join(this.projectPath, 'Dockerfile')) ||
        await this.fileHelper.fileExists(join(this.projectPath, 'docker-compose.yml'))) {
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
      if (await this.fileHelper.fileExists(join(this.projectPath, deployFile))) {
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
        const packageJson = await this.fileHelper.readJsonFile(join(this.projectPath, 'package.json'));
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
}