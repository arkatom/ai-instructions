/**
 * TDD Test Suite - Intelligent Agent Recommendation System
 * Phase 2: Recommendation Engine
 * 
 * Following TDD principles: Red → Green → Refactor
 * Tests for agent recommendation and scoring
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { RecommendationEngine } from '../../src/agents/recommendation-engine';
import type { ProjectContext, AgentMetadata } from '../../src/agents/types';

// Mock agent data for testing
const mockAgents: AgentMetadata[] = [
  {
    name: 'react-pro',
    category: 'development',
    description: 'React development specialist',
    tags: ['react', 'frontend', 'javascript', 'typescript'],
    relationships: {
      requires: [],
      enhances: ['frontend-developer'],
      collaborates_with: ['typescript-pro', 'test-writer-fixer'],
      conflicts_with: ['angular-expert', 'vue-specialist']
    }
  },
  {
    name: 'typescript-pro',
    category: 'development',
    description: 'TypeScript expert',
    tags: ['typescript', 'javascript', 'type-safety'],
    relationships: {
      requires: [],
      enhances: ['react-pro', 'angular-expert', 'vue-specialist'],
      collaborates_with: ['react-pro', 'test-writer-fixer'],
      conflicts_with: []
    }
  },
  {
    name: 'test-writer-fixer',
    category: 'quality',
    description: 'Test automation specialist',
    tags: ['testing', 'jest', 'cypress', 'quality'],
    relationships: {
      requires: [],
      enhances: ['react-pro', 'typescript-pro'],
      collaborates_with: ['react-pro', 'typescript-pro'],
      conflicts_with: []
    }
  },
  {
    name: 'python-pro',
    category: 'development',
    description: 'Python development expert',
    tags: ['python', 'backend', 'django', 'flask'],
    relationships: {
      requires: [],
      enhances: ['backend-architect'],
      collaborates_with: ['data-scientist', 'mlops-engineer'],
      conflicts_with: []
    }
  },
  {
    name: 'data-scientist',
    category: 'data-ai',
    description: 'Data science and ML specialist',
    tags: ['python', 'machine-learning', 'data-analysis'],
    relationships: {
      requires: ['python-pro'],
      enhances: [],
      collaborates_with: ['python-pro', 'mlops-engineer'],
      conflicts_with: []
    }
  },
  {
    name: 'devops-engineer',
    category: 'infrastructure',
    description: 'DevOps and CI/CD specialist',
    tags: ['ci-cd', 'docker', 'kubernetes', 'deployment'],
    relationships: {
      requires: [],
      enhances: ['react-pro', 'python-pro'],
      collaborates_with: ['cloud-architect'],
      conflicts_with: []
    }
  },
  {
    name: 'angular-expert',
    category: 'development',
    description: 'Angular development specialist',
    tags: ['angular', 'frontend', 'typescript'],
    relationships: {
      requires: [],
      enhances: ['frontend-developer'],
      collaborates_with: ['typescript-pro'],
      conflicts_with: ['react-pro']
    }
  },
  {
    name: 'mlops-engineer',
    category: 'data-ai',
    description: 'MLOps and ML infrastructure specialist',
    tags: ['python', 'machine-learning', 'devops', 'kubernetes'],
    relationships: {
      requires: [],
      enhances: ['data-scientist'],
      collaborates_with: ['python-pro', 'data-scientist', 'devops-engineer'],
      conflicts_with: []
    }
  }
];

describe('Recommendation Engine', () => {
  let engine: RecommendationEngine;

  beforeEach(() => {
    engine = new RecommendationEngine(mockAgents);
  });

  describe('Basic Recommendations', () => {
    test('should recommend React agents for React project', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        projectCategory: 'frontend',
        buildTools: ['webpack', 'typescript'],
        lintingTools: ['eslint'],
        testingTools: ['jest']
      };

      // ACT
      const recommendations = engine.recommend(context);

      // ASSERT
      expect(recommendations.primary).toContain('react-pro');
      expect(recommendations.primary).toContain('typescript-pro');
      expect(recommendations.suggested).toContain('test-writer-fixer');
    });

    test('should recommend Python agents for Django project', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'python',
        primaryLanguage: 'python',
        frameworks: ['django'],
        developmentPhase: 'active-development',
        projectCategory: 'backend',
        buildTools: [],
        lintingTools: ['pylint'],
        testingTools: ['pytest']
      };

      // ACT
      const recommendations = engine.recommend(context);

      // ASSERT
      expect(recommendations.primary).toContain('python-pro');
      expect(recommendations.suggested.some(a => 
        a === 'data-scientist' || a === 'mlops-engineer'
      )).toBe(true);
    });

    test('should recommend DevOps agents for production phase', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'javascript',
        frameworks: ['express'],
        developmentPhase: 'production-maintenance',
        hasCI: true,
        buildTools: ['webpack'],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context);

      // ASSERT
      expect(recommendations.primary).toContain('devops-engineer');
    });
  });

  describe('Scoring System', () => {
    test('should calculate high score for exact match', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        projectCategory: 'frontend',
        buildTools: [],
        lintingTools: [],
        testingTools: ['jest']
      };

      // ACT
      const scores = engine.calculateScores(context);

      // ASSERT
      const reactScore = scores.find(s => s.agentName === 'react-pro');
      expect(reactScore).toBeDefined();
      expect(reactScore!.score).toBeGreaterThan(0.7);
      expect(reactScore!.breakdown.frameworkMatch).toBeGreaterThan(0.8);
    });

    test('should calculate low score for mismatched technology', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'python',
        primaryLanguage: 'python',
        frameworks: ['django'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const scores = engine.calculateScores(context);

      // ASSERT
      const reactScore = scores.find(s => s.agentName === 'react-pro');
      expect(reactScore).toBeDefined();
      expect(reactScore!.score).toBeLessThan(0.5);
    });

    test('should boost score for testing phase with test agents', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'javascript',
        frameworks: [],
        developmentPhase: 'testing-phase',
        hasTests: true,
        testingTools: ['jest', 'cypress'],
        buildTools: [],
        lintingTools: []
      };

      // ACT
      const scores = engine.calculateScores(context);

      // ASSERT
      const testScore = scores.find(s => s.agentName === 'test-writer-fixer');
      expect(testScore).toBeDefined();
      expect(testScore!.score).toBeGreaterThan(0.6);
      expect(testScore!.breakdown.phaseAlignment).toBeGreaterThan(0.8);
    });
  });

  describe('Dependency Resolution Integration', () => {
    test('should resolve dependencies for recommended agents', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'python',
        primaryLanguage: 'python',
        frameworks: [],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context, { resolveDependencies: true });

      // ASSERT
      // If data-scientist is suggested, python-pro should be in primary (as dependency)
      if (recommendations.suggested.includes('data-scientist')) {
        expect(recommendations.primary).toContain('python-pro');
      }
      // Filter out conflicts that don't involve recommended agents
      const relevantConflicts = recommendations.conflicts.filter(c => 
        [...recommendations.primary, ...recommendations.suggested].includes(c.agent1) &&
        [...recommendations.primary, ...recommendations.suggested].includes(c.agent2)
      );
      expect(relevantConflicts).toEqual([]);
    });

    test('should detect and report conflicts', () => {
      // ARRANGE
      const conflictContext: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react', 'angular'], // Conflicting frameworks
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(conflictContext);

      // ASSERT
      expect(recommendations.conflicts.length).toBeGreaterThan(0);
      expect(recommendations.conflicts[0]).toMatchObject({
        agent1: expect.any(String),
        agent2: expect.any(String),
        reason: expect.any(String)
      });
    });
  });

  describe('Filtering and Customization', () => {
    test('should filter by category when specified', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'javascript',
        frameworks: [],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context, {
        categories: ['quality']
      });

      // ASSERT
      expect(recommendations.primary.every(a => {
        const agent = mockAgents.find(ag => ag.name === a);
        return agent?.category === 'quality';
      })).toBe(true);
    });

    test('should limit number of recommendations when specified', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context, {
        maxPrimary: 2,
        maxSuggested: 1
      });

      // ASSERT
      expect(recommendations.primary.length).toBeLessThanOrEqual(2);
      expect(recommendations.suggested.length).toBeLessThanOrEqual(1);
    });

    test('should exclude specified agents', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context, {
        exclude: ['react-pro']
      });

      // ASSERT
      expect(recommendations.primary).not.toContain('react-pro');
      expect(recommendations.suggested).not.toContain('react-pro');
    });
  });

  describe('Recommendation Explanations', () => {
    test('should provide explanations for recommendations', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'typescript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context, {
        includeExplanations: true
      });

      // ASSERT
      expect(recommendations.explanations).toBeDefined();
      expect(recommendations.explanations!['react-pro']).toBeDefined();
      expect(recommendations.explanations!['react-pro']).toContain('React');
    });
  });

  describe('Edge Cases', () => {
    test('should handle unknown project type gracefully', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'unknown',
        primaryLanguage: 'unknown',
        frameworks: [],
        developmentPhase: 'initial-setup',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = engine.recommend(context);

      // ASSERT
      expect(recommendations.primary).toBeDefined();
      expect(recommendations.suggested).toBeDefined();
      expect(recommendations.primary.length + recommendations.suggested.length).toBeGreaterThan(0);
    });

    test('should handle empty agent list', () => {
      // ARRANGE
      const emptyEngine = new RecommendationEngine([]);
      const context: ProjectContext = {
        projectType: 'nodejs',
        primaryLanguage: 'javascript',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };

      // ACT
      const recommendations = emptyEngine.recommend(context);

      // ASSERT
      expect(recommendations.primary).toEqual([]);
      expect(recommendations.suggested).toEqual([]);
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - Tests define expected behavior for recommendation engine
 * - Tests will fail until RecommendationEngine is implemented
 * 
 * GREEN PHASE (Next):
 * - Implement RecommendationEngine class
 * - Implement scoring algorithm
 * - Integrate with DependencyResolver
 * 
 * REFACTOR PHASE (After Green):
 * - Optimize scoring algorithms
 * - Add caching for repeated calculations
 * - Improve recommendation explanations
 */