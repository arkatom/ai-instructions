/**
 * TDD Test Suite - Agent Dependency Management System
 * Phase 1: Agent Metadata Loading
 * 
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 * Tests for loading and parsing agent metadata including dependencies
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { AgentMetadataLoader } from '../../src/agents/metadata-loader';
import * as agentFileFinder from '../../src/agents/agent-file-finder';

describe('Agent Metadata Loader', () => {
  let tempDir: string;
  let loader: AgentMetadataLoader;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'agent-metadata-test-'));
    // Create templates/agents directory structure for MD files
    await mkdir(join(tempDir, 'templates', 'agents'), { recursive: true });
    
    // Mock getTemplatesDir to return our test directory
    jest.spyOn(agentFileFinder, 'getTemplatesDir').mockReturnValue(join(tempDir, 'templates', 'agents'));
    
    loader = new AgentMetadataLoader(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('Basic Metadata Loading', () => {
    test('should load a single agent metadata file', async () => {
      // ARRANGE - Create test metadata file (MD format with frontmatter)
      const metadataContent = `---
name: typescript-assistant
category: development
description: TypeScript development assistant
tags:
  - typescript
  - development
  - coding
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# TypeScript Assistant

A test agent for TypeScript development.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'typescript-assistant.md'),
        metadataContent
      );

      // ACT - Load metadata
      const metadata = await loader.loadAgentMetadata('typescript-assistant');

      // ASSERT
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('typescript-assistant');
      expect(metadata.category).toBe('development');
      expect(metadata.description).toBe('TypeScript development assistant');
      expect(metadata.tags).toEqual(['typescript', 'development', 'coding']);
      expect(metadata.relationships).toBeDefined();
      expect(metadata.relationships.requires).toEqual([]);
    });

    test('should load metadata with dependencies', async () => {
      // ARRANGE - Create metadata with dependencies (MD format)
      const metadataContent = `---
name: react-developer
category: frontend
description: React development specialist
tags:
  - react
  - frontend
  - javascript
relationships:
  requires:
    - typescript-assistant
    - node-expert
  enhances:
    - ui-designer
  collaborates_with:
    - jest-testing
    - eslint-expert
  conflicts_with:
    - vue-developer
---

# React Developer

A test agent for React development.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'react-developer.md'),
        metadataContent
      );

      // ACT
      const metadata = await loader.loadAgentMetadata('react-developer');

      // ASSERT
      expect(metadata.relationships.requires).toEqual(['typescript-assistant', 'node-expert']);
      expect(metadata.relationships.enhances).toEqual(['ui-designer']);
      expect(metadata.relationships.collaborates_with).toEqual(['jest-testing', 'eslint-expert']);
      expect(metadata.relationships.conflicts_with).toEqual(['vue-developer']);
    });

    test('should throw error when metadata file not found', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('non-existent-agent'))
        .rejects
        .toThrow('Agent metadata not found: non-existent-agent');
    });

    test('should handle invalid YAML format gracefully', async () => {
      // ARRANGE - Create invalid frontmatter (MD file)
      await writeFile(
        join(tempDir, 'templates', 'agents', 'invalid-agent.md'),
        `---
invalid: yaml: content: malformed
---

# Invalid Agent

This agent has malformed frontmatter.
`
      );

      // ACT & ASSERT - Should throw error for missing name field
      await expect(loader.loadAgentMetadata('invalid-agent'))
        .rejects
        .toThrow('Invalid metadata: missing or invalid name');
    });
  });

  describe('Batch Metadata Loading', () => {
    test('should load all agent metadata files in directory', async () => {
      // ARRANGE - Create multiple metadata files (MD format)
      const agents = [
        {
          name: 'agent-1',
          content: `---
name: agent-1
category: category-1
description: First agent
tags: [tag1]
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Agent 1

First test agent.
`
        },
        {
          name: 'agent-2',
          content: `---
name: agent-2
category: category-2
description: Second agent
tags: [tag2]
relationships:
  requires: [agent-1]
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Agent 2

Second test agent.
`
        }
      ];

      for (const agent of agents) {
        await writeFile(
          join(tempDir, 'templates', 'agents', `${agent.name}.md`),
          agent.content
        );
      }

      // ACT
      const allMetadata = await loader.loadAllMetadata();

      // ASSERT
      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.map(m => m.name).sort()).toEqual(['agent-1', 'agent-2']);
      
      const agent2 = allMetadata.find(m => m.name === 'agent-2');
      expect(agent2?.relationships.requires).toEqual(['agent-1']);
    });

    test('should handle empty metadata directory', async () => {
      // ARRANGE - Empty templates/agents directory already created in beforeEach

      // ACT
      const allMetadata = await loader.loadAllMetadata();

      // ASSERT
      expect(allMetadata).toEqual([]);
    });

    test('should skip files without proper frontmatter', async () => {
      // ARRANGE - Mix of MD files with and without frontmatter
      await writeFile(join(tempDir, 'templates', 'agents', 'README.md'), '# README\n\nThis file has no frontmatter.');
      await writeFile(
        join(tempDir, 'templates', 'agents', 'valid-agent.md'),
        `---
name: valid-agent
category: test
description: Test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Valid Agent

A test agent with proper frontmatter.
`
      );

      // ACT
      const allMetadata = await loader.loadAllMetadata();

      // ASSERT - Should only load files with valid metadata (name required)
      expect(allMetadata).toHaveLength(1);
      const validAgent = allMetadata.find(m => m.name === 'valid-agent');
      expect(validAgent?.description).toBe('Test agent');
    });
  });

  describe('Metadata Validation', () => {
    test('should validate required fields', async () => {
      // ARRANGE - Missing required fields (MD format)
      const invalidContent = `---
category: test
description: Missing name field
---

# Invalid

This agent is missing the name field.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'invalid.md'),
        invalidContent
      );

      // ACT & ASSERT - Should throw error for missing name
      await expect(loader.loadAgentMetadata('invalid'))
        .rejects
        .toThrow('Invalid metadata: missing or invalid name');
    });

    test('should validate relationship types', async () => {
      // ARRANGE - Invalid relationship type (MD format)
      const content = `---
name: test-agent
category: test
description: Test agent
tags: []
relationships:
  requires: []
  invalid_type: [other-agent]
---

# Test Agent

Test agent with invalid relationship type.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'test-agent.md'),
        content
      );

      // ACT & ASSERT - Should throw error for invalid relationship type
      await expect(loader.loadAgentMetadata('test-agent'))
        .rejects
        .toThrow('Invalid relationship type: invalid_type');
    });

    test('should handle missing optional fields', async () => {
      // ARRANGE - Minimal valid metadata (MD format)
      const content = `---
name: minimal-agent
category: test
description: Minimal agent
---

# Minimal Agent

A minimal test agent.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'minimal-agent.md'),
        content
      );

      // ACT
      const metadata = await loader.loadAgentMetadata('minimal-agent');

      // ASSERT
      expect(metadata.tags).toEqual([]);
      expect(metadata.relationships.requires).toEqual([]);
      expect(metadata.relationships.enhances).toEqual([]);
      expect(metadata.relationships.collaborates_with).toEqual([]);
      expect(metadata.relationships.conflicts_with).toEqual([]);
    });
  });

  describe('Metadata Caching', () => {
    test('should cache loaded metadata', async () => {
      // ARRANGE (MD format)
      const content = `---
name: cached-agent
category: test
description: Cached agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Cached Agent

Test agent for caching.
`;
      const filePath = join(tempDir, 'templates', 'agents', 'cached-agent.md');
      await writeFile(filePath, content);

      // ACT - Load twice
      const firstLoad = await loader.loadAgentMetadata('cached-agent');
      const secondLoad = await loader.loadAgentMetadata('cached-agent');

      // ASSERT - Should be the same instance (cached)
      expect(firstLoad).toBe(secondLoad);
    });

    test('should invalidate cache when clearCache is called', async () => {
      // ARRANGE (MD format)
      const content = `---
name: cache-test
category: test
description: Cache test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Cache Test

Test agent for cache invalidation.
`;
      await writeFile(
        join(tempDir, 'templates', 'agents', 'cache-test.md'),
        content
      );

      // ACT
      const firstLoad = await loader.loadAgentMetadata('cache-test');
      loader.clearCache();
      const secondLoad = await loader.loadAgentMetadata('cache-test');

      // ASSERT - Should be different instances
      expect(firstLoad).not.toBe(secondLoad);
      expect(firstLoad).toEqual(secondLoad); // But same content
    });

    test('should respect cache TTL', async () => {
      // ARRANGE - Create loader with short TTL (MD format)
      const shortTtlLoader = new AgentMetadataLoader(tempDir, { ttlMs: 100 });
      const content = `---
name: ttl-test
category: test
description: TTL test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# TTL Test

Test agent for TTL cache expiry.
`;
      await writeFile(join(tempDir, 'templates', 'agents', 'ttl-test.md'), content);

      // ACT
      const firstLoad = await shortTtlLoader.loadAgentMetadata('ttl-test');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const secondLoad = await shortTtlLoader.loadAgentMetadata('ttl-test');

      // ASSERT - Should be different instances due to TTL expiry
      expect(firstLoad).not.toBe(secondLoad);
      expect(firstLoad).toEqual(secondLoad); // But same content
    });

    test('should manage cache size with eviction', async () => {
      // ARRANGE - Create loader with small cache (MD format)
      const smallCacheLoader = new AgentMetadataLoader(tempDir, { maxSize: 2 });

      // Create multiple agents
      for (let i = 1; i <= 4; i++) {
        const content = `---
name: agent-${i}
category: test
description: Test agent ${i}
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Agent ${i}

Test agent for cache eviction.
`;
        await writeFile(join(tempDir, 'templates', 'agents', `agent-${i}.md`), content);
      }

      // ACT - Load agents to fill and exceed cache
      await smallCacheLoader.loadAgentMetadata('agent-1');
      await smallCacheLoader.loadAgentMetadata('agent-2');
      await smallCacheLoader.loadAgentMetadata('agent-3'); // Should trigger eviction
      await smallCacheLoader.loadAgentMetadata('agent-4');

      // ASSERT - Cache should not exceed max size
      const stats = smallCacheLoader.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
      expect(stats.maxSize).toBe(2);
    });

    test('should provide cache statistics', async () => {
      // ARRANGE (MD format)
      const content = `---
name: stats-test
category: test
description: Stats test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# Stats Test

Test agent for cache statistics.
`;
      await writeFile(join(tempDir, 'templates', 'agents', 'stats-test.md'), content);

      // ACT
      const initialStats = loader.getCacheStats();
      await loader.loadAgentMetadata('stats-test');
      const afterLoadStats = loader.getCacheStats();

      // ASSERT
      expect(initialStats.size).toBe(0);
      expect(afterLoadStats.size).toBe(1);
      expect(afterLoadStats.maxSize).toBe(1000); // Default max size
    });
  });

  describe('Agent Categories', () => {
    test('should get all unique categories', async () => {
      // ARRANGE (MD format)
      const agents = [
        { name: 'agent1', category: 'development' },
        { name: 'agent2', category: 'testing' },
        { name: 'agent3', category: 'development' },
        { name: 'agent4', category: 'security' }
      ];

      for (const agent of agents) {
        await writeFile(
          join(tempDir, 'templates', 'agents', `${agent.name}.md`),
          `---
name: ${agent.name}
category: ${agent.category}
description: Test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# ${agent.name}

Test agent for category testing.
`
        );
      }

      // ACT
      const categories = await loader.getCategories();

      // ASSERT
      expect(categories.sort()).toEqual(['development', 'security', 'testing']);
    });
  });

  describe('Agents by Category', () => {
    test('should get agents filtered by category', async () => {
      // ARRANGE (MD format)
      const agents = [
        { name: 'dev-agent-1', category: 'development' },
        { name: 'dev-agent-2', category: 'development' },
        { name: 'test-agent', category: 'testing' }
      ];

      for (const agent of agents) {
        await writeFile(
          join(tempDir, 'templates', 'agents', `${agent.name}.md`),
          `---
name: ${agent.name}
category: ${agent.category}
description: Test agent
tags: []
relationships:
  requires: []
  enhances: []
  collaborates_with: []
  conflicts_with: []
---

# ${agent.name}

Test agent for category filtering.
`
        );
      }

      // ACT
      const devAgents = await loader.getAgentsByCategory('development');

      // ASSERT
      expect(devAgents).toHaveLength(2);
      expect(devAgents.map(a => a.name).sort()).toEqual(['dev-agent-1', 'dev-agent-2']);
    });

    test('should return empty array for non-existent category', async () => {
      // ACT
      const agents = await loader.getAgentsByCategory('non-existent');

      // ASSERT
      expect(agents).toEqual([]);
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - These tests define the expected behavior for agent metadata loading
 * - Tests will fail until AgentMetadataLoader is implemented
 * 
 * GREEN PHASE (Next):
 * - Implement AgentMetadataLoader class in src/agents/metadata-loader.ts
 * - Implement AgentMetadata and AgentRelationship types in src/agents/types.ts
 * - Make all tests pass with minimal implementation
 * 
 * REFACTOR PHASE (After Green):
 * - Optimize caching mechanism
 * - Improve error messages
 * - Add logging for debugging
 * 
 * SUCCESS CRITERIA:
 * - All metadata loading tests pass
 * - Proper YAML parsing and validation
 * - Efficient caching mechanism
 * - Clear error messages for invalid metadata
 */