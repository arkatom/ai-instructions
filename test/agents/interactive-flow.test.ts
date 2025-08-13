/**
 * TDD Test Suite - Intelligent Agent Recommendation System
 * Phase 3: Interactive Recommendation Flow
 * 
 * Following TDD principles: Red → Green → Refactor
 * Tests for interactive recommendation workflow
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { InteractiveRecommendationFlow } from '../../src/agents/interactive-flow';
import { ContextAnalyzer } from '../../src/agents/context-analyzer';
import type { ProjectContext, AgentMetadata } from '../../src/agents/types';

// Mock agents for testing
const mockAgents: AgentMetadata[] = [
  {
    name: 'react-pro',
    category: 'development',
    description: 'React development specialist',
    tags: ['react', 'frontend', 'javascript', 'typescript'],
    relationships: {
      requires: [],
      enhances: ['frontend-developer'],
      collaborates_with: ['typescript-pro'],
      conflicts_with: ['angular-expert']
    }
  },
  {
    name: 'typescript-pro',
    category: 'development',
    description: 'TypeScript expert',
    tags: ['typescript', 'javascript'],
    relationships: {
      requires: [],
      enhances: ['react-pro'],
      collaborates_with: ['react-pro'],
      conflicts_with: []
    }
  },
  {
    name: 'python-pro',
    category: 'development',
    description: 'Python development expert',
    tags: ['python', 'backend'],
    relationships: {
      requires: [],
      enhances: [],
      collaborates_with: ['data-scientist'],
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
      enhances: [],
      collaborates_with: ['typescript-pro'],
      conflicts_with: ['react-pro']
    }
  }
];

describe('Interactive Recommendation Flow', () => {
  let flow: InteractiveRecommendationFlow;

  beforeEach(() => {
    flow = new InteractiveRecommendationFlow(mockAgents);
  });

  describe('Flow Initialization', () => {
    test('should initialize with project path', async () => {
      // ARRANGE
      const projectPath = '/test/project';
      
      // ACT
      await flow.initialize(projectPath);
      const state = flow.getState();
      
      // ASSERT
      expect(state.projectPath).toBe(projectPath);
      expect(state.phase).toBe('analyzing');
      expect(state.context).toBeDefined();
    });

    test('should analyze project context on initialization', async () => {
      // ARRANGE
      const mockContext: ProjectContext = {
        projectType: 'nodejs',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        primaryLanguage: 'typescript',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };
      
      // Mock the context analyzer
      jest.spyOn(ContextAnalyzer.prototype, 'analyzeProject')
        .mockResolvedValue(mockContext);
      
      // ACT
      await flow.initialize('/test/project');
      const state = flow.getState();
      
      // ASSERT
      expect(state.context?.projectType).toBe('nodejs');
      expect(state.context?.frameworks).toContain('react');
    });
  });

  describe('Recommendation Generation', () => {
    test('should generate initial recommendations', async () => {
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
      const recommendations = await flow.generateRecommendations(context);
      
      // ASSERT
      expect(recommendations).toBeDefined();
      expect(recommendations!.primary).toBeDefined();
      expect(recommendations!.suggested).toBeDefined();
      expect(recommendations!.explanations).toBeDefined();
    });

    test('should include explanations by default', async () => {
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
      const recommendations = await flow.generateRecommendations(context);
      
      // ASSERT
      expect(recommendations!.explanations).toBeDefined();
      expect(Object.keys(recommendations!.explanations!).length).toBeGreaterThan(0);
    });
  });

  describe('User Interaction', () => {
    test('should accept user confirmation', async () => {
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
      await flow.generateRecommendations(context);
      
      // ACT
      const result = flow.confirmRecommendations(['react-pro', 'typescript-pro']);
      
      // ASSERT
      expect(result.confirmed).toBe(true);
      expect(result.selectedAgents).toContain('react-pro');
      expect(result.selectedAgents).toContain('typescript-pro');
      expect(flow.getState().phase).toBe('confirmed');
    });

    test('should allow modification of recommendations', async () => {
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
      await flow.generateRecommendations(context);
      
      // ACT
      const modified = flow.modifyRecommendations({
        add: ['python-pro'],
        remove: ['typescript-pro']
      });
      
      // ASSERT
      expect(modified.selectedAgents).toContain('python-pro');
      expect(modified.selectedAgents).not.toContain('typescript-pro');
    });

    test('should detect conflicts when modifying', () => {
      // ARRANGE
      flow.confirmRecommendations(['react-pro']);
      
      // ACT
      const result = flow.modifyRecommendations({
        add: ['angular-expert']
      });
      
      // ASSERT
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(0);
      expect(result.conflicts![0]).toMatchObject({
        agent1: 'react-pro',
        agent2: 'angular-expert'
      });
    });
  });

  describe('Interactive Questions', () => {
    test('should generate clarifying questions', () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        frameworks: [],
        developmentPhase: 'initial-setup',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };
      
      // ACT
      const questions = flow.generateQuestions(context);
      
      // ASSERT
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0]).toHaveProperty('id');
      expect(questions[0]).toHaveProperty('question');
      expect(questions[0]).toHaveProperty('options');
    });

    test('should update context based on answers', async () => {
      // ARRANGE
      const context: ProjectContext = {
        projectType: 'nodejs',
        frameworks: [],
        developmentPhase: 'initial-setup',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      };
      const questions = flow.generateQuestions(context);
      
      // ACT
      const firstQuestion = questions[0];
      const updatedContext = flow.applyAnswers(context, firstQuestion ? [
        { questionId: firstQuestion.id, answer: 'react' }
      ] : []);
      
      // ASSERT
      expect(updatedContext).toBeDefined();
      // The context should be updated based on the answer
    });
  });

  describe('Summary Generation', () => {
    test('should generate recommendation summary', async () => {
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
      
      // Mock context analyzer to set context in state
      jest.spyOn(ContextAnalyzer.prototype, 'analyzeProject')
        .mockResolvedValue(context);
      
      await flow.initialize('/test/project');
      await flow.generateRecommendations();
      flow.confirmRecommendations(['react-pro', 'typescript-pro']);
      
      // ACT
      const summary = flow.generateSummary();
      
      // ASSERT
      expect(summary).toBeDefined();
      expect(summary.selectedAgents).toContain('react-pro');
      expect(summary.selectedAgents).toContain('typescript-pro');
      expect(summary.projectContext).toBeDefined();
      expect(summary.reasoning).toBeDefined();
    });
  });

  describe('Flow State Management', () => {
    test('should track flow state transitions', async () => {
      // ARRANGE & ACT
      const states: string[] = [];
      
      // Initial state
      states.push(flow.getState().phase);
      
      // After initialization
      await flow.initialize('/test/project');
      states.push(flow.getState().phase);
      
      // After generating recommendations
      await flow.generateRecommendations({
        projectType: 'nodejs',
        frameworks: ['react'],
        developmentPhase: 'active-development',
        buildTools: [],
        lintingTools: [],
        testingTools: []
      });
      states.push(flow.getState().phase);
      
      // After confirmation
      flow.confirmRecommendations(['react-pro']);
      states.push(flow.getState().phase);
      
      // ASSERT
      expect(states).toEqual(['idle', 'analyzing', 'recommending', 'confirmed']);
    });

    test('should allow resetting the flow', () => {
      // ARRANGE
      flow.confirmRecommendations(['react-pro']);
      
      // ACT
      flow.reset();
      
      // ASSERT
      expect(flow.getState().phase).toBe('idle');
      expect(flow.getState().selectedAgents).toEqual([]);
    });
  });
});

/**
 * TDD Implementation Notes:
 * 
 * RED PHASE (Current):
 * - Tests define expected behavior for interactive flow
 * - Tests will fail until InteractiveRecommendationFlow is implemented
 * 
 * GREEN PHASE (Next):
 * - Implement InteractiveRecommendationFlow class
 * - Implement state management
 * - Implement user interaction methods
 * 
 * REFACTOR PHASE (After Green):
 * - Optimize question generation
 * - Improve conflict resolution
 * - Enhance summary generation
 */