/**
 * Agent name validator
 * Issue #93: Agent deployment CLI commands implementation
 */
import { join } from 'path';
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';
import { AgentMetadataLoader } from '../../agents/metadata-loader';

export class AgentValidator implements Validator<string> {
  private metadataLoader: AgentMetadataLoader;

  constructor() {
    // Initialize with agents directory relative to project root
    const agentsBasePath = join(__dirname, '../../../agents');
    this.metadataLoader = new AgentMetadataLoader(agentsBasePath);
  }

  validate(agentName: string): ValidationResult {
    const errors: string[] = [];

    // Check for empty string
    if (!agentName || agentName.trim() === '') {
      errors.push('Agent name cannot be empty');
    }

    // Basic format validation (synchronous)
    if (agentName && agentName.trim() !== '') {
      const trimmed = agentName.trim();
      
      // Check length
      if (trimmed.length > 255) {
        errors.push('Agent name too long (max 255 characters)');
      }

      // Check for invalid characters (basic security)
      const validPattern = /^[a-zA-Z0-9_-]+$/;
      if (!validPattern.test(trimmed)) {
        errors.push('Agent name must contain only letters, numbers, hyphens, and underscores');
      }

      // Check for path traversal attempts
      if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        errors.push('Agent name contains invalid characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Async validation for agent existence (call this during execution phase)
   */
  async validateExists(agentName: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // Use the metadata loader to check existence
      await this.metadataLoader.loadAgentMetadata(agentName.trim());
      
      return {
        isValid: true,
        errors: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Agent metadata not found')) {
        errors.push(`Agent '${agentName}' not found`);
      } else {
        errors.push(`Failed to validate agent '${agentName}': ${errorMessage}`);
      }
      
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Get all available agent names
   * Useful for CLI autocompletion and listing
   */
  async getAvailableAgents(): Promise<string[]> {
    try {
      const allMetadata = await this.metadataLoader.loadAllMetadata();
      return allMetadata.map(metadata => metadata.name).sort();
    } catch (error) {
      // Return empty array if unable to load agents
      return [];
    }
  }

  /**
   * Get agents by category
   * Useful for filtering in CLI commands
   */
  async getAgentsByCategory(category: string): Promise<string[]> {
    try {
      const agentsInCategory = await this.metadataLoader.getAgentsByCategory(category);
      return agentsInCategory.map(metadata => metadata.name).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all available categories
   * Useful for CLI autocompletion and filtering
   */
  async getCategories(): Promise<string[]> {
    try {
      return await this.metadataLoader.getCategories();
    } catch (error) {
      return [];
    }
  }
}