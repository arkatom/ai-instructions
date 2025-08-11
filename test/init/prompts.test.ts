import { InteractivePrompts, PromptValidators } from '../../src/init/prompts';
import { ProjectConfig } from '../../src/init/config';
import inquirer from 'inquirer';

// Type definitions for test mocks
interface MockQuestion {
  name: string;
  type?: string;
  message?: string;
  choices?: Array<{ name: string; value: string; checked?: boolean }>;
  default?: unknown;
  validate?: (value: unknown) => boolean | string;
  when?: (answers: Record<string, unknown>) => boolean;
}

type MockQuestions = MockQuestion | MockQuestion[];

interface MockExit {
  (code?: string | number | null | undefined): never;
}

// Mock inquirer
jest.mock('inquirer');
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

// Mock chalk to avoid color codes in tests
jest.mock('chalk', () => ({
  default: {
    blue: jest.fn((str) => str),
    gray: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    green: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    red: jest.fn((str) => str)
  },
  blue: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  green: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  red: jest.fn((str) => str)
}));

describe('InteractivePrompts', () => {
  let prompts: InteractivePrompts;
  const templatesDir = '/templates';

  beforeEach(() => {
    prompts = new InteractivePrompts(templatesDir);
    jest.clearAllMocks();
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runInteractiveFlow', () => {
    it('should run complete flow for new configuration', async () => {
      // Arrange
      const mockResponses = {
        projectName: 'test-project',
        outputDirectory: '/test/output',
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd', 'tdd'],
        languages: ['typescript', 'javascript'],
        agents: ['frontend-specialist'],
        confirmGeneration: true
      };

      // Mock both prompt calls - first for questions, second for confirmation
      mockedInquirer.prompt
        .mockResolvedValueOnce(mockResponses)
        .mockResolvedValueOnce({ confirmGeneration: true });

      // Act
      const config = await prompts.runInteractiveFlow(null, '/default/output');

      // Assert
      expect(config.projectName).toBe('test-project');
      expect(config.outputDirectory).toBe('/test/output');
      expect(config.tool).toBe('claude');
      expect(config.workflow).toBe('github-flow');
      expect(config.methodologies).toEqual(['github-idd', 'tdd']);
      expect(config.languages).toEqual(['typescript', 'javascript']);
      expect(config.agents).toEqual(['frontend-specialist']);
      expect(config.generatedAt).toBeDefined();
      expect(config.version).toBe('0.5.0');
    });

    it('should handle existing configuration update flow', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'existing-project',
        outputDirectory: '/existing/path',
        generatedAt: new Date().toISOString(),
        version: '0.4.0'
      };

      // First prompt: should update?
      mockedInquirer.prompt.mockResolvedValueOnce({ shouldUpdate: true });

      // Second prompt: new configuration
      mockedInquirer.prompt.mockResolvedValueOnce({
        projectName: 'updated-project',
        outputDirectory: '/updated/path',
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        agents: ['backend-architect']
      });

      // Third prompt: confirmation
      mockedInquirer.prompt.mockResolvedValueOnce({
        confirmGeneration: true
      });

      // Act
      const config = await prompts.runInteractiveFlow(existingConfig, '/default');

      // Assert
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(3);
      expect(config.projectName).toBe('updated-project');
      expect(config.tool).toBe('claude');
    });

    it('should keep existing configuration if user chooses not to update', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'cline',
        workflow: 'github-flow',
        methodologies: ['tdd'],
        languages: ['go'],
        projectName: 'keep-project',
        outputDirectory: '/keep/path',
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      mockedInquirer.prompt.mockResolvedValueOnce({ shouldUpdate: false });

      // Act
      const config = await prompts.runInteractiveFlow(existingConfig);

      // Assert
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
      expect(config).toBe(existingConfig);
    });

    it('should exit process if user cancels generation', async () => {
      // Arrange
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`Process exited with code ${code}`);
      }) as MockExit);

      // First prompt: configuration questions
      mockedInquirer.prompt.mockResolvedValueOnce({
        projectName: 'cancelled-project',
        outputDirectory: '/cancelled',
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript']
      });

      // Second prompt: confirmation (user cancels)
      mockedInquirer.prompt.mockResolvedValueOnce({
        confirmGeneration: false
      });

      // Act & Assert
      await expect(prompts.runInteractiveFlow()).rejects.toThrow('Process exited with code 0');
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should only show agents prompt for Claude tool', async () => {
      // Arrange
      const responses = {
        projectName: 'cursor-project',
        outputDirectory: '/cursor',
        tool: 'cursor',
        workflow: 'github-flow',
        methodologies: ['tdd'],
        languages: ['javascript'],
        confirmGeneration: true
      };

      mockedInquirer.prompt.mockImplementation(((questions: MockQuestions) => {
        // Check if agents question is included
        const questionArray = Array.isArray(questions) ? questions : [questions];
        const hasAgentsQuestion = questionArray.some((q: MockQuestion) => q.name === 'agents');
        
        if (hasAgentsQuestion) {
          // Check the when condition
          const agentsQuestion = questionArray.find((q: MockQuestion) => q.name === 'agents');
          const shouldShowAgents = agentsQuestion?.when ? agentsQuestion.when(responses) : true;
          expect(shouldShowAgents).toBe(false);
        }
        
        return Promise.resolve(responses);
      }) as jest.MockedFunction<typeof inquirer.prompt>);

      // Act
      const config = await prompts.runInteractiveFlow();

      // Assert
      expect(config.agents).toBeUndefined();
    });

    it('should show agents prompt for Claude tool', async () => {
      // Arrange
      const responses = {
        projectName: 'claude-project',
        outputDirectory: '/claude',
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        agents: ['frontend-specialist', 'code-reviewer'],
        confirmGeneration: true
      };

      mockedInquirer.prompt.mockImplementation(((questions: MockQuestions) => {
        // Check if agents question is included
        const questionArray = Array.isArray(questions) ? questions : [questions];
        const hasAgentsQuestion = questionArray.some((q: MockQuestion) => q.name === 'agents');
        
        if (hasAgentsQuestion) {
          const agentsQuestion = questionArray.find((q: MockQuestion) => q.name === 'agents');
          const shouldShowAgents = agentsQuestion?.when ? agentsQuestion.when(responses) : true;
          expect(shouldShowAgents).toBe(true);
        }
        
        return Promise.resolve(responses);
      }) as jest.MockedFunction<typeof inquirer.prompt>);

      // Act
      const config = await prompts.runInteractiveFlow();

      // Assert
      expect(config.agents).toEqual(['frontend-specialist', 'code-reviewer']);
    });

    it('should validate required fields', async () => {
      // Arrange
      let validationTested = false;
      
      mockedInquirer.prompt.mockImplementation(((questions: MockQuestions) => {
        if (!validationTested && Array.isArray(questions)) {
          // Test validations on first call (configuration questions)
          const projectNameQ = questions.find((q: MockQuestion) => q.name === 'projectName');
          const outputDirQ = questions.find((q: MockQuestion) => q.name === 'outputDirectory');
          const methodologiesQ = questions.find((q: MockQuestion) => q.name === 'methodologies');
          const languagesQ = questions.find((q: MockQuestion) => q.name === 'languages');

          if (projectNameQ && outputDirQ && methodologiesQ && languagesQ) {
            // Test project name validation
            expect(projectNameQ.validate?.('')).toBe('Project name cannot be empty');
            expect(projectNameQ.validate?.('valid-name')).toBe(true);
            expect(projectNameQ.validate?.('name<with>pipe|')).toBe('Project name cannot contain forbidden characters (<, >, |)');

            // Test output directory validation
            expect(outputDirQ.validate?.('')).toBe('Output directory cannot be empty');
            expect(outputDirQ.validate?.('/valid/path')).toBe(true);

            // Test methodologies validation
            expect(methodologiesQ.validate?.([])).toBe('Please select at least one methodology');
            expect(methodologiesQ.validate?.(['github-idd'])).toBe(true);

            // Test languages validation
            expect(languagesQ.validate?.([])).toBe('Please select at least one language');
            expect(languagesQ.validate?.(['typescript'])).toBe(true);

            validationTested = true;
            
            return Promise.resolve({
              projectName: 'test',
              outputDirectory: '/test',
              tool: 'claude',
              workflow: 'github-flow',
              methodologies: ['github-idd'],
              languages: ['typescript'],
              agents: ['frontend-specialist']
            });
          }
        }
        
        // Second call (confirmation)
        return Promise.resolve({
          confirmGeneration: true
        });
      }) as jest.MockedFunction<typeof inquirer.prompt>);

      // Act
      await prompts.runInteractiveFlow();

      // Assert
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(2);
      expect(validationTested).toBe(true);
    });

    it('should set default values from existing config', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'github-copilot',
        workflow: 'git-flow',
        methodologies: ['scrum', 'tdd'],
        languages: ['python', 'go'],
        agents: ['devops-engineer'],
        projectName: 'existing-name',
        outputDirectory: '/existing/dir',
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      let defaultsTested = false;

      mockedInquirer.prompt
        .mockResolvedValueOnce({ shouldUpdate: true })
        .mockImplementation(((questions: MockQuestions) => {
          if (!defaultsTested && Array.isArray(questions)) {
            // Check defaults are set from existing config
            const projectNameQ = questions.find((q: MockQuestion) => q.name === 'projectName');
            const toolQ = questions.find((q: MockQuestion) => q.name === 'tool');
            const workflowQ = questions.find((q: MockQuestion) => q.name === 'workflow');

            if (projectNameQ && toolQ && workflowQ) {
              expect(projectNameQ.default).toBe('existing-name');
              expect(toolQ.default).toBe('github-copilot');
              expect(workflowQ.default).toBe('git-flow');

              // Check checkbox defaults
              const methodologiesQ = questions.find((q: MockQuestion) => q.name === 'methodologies');
              if (methodologiesQ) {
                const scrumChoice = methodologiesQ.choices?.find((c: { name: string; value: string; checked?: boolean }) => c.value === 'scrum');
                expect(scrumChoice?.checked).toBe(true);
              }

              defaultsTested = true;

              return Promise.resolve({
                projectName: 'new-name',
                outputDirectory: '/new/dir',
                tool: 'claude',
                workflow: 'github-flow',
                methodologies: ['github-idd'],
                languages: ['typescript']
              });
            }
          }
          
          // Third call (confirmation)
          return Promise.resolve({
            confirmGeneration: true
          });
        }) as jest.MockedFunction<typeof inquirer.prompt>);

      // Act
      await prompts.runInteractiveFlow(existingConfig);

      // Assert
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(3);
      expect(defaultsTested).toBe(true);
    });
  });

  describe('showHelp', () => {
    it('should display help information', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      InteractivePrompts.showHelp();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AI Instructions - Interactive Setup'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Tools:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Workflows:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Methodologies:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available Languages:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should list all available tools', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      InteractivePrompts.showHelp();

      // Assert
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      const output = calls.join('\n');
      
      expect(output).toContain('claude');
      expect(output).toContain('cursor');
      expect(output).toContain('cline');
      expect(output).toContain('github-copilot');
    });
  });
});

describe('PromptValidators', () => {
  describe('validateProjectName', () => {
    it('should accept valid project names', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateProjectName('my-project')).toBe(true);
      expect(PromptValidators.validateProjectName('Project123')).toBe(true);
      expect(PromptValidators.validateProjectName('test_project')).toBe(true);
      expect(PromptValidators.validateProjectName('a')).toBe(true);
    });

    it('should reject empty project names', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateProjectName('')).toBe('Project name cannot be empty');
      expect(PromptValidators.validateProjectName('   ')).toBe('Project name cannot be empty');
    });

    it('should reject project names with forbidden characters', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateProjectName('project<name>')).toBe('Project name cannot contain forbidden characters (<, >, |)');
      expect(PromptValidators.validateProjectName('project|name')).toBe('Project name cannot contain forbidden characters (<, >, |)');
      expect(PromptValidators.validateProjectName('project>name')).toBe('Project name cannot contain forbidden characters (<, >, |)');
    });
  });

  describe('validateOutputDirectory', () => {
    it('should accept valid directory paths', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateOutputDirectory('/valid/path')).toBe(true);
      expect(PromptValidators.validateOutputDirectory('.')).toBe(true);
      expect(PromptValidators.validateOutputDirectory('../parent')).toBe(true);
      expect(PromptValidators.validateOutputDirectory('/usr/local/bin')).toBe(true);
    });

    it('should reject empty directory paths', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateOutputDirectory('')).toBe('Output directory cannot be empty');
      expect(PromptValidators.validateOutputDirectory('   ')).toBe('Output directory cannot be empty');
    });
  });

  describe('validateNonEmptyArray', () => {
    it('should accept non-empty arrays', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateNonEmptyArray(['item1'], 'items')).toBe(true);
      expect(PromptValidators.validateNonEmptyArray(['item1', 'item2'], 'items')).toBe(true);
    });

    it('should reject empty arrays', () => {
      // Arrange & Act & Assert
      expect(PromptValidators.validateNonEmptyArray([], 'items')).toBe('Please select at least one items');
      expect(PromptValidators.validateNonEmptyArray([], 'methodology')).toBe('Please select at least one methodology');
    });
  });
});