/**
 * Security Tests for Agent Dependency Management System
 * Tests for path traversal and injection attacks
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { AgentMetadataLoader } from '../../src/agents/metadata-loader';

describe('Agent Security Tests', () => {
  let tempDir: string;
  let loader: AgentMetadataLoader;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-security-test-'));
    loader = new AgentMetadataLoader(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Path Traversal Protection', () => {
    test('should reject agent names with path traversal attempts', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('../../../etc/passwd'))
        .rejects
        .toThrow('Invalid agent name');
    });

    test('should reject agent names with directory separators', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('agents/malicious'))
        .rejects
        .toThrow('Invalid agent name');
    });

    test('should reject agent names with null bytes', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('agent\0.yaml'))
        .rejects
        .toThrow('Invalid agent name');
    });

    test('should reject agent names with URL encoded path traversal', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('..%2F..%2Fetc%2Fpasswd'))
        .rejects
        .toThrow('Invalid agent name');
    });

    test('should reject agent names with Windows path separators', async () => {
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata('..\\..\\windows\\system32'))
        .rejects
        .toThrow('Invalid agent name');
    });
  });

  describe('YAML Injection Protection', () => {
    test('should handle malicious YAML with JS code injection attempts', async () => {
      // ARRANGE
      const maliciousYaml = `
name: !!js/function >
  function() {
    console.log('malicious code');
    return 'hacked';
  }
category: test
description: Test
`;
      await mkdir(join(tempDir, 'metadata'), { recursive: true });
      await writeFile(
        join(tempDir, 'metadata', 'malicious.yaml'),
        maliciousYaml
      );

      // ACT - should gracefully handle malicious input with safe defaults
      const result = await loader.loadAgentMetadata('malicious');
      
      // ASSERT - should return safe defaults instead of executing malicious code
      expect(result.name).toBe('malicious');
      expect(result.category).toBe('general');
      expect(result.description).toBe('AI agent');
      expect(result.tags).toEqual([]);
    });

    test('should handle YAML with excessive recursion', async () => {
      // ARRANGE - Create YAML with deep recursion
      const recursiveYaml = `
name: recursive
category: test
description: Test
relationships: &ref
  requires: *ref
`;
      await mkdir(join(tempDir, 'metadata'), { recursive: true });
      await writeFile(
        join(tempDir, 'metadata', 'recursive.yaml'),
        recursiveYaml
      );

      // ACT - should gracefully handle recursive YAML with safe defaults
      const result = await loader.loadAgentMetadata('recursive');
      
      // ASSERT - should return safe defaults instead of failing on recursion
      expect(result.name).toBe('recursive');
      expect(result.category).toBe('test'); // Uses the category from YAML
      expect(result.description).toBe('Test'); // Uses the description from YAML
      expect(result.tags).toEqual([]);
    });
  });

  describe('Input Validation', () => {
    test('should reject extremely long agent names', async () => {
      const longName = 'a'.repeat(1000);
      
      // ACT & ASSERT
      await expect(loader.loadAgentMetadata(longName))
        .rejects
        .toThrow('Invalid agent name');
    });

    test('should reject agent names with special shell characters', async () => {
      const dangerousNames = [
        'agent;rm -rf /',
        'agent$(whoami)',
        'agent`id`',
        'agent|cat /etc/passwd',
        'agent&& malicious',
        'agent> /dev/null'
      ];

      for (const name of dangerousNames) {
        await expect(loader.loadAgentMetadata(name))
          .rejects
          .toThrow('Invalid agent name');
      }
    });
  });
});