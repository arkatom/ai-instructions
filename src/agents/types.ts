/**
 * Type definitions for Agent Dependency Management System
 * Defines the structure of agent metadata and relationships
 */

/**
 * Project types for context analysis
 */
export type ProjectType = 'nodejs' | 'typescript' | 'python' | 'rust' | 'go' | 'unknown';

/**
 * Development phases
 */
export type DevelopmentPhase = 'initial-setup' | 'active-development' | 'testing-phase' | 'production-maintenance';

/**
 * Project context information for agent recommendation
 */
export interface ProjectContext {
  projectType: ProjectType;
  frameworks: string[];
  developmentPhase: DevelopmentPhase;
  primaryLanguage?: string;
  teamSize?: number;
  hasTests?: boolean;
  hasCI?: boolean;
  packageManager?: string;
  projectCategory?: 'frontend' | 'backend' | 'fullstack';
  buildTools?: string[];
  lintingTools?: string[];
  testingTools?: string[];
}

/**
 * Agent relationship types
 * Defines different types of dependencies between agents
 */
export interface AgentRelationship {
  /** Agents that must be present for this agent to function */
  requires: string[];
  
  /** Agents whose functionality is improved by this agent */
  enhances: string[];
  
  /** Agents that work well together with this agent */
  collaborates_with: string[];
  
  /** Agents that should not be used with this agent */
  conflicts_with: string[];
}

/**
 * Complete agent metadata structure
 * Contains all information about an agent including its dependencies
 */
export interface AgentMetadata {
  /** Unique identifier for the agent */
  name: string;
  
  /** Category the agent belongs to (e.g., development, testing, security) */
  category: string;
  
  /** Human-readable description of the agent's purpose */
  description: string;
  
  /** Tags for searchability and filtering */
  tags: string[];
  
  /** Relationship definitions with other agents */
  relationships: AgentRelationship;
  
  /** Optional: Source repository the agent came from */
  source?: string;
  
  /** Optional: Version of the agent */
  version?: string;
  
  /** Optional: Author information */
  author?: string;
  
  /** Optional: License information */
  license?: string;
}

/**
 * Agent selection profile
 * Represents a user's selected agents and their configuration
 */
export interface AgentProfile {
  /** Profile name/identifier */
  name: string;
  
  /** List of selected agent names */
  selectedAgents: string[];
  
  /** Project context for the profile */
  context?: {
    projectType?: string;
    frameworks?: string[];
    primaryLanguage?: string;
    developmentPhase?: string;
  };
  
  /** Timestamp when profile was created */
  createdAt?: Date;
  
  /** Timestamp when profile was last modified */
  updatedAt?: Date;
}

/**
 * Dependency resolution result
 * Contains resolved dependencies and any issues found
 */
export interface DependencyResolution {
  /** List of all required agents (including transitively required) */
  requiredAgents: string[];
  
  /** List of recommended agents based on enhancements */
  recommendedAgents: string[];
  
  /** List of conflicting agent pairs */
  conflicts: Array<{
    agent1: string;
    agent2: string;
    reason?: string;
  }>;
  
  /** Whether circular dependencies were detected */
  hasCircularDependency: boolean;
  
  /** Details of circular dependency if found */
  circularDependencyPath?: string[];
  
  /** Final resolved list of agents to use */
  resolvedAgents: string[];
  
  /** Agents that were excluded due to conflicts */
  excludedAgents: string[];
}

/**
 * Agent category information
 * Used for organizing agents by category
 */
export interface AgentCategory {
  /** Category name */
  name: string;
  
  /** Category description */
  description?: string;
  
  /** Number of agents in this category */
  agentCount?: number;
  
  /** Icon or emoji for the category */
  icon?: string;
}

/**
 * Agent search criteria
 * Used for filtering and searching agents
 */
export interface AgentSearchCriteria {
  /** Filter by category */
  category?: string;
  
  /** Filter by tags (any match) */
  tags?: string[];
  
  /** Search in name and description */
  searchText?: string;
  
  /** Include agents from specific source */
  source?: string;
  
  /** Exclude conflicting agents */
  excludeConflictsWith?: string[];
  
  /** Only include agents that enhance these */
  enhances?: string[];
}

/**
 * Agent import result
 * Result of importing agents from external sources
 */
export interface AgentImportResult {
  /** Number of agents successfully imported */
  imported: number;
  
  /** Number of agents skipped (already exist) */
  skipped: number;
  
  /** Number of agents that failed to import */
  failed: number;
  
  /** List of imported agent names */
  importedAgents: string[];
  
  /** List of error messages for failed imports */
  errors: string[];
}

/**
 * Agent validation result
 * Result of validating agent metadata
 */
export interface AgentValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  
  /** List of validation errors */
  errors: string[];
  
  /** List of validation warnings */
  warnings: string[];
  
  /** Missing required fields */
  missingFields?: string[];
  
  /** Invalid field values */
  invalidFields?: Record<string, string>;
}

/**
 * Type guard to check if an object is valid AgentMetadata
 */
export function isAgentMetadata(obj: unknown): obj is AgentMetadata {
  if (!obj || typeof obj !== 'object') return false;
  
  const metadata = obj as Record<string, unknown>;
  
  return (
    typeof metadata.name === 'string' &&
    typeof metadata.category === 'string' &&
    typeof metadata.description === 'string' &&
    Array.isArray(metadata.tags) &&
    metadata.relationships !== undefined &&
    typeof metadata.relationships === 'object'
  );
}

/**
 * Type guard to check if an object is valid AgentRelationship
 */
export function isAgentRelationship(obj: unknown): obj is AgentRelationship {
  if (!obj || typeof obj !== 'object') return false;
  
  const relationship = obj as Record<string, unknown>;
  
  return (
    Array.isArray(relationship.requires) &&
    Array.isArray(relationship.enhances) &&
    Array.isArray(relationship.collaborates_with) &&
    Array.isArray(relationship.conflicts_with)
  );
}