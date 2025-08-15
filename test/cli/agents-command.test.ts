/**
 * TDD RED PHASE: AgentsCommand Tests
 * Issue #93: Agent deployment CLI commands implementation
 * 
 * Test-First Development following strict TDD principles
 */

import { AgentsCommand } from '../../src/cli/commands/AgentsCommand';
import { AgentCommandArgs } from '../../src/cli/interfaces/CommandArgs';
import { AgentMetadata } from '../../src/agents/types';
import { AgentMetadataLoader } from '../../src/agents/metadata-loader';
import { AgentValidator } from '../../src/cli/validators/AgentValidator';

// Mock the modules
jest.mock('../../src/agents/metadata-loader');
jest.mock('../../src/cli/validators/AgentValidator');

describe('AgentsCommand', () => {
  let command: AgentsCommand;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock agent metadata
    const mockAgentMetadata: AgentMetadata = {
      name: 'test-writer-fixer',
      category: 'quality',
      description: 'Test writing and fixing agent',
      tags: ['testing', 'quality', 'jest', 'tdd'],
      relationships: {
        requires: [],
        enhances: ['code-reviewer'],
        collaborates_with: ['rapid-prototyper'],
        conflicts_with: []
      }
    };
    
    // Setup mock metadata loader
    (AgentMetadataLoader as jest.MockedClass<typeof AgentMetadataLoader>).mockImplementation(() => {
      return {
        loadAgentMetadata: jest.fn().mockImplementation((name: string) => {
          if (name === 'test-writer-fixer') {
            return Promise.resolve(mockAgentMetadata);
          }
          return Promise.resolve(null);
        }),
        loadAllMetadata: jest.fn().mockResolvedValue([]),
        getAgentsByCategory: jest.fn().mockResolvedValue([])
      } as unknown as AgentMetadataLoader;
    });
    
    // Setup mock validator
    (AgentValidator as jest.MockedClass<typeof AgentValidator>).mockImplementation(() => {
      return {
        validate: jest.fn().mockImplementation((name: string) => {
          if (name && name.includes('../')) {
            return { 
              isValid: false, 
              errors: ['Agent name contains invalid characters: ' + name] 
            };
          }
          return { isValid: true, errors: [] };
        }),
        validateExists: jest.fn().mockImplementation((name: string) => {
          if (name === 'test-writer-fixer') {
            return Promise.resolve({ isValid: true, errors: [] });
          }
          return Promise.resolve({ isValid: false, errors: ['Agent not found'] });
        })
      } as unknown as AgentValidator;
    });
    
    command = new AgentsCommand();
  });

  describe('Command Interface Compliance', () => {
    it('should implement Command interface', () => {
      expect(typeof command.execute).toBe('function');
      expect(typeof command.validate).toBe('function');
    });
  });

  describe('info subcommand', () => {
    describe('validation', () => {
      it('should require agent name for info subcommand', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info'
          // name is missing
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Agent name is required for info subcommand');
      });

      it('should validate agent name format', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: '../invalid-name'
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
      });

      it('should pass validation with valid agent name', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'test-writer-fixer'
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
    });

    describe('execution', () => {
      it('should display agent metadata for existing agent', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'test-writer-fixer'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        
        const data = result.data as AgentMetadata;
        expect(data).toHaveProperty('name', 'test-writer-fixer');
        expect(data).toHaveProperty('category');
        expect(data).toHaveProperty('description');
        expect(data).toHaveProperty('relationships');
      });

      it('should return error for non-existent agent', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'non-existent-agent'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Agent metadata not found');
      });

      it('should support JSON output format', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'test-writer-fixer',
          format: 'json'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // JSON format should be handled by display logic
      });

      it('should display agent relationships', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'test-writer-fixer'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('relationships');
        
        const data = result.data as AgentMetadata;
        expect(data.relationships).toHaveProperty('requires');
        expect(data.relationships).toHaveProperty('enhances');
        expect(data.relationships).toHaveProperty('collaborates_with');
        expect(data.relationships).toHaveProperty('conflicts_with');
      });

      it('should include detailed agent metadata', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'info',
          name: 'test-writer-fixer'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        
        const data = result.data as AgentMetadata;
        expect(data).toHaveProperty('tags');
        expect(Array.isArray(data.tags)).toBe(true);
        
        // Optional metadata fields
        if (data.source) {
          expect(typeof data.source).toBe('string');
        }
        if (data.version) {
          expect(typeof data.version).toBe('string');
        }
        if (data.author) {
          expect(typeof data.author).toBe('string');
        }
      });
    });
  });
});