/**
 * Selection Helper Utilities
 * Helper functions for agent selection and results
 */

import { AgentMetadata } from '../../agents/types';
import { SelectionMode, SelectionResult } from '../interfaces/InteractiveAgentSelector';

export class SelectionHelpers {
  /**
   * Create empty selection result
   */
  static createEmptyResult(mode: SelectionMode): SelectionResult {
    return {
      selectedAgents: [],
      mode,
      cancelled: false
    };
  }

  /**
   * Create cancelled selection result
   */
  static createCancelledResult(mode: SelectionMode): SelectionResult {
    return {
      selectedAgents: [],
      mode,
      cancelled: true
    };
  }

  /**
   * Create selection result with agents
   */
  static createSelectionResult(selectedAgents: AgentMetadata[], mode: SelectionMode): SelectionResult {
    return {
      selectedAgents,
      mode,
      cancelled: false
    };
  }

  /**
   * Perform fuzzy search on agents
   */
  static performSearch(agents: AgentMetadata[], query: string): AgentMetadata[] {
    const searchLower = query.toLowerCase();
    return agents.filter(agent => {
      const searchIn = [
        agent.name,
        agent.description,
        ...(agent.tags || [])
      ].join(' ').toLowerCase();
      
      return searchIn.includes(searchLower);
    });
  }
}