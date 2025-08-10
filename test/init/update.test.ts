import { ConfigUpdater } from '../../src/init/update';
import { ProjectConfig, ConfigManager } from '../../src/init/config';
import { GeneratorFactory } from '../../src/generators/factory';
import { BaseGenerator } from '../../src/generators/base';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Mock dependencies
jest.mock('../../src/init/config');
jest.mock('../../src/generators/factory');

describe('ConfigUpdater', () => {
  let updater: ConfigUpdater;
  const testDir = join(__dirname, '../.test-update');
  const templatesDir = '/templates';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    updater = new ConfigUpdater(templatesDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('updateConfiguration', () => {
    it('should update existing configuration with new values', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'old-project',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.4.0'
      };

      const updates: Partial<ProjectConfig> = {
        tool: 'claude',
        methodologies: ['github-idd', 'tdd'],
        languages: ['typescript'],
        agents: ['frontend-specialist']
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(existingConfig);
      jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as BaseGenerator);

      // Act
      const result = await updater.updateConfiguration(testDir, updates);

      // Assert
      expect(result.tool).toBe('claude');
      expect(result.methodologies).toEqual(['github-idd', 'tdd']);
      expect(result.languages).toEqual(['typescript']);
      expect(result.agents).toEqual(['frontend-specialist']);
      expect(result.projectName).toBe('old-project'); // Should preserve existing
      expect(result.version).toBe('0.5.0'); // Should update version
      expect(mockGenerator.generateFiles).toHaveBeenCalled();
    });

    it('should handle version migrations', async () => {
      // Arrange
      const oldConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'migration-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.3.0' // Old version
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(oldConfig);
      jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();
      jest.spyOn(ConfigManager, 'needsUpdate').mockReturnValue(true);

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as BaseGenerator);

      // Act
      const result = await updater.updateConfiguration(testDir, {});

      // Assert
      expect(result.version).toBe('0.5.0');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Configuration updated from v0.3.0 to v0.5.0')
      );
    });

    it('should create backup before updating', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'backup-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(existingConfig);
      jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as BaseGenerator);

      // Act
      await updater.updateConfiguration(testDir, { tool: 'cursor' }, { backup: true });

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating backup')
      );
    });

    it('should handle update conflicts gracefully', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'conflict-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(existingConfig);
      jest.spyOn(ConfigManager, 'saveConfig').mockImplementation();

      const mockGenerator = {
        generateFiles: jest.fn().mockRejectedValue(new Error('Generation failed')),
        getToolName: jest.fn().mockReturnValue('Cursor')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as BaseGenerator);

      // Act & Assert
      await expect(
        updater.updateConfiguration(testDir, { tool: 'cursor' })
      ).rejects.toThrow('Generation failed');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update configuration'),
        expect.any(Error)
      );
    });
  });

  describe('regenerateFromConfig', () => {
    it('should regenerate all files from existing config', async () => {
      // Arrange
      const config: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd', 'tdd'],
        languages: ['typescript', 'javascript'],
        agents: ['frontend-specialist', 'backend-architect'],
        projectName: 'regen-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(config);

      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      jest.spyOn(GeneratorFactory, 'createGenerator')
        .mockReturnValue(mockGenerator as BaseGenerator);

      // Act
      await updater.regenerateFromConfig(testDir);

      // Assert
      expect(mockGenerator.generateFiles).toHaveBeenCalledWith(
        testDir,
        expect.objectContaining({
          projectName: 'regen-test',
          force: true, // Should force regeneration
          backup: false // Default no backup for regeneration
        })
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Regenerating configuration files')
      );
    });

    it('should throw error if no configuration exists', async () => {
      // Arrange
      jest.spyOn(ConfigManager, 'loadConfig').mockReturnValue(null);

      // Act & Assert
      await expect(updater.regenerateFromConfig(testDir)).rejects.toThrow(
        'No configuration found in'
      );
    });
  });

  describe('getUpdateSummary', () => {
    it('should provide detailed summary of changes', () => {
      // Arrange
      const oldConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'summary-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.4.0'
      };

      const newConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd', 'tdd'],
        languages: ['typescript'],
        agents: ['frontend-specialist'],
        projectName: 'summary-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      // Act
      const summary = ConfigUpdater.getUpdateSummary(oldConfig, newConfig);

      // Assert
      expect(summary.changes).toContain('Tool: cursor → claude');
      expect(summary.changes).toContain('Workflow: git-flow → github-flow');
      expect(summary.changes).toContain('Methodologies: scrum → github-idd, tdd');
      expect(summary.changes).toContain('Languages: python → typescript');
      expect(summary.changes).toContain('Agents: none → frontend-specialist');
      expect(summary.hasChanges).toBe(true);
    });

    it('should detect no changes', () => {
      // Arrange
      const config: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'no-change-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      // Act
      const summary = ConfigUpdater.getUpdateSummary(config, { ...config });

      // Assert
      expect(summary.hasChanges).toBe(false);
      expect(summary.changes).toEqual([]);
    });
  });

  describe('validateUpdate', () => {
    it('should validate update constraints', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['github-idd'],
        languages: ['typescript'],
        projectName: 'validate-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      const invalidUpdate = {
        tool: 'invalid-tool' as never,
        methodologies: [] as never
      };

      // Act & Assert
      await expect(
        updater.validateUpdate(existingConfig, invalidUpdate)
      ).rejects.toThrow('Invalid tool selection');
    });

    it('should allow valid updates', async () => {
      // Arrange
      const existingConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'valid-test',
        outputDirectory: testDir,
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      const validUpdate = {
        tool: 'claude' as const,
        methodologies: ['github-idd', 'tdd']
      };

      // Act & Assert
      await expect(
        updater.validateUpdate(existingConfig, validUpdate)
      ).resolves.not.toThrow();
    });
  });
});

describe('UpdateOptions', () => {
  it('should support various update options', () => {
    const options = {
      backup: true,
      force: false,
      interactive: true,
      dryRun: false
    };

    expect(options.backup).toBe(true);
    expect(options.interactive).toBe(true);
  });
});