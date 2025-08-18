/**
 * Recommendation Helper Utilities
 * Helper functions for recommended agent selection
 */

import inquirer from 'inquirer';
import { AgentMetadata } from '../../agents/types';
import { SelectionResult, MenuChoice, InteractiveSelectorConfig } from '../interfaces/InteractiveAgentSelector';
import { SelectionHelpers } from './selection-helpers';

export class RecommendationHelpers {
  /**
   * Select recommended agents
   */
  static async selectRecommendedAgents(
    recommendedAgents: AgentMetadata[], 
    allAgents: AgentMetadata[],
    config: InteractiveSelectorConfig,
    formatAgentChoice: (agent: AgentMetadata) => string
  ): Promise<SelectionResult> {
    const agentChoices = recommendedAgents.map(agent => ({
      name: `⭐ ${formatAgentChoice(agent)}`,
      value: agent.name
    }));

    const actionChoices = [
      { name: '✓ Confirm Selection', value: 'select' },
      { name: '❌ Cancel', value: 'cancel' }
    ];

    if (config.enableMultiSelect) {
      return RecommendationHelpers.handleRecommendedMultiSelect(agentChoices, actionChoices, allAgents, config);
    } else {
      return RecommendationHelpers.handleRecommendedSingleSelect(agentChoices, actionChoices, allAgents, config);
    }
  }

  /**
   * Handle recommended multi-select
   */
  private static async handleRecommendedMultiSelect(
    agentChoices: MenuChoice[], 
    actionChoices: MenuChoice[], 
    allAgents: AgentMetadata[],
    config: InteractiveSelectorConfig
  ): Promise<SelectionResult> {
    const { agents: selectedNames, action } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'agents',
        message: 'Recommended agents for your project:',
        choices: agentChoices,
        pageSize: config.pageSize
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: actionChoices
      }
    ]);

    if (action === 'cancel') {
      return SelectionHelpers.createCancelledResult('recommended');
    }

    const selectedAgents = selectedNames ? allAgents.filter(a => selectedNames.includes(a.name)) : [];
    return SelectionHelpers.createSelectionResult(selectedAgents, 'recommended');
  }

  /**
   * Handle recommended single-select
   */
  private static async handleRecommendedSingleSelect(
    agentChoices: MenuChoice[], 
    actionChoices: MenuChoice[], 
    allAgents: AgentMetadata[],
    config: InteractiveSelectorConfig
  ): Promise<SelectionResult> {
    const { agent: selectedName, action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agent',
        message: 'Recommended agents for your project:',
        choices: agentChoices,
        pageSize: config.pageSize
      },
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: actionChoices
      }
    ]);

    if (action === 'cancel') {
      return SelectionHelpers.createCancelledResult('recommended');
    }

    const selectedAgent = allAgents.find(a => a.name === selectedName);
    return SelectionHelpers.createSelectionResult(selectedAgent ? [selectedAgent] : [], 'recommended');
  }
}