/**
 * Agent Dependency Resolver
 */

import { AgentMetadata, DependencyResolution } from './types';
import { 
  CollectionContext, 
  ExclusionContext, 
  ConflictProcessingContext,
  DependencyResolverHelpers,
  ResolveOptions 
} from './dependency-resolver-helpers';

export type { ResolveOptions };







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
    const context: CollectionContext = {
      required: new Set<string>(),
      visited: new Set<string>(),
      visitStack: [],
      resolution
    };

    // Collect all required agents (including dependencies)
    for (const agent of selectedAgents) {
      try {
        this.collectDependencies(agent, context);
      } catch (error) {
        // If circular dependency was detected, it's already recorded
        if (!resolution.hasCircularDependency) {
          throw error;
        }
      }
    }

    resolution.requiredAgents = Array.from(context.required);

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


  private collectDependencies(
    agentName: string,
    context: CollectionContext
  ): void {
    const { required, visited, visitStack, resolution } = context;
    
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
      this.collectDependencies(dep, context);
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
  /**
   * Check if an agent should be kept based on dependency status
   */
  private checkDependencyPriority(
    agent1IsDependency: boolean,
    agent2IsDependency: boolean
  ): string | null {
    return DependencyResolverHelpers.checkDependencyPriority(
      agent1IsDependency, 
      agent2IsDependency
    );
  }

  /**
   * Check selection priority when option is set
   */
  private checkSelectionPriority(
    agent1IsSelected: boolean,
    agent2IsSelected: boolean,
    prioritizeSelected: boolean
  ): string | null {
    return DependencyResolverHelpers.checkSelectionPriority(
      agent1IsSelected,
      agent2IsSelected,
      prioritizeSelected
    );
  }

  private determineAgentToExclude(
    context: ExclusionContext
  ): string | null {
    const { agent1, agent2, selectedAgents, requiredAgents, options } = context;
    
    const agent1IsSelected = selectedAgents.includes(agent1);
    const agent2IsSelected = selectedAgents.includes(agent2);
    const agent1IsDependency = !agent1IsSelected && requiredAgents.includes(agent1);
    const agent2IsDependency = !agent2IsSelected && requiredAgents.includes(agent2);

    // Check dependency priority
    const depPriority = this.checkDependencyPriority(agent1IsDependency, agent2IsDependency);
    if (depPriority === 'agent1') return agent1;
    if (depPriority === 'agent2') return agent2;

    // Check selection priority
    const selPriority = this.checkSelectionPriority(
      agent1IsSelected, 
      agent2IsSelected, 
      options.prioritizeSelected || false
    );
    if (selPriority === 'agent1') return agent1;
    if (selPriority === 'agent2') return agent2;

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
  /**
   * Process a single conflict pair
   */
  private processConflictPair(context: ConflictProcessingContext): boolean {
    const { 
      agent1, agent2, resolved, excluded, conflictPairs, 
      selectedAgents, requiredAgents, options 
    } = context;
    
    // Create a unique key for this conflict pair for resolution
    const pairKey = [agent1, agent2].sort().join(':');
    
    // Skip resolution if we've already processed this pair
    if (conflictPairs.has(pairKey)) {
      return false;
    }
    conflictPairs.add(pairKey);

    // Skip resolution if one is already excluded
    if (excluded.has(agent1) || excluded.has(agent2)) {
      return false;
    }

    // Determine which agent to exclude
    const agentToExclude = this.determineAgentToExclude({
      agent1, 
      agent2, 
      selectedAgents, 
      requiredAgents, 
      options
    });

    if (agentToExclude) {
      resolved.delete(agentToExclude);
      excluded.add(agentToExclude);
    }
    
    return true;
  }

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

        // Process the conflict pair
        this.processConflictPair({
          agent1,
          agent2,
          resolved,
          excluded,
          conflictPairs,
          selectedAgents,
          requiredAgents,
          options
        });
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
  /**
   * Add collaborator recommendations from resolved agents
   */
  private addCollaboratorRecommendations(
    resolvedAgents: string[],
    excludedAgents: string[],
    recommendations: Set<string>
  ): void {
    for (const agentName of resolvedAgents) {
      const metadata = this.metadata.get(agentName);
      if (!metadata) continue;

      for (const collaborator of metadata.relationships.collaborates_with) {
        if (this.isValidRecommendation(collaborator, resolvedAgents, excludedAgents)) {
          recommendations.add(collaborator);
        }
      }
    }
  }

  /**
   * Check if an agent is a valid recommendation
   */
  private isValidRecommendation(
    agentName: string,
    resolvedAgents: string[],
    excludedAgents: string[]
  ): boolean {
    return DependencyResolverHelpers.isValidRecommendation(
      agentName,
      resolvedAgents,
      excludedAgents,
      this.metadata.has(agentName)
    );
  }

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

    // Add collaborator recommendations
    this.addCollaboratorRecommendations(resolvedAgents, excludedAgents, recommendations);

    // Filter out any recommendations that conflict with resolved agents
    return Array.from(recommendations).filter(rec => 
      !this.hasConflictWithResolved(rec, resolvedAgents)
    );
  }
}