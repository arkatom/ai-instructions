/**
 * Frontmatter parser for agent MD files
 * Extracted to reduce complexity in metadata-loader
 */

import * as yaml from 'js-yaml';

export interface ParsedMetadata {
  name?: string;
  category?: string;
  description?: string;
  color?: string;
  tools?: string;
  tags?: string[];
  relationships?: {
    requires?: string[];
    enhances?: string[];
    collaborates_with?: string[];
    conflicts_with?: string[];
  };
  [key: string]: unknown;
}

/**
 * Get default metadata
 */
function getDefaultMetadata(): ParsedMetadata {
  return {
    name: 'unknown',
    description: 'AI agent',
    category: 'general'
  };
}

/**
 * Extract field from frontmatter
 */
function extractField(frontmatter: string, fieldName: string): string | undefined {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const fieldMatch = frontmatter.match(regex);
  return fieldMatch?.[1]?.trim();
}

/**
 * Extract description from frontmatter
 */
function extractDescription(frontmatter: string): string | undefined {
  const descriptionMatch = frontmatter.match(/^description:\s*([\s\S]*?)(?=^[a-z]+:|$)/m);
  if (!descriptionMatch || !descriptionMatch[1]) {
    return undefined;
  }
  
  let desc = descriptionMatch[1].trim();
  // Clean up multi-line YAML strings
  if (desc.startsWith('"') || desc.startsWith("'") || desc.startsWith('>') || desc.startsWith('|')) {
    const parts = desc.split('\\n');
    if (parts[0]) {
      desc = parts[0].replace(/^["'>|]\s*/, '').replace(/["']$/, '');
    }
  }
  return desc;
}

/**
 * Parse YAML frontmatter
 */
function parseYamlFrontmatter(frontmatter: string): ParsedMetadata | null {
  try {
    const parsed = yaml.load(frontmatter, {
      schema: yaml.FAILSAFE_SCHEMA,
      json: false
    }) as ParsedMetadata;
    
    // Ensure default values for missing fields
    if (!parsed.description) {
      parsed.description = 'AI agent for specialized tasks';
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parse frontmatter with fallback parsing
 */
function parseFrontmatterFallback(frontmatter: string): ParsedMetadata {
  const metadata: ParsedMetadata = {};
  
  // Extract basic fields
  const name = extractField(frontmatter, 'name');
  if (name) metadata.name = name;
  
  const category = extractField(frontmatter, 'category');
  if (category) metadata.category = category;
  
  const color = extractField(frontmatter, 'color');
  if (color) metadata.color = color;
  
  const tools = extractField(frontmatter, 'tools');
  if (tools) metadata.tools = tools;
  
  // Extract description
  const description = extractDescription(frontmatter);
  metadata.description = description || 'AI agent for specialized tasks';
  
  return metadata;
}

/**
 * Parse frontmatter from MD content
 */
export function parseFrontmatter(content: string): ParsedMetadata {
  if (!content.startsWith('---\n')) {
    return getDefaultMetadata();
  }

  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);
  
  if (!match || !match[1]) {
    return getDefaultMetadata();
  }

  const frontmatter = match[1];
  
  // Try YAML parsing first
  const yamlResult = parseYamlFrontmatter(frontmatter);
  if (yamlResult) {
    return yamlResult;
  }
  
  // Fallback to simple parsing if YAML fails
  return parseFrontmatterFallback(frontmatter);
}