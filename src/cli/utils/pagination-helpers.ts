/**
 * Pagination Helper Utilities
 * Helper functions for paginated agent selection
 */

import inquirer from 'inquirer';
import { AgentMetadata } from '../../agents/types';
import { MenuChoice, InteractiveSelectorConfig } from '../interfaces/InteractiveAgentSelector';

export class PaginationHelpers {
  /**
   * Create navigation choices for pagination
   */
  static createNavigationChoices(currentPage: number, totalPages: number): MenuChoice[] {
    const choices: MenuChoice[] = [];
    if (currentPage > 0) {
      choices.push({ name: '← Previous Page', value: '_prev' });
    }
    if (currentPage < totalPages - 1) {
      choices.push({ name: '→ Next Page', value: '_next' });
    }
    choices.push({ name: '❌ Cancel', value: '_cancel' });
    return choices;
  }

  /**
   * Handle paginated multi-select
   */
  static async handlePaginatedMultiSelect(
    agentChoices: MenuChoice[], 
    navigationChoices: MenuChoice[], 
    currentPage: number, 
    totalPages: number, 
    allAgents: AgentMetadata[]
  ): Promise<{ selectedAgents: AgentMetadata[], action: string }> {
    const { agents: selectedNames, action } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'agents',
        message: `Page ${currentPage + 1}/${totalPages} - Select agents:`,
        choices: agentChoices
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: [
          { name: '✓ Confirm Selection', value: 'select' },
          ...navigationChoices
        ]
      }
    ]);

    const selectedAgents = selectedNames && selectedNames.length > 0 
      ? allAgents.filter(a => selectedNames.includes(a.name)) 
      : [];
    return { selectedAgents, action };
  }

  /**
   * Handle paginated single-select
   */
  static async handlePaginatedSingleSelect(
    agentChoices: MenuChoice[], 
    navigationChoices: MenuChoice[], 
    currentPage: number, 
    totalPages: number, 
    allAgents: AgentMetadata[]
  ): Promise<{ selectedAgents: AgentMetadata[], action: string }> {
    const { agent: selectedName, action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agent',
        message: `Page ${currentPage + 1}/${totalPages} - Select an agent:`,
        choices: agentChoices
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: [
          { name: '✓ Confirm Selection', value: 'select' },
          ...navigationChoices
        ]
      }
    ]);

    const selectedAgent = selectedName ? allAgents.find(a => a.name === selectedName) : undefined;
    const selectedAgents = selectedAgent ? [selectedAgent] : [];
    return { selectedAgents, action };
  }

  /**
   * Handle pagination page logic
   */
  static async handlePaginationPage(
    agents: AgentMetadata[], 
    currentPage: number, 
    totalPages: number,
    config: InteractiveSelectorConfig,
    formatAgentChoice: (agent: AgentMetadata) => string
  ): Promise<{ selectedAgents: AgentMetadata[], action: string }> {
    const start = currentPage * config.pageSize;
    const end = Math.min(start + config.pageSize, agents.length);
    const pageAgents = agents.slice(start, end);

    const agentChoices = pageAgents.map(agent => ({
      name: formatAgentChoice(agent),
      value: agent.name
    }));

    const navigationChoices = PaginationHelpers.createNavigationChoices(currentPage, totalPages);

    if (config.enableMultiSelect) {
      return PaginationHelpers.handlePaginatedMultiSelect(agentChoices, navigationChoices, currentPage, totalPages, agents);
    } else {
      return PaginationHelpers.handlePaginatedSingleSelect(agentChoices, navigationChoices, currentPage, totalPages, agents);
    }
  }
}