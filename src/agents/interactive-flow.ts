/**
 * Interactive Recommendation Flow for Intelligent Agent Recommendation System
 * Provides an interactive workflow for agent selection and customization
 */

import { ContextAnalyzer } from './context-analyzer';
import { RecommendationEngine } from './recommendation-engine';
import { DependencyResolver } from './dependency-resolver';
import type { 
  ProjectContext, 
  AgentMetadata
} from './types';

/**
 * Flow state phases
 */
export type FlowPhase = 'idle' | 'analyzing' | 'recommending' | 'questioning' | 'confirmed';

/**
 * Interactive question structure
 */
export interface InteractiveQuestion {
  id: string;
  question: string;
  type: 'single-choice' | 'multiple-choice' | 'text';
  options?: string[];
  context?: string;
}

/**
 * Answer to interactive question
 */
export interface QuestionAnswer {
  questionId: string;
  answer: string | string[];
}

/**
 * Flow state structure
 */
export interface FlowState {
  phase: FlowPhase;
  projectPath?: string;
  context?: ProjectContext;
  recommendations?: {
    primary: string[];
    suggested: string[];
    explanations?: Record<string, string>;
  };
  selectedAgents: string[];
  questions?: InteractiveQuestion[];
}

/**
 * Modification request structure
 */
export interface ModificationRequest {
  add?: string[];
  remove?: string[];
}

/**
 * Modification result
 */
export interface ModificationResult {
  selectedAgents: string[];
  conflicts?: Array<{
    agent1: string;
    agent2: string;
    reason?: string;
  }>;
}

/**
 * Confirmation result
 */
export interface ConfirmationResult {
  confirmed: boolean;
  selectedAgents: string[];
  conflicts?: Array<{
    agent1: string;
    agent2: string;
    reason?: string;
  }>;
}

/**
 * Flow summary
 */
export interface FlowSummary {
  selectedAgents: string[];
  projectContext: ProjectContext | undefined;
  reasoning: string;
  conflicts?: Array<{
    agent1: string;
    agent2: string;
    reason?: string;
  }>;
}

/**
 * Interactive Recommendation Flow class
 */
export class InteractiveRecommendationFlow {
  private agents: AgentMetadata[];
  private contextAnalyzer?: ContextAnalyzer;
  private recommendationEngine: RecommendationEngine;
  private dependencyResolver: DependencyResolver;
  private state: FlowState;

  constructor(agents: AgentMetadata[]) {
    this.agents = agents;
    this.recommendationEngine = new RecommendationEngine(agents);
    const agentsMap = new Map(agents.map(agent => [agent.name, agent]));
    this.dependencyResolver = new DependencyResolver(agentsMap);
    this.state = {
      phase: 'idle',
      selectedAgents: []
    };
  }

  /**
   * Initialize the flow with a project path
   */
  async initialize(projectPath: string): Promise<void> {
    this.state.projectPath = projectPath;
    this.state.phase = 'analyzing';
    
    // Analyze project context
    this.contextAnalyzer = new ContextAnalyzer(projectPath);
    const context = await this.contextAnalyzer.analyzeProject();
    
    this.state.context = context;
  }

  /**
   * Generate recommendations based on context
   */
  async generateRecommendations(
    context?: ProjectContext
  ): Promise<FlowState['recommendations']> {
    const ctx = context || this.state.context;
    if (!ctx) {
      throw new Error('Context is required to generate recommendations');
    }
    
    this.state.phase = 'recommending';
    
    // Generate recommendations with explanations
    const recommendations = this.recommendationEngine.recommend(ctx, {
      includeExplanations: true,
      resolveDependencies: true
    });
    
    this.state.recommendations = {
      primary: recommendations.primary,
      suggested: recommendations.suggested,
      ...(recommendations.explanations && { explanations: recommendations.explanations })
    };
    
    return this.state.recommendations;
  }

  /**
   * Generate clarifying questions based on context
   */
  generateQuestions(context: ProjectContext): InteractiveQuestion[] {
    const questions: InteractiveQuestion[] = [];
    
    // Question about frameworks if none detected
    if (!context.frameworks || context.frameworks.length === 0) {
      questions.push({
        id: 'framework-choice',
        question: 'What framework are you using or planning to use?',
        type: 'single-choice',
        options: ['react', 'vue', 'angular', 'express', 'django', 'flask', 'none'],
        context: 'This helps us recommend framework-specific agents'
      });
    }
    
    // Question about team size if not detected
    if (!context.teamSize) {
      questions.push({
        id: 'team-size',
        question: 'What is your team size?',
        type: 'single-choice',
        options: ['solo', 'small (2-5)', 'medium (6-20)', 'large (20+)'],
        context: 'Larger teams may benefit from different agent configurations'
      });
    }
    
    // Question about priorities
    questions.push({
      id: 'priorities',
      question: 'What are your current priorities?',
      type: 'multiple-choice',
      options: [
        'performance',
        'security',
        'testing',
        'deployment',
        'documentation',
        'user-experience'
      ],
      context: 'We\'ll prioritize agents that match your needs'
    });
    
    this.state.questions = questions;
    this.state.phase = 'questioning';
    
    return questions;
  }

  /**
   * Apply answers to update context
   */
  applyAnswers(
    context: ProjectContext,
    answers: QuestionAnswer[]
  ): ProjectContext {
    const updatedContext = { ...context };
    
    for (const answer of answers) {
      switch (answer.questionId) {
        case 'framework-choice':
          if (answer.answer !== 'none' && typeof answer.answer === 'string') {
            updatedContext.frameworks = [answer.answer];
          }
          break;
          
        case 'team-size': {
          const sizeMap: Record<string, number> = {
            'solo': 1,
            'small (2-5)': 3,
            'medium (6-20)': 10,
            'large (20+)': 30
          };
          if (typeof answer.answer === 'string') {
            updatedContext.teamSize = sizeMap[answer.answer] || 1;
          }
          break;
        }
          
        case 'priorities':
          // This could influence the development phase or other aspects
          // For now, we'll just note it in the context
          break;
      }
    }
    
    this.state.context = updatedContext;
    return updatedContext;
  }

  /**
   * Confirm selected recommendations
   */
  confirmRecommendations(selectedAgents: string[]): ConfirmationResult {
    this.state.selectedAgents = selectedAgents;
    this.state.phase = 'confirmed';
    
    // Check for conflicts
    const resolution = this.dependencyResolver.resolve(selectedAgents);
    
    const result: ConfirmationResult = {
      confirmed: true,
      selectedAgents: selectedAgents
    };
    
    if (resolution.conflicts.length > 0) {
      result.conflicts = resolution.conflicts;
    }
    
    return result;
  }

  /**
   * Modify recommendations by adding or removing agents
   */
  modifyRecommendations(request: ModificationRequest): ModificationResult {
    let selectedAgents = [...this.state.selectedAgents];
    
    // Remove agents
    if (request.remove) {
      selectedAgents = selectedAgents.filter(
        agent => !request.remove!.includes(agent)
      );
    }
    
    // Add agents
    if (request.add) {
      for (const agent of request.add) {
        if (!selectedAgents.includes(agent)) {
          selectedAgents.push(agent);
        }
      }
    }
    
    // Check for conflicts
    const resolution = this.dependencyResolver.resolve(selectedAgents);
    
    // Update state
    this.state.selectedAgents = selectedAgents;
    
    const result: ModificationResult = {
      selectedAgents
    };
    
    if (resolution.conflicts.length > 0) {
      result.conflicts = resolution.conflicts.map(c => ({
        agent1: c.agent1,
        agent2: c.agent2,
        ...(c.reason && { reason: c.reason })
      }));
    }
    
    return result;
  }

  /**
   * Generate a summary of the flow
   */
  generateSummary(): FlowSummary {
    const reasoning = this.generateReasoning();
    
    // Check for conflicts in final selection
    const resolution = this.dependencyResolver.resolve(this.state.selectedAgents);
    
    const summary: FlowSummary = {
      selectedAgents: this.state.selectedAgents,
      projectContext: this.state.context,
      reasoning
    };
    
    if (resolution.conflicts.length > 0) {
      summary.conflicts = resolution.conflicts;
    }
    
    return summary;
  }

  /**
   * Generate reasoning for the recommendations
   */
  private generateReasoning(): string {
    const reasons: string[] = [];
    
    if (this.state.context) {
      reasons.push(`Project type: ${this.state.context.projectType}`);
      
      if (this.state.context.frameworks && this.state.context.frameworks.length > 0) {
        reasons.push(`Frameworks: ${this.state.context.frameworks.join(', ')}`);
      }
      
      reasons.push(`Development phase: ${this.state.context.developmentPhase}`);
      
      if (this.state.context.primaryLanguage) {
        reasons.push(`Primary language: ${this.state.context.primaryLanguage}`);
      }
    }
    
    reasons.push(`Selected ${this.state.selectedAgents.length} agents for optimal coverage`);
    
    // Add agent-specific reasoning
    for (const agentName of this.state.selectedAgents) {
      const agent = this.agents.find(a => a.name === agentName);
      if (agent && this.state.recommendations?.explanations?.[agentName]) {
        reasons.push(`${agentName}: ${this.state.recommendations.explanations[agentName]}`);
      }
    }
    
    return reasons.join('. ');
  }

  /**
   * Reset the flow to initial state
   */
  reset(): void {
    this.state = {
      phase: 'idle',
      selectedAgents: []
    };
  }

  /**
   * Get current flow state
   */
  getState(): FlowState {
    return { ...this.state };
  }
}

/**
 * Export helper function to create interactive flow
 */
export function createInteractiveFlow(
  agents: AgentMetadata[]
): InteractiveRecommendationFlow {
  return new InteractiveRecommendationFlow(agents);
}