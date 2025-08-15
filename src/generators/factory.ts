import { BaseGenerator } from './base';
import { ClaudeGenerator } from './claude';
import { GitHubCopilotGenerator } from './github-copilot';
import { CursorGenerator } from './cursor';
import { ClineGenerator } from './cline';
import { SupportedTool, SUPPORTED_TOOLS } from './types';
import { includesStringLiteral } from '../utils/array-helpers';

// Re-export for backward compatibility
export { SupportedTool };

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
      case 'cline':
        return new ClineGenerator();
      case 'windsurf':
        // Windsurf uses Claude format and converts via converter
        return new ClaudeGenerator();
      default:
        throw new Error(`Unsupported tool: ${tool}`);
    }
  }

  /**
   * Get list of supported tools
   */
  static getSupportedTools(): readonly SupportedTool[] {
    return SUPPORTED_TOOLS;
  }

  /**
   * Validate if a tool is supported
   * Uses type-safe array helper to avoid type assertions
   */
  static isValidTool(tool: string): tool is SupportedTool {
    return includesStringLiteral(SUPPORTED_TOOLS, tool);
  }
}