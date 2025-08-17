/**
 * Recommendation Engine for Intelligent Agent Recommendation System
 * Orchestrates modular components for optimal agent recommendations
 * Refactored from 670-line monolith to clean modular architecture
 */

import { ProjectContext, AgentMetadata } from './types';
import { DependencyResolver } from './dependency-resolver';
import {
  ScoringEngine,
  RecommendationStrategy,
  ConflictAnalyzer,
  ExplanationGenerator,
  AgentScore,
  RecommendationOptions
} from './modules';

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

// Re-export types for backward compatibility
export type { AgentScore, RecommendationOptions } from './modules';

/**
 * Recommendation Engine class - Modular orchestration of agent recommendation
 * Coordinates specialized modules for scoring, strategy, conflicts, and explanations
 */
export class RecommendationEngine {
  private readonly agents: AgentMetadata[];
  private readonly agentsMap: Map<string, AgentMetadata>;
  private readonly dependencyResolver: DependencyResolver;
  
  // Specialized modules
  private readonly scoringEngine: ScoringEngine;
  private readonly recommendationStrategy: RecommendationStrategy;
  private readonly conflictAnalyzer: ConflictAnalyzer;
  private readonly explanationGenerator: ExplanationGenerator;

  constructor(agents: AgentMetadata[]) {
    this.agents = agents;
    this.agentsMap = new Map(agents.map(agent => [agent.name, agent]));
    this.dependencyResolver = new DependencyResolver(this.agentsMap);
    
    // Initialize specialized modules
    this.scoringEngine = new ScoringEngine();
    this.recommendationStrategy = new RecommendationStrategy();
    this.conflictAnalyzer = new ConflictAnalyzer(agents, this.dependencyResolver);
    this.explanationGenerator = new ExplanationGenerator();
  }

  /**
   * Recommend agents based on project context
   * Orchestrates all modules for comprehensive recommendation
   */
  recommend(
    context: ProjectContext, 
    options: RecommendationOptions = {}
  ): RecommendationResult {
    // Validate and process scores
    this.recommendationStrategy.validateOptions(options);
    const filteredScores = this.calculateAndFilterScores(context, options);
    
    // Categorize agents
    let { primary, suggested } = this.categorizeRecommendations(context, filteredScores, options);
    
    // Handle conflicts
    const conflicts = this.resolveConflicts(primary, suggested, options);
    if (options.resolveDependencies && conflicts.length > 0) {
      const depResult = this.conflictAnalyzer.resolveDependencies(primary, suggested);
      primary = depResult.primary;
      suggested = depResult.suggested;
    }
    
    // Generate explanations and fallbacks
    const agentLists = { primary, suggested };
    const explanations = this.generateExplanationsIfRequested(agentLists, context, filteredScores, options);
    suggested = this.ensureMinimumRecommendations(primary, suggested);
    
    const optionalData = explanations 
      ? { explanations, filteredScores }
      : { filteredScores };
    
    return this.buildRecommendationResult(
      { primary, suggested }, 
      conflicts, 
      optionalData, 
      options
    );
  }

  /**
   * Calculate scores for all agents (delegated to ScoringEngine)
   * Maintained for backward compatibility and testing
   */
  calculateScores(context: ProjectContext): AgentScore[] {
    return this.scoringEngine.calculateScores(this.agents, context);
  }

  /**
   * Calculate and filter scores
   */
  private calculateAndFilterScores(context: ProjectContext, options: RecommendationOptions): AgentScore[] {
    const allScores = this.scoringEngine.calculateScores(this.agents, context);
    return this.recommendationStrategy.filterAndSortScores(allScores, this.agents, options);
  }

  /**
   * Categorize recommendations into primary and suggested
   */
  private categorizeRecommendations(
    context: ProjectContext, 
    filteredScores: AgentScore[], 
    options: RecommendationOptions
  ) {
    const { primaryThreshold, suggestedThreshold } = 
      this.recommendationStrategy.getAdaptiveThresholds(context);
    
    return this.recommendationStrategy.categorizeAgents(
      filteredScores,
      primaryThreshold,
      suggestedThreshold,
      options
    );
  }

  /**
   * Resolve conflicts between agents
   */
  private resolveConflicts(
    primary: string[], 
    suggested: string[], 
    options: RecommendationOptions
  ): RecommendationResult['conflicts'] {
    return options.resolveDependencies 
      ? this.conflictAnalyzer.resolveDependencies(primary, suggested).conflicts
      : this.conflictAnalyzer.detectBasicConflicts([...primary, ...suggested]);
  }

  /**
   * Generate explanations if requested
   */
  private generateExplanationsIfRequested(
    agentLists: { primary: string[]; suggested: string[] },
    context: ProjectContext,
    filteredScores: AgentScore[],
    options: RecommendationOptions
  ): Record<string, string> | undefined {
    return options.includeExplanations 
      ? this.explanationGenerator.generateExplanations(
          [...agentLists.primary, ...agentLists.suggested],
          this.agents,
          context,
          filteredScores
        )
      : undefined;
  }

  /**
   * Ensure minimum recommendations using fallback strategy
   */
  private ensureMinimumRecommendations(primary: string[], suggested: string[]): string[] {
    if (primary.length === 0 && suggested.length === 0 && this.agents.length > 0) {
      return this.recommendationStrategy.getGeneralPurposeAgents(this.agents);
    }
    return suggested;
  }

  /**
   * Build final recommendation result
   */
  private buildRecommendationResult(
    recommendations: { primary: string[]; suggested: string[] },
    conflicts: RecommendationResult['conflicts'],
    optionalData: { explanations?: Record<string, string>; filteredScores: AgentScore[] },
    options: RecommendationOptions
  ): RecommendationResult {
    const result: RecommendationResult = { 
      primary: recommendations.primary, 
      suggested: recommendations.suggested, 
      conflicts 
    };
    
    if (optionalData.explanations) {
      result.explanations = optionalData.explanations;
    }
    
    if (options.includeScores) {
      result.scores = optionalData.filteredScores;
    }
    
    return result;
  }

  /**
   * Get access to underlying modules for advanced usage or testing
   */
  getModules() {
    return {
      scoringEngine: this.scoringEngine,
      recommendationStrategy: this.recommendationStrategy,
      conflictAnalyzer: this.conflictAnalyzer,
      explanationGenerator: this.explanationGenerator
    };
  }
}