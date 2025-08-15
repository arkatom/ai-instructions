/**
 * TDD RED PHASE: AgentsCommand Tests
 * Issue #93: Agent deployment CLI commands implementation
 * 
 * Test-First Development following strict TDD principles
 */

import { join, resolve, normalize } from 'path';
import { existsSync } from 'fs';
import { rm, mkdir, symlink } from 'fs/promises';
import * as os from 'os';
import { AgentsCommand } from '../../src/cli/commands/AgentsCommand';
import { AgentCommandArgs } from '../../src/cli/interfaces/CommandArgs';
import { AgentMetadata } from '../../src/agents/types';
import { AgentMetadataLoader } from '../../src/agents/metadata-loader';
import { AgentValidator } from '../../src/cli/validators/AgentValidator';
import { DependencyResolver } from '../../src/agents/dependency-resolver';

// Mock the modules
jest.mock('../../src/agents/metadata-loader');
jest.mock('../../src/cli/validators/AgentValidator');
jest.mock('../../src/agents/dependency-resolver');

// Test constants
const AGENT_NAMES = {
  TEST_WRITER: 'test-writer-fixer',
  CODE_REVIEWER: 'code-reviewer', 
  REACT_PRO: 'react-pro',
  ANGULAR_EXPERT: 'angular-expert',
  RAPID_PROTOTYPER: 'rapid-prototyper'
} as const;

// Type for deploy result
interface DeployResult {
  deployed: string[];
  outputPath?: string;
  action?: string;
  generated?: unknown;
}

// Type for profile result
interface ProfileResult {
  projectContext: {
    projectType: string;
    frameworks: string[];
    developmentPhase: string;
  };
  recommended: {
    primary: string[];
    suggested: string[];
  };
  detailedAnalysis?: {
    files: string[];
    dependencies: string[];
    testingTools: string[];
  };
}

describe('AgentsCommand', () => {
  let command: AgentsCommand;
  const testOutputDir = join(__dirname, '../temp-test-output');
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock agent metadata
    const mockAgentMetadata: AgentMetadata = {
      name: AGENT_NAMES.TEST_WRITER,
      category: 'quality',
      description: 'Test writing and fixing agent',
      tags: ['testing', 'quality', 'jest', 'tdd'],
      relationships: {
        requires: [],
        enhances: [AGENT_NAMES.CODE_REVIEWER],
        collaborates_with: [AGENT_NAMES.RAPID_PROTOTYPER],
        conflicts_with: []
      }
    };
    
    const mockCodeReviewer: AgentMetadata = {
      name: AGENT_NAMES.CODE_REVIEWER,
      category: 'quality',
      description: 'Code review agent',
      tags: ['quality', 'review'],
      relationships: {
        requires: [],
        enhances: [],
        collaborates_with: [AGENT_NAMES.TEST_WRITER],
        conflicts_with: []
      }
    };
    
    const mockReactPro: AgentMetadata = {
      name: AGENT_NAMES.REACT_PRO,
      category: 'development',
      description: 'React development expert',
      tags: ['react', 'frontend'],
      relationships: {
        requires: [],
        enhances: [],
        collaborates_with: [],
        conflicts_with: [AGENT_NAMES.ANGULAR_EXPERT]
      }
    };
    
    const mockAngularExpert: AgentMetadata = {
      name: AGENT_NAMES.ANGULAR_EXPERT,
      category: 'development',
      description: 'Angular development expert',
      tags: ['angular', 'frontend'],
      relationships: {
        requires: [],
        enhances: [],
        collaborates_with: [],
        conflicts_with: [AGENT_NAMES.REACT_PRO]
      }
    };
    
    // Setup mock metadata loader
    (AgentMetadataLoader as jest.MockedClass<typeof AgentMetadataLoader>).mockImplementation(() => {
      return {
        loadAgentMetadata: jest.fn().mockImplementation((name: string) => {
          switch (name) {
            case AGENT_NAMES.TEST_WRITER:
              return Promise.resolve(mockAgentMetadata);
            case AGENT_NAMES.CODE_REVIEWER:
              return Promise.resolve(mockCodeReviewer);
            case AGENT_NAMES.REACT_PRO:
              return Promise.resolve(mockReactPro);
            case AGENT_NAMES.ANGULAR_EXPERT:
              return Promise.resolve(mockAngularExpert);
            default:
              return Promise.resolve(null);
          }
        }),
        loadAllMetadata: jest.fn().mockResolvedValue([
          mockAgentMetadata, 
          mockCodeReviewer,
          mockReactPro,
          mockAngularExpert
        ]),
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
          if (name === '/etc/passwd') {
            return {
              isValid: false,
              errors: ['Path security violation: ' + name]
            };
          }
          return { isValid: true, errors: [] };
        }),
        validateExists: jest.fn().mockImplementation((name: string) => {
          const validAgents: string[] = [
            AGENT_NAMES.TEST_WRITER, 
            AGENT_NAMES.CODE_REVIEWER, 
            AGENT_NAMES.REACT_PRO, 
            AGENT_NAMES.ANGULAR_EXPERT
          ];
          if (validAgents.includes(name)) {
            return Promise.resolve({ isValid: true, errors: [] });
          }
          return Promise.resolve({ isValid: false, errors: ['Agent not found'] });
        })
      } as unknown as AgentValidator;
    });

    // Setup mock dependency resolver
    (DependencyResolver as jest.MockedClass<typeof DependencyResolver>).mockImplementation(() => {
      return {
        resolve: jest.fn().mockImplementation((agents: string[]) => {
          // Check for conflicts
          const hasReactPro = agents.includes(AGENT_NAMES.REACT_PRO);
          const hasAngularExpert = agents.includes(AGENT_NAMES.ANGULAR_EXPERT);
          
          if (hasReactPro && hasAngularExpert) {
            return {
              requiredAgents: [],
              conflicts: [{
                agent1: AGENT_NAMES.REACT_PRO,
                agent2: AGENT_NAMES.ANGULAR_EXPERT,
                reason: 'Conflicting frontend frameworks'
              }]
            };
          }
          
          // No conflicts, return required agents (could add dependency logic here)
          return {
            requiredAgents: [],
            conflicts: []
          };
        })
      } as unknown as DependencyResolver;
    });
    
    command = new AgentsCommand();
  });
  
  afterEach(async () => {
    // Clean up test output directory
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
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
          name: AGENT_NAMES.TEST_WRITER
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
          name: AGENT_NAMES.TEST_WRITER
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        
        const data = result.data as AgentMetadata;
        expect(data).toHaveProperty('name', AGENT_NAMES.TEST_WRITER);
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
          name: AGENT_NAMES.TEST_WRITER,
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
          name: AGENT_NAMES.TEST_WRITER
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
          name: AGENT_NAMES.TEST_WRITER
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

  describe('deploy subcommand', () => {
    describe('validation', () => {
      it('should require at least one agent name for deploy subcommand', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy'
          // agents array is missing
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one agent name is required for deploy subcommand');
      });

      it('should validate each agent name in the array', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: ['valid-agent', '../invalid-agent']
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
      });

      it('should pass validation with valid agent names', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER, AGENT_NAMES.CODE_REVIEWER]
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should validate output path if provided', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER],
          output: '/etc/passwd'  // Security violation
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('security') || e.includes('permission'))).toBe(true);
      });
    });

    describe('execution', () => {
      it('should deploy single agent successfully', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER]
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('deployed');
        expect((result.data as DeployResult).deployed).toContain(AGENT_NAMES.TEST_WRITER);
      });

      it('should deploy multiple agents with dependency resolution', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER, AGENT_NAMES.CODE_REVIEWER]
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect((result.data as DeployResult).deployed.length).toBeGreaterThanOrEqual(2);
      });

      it('should handle deployment conflicts', async () => {
        // Mock conflicting agents
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.REACT_PRO, AGENT_NAMES.ANGULAR_EXPERT]  // Conflicting frameworks
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(false);
        expect(result.error).toContain('conflict');
      });

      it('should deploy to specified output directory', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER],
          output: testOutputDir
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('outputPath', testOutputDir);
      });

      it('should return error for non-existent agents', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: ['non-existent-agent']
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Agent not found');
      });

      it('should generate deployment action if specified', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER],
          action: 'generate'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('action', 'generate');
        expect(result.data).toHaveProperty('generated');
      });
    });
  });

  describe('profile subcommand', () => {
    describe('validation', () => {
      it('should require project argument for profile subcommand', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile'
          // project is missing
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Project directory is required for profile subcommand');
      });

      it('should validate project path exists', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '/non/existent/path'
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Project directory does not exist'))).toBe(true);
      });

      it('should pass validation with valid project path', () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.',
          format: 'json'
        };
        
        const result = command.validate(args);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
    });

    describe('execution', () => {
      it('should profile agents for the project', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('recommended');
        expect(result.data).toHaveProperty('projectContext');
      });

      it('should detect project type and frameworks', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        
        const data = result.data as ProfileResult;
        expect(data.projectContext).toHaveProperty('projectType');
        expect(data.projectContext).toHaveProperty('frameworks');
        expect(data.projectContext).toHaveProperty('developmentPhase');
      });

      it('should provide agent recommendations based on project analysis', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        
        const data = result.data as ProfileResult;
        expect(data.recommended).toHaveProperty('primary');
        expect(data.recommended).toHaveProperty('suggested');
        expect(Array.isArray(data.recommended.primary)).toBe(true);
        expect(Array.isArray(data.recommended.suggested)).toBe(true);
      });

      it('should support JSON output format', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.',
          format: 'json'
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // JSON format should be handled by display logic
      });

      it('should include detailed analysis with verbose flag', async () => {
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: '.',
          verbose: true
        };
        
        const result = await command.execute(args);
        expect(result.success).toBe(true);
        
        const data = result.data as ProfileResult;
        expect(data).toHaveProperty('detailedAnalysis');
        expect(data.detailedAnalysis).toHaveProperty('files');
        expect(data.detailedAnalysis).toHaveProperty('dependencies');
        expect(data.detailedAnalysis).toHaveProperty('testingTools');
      });
    });
  });

  describe('Security Vulnerability Tests (RED Phase)', () => {
    describe('Path Traversal Vulnerability Tests', () => {
      it('should reject path traversal attempts with ../ patterns', () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32',
          '/tmp/../etc/passwd',
          'agents/../../sensitive/file.txt',
          'valid-dir/../../../etc/shadow',
          '..\\sensitive\\data'
        ];

        maliciousPaths.forEach(maliciousPath => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: maliciousPath
          };

          const result = command.validate(args);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('security') || 
            e.toLowerCase().includes('violation') ||
            e.toLowerCase().includes('path')
          )).toBe(true);
        });
      });

      it('should reject absolute paths outside project boundaries', () => {
        const absolutePaths = [
          '/etc/passwd',
          '/usr/local/bin/malicious',
          '/var/log/sensitive.log',
          '/home/user/.ssh/id_rsa',
          'C:\\Windows\\System32\\config',
          'C:\\Users\\sensitive\\data.txt'
        ];

        absolutePaths.forEach(absolutePath => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: absolutePath
          };

          const result = command.validate(args);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => 
            e.toLowerCase().includes('security') || 
            e.toLowerCase().includes('violation')
          )).toBe(true);
        });
      });

      it('should reject symlink-based path traversal attempts', async () => {
        const testDir = join(os.tmpdir(), 'security-test-' + Date.now());
        const maliciousLink = join(testDir, 'malicious-link');
        
        try {
          await mkdir(testDir, { recursive: true });
          // Create symlink pointing to sensitive directory
          await symlink('/etc', maliciousLink);
          
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: join(maliciousLink, 'passwd')
          };

          // This should be rejected by proper path validation
          const result = await command.execute(args);
          expect(result.success).toBe(false);
          expect(result.error).toMatch(/security|violation|path/i);
        } finally {
          await rm(testDir, { recursive: true, force: true });
        }
      });

      it('should validate resolved paths stay within project boundaries', () => {
        const projectRoot = process.cwd();
        const validPaths = [
          './agents',
          'output/agents',
          join(projectRoot, 'safe-output')
        ];

        validPaths.forEach(validPath => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: validPath
          };

          const result = command.validate(args);
          expect(result.isValid).toBe(true);
        });
      });

      it('should normalize paths before validation', () => {
        const pathsNeedingNormalization = [
          './output/../agents',  // Should resolve to ./agents
          'valid/path/./subdir', // Should resolve to valid/path/subdir
          'output//double//slash' // Should normalize slashes
        ];

        pathsNeedingNormalization.forEach(path => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: path
          };

          // Should validate normalized path, not raw input
          const result = command.validate(args);
          // These should pass validation after normalization
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('TOCTOU Race Condition Tests', () => {
      it('should handle concurrent directory creation attempts', async () => {
        const outputDir = join(os.tmpdir(), 'race-test-' + Date.now());
        
        // Simulate race condition: multiple concurrent attempts to create same directory
        const deployPromises = Array.from({ length: 5 }, () => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: outputDir
          };
          return command.execute(args);
        });

        const results = await Promise.all(deployPromises);
        
        // All should succeed or fail gracefully, no race condition crashes
        results.forEach(result => {
          // Either success or controlled failure, never undefined/crash
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          if (!result.success) {
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
          }
        });

        // At least one should succeed
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(0);

        // Clean up
        await rm(outputDir, { recursive: true, force: true });
      });

      it('should use atomic operations for directory creation', async () => {
        const outputDir = join(os.tmpdir(), 'atomic-test-' + Date.now());
        
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER],
          output: outputDir
        };

        // First deployment should create directory
        const result1 = await command.execute(args);
        expect(result1.success).toBe(true);
        expect(existsSync(outputDir)).toBe(true);

        // Second deployment to same directory should not fail
        const result2 = await command.execute(args);
        expect(result2.success).toBe(true);

        // Clean up
        await rm(outputDir, { recursive: true, force: true });
      });

      it('should handle EEXIST errors gracefully in mkdir operations', async () => {
        const outputDir = join(os.tmpdir(), 'eexist-test-' + Date.now());
        
        // Pre-create the directory
        await mkdir(outputDir, { recursive: true });
        
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER],
          output: outputDir
        };

        // Should handle existing directory gracefully
        const result = await command.execute(args);
        expect(result.success).toBe(true);

        // Clean up
        await rm(outputDir, { recursive: true, force: true });
      });
    });

    describe('Silent Error Handling Tests', () => {
      it('should properly report file system errors during project analysis', async () => {
        const nonExistentProject = '/definitely/does/not/exist';
        
        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'profile',
          project: nonExistentProject
        };

        // Should fail validation first
        const validation = command.validate(args);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => e.includes('does not exist'))).toBe(true);
      });

      it('should report JSON parsing errors in package.json analysis', async () => {
        const testDir = join(os.tmpdir(), 'json-error-test-' + Date.now());
        const malformedPackageJson = join(testDir, 'package.json');
        
        try {
          await mkdir(testDir, { recursive: true });
          // Create malformed package.json
          const fs = require('fs').promises;
          await fs.writeFile(malformedPackageJson, '{ "name": "test", invalid json }', 'utf-8');
          
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'profile',
            project: testDir
          };

          const result = await command.execute(args);
          // Should handle error gracefully, not silently ignore
          expect(result).toBeDefined();
          if (!result.success) {
            expect(result.error).toBeDefined();
            expect(result.error).toMatch(/json|parse|syntax|invalid/i);
          }
        } finally {
          await rm(testDir, { recursive: true, force: true });
        }
      });

      it('should log and report dependency resolution errors', async () => {
        // Mock dependency resolver to throw error
        const originalResolver = (DependencyResolver as jest.MockedClass<typeof DependencyResolver>);
        originalResolver.mockImplementation(() => {
          return {
            resolve: jest.fn().mockImplementation(() => {
              throw new Error('Dependency resolution failed');
            })
          } as unknown as DependencyResolver;
        });

        const args: AgentCommandArgs = {
          command: 'agents',
          subcommand: 'deploy',
          agents: [AGENT_NAMES.TEST_WRITER]
        };

        const result = await command.execute(args);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/dependency|resolution|failed/i);
      });

      it('should never have empty catch blocks', () => {
        // This is a code analysis test - we'll check the source for empty catch blocks
        const fs = require('fs');
        const sourceCode = fs.readFileSync(
          join(__dirname, '../../src/cli/commands/AgentsCommand.ts'),
          'utf-8'
        );

        // Look for catch blocks that are empty or only have comments
        const emptyCatchPattern = /catch\s*\([^)]*\)\s*\{\s*(\s*\/\/[^\n]*\n)*\s*\}/g;
        const emptyCatches = sourceCode.match(emptyCatchPattern);
        
        if (emptyCatches) {
          // Should not have empty catch blocks
          expect(emptyCatches.length).toBe(0);
        }
      });

      it('should provide meaningful error messages for all failure scenarios', async () => {
        const testScenarios = [
          {
            name: 'invalid agent name',
            args: {
              command: 'agents' as const,
              subcommand: 'deploy' as const,
              agents: ['../malicious-agent']
            }
          },
          {
            name: 'non-existent agent',
            args: {
              command: 'agents' as const,
              subcommand: 'info' as const,
              name: 'definitely-does-not-exist'
            }
          },
          {
            name: 'conflicting agents',
            args: {
              command: 'agents' as const,
              subcommand: 'deploy' as const,
              agents: [AGENT_NAMES.REACT_PRO, AGENT_NAMES.ANGULAR_EXPERT]
            }
          }
        ];

        for (const scenario of testScenarios) {
          const result = await command.execute(scenario.args);
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error!.length).toBeGreaterThan(0);
          expect(result.error).not.toBe('Unknown error');
          expect(result.error).not.toBe('');
        }
      });

      it('should use proper logging for all error conditions', async () => {
        // Mock console methods to capture logging
        const consoleSpy = {
          error: jest.spyOn(console, 'error').mockImplementation(),
          warn: jest.spyOn(console, 'warn').mockImplementation(),
          log: jest.spyOn(console, 'log').mockImplementation()
        };

        try {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: ['non-existent-agent']
          };

          await command.execute(args);
          
          // Should have logged the error (through Logger.error)
          // Note: This assumes Logger uses console methods internally
          const loggedSomething = consoleSpy.error.mock.calls.length > 0 ||
                                 consoleSpy.warn.mock.calls.length > 0 ||
                                 consoleSpy.log.mock.calls.length > 0;
          
          expect(loggedSomething).toBe(true);
        } finally {
          // Restore console methods
          Object.values(consoleSpy).forEach(spy => spy.mockRestore());
        }
      });
    });

    describe('Input Sanitization Tests', () => {
      it('should sanitize file paths in output operations', () => {
        const maliciousPaths = [
          'normal/path\x00malicious',
          'path/with\nnewline',
          'path\rwith\rcarriage\rreturn',
          'path\twith\ttabs'
        ];

        maliciousPaths.forEach(maliciousPath => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'deploy',
            agents: [AGENT_NAMES.TEST_WRITER],
            output: maliciousPath
          };

          const result = command.validate(args);
          // Should either reject or sanitize the path
          expect(result.isValid).toBe(false);
        });
      });

      it('should validate agent names contain only safe characters', () => {
        const maliciousNames = [
          'agent\x00name',
          'agent\nname',
          'agent;rm -rf /',
          'agent && curl malicious.com',
          'agent`dangerous`command',
          'agent$(rm -rf /)'
        ];

        maliciousNames.forEach(maliciousName => {
          const args: AgentCommandArgs = {
            command: 'agents',
            subcommand: 'info',
            name: maliciousName
          };

          const result = command.validate(args);
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
        });
      });
    });
  });
});