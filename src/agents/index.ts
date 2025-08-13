/**
 * Agent Dependency Management System
 * Barrel export file for clean imports
 */

// Core classes
export { AgentMetadataLoader } from './metadata-loader';
export { DependencyResolver } from './dependency-resolver';

// Type definitions
export type {
  AgentMetadata,
  AgentRelationship,
  AgentProfile,
  DependencyResolution,
  AgentCategory,
  AgentSearchCriteria,
  AgentImportResult,
  AgentValidationResult
} from './types';

// Type guards
export { isAgentMetadata, isAgentRelationship } from './types';

// Re-export options interfaces
export type { ResolveOptions } from './dependency-resolver';