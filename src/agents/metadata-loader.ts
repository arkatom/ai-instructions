/**
 * Agent Metadata Loader
 * Loads and manages agent metadata from YAML files
 */

// Agent metadata processing with extracted methods for clarity

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
      const metadata = await this.loadAndProcessAgentFile(agentName);
      this.setCachedMetadata(agentName, metadata);
      return metadata;
    } catch (error) {
      return this.handleAgentLoadingError(error, agentName);
    }
  }

  /**
   * Load and process agent metadata file
   */
  private async loadAndProcessAgentFile(agentName: string): Promise<AgentMetadata> {
    const filePath = this.getAgentFilePath(agentName);
    const content = await this.readAgentFile(filePath);
    const rawMetadata = this.parseYamlContent(content);
    return this.validateAndTransformMetadata(rawMetadata, agentName);
  }

  /**
   * Get agent file path
   */
  private getAgentFilePath(agentName: string): string {
    return join(this.metadataPath, `${agentName}.yaml`);
  }

  /**
   * Read agent metadata file
   */
  private async readAgentFile(filePath: string): Promise<string> {
    return await readFile(filePath, 'utf-8');
  }

  /**
   * Parse YAML content with security options
   */
  private parseYamlContent(content: string): unknown {
    try {
      return yaml.load(content, {
        // Disable all custom types for security
        schema: yaml.FAILSAFE_SCHEMA,
        // Limit recursion depth
        json: false
      });
    } catch (yamlError) {
      throw new Error(`Invalid metadata format: ${yamlError}`);
    }
  }

  /**
   * Handle agent loading errors
   */
  private handleAgentLoadingError(error: unknown, agentName: string): never {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Agent metadata not found: ${agentName}`);
    }
    throw error;
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
  // eslint-disable-next-line complexity
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
    const metadata = this.validateMetadataStructure(rawMetadata);
    this.validateRequiredFields(metadata);
    this.validateAgentNameMatch(metadata, agentName);
    
    return this.buildValidatedMetadata(metadata);
  }

  /**
   * Validate basic metadata structure
   */
  private validateMetadataStructure(rawMetadata: unknown): Record<string, unknown> {
    if (!rawMetadata || typeof rawMetadata !== 'object') {
      throw new Error('Invalid metadata format: metadata must be an object');
    }
    return rawMetadata as Record<string, unknown>;
  }

  /**
   * Validate required fields exist and are correct type
   */
  private validateRequiredFields(metadata: Record<string, unknown>): void {
    const requiredFields = [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'description', type: 'string' }
    ];

    for (const field of requiredFields) {
      if (!(field.name in metadata) || typeof metadata[field.name] !== field.type) {
        throw new Error(`Missing required field: ${field.name}`);
      }
    }
  }

  /**
   * Validate agent name matches expected name
   */
  private validateAgentNameMatch(metadata: Record<string, unknown>, expectedName: string): void {
    const actualName = String(metadata.name);
    if (actualName !== expectedName) {
      throw new Error(`Agent name mismatch: file contains '${actualName}' but expected '${expectedName}'`);
    }
  }

  /**
   * Build validated metadata object
   */
  private buildValidatedMetadata(metadata: Record<string, unknown>): AgentMetadata {
    // Build core metadata
    const validatedMetadata: AgentMetadata = {
      name: String(metadata.name),
      category: String(metadata.category),
      description: String(metadata.description),
      tags: this.extractTags(metadata),
      relationships: this.validateRelationships(metadata.relationships)
    };

    // Add optional fields
    this.addOptionalFields(validatedMetadata, metadata);
    
    return validatedMetadata;
  }

  /**
   * Extract and validate tags array
   */
  private extractTags(metadata: Record<string, unknown>): string[] {
    const tags = metadata.tags;
    if (!Array.isArray(tags)) {
      return [];
    }
    return tags.map(t => String(t));
  }

  /**
   * Add optional fields to metadata
   */
  private addOptionalFields(validatedMetadata: AgentMetadata, metadata: Record<string, unknown>): void {
    const source = metadata.source;
    if (source) validatedMetadata.source = String(source);
    
    const version = metadata.version;
    if (version) validatedMetadata.version = String(version);
    
    const author = metadata.author;
    if (author) validatedMetadata.author = String(author);
    
    const license = metadata.license;
    if (license) validatedMetadata.license = String(license);
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

    // Type-safe relationship validation - we've verified it's a non-null object above
    const relationshipsObj = relationships as Record<string, unknown>;
    const validated: AgentRelationship = { ...defaultRelationships };

    // Check for invalid relationship types
    for (const key of Object.keys(relationshipsObj)) {
      if (!VALID_RELATIONSHIP_TYPES.includes(key as typeof VALID_RELATIONSHIP_TYPES[number])) {
        throw new Error(`Invalid relationship type: ${key}`);
      }
    }

    // Validate and assign each relationship type
    for (const type of VALID_RELATIONSHIP_TYPES) {
      const relationshipValue = relationshipsObj[type];
      if (relationshipValue) {
        if (!Array.isArray(relationshipValue)) {
          throw new Error(`Relationship ${type} must be an array`);
        }
        validated[type] = relationshipValue.map(item => String(item));
      }
    }

    return validated;
  }
}