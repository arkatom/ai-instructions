import { BaseGenerator } from './base';
import { ClaudeGenerator } from './claude';
import { GitHubCopilotGenerator } from './github-copilot';
import { CursorGenerator } from './cursor';

export type SupportedTool = 'claude' | 'github-copilot' | 'cursor';

/**
 * Factory class for creating AI tool generators
 */
export class GeneratorFactory {
  /**
   * Create a generator instance for the specified tool
   */
  static createGenerator(tool: SupportedTool): BaseGenerator {
    switch (tool) {
      case 'claude':
        return new ClaudeGenerator();
      case 'github-copilot':
        return new GitHubCopilotGenerator();
      case 'cursor':
        return new CursorGenerator();
      default:
        throw new Error(`Unsupported tool: ${tool}`);
    }
  }

  /**
   * Get list of supported tools
   */
  static getSupportedTools(): SupportedTool[] {
    return ['claude', 'github-copilot', 'cursor'];
  }

  /**
   * Validate if a tool is supported
   */
  static isValidTool(tool: string): tool is SupportedTool {
    return this.getSupportedTools().includes(tool as SupportedTool);
  }
}