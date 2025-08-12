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
 * Cache configuration for metadata loader
 */
interface CacheConfig {
  maxSize: number;
  ttlMs: number;
}

/**
 * Cache entry with timestamp for TTL
 */
interface CacheEntry {
  metadata: AgentMetadata;
  timestamp: number;
}

/**
 * Agent Metadata Loader class
 * Responsible for loading, parsing, and caching agent metadata
 */
export class AgentMetadataLoader {
  private metadataPath: string;
  private cache: Map<string, CacheEntry>;
  private readonly config: CacheConfig;

  constructor(basePath: string, config: Partial<CacheConfig> = {}) {
    this.metadataPath = join(basePath, 'metadata');
    this.cache = new Map();
    this.config = {
      maxSize: config.maxSize ?? 1000,
      ttlMs: config.ttlMs ?? 5 * 60 * 1000 // 5 minutes default
    };
  }

  /**
   * Load metadata for a specific agent
   * @param agentName - Name of the agent to load metadata for
   * @returns Agent metadata object
   * @throws Error if metadata not found or invalid
   */
  async loadAgentMetadata(agentName: string): Promise<AgentMetadata> {
    // Validate agent name for security
    this.validateAgentName(agentName);

    // Check cache first
    const cached = this.getCachedMetadata(agentName);
    if (cached) {
      return cached;
    }

    try {
      const filePath = join(this.metadataPath, `${agentName}.yaml`);
      const content = await readFile(filePath, 'utf-8');
      
      // Parse YAML with security options
      let rawMetadata: unknown;
      try {
        rawMetadata = yaml.load(content, {
          // Disable all custom types for security
          schema: yaml.FAILSAFE_SCHEMA,
          // Limit recursion depth
          json: false
        });
      } catch (yamlError) {
        throw new Error(`Invalid metadata format: ${yamlError}`);
      }

      // Validate and transform metadata
      const metadata = this.validateAndTransformMetadata(rawMetadata, agentName);
      
      // Cache the result
      this.setCachedMetadata(agentName, metadata);
      
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
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize
    };
  }

  /**
   * Get cached metadata if valid
   * @param agentName - Agent name to look up
   * @returns Cached metadata or null if not found/expired
   */
  private getCachedMetadata(agentName: string): AgentMetadata | null {
    const entry = this.cache.get(agentName);
    if (!entry) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(agentName);
      return null;
    }

    return entry.metadata;
  }

  /**
   * Set cached metadata with cache size management
   * @param agentName - Agent name
   * @param metadata - Metadata to cache
   */
  private setCachedMetadata(agentName: string, metadata: AgentMetadata): void {
    // Remove old entries if cache is at or near limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(agentName)) {
      this.evictOldestEntries();
    }

    this.cache.set(agentName, {
      metadata,
      timestamp: Date.now()
    });
  }

  /**
   * Evict oldest cache entries to make room
   */
  private evictOldestEntries(): void {
    // Remove entries to get down to 75% of max size
    const targetSize = Math.floor(this.config.maxSize * 0.75);
    const entriesToRemove = Math.max(1, this.cache.size - targetSize);
    
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      if (entry) {
        this.cache.delete(entry[0]);
      }
    }
  }

  /**
   * Validate agent name for security (prevent path traversal and injection)
   * @param agentName - Agent name to validate
   * @throws Error if agent name is invalid
   */
  private validateAgentName(agentName: string): void {
    // Check for basic validity
    if (!agentName || typeof agentName !== 'string') {
      throw new Error('Invalid agent name: must be a non-empty string');
    }

    // Check length
    if (agentName.length > 255) {
      throw new Error('Invalid agent name: too long (max 255 characters)');
    }

    // Check for path traversal attempts
    if (agentName.includes('..') || 
        agentName.includes('/') || 
        agentName.includes('\\') ||
        agentName.includes('\0')) {
      throw new Error('Invalid agent name: contains invalid characters');
    }

    // Check for URL encoding attempts
    if (agentName.includes('%') && /%..|%\d/.test(agentName)) {
      throw new Error('Invalid agent name: contains URL encoded characters');
    }

    // Check for shell injection characters
    const dangerousChars = /[;|&$`<>'"(){}[\]]/;
    if (dangerousChars.test(agentName)) {
      throw new Error('Invalid agent name: contains shell special characters');
    }

    // Check for valid filename pattern (alphanumeric, hyphen, underscore only)
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(agentName)) {
      throw new Error('Invalid agent name: must contain only letters, numbers, hyphens, and underscores');
    }
  }

  /**
   * Validate and transform raw metadata to typed AgentMetadata
   * @param rawMetadata - Raw parsed YAML data
   * @param agentName - Expected agent name (for validation)
   * @returns Validated and transformed metadata
   * @throws Error if validation fails
   */
  private validateAndTransformMetadata(rawMetadata: unknown, agentName: string): AgentMetadata {
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

    // Validate that the name in the file matches the expected agent name
    if (String(metadata.name) !== agentName) {
      throw new Error(`Agent name mismatch: file contains '${metadata.name}' but expected '${agentName}'`);
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