/**
 * Helper methods for DependencyResolver
 */

import { DependencyResolution } from './types';

/** Options for dependency resolution */
export interface ResolveOptions {
  prioritizeSelected?: boolean;
}

/**
 * Context for collecting dependencies
 */
export interface CollectionContext {
  required: Set<string>;
  visited: Set<string>;
  visitStack: string[];
  resolution: DependencyResolution;
}

/**
 * Context for determining agent exclusion
 */
export interface ExclusionContext {
  agent1: string;
  agent2: string;
  selectedAgents: string[];
  requiredAgents: string[];
  options: ResolveOptions;
}

/**
 * Context for processing conflict pairs
 */
export interface ConflictProcessingContext {
  agent1: string;
  agent2: string;
  resolved: Set<string>;
  excluded: Set<string>;
  conflictPairs: Set<string>;
  selectedAgents: string[];
  requiredAgents: string[];
  options: ResolveOptions;
}

export class DependencyResolverHelpers {
  /**
   * Check if an agent should be kept based on dependency status
   */
  static checkDependencyPriority(
    agent1IsDependency: boolean,
    agent2IsDependency: boolean
  ): string | null {
    if (agent1IsDependency && !agent2IsDependency) {
      return 'agent2'; // Exclude agent2, keep dependency agent1
    }
    if (agent2IsDependency && !agent1IsDependency) {
      return 'agent1'; // Exclude agent1, keep dependency agent2
    }
    return null;
  }

  /**
   * Check selection priority when option is set
   */
  static checkSelectionPriority(
    agent1IsSelected: boolean,
    agent2IsSelected: boolean,
    prioritizeSelected: boolean
  ): string | null {
    if (!prioritizeSelected) {
      return null;
    }
    
    if (agent1IsSelected && !agent2IsSelected) {
      return 'agent2';
    }
    if (agent2IsSelected && !agent1IsSelected) {
      return 'agent1';
    }
    return null;
  }

  /**
   * Check if an agent is a valid recommendation
   */
  static isValidRecommendation(
    agentName: string,
    resolvedAgents: string[],
    excludedAgents: string[],
    hasMetadata: boolean
  ): boolean {
    return !resolvedAgents.includes(agentName) && 
           !excludedAgents.includes(agentName) &&
           hasMetadata;
  }
}