import { 
  InteractiveInitializer, 
  InteractiveUtils
} from '../../src/init/interactive';
import { ProjectConfig, ConfigManager } from '../../src/init/config';
import { InteractivePrompts } from '../../src/init/prompts';
import { GeneratorFactory } from '../../src/generators/factory';
import { BaseGenerator } from '../../src/generators/base';

// Type definitions for test mocks
interface MockProcessExit {
  (code?: string | number | null | undefined): never;
}
import { existsSync, mkdirSync, rmSync } from 'fs';
import * as fs from 'fs';

const mockedFs = fs as jest.Mocked<typeof fs>;
import { join } from 'path';

// Mock dependencies
jest.mock('../../src/init/prompts');
jest.mock('../../src/init/config');
jest.mock('../../src/generators/factory');
jest.mock('fs');

describe('InteractiveInitializer', () => {
  let initializer: InteractiveInitializer;
  const testDir = join(__dirname, '../.test-interactive');
  const mockTemplatesDir = join(__dirname, '../../templates');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    initializer = new InteractiveInitializer(mockTemplatesDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialize', () => {
    it('should complete full initialization flow', async () => {
      // Arrange
      const mockConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd', 'tdd'],
        languages: ['typescript'],
        agents: ['frontend-specialist'],
        projectName: 'test-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      const mockPrompts = InteractivePrompts.prototype;
      const mockRunFlow = jest.spyOn(mockPrompts, 'runInteractiveFlow')
        .mockResolvedValue(mockConfig);

      const mockSaveConfig = jest.spyOn(ConfigManager, 'saveConfig')
        .mockImplementation();

      const mockLoadConfig = jest.spyOn(ConfigManager, 'loadConfig')
        .mockReturnValue(null);

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as unknown as BaseGenerator);

      // Act
      await initializer.initialize({ outputDirectory: testDir });

      // Assert
      expect(mockLoadConfig).toHaveBeenCalledWith(testDir);
      expect(mockRunFlow).toHaveBeenCalledWith(null, testDir);
      expect(mockGenerator.generateFiles).toHaveBeenCalledWith(
        testDir,
        expect.objectContaining({
          projectName: 'test-project',
          force: false,
          lang: 'ja',
          outputFormat: 'claude',
          conflictResolution: 'backup',
          interactive: true,
          backup: true
        })
      );
      expect(mockSaveConfig).toHaveBeenCalledWith(testDir, mockConfig);
    });

    it('should handle existing configuration', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'existing-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.4.0'
      };

      const updatedConfig: ProjectConfig = {
        ...existingConfig,
        tool: 'claude',
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig')
        .mockReturnValue(existingConfig);

      const mockPrompts = InteractivePrompts.prototype;
      jest.spyOn(mockPrompts, 'runInteractiveFlow')
        .mockResolvedValue(updatedConfig);

      jest.spyOn(ConfigManager, 'saveConfig')
        .mockImplementation();

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as unknown as BaseGenerator);

      // Act
      await initializer.initialize({ outputDirectory: testDir });

      // Assert
      expect(ConfigManager.loadConfig).toHaveBeenCalledWith(testDir);
      expect(InteractivePrompts.prototype.runInteractiveFlow)
        .toHaveBeenCalledWith(existingConfig, testDir);
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const mockExit = jest.spyOn(process, 'exit')
        .mockImplementation(((code?: string | number | null | undefined) => {
          throw new Error(`Process exited with code ${code}`);
        }) as MockProcessExit);

      jest.spyOn(ConfigManager, 'loadConfig')
        .mockImplementation(() => {
          throw new Error('Config load error');
        });

      // Act & Assert
      await expect(initializer.initialize()).rejects.toThrow('Process exited with code 1');
      expect(mockExit).toHaveBeenCalledWith(1);
      // Logger.error now outputs formatted messages
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Interactive initialization failed')
      );
    });

    it('should use verbose mode when specified', async () => {
      // Arrange
      const mockConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'test-project',
        outputDirectory: '/mock/test/directory',
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };
      
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(null);
      jest.spyOn(InteractivePrompts.prototype, 'runInteractiveFlow')
        .mockResolvedValue(mockConfig);
      jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();
      
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      await initializer.initialize({ verbose: true });

      // Assert - verbose mode should have shown some output
      expect(consoleSpy).toHaveBeenCalled();
      // Verify files were generated
      expect(mockGenerator.generateFiles).toHaveBeenCalled();
    });
  });

  describe('validatePrerequisites', () => {
    it('should return true when all required directories exist', () => {
      // Arrange
      mockedFs.existsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        return pathStr.includes('templates') ||
               pathStr.includes('instructions') ||
               pathStr.includes('agents') ||
               pathStr.includes('configs');
      });

      // Act
      const result = InteractiveInitializer.validatePrerequisites(mockTemplatesDir);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when templates directory does not exist', () => {
      // Arrange
      mockedFs.existsSync.mockReturnValue(false);

      // Act
      const result = InteractiveInitializer.validatePrerequisites('/non-existent');

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Templates directory not found')
      );
    });

    it('should return false when required subdirectory is missing', () => {
      // Arrange
      mockedFs.existsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('templates')) return true;
        if (pathStr.endsWith('instructions')) return true;
        if (pathStr.endsWith('agents')) return false; // Missing agents
        if (pathStr.endsWith('configs')) return true;
        return false;
      });

      // Act
      const result = InteractiveInitializer.validatePrerequisites(mockTemplatesDir);

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Required template directory missing: agents')
      );
    });
  });

  describe('hasExistingConfig', () => {
    it('should return true when configuration exists', () => {
      // Arrange
      const mockConfig = ConfigManager.createConfig();
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(mockConfig);

      // Act
      const result = InteractiveInitializer.hasExistingConfig(testDir);

      // Assert
      expect(result).toBe(true);
      expect(ConfigManager.loadConfig).toHaveBeenCalledWith(testDir);
    });

    it('should return false when configuration does not exist', () => {
      // Arrange
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(null);

      // Act
      const result = InteractiveInitializer.hasExistingConfig(testDir);

      // Assert
      expect(result).toBe(false);
    });

    it('should use current directory when not specified', () => {
      // Arrange
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(null);
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/mock/working/directory');

      // Act
      InteractiveInitializer.hasExistingConfig();
      
      // Restore
      process.cwd = originalCwd;

      // Assert
      expect(ConfigManager.loadConfig).toHaveBeenCalledWith('/mock/working/directory');
    });
  });

  describe('showStatus', () => {
    it('should display current configuration', () => {
      // Arrange
      const mockConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'status-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(mockConfig);
      mockedFs.existsSync.mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      InteractiveInitializer.showStatus(testDir);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current Configuration'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Claude'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('status-project'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    });

    it('should show no configuration message when not found', () => {
      // Arrange
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      InteractiveInitializer.showStatus(testDir);

      // Assert - should show configuration not found message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Run "ai-instructions init"')
      );
    });

    it('should handle unknown tool gracefully', () => {
      // Arrange
      const mockConfig: ProjectConfig = {
        tool: 'unknown-tool' as never,
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'unknown-tool-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(mockConfig);
      const consoleSpy = jest.spyOn(console, 'log');

      // Act
      InteractiveInitializer.showStatus(testDir);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown-tool (unknown)')
      );
    });
  });
});

describe('InteractiveUtils', () => {
  describe('isCI', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should detect CI environment', () => {
      // Test various CI environment variables
      const ciEnvVars = [
        'CI',
        'GITHUB_ACTIONS',
        'GITLAB_CI',
        'JENKINS_HOME',
        'BUILDKITE',
        'CIRCLECI'
      ];

      ciEnvVars.forEach(envVar => {
        process.env = { ...originalEnv };
        process.env[envVar] = 'true';
        expect(InteractiveUtils.isCI()).toBe(true);
      });
    });

    it('should return false when not in CI', () => {
      // Arrange
      process.env = { ...originalEnv };
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;

      // Act & Assert
      expect(InteractiveUtils.isCI()).toBe(false);
    });
  });

  describe('canRunInteractive', () => {
    it('should return true when TTY is available and not in CI', () => {
      // Arrange
      jest.spyOn(InteractiveUtils, 'isCI').mockReturnValue(false);
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true
      });
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true
      });

      // Act
      const result = InteractiveUtils.canRunInteractive();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when in CI environment', () => {
      // Arrange
      jest.spyOn(InteractiveUtils, 'isCI').mockReturnValue(true);

      // Act
      const result = InteractiveUtils.canRunInteractive();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when TTY is not available', () => {
      // Arrange
      jest.spyOn(InteractiveUtils, 'isCI').mockReturnValue(false);
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true
      });

      // Act
      const result = InteractiveUtils.canRunInteractive();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('showInteractiveWarning', () => {
    it('should display warning message', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      InteractiveUtils.showInteractiveWarning();

      // Assert - should show command-line usage instructions
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Use command-line options')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ai-instructions init')
      );
    });
  });
});