/**
 * Type Guards Tests for Agent Dependency Management System
 * Tests for type validation functions
 */

import { describe, test, expect } from '@jest/globals';
import { isAgentMetadata, isAgentRelationship } from '../../src/agents/types';

describe('Type Guards', () => {
  describe('isAgentMetadata', () => {
    test('should return true for valid AgentMetadata', () => {
      const validMetadata = {
        name: 'test-agent',
        category: 'test',
        description: 'Test agent',
        tags: ['tag1', 'tag2'],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      };

      expect(isAgentMetadata(validMetadata)).toBe(true);
    });

    test('should return false for null/undefined', () => {
      expect(isAgentMetadata(null)).toBe(false);
      expect(isAgentMetadata(undefined)).toBe(false);
    });

    test('should return false for non-object types', () => {
      expect(isAgentMetadata('string')).toBe(false);
      expect(isAgentMetadata(123)).toBe(false);
      expect(isAgentMetadata(true)).toBe(false);
      expect(isAgentMetadata([])).toBe(false);
    });

    test('should return false for missing required fields', () => {
      const incompleteMetadata = {
        name: 'test-agent',
        // missing category
        description: 'Test agent',
        tags: [],
        relationships: {}
      };

      expect(isAgentMetadata(incompleteMetadata)).toBe(false);
    });

    test('should return false for wrong field types', () => {
      const wrongTypes = {
        name: 123, // should be string
        category: 'test',
        description: 'Test agent',
        tags: 'not-array', // should be array
        relationships: {}
      };

      expect(isAgentMetadata(wrongTypes)).toBe(false);
    });

    test('should return false for missing relationships', () => {
      const noRelationships = {
        name: 'test-agent',
        category: 'test',
        description: 'Test agent',
        tags: []
        // missing relationships
      };

      expect(isAgentMetadata(noRelationships)).toBe(false);
    });
  });

  describe('isAgentRelationship', () => {
    test('should return true for valid AgentRelationship', () => {
      const validRelationship = {
        requires: ['agent1'],
        enhances: ['agent2'],
        collaborates_with: ['agent3'],
        conflicts_with: ['agent4']
      };

      expect(isAgentRelationship(validRelationship)).toBe(true);
    });

    test('should return true for empty arrays', () => {
      const emptyRelationship = {
        requires: [],
        enhances: [],
        collaborates_with: [],
        conflicts_with: []
      };

      expect(isAgentRelationship(emptyRelationship)).toBe(true);
    });

    test('should return false for null/undefined', () => {
      expect(isAgentRelationship(null)).toBe(false);
      expect(isAgentRelationship(undefined)).toBe(false);
    });

    test('should return false for non-object types', () => {
      expect(isAgentRelationship('string')).toBe(false);
      expect(isAgentRelationship(123)).toBe(false);
      expect(isAgentRelationship([])).toBe(false);
    });

    test('should return false for missing required arrays', () => {
      const incomplete = {
        requires: [],
        enhances: [],
        // missing collaborates_with and conflicts_with
      };

      expect(isAgentRelationship(incomplete)).toBe(false);
    });

    test('should return false for non-array fields', () => {
      const wrongTypes = {
        requires: 'not-array',
        enhances: [],
        collaborates_with: [],
        conflicts_with: []
      };

      expect(isAgentRelationship(wrongTypes)).toBe(false);
    });
  });
});