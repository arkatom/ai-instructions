/**
 * Interactive Agent Selector Interface
 * Issue #97: Interactive UI for agent list command
 */

import { AgentMetadata } from '../../agents/types';

/**
 * Interactive UI modes for agent selection
 */
export type SelectionMode = 
  | 'category'    // Browse by category
  | 'search'      // Fuzzy search
  | 'all'         // View all with pagination
  | 'recommended' // Context-aware recommendations;

/**
 * Configuration for interactive selector
 */
export interface InteractiveSelectorConfig {
  pageSize: number;
  showDescriptions: boolean;
  enableColors: boolean;
  enableMultiSelect: boolean;
  searchThreshold: number; // Fuzzy search sensitivity
}

/**
 * Result from interactive selection
 */
export interface SelectionResult {
  selectedAgents: AgentMetadata[];
  mode: SelectionMode;
  cancelled: boolean;
}

/**
 * Display options for agent list
 */
export interface DisplayOptions {
  format: 'table' | 'json' | 'tree' | 'interactive';
  category?: string;
  verbose?: boolean;
}

/**
 * Interactive prompt choices
 */
export interface MenuChoice {
  name: string;
  value: string;
  short?: string;
}

/**
 * Category statistics for display
 */
export interface CategoryStats {
  category: string;
  count: number;
  color: string;
  icon: string;
}

/**
 * Main interface for interactive agent selection
 */
export interface IInteractiveAgentSelector {
  /**
   * Show main menu and get user selection mode
   */
  showMainMenu(): Promise<SelectionMode>;

  /**
   * Browse agents by category
   */
  browseByCategory(agents: AgentMetadata[]): Promise<SelectionResult>;

  /**
   * Search agents with fuzzy matching
   */
  searchAgents(agents: AgentMetadata[]): Promise<SelectionResult>;

  /**
   * Show all agents with pagination
   */
  viewAllPaginated(agents: AgentMetadata[]): Promise<SelectionResult>;

  /**
   * Show recommended agents based on context
   */
  showRecommended(agents: AgentMetadata[]): Promise<SelectionResult>;

  /**
   * Display detailed agent information
   */
  showAgentDetails(agent: AgentMetadata): Promise<void>;

  /**
   * Get category statistics
   */
  getCategoryStats(agents: AgentMetadata[]): CategoryStats[];
}