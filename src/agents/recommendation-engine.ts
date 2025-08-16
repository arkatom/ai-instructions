/**
 * Recommendation Engine for Intelligent Agent Recommendation System
 * Recommends optimal agents based on project context and scoring
 */

/* eslint-disable complexity, sonarjs/cognitive-complexity, max-lines-per-function, max-lines */
// Recommendation algorithm requires complex scoring logic

import { 
  ProjectContext, 
  AgentMetadata
} from './types';
import { DependencyResolver } from './dependency-resolver';

/**
 * Agent score with breakdown
 */
export interface AgentScore {
  agentName: string;
  score: number;
  breakdown: {
    frameworkMatch: number;
    languageMatch: number;
    phaseAlignment: number;
    categoryRelevance: number;
    toolCompatibility: number;
  };
}

/**
 * Recommendation result
 */
export interface RecommendationResult {
  /** Primary recommendations (high confidence) */
  primary: string[];
  
  /** Suggested agents (medium confidence) */
  suggested: string[];
  
  /** Conflicts detected between agents */
  conflicts: Array<{
    agent1: string;
    agent2: string;
    reason: string;
  }>;
  
  /** Explanations for recommendations */
  explanations?: Record<string, string>;
  
  /** Detailed scores for all agents */
  scores?: AgentScore[];
}

/**
 * Recommendation options
 */
export interface RecommendationOptions {
  /** Resolve dependencies for recommended agents */
  resolveDependencies?: boolean;
  
  /** Filter by specific categories */
  categories?: string[];
  
  /** Maximum number of primary recommendations */
  maxPrimary?: number;
  
  /** Maximum number of suggested recommendations */
  maxSuggested?: number;
  
  /** Agents to exclude from recommendations */
  exclude?: string[];
  
  /** Include detailed explanations */
  includeExplanations?: boolean;
  
  /** Include detailed scores */
  includeScores?: boolean;
}

/**
 * Scoring weights for different factors
 */
const SCORING_WEIGHTS = {
  frameworkMatch: 0.3,
  languageMatch: 0.2,
  phaseAlignment: 0.2,
  categoryRelevance: 0.15,
  toolCompatibility: 0.15
};

/**
 * Recommendation Engine class
 */
export class RecommendationEngine {
  private agents: AgentMetadata[];
  private agentsMap: Map<string, AgentMetadata>;
  private dependencyResolver: DependencyResolver;

  constructor(agents: AgentMetadata[]) {
    this.agents = agents;
    // Convert array to Map for DependencyResolver
    this.agentsMap = new Map(agents.map(agent => [agent.name, agent]));
    this.dependencyResolver = new DependencyResolver(this.agentsMap);
  }

  /**
   * Recommend agents based on project context
   */
  recommend(
    context: ProjectContext, 
    options: RecommendationOptions = {}
  ): RecommendationResult {
    // Calculate and filter scores
    const filteredScores = this.filterAndSortScores(context, options);
    
    // Determine thresholds
    const { primaryThreshold, suggestedThreshold } = this.getThresholds(context);
    
    // Categorize agents
    let { primary, suggested } = this.categorizeAgents(
      filteredScores, 
      primaryThreshold, 
      suggestedThreshold,
      options
    );
    
    // Handle dependencies and conflicts
    let conflicts: RecommendationResult['conflicts'] = [];
    if (options.resolveDependencies) {
      const depResult = this.handleDependencies(primary, suggested);
      primary = depResult.primary;
      suggested = depResult.suggested;
      conflicts = depResult.conflicts;
    } else {
      conflicts = this.detectBasicConflicts([...primary, ...suggested]);
    }
    
    // Generate explanations if requested
    let explanations: Record<string, string> | undefined;
    if (options.includeExplanations) {
      explanations = this.generateExplanations(
        [...primary, ...suggested],
        context,
        filteredScores
      );
    }
    
    // Ensure minimum recommendations
    if (primary.length === 0 && suggested.length === 0 && this.agents.length > 0) {
      suggested = this.getGeneralPurposeAgents();
    }
    
    const result: RecommendationResult = {
      primary,
      suggested,
      conflicts
    };
    
    if (explanations) {
      result.explanations = explanations;
    }
    
    if (options.includeScores) {
      result.scores = filteredScores;
    }
    
    return result;
  }

  /**
   * Filter and sort scores based on options
   */
  private filterAndSortScores(
    context: ProjectContext,
    options: RecommendationOptions
  ): AgentScore[] {
    let scores = this.calculateScores(context);
    
    // Filter by category
    if (options.categories && options.categories.length > 0) {
      scores = scores.filter(score => {
        const agent = this.agents.find(a => a.name === score.agentName);
        return agent && options.categories!.includes(agent.category);
      });
    }
    
    // Exclude specified agents
    if (options.exclude && options.exclude.length > 0) {
      scores = scores.filter(
        score => !options.exclude!.includes(score.agentName)
      );
    }
    
    // Sort by score and filter low scores
    scores.sort((a, b) => b.score - a.score);
    return scores.filter(s => s.score > 0.1);
  }

  /**
   * Get recommendation thresholds based on context
   */
  private getThresholds(context: ProjectContext): { 
    primaryThreshold: number; 
    suggestedThreshold: number;
  } {
    const primaryThreshold = context.developmentPhase === 'production-maintenance' ? 0.6 : 0.7;
    const suggestedThreshold = context.projectType === 'python' ? 0.5 : 0.35;
    return { primaryThreshold, suggestedThreshold };
  }

  /**
   * Categorize agents into primary and suggested
   */
  private categorizeAgents(
    scores: AgentScore[],
    primaryThreshold: number,
    suggestedThreshold: number,
    options: RecommendationOptions
  ): { primary: string[]; suggested: string[] } {
    let primary = scores
      .filter(s => s.score >= primaryThreshold)
      .map(s => s.agentName);
      
    let suggested = scores
      .filter(s => s.score >= suggestedThreshold && s.score < primaryThreshold)
      .map(s => s.agentName);
    
    // Apply max limits
    if (options.maxPrimary) {
      primary = primary.slice(0, options.maxPrimary);
    }
    if (options.maxSuggested) {
      suggested = suggested.slice(0, options.maxSuggested);
    }
    
    return { primary, suggested };
  }

  /**
   * Handle dependency resolution
   */
  private handleDependencies(
    primary: string[], 
    suggested: string[]
  ): { 
    primary: string[]; 
    suggested: string[]; 
    conflicts: RecommendationResult['conflicts'];
  } {
    const allRecommended = [...primary, ...suggested];
    const resolution = this.dependencyResolver.resolve(allRecommended);
    
    // Add required dependencies to primary
    resolution.requiredAgents.forEach((agent: string) => {
      if (!primary.includes(agent) && !suggested.includes(agent)) {
        suggested = suggested.filter(a => a !== agent);
        if (!primary.includes(agent)) {
          primary.push(agent);
        }
      }
    });
    
    // Filter conflicts
    const conflicts = resolution.conflicts
      .filter((conflict: { agent1: string; agent2: string; reason?: string }) => 
        allRecommended.includes(conflict.agent1) && allRecommended.includes(conflict.agent2)
      )
      .map((conflict: { agent1: string; agent2: string; reason?: string }) => ({
        ...conflict,
        reason: conflict.reason || 'Agents have conflicting requirements'
      }));
    
    return { primary, suggested, conflicts };
  }

  /**
   * Get general purpose agents for unknown projects
   */
  private getGeneralPurposeAgents(): string[] {
    const generalAgents: string[] = [];
    const addedAgents = new Set<string>();
    
    for (const agent of this.agents) {
      if (this.isGeneralPurposeCategory(agent.category)) {
        if (!this.hasConflictWithAdded(agent, addedAgents) && generalAgents.length < 3) {
          generalAgents.push(agent.name);
          addedAgents.add(agent.name);
        }
      }
      
      if (generalAgents.length >= 3) break;
    }
    
    return generalAgents;
  }

  /**
   * Check if category is general purpose
   */
  private isGeneralPurposeCategory(category: string): boolean {
    return category === 'development' || 
           category === 'quality' || 
           category === 'infrastructure';
  }

  /**
   * Check if agent conflicts with already added agents
   */
  private hasConflictWithAdded(agent: AgentMetadata, addedAgents: Set<string>): boolean {
    for (const added of addedAgents) {
      const addedAgent = this.agents.find(a => a.name === added);
      if (addedAgent && (
        agent.relationships.conflicts_with.includes(added) ||
        addedAgent.relationships.conflicts_with.includes(agent.name)
      )) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate scores for all agents
   */
  calculateScores(context: ProjectContext): AgentScore[] {
    return this.agents.map(agent => {
      const breakdown = {
        frameworkMatch: this.calculateFrameworkMatch(agent, context),
        languageMatch: this.calculateLanguageMatch(agent, context),
        phaseAlignment: this.calculatePhaseAlignment(agent, context),
        categoryRelevance: this.calculateCategoryRelevance(agent, context),
        toolCompatibility: this.calculateToolCompatibility(agent, context)
      };
      
      const score = 
        breakdown.frameworkMatch * SCORING_WEIGHTS.frameworkMatch +
        breakdown.languageMatch * SCORING_WEIGHTS.languageMatch +
        breakdown.phaseAlignment * SCORING_WEIGHTS.phaseAlignment +
        breakdown.categoryRelevance * SCORING_WEIGHTS.categoryRelevance +
        breakdown.toolCompatibility * SCORING_WEIGHTS.toolCompatibility;
      
      return {
        agentName: agent.name,
        score,
        breakdown
      };
    });
  }

  /**
   * Calculate framework match score
   */
  private calculateFrameworkMatch(agent: AgentMetadata, context: ProjectContext): number {
    if (!context.frameworks || context.frameworks.length === 0) {
      return 0.5; // Neutral score for no frameworks
    }
    
    const agentFrameworks = agent.tags.filter(tag => 
      ['react', 'vue', 'angular', 'express', 'django', 'flask', 'nextjs', 'svelte'].includes(tag)
    );
    
    if (agentFrameworks.length === 0) {
      return 0.5; // Neutral score for framework-agnostic agents
    }
    
    const matches = agentFrameworks.filter(framework => 
      context.frameworks!.includes(framework)
    );
    
    if (matches.length > 0) {
      // High score if there's a match
      return 0.9 + (0.1 * (matches.length / agentFrameworks.length));
    }
    
    // Check for conflicts - look in agent tags, not just name
    const hasConflict = 
      (agent.tags.includes('react') && context.frameworks.includes('angular')) ||
      (agent.tags.includes('angular') && context.frameworks.includes('react')) ||
      (agent.tags.includes('vue') && (context.frameworks.includes('react') || context.frameworks.includes('angular')));
    
    return hasConflict ? 0.0 : 0.3;  // Changed from 0.1 to 0.0 for conflicts
  }

  /**
   * Calculate language match score
   */
  private calculateLanguageMatch(agent: AgentMetadata, context: ProjectContext): number {
    if (!context.primaryLanguage || context.primaryLanguage === 'unknown') {
      return 0.5;
    }
    
    const languageTags = agent.tags.filter(tag => 
      ['javascript', 'typescript', 'python', 'rust', 'go', 'java'].includes(tag)
    );
    
    if (languageTags.length === 0) {
      return 0.5; // Language-agnostic agent
    }
    
    if (languageTags.includes(context.primaryLanguage)) {
      return 1.0;
    }
    
    // Special case: JavaScript/TypeScript compatibility
    if ((context.primaryLanguage === 'typescript' && languageTags.includes('javascript')) ||
        (context.primaryLanguage === 'javascript' && languageTags.includes('typescript'))) {
      return 0.8;
    }
    
    // Much lower score for mismatched languages
    return 0.05;
  }

  /**
   * Calculate phase alignment score
   */
  private calculatePhaseAlignment(agent: AgentMetadata, context: ProjectContext): number {
    const phaseScores: Record<string, Record<string, number>> = {
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
    
    const phase = context.developmentPhase;
    const category = agent.category;
    
    // Special boost for test agents in testing phase
    if (phase === 'testing-phase' && agent.tags.includes('testing')) {
      return 1.0;
    }
    
    // Special boost for DevOps in production
    if (phase === 'production-maintenance') {
      if (agent.tags.includes('ci-cd') || agent.tags.includes('docker') || 
          agent.tags.includes('kubernetes') || agent.tags.includes('deployment')) {
        return 1.0;
      }
      // Also boost infrastructure category in production
      if (agent.category === 'infrastructure') {
        return 1.0;
      }
    }
    
    return phaseScores[phase]?.[category] || 0.5;
  }

  /**
   * Calculate category relevance score
   */
  private calculateCategoryRelevance(agent: AgentMetadata, context: ProjectContext): number {
    // Penalize frontend-specific agents for non-frontend projects
    const isFrontendAgent = agent.tags.some(tag => 
      ['react', 'vue', 'angular', 'svelte', 'frontend'].includes(tag)
    );
    
    // For Python projects, heavily penalize frontend frameworks
    if (context.projectType === 'python' && isFrontendAgent) {
      return 0.1;
    }
    
    // For Node.js projects without frontend frameworks, penalize frontend agents
    if (context.projectType === 'nodejs' && 
        (!context.frameworks || context.frameworks.length === 0 || 
         !context.frameworks.some(f => ['react', 'vue', 'angular', 'svelte'].includes(f))) &&
        isFrontendAgent) {
      return 0.2;
    }
    
    if (!context.projectCategory) {
      return 0.5;
    }
    
    const categoryScores: Record<string, Record<string, number>> = {
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
    
    return categoryScores[context.projectCategory]?.[agent.category] || 0.5;
  }

  /**
   * Calculate tool compatibility score
   */
  private calculateToolCompatibility(agent: AgentMetadata, context: ProjectContext): number {
    let score = 0.5; // Base score
    let matches = 0;
    let checks = 0;
    
    // Check each tool category
    matches += this.checkToolMatch(agent, context.testingTools, 
      ['jest', 'mocha', 'cypress', 'pytest', 'testing'], 3);
    if (context.testingTools && context.testingTools.length > 0) checks++;
    
    matches += this.checkToolMatch(agent, context.buildTools,
      ['webpack', 'vite', 'rollup', 'typescript', 'babel'], 2);
    if (context.buildTools && context.buildTools.length > 0) checks++;
    
    matches += this.checkToolMatch(agent, context.lintingTools,
      ['eslint', 'prettier', 'quality', 'code-review'], 1);
    if (context.lintingTools && context.lintingTools.length > 0) checks++;
    
    if (checks > 0) {
      score = 0.5 + (0.5 * (matches / (checks * 2.5)));
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Check tool match for a specific category
   */
  private checkToolMatch(
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

  /**
   * Detect basic conflicts between agents
   */
  private detectBasicConflicts(agentNames: string[]): RecommendationResult['conflicts'] {
    const conflicts: RecommendationResult['conflicts'] = [];
    
    for (let i = 0; i < agentNames.length; i++) {
      const agent1 = this.agents.find(a => a.name === agentNames[i]);
      if (!agent1) continue;
      
      for (let j = i + 1; j < agentNames.length; j++) {
        const agent2 = this.agents.find(a => a.name === agentNames[j]);
        if (!agent2) continue;
        
        if (agent1.relationships.conflicts_with.includes(agent2.name) ||
            agent2.relationships.conflicts_with.includes(agent1.name)) {
          conflicts.push({
            agent1: agent1.name,
            agent2: agent2.name,
            reason: `${agent1.name} and ${agent2.name} have conflicting approaches or technologies`
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Generate explanations for recommendations
   */
  private generateExplanations(
    agentNames: string[],
    context: ProjectContext,
    scores: AgentScore[]
  ): Record<string, string> {
    const explanations: Record<string, string> = {};
    
    agentNames.forEach(agentName => {
      const agent = this.agents.find(a => a.name === agentName);
      const score = scores.find(s => s.agentName === agentName);
      
      if (!agent || !score) return;
      
      const reasons: string[] = [];
      
      // Framework match
      if (score.breakdown.frameworkMatch > 0.8) {
        const frameworks = context.frameworks?.map(f => 
          f.charAt(0).toUpperCase() + f.slice(1)
        ).join(', ') || '';
        reasons.push(`Perfect match for ${frameworks} development`);
      }
      
      // Language match
      if (score.breakdown.languageMatch > 0.8) {
        reasons.push(`Specialized in ${context.primaryLanguage}`);
      }
      
      // Phase alignment
      if (score.breakdown.phaseAlignment > 0.8) {
        reasons.push(`Highly relevant for ${context.developmentPhase.replace('-', ' ')}`);
      }
      
      // Tool compatibility
      if (score.breakdown.toolCompatibility > 0.7) {
        reasons.push('Compatible with your current toolchain');
      }
      
      // Category relevance
      if (score.breakdown.categoryRelevance > 0.7) {
        reasons.push(`Well-suited for ${context.projectCategory || 'your project type'}`);
      }
      
      explanations[agentName] = reasons.join('. ') || agent.description;
    });
    
    return explanations;
  }
}