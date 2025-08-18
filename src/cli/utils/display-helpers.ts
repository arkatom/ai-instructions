/**
 * Display Helper Utilities
 * Helper functions for formatting and displaying agent information
 */

import chalk from 'chalk';
import { AgentMetadata } from '../../agents/types';

export class DisplayHelpers {
  /**
   * Get category color
   */
  static getCategoryColor(category: string): string {
    const colorMap: Record<string, string> = {
      'development': 'green',
      'quality': 'yellow',
      'business': 'blue',
      'creative': 'magenta',
      'devops': 'cyan',
      'management': 'white',
      'fun': 'red'
    };
    return colorMap[category] || 'gray';
  }

  /**
   * Colorize category text
   */
  static colorizeCategory(category: string, color: string, enableColors: boolean): string {
    if (!enableColors) {
      return category;
    }
    
    const colorFn = (chalk as any)[color] || chalk.gray;
    return colorFn(category);
  }

  /**
   * Get category icon
   */
  static getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
      'development': '🚀',
      'quality': '✅',
      'business': '💼',
      'creative': '🎨',
      'devops': '🔧',
      'management': '📊',
      'fun': '🎮'
    };
    return iconMap[category] || '📁';
  }

  /**
   * Format agent choice for display
   */
  static formatAgentChoice(agent: AgentMetadata, showDescriptions: boolean, enableColors: boolean): string {
    if (showDescriptions) {
      const categoryColor = DisplayHelpers.getCategoryColor(agent.category);
      const coloredCategory = DisplayHelpers.colorizeCategory(agent.category, categoryColor, enableColors);
      return `${agent.name} ${chalk.gray(`[${coloredCategory}]`)} - ${chalk.gray(agent.description)}`;
    }
    return agent.name;
  }

  /**
   * Format agent details for display
   */
  static formatAgentDetails(agent: AgentMetadata, enableColors: boolean): string {
    const categoryColor = DisplayHelpers.getCategoryColor(agent.category);
    const lines: string[] = [];
    
    lines.push('\n' + '='.repeat(60));
    lines.push(chalk.blue(`Agent: ${agent.name}`));
    lines.push('='.repeat(60));
    
    lines.push(chalk.green(`Category: ${DisplayHelpers.colorizeCategory(agent.category, categoryColor, enableColors)}`));
    lines.push(chalk.yellow(`Description: ${agent.description}`));
    
    if (agent.tags && agent.tags.length > 0) {
      lines.push(chalk.cyan(`Tags: ${agent.tags.join(', ')}`));
    }
    
    if (agent.relationships) {
      DisplayHelpers.addRelationshipLines(lines, agent.relationships);
    }
    
    lines.push('='.repeat(60) + '\n');
    return lines.join('\n');
  }

  /**
   * Add relationship lines to agent details
   */
  private static addRelationshipLines(lines: string[], relationships: AgentMetadata['relationships']): void {
    if (!relationships) return;
    
    const { requires, enhances, collaborates_with, conflicts_with } = relationships;
    
    if (requires && requires.length > 0) {
      lines.push(chalk.magenta(`Requires: ${requires.join(', ')}`));
    }
    if (enhances && enhances.length > 0) {
      lines.push(chalk.magenta(`Enhances: ${enhances.join(', ')}`));
    }
    if (collaborates_with && collaborates_with.length > 0) {
      lines.push(chalk.magenta(`Collaborates with: ${collaborates_with.join(', ')}`));
    }
    if (conflicts_with && conflicts_with.length > 0) {
      lines.push(chalk.red(`Conflicts with: ${conflicts_with.join(', ')}`));
    }
  }
}