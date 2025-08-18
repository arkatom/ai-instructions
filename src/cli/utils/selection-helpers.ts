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
   * Perform fuzzy search on agents with relevance scoring
   * Supports multiple search terms and sorts by relevance
   */
  static performSearch(agents: AgentMetadata[], query: string): AgentMetadata[] {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    if (searchTerms.length === 0) {
      return [];
    }

    // Score each agent based on matches
    const scoredAgents = agents.map(agent => {
      let score = 0;
      const nameLower = agent.name.toLowerCase();
      const descLower = agent.description.toLowerCase();
      const tagsLower = (agent.tags || []).map(t => t.toLowerCase());
      
      searchTerms.forEach(term => {
        // Name matches (highest priority)
        if (nameLower === term) {
          score += 100; // Exact name match
        } else if (nameLower.startsWith(term)) {
          score += 50; // Name starts with term
        } else if (nameLower.includes(term)) {
          score += 25; // Name contains term
        }
        
        // Tag matches (high priority)
        if (tagsLower.some(tag => tag === term)) {
          score += 40; // Exact tag match
        } else if (tagsLower.some(tag => tag.includes(term))) {
          score += 20; // Tag contains term
        }
        
        // Description matches (lower priority)
        if (descLower.includes(term)) {
          score += 10; // Description contains term
        }
      });
      
      return { agent, score };
    });
    
    // Filter agents with at least one match and sort by score
    return scoredAgents
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.agent);
  }
}