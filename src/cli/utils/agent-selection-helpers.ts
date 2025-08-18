/**
 * Agent Selection Helper Utilities
 * Helper functions for agent selection workflows
 */

import inquirer from 'inquirer';
import { AgentMetadata } from '../../agents/types';
import { SelectionResult, MenuChoice, SelectionMode, InteractiveSelectorConfig } from '../interfaces/InteractiveAgentSelector';
import { SelectionHelpers } from './selection-helpers';

export class AgentSelectionHelpers {
  /**
   * Select agents from a filtered list
   */
  static async selectAgentsFromList(
    availableAgents: AgentMetadata[], 
    allAgents: AgentMetadata[], 
    mode: SelectionMode, 
    message: string,
    config: InteractiveSelectorConfig,
    formatAgentChoice: (agent: AgentMetadata) => string
  ): Promise<SelectionResult> {
    const agentChoices = availableAgents.map(agent => ({
      name: formatAgentChoice(agent),
      value: agent.name
    }));

    if (config.enableMultiSelect) {
      return AgentSelectionHelpers.handleMultiSelect(agentChoices, allAgents, mode, message, config);
    } else {
      return AgentSelectionHelpers.handleSingleSelect(agentChoices, allAgents, mode, message, config);
    }
  }

  /**
   * Handle multi-select agent selection
   */
  private static async handleMultiSelect(
    agentChoices: MenuChoice[], 
    allAgents: AgentMetadata[], 
    mode: SelectionMode, 
    message: string,
    config: InteractiveSelectorConfig
  ): Promise<SelectionResult> {
    const { agents: selectedNames } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'agents',
      message,
      choices: agentChoices,
      pageSize: config.pageSize
    }]);

    const selectedAgents = allAgents.filter(a => selectedNames.includes(a.name));
    return SelectionHelpers.createSelectionResult(selectedAgents, mode);
  }

  /**
   * Handle single-select agent selection
   */
  private static async handleSingleSelect(
    agentChoices: MenuChoice[], 
    allAgents: AgentMetadata[], 
    mode: SelectionMode, 
    message: string,
    config: InteractiveSelectorConfig
  ): Promise<SelectionResult> {
    const { agent: selectedName } = await inquirer.prompt([{
      type: 'list',
      name: 'agent',
      message,
      choices: agentChoices,
      pageSize: config.pageSize
    }]);

    const selectedAgent = allAgents.find(a => a.name === selectedName);
    return SelectionHelpers.createSelectionResult(selectedAgent ? [selectedAgent] : [], mode);
  }

  /**
   * Get search query from user
   */
  static async getSearchQuery(): Promise<string> {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Enter search query:',
      validate: (input: string) => input.length > 0 || 'Please enter a search query'
    }]);
    return query;
  }

  /**
   * Select category from stats
   */
  static async selectCategory(
    agents: AgentMetadata[],
    getCategoryStats: (agents: AgentMetadata[]) => Array<{ category: string, count: number, color: string, icon: string }>,
    colorizeCategory: (category: string, color: string) => string,
    config: InteractiveSelectorConfig
  ): Promise<string> {
    const stats = getCategoryStats(agents);
    const categoryChoices = stats.map(stat => ({
      name: `${stat.icon} ${colorizeCategory(stat.category, stat.color)} (${stat.count} agents)`,
      value: stat.category
    }));

    const { category } = await inquirer.prompt([{
      type: 'list',
      name: 'category',
      message: 'Select a category:',
      choices: [
        ...categoryChoices,
        { name: '← Back', value: '_back' }
      ],
      pageSize: config.pageSize
    }]);

    return category;
  }
}