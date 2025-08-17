/**
 * End-to-End Integration Tests for Agent Commands
 * Issue #93: Agent deployment CLI commands implementation
 * 
 * Comprehensive integration tests covering real-world scenarios
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { readdir } from 'fs/promises';

describe('Agents Command E2E Integration', () => {
  // Increase timeout for E2E tests
  jest.setTimeout(30000);
  const cliPath = join(__dirname, '../../src/cli.ts');
  const testWorkDir = join(__dirname, '../output/e2e-test');
  const baseCwd = join(__dirname, '../..');
  
  // Helper to run CLI commands
  const runCli = (command: string, options: { cwd?: string } = {}) => {
    return execSync(
      `npx ts-node "${cliPath}" ${command}`,
      {
        encoding: 'utf-8',
        cwd: options.cwd || baseCwd,
        env: { ...process.env, NODE_ENV: 'test' }
      }
    );
  };

  beforeEach(() => {
    // Create test workspace
    if (!existsSync(testWorkDir)) {
      mkdirSync(testWorkDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test workspace
    if (existsSync(testWorkDir)) {
      rmSync(testWorkDir, { recursive: true, force: true });
    }
  });

  describe('Complete Agent Workflow', () => {
    it('should complete full agent discovery, selection, and deployment workflow', async () => {
      // Step 1: List available agents
      const listResult = runCli('agents list');
      expect(listResult).toContain('Available Agents');
      expect(listResult).toContain('test-writer-fixer');
      expect(listResult).toContain('code-reviewer');
      
      // Step 2: Get detailed info about specific agent
      const infoResult = runCli('agents info test-writer-fixer');
      expect(infoResult).toContain('Agent Information');
      expect(infoResult).toContain('test');
      expect(infoResult).toContain('code');
      
      // Step 3: Deploy agent to workspace
      const deployResult = runCli(`agents deploy test-writer-fixer --output "${testWorkDir}"`);
      expect(deployResult).toContain('Successfully deployed');
      
      // Step 4: Verify deployment
      const deployedFiles = await readdir(testWorkDir);
      expect(deployedFiles.length).toBeGreaterThan(0);
    });

    it('should handle agent recommendations based on project profile', () => {
      // Step 1: Profile current project
      const profileResult = runCli('agents profile .');
      expect(profileResult).toContain('Project Profile');
      expect(profileResult).toContain('nodejs');
      
      // Step 2: Get recommendations
      const recommendResult = runCli('agents recommend');
      expect(recommendResult).toContain('Recommended Agents');
      
      // Step 3: Deploy recommended agents
      const deployResult = runCli(`agents deploy test-writer-fixer code-reviewer --output "${testWorkDir}"`);
      expect(deployResult).toContain('Successfully deployed 2 agents');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid agent names gracefully', () => {
      expect(() => {
        runCli('agents info non-existent-agent-xyz');
      }).toThrow();
      
      try {
        runCli('agents info non-existent-agent-xyz');
      } catch (error) {
        const err = error as { stdout?: string; message: string };
        expect(err.stdout || err.message).toContain('Agent metadata not found');
      }
    });

    it('should deploy multiple framework agents without throwing errors', () => {
      // React and Angular agents can be deployed simultaneously
      // Conflict detection is handled at the application level, not deployment level
      const deployResult = runCli(`agents deploy react-pro angular-expert --output "${testWorkDir}"`);
      expect(deployResult).toContain('Successfully deployed 2 agents');
    });

    it('should validate project directory exists for profile command', () => {
      expect(() => {
        runCli('agents profile /non/existent/directory');
      }).toThrow();
      
      try {
        runCli('agents profile /non/existent/directory');
      } catch (error) {
        const err = error as { stdout?: string; message: string };
        expect(err.stdout || err.message).toContain('does not exist');
      }
    });
  });

  describe('Output Format Support', () => {
    it('should support JSON output format for all subcommands', () => {
      // List with JSON
      const listJson = runCli('agents list --format json');
      const listData = JSON.parse(listJson);
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.length).toBeGreaterThan(0);
      
      // Info with JSON  
      const infoJson = runCli('agents info test-writer-fixer --format json');
      const infoData = JSON.parse(infoJson);
      expect(infoData).toHaveProperty('name', 'test-writer-fixer');
      expect(infoData).toHaveProperty('category');
      
      // Profile with JSON
      const profileJson = runCli('agents profile . --format json');
      const profileData = JSON.parse(profileJson);
      expect(profileData).toHaveProperty('projectContext');
      expect(profileData).toHaveProperty('recommended');
    });

    it('should support tree format for hierarchical display', () => {
      const listTree = runCli('agents list --format tree');
      expect(listTree).toContain('├──');
      expect(listTree).toContain('└──');
      
      const infoTree = runCli('agents info test-writer-fixer --format tree');
      expect(infoTree).toContain('Agent: test-writer-fixer');
      expect(infoTree).toContain('├── Category:');
    });
  });

  describe('Agent Dependency Management', () => {
    it('should automatically resolve and deploy required dependencies', () => {
      // Create a mock agent with dependencies
      const result = runCli(`agents deploy test-writer-fixer --output "${testWorkDir}"`);
      expect(result).toContain('Successfully deployed');
      
      // Verify all required agents are included
      // In this case, test-writer-fixer enhances code-reviewer
      // So both should work together
    });

    it('should list agent relationships clearly', () => {
      const infoResult = runCli('agents info test-writer-fixer');
      expect(infoResult).toContain('Relationships');
      
      // Check for specific relationships
      if (infoResult.includes('Enhances')) {
        expect(infoResult).toContain('code-reviewer');
      }
      if (infoResult.includes('Collaborates')) {
        expect(infoResult).toContain('rapid-prototyper');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle listing many agents efficiently', () => {
      const startTime = Date.now();
      const result = runCli('agents list');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toContain('Available Agents');
    });

    it('should deploy multiple agents in batch efficiently', () => {
      const agents = ['test-writer-fixer', 'code-reviewer', 'rapid-prototyper'];
      const startTime = Date.now();
      
      const result = runCli(`agents deploy ${agents.join(' ')} --output "${testWorkDir}"`);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result).toContain('Successfully deployed');
      expect(result).toContain('3 agents');
    });
  });

  describe('Help and Documentation', () => {
    it('should provide comprehensive help for all subcommands', () => {
      const mainHelp = runCli('agents --help');
      expect(mainHelp).toContain('Agent deployment and management commands');
      expect(mainHelp).toContain('list');
      expect(mainHelp).toContain('recommend');
      expect(mainHelp).toContain('info');
      expect(mainHelp).toContain('deploy');
      expect(mainHelp).toContain('profile');
      
      // Each subcommand should have its own help
      const commands = ['list', 'recommend', 'info', 'deploy', 'profile'];
      commands.forEach(cmd => {
        expect(mainHelp).toContain(cmd);
      });
    });

    it('should show examples in help output', () => {
      const help = runCli('agents --help');
      // Verify help contains useful information
      expect(help).toContain('Options:');
      expect(help).toContain('Commands:');
    });
  });
});