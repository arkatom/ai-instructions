/**
 * Interactive Agent Selector Tests
 * Issue #97: TDD for interactive UI implementation
 */

import { InteractiveAgentSelector } from '../../src/cli/InteractiveAgentSelector';
import { AgentMetadata } from '../../src/agents/types';
import inquirer from 'inquirer';

// Mock chalk with simple functions - no jest.fn() needed
jest.mock('chalk', () => ({
  blue: (text: string) => text,
  green: (text: string) => text,
  yellow: (text: string) => text,
  cyan: (text: string) => text,
  magenta: (text: string) => text,
  red: (text: string) => text,
  gray: (text: string) => text,
  bold: {
    blue: (text: string) => text,
    green: (text: string) => text,
  }
}));

// Mock inquirer
jest.mock('inquirer');
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('InteractiveAgentSelector', () => {
  let selector: InteractiveAgentSelector;
  let mockAgents: AgentMetadata[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    selector = new InteractiveAgentSelector({
      pageSize: 10,
      showDescriptions: true,
      enableColors: true,
      enableMultiSelect: true,
      searchThreshold: 0.3
    });

    // Create test agents
    mockAgents = [
      {
        name: 'react-pro',
        category: 'development',
        description: 'React development expert',
        tags: ['react', 'frontend'],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      },
      {
        name: 'test-writer-fixer',
        category: 'quality',
        description: 'Test automation expert',
        tags: ['testing', 'quality'],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      },
      {
        name: 'api-designer',
        category: 'business',
        description: 'API design specialist',
        tags: ['api', 'design'],
        relationships: {
          requires: [],
          enhances: [],
          collaborates_with: [],
          conflicts_with: []
        }
      }
    ];
  });

  describe('showMainMenu', () => {
    it('should display main menu options', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt.mockResolvedValueOnce({ mode: 'category' });

      const result = await selector.showMainMenu();

      expect(result).toBe('category');
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'mode',
            message: expect.stringContaining('Select viewing mode')
          })
        ])
      );
    });

    it('should handle exit selection', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt.mockResolvedValueOnce({ mode: 'exit' });

      await expect(selector.showMainMenu()).rejects.toThrow('User cancelled');
    });
  });

  describe('browseByCategory', () => {
    it('should group agents by category', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt
        .mockResolvedValueOnce({ category: 'development' })
        .mockResolvedValueOnce({ agents: ['react-pro'] });

      const result = await selector.browseByCategory(mockAgents);

      expect(result.selectedAgents).toHaveLength(1);
      expect(result.selectedAgents[0]?.name).toBe('react-pro');
      expect(result.mode).toBe('category');
      expect(result.cancelled).toBe(false);
    });

    it('should show category statistics', async () => {
      const stats = selector.getCategoryStats(mockAgents);

      expect(stats).toHaveLength(3);
      expect(stats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'development',
            count: 1
          }),
          expect.objectContaining({
            category: 'quality',
            count: 1
          }),
          expect.objectContaining({
            category: 'business',
            count: 1
          })
        ])
      );
    });

    it('should handle empty category selection', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt
        .mockResolvedValueOnce({ category: 'nonexistent' })
        .mockResolvedValueOnce({ agents: [] });

      const result = await selector.browseByCategory(mockAgents);

      expect(result.selectedAgents).toHaveLength(0);
      expect(result.cancelled).toBe(false);
    });
  });

  describe('searchAgents', () => {
    it('should perform fuzzy search on agent names', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt
        .mockResolvedValueOnce({ query: 'react' })
        .mockResolvedValueOnce({ agents: ['react-pro'] });

      const result = await selector.searchAgents(mockAgents);

      expect(result.selectedAgents).toHaveLength(1);
      expect(result.selectedAgents[0]?.name).toBe('react-pro');
      expect(result.mode).toBe('search');
    });

    it('should search in descriptions and tags', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt
        .mockResolvedValueOnce({ query: 'test' })
        .mockResolvedValueOnce({ agents: ['test-writer-fixer'] });

      const result = await selector.searchAgents(mockAgents);

      expect(result.selectedAgents).toHaveLength(1);
      expect(result.selectedAgents[0]?.name).toBe('test-writer-fixer');
    });

    it('should handle no search results', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt
        .mockResolvedValueOnce({ query: 'nonexistent' })
        .mockResolvedValueOnce({ agents: [] });

      const result = await selector.searchAgents(mockAgents);

      expect(result.selectedAgents).toHaveLength(0);
      expect(result.cancelled).toBe(false);
    });
  });

  describe('viewAllPaginated', () => {
    it('should paginate large agent lists', async () => {
      // Create many agents for pagination test
      const manyAgents: AgentMetadata[] = [];
      for (let i = 0; i < 25; i++) {
        manyAgents.push({
          name: `agent-${i}`,
          category: 'test',
          description: `Test agent ${i}`,
          tags: [],
          relationships: {
            requires: [],
            enhances: [],
            collaborates_with: [],
            conflicts_with: []
          }
        });
      }

      const mockPrompt = mockedInquirer.prompt;
      // PaginationHelpers.handlePaginatedMultiSelect uses a single prompt with multiple questions
      mockPrompt.mockResolvedValueOnce({ 
        agents: ['agent-0', 'agent-1'], // checkbox prompt for agents
        action: 'select' // list prompt for action
      });

      const result = await selector.viewAllPaginated(manyAgents);

      expect(result.selectedAgents).toHaveLength(2);
      expect(result.selectedAgents.map(a => a.name)).toEqual(['agent-0', 'agent-1']);
      expect(result.mode).toBe('all');
    });

    it('should navigate between pages', async () => {
      const mockPrompt = mockedInquirer.prompt;
      // First page - select agents and navigate next
      mockPrompt.mockResolvedValueOnce({ 
        agents: [],
        action: '_next'
      });
      // Second page - select agent and confirm
      mockPrompt.mockResolvedValueOnce({ 
        agents: ['test-writer-fixer'],
        action: 'select'
      });

      const result = await selector.viewAllPaginated(mockAgents);

      expect(mockPrompt).toHaveBeenCalledTimes(2);
      expect(result.selectedAgents).toHaveLength(1);
    });
  });

  describe('showAgentDetails', () => {
    it('should display agent details with formatting', async () => {
      const testAgent = mockAgents[0];
      expect(testAgent).toBeDefined();
      expect(testAgent?.name).toBe('react-pro');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await selector.showAgentDetails(testAgent!);

      expect(consoleSpy).toHaveBeenCalled();
      
      // Verify the content includes expected values
      const loggedContent = consoleSpy.mock.calls[0]?.[0];
      expect(loggedContent).toContain('react-pro');
      expect(loggedContent).toContain('development');
      expect(loggedContent).toContain('React development expert');

      consoleSpy.mockRestore();
    });

    it('should use colors when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await selector.showAgentDetails(mockAgents[0]!);

      // Verify the output was generated (chalk functions were used)
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0];
      expect(output).toBeDefined();
      expect(output).toContain('Agent:');
      expect(output).toContain('Category:');

      consoleSpy.mockRestore();
    });
  });

  describe('showRecommended', () => {
    it('should filter and display recommended agents', async () => {
      const mockPrompt = mockedInquirer.prompt;
      
      // Mock recommendation logic
      selector.getRecommendedAgents = jest.fn().mockReturnValue([mockAgents[0], mockAgents[1]]);
      
      // Single prompt with both agents and action
      mockPrompt.mockResolvedValueOnce({ 
        agents: ['react-pro'],
        action: 'select'
      });

      const result = await selector.showRecommended(mockAgents);

      expect(result.selectedAgents).toHaveLength(1);
      expect(result.selectedAgents[0]?.name).toBe('react-pro');
      expect(result.mode).toBe('recommended');
    });
  });

  describe('color coding', () => {
    it('should apply category-specific colors', () => {
      const stats = selector.getCategoryStats(mockAgents);
      
      const devCategory = stats.find(s => s.category === 'development');
      expect(devCategory?.color).toBe('green');
      
      const qualityCategory = stats.find(s => s.category === 'quality');
      expect(qualityCategory?.color).toBe('yellow');
      
      const businessCategory = stats.find(s => s.category === 'business');
      expect(businessCategory?.color).toBe('blue');
    });
  });

  describe('multi-select functionality', () => {
    it('should allow multiple agent selection when enabled', async () => {
      const mockPrompt = mockedInquirer.prompt;
      // Single prompt with both agents and action - use actual agent names from mockAgents
      mockPrompt.mockResolvedValueOnce({ 
        agents: ['react-pro', 'test-writer-fixer'],
        action: 'select'
      });

      const result = await selector.viewAllPaginated(mockAgents);

      expect(result.selectedAgents).toHaveLength(2);
      expect(result.selectedAgents.map(a => a.name)).toEqual(['react-pro', 'test-writer-fixer']);
    });

    it('should restrict to single selection when multi-select disabled', async () => {
      selector = new InteractiveAgentSelector({
        pageSize: 10,
        showDescriptions: true,
        enableColors: true,
        enableMultiSelect: false,
        searchThreshold: 0.3
      });

      const mockPrompt = mockedInquirer.prompt;
      // Single prompt with both agent and action
      mockPrompt.mockResolvedValueOnce({ 
        agent: 'react-pro',
        action: 'select'
      });

      const result = await selector.viewAllPaginated(mockAgents);

      expect(result.selectedAgents).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle prompt errors gracefully', async () => {
      const mockPrompt = mockedInquirer.prompt;
      mockPrompt.mockRejectedValueOnce(new Error('Prompt error'));

      await expect(selector.showMainMenu()).rejects.toThrow('Prompt error');
    });

    it('should handle empty agent list', async () => {
      const result = await selector.browseByCategory([]);

      expect(result.selectedAgents).toHaveLength(0);
      expect(result.cancelled).toBe(false);
    });
  });
});