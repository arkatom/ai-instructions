/**
 * ExplanationGenerator - Generates human-readable explanations for agent recommendations
 * Provides clear reasoning for why agents are recommended based on scoring breakdown
 */

import { ProjectContext, AgentMetadata } from '../types';
import { AgentScore, ScoreBreakdown } from './scoring-engine';

/**
 * Explanation configuration
 */
interface ExplanationConfig {
  /** Minimum score threshold for including specific factors in explanation */
  scoreThresholds: {
    excellent: number;
    good: number;
    notable: number;
  };
  /** Maximum number of reasons to include in explanation */
  maxReasons: number;
  /** Whether to include fallback descriptions */
  includeFallback: boolean;
}

/**
 * Default explanation configuration
 */
const DEFAULT_CONFIG: ExplanationConfig = {
  scoreThresholds: {
    excellent: 0.8,
    good: 0.7,
    notable: 0.6
  },
  maxReasons: 4,
  includeFallback: true
};

/**
 * Explanation context for generating reasons
 */
interface ExplanationContext {
  agent: AgentMetadata;
  score: AgentScore;
  projectContext: ProjectContext;
  reasons: string[];
}

/**
 * ExplanationGenerator class - Creates comprehensive explanations for recommendations
 */
export class ExplanationGenerator {
  private readonly config: ExplanationConfig;

  constructor(config: Partial<ExplanationConfig> = {}) {
    this.config = {
      scoreThresholds: { ...DEFAULT_CONFIG.scoreThresholds, ...config.scoreThresholds },
      maxReasons: config.maxReasons ?? DEFAULT_CONFIG.maxReasons,
      includeFallback: config.includeFallback ?? DEFAULT_CONFIG.includeFallback
    };
  }

  /**
   * Generate explanations for a list of recommended agents
   */
  generateExplanations(
    agentNames: string[],
    agents: AgentMetadata[],
    context: ProjectContext,
    scores: AgentScore[]
  ): Record<string, string> {
    const explanations: Record<string, string> = {};
    
    for (const agentName of agentNames) {
      const agent = agents.find(a => a.name === agentName);
      const score = scores.find(s => s.agentName === agentName);
      
      if (agent && score) {
        explanations[agentName] = this.generateSingleExplanation(agent, score, context);
      }
    }
    
    return explanations;
  }

  /**
   * Generate explanation for a single agent recommendation
   */
  generateSingleExplanation(
    agent: AgentMetadata,
    score: AgentScore,
    context: ProjectContext
  ): string {
    const explanationContext: ExplanationContext = {
      agent,
      score,
      projectContext: context,
      reasons: []
    };
    
    // Generate reasons based on score breakdown
    this.addFrameworkReasons(explanationContext);
    this.addLanguageReasons(explanationContext);
    this.addPhaseReasons(explanationContext);
    this.addToolReasons(explanationContext);
    this.addCategoryReasons(explanationContext);
    
    // Limit and format reasons
    const finalReasons = explanationContext.reasons.slice(0, this.config.maxReasons);
    
    // Return formatted explanation or fallback
    return finalReasons.length > 0 
      ? finalReasons.join('. ')
      : (this.config.includeFallback ? agent.description : 'Recommended based on project analysis');
  }

  /**
   * Generate explanation for a specific scoring factor
   */
  generateFactorExplanation(
    factor: keyof ScoreBreakdown,
    score: number,
    agent: AgentMetadata,
    context: ProjectContext
  ): string | null {
    if (score < this.config.scoreThresholds.notable) {
      return null;
    }
    
    switch (factor) {
      case 'frameworkMatch':
        return this.getFrameworkExplanation(score, agent, context);
      case 'languageMatch':
        return this.getLanguageExplanation(score, agent, context);
      case 'phaseAlignment':
        return this.getPhaseExplanation(score, agent, context);
      case 'categoryRelevance':
        return this.getCategoryExplanation(score, agent, context);
      case 'toolCompatibility':
        return this.getToolExplanation(score, agent, context);
      default:
        return null;
    }
  }

  /**
   * Add framework-related reasons to explanation
   */
  private addFrameworkReasons(ctx: ExplanationContext): void {
    const { score, projectContext } = ctx;
    
    if (score.breakdown.frameworkMatch >= this.config.scoreThresholds.excellent) {
      const frameworks = this.getProjectFrameworks(projectContext);
      if (frameworks.length > 0) {
        ctx.reasons.push(`Perfect match for ${frameworks} development`);
      }
    } else if (score.breakdown.frameworkMatch >= this.config.scoreThresholds.good) {
      const frameworks = this.getProjectFrameworks(projectContext);
      if (frameworks.length > 0) {
        ctx.reasons.push(`Compatible with ${frameworks} framework`);
      }
    }
  }

  /**
   * Add language-related reasons to explanation
   */
  private addLanguageReasons(ctx: ExplanationContext): void {
    const { score, projectContext } = ctx;
    
    if (score.breakdown.languageMatch >= this.config.scoreThresholds.excellent) {
      if (projectContext.primaryLanguage && projectContext.primaryLanguage !== 'unknown') {
        ctx.reasons.push(`Specialized in ${this.formatLanguageName(projectContext.primaryLanguage)}`);
      }
    } else if (score.breakdown.languageMatch >= this.config.scoreThresholds.good) {
      if (projectContext.primaryLanguage && projectContext.primaryLanguage !== 'unknown') {
        ctx.reasons.push(`Strong support for ${this.formatLanguageName(projectContext.primaryLanguage)}`);
      }
    }
  }

  /**
   * Add development phase-related reasons to explanation
   */
  private addPhaseReasons(ctx: ExplanationContext): void {
    const { score, projectContext } = ctx;
    
    if (score.breakdown.phaseAlignment >= this.config.scoreThresholds.excellent) {
      const phaseName = this.formatPhaseName(projectContext.developmentPhase);
      ctx.reasons.push(`Highly relevant for ${phaseName}`);
    } else if (score.breakdown.phaseAlignment >= this.config.scoreThresholds.good) {
      const phaseName = this.formatPhaseName(projectContext.developmentPhase);
      ctx.reasons.push(`Well-suited for ${phaseName}`);
    }
  }

  /**
   * Add tool compatibility reasons to explanation
   */
  private addToolReasons(ctx: ExplanationContext): void {
    const { score } = ctx;
    
    if (score.breakdown.toolCompatibility >= this.config.scoreThresholds.good) {
      ctx.reasons.push('Compatible with your current toolchain');
    }
  }

  /**
   * Add category relevance reasons to explanation
   */
  private addCategoryReasons(ctx: ExplanationContext): void {
    const { score, projectContext } = ctx;
    
    if (score.breakdown.categoryRelevance >= this.config.scoreThresholds.good) {
      const categoryDescription = this.getProjectCategoryDescription(projectContext);
      if (categoryDescription) {
        ctx.reasons.push(`Well-suited for ${categoryDescription}`);
      }
    }
  }

  /**
   * Get framework explanation text
   */
  private getFrameworkExplanation(
    score: number, 
    agent: AgentMetadata, 
    context: ProjectContext
  ): string {
    const frameworks = this.getProjectFrameworks(context);
    if (score >= this.config.scoreThresholds.excellent) {
      return `Perfect framework alignment with ${frameworks}`;
    } else {
      return `Compatible with ${frameworks} ecosystem`;
    }
  }

  /**
   * Get language explanation text
   */
  private getLanguageExplanation(
    score: number, 
    agent: AgentMetadata, 
    context: ProjectContext
  ): string {
    const language = this.formatLanguageName(context.primaryLanguage || 'unknown');
    if (score >= this.config.scoreThresholds.excellent) {
      return `Native ${language} expertise`;
    } else {
      return `Strong ${language} support`;
    }
  }

  /**
   * Get phase explanation text
   */
  private getPhaseExplanation(
    score: number, 
    agent: AgentMetadata, 
    context: ProjectContext
  ): string {
    const phase = this.formatPhaseName(context.developmentPhase);
    return `Optimized for ${phase}`;
  }

  /**
   * Get category explanation text
   */
  private getCategoryExplanation(
    score: number, 
    agent: AgentMetadata, 
    context: ProjectContext
  ): string {
    const category = this.getProjectCategoryDescription(context);
    return `Aligned with ${category} requirements`;
  }

  /**
   * Get tool explanation text
   */
  private getToolExplanation(
    _score: number, 
    _agent: AgentMetadata, 
    _context: ProjectContext
  ): string {
    return 'Integrates well with your development tools';
  }

  /**
   * Get formatted project frameworks
   */
  private getProjectFrameworks(context: ProjectContext): string {
    if (!context.frameworks || context.frameworks.length === 0) {
      return '';
    }
    
    return context.frameworks
      .map(f => f.charAt(0).toUpperCase() + f.slice(1))
      .join(', ');
  }

  /**
   * Format language name for display
   */
  private formatLanguageName(language: string): string {
    const languageNames: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'rust': 'Rust',
      'go': 'Go',
      'java': 'Java',
      'unknown': 'multiple languages'
    };
    
    return languageNames[language] || language;
  }

  /**
   * Format phase name for display
   */
  private formatPhaseName(phase: string): string {
    return phase.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get project category description
   */
  private getProjectCategoryDescription(context: ProjectContext): string {
    if (!context.projectCategory) {
      return 'your project type';
    }
    
    const categoryDescriptions: Record<string, string> = {
      'frontend': 'frontend development',
      'backend': 'backend services',
      'fullstack': 'full-stack development',
      'mobile': 'mobile applications',
      'desktop': 'desktop applications',
      'api': 'API development',
      'library': 'library development'
    };
    
    return categoryDescriptions[context.projectCategory] || context.projectCategory;
  }

  /**
   * Get configuration for testing/debugging
   */
  getConfig(): ExplanationConfig {
    return { ...this.config };
  }
}