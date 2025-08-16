/**
 * Recommendation Engine Modules - Modular architecture for agent recommendation system
 * Exports all specialized modules for clean dependency management
 */

// Core scoring functionality
export { ScoringEngine } from './scoring-engine';
export type { AgentScore, ScoreBreakdown } from './scoring-engine';

// Strategy and filtering
export { RecommendationStrategy } from './recommendation-strategy';
export type { RecommendationOptions, CategorizedAgents } from './recommendation-strategy';

// Conflict detection and resolution
export { ConflictAnalyzer } from './conflict-analyzer';
export type { ConflictInfo, DependencyResult, ValidationResult } from './conflict-analyzer';

// Explanation generation
export { ExplanationGenerator } from './explanation-generator';

/**
 * Module version and metadata
 */
export const MODULES_VERSION = '1.0.0';
export const MODULES_CREATED = '2024-08-16';

/**
 * Module architecture notes:
 * 
 * - ScoringEngine: Handles complex multi-dimensional scoring (270 lines)
 * - RecommendationStrategy: Manages filtering and categorization (240 lines)
 * - ConflictAnalyzer: Detects conflicts and resolves dependencies (290 lines)
 * - ExplanationGenerator: Creates human-readable explanations (280 lines)
 * 
 * Total: ~1080 lines modularized from original 670-line monolith
 * Each module follows single responsibility principle with <300 lines
 */