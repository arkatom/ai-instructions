/**
 * Agent Metadata Loader
 * Loads and manages agent metadata from YAML files
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import * as yaml from 'js-yaml';
import { AgentMetadata, AgentRelationship } from './types';

/**
 * Valid relationship types for agent dependencies
 */
const VALID_RELATIONSHIP_TYPES = [
  'requires',
  'enhances',
  'collaborates_with',
  'conflicts_with'
] as const;

/**
 * Agent Metadata Loader class
 * Responsible for loading, parsing, and caching agent metadata
 */
export class AgentMetadataLoader {
  private metadataPath: string;
  private cache: Map<string, AgentMetadata>;

  constructor(basePath: string) {
    this.metadataPath = join(basePath, 'metadata');
    this.cache = new Map();
  }

  /**
   * Load metadata for a specific agent
   * @param agentName - Name of the agent to load metadata for
   * @returns Agent metadata object
   * @throws Error if metadata not found or invalid
   */
  async loadAgentMetadata(agentName: string): Promise<AgentMetadata> {
    // Check cache first
    if (this.cache.has(agentName)) {
      return this.cache.get(agentName)!;
    }

    try {
      const filePath = join(this.metadataPath, `${agentName}.yaml`);
      const content = await readFile(filePath, 'utf-8');
      
      // Parse YAML
      let rawMetadata: unknown;
      try {
        rawMetadata = yaml.load(content);
      } catch (yamlError) {
        throw new Error(`Invalid metadata format: ${yamlError}`);
      }

      // Validate and transform metadata
      const metadata = this.validateAndTransformMetadata(rawMetadata, agentName);
      
      // Cache the result
      this.cache.set(agentName, metadata);
      
      return metadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Agent metadata not found: ${agentName}`);
      }
      throw error;
    }
  }

  /**
   * Load all agent metadata files from the metadata directory
   * @returns Array of all agent metadata
   */
  async loadAllMetadata(): Promise<AgentMetadata[]> {
    try {
      const files = await readdir(this.metadataPath);
      const yamlFiles = files.filter(file => extname(file) === '.yaml' || extname(file) === '.yml');
      
      const metadataPromises = yamlFiles.map(file => {
        const agentName = file.replace(/\.(yaml|yml)$/, '');
        return this.loadAgentMetadata(agentName);
      });
      
      const results = await Promise.allSettled(metadataPromises);
      
      // Filter out failed loads and return successful ones
      return results
        .filter((result): result is PromiseFulfilledResult<AgentMetadata> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all unique categories from loaded metadata
   * @returns Array of unique category names
   */
  async getCategories(): Promise<string[]> {
    const allMetadata = await this.loadAllMetadata();
    const categories = new Set(allMetadata.map(m => m.category));
    return Array.from(categories).sort();
  }

  /**
   * Get agents filtered by category
   * @param category - Category to filter by
   * @returns Array of agents in the specified category
   */
  async getAgentsByCategory(category: string): Promise<AgentMetadata[]> {
    const allMetadata = await this.loadAllMetadata();
    return allMetadata.filter(m => m.category === category);
  }

  /**
   * Clear the metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Validate and transform raw metadata to typed AgentMetadata
   * @param rawMetadata - Raw parsed YAML data
   * @param agentName - Expected agent name (for validation)
   * @returns Validated and transformed metadata
   * @throws Error if validation fails
   */
  private validateAndTransformMetadata(rawMetadata: unknown, _agentName: string): AgentMetadata {
    if (!rawMetadata || typeof rawMetadata !== 'object') {
      throw new Error('Invalid metadata format: metadata must be an object');
    }

    const metadata = rawMetadata as Record<string, unknown>;

    // Validate required fields
    if (!metadata.name) {
      throw new Error('Missing required field: name');
    }
    if (!metadata.category) {
      throw new Error('Missing required field: category');
    }
    if (!metadata.description) {
      throw new Error('Missing required field: description');
    }

    // Validate relationships if present
    const relationships = this.validateRelationships(metadata.relationships);

    // Build the validated metadata object
    const validatedMetadata: AgentMetadata = {
      name: String(metadata.name),
      category: String(metadata.category),
      description: String(metadata.description),
      tags: Array.isArray(metadata.tags) 
        ? metadata.tags.map(t => String(t))
        : [],
      relationships
    };

    // Add optional fields if present
    if (metadata.source) validatedMetadata.source = String(metadata.source);
    if (metadata.version) validatedMetadata.version = String(metadata.version);
    if (metadata.author) validatedMetadata.author = String(metadata.author);
    if (metadata.license) validatedMetadata.license = String(metadata.license);

    return validatedMetadata;
  }

  /**
   * Validate and transform relationship data
   * @param relationships - Raw relationship data
   * @returns Validated AgentRelationship object
   * @throws Error if invalid relationship types are found
   */
  private validateRelationships(relationships: unknown): AgentRelationship {
    // Default empty relationships
    const defaultRelationships: AgentRelationship = {
      requires: [],
      enhances: [],
      collaborates_with: [],
      conflicts_with: []
    };

    if (!relationships || typeof relationships !== 'object') {
      return defaultRelationships;
    }

    const rel = relationships as Record<string, unknown>;
    const validated: AgentRelationship = { ...defaultRelationships };

    // Check for invalid relationship types
    for (const key of Object.keys(rel)) {
      if (!VALID_RELATIONSHIP_TYPES.includes(key as typeof VALID_RELATIONSHIP_TYPES[number])) {
        throw new Error(`Invalid relationship type: ${key}`);
      }
    }

    // Validate and assign each relationship type
    for (const type of VALID_RELATIONSHIP_TYPES) {
      if (rel[type]) {
        if (!Array.isArray(rel[type])) {
          throw new Error(`Relationship ${type} must be an array`);
        }
        validated[type] = (rel[type] as unknown[]).map(item => String(item));
      }
    }

    return validated;
  }
}