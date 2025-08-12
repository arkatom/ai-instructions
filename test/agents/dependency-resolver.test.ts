/**
 * TDD Test Suite - Agent Dependency Management System
 * Phase 2: Dependency Resolution Algorithm
 * 
 * Following Kent Beck's TDD principles: Red → Green → Refactor
 * Tests for resolving agent dependencies and detecting conflicts
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DependencyResolver } from '../../src/agents/dependency-resolver';
import { AgentMetadata } from '../../src/agents/types';

describe('Agent Dependency Resolver', () => {
  let resolver: DependencyResolver;
  let mockMetadata: Map<string, AgentMetadata>;

  beforeEach(() => {
    // Setup mock metadata
    mockMetadata = new Map<string, AgentMetadata>();
    
    // Agent A: No dependencies
    mockMetadata.set('agent-a', {
      name: 'agent-a',
      category: 'test',
      description: 'Agent A',
      tags: [],
      relationships: {
        requires: [],
        enhances: [],
        collaborates_with: [],
        conflicts_with: []
      }
    });

    // Agent B: Requires A
    mockMetadata.set('agent-b', {
      name: 'agent-b',
      category: 'test',
      description: 'Agent B',
      tags: [],
      relationships: {
        requires: ['agent-a'],
        enhances: [],
        collaborates_with: [],
        conflicts_with: []
      }
    });

    // Agent C: Requires B (transitive dependency on A)
    mockMetadata.set('agent-c', {
      name: 'agent-c',
      category: 'test',
      description: 'Agent C',
      tags: [],
      relationships: {
        requires: ['agent-b'],
        enhances: [],
        collaborates_with: [],
        conflicts_with: []
      }
    });

    // Agent D: Conflicts with A
    mockMetadata.set('agent-d', {
      name: 'agent-d',
      category: 'test',
      description: 'Agent D',
      tags: [],
      relationships: {
        requires: [],
        enhances: [],
        collaborates_with: [],
        conflicts_with: ['agent-a']
      }
    });

    resolver = new DependencyResolver(mockMetadata);
  });

  describe('Basic Dependency Resolution', () => {
    test('should resolve agent with no dependencies', () => {
      // ACT
      const result = resolver.resolve(['agent-a']);

      // ASSERT
      expect(result.resolvedAgents).toEqual(['agent-a']);
      expect(result.requiredAgents).toEqual(['agent-a']);
      expect(result.conflicts).toEqual([]);
      expect(result.hasCircularDependency).toBe(false);
    });

    test('should resolve direct dependencies', () => {
      // ACT
      const result = resolver.resolve(['agent-b']);

      // ASSERT
      expect(result.resolvedAgents).toContain('agent-a');
      expect(result.resolvedAgents).toContain('agent-b');
      expect(result.requiredAgents).toContain('agent-a');
      expect(result.requiredAgents).toContain('agent-b');
      expect(result.conflicts).toEqual([]);
    });

    test('should resolve transitive dependencies', () => {
      // ACT
      const result = resolver.resolve(['agent-c']);

      // ASSERT
      expect(result.resolvedAgents).toHaveLength(3);
      expect(result.resolvedAgents).toContain('agent-a');
      expect(result.resolvedAgents).toContain('agent-b');
      expect(result.resolvedAgents).toContain('agent-c');
      expect(result.requiredAgents).toHaveLength(3);
    });

    test('should handle multiple agents selection', () => {
      // ACT
      const result = resolver.resolve(['agent-a', 'agent-b']);

      // ASSERT
      expect(result.resolvedAgents).toHaveLength(2);
      expect(result.resolvedAgents).toContain('agent-a');
      expect(result.resolvedAgents).toContain('agent-b');
    });

    test('should not duplicate agents in resolution', () => {
      // ACT - Both B and C require A
      const result = resolver.resolve(['agent-b', 'agent-c']);

      // ASSERT - A should appear only once
      expect(result.resolvedAgents.filter(a => a === 'agent-a')).toHaveLength(1);
      expect(result.resolvedAgents).toHaveLength(3);
    });
  });

  describe('Conflict Detection', () => {
    test('should detect direct conflicts', () => {
      // ACT
      const result = resolver.resolve(['agent-a', 'agent-d']);

      // ASSERT
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        agent1: 'agent-d',
        agent2: 'agent-a',
        reason: 'Direct conflict'
      });
      expect(result.excludedAgents).toContain('agent-d');
      expect(result.resolvedAgents).toEqual(['agent-a']);
    });

    test('should detect conflicts with dependencies', () => {
      // ACT - B requires A, but D conflicts with A
      const result = resolver.resolve(['agent-b', 'agent-d']);

      // ASSERT
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.agent1).toBe('agent-d');
      expect(result.conflicts[0]?.agent2).toBe('agent-a');
      expect(result.excludedAgents).toContain('agent-d');
      expect(result.resolvedAgents).toContain('agent-a');
      expect(result.resolvedAgents).toContain('agent-b');
    });

    test('should handle bidirectional conflicts', () => {
      // ARRANGE - Add bidirectional conflict
      const agentE: AgentMetadata = {
        name: 'agent-e',
        category: 'test',
        description: 'Agent E',
        tags: [],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: ['agent-f']
        }
      };
      
      const agentF: AgentMetadata = {
        name: 'agent-f',
        category: 'test',
        description: 'Agent F',
        tags: [],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: ['agent-e']
        }
      };

      mockMetadata.set('agent-e', agentE);
      mockMetadata.set('agent-f', agentF);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['agent-e', 'agent-f']);

      // ASSERT
      expect(result.conflicts).toHaveLength(2);
      expect(result.resolvedAgents).toHaveLength(1); // Only one should be selected
    });
  });

  describe('Circular Dependency Detection', () => {
    test('should detect simple circular dependency', () => {
      // ARRANGE - A requires B, B requires A
      const circularA: AgentMetadata = {
        name: 'circular-a',
        category: 'test',
        description: 'Circular A',
        tags: [],
        relationships: {
          requires: ['circular-b'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };
      
      const circularB: AgentMetadata = {
        name: 'circular-b',
        category: 'test',
        description: 'Circular B',
        tags: [],
        relationships: {
          requires: ['circular-a'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      mockMetadata.set('circular-a', circularA);
      mockMetadata.set('circular-b', circularB);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['circular-a']);

      // ASSERT
      expect(result.hasCircularDependency).toBe(true);
      expect(result.circularDependencyPath).toEqual(['circular-a', 'circular-b', 'circular-a']);
    });

    test('should detect complex circular dependency', () => {
      // ARRANGE - A requires B, B requires C, C requires A
      const circA: AgentMetadata = {
        name: 'circ-a',
        category: 'test',
        description: 'Circ A',
        tags: [],
        relationships: {
          requires: ['circ-b'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };
      
      const circB: AgentMetadata = {
        name: 'circ-b',
        category: 'test',
        description: 'Circ B',
        tags: [],
        relationships: {
          requires: ['circ-c'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };
      
      const circC: AgentMetadata = {
        name: 'circ-c',
        category: 'test',
        description: 'Circ C',
        tags: [],
        relationships: {
          requires: ['circ-a'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      mockMetadata.set('circ-a', circA);
      mockMetadata.set('circ-b', circB);
      mockMetadata.set('circ-c', circC);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['circ-a']);

      // ASSERT
      expect(result.hasCircularDependency).toBe(true);
      expect(result.circularDependencyPath).toContain('circ-a');
      expect(result.circularDependencyPath).toContain('circ-b');
      expect(result.circularDependencyPath).toContain('circ-c');
    });

    test('should handle self-dependency', () => {
      // ARRANGE - Agent requires itself
      const selfDep: AgentMetadata = {
        name: 'self-dep',
        category: 'test',
        description: 'Self Dependent',
        tags: [],
        relationships: {
          requires: ['self-dep'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      mockMetadata.set('self-dep', selfDep);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['self-dep']);

      // ASSERT
      expect(result.hasCircularDependency).toBe(true);
      expect(result.circularDependencyPath).toEqual(['self-dep', 'self-dep']);
    });
  });

  describe('Enhancement Recommendations', () => {
    test('should recommend agents that enhance selected ones', () => {
      // ARRANGE
      const enhancer: AgentMetadata = {
        name: 'enhancer',
        category: 'test',
        description: 'Enhancer',
        tags: [],
        relationships: {
          requires: [],
          enhances: ['agent-a'],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      mockMetadata.set('enhancer', enhancer);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['agent-a']);

      // ASSERT
      expect(result.recommendedAgents).toContain('enhancer');
      expect(result.resolvedAgents).not.toContain('enhancer'); // Not required, just recommended
    });

    test('should recommend collaborating agents', () => {
      // ARRANGE
      const collaborator: AgentMetadata = {
        name: 'collaborator',
        category: 'test',
        description: 'Collaborator',
        tags: [],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: ['agent-a'],
          conflicts_with: []
        }
      };

      // Also make agent-a collaborate with collaborator (bidirectional)
      const agentA = mockMetadata.get('agent-a')!;
      agentA.relationships.collaborates_with = ['collaborator'];
      mockMetadata.set('agent-a', agentA);
      mockMetadata.set('collaborator', collaborator);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['agent-a']);

      // ASSERT
      expect(result.recommendedAgents).toContain('collaborator');
    });

    test('should not recommend conflicting agents', () => {
      // ARRANGE
      const conflictingEnhancer: AgentMetadata = {
        name: 'conflict-enhancer',
        category: 'test',
        description: 'Conflicting Enhancer',
        tags: [],
        relationships: {
          requires: [],
          enhances: ['agent-a'],
          collaborates_with: [],
          conflicts_with: ['agent-b']
        }
      };

      mockMetadata.set('conflict-enhancer', conflictingEnhancer);
      resolver = new DependencyResolver(mockMetadata);

      // ACT - Select both A and B
      const result = resolver.resolve(['agent-a', 'agent-b']);

      // ASSERT - Should not recommend the enhancer due to conflict with B
      expect(result.recommendedAgents).not.toContain('conflict-enhancer');
    });
  });

  describe('Missing Dependencies', () => {
    test('should handle missing required agents gracefully', () => {
      // ARRANGE - Agent requires non-existent agent
      const incomplete: AgentMetadata = {
        name: 'incomplete',
        category: 'test',
        description: 'Incomplete',
        tags: [],
        relationships: {
          requires: ['non-existent'],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      mockMetadata.set('incomplete', incomplete);
      resolver = new DependencyResolver(mockMetadata);

      // ACT & ASSERT
      expect(() => resolver.resolve(['incomplete']))
        .toThrow('Missing dependency: non-existent required by incomplete');
    });

    test('should handle missing conflicting agents gracefully', () => {
      // ARRANGE - Agent conflicts with non-existent agent
      const conflictMissing: AgentMetadata = {
        name: 'conflict-missing',
        category: 'test',
        description: 'Conflict Missing',
        tags: [],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: ['non-existent']
        }
      };

      mockMetadata.set('conflict-missing', conflictMissing);
      resolver = new DependencyResolver(mockMetadata);

      // ACT
      const result = resolver.resolve(['conflict-missing']);

      // ASSERT - Should ignore missing conflict
      expect(result.resolvedAgents).toEqual(['conflict-missing']);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('Priority Resolution', () => {
    test('should prioritize explicitly selected agents over conflicts', () => {
      // ACT - Explicitly select D even though it conflicts with A
      const result = resolver.resolve(['agent-d'], { prioritizeSelected: true });

      // ASSERT
      expect(result.resolvedAgents).toContain('agent-d');
      expect(result.excludedAgents).not.toContain('agent-d');
    });

    test('should still include required dependencies even with conflicts', () => {
      // ACT - Select B (requires A) and D (conflicts with A) with priority
      const result = resolver.resolve(['agent-b', 'agent-d'], { prioritizeSelected: true });

      // ASSERT - B's requirement should take precedence
      expect(result.resolvedAgents).toContain('agent-a');
      expect(result.resolvedAgents).toContain('agent-b');
      expect(result.excludedAgents).toContain('agent-d');
      expect(result.conflicts).toHaveLength(1);
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - These tests define the expected behavior for dependency resolution
 * - Tests will fail until DependencyResolver is implemented
 * 
 * GREEN PHASE (Next):
 * - Implement DependencyResolver class in src/agents/dependency-resolver.ts
 * - Implement resolution algorithm with BFS/DFS for dependencies
 * - Implement circular dependency detection with visited tracking
 * - Implement conflict resolution logic
 * 
 * REFACTOR PHASE (After Green):
 * - Optimize resolution algorithm for large dependency graphs
 * - Improve conflict resolution strategies
 * - Add caching for resolved dependency chains
 * 
 * SUCCESS CRITERIA:
 * - All dependency resolution tests pass
 * - Circular dependencies are properly detected
 * - Conflicts are identified and handled
 * - Recommendations are generated appropriately
 */