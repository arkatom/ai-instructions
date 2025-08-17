/**
 * Agent file finder utilities
 * Extracted to reduce complexity in metadata-loader
 */

/**
 * Represents the location information of an agent file
 */
export interface AgentFileLocation {
  /** Agent name without extension */
  agentName: string;
  /** Relative path from agents base directory (e.g., "data-ai/ai-engineer.md" or "orchestrator.md") */
  relativePath: string;
  /** Whether the file is placed flat in the root directory */
  isFlat: boolean;
  /** Category directory name (undefined for flat files) */
  category?: string;
  /** Full absolute path to the source file */
  fullPath: string;
}

import { readdirSync, existsSync, Dirent } from 'fs';
import { join } from 'path';
import * as path from 'path';

/**
 * Recursively search for an agent MD file
 */
export function findAgentFile(dir: string, agentName: string): string | null {
  if (!existsSync(dir)) return null;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findAgentFile(fullPath, agentName);
      if (found) return found;
    } else if (entry.name === `${agentName}.md`) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Recursively find all agent MD files
 */
export function findAllAgentFiles(dir: string): string[] {
  const agentNames: string[] = [];
  
  const findAllAgents = (searchDir: string) => {
    if (!existsSync(searchDir)) return;
    
    const entries = readdirSync(searchDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(searchDir, entry.name);
      if (entry.isDirectory()) {
        findAllAgents(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const agentName = entry.name.replace(/\.md$/, '');
        agentNames.push(agentName);
      }
    }
  };
  
  findAllAgents(dir);
  return agentNames;
}

/**
 * Get the templates directory path
 */
export function getTemplatesDir(): string {
  return join(__dirname, '../../templates/agents');
}

/**
 * Helper function to read directory safely
 */
function readDirectorySafe(dir: string): Dirent[] | null {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/**
 * Helper function to create AgentFileLocation from path
 */
function createAgentLocation(agentName: string, fullPath: string, baseDir: string): AgentFileLocation | null {
  const relativePath = path.relative(baseDir, fullPath);
  
  // Security check for path traversal
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  
  const pathParts = relativePath.split(path.sep);
  const isFlat = pathParts.length === 1;
  
  return {
    agentName,
    relativePath,
    isFlat,
    ...(isFlat ? {} : { category: pathParts[0] }),
    fullPath
  };
}

export function findAgentFileWithLocation(dir: string, agentName: string): AgentFileLocation | null {
  if (!existsSync(dir)) return null;
  
  const searchInDirectory = (searchDir: string, baseDir: string): AgentFileLocation | null => {
    const entries = readDirectorySafe(searchDir);
    if (!entries) return null;
    
    for (const entry of entries) {
      const fullPath = join(searchDir, entry.name);
      if (entry.isDirectory()) {
        const found = searchInDirectory(fullPath, baseDir);
        if (found) return found;
      } else if (entry.name === `${agentName}.md`) {
        return createAgentLocation(agentName, fullPath, baseDir);
      }
    }
    return null;
  };
  
  return searchInDirectory(dir, dir);
}

/**
 * Recursively find all agent MD files with location information
 */
export function findAllAgentFilesWithLocation(dir: string): AgentFileLocation[] {
  const agentLocations: AgentFileLocation[] = [];
  
  const findAllAgents = (searchDir: string, baseDir: string) => {
    const entries = readDirectorySafe(searchDir);
    if (!entries) return;
    
    for (const entry of entries) {
      const fullPath = join(searchDir, entry.name);
      if (entry.isDirectory()) {
        findAllAgents(fullPath, baseDir);
      } else if (entry.name.endsWith('.md')) {
        const agentName = entry.name.replace(/\.md$/, '');
        const location = createAgentLocation(agentName, fullPath, baseDir);
        if (location) {
          agentLocations.push(location);
        }
      }
    }
  };
  
  findAllAgents(dir, dir);
  return agentLocations;
}
