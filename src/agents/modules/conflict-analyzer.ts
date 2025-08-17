/**
 * ConflictAnalyzer - Detects and resolves conflicts between recommended agents
 * Integrates with dependency resolution for comprehensive compatibility analysis
 */

import { AgentMetadata } from '../types';
import { DependencyResolver } from '../dependency-resolver';

/**
 * Conflict information between two agents
 */
export interface ConflictInfo {
  agent1: string;
  agent2: string;
  reason: string;
}

/**
 * Dependency resolution result with conflict information
 */
export interface DependencyResult {
  primary: string[];
  suggested: string[];
  conflicts: ConflictInfo[];
}

/**
 * Validation result for agent compatibility
 */
export interface ValidationResult {
  isValid: boolean;
  conflicts: ConflictInfo[];
  warnings: string[];
}

/**
 * ConflictAnalyzer class - Analyzes and resolves agent conflicts
 */
export class ConflictAnalyzer {
  private readonly dependencyResolver: DependencyResolver;
  private readonly agents: AgentMetadata[];

  constructor(agents: AgentMetadata[], dependencyResolver: DependencyResolver) {
    this.agents = agents;
    this.dependencyResolver = dependencyResolver;
  }

  /**
   * Detect basic conflicts between a list of agents
   */
  detectBasicConflicts(agentNames: string[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    
    for (let i = 0; i < agentNames.length; i++) {
      const agentName1 = agentNames[i];
      if (!agentName1) continue;
      
      const agent1 = this.findAgentByName(agentName1);
      if (!agent1) continue;
      
      for (let j = i + 1; j < agentNames.length; j++) {
        const agentName2 = agentNames[j];
        if (!agentName2) continue;
        
        const agent2 = this.findAgentByName(agentName2);
        if (!agent2) continue;
        
        const conflict = this.checkDirectConflict(agent1, agent2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Handle comprehensive dependency resolution and conflict detection
   */
  resolveDependencies(primary: string[], suggested: string[]): DependencyResult {
    const allRecommended = [...primary, ...suggested];
    const resolution = this.dependencyResolver.resolve(allRecommended);
    
    // Process dependency resolution results
    return this.processDependencyResolution(
      primary, 
      suggested, 
      resolution, 
      allRecommended
    );
  }

  /**
   * Validate compatibility of a set of agents
   */
  validateCompatibility(agentNames: string[]): ValidationResult {
    const conflicts = this.detectBasicConflicts(agentNames);
    const warnings = this.generateCompatibilityWarnings(agentNames);
    
    return {
      isValid: conflicts.length === 0,
      conflicts,
      warnings
    };
  }

  /**
   * Check for technology stack conflicts
   */
  detectTechnologyConflicts(agentNames: string[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const agents = agentNames
      .map(name => this.findAgentByName(name))
      .filter((agent): agent is AgentMetadata => agent !== undefined);
    
    // Check for framework conflicts
    const frameworkConflicts = this.detectFrameworkConflicts(agents);
    conflicts.push(...frameworkConflicts);
    
    // Check for language conflicts
    const languageConflicts = this.detectLanguageConflicts(agents);
    conflicts.push(...languageConflicts);
    
    return conflicts;
  }

  /**
   * Get conflict resolution suggestions
   */
  getConflictResolutionSuggestions(conflicts: ConflictInfo[]): string[] {
    const suggestions: string[] = [];
    
    for (const conflict of conflicts) {
      const agent1 = this.findAgentByName(conflict.agent1);
      const agent2 = this.findAgentByName(conflict.agent2);
      
      if (agent1 && agent2) {
        const suggestion = this.generateResolutionSuggestion(agent1, agent2, conflict.reason);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Check direct conflict between two agents
   */
  private checkDirectConflict(agent1: AgentMetadata, agent2: AgentMetadata): ConflictInfo | null {
    if (agent1.relationships.conflicts_with.includes(agent2.name)) {
      return {
        agent1: agent1.name,
        agent2: agent2.name,
        reason: `${agent1.name} explicitly conflicts with ${agent2.name}`
      };
    }
    
    if (agent2.relationships.conflicts_with.includes(agent1.name)) {
      return {
        agent1: agent1.name,
        agent2: agent2.name,
        reason: `${agent2.name} explicitly conflicts with ${agent1.name}`
      };
    }
    
    return null;
  }

  /**
   * Process dependency resolution results
   */
  private processDependencyResolution(
    primary: string[],
    suggested: string[],
    resolution: any,
    allRecommended: string[]
  ): DependencyResult {
    const updatedPrimary = [...primary];
    const updatedSuggested = [...suggested];
    
    // Add required dependencies to primary recommendations
    resolution.requiredAgents?.forEach((agent: string) => {
      if (!primary.includes(agent) && !suggested.includes(agent)) {
        // Remove from suggested if it exists and add to primary
        const suggestedIndex = updatedSuggested.indexOf(agent);
        if (suggestedIndex !== -1) {
          updatedSuggested.splice(suggestedIndex, 1);
        }
        if (!updatedPrimary.includes(agent)) {
          updatedPrimary.push(agent);
        }
      }
    });
    
    // Filter and format conflicts
    const conflicts = this.formatDependencyConflicts(resolution.conflicts, allRecommended);
    
    return {
      primary: updatedPrimary,
      suggested: updatedSuggested,
      conflicts
    };
  }

  /**
   * Format dependency resolver conflicts into ConflictInfo format
   */
  private formatDependencyConflicts(
    dependencyConflicts: any[],
    allRecommended: string[]
  ): ConflictInfo[] {
    return dependencyConflicts
      .filter((conflict: any) => 
        allRecommended.includes(conflict.agent1) && 
        allRecommended.includes(conflict.agent2)
      )
      .map((conflict: any) => ({
        agent1: conflict.agent1,
        agent2: conflict.agent2,
        reason: conflict.reason || 'Agents have conflicting requirements'
      }));
  }

  /**
   * Detect framework-specific conflicts
   */
  private detectFrameworkConflicts(agents: AgentMetadata[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const frameworkAgents = new Map<string, AgentMetadata[]>();
    
    // Group agents by framework
    for (const agent of agents) {
      const frameworks = agent.tags.filter(tag => 
        ['react', 'vue', 'angular', 'svelte'].includes(tag)
      );
      
      for (const framework of frameworks) {
        if (!frameworkAgents.has(framework)) {
          frameworkAgents.set(framework, []);
        }
        frameworkAgents.get(framework)!.push(agent);
      }
    }
    
    // Check for conflicting frameworks
    const frameworks = Array.from(frameworkAgents.keys());
    const conflictingFrameworks: [string, string][] = [
      ['react', 'angular'],
      ['react', 'vue'],
      ['angular', 'vue']
    ];
    
    for (const [fw1, fw2] of conflictingFrameworks) {
      if (frameworks.includes(fw1) && frameworks.includes(fw2)) {
        const agents1 = frameworkAgents.get(fw1);
        const agents2 = frameworkAgents.get(fw2);
        
        if (!agents1 || !agents2) continue;
        
        for (const agent1 of agents1) {
          for (const agent2 of agents2) {
            conflicts.push({
              agent1: agent1.name,
              agent2: agent2.name,
              reason: `Conflicting frameworks: ${fw1} vs ${fw2}`
            });
          }
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Detect language-specific conflicts
   */
  private detectLanguageConflicts(agents: AgentMetadata[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const languageAgents = new Map<string, AgentMetadata[]>();
    
    // Group agents by primary language (excluding JS/TS which are compatible)
    const languages = ['python', 'rust', 'go', 'java'];
    
    for (const agent of agents) {
      for (const language of languages) {
        if (agent.tags.includes(language)) {
          if (!languageAgents.has(language)) {
            languageAgents.set(language, []);
          }
          languageAgents.get(language)!.push(agent);
        }
      }
    }
    
    // For now, we don't enforce strict language conflicts
    // This could be extended for specific incompatible combinations
    
    return conflicts;
  }

  /**
   * Generate compatibility warnings
   */
  private generateCompatibilityWarnings(agentNames: string[]): string[] {
    const warnings: string[] = [];
    const agents = agentNames
      .map(name => this.findAgentByName(name))
      .filter((agent): agent is AgentMetadata => agent !== undefined);
    
    // Check for category balance
    const categories = agents.map(a => a.category);
    const categoryCount = new Map<string, number>();
    
    for (const category of categories) {
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }
    
    if (categoryCount.get('development') === 0) {
      warnings.push('No development agents selected - consider adding at least one');
    }
    
    if (agents.length > 5) {
      warnings.push('Large number of agents selected - consider focusing on core requirements');
    }
    
    return warnings;
  }

  /**
   * Generate resolution suggestion for a conflict
   */
  private generateResolutionSuggestion(
    agent1: AgentMetadata, 
    agent2: AgentMetadata, 
    reason: string
  ): string | null {
    if (reason.includes('framework')) {
      return `Consider choosing either ${agent1.name} or ${agent2.name} based on your primary framework`;
    }
    
    if (reason.includes('conflicts_with')) {
      return `Remove either ${agent1.name} or ${agent2.name} as they cannot work together`;
    }
    
    return null;
  }

  /**
   * Find agent by name
   */
  private findAgentByName(name: string): AgentMetadata | undefined {
    return this.agents.find(agent => agent.name === name);
  }
}