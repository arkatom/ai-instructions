/**
 * ScoringEngine - Intelligent scoring algorithms for agent recommendation
 * Handles multi-dimensional scoring across 5 key factors
 */

import { ProjectContext, AgentMetadata } from '../types';

/**
 * Agent score with detailed breakdown
 */
export interface AgentScore {
  agentName: string;
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Detailed scoring breakdown for transparency
 */
export interface ScoreBreakdown {
  frameworkMatch: number;
  languageMatch: number;
  phaseAlignment: number;
  categoryRelevance: number;
  toolCompatibility: number;
}

/**
 * Scoring configuration
 */
interface ScoringConfig {
  weights: {
    frameworkMatch: number;
    languageMatch: number;
    phaseAlignment: number;
    categoryRelevance: number;
    toolCompatibility: number;
  };
  thresholds: {
    neutralScore: number;
    highMatch: number;
    perfectMatch: number;
  };
}

/**
 * Default scoring configuration
 */
const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    frameworkMatch: 0.3,
    languageMatch: 0.2,
    phaseAlignment: 0.2,
    categoryRelevance: 0.15,
    toolCompatibility: 0.15
  },
  thresholds: {
    neutralScore: 0.5,
    highMatch: 0.8,
    perfectMatch: 1.0
  }
};

/**
 * Phase scoring matrix for development lifecycle alignment
 */
const PHASE_SCORING_MATRIX: Record<string, Record<string, number>> = {
  'initial-setup': {
    'development': 0.7,
    'infrastructure': 0.8,
    'quality': 0.3,
    'business': 0.5,
    'creative': 0.4,
    'data-ai': 0.2,
    'specialized': 0.3
  },
  'active-development': {
    'development': 1.0,
    'infrastructure': 0.5,
    'quality': 0.7,
    'business': 0.6,
    'creative': 0.6,
    'data-ai': 0.5,
    'specialized': 0.5
  },
  'testing-phase': {
    'development': 0.5,
    'infrastructure': 0.6,
    'quality': 1.0,
    'business': 0.3,
    'creative': 0.2,
    'data-ai': 0.3,
    'specialized': 0.3
  },
  'production-maintenance': {
    'development': 0.4,
    'infrastructure': 1.0,
    'quality': 0.8,
    'business': 0.7,
    'creative': 0.3,
    'data-ai': 0.6,
    'specialized': 0.5
  }
};

/**
 * Category scoring matrix for project type alignment
 */
const CATEGORY_SCORING_MATRIX: Record<string, Record<string, number>> = {
  'frontend': {
    'development': 0.9,
    'creative': 0.8,
    'quality': 0.7,
    'infrastructure': 0.5,
    'business': 0.6,
    'data-ai': 0.3,
    'specialized': 0.5
  },
  'backend': {
    'development': 0.9,
    'infrastructure': 0.8,
    'quality': 0.7,
    'data-ai': 0.6,
    'business': 0.5,
    'creative': 0.3,
    'specialized': 0.5
  },
  'fullstack': {
    'development': 1.0,
    'infrastructure': 0.7,
    'quality': 0.8,
    'business': 0.6,
    'creative': 0.5,
    'data-ai': 0.5,
    'specialized': 0.5
  }
};

/**
 * ScoringEngine class - Calculates multi-dimensional scores for agent recommendation
 */
export class ScoringEngine {
  private readonly config: ScoringConfig;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = {
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds }
    };
  }

  /**
   * Calculate comprehensive scores for all agents
   */
  calculateScores(agents: AgentMetadata[], context: ProjectContext): AgentScore[] {
    return agents.map(agent => {
      const breakdown = this.calculateScoreBreakdown(agent, context);
      const score = this.calculateWeightedScore(breakdown);
      
      return {
        agentName: agent.name,
        score,
        breakdown
      };
    });
  }

  /**
   * Calculate detailed score breakdown for an agent
   */
  private calculateScoreBreakdown(agent: AgentMetadata, context: ProjectContext): ScoreBreakdown {
    return {
      frameworkMatch: this.calculateFrameworkMatch(agent, context),
      languageMatch: this.calculateLanguageMatch(agent, context),
      phaseAlignment: this.calculatePhaseAlignment(agent, context),
      categoryRelevance: this.calculateCategoryRelevance(agent, context),
      toolCompatibility: this.calculateToolCompatibility(agent, context)
    };
  }

  /**
   * Calculate final weighted score from breakdown
   */
  private calculateWeightedScore(breakdown: ScoreBreakdown): number {
    const { weights } = this.config;
    
    return (
      breakdown.frameworkMatch * weights.frameworkMatch +
      breakdown.languageMatch * weights.languageMatch +
      breakdown.phaseAlignment * weights.phaseAlignment +
      breakdown.categoryRelevance * weights.categoryRelevance +
      breakdown.toolCompatibility * weights.toolCompatibility
    );
  }

  /**
   * Calculate framework compatibility score
   */
  calculateFrameworkMatch(agent: AgentMetadata, context: ProjectContext): number {
    if (!context.frameworks || context.frameworks.length === 0) {
      return this.config.thresholds.neutralScore;
    }
    
    const agentFrameworks = agent.tags.filter(tag => 
      ['react', 'vue', 'angular', 'express', 'django', 'flask', 'nextjs', 'svelte'].includes(tag)
    );
    
    if (agentFrameworks.length === 0) {
      return this.config.thresholds.neutralScore; // Framework-agnostic agents
    }
    
    const matches = agentFrameworks.filter(framework => 
      context.frameworks!.includes(framework)
    );
    
    if (matches.length > 0) {
      // High score with bonus for coverage
      return 0.9 + (0.1 * (matches.length / agentFrameworks.length));
    }
    
    // Check for technology conflicts
    const hasConflict = this.hasFrameworkConflict(agent, context.frameworks);
    return hasConflict ? 0.0 : 0.3;
  }

  /**
   * Calculate programming language compatibility score
   */
  calculateLanguageMatch(agent: AgentMetadata, context: ProjectContext): number {
    if (!context.primaryLanguage || context.primaryLanguage === 'unknown') {
      return this.config.thresholds.neutralScore;
    }
    
    const languageTags = agent.tags.filter(tag => 
      ['javascript', 'typescript', 'python', 'rust', 'go', 'java'].includes(tag)
    );
    
    if (languageTags.length === 0) {
      return this.config.thresholds.neutralScore; // Language-agnostic agent
    }
    
    if (languageTags.includes(context.primaryLanguage)) {
      return this.config.thresholds.perfectMatch;
    }
    
    // Handle JavaScript/TypeScript cross-compatibility
    if (this.isJavaScriptTypeScriptCompatible(context.primaryLanguage, languageTags)) {
      return this.config.thresholds.highMatch;
    }
    
    // Very low score for language mismatch
    return 0.05;
  }

  /**
   * Calculate development phase alignment score
   */
  calculatePhaseAlignment(agent: AgentMetadata, context: ProjectContext): number {
    const phase = context.developmentPhase;
    const category = agent.category;
    
    // Special boost for testing agents in testing phase
    if (phase === 'testing-phase' && agent.tags.includes('testing')) {
      return this.config.thresholds.perfectMatch;
    }
    
    // Special boost for DevOps in production maintenance
    if (phase === 'production-maintenance') {
      if (this.hasDevOpsCapabilities(agent)) {
        return this.config.thresholds.perfectMatch;
      }
      if (agent.category === 'infrastructure') {
        return this.config.thresholds.perfectMatch;
      }
    }
    
    return PHASE_SCORING_MATRIX[phase]?.[category] || this.config.thresholds.neutralScore;
  }

  /**
   * Calculate project category relevance score
   */
  calculateCategoryRelevance(agent: AgentMetadata, context: ProjectContext): number {
    // Penalize frontend agents for backend-only projects
    if (this.shouldPenalizeFrontendAgent(agent, context)) {
      return this.getFrontendPenaltyScore(context);
    }
    
    if (!context.projectCategory) {
      return this.config.thresholds.neutralScore;
    }
    
    return CATEGORY_SCORING_MATRIX[context.projectCategory]?.[agent.category] || 
           this.config.thresholds.neutralScore;
  }

  /**
   * Calculate tool ecosystem compatibility score
   */
  calculateToolCompatibility(agent: AgentMetadata, context: ProjectContext): number {
    let score = this.config.thresholds.neutralScore;
    let totalChecks = 0;
    let totalMatches = 0;
    
    // Check testing tools compatibility
    const testingMatch = this.checkToolCategoryMatch(
      agent, 
      context.testingTools, 
      ['jest', 'mocha', 'cypress', 'pytest', 'testing'],
      3
    );
    if (context.testingTools && context.testingTools.length > 0) {
      totalMatches += testingMatch;
      totalChecks++;
    }
    
    // Check build tools compatibility
    const buildMatch = this.checkToolCategoryMatch(
      agent,
      context.buildTools,
      ['webpack', 'vite', 'rollup', 'typescript', 'babel'],
      2
    );
    if (context.buildTools && context.buildTools.length > 0) {
      totalMatches += buildMatch;
      totalChecks++;
    }
    
    // Check linting tools compatibility
    const lintingMatch = this.checkToolCategoryMatch(
      agent,
      context.lintingTools,
      ['eslint', 'prettier', 'quality', 'code-review'],
      1
    );
    if (context.lintingTools && context.lintingTools.length > 0) {
      totalMatches += lintingMatch;
      totalChecks++;
    }
    
    if (totalChecks > 0) {
      score = this.config.thresholds.neutralScore + 
              (0.5 * (totalMatches / (totalChecks * 2.5)));
    }
    
    return Math.min(score, this.config.thresholds.perfectMatch);
  }

  /**
   * Check framework conflicts
   */
  private hasFrameworkConflict(agent: AgentMetadata, frameworks: string[]): boolean {
    return (
      (agent.tags.includes('react') && frameworks.includes('angular')) ||
      (agent.tags.includes('angular') && frameworks.includes('react')) ||
      (agent.tags.includes('vue') && 
       (frameworks.includes('react') || frameworks.includes('angular')))
    );
  }

  /**
   * Check JavaScript/TypeScript compatibility
   */
  private isJavaScriptTypeScriptCompatible(primaryLanguage: string, languageTags: string[]): boolean {
    return (
      (primaryLanguage === 'typescript' && languageTags.includes('javascript')) ||
      (primaryLanguage === 'javascript' && languageTags.includes('typescript'))
    );
  }

  /**
   * Check if agent has DevOps capabilities
   */
  private hasDevOpsCapabilities(agent: AgentMetadata): boolean {
    return agent.tags.some(tag => 
      ['ci-cd', 'docker', 'kubernetes', 'deployment'].includes(tag)
    );
  }

  /**
   * Check if frontend agent should be penalized
   */
  private shouldPenalizeFrontendAgent(agent: AgentMetadata, context: ProjectContext): boolean {
    const isFrontendAgent = agent.tags.some(tag => 
      ['react', 'vue', 'angular', 'svelte', 'frontend'].includes(tag)
    );
    
    if (!isFrontendAgent) return false;
    
    // Penalize for Python projects
    if (context.projectType === 'python') return true;
    
    // Penalize for Node.js projects without frontend frameworks
    return context.projectType === 'nodejs' && 
           (!context.frameworks || context.frameworks.length === 0 || 
            !context.frameworks.some(f => ['react', 'vue', 'angular', 'svelte'].includes(f)));
  }

  /**
   * Get penalty score for frontend agents in non-frontend contexts
   */
  private getFrontendPenaltyScore(context: ProjectContext): number {
    return context.projectType === 'python' ? 0.1 : 0.2;
  }

  /**
   * Check tool compatibility for a specific category
   */
  private checkToolCategoryMatch(
    agent: AgentMetadata,
    contextTools: string[] | undefined,
    toolTags: string[],
    weight: number
  ): number {
    if (!contextTools || contextTools.length === 0) {
      return 0;
    }
    
    let matches = 0;
    if (agent.tags.some(tag => toolTags.includes(tag))) {
      matches = 1;
      if (agent.tags.some(tag => contextTools.includes(tag))) {
        matches = weight;
      }
    }
    
    return matches;
  }
}