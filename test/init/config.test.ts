import { 
  ProjectConfig, 
  ConfigManager, 
  AVAILABLE_TOOLS,
  AVAILABLE_WORKFLOWS,
  AVAILABLE_METHODOLOGIES,
  AVAILABLE_LANGUAGES,
  DEFAULT_CONFIG
} from '../../src/init/config';
import { writeFileSync, existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Configuration Management', () => {
  const testDir = join(__dirname, '../.test-config');
  const configFile = join(testDir, '.ai-instructions.json');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ConfigManager', () => {
    describe('createConfig', () => {
      it('should create config with default values', () => {
        // Arrange - Mock process.cwd() to avoid contamination detection
        const originalCwd = process.cwd;
        process.cwd = jest.fn().mockReturnValue('/mock/current/directory');
        
        // Act
        const config = ConfigManager.createConfig();
        
        // Restore
        process.cwd = originalCwd;

        // Assert
        expect(config.tool).toBe('claude');
        expect(config.workflow).toBe('github-flow');
        expect(config.methodologies).toEqual(['github-idd']);
        expect(config.languages).toEqual(['typescript']);
        expect(config.projectName).toBe('my-project');
        expect(config.version).toBe('0.5.0');
        expect(config.generatedAt).toBeDefined();
        expect(config.outputDirectory).toBe('/mock/current/directory');
        expect(config.agents).toBeUndefined();
      });

      it('should create config with custom overrides', () => {
        // Arrange
        const overrides: Partial<ProjectConfig> = {
          tool: 'cursor',
          workflow: 'git-flow',
          methodologies: ['tdd', 'scrum'],
          languages: ['python', 'go'],
          projectName: 'test-project',
          outputDirectory: '/custom/path',
          agents: ['frontend-specialist', 'backend-architect']
        };

        // Act
        const config = ConfigManager.createConfig(overrides);

        // Assert
        expect(config.tool).toBe('cursor');
        expect(config.workflow).toBe('git-flow');
        expect(config.methodologies).toEqual(['tdd', 'scrum']);
        expect(config.languages).toEqual(['python', 'go']);
        expect(config.projectName).toBe('test-project');
        expect(config.outputDirectory).toBe('/custom/path');
        expect(config.agents).toEqual(['frontend-specialist', 'backend-architect']);
      });

      it('should not include agents if not specified', () => {
        // Arrange
        const overrides: Partial<ProjectConfig> = {
          tool: 'cline',
          projectName: 'no-agents-project'
        };

        // Act
        const config = ConfigManager.createConfig(overrides);

        // Assert
        expect(config.agents).toBeUndefined();
      });

      it('should include empty agents array if explicitly set', () => {
        // Arrange
        const overrides: Partial<ProjectConfig> = {
          agents: []
        };

        // Act
        const config = ConfigManager.createConfig(overrides);

        // Assert
        expect(config.agents).toEqual([]);
      });
    });

    describe('saveConfig', () => {
      it('should save config to file', () => {
        // Arrange
        const config = ConfigManager.createConfig({
          projectName: 'save-test',
          outputDirectory: testDir
        });

        // Act
        ConfigManager.saveConfig(testDir, config);

        // Assert
        expect(existsSync(configFile)).toBe(true);
        const savedContent = JSON.parse(readFileSync(configFile, 'utf-8'));
        expect(savedContent.projectName).toBe('save-test');
        expect(savedContent.outputDirectory).toBe(testDir);
      });

      it('should format config JSON with proper indentation', () => {
        // Arrange
        const config = ConfigManager.createConfig();

        // Act
        ConfigManager.saveConfig(testDir, config);

        // Assert
        const content = readFileSync(configFile, 'utf-8');
        expect(content).toContain('  "tool"');
        expect(content).toContain('  "workflow"');
      });
    });

    describe('loadConfig', () => {
      it('should load existing config from file', () => {
        // Arrange
        const originalConfig = ConfigManager.createConfig({
          projectName: 'load-test',
          tool: 'github-copilot',
          agents: ['code-reviewer']
        });
        writeFileSync(configFile, JSON.stringify(originalConfig, null, 2));

        // Act
        const loadedConfig = ConfigManager.loadConfig(testDir);

        // Assert
        expect(loadedConfig).not.toBeNull();
        expect(loadedConfig?.projectName).toBe('load-test');
        expect(loadedConfig?.tool).toBe('github-copilot');
        expect(loadedConfig?.agents).toEqual(['code-reviewer']);
      });

      it('should return null if config file does not exist', () => {
        // Act
        const config = ConfigManager.loadConfig(testDir);

        // Assert
        expect(config).toBeNull();
      });

      it('should return null if config file is invalid JSON', () => {
        // Arrange
        writeFileSync(configFile, 'invalid json content');

        // Act
        const config = ConfigManager.loadConfig(testDir);

        // Assert
        expect(config).toBeNull();
      });

      it('should return null if config validation fails', () => {
        // Arrange
        const invalidConfig = {
          tool: 'invalid-tool',
          workflow: 'github-flow'
        };
        writeFileSync(configFile, JSON.stringify(invalidConfig));

        // Act
        const config = ConfigManager.loadConfig(testDir);

        // Assert
        expect(config).toBeNull();
      });
    });

    describe('validateConfig', () => {
      it('should validate correct config', () => {
        // Arrange
        const config: ProjectConfig = {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          generatedAt: new Date().toISOString(),
          version: '0.5.0',
          projectName: 'valid-project',
          outputDirectory: '/valid/path'
        };

        // Act
        const isValid = ConfigManager.validateConfig(config);

        // Assert
        expect(isValid).toBe(true);
      });

      it('should reject config with missing required fields', () => {
        // Arrange
        const invalidConfigs = [
          { tool: 'claude' }, // Missing other fields
          { 
            tool: 'claude',
            workflow: 'github-flow',
            // Missing methodologies
            languages: ['typescript'],
            generatedAt: new Date().toISOString(),
            version: '0.5.0',
            projectName: 'test',
            outputDirectory: '/'
          },
          null,
          undefined,
          'not an object'
        ];

        // Act & Assert
        invalidConfigs.forEach(config => {
          expect(ConfigManager.validateConfig(config)).toBe(false);
        });
      });

      it('should reject config with invalid tool', () => {
        // Arrange
        const config = {
          tool: 'invalid-tool',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          generatedAt: new Date().toISOString(),
          version: '0.5.0',
          projectName: 'test',
          outputDirectory: '/'
        };

        // Act
        const isValid = ConfigManager.validateConfig(config);

        // Assert
        expect(isValid).toBe(false);
      });

      it('should reject config with non-array methodologies or languages', () => {
        // Arrange
        const config = {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: 'not-an-array',
          languages: 'also-not-an-array',
          generatedAt: new Date().toISOString(),
          version: '0.5.0',
          projectName: 'test',
          outputDirectory: '/'
        };

        // Act
        const isValid = ConfigManager.validateConfig(config);

        // Assert
        expect(isValid).toBe(false);
      });

      it('should accept config with optional agents field', () => {
        // Arrange
        const configWithAgents: ProjectConfig = {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          generatedAt: new Date().toISOString(),
          version: '0.5.0',
          projectName: 'test',
          outputDirectory: '/',
          agents: ['frontend-specialist']
        };

        const configWithoutAgents: ProjectConfig = {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          generatedAt: new Date().toISOString(),
          version: '0.5.0',
          projectName: 'test',
          outputDirectory: '/'
        };

        // Act & Assert
        expect(ConfigManager.validateConfig(configWithAgents)).toBe(true);
        expect(ConfigManager.validateConfig(configWithoutAgents)).toBe(true);
      });
    });

    describe('needsUpdate', () => {
      it('should detect version mismatch', () => {
        // Arrange
        const config: ProjectConfig = {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          generatedAt: new Date().toISOString(),
          version: '0.4.0',
          projectName: 'test',
          outputDirectory: '/'
        };

        // Act & Assert
        expect(ConfigManager.needsUpdate(config, '0.5.0')).toBe(true);
        expect(ConfigManager.needsUpdate(config, '0.4.0')).toBe(false);
      });
    });

    describe('getAvailableAgents', () => {
      it('should return list of available agents', () => {
        // Act
        const agents = ConfigManager.getAvailableAgents('/templates');

        // Assert
        expect(Array.isArray(agents)).toBe(true);
        expect(agents.length).toBeGreaterThan(0);
        
        const frontendAgent = agents.find(a => a.value === 'frontend-specialist');
        expect(frontendAgent).toBeDefined();
        expect(frontendAgent?.name).toBe('Frontend Developer');
        expect(frontendAgent?.description).toContain('React');
      });

      it('should return agents with proper structure', () => {
        // Act
        const agents = ConfigManager.getAvailableAgents('/templates');

        // Assert
        agents.forEach(agent => {
          expect(agent).toHaveProperty('name');
          expect(agent).toHaveProperty('value');
          expect(agent).toHaveProperty('description');
          expect(typeof agent.name).toBe('string');
          expect(typeof agent.value).toBe('string');
          expect(typeof agent.description).toBe('string');
        });
      });
    });
  });

  describe('Constants and Configuration', () => {
    describe('AVAILABLE_TOOLS', () => {
      it('should have all required tools', () => {
        // Assert
        expect(AVAILABLE_TOOLS).toHaveProperty('claude');
        expect(AVAILABLE_TOOLS).toHaveProperty('cursor');
        expect(AVAILABLE_TOOLS).toHaveProperty('cline');
        expect(AVAILABLE_TOOLS).toHaveProperty('github-copilot');
      });

      it('should have correct tool configurations', () => {
        // Assert
        expect(AVAILABLE_TOOLS.claude?.configFile).toBe('CLAUDE.md');
        expect(AVAILABLE_TOOLS.claude?.supportsAgents).toBe(true);
        
        expect(AVAILABLE_TOOLS.cursor?.configFile).toBe('.cursor/rules/main.mdc');
        expect(AVAILABLE_TOOLS.cursor?.supportsAgents).toBe(false);
        
        expect(AVAILABLE_TOOLS.cline?.configFile).toBe('.cline/instructions.md');
        expect(AVAILABLE_TOOLS['github-copilot']?.configFile).toBe('.github/copilot-instructions.md');
      });

      it('should have all required properties for each tool', () => {
        // Assert
        Object.values(AVAILABLE_TOOLS).forEach(tool => {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('configFile');
          expect(tool).toHaveProperty('supportsAgents');
          expect(tool).toHaveProperty('templatePath');
        });
      });
    });

    describe('AVAILABLE_WORKFLOWS', () => {
      it('should have github-flow and git-flow', () => {
        // Assert
        const workflows = AVAILABLE_WORKFLOWS.map(w => w.value);
        expect(workflows).toContain('github-flow');
        expect(workflows).toContain('git-flow');
      });

      it('should have proper structure', () => {
        // Assert
        AVAILABLE_WORKFLOWS.forEach(workflow => {
          expect(workflow).toHaveProperty('name');
          expect(workflow).toHaveProperty('value');
          expect(workflow).toHaveProperty('description');
        });
      });
    });

    describe('AVAILABLE_METHODOLOGIES', () => {
      it('should include required methodologies', () => {
        // Assert
        const methodologies = AVAILABLE_METHODOLOGIES.map(m => m.value);
        expect(methodologies).toContain('github-idd');
        expect(methodologies).toContain('tdd');
        expect(methodologies).toContain('scrum');
      });
    });

    describe('AVAILABLE_LANGUAGES', () => {
      it('should include common programming languages', () => {
        // Assert
        const languages = AVAILABLE_LANGUAGES.map(l => l.value);
        expect(languages).toContain('typescript');
        expect(languages).toContain('javascript');
        expect(languages).toContain('python');
        expect(languages).toContain('go');
        expect(languages).toContain('java');
        expect(languages).toContain('rust');
      });
    });

    describe('DEFAULT_CONFIG', () => {
      it('should have sensible defaults', () => {
        // Assert
        expect(DEFAULT_CONFIG.tool).toBe('claude');
        expect(DEFAULT_CONFIG.workflow).toBe('github-flow');
        expect(DEFAULT_CONFIG.methodologies).toContain('github-idd');
        expect(DEFAULT_CONFIG.languages).toContain('typescript');
        expect(DEFAULT_CONFIG.projectName).toBe('my-project');
      });
    });
  });
});