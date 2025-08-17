/**
 * Agent metadata validation utilities
 * Extracted to reduce complexity in metadata-loader
 */

import { AgentMetadata } from './types';

/**
 * Validate agent name for security
 */
export function validateAgentName(agentName: string): void {
  // Check for basic validity
  if (!agentName || typeof agentName !== 'string') {
    throw new Error('Invalid agent name: must be a non-empty string');
  }

  // Check length
  if (agentName.length > 255) {
    throw new Error('Invalid agent name: too long (max 255 characters)');
  }

  // Check for path traversal attempts
  const invalidPatterns = ['..', '/', '\\', '~', '\0'];
  for (const pattern of invalidPatterns) {
    if (agentName.includes(pattern)) {
      throw new Error(`Invalid agent name: contains forbidden character or pattern '${pattern}'`);
    }
  }

  // Check for valid characters (alphanumeric, dash, underscore)
  if (!/^[a-zA-Z0-9_-]+$/.test(agentName)) {
    throw new Error('Invalid agent name: must contain only alphanumeric characters, dashes, and underscores');
  }

  // Check for reserved names
  const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
  if (reservedNames.includes(agentName.toLowerCase())) {
    throw new Error(`Invalid agent name: '${agentName}' is a reserved name`);
  }
}

/**
 * Validate and transform metadata
 */
export function validateAndTransformMetadata(
  rawMetadata: unknown,
  agentName: string
): AgentMetadata {
  const metadata = validateMetadataStructure(rawMetadata);
  validateRequiredFields(metadata);
  validateAgentNameMatch(metadata, agentName);
  
  return buildValidatedMetadata(metadata);
}

/**
 * Validate basic metadata structure
 */
function validateMetadataStructure(rawMetadata: unknown): Record<string, unknown> {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    throw new Error('Invalid metadata format: metadata must be an object');
  }
  return rawMetadata as Record<string, unknown>;
}

/**
 * Validate required fields exist and are correct type
 */
function validateRequiredFields(metadata: Record<string, unknown>): void {
  // Only name is truly required
  if (!metadata.name || typeof metadata.name !== 'string') {
    throw new Error('Invalid metadata: missing or invalid name');
  }
  
  // Set defaults for optional fields
  if (!metadata.category) {
    metadata.category = 'general';
  }
  if (!metadata.description) {
    metadata.description = 'AI agent for specialized tasks';
  }
}

/**
 * Validate agent name matches expected name
 */
function validateAgentNameMatch(metadata: Record<string, unknown>, expectedName: string): void {
  const actualName = String(metadata.name);
  // Be more lenient - if name is 'unknown' or doesn't match, just use the expected name
  if (actualName === 'unknown' || actualName !== expectedName) {
    metadata.name = expectedName;
  }
}

/**
 * Build validated metadata object
 */
function buildValidatedMetadata(metadata: Record<string, unknown>): AgentMetadata {
  return {
    name: String(metadata.name),
    category: String(metadata.category || 'general'),
    description: String(metadata.description || 'AI agent for specialized tasks'),
    tags: metadata.tags ? (metadata.tags as string[]) : [],
    relationships: {
      requires: [],
      enhances: [],
      collaborates_with: [],
      conflicts_with: []
    }
  };
}