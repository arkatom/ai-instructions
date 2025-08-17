/**
 * RecommendationStrategy - Strategic filtering and categorization of agent recommendations
 * Handles thresholds, filtering options, and agent categorization logic
 */

import { ProjectContext, AgentMetadata } from '../types';
import { AgentScore } from './scoring-engine';

/**
 * Recommendation options for filtering and customization
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
 * Categorized agent recommendations
 */
export interface CategorizedAgents {
  primary: string[];
  suggested: string[];
}

/**
 * Recommendation thresholds configuration
 */
interface ThresholdConfig {
  primary: {
    default: number;
    productionMaintenance: number;
  };
  suggested: {
    python: number;
    default: number;
  };
  minimumScore: number;
}

/**
 * Default threshold configuration
 */
const DEFAULT_THRESHOLDS: ThresholdConfig = {
  primary: {
    default: 0.7,
    productionMaintenance: 0.6
  },
  suggested: {
    python: 0.5,
    default: 0.35
  },
  minimumScore: 0.1
};

/**
 * General purpose agent categories for fallback recommendations
 */
const GENERAL_PURPOSE_CATEGORIES = new Set([
  'development',
  'quality', 
  'infrastructure'
]);

/**
 * RecommendationStrategy class - Manages strategic filtering and categorization
 */
export class RecommendationStrategy {
  private readonly thresholds: ThresholdConfig;

  constructor(thresholds: Partial<ThresholdConfig> = {}) {
    this.thresholds = {
      primary: { ...DEFAULT_THRESHOLDS.primary, ...thresholds.primary },
      suggested: { ...DEFAULT_THRESHOLDS.suggested, ...thresholds.suggested },
      minimumScore: thresholds.minimumScore ?? DEFAULT_THRESHOLDS.minimumScore
    };
  }

  /**
   * Filter and sort agent scores based on options and minimum thresholds
   */
  filterAndSortScores(
    scores: AgentScore[],
    agents: AgentMetadata[],
    options: RecommendationOptions = {}
  ): AgentScore[] {
    let filteredScores = [...scores];
    
    // Filter by category if specified
    if (options.categories && options.categories.length > 0) {
      filteredScores = this.filterByCategories(filteredScores, agents, options.categories);
    }
    
    // Exclude specified agents
    if (options.exclude && options.exclude.length > 0) {
      filteredScores = this.excludeAgents(filteredScores, options.exclude);
    }
    
    // Filter by minimum score and sort by score descending
    return filteredScores
      .filter(score => score.score > this.thresholds.minimumScore)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get adaptive thresholds based on project context
   */
  getAdaptiveThresholds(context: ProjectContext): { 
    primaryThreshold: number; 
    suggestedThreshold: number;
  } {
    const primaryThreshold = context.developmentPhase === 'production-maintenance' 
      ? this.thresholds.primary.productionMaintenance
      : this.thresholds.primary.default;
      
    const suggestedThreshold = context.projectType === 'python'
      ? this.thresholds.suggested.python
      : this.thresholds.suggested.default;
      
    return { primaryThreshold, suggestedThreshold };
  }

  /**
   * Categorize agents into primary and suggested based on thresholds
   */
  categorizeAgents(
    scores: AgentScore[],
    primaryThreshold: number,
    suggestedThreshold: number,
    options: RecommendationOptions = {}
  ): CategorizedAgents {
    // Extract agent names by score categories
    let primary = scores
      .filter(score => score.score >= primaryThreshold)
      .map(score => score.agentName);
      
    let suggested = scores
      .filter(score => 
        score.score >= suggestedThreshold && 
        score.score < primaryThreshold
      )
      .map(score => score.agentName);
    
    // Apply maximum limits if specified
    primary = this.applyMaxLimit(primary, options.maxPrimary);
    suggested = this.applyMaxLimit(suggested, options.maxSuggested);
    
    return { primary, suggested };
  }

  /**
   * Get general purpose agents for fallback when no specific recommendations found
   */
  getGeneralPurposeAgents(agents: AgentMetadata[], maxAgents: number = 3): string[] {
    const generalAgents: string[] = [];
    const addedAgents = new Set<string>();
    
    for (const agent of agents) {
      if (this.isGeneralPurposeAgent(agent)) {
        if (!this.hasConflictWithSelected(agent, agents, addedAgents) && 
            generalAgents.length < maxAgents) {
          generalAgents.push(agent.name);
          addedAgents.add(agent.name);
        }
      }
      
      if (generalAgents.length >= maxAgents) break;
    }
    
    return generalAgents;
  }

  /**
   * Check if agent qualifies as general purpose
   */
  isGeneralPurposeAgent(agent: AgentMetadata): boolean {
    return GENERAL_PURPOSE_CATEGORIES.has(agent.category);
  }

  /**
   * Check if agent has conflicts with already selected agents
   */
  hasConflictWithSelected(
    agent: AgentMetadata, 
    allAgents: AgentMetadata[], 
    selectedAgents: Set<string>
  ): boolean {
    for (const selectedName of selectedAgents) {
      const selectedAgent = allAgents.find(a => a.name === selectedName);
      if (selectedAgent && this.hasDirectConflict(agent, selectedAgent)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for direct conflict between two agents
   */
  private hasDirectConflict(agent1: AgentMetadata, agent2: AgentMetadata): boolean {
    return (
      agent1.relationships.conflicts_with.includes(agent2.name) ||
      agent2.relationships.conflicts_with.includes(agent1.name)
    );
  }

  /**
   * Filter scores by specified categories
   */
  private filterByCategories(
    scores: AgentScore[], 
    agents: AgentMetadata[], 
    categories: string[]
  ): AgentScore[] {
    return scores.filter(score => {
      const agent = agents.find(a => a.name === score.agentName);
      return agent && categories.includes(agent.category);
    });
  }

  /**
   * Exclude specified agents from scores
   */
  private excludeAgents(scores: AgentScore[], exclude: string[]): AgentScore[] {
    return scores.filter(score => !exclude.includes(score.agentName));
  }

  /**
   * Apply maximum limit to agent list
   */
  private applyMaxLimit(agents: string[], maxLimit?: number): string[] {
    return maxLimit ? agents.slice(0, maxLimit) : agents;
  }

  /**
   * Validate recommendation options
   */
  validateOptions(options: RecommendationOptions): void {
    if (options.maxPrimary !== undefined && options.maxPrimary < 0) {
      throw new Error('maxPrimary must be non-negative');
    }
    
    if (options.maxSuggested !== undefined && options.maxSuggested < 0) {
      throw new Error('maxSuggested must be non-negative');
    }
    
    if (options.categories && options.categories.length === 0) {
      throw new Error('categories array cannot be empty when specified');
    }
  }

  /**
   * Get threshold configuration for testing/debugging
   */
  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }
}