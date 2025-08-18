/**
 * Interactive Agent Selector Implementation
 * Issue #97: Interactive UI for agent list command
 */

import inquirer from 'inquirer';
import { AgentMetadata } from '../agents/types';
import { Logger } from '../utils/logger';
import {
  SelectionMode,
  InteractiveSelectorConfig,
  SelectionResult,
  MenuChoice,
  CategoryStats,
  IInteractiveAgentSelector
} from './interfaces/InteractiveAgentSelector';
import { SelectionHelpers } from './utils/selection-helpers';
import { PaginationHelpers } from './utils/pagination-helpers';
import { DisplayHelpers } from './utils/display-helpers';
import { RecommendationHelpers } from './utils/recommendation-helpers';
import { AgentSelectionHelpers } from './utils/agent-selection-helpers';

/**
 * Interactive agent selector with category browsing, search, and pagination
 */
export class InteractiveAgentSelector implements IInteractiveAgentSelector {
  private config: InteractiveSelectorConfig;
  private readonly MIN_PAGE_SIZE = 5;
  private readonly MAX_PAGE_SIZE = 50;
  private readonly DEFAULT_MENU_PAGE_SIZE = 10;

  constructor(config: InteractiveSelectorConfig) {
    // Validate and set config
    this.config = {
      ...config,
      pageSize: this.validatePageSize(config.pageSize)
    };
  }

  /**
   * Validate page size is within acceptable range
   */
  private validatePageSize(pageSize: number): number {
    if (pageSize < this.MIN_PAGE_SIZE) {
      Logger.warn(`Page size ${pageSize} is too small, using minimum ${this.MIN_PAGE_SIZE}`);
      return this.MIN_PAGE_SIZE;
    }
    
    if (pageSize > this.MAX_PAGE_SIZE) {
      Logger.warn(`Page size ${pageSize} is too large, using maximum ${this.MAX_PAGE_SIZE}`);
      return this.MAX_PAGE_SIZE;
    }
    
    return pageSize;
  }

  /**
   * Show main menu and get user selection mode
   */
  async showMainMenu(): Promise<SelectionMode> {
    const choices: MenuChoice[] = [
      { name: '📁 Browse by Category', value: 'category', short: 'Category' },
      { name: '🔍 Search Agents', value: 'search', short: 'Search' },
      { name: '📋 View All (Paginated)', value: 'all', short: 'All' },
      { name: '⭐ Recommended Agents', value: 'recommended', short: 'Recommended' },
      { name: '❌ Exit', value: 'exit', short: 'Exit' }
    ];

    try {
      const { mode } = await inquirer.prompt([{
        type: 'list',
        name: 'mode',
        message: 'Select viewing mode:',
        choices,
        pageSize: this.DEFAULT_MENU_PAGE_SIZE
      }]);

      if (mode === 'exit') {
        throw new Error('User cancelled');
      }

      return mode as SelectionMode;
    } catch (error) {
      // Handle prompt cancellation (Ctrl+C) or other errors
      if (error instanceof Error && error.message === 'User cancelled') {
        throw error;
      }
      Logger.error('Failed to show main menu', error);
      throw new Error('Menu selection failed');
    }
  }

  /**
   * Browse agents by category
   */
  async browseByCategory(agents: AgentMetadata[]): Promise<SelectionResult> {
    if (agents.length === 0) {
      return SelectionHelpers.createEmptyResult('category');
    }

    const category = await AgentSelectionHelpers.selectCategory(
      agents,
      (agents) => this.getCategoryStats(agents),
      (category, color) => DisplayHelpers.colorizeCategory(category, color, this.config.enableColors),
      this.config
    );

    if (category === '_back') {
      return SelectionHelpers.createCancelledResult('category');
    }

    const categoryAgents = agents.filter(a => a.category === category);
    return AgentSelectionHelpers.selectAgentsFromList(
      categoryAgents, 
      agents, 
      'category', 
      `Select agents from ${category}:`,
      this.config,
      (agent) => this.formatAgentChoice(agent)
    );
  }

  /**
   * Search agents with fuzzy matching
   */
  async searchAgents(agents: AgentMetadata[]): Promise<SelectionResult> {
    const query = await AgentSelectionHelpers.getSearchQuery();
    const matchedAgents = SelectionHelpers.performSearch(agents, query);

    if (matchedAgents.length === 0) {
      Logger.warn('No agents found matching your search.');
      return SelectionHelpers.createEmptyResult('search');
    }

    return AgentSelectionHelpers.selectAgentsFromList(
      matchedAgents, 
      agents, 
      'search', 
      `Found ${matchedAgents.length} agents. Select agents:`,
      this.config,
      (agent) => this.formatAgentChoice(agent)
    );
  }

  /**
   * Show all agents with pagination
   */
  async viewAllPaginated(agents: AgentMetadata[]): Promise<SelectionResult> {
    if (agents.length === 0) {
      return SelectionHelpers.createEmptyResult('all');
    }

    let currentPage = 0;
    const totalPages = Math.ceil(agents.length / this.config.pageSize);

    while (true) {
      const pageResult = await PaginationHelpers.handlePaginationPage(
        agents, 
        currentPage, 
        totalPages,
        this.config,
        (agent) => this.formatAgentChoice(agent)
      );
      
      if (pageResult.action === '_prev') {
        currentPage--;
      } else if (pageResult.action === '_next') {
        currentPage++;
      } else if (pageResult.action === '_cancel') {
        return SelectionHelpers.createCancelledResult('all');
      } else {
        return SelectionHelpers.createSelectionResult(pageResult.selectedAgents, 'all');
      }
    }
  }

  /**
   * Show recommended agents based on context
   */
  async showRecommended(agents: AgentMetadata[]): Promise<SelectionResult> {
    const recommendedAgents = this.getRecommendedAgents(agents);

    if (recommendedAgents.length === 0) {
      Logger.warn('No recommended agents available.');
      return SelectionHelpers.createEmptyResult('recommended');
    }

    return RecommendationHelpers.selectRecommendedAgents(
      recommendedAgents, 
      agents,
      this.config,
      (agent) => this.formatAgentChoice(agent)
    );
  }

  /**
   * Display detailed agent information
   */
  async showAgentDetails(agent: AgentMetadata): Promise<void> {
    const details = DisplayHelpers.formatAgentDetails(agent, this.config.enableColors);
    Logger.info(details);
  }

  /**
   * Get category statistics
   */
  getCategoryStats(agents: AgentMetadata[]): CategoryStats[] {
    const categoryMap = new Map<string, number>();
    
    agents.forEach(agent => {
      const count = categoryMap.get(agent.category) || 0;
      categoryMap.set(agent.category, count + 1);
    });
    
    const stats: CategoryStats[] = [];
    categoryMap.forEach((count, category) => {
      stats.push({
        category,
        count,
        color: DisplayHelpers.getCategoryColor(category),
        icon: DisplayHelpers.getCategoryIcon(category)
      });
    });
    
    return stats.sort((a, b) => a.category.localeCompare(b.category));
  }

  /**
   * Get recommended agents (mock implementation for now)
   */
  getRecommendedAgents(agents: AgentMetadata[]): AgentMetadata[] {
    // This would normally analyze project context
    // For now, return first 5 agents as mock
    return agents.slice(0, 5);
  }

  /**
   * Helper: Format agent choice for display
   */
  private formatAgentChoice(agent: AgentMetadata): string {
    return DisplayHelpers.formatAgentChoice(agent, this.config.showDescriptions, this.config.enableColors);
  }
}