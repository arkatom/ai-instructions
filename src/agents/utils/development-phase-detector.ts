/**
 * Development Phase Detector
 * Pure functions for detecting the current development phase
 */

import { join } from 'path';
import { fileExists, readJsonFile, FileError } from './file-system-utils';
import { DevelopmentPhase, ProjectType } from '../types';
import { PackageJson } from './project-type-detector';

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
 * Development phase detection result
 */
export interface PhaseResult {
  developmentPhase: DevelopmentPhase;
  hasTests: boolean;
  hasCI: boolean;
  errors: FileError[];
}

/**
 * Detect the current development phase
 * @param projectPath - Path to the project directory
 * @param projectType - Type of the project
 * @returns Promise<PhaseResult>
 */
export async function detectDevelopmentPhase(
  projectPath: string,
  projectType: ProjectType
): Promise<PhaseResult> {
  const phaseScores: PhaseScores = {
    [PHASE_INITIAL_SETUP]: 0,
    [PHASE_ACTIVE_DEV]: 0,
    [PHASE_TESTING]: 0,
    [PHASE_PRODUCTION]: 0
  };

  let hasTests = false;
  let hasCI = false;
  const errors: FileError[] = [];

  // Check various indicators for phase detection
  await checkSourceDirectories(projectPath, phaseScores);
  await checkProductionIndicators(projectPath, phaseScores);
  hasTests = await checkTestingIndicators(projectPath, phaseScores);
  hasCI = await checkCIConfiguration(projectPath, phaseScores);
  await checkDockerConfiguration(projectPath, phaseScores);
  await checkDeploymentConfiguration(projectPath, phaseScores);
  
  const packageResult = await checkPackageScripts(projectPath, projectType, phaseScores);
  errors.push(...packageResult.errors);

  // Determine phase based on scores
  const detectedPhase = determinePhase(phaseScores, hasTests, hasCI);

  return {
    developmentPhase: detectedPhase,
    hasTests,
    hasCI,
    errors
  };
}

/**
 * Check source directory indicators
 */
async function checkSourceDirectories(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<void> {
  const srcExists = await fileExists(join(projectPath, 'src'));
  if (!srcExists) {
    phaseScores[PHASE_INITIAL_SETUP] += 2;
  } else {
    phaseScores[PHASE_ACTIVE_DEV] += 1;
  }
}

/**
 * Check production build indicators
 */
async function checkProductionIndicators(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<void> {
  const distExists = await fileExists(join(projectPath, 'dist'));
  const buildExists = await fileExists(join(projectPath, 'build'));
  if (distExists || buildExists) {
    phaseScores[PHASE_PRODUCTION] += 2;
  }
}

/**
 * Check testing infrastructure
 */
async function checkTestingIndicators(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<boolean> {
  const testDirs = ['test', 'tests', '__tests__', 'spec'];
  for (const testDir of testDirs) {
    if (await fileExists(join(projectPath, testDir))) {
      phaseScores[PHASE_TESTING] += 2;
      return true;
    }
  }
  return false;
}

/**
 * Check CI/CD configuration
 */
async function checkCIConfiguration(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<boolean> {
  const ciFiles = [
    '.github/workflows',
    '.gitlab-ci.yml',
    '.travis.yml',
    'Jenkinsfile',
    '.circleci/config.yml'
  ];
  
  for (const ciFile of ciFiles) {
    if (await fileExists(join(projectPath, ciFile))) {
      phaseScores[PHASE_TESTING] += 1;
      phaseScores[PHASE_PRODUCTION] += 1;
      return true;
    }
  }
  
  return false;
}

/**
 * Check Docker configuration
 */
async function checkDockerConfiguration(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<void> {
  if (await fileExists(join(projectPath, 'Dockerfile')) ||
      await fileExists(join(projectPath, 'docker-compose.yml'))) {
    phaseScores[PHASE_PRODUCTION] += 2;
  }
}

/**
 * Check deployment configuration files
 */
async function checkDeploymentConfiguration(
  projectPath: string,
  phaseScores: PhaseScores
): Promise<void> {
  const deploymentFiles = [
    'kubernetes.yaml',
    'k8s.yaml',
    'deployment.yaml',
    '.env.production',
    'nginx.conf'
  ];
  
  for (const deployFile of deploymentFiles) {
    if (await fileExists(join(projectPath, deployFile))) {
      phaseScores[PHASE_PRODUCTION] += 2;
      break;
    }
  }
}

/**
 * Check package.json scripts for phase indicators
 */
async function checkPackageScripts(
  projectPath: string,
  projectType: ProjectType,
  phaseScores: PhaseScores
): Promise<{errors: FileError[]}> {
  if (projectType !== 'nodejs') {
    return { errors: [] };
  }

  const result = await readJsonFile<PackageJson>(join(projectPath, 'package.json'));
  const packageJson = result.data;

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

  return { errors: result.errors };
}

/**
 * Determine development phase from scores
 */
function determinePhase(
  phaseScores: PhaseScores,
  hasTests: boolean,
  hasCI: boolean
): DevelopmentPhase {
  let maxScore = 0;
  let detectedPhase: DevelopmentPhase = PHASE_INITIAL_SETUP;
  
  for (const [phase, score] of Object.entries(phaseScores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedPhase = phase as DevelopmentPhase;
    }
  }

  // Special case: if we have tests and CI, likely in testing phase
  if (hasTests && hasCI) {
    detectedPhase = PHASE_TESTING;
  }

  // Special case: if we have Docker and deployment configs, likely in production
  if (phaseScores[PHASE_PRODUCTION] >= 3) {
    detectedPhase = PHASE_PRODUCTION;
  }

  return detectedPhase;
}