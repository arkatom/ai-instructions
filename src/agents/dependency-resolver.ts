/**
 * Agent Dependency Resolver
 * Resolves agent dependencies, detects conflicts, and identifies circular dependencies
 */

import { AgentMetadata, DependencyResolution } from './types';

/**
 * Options for dependency resolution
 */
export interface ResolveOptions {
  /** Whether to prioritize explicitly selected agents over conflicts */
  prioritizeSelected?: boolean;
}

/**
 * Dependency Resolver class
 * Handles complex dependency resolution for agent selection
 */
export class DependencyResolver {
  private metadata: Map<string, AgentMetadata>;

  constructor(metadata: Map<string, AgentMetadata>) {
    this.metadata = metadata;
  }

  /**
   * Resolve dependencies for selected agents
   * @param selectedAgents - List of explicitly selected agent names
   * @param options - Resolution options
   * @returns Complete dependency resolution result
   */
  resolve(selectedAgents: string[], options: ResolveOptions = {}): DependencyResolution {
    const resolution: DependencyResolution = {
      requiredAgents: [],
      recommendedAgents: [],
      conflicts: [],
      hasCircularDependency: false,
      resolvedAgents: [],
      excludedAgents: []
    };

    // Track visited agents for circular dependency detection
    const visitStack: string[] = [];
    const visited = new Set<string>();
    const required = new Set<string>();

    // Collect all required agents (including dependencies)
    for (const agent of selectedAgents) {
      try {
        this.collectDependencies(agent, required, visited, visitStack, resolution);
      } catch (error) {
        // If circular dependency was detected, it's already recorded
        if (!resolution.hasCircularDependency) {
          throw error;
        }
      }
    }

    resolution.requiredAgents = Array.from(required);

    // Check for conflicts
    const conflictMap = this.detectConflicts(resolution.requiredAgents);
    
    // Resolve conflicts
    const { resolved, excluded, conflicts } = this.resolveConflicts(
      resolution.requiredAgents,
      conflictMap,
      selectedAgents,
      options
    );

    resolution.resolvedAgents = resolved;
    resolution.excludedAgents = excluded;
    resolution.conflicts = conflicts;

    // Find recommended agents (enhancers and collaborators)
    resolution.recommendedAgents = this.findRecommendations(
      resolution.resolvedAgents,
      resolution.excludedAgents
    );

    return resolution;
  }

  /**
   * Recursively collect dependencies for an agent
   * @param agentName - Agent to process
   * @param required - Set of required agents (accumulator)
   * @param visited - Set of fully processed agents
   * @param visitStack - Current visit stack for circular detection
   * @param resolution - Resolution object to update if circular dependency found
   */
  private collectDependencies(
    agentName: string,
    required: Set<string>,
    visited: Set<string>,
    visitStack: string[],
    resolution: DependencyResolution
  ): void {
    // Check for circular dependency
    if (visitStack.includes(agentName)) {
      resolution.hasCircularDependency = true;
      const cycleStart = visitStack.indexOf(agentName);
      resolution.circularDependencyPath = [...visitStack.slice(cycleStart), agentName];
      return;
    }

    // Skip if already fully processed
    if (visited.has(agentName)) {
      return;
    }

    const metadata = this.metadata.get(agentName);
    if (!metadata) {
      throw new Error(`Missing dependency: ${agentName} required by ${visitStack[visitStack.length - 1] || 'user selection'}`);
    }

    // Add to required set
    required.add(agentName);
    
    // Add to visit stack
    visitStack.push(agentName);

    // Process dependencies
    for (const dep of metadata.relationships.requires) {
      this.collectDependencies(dep, required, visited, visitStack, resolution);
    }

    // Remove from visit stack and mark as visited
    visitStack.pop();
    visited.add(agentName);
  }

  /**
   * Detect conflicts between agents
   * @param agents - List of agents to check
   * @returns Map of agent to list of agents it conflicts with
   */
  private detectConflicts(agents: string[]): Map<string, string[]> {
    const conflictMap = new Map<string, string[]>();

    for (const agent of agents) {
      const metadata = this.metadata.get(agent);
      if (!metadata) continue;

      const conflicts: string[] = [];
      for (const conflictAgent of metadata.relationships.conflicts_with) {
        if (agents.includes(conflictAgent)) {
          conflicts.push(conflictAgent);
        }
      }

      if (conflicts.length > 0) {
        conflictMap.set(agent, conflicts);
      }
    }

    return conflictMap;
  }

  /**
   * Determine which agent to exclude in a conflict
   * @param agent1 - First agent in conflict
   * @param agent2 - Second agent in conflict
   * @param selectedAgents - Originally selected agents
   * @param requiredAgents - All required agents
   * @param options - Resolution options
   * @returns The agent to exclude, or null if neither should be excluded
   */
  private determineAgentToExclude(
    agent1: string,
    agent2: string,
    selectedAgents: string[],
    requiredAgents: string[],
    options: ResolveOptions
  ): string | null {
    const agent1IsSelected = selectedAgents.includes(agent1);
    const agent2IsSelected = selectedAgents.includes(agent2);
    const agent1IsDependency = !agent1IsSelected && requiredAgents.includes(agent1);
    const agent2IsDependency = !agent2IsSelected && requiredAgents.includes(agent2);

    // If one is a dependency and the other is selected, keep the dependency
    if (agent1IsDependency && !agent2IsDependency) {
      return agent2;
    }
    if (agent2IsDependency && !agent1IsDependency) {
      return agent1;
    }

    // Prioritize explicitly selected agents if option is set
    if (options.prioritizeSelected) {
      if (agent1IsSelected && !agent2IsSelected) {
        return agent2;
      }
      if (agent2IsSelected && !agent1IsSelected) {
        return agent1;
      }
    }

    // Default: keep the first alphabetically
    return agent1 < agent2 ? agent2 : agent1;
  }

  /**
   * Resolve conflicts between agents
   * @param requiredAgents - All required agents
   * @param conflictMap - Map of conflicts
   * @param selectedAgents - Originally selected agents
   * @param options - Resolution options
   * @returns Resolved agents, excluded agents, and conflict details
   */
  private resolveConflicts(
    requiredAgents: string[],
    conflictMap: Map<string, string[]>,
    selectedAgents: string[],
    options: ResolveOptions
  ): {
    resolved: string[];
    excluded: string[];
    conflicts: Array<{ agent1: string; agent2: string; reason?: string }>;
  } {
    const resolved = new Set<string>(requiredAgents);
    const excluded = new Set<string>();
    const conflicts: Array<{ agent1: string; agent2: string; reason?: string }> = [];
    const conflictPairs = new Set<string>(); // Track processed conflict pairs

    // Process each conflict
    for (const [agent1, conflictsList] of conflictMap.entries()) {
      for (const agent2 of conflictsList) {
        // Record the conflict (keep all directions for reporting)
        conflicts.push({
          agent1,
          agent2,
          reason: 'Direct conflict'
        });

        // Create a unique key for this conflict pair for resolution
        const pairKey = [agent1, agent2].sort().join(':');
        
        // Skip resolution if we've already processed this pair
        if (conflictPairs.has(pairKey)) {
          continue;
        }
        conflictPairs.add(pairKey);

        // Skip resolution if one is already excluded
        if (excluded.has(agent1) || excluded.has(agent2)) {
          continue;
        }

        // Determine which agent to exclude
        const agentToExclude = this.determineAgentToExclude(
          agent1, 
          agent2, 
          selectedAgents, 
          requiredAgents, 
          options
        );

        if (agentToExclude) {
          resolved.delete(agentToExclude);
          excluded.add(agentToExclude);
        }
      }
    }

    return {
      resolved: Array.from(resolved),
      excluded: Array.from(excluded),
      conflicts
    };
  }

  /**
   * Check if an agent enhances or collaborates with resolved agents
   * @param metadata - Agent's metadata
   * @param resolvedAgents - List of resolved agents
   * @returns True if agent should be recommended
   */
  private shouldRecommendAgent(
    metadata: AgentMetadata,
    resolvedAgents: string[]
  ): boolean {
    // Check if this agent enhances any resolved agents
    for (const enhanced of metadata.relationships.enhances) {
      if (resolvedAgents.includes(enhanced)) {
        return true;
      }
    }

    // Check if this agent collaborates with any resolved agents
    for (const collaborator of metadata.relationships.collaborates_with) {
      if (resolvedAgents.includes(collaborator)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an agent has conflicts with resolved agents
   * @param agentName - Agent to check
   * @param resolvedAgents - List of resolved agents
   * @returns True if agent conflicts with any resolved agent
   */
  private hasConflictWithResolved(
    agentName: string,
    resolvedAgents: string[]
  ): boolean {
    const recMetadata = this.metadata.get(agentName);
    if (!recMetadata) return true;

    // Check if recommended agent conflicts with any resolved agent
    for (const conflict of recMetadata.relationships.conflicts_with) {
      if (resolvedAgents.includes(conflict)) {
        return true;
      }
    }

    // Check if any resolved agent conflicts with this recommendation
    for (const resolved of resolvedAgents) {
      const resolvedMeta = this.metadata.get(resolved);
      if (resolvedMeta?.relationships.conflicts_with.includes(agentName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find recommended agents based on enhancements and collaborations
   * @param resolvedAgents - List of resolved agents
   * @param excludedAgents - List of excluded agents
   * @returns List of recommended agent names
   */
  private findRecommendations(
    resolvedAgents: string[],
    excludedAgents: string[]
  ): string[] {
    const recommendations = new Set<string>();

    // Check all agents in metadata
    for (const [agentName, metadata] of this.metadata.entries()) {
      // Skip if already included or excluded
      if (resolvedAgents.includes(agentName) || excludedAgents.includes(agentName)) {
        continue;
      }

      if (this.shouldRecommendAgent(metadata, resolvedAgents)) {
        recommendations.add(agentName);
      }
    }

    // Also check if resolved agents mention collaborators
    for (const agentName of resolvedAgents) {
      const metadata = this.metadata.get(agentName);
      if (!metadata) continue;

      for (const collaborator of metadata.relationships.collaborates_with) {
        if (!resolvedAgents.includes(collaborator) && 
            !excludedAgents.includes(collaborator) &&
            this.metadata.has(collaborator)) {
          recommendations.add(collaborator);
        }
      }
    }

    // Filter out any recommendations that conflict with resolved agents
    return Array.from(recommendations).filter(rec => 
      !this.hasConflictWithResolved(rec, resolvedAgents)
    );
  }
}